import { getProductionOrderTechPackSnapshot } from '../production-order-tech-pack-runtime.ts'
import type { SpecialCraftTaskOrder } from '../special-craft-task-orders.ts'
import { getPdaSession } from '../store-domain-pda.ts'
import { readWoolStore, replaceWoolStore, type WoolDomainStore } from './store.ts'
import { confirmWoolDownstreamReceipt } from './commands.ts'
import type { WoolWorkOrder } from './types.ts'

export interface WoolFinalCraftBatch {
  handoverId: string
  woolOrderId: string
  woolOrderNo: string
  skuCode: string
  sentQty: number
  receivedQty?: number
  receivedAt?: string
  receivedBy?: string
  handedOverAt: string
  sourceFactoryName: string
  styleImageUrl?: string
  styleNo: string
}

function isFinalInput(order: WoolWorkOrder, task: SpecialCraftTaskOrder): boolean {
  if (order.stage !== 'LINKING' || order.kind !== 'WHOLE_GARMENT' || order.productionOrderId !== task.productionOrderId || task.targetObject !== '成衣' || task.woolPieceKey || !task.sourceEntryId) return false
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const entry = snapshot?.processEntries.find(entry => entry.id === task.sourceEntryId)
  if (!entry || !(entry.inputObjectType === 'GARMENT' || entry.targetObject === 'GARMENT_SEMI' || entry.selectedTargetObject === '成衣')) return false
  const woolEntries = order.sourceEntryId ? [order.sourceEntryId] : snapshot!.processEntries.filter(entry => entry.processCode === 'WOOL' || entry.processCode === 'PROC_WOOL').map(entry => entry.id)
  return woolEntries.some(id => entry.predecessorEntryIds?.includes(id))
}

/** The whole garment after linking belongs to the next garment route, never the piece-return route. */
export function projectWoolFinalCraftTask(task: SpecialCraftTaskOrder, store: WoolDomainStore, peers: SpecialCraftTaskOrder[] = [task]): SpecialCraftTaskOrder {
  const orders = Object.values(store.workOrders).filter(order => isFinalInput(order, task))
  if (!orders.length) return task
  const skuCodes = new Set((task.demandLines ?? []).map(line => line.skuCode).filter(Boolean))
  const batches: WoolFinalCraftBatch[] = store.handovers.flatMap(handover => {
    const order = orders.find(order => order.woolOrderId === handover.woolOrderId)
    if (!order || handover.pieceKey || handover.automatic || handover.receiverType !== 'DOWNSTREAM_FACTORY' || handover.receiverId !== task.factoryId
      || (handover.routeNodeId && handover.routeNodeId !== task.sourceEntryId)
      || (handover.targetWorkOrderId && handover.targetWorkOrderId !== task.taskOrderId) || !skuCodes.has(handover.outputSkuCode)) return []
    // A receiver factory alone cannot select two parallel garment nodes at that factory.
    if (!handover.targetWorkOrderId && !handover.routeNodeId && peers.filter(peer => peer.factoryId === task.factoryId && isFinalInput(order, peer)
      && peer.demandLines?.some(line => line.skuCode === handover.outputSkuCode)).length !== 1) return []
    const sentQty = [...store.qtyChangeLogs].reverse().find(log => log.recordType === 'HANDOVER' && log.recordId === handover.handoverId)?.afterQty ?? handover.handoverQty
    const receipt = handover.downstreamReceipt
    return [{ handoverId: handover.handoverId, woolOrderId: order.woolOrderId, woolOrderNo: order.woolOrderNo, skuCode: handover.outputSkuCode,
      sentQty, handedOverAt: handover.handedOverAt, sourceFactoryName: order.factoryName, styleImageUrl: order.styleImageUrl, styleNo: order.styleNo,
      ...(receipt?.status === 'CONFIRMED' ? { receivedQty: receipt.actualReceivedQty ?? 0, receivedAt: receipt.receivedAt, receivedBy: receipt.receivedBy } : {}) }]
  }).sort((a, b) => a.handedOverAt.localeCompare(b.handedOverAt) || a.handoverId.localeCompare(b.handoverId))
  const receivedBySku = new Map<string, number>()
  for (const batch of batches) receivedBySku.set(batch.skuCode, (receivedBySku.get(batch.skuCode) ?? 0) + (batch.receivedQty ?? 0))
  const lines = new Map<string, NonNullable<SpecialCraftTaskOrder['lineProgress']>[number]>()
  for (const line of task.demandLines ?? []) {
    const sku = line.skuCode || '', existing = lines.get(sku), progress = task.lineProgress?.find(row => row.skuCode === sku)
    if (existing) { existing.planQty += line.planPieceQty; continue }
    lines.set(sku, { lineProgressKey: `sku:${sku}`, lineType: 'sku', skuCode: sku, partName: line.partName || '成衣', colorName: line.colorName,
      sizeCode: line.sizeCode, planQty: line.planPieceQty, receivedQty: receivedBySku.get(sku) ?? 0,
      completedQty: Math.min(progress?.completedQty ?? 0, receivedBySku.get(sku) ?? 0), returnedQty: Math.min(progress?.returnedQty ?? 0, progress?.completedQty ?? 0, receivedBySku.get(sku) ?? 0) })
  }
  const lineProgress = [...lines.values()], sum = (field: 'receivedQty' | 'completedQty' | 'returnedQty') => lineProgress.reduce((n, row) => n + row[field], 0)
  const receivedQty = sum('receivedQty'), completedQty = sum('completedQty'), returnedQty = sum('returnedQty')
  const status = !receivedQty ? '待接收' : task.status === '待接收' ? '加工中' : task.status
  return { ...task, woolFinalInputOrderIds: orders.map(order => order.woolOrderId), woolFinalReceipts: batches, lineProgress,
    receivedQty, inputReceivedQty: receivedQty, completedQty, returnedQty, currentQty: receivedQty - completedQty, waitHandoverQty: completedQty - returnedQty,
    status, executionStatus: status === '待接收' ? 'WAIT_PICKUP' : status === '已完结' ? 'COMPLETED' : 'PROCESSING', executionStatusLabel: status }
}

export function confirmWoolFinalCraftBatches(task: SpecialCraftTaskOrder, input: {
  receipts: Array<{ handoverId: string; actualReceivedQty: number }>
  operatorName: string; operatedAt: string; sourceChannel: string
}): void {
  const current = projectWoolFinalCraftTask(task, readWoolStore())
  const selectedSourceIds = new Set((task.woolFinalReceipts || []).map(batch => batch.handoverId))
  current.woolFinalReceipts = current.woolFinalReceipts?.filter(batch => selectedSourceIds.has(batch.handoverId))
  if (!current.woolFinalInputOrderIds?.length) throw new Error('该成衣工艺单没有缝盘最终交出来货')
  const session = getPdaSession()
  if ((['PDA', '移动端'].includes(input.sourceChannel) && !session) || (session && session.factoryId !== task.factoryId)) throw new Error('该缝盘成衣来货不属于当前登录工厂')
  if (!input.operatorName.trim() || !input.operatedAt.trim() || !input.receipts.length || new Set(input.receipts.map(row => row.handoverId)).size !== input.receipts.length) throw new Error('请选择实际交出批次并填写接收人、时间和实收件数')
  for (const inputLine of input.receipts) {
    const batch = current.woolFinalReceipts?.find(batch => batch.handoverId === inputLine.handoverId)
    if (!batch || !Number.isInteger(inputLine.actualReceivedQty) || inputLine.actualReceivedQty < 0 || inputLine.actualReceivedQty > batch.sentQty) throw new Error('实收必须对应本厂、本工艺节点的缝盘实际交出批次，且不得超过交出件数')
    if (batch.receivedQty !== undefined && (batch.receivedQty !== inputLine.actualReceivedQty || batch.receivedAt !== input.operatedAt || batch.receivedBy !== input.operatorName)) throw new Error('此批次已接收，不能重复登记不同实收')
    if (input.operatedAt < batch.handedOverAt) throw new Error('接收时间不能早于该批交出时间')
  }
  const before = readWoolStore()
  try {
    for (const row of input.receipts) {
      const batch = current.woolFinalReceipts!.find(batch => batch.handoverId === row.handoverId)!
      if (batch.receivedQty !== undefined) continue
      confirmWoolDownstreamReceipt(row.handoverId, { commandId: `WFINAL:${task.taskOrderId}:${row.handoverId}`, actualReceivedQty: row.actualReceivedQty, receivedAt: input.operatedAt, receivedBy: input.operatorName })
    }
  } catch (error) { replaceWoolStore(before); throw error }
}
