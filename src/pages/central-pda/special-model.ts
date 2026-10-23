import { parseFcsQrValue } from '../../data/fcs/task-qr.ts'
import { centralWoolCraftAssignments } from './wool-craft-model.ts'
import { listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { getSpecialCraftTaskOrderById, listSpecialCraftTaskOrders, readSpecialCraftTaskLineProgress, type SpecialCraftTaskOrder } from '../../data/fcs/special-craft-task-orders.ts'
import { listEnabledSpecialCraftOperationDefinitions, listVisibleSpecialCraftOperationsForFactory, resolveAuxiliaryWarehouseFlow } from '../../data/fcs/special-craft-operations.ts'
import { getAvailableSpecialCraftWebActions } from '../../data/fcs/process-web-status-actions.ts'
import { getProductionOrderTechPackSnapshot } from '../../data/fcs/production-order-tech-pack-runtime.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'
import { reviewedStyleImage } from '../../data/pcs-reviewed-image-catalog.ts'
import type { CentralPdaLanguage } from './frame.ts'

export type CentralSpecialView = 'detail' | 'receive' | 'work' | 'handoff' | 'finish' | 'receipt'
export const centralSpecialActions = {
  receive: 'SPECIAL_CRAFT_CONFIRM_RECEIVE', work: 'SPECIAL_CRAFT_PROCESS_REPORT',
  handoff: 'SPECIAL_CRAFT_SUBMIT_HANDOVER', finish: 'SPECIAL_CRAFT_COMPLETE_ORDER',
} as const
export type CentralSpecialAction = keyof typeof centralSpecialActions
export interface CentralQuantityRow {
  key: string; label: string; skuCode?: string; feiTicketNo?: string
  max: number | null; unit: string; ticket: boolean
}

import { centralIndonesianOperationNames as idOperations } from './operation-label.ts'
export { centralOperationLabel } from './operation-label.ts'

const idWords: Record<string, string> = {
  '前片': 'Panel depan', '后片': 'Panel belakang', '左袖': 'Lengan kiri', '右袖': 'Lengan kanan', '袖片': 'Panel lengan',
  '前身': 'Bagian depan', '后身': 'Bagian belakang', '成衣': 'Pakaian', '裁片': 'Panel', '已裁部位': 'Panel',
  '面料': 'Kain', '辅料': 'Aksesori', '捆条': 'Bis', '白色': 'Putih', '黑色': 'Hitam', '灰色': 'Abu-abu', '蓝色': 'Biru',
  '均码': 'Satu ukuran', '定长': 'Panjang tetap', '—': '—',
}
export function centralBusinessLabel(value: string | undefined, lang: CentralPdaLanguage, fallback: string): string {
  if (!value) return fallback
  if (lang === 'zh' || !/[\u3400-\u9fff]/.test(value)) return value
  return idWords[value] || idOperations[value] || fallback
}
export function centralUnit(unit: string, lang: CentralPdaLanguage) {
  if (lang === 'zh') return unit
  return ({ '片': 'potong', '件': 'pcs', '张': 'lembar', '条': 'strip', '个': 'buah', '米': 'm', '公斤': 'kg', '卷': 'rol', '筒': 'kon' } as Record<string, string>)[unit] || unit
}
export function listCentralSpecialOrders(factoryId?: string, operationId?: string): SpecialCraftTaskOrder[] {
  const factories = new Set(listFactoryMasterRecords().filter(isCentralPdaFactory).map(factory => factory.id))
  return listSpecialCraftTaskOrders().filter(order => factories.has(order.factoryId)
    && !order.woolPieceKey && !order.woolFinalInputOrderIds?.length
    && (!factoryId || order.factoryId === factoryId) && (!operationId || order.operationId === operationId))
}
/** Keep printed Web task/order IDs intact, including colon-separated original IDs. */
export function centralSpecialScanKey(raw: string): string {
  const code = raw.trim()
  if (!/^FCS:/i.test(code)) return code.toLowerCase()
  const parsed = parseFcsQrValue(code.replace(/^fcs:(task|work_order):v1:/i, (_, type: string) => `FCS:${type.toUpperCase()}:v1:`))
  return parsed.version === 'v1' && (parsed.type === 'WORK_ORDER' || parsed.type === 'TASK') ? (parsed.id || '').toLowerCase() : ''
}
export function centralSpecialScanOrders(raw: string, factoryId: string, operationId: string): SpecialCraftTaskOrder[] {
  const key = centralSpecialScanKey(raw)
  if (!key) return []
  return listCentralSpecialOrders(factoryId, operationId).filter(order => [order.taskOrderId, order.taskOrderNo,
    order.sourceTaskId, order.sourceTaskNo, order.productionOrderId, order.productionOrderNo,
    ...order.feiTicketNos, ...(order.demandLines || []).map(row => row.skuCode),
    ...(order.buttonLoopInputLines || []).map(row => row.feiTicketNo)]
    .some(value => value?.toLowerCase() === key))
}

export function listCentralSpecialFactories(preferredFactoryId?: string) {
  const active = new Set([...listCentralSpecialOrders().map(order => order.factoryId), ...centralWoolCraftAssignments().map(task => task.factoryId)])
  return listFactoryMasterRecords().filter(factory => isCentralPdaFactory(factory) && factory.status === 'active' && (active.has(factory.id) || factory.id === preferredFactoryId))
}
export function listCentralSpecialOperations(factoryId: string) {
  const assigned = new Set([...listCentralSpecialOrders(factoryId).map(order => order.operationId), ...centralWoolCraftAssignments(factoryId).map(task => task.operationId)])
  const visible = new Set(listVisibleSpecialCraftOperationsForFactory(factoryId).map(operation => operation.operationId))
  return listEnabledSpecialCraftOperationDefinitions().filter(operation => assigned.has(operation.operationId) || visible.has(operation.operationId))
}
export function getCentralSpecialOrder(id: string, factoryId: string, operationId: string) {
  const order = getSpecialCraftTaskOrderById(id)
  return order && order.factoryId === factoryId && order.operationId === operationId
    && !order.woolPieceKey && !order.woolFinalInputOrderIds?.length ? order : undefined
}

export function centralSpecialQuantityRows(order: SpecialCraftTaskOrder, action: CentralSpecialAction, lang: CentralPdaLanguage): CentralQuantityRow[] {
  if (action === 'finish') return []
  if (order.quantityMode === 'TICKET_INPUT_OUTPUT') {
    if (action === 'receive') return (order.buttonLoopInputLines || [])
      .map(line => ({ key: line.feiTicketNo, label: line.feiTicketNo, feiTicketNo: line.feiTicketNo, max: line.received ? 0 : 1, unit: '张', ticket: true }))
    return [{ key: 'output', label: order.taskOrderNo, max: action === 'handoff' ? Math.max(0, order.completedQty - (order.returnedQty || 0)) : null, unit: order.outputUnit || order.unit, ticket: false }]
  }
  if (order.targetObject === '辅料') {
    const receivedInput = order.inputReceivedQty || 0, plannedInput = order.inputPlannedQty || 0
    const maximum = action === 'receive' ? plannedInput - receivedInput
      : action === 'work' ? Math.min(order.planQty, plannedInput > 0 ? Math.floor(order.planQty * receivedInput / plannedInput + 1e-9) : 0) - order.completedQty
        : order.completedQty - (order.returnedQty || 0)
    return [{ key: 'material', label: order.materialSku || order.taskOrderNo, max: Math.max(0, maximum), unit: action === 'receive' ? order.inputUnit || '米' : order.outputUnit || order.unit, ticket: false }]
  }
  return readSpecialCraftTaskLineProgress(order).map(row => ({
    key: row.lineProgressKey,
    label: [row.feiTicketNo || row.skuCode, centralBusinessLabel(row.partName, lang, ''),
      centralBusinessLabel(row.colorName, lang, ''), centralBusinessLabel(row.sizeCode, lang, '')].filter(Boolean).join(' · '),
    skuCode: row.lineType === 'sku' ? row.skuCode : undefined,
    feiTicketNo: row.lineType === 'fei-ticket' ? row.feiTicketNo : undefined,
    max: Math.max(0, action === 'receive' ? row.planQty - row.receivedQty : action === 'work' ? row.receivedQty - row.completedQty : row.completedQty - row.returnedQty),
    unit: order.unit, ticket: false,
  }))
}

export function centralSpecialAvailableActions(order: SpecialCraftTaskOrder): CentralSpecialAction[] {
  const available = new Set(getAvailableSpecialCraftWebActions(order.taskOrderId).filter(action => !action.disabledReason).map(action => action.actionCode))
  return (Object.keys(centralSpecialActions) as CentralSpecialAction[]).filter(action => available.has(centralSpecialActions[action])
    && !(action === 'work' && order.quantityMode === 'TICKET_INPUT_OUTPUT'
      && (!order.buttonLoopInputLines?.length || order.buttonLoopInputLines.some(line => !line.received)))
    && (action === 'finish' || centralSpecialQuantityRows(order, action, 'zh').some(row => row.max === null || row.max > 0)))
}

export function centralSpecialIdentity(order: SpecialCraftTaskOrder, lang: CentralPdaLanguage) {
  const production = productionOrders.find(item => item.productionOrderId === order.productionOrderId)
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const code = production?.demandSnapshot?.spuCode || order.productionOrderNo
  const productName = centralBusinessLabel(production?.demandSnapshot?.spuName, lang, code)
  const bom = snapshot?.bomItems.find(item => (order.demandLines || []).some(line => line.sourceBomItemId === item.id))
    || snapshot?.bomItems.find(item => (item.materialSkuId || item.materialCode) === order.materialSku)
  const photo = order.targetObject !== '成衣' && bom?.materialImageUrl ? bom.materialImageUrl
    : snapshot?.imageSnapshot.productImages[0] || snapshot?.imageSnapshot.styleImages[0] || snapshot?.imageSnapshot.sampleImages[0]
      || reviewedStyleImage(code, order.fabricColor) || reviewedStyleImage(code)
  const flow = resolveAuxiliaryWarehouseFlow(order.targetObject)
  return {
    name: order.targetObject !== '成衣' && bom ? centralBusinessLabel(bom.name, lang, order.materialSku || code) : productName,
    photo, code, source: order.sourceFactoryName || flow.sourceObjectName,
    target: order.receiverWarehouseName || flow.receiverWarehouseName,
    sourceNo: order.sourceTaskNo || order.productionOrderNo,
    object: centralBusinessLabel(order.partName, lang, centralBusinessLabel(order.targetObject, lang, 'Barang')),
  }
}

export function validateCentralSpecialQuantity(raw: string, row: CentralQuantityRow): number {
  const normalized = raw.trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('QUANTITY_REQUIRED')
  const qty = Number(normalized)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('QUANTITY_POSITIVE')
  const integer = ['片', '件', '张', '条', '个', '卷', '筒'].includes(row.unit)
  if ((integer && !Number.isSafeInteger(qty)) || (!integer && (normalized.split('.')[1]?.length || 0) > 4)) throw new Error('QUANTITY_PRECISION')
  if (row.max !== null && qty - row.max > 1e-9) throw new Error('QUANTITY_MAX')
  return qty
}
