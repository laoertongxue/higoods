import { assertPostFinishingWrite, runPostFinishingCommand } from '../fcs/post-finishing-records.ts'
import { inventoryTransactionParticipant, readFinishedInventoryState, captureFinishedInventoryState } from './finished-inventory-records.ts'
import { FINISHED_INVENTORY_DEFECT_WAREHOUSE, FINISHED_INVENTORY_REWORK_FACTORY, FINISHED_INVENTORY_POST_FACTORY, FINISHED_INVENTORY_LOCATIONS } from './finished-inventory-quality-seed.ts'
import type { FinishedInventoryActor, FinishedInventoryApplication, FinishedInventoryApplicationLine, FinishedInventoryEligibility, FinishedInventoryLot, FinishedInventoryMovement, FinishedInventoryQcResult, FinishedInventoryTransfer, FinishedInventoryTransferCategory } from './finished-inventory-quality-types.ts'
import type { StockRealtimeItem } from './types.ts'
export { inventoryTransactionParticipant } from './finished-inventory-records.ts'

const copy = <T>(value: T): T => structuredClone(value)
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const qty = (value: number) => { if (!Number.isSafeInteger(value) || value < 0) throw new Error('数量须为非负整数件数。'); return value }
function actorName(actor: FinishedInventoryActor | string): string {
  const name = typeof actor === 'string' ? actor : actor.actorName
  if (!name?.trim()) throw new Error('填写实际办理人后保存。')
  return name.trim()
}
const at = (value?: string) => { const result = value || new Date().toISOString(); if (!Number.isFinite(Date.parse(result))) throw new Error('办理时间无效。'); return result }
const scopeId = (warehouseId: string, styleId: string) => `${warehouseId}::${styleId}`
function touchScope(warehouseId: string, styleId: string): void {
  const state = readFinishedInventoryState(), id = scopeId(warehouseId, styleId)
  let scope = state.scopes.find(row => row.id === id)
  if (!scope) { scope = { id, warehouseId, styleId, revision: 0 }; state.scopes.push(scope) }
  scope.revision += 1
}
export function listFinishedInventoryLots(): FinishedInventoryLot[] { return copy(readFinishedInventoryState().lots) }
export function listFinishedInventoryApplications(): FinishedInventoryApplication[] { return copy(readFinishedInventoryState().applications).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
export function getFinishedInventoryApplication(id: string): FinishedInventoryApplication | undefined { return copy(readFinishedInventoryState().applications.find(row => row.id === id)) }
export function listFinishedInventoryTransfers(applicationId?: string): FinishedInventoryTransfer[] { return copy(readFinishedInventoryState().transfers.filter(row => !applicationId || row.applicationId === applicationId)) }
export function listFinishedInventoryMovements(): FinishedInventoryMovement[] { return copy(readFinishedInventoryState().movements).sort((a, b) => b.at.localeCompare(a.at)) }
export function listFinishedInventoryDifferences(applicationId: string) { return copy(readFinishedInventoryState().differences.filter(row => row.applicationId === applicationId)) }

/** 同订单行的阶段投影只排除一次；不能将占用/已拣/待出库三个汇总相加。 */
export function finishedInventoryExcludedBySku(warehouseId: string): Map<string, number> {
  const unique = new Map<string, { skuId: string; quantity: number }>()
  for (const line of readFinishedInventoryState().exclusions.filter(row => row.warehouseId === warehouseId && row.active)) {
    if (!line.orderLineId || !line.sourceRef) throw new Error('订单排除来源尚未核对，不能把未知排除量当0。')
    qty(line.quantity)
    const key = `${line.skuId}::${line.orderLineId}`, previous = unique.get(key)
    if (!previous || previous.quantity < line.quantity) unique.set(key, { skuId: line.skuId, quantity: line.quantity })
  }
  const result = new Map<string, number>()
  for (const row of unique.values()) result.set(row.skuId, (result.get(row.skuId) || 0) + row.quantity)
  return result
}
export function previewFinishedInventoryQuality(warehouseId: string, styleId: string): FinishedInventoryEligibility {
  const state = readFinishedInventoryState()
  const source = state.lots.filter(row => row.warehouseId === warehouseId && row.styleId === styleId)
  if (!source.length) throw new Error('未找到本仓本款库存，请重新查询。')
  const normal = source.filter(row => row.quality === '正常' && row.putaway && row.quantity > 0).sort((a, b) => a.id.localeCompare(b.id))
  if (normal.some(row => !row.identityVerified || !row.skuId || !row.imageUrl || !row.locationCode)) throw new Error('本仓本款存在尚未核对身份、图片或库位的库存，不能猜测送检。')
  const excluded = finishedInventoryExcludedBySku(warehouseId), bySku = new Map<string, FinishedInventoryLot[]>()
  for (const row of normal) { qty(row.quantity); bySku.set(row.skuId, [...(bySku.get(row.skuId) || []), row]) }
  const lines: FinishedInventoryApplicationLine[] = []
  let excludedQty = 0
  for (const [skuId, lots] of bySku) {
    let locked = excluded.get(skuId) || 0
    const total = sum(lots.map(row => row.quantity))
    if (locked > total) throw new Error('订单排除量超过实际正常在库，请先核对来源。')
    excludedQty += locked
    const allocations = lots.flatMap(lot => {
      const protectedQty = Math.min(locked, lot.quantity); locked -= protectedQty
      const quantity = lot.quantity - protectedQty
      return quantity > 0 ? [{ lotId: lot.id, quantity, locationCode: lot.locationCode }] : []
    })
    const first = lots[0]!, outboundQty = sum(allocations.map(row => row.quantity))
    if (outboundQty) lines.push({ skuId, skuCode: first.skuCode, styleId, styleNo: first.styleNo, styleName: first.styleName,
      colorName: first.colorName, sizeName: first.sizeName, imageUrl: first.imageUrl, barcode: first.barcode, outboundQty, allocations })
  }
  const first = source[0]!, scopeRevision = state.scopes.find(row => row.id === scopeId(warehouseId, styleId))?.revision || 0
  return { warehouseId, warehouseName: first.warehouseName, styleId, styleNo: first.styleNo, styleName: first.styleName, imageUrl: first.imageUrl,
    totalNormal: sum(normal.map(row => row.quantity)), excludedQty, eligibleQty: sum(lines.map(row => row.outboundQty)), scopeRevision, lines,
    sourceFingerprint: JSON.stringify({ lots: source.map(row => [row.id, row.quantity, row.quality, row.putaway, row.locationCode]).sort(),
      exclusions: state.exclusions.filter(row => row.warehouseId === warehouseId && source.some(lot => lot.skuId === row.skuId)).map(row => [row.id, row.orderLineId, row.quantity, row.active, row.stage]).sort(), scopeRevision }) }
}

export interface FinishedInventoryQcBridgeInput {
  applicationId: string; applicationNo: string; warehouseId: string; warehouseName: string
  styleId: string; styleNo: string; styleName: string; styleImageUrl: string; receivedAt: string; receivedBy: FinishedInventoryActor
  lines: Array<{ skuId: string; skuCode: string; colorName: string; sizeName: string; imageUrl: string; receivedQty: number; barcode?: string }>
}
let bridge: { receiveIntoQc(input: FinishedInventoryQcBridgeInput): { qcTaskId: string; qcTaskNo: string } } | undefined
export function registerFinishedInventoryQcBridge(value: NonNullable<typeof bridge>): void { bridge = value }
export async function runFinishedInventoryCommand<T>(recipe: () => T, operationId?: string, intent?: string): Promise<T> {
  // 首次从WLS直达也先注册原后道仓库/日志等参与者；不能在后道仓库尚未
  // 注册时把空repository当已恢复用户资料。这里只读准备，没有第二次保存。
  if (typeof window !== 'undefined' && !bridge) {
    // Read pages stay narrow. Before the first actual warehouse action, prepare
    // the original full sources and joint participants, then use one transaction.
    await (await import('../pcs-record-runtime.ts')).ensurePcsRecordState()
    await (await import('../fcs/post-finishing-inventory-bridge.ts')).preparePostFinishingInventoryBridge()
  }
  return runPostFinishingCommand(recipe, { participants: [inventoryTransactionParticipant], operationId, intent })
}
function appById(id: string): FinishedInventoryApplication { const row = readFinishedInventoryState().applications.find(row => row.id === id); if (!row) throw new Error('库存送检申请不存在，请重新读取。'); return row }
function transferById(id: string): FinishedInventoryTransfer { const row = readFinishedInventoryState().transfers.find(row => row.id === id); if (!row) throw new Error('库存交接记录不存在，请重新读取。'); return row }
function movement(input: Omit<FinishedInventoryMovement, 'id'>): void {
  const id = `${input.transferId}::${input.action}::${input.skuId}::${input.locationCode}`
  if (readFinishedInventoryState().movements.some(row => row.id === id)) return
  readFinishedInventoryState().movements.push({ id, ...input })
}
export function createFinishedInventoryQualityApplication(input: { preview: FinishedInventoryEligibility; operationId: string; actor: FinishedInventoryActor | string; at?: string }): FinishedInventoryApplication {
  assertPostFinishingWrite()
  if (!input.operationId?.trim()) throw new Error('本次申请缺少操作身份，请重新打开预览。')
  const old = readFinishedInventoryState().applications.find(row => row.operationId === input.operationId)
  if (old) return copy(old)
  const preview = previewFinishedInventoryQuality(input.preview.warehouseId, input.preview.styleId)
  if (preview.scopeRevision !== input.preview.scopeRevision || preview.sourceFingerprint !== input.preview.sourceFingerprint) throw new Error('本仓本款库存或订单范围已经变化，请重新预览后送检。')
  if (!preview.eligibleQty) throw new Error('本仓本款没有可送检正常库存，不建立空申请。')
  const state = readFinishedInventoryState(), time = at(input.at), operator = actorName(input.actor)
  const id = `FI-APP-${input.operationId}`, applicationNo = `INVQC-${time.slice(0, 10).replaceAll('-', '')}-${input.operationId.replaceAll('-', '').slice(-10)}`
  const application: FinishedInventoryApplication = { id, applicationNo, operationId: input.operationId, warehouseId: preview.warehouseId, warehouseName: preview.warehouseName,
    styleId: preview.styleId, styleNo: preview.styleNo, styleName: preview.styleName, imageUrl: preview.imageUrl, lines: copy(preview.lines), createdAt: time, createdBy: operator, outboundId: `${id}-OUT` }
  for (const line of preview.lines) for (const allocation of line.allocations) {
    const lot = state.lots.find(row => row.id === allocation.lotId)!
    const beforeQty = lot.quantity; lot.quantity -= allocation.quantity; lot.updatedAt = time
    movement({ applicationId: id, transferId: application.outboundId, warehouseId: lot.warehouseId, warehouseName: lot.warehouseName, skuId: line.skuId, skuCode: line.skuCode,
      styleId: line.styleId, styleNo: line.styleNo, styleName: line.styleName, imageUrl: line.imageUrl, locationCode: lot.locationCode, action: '送检出库', quantity: -allocation.quantity,
      beforeQty, afterQty: lot.quantity, at: time, operator, remark: `库存送检 ${applicationNo}，直接下架出库` })
  }
  state.applications.push(application)
  state.transfers.push({ id: application.outboundId, applicationId: id, applicationNo, category: '送后道', sourceWarehouseId: preview.warehouseId, sourceWarehouseName: preview.warehouseName,
    targetId: FINISHED_INVENTORY_POST_FACTORY.id, targetName: FINISHED_INVENTORY_POST_FACTORY.name,
    lines: preview.lines.map(line => ({ ...line, quantity: line.outboundQty })), createdAt: time, createdBy: operator, shippedAt: time, shippedBy: operator })
  touchScope(preview.warehouseId, preview.styleId)
  return copy(application)
}
function recordDifferences(transfer: FinishedInventoryTransfer, received: Array<{ skuId: string; quantity: number }>, time: string): void {
  for (const line of transfer.lines) {
    const actual = received.find(row => row.skuId === line.skuId)!.quantity
    if (actual === line.quantity) continue
    readFinishedInventoryState().differences.push({ id: `${transfer.id}::${line.skuId}`, applicationId: transfer.applicationId, transferId: transfer.id, skuId: line.skuId,
      expectedQty: line.quantity, actualQty: actual, quantity: actual - line.quantity, recordedAt: time })
  }
}
function verifyWholeReceipt(transfer: FinishedInventoryTransfer, received: Array<{ skuId: string; quantity: number }>): void {
  if (received.length !== transfer.lines.length || new Set(received.map(row => row.skuId)).size !== received.length
    || received.some(row => !transfer.lines.some(line => line.skuId === row.skuId))) throw new Error('整批接收须逐SKU登记，不能漏项、重项或收错SKU。')
  received.forEach(row => qty(row.quantity))
}
export function receiveFinishedInventoryQualityApplication(input: { applicationId: string; quantities: Array<{ skuId: string; quantity: number }>; actor: FinishedInventoryActor; at?: string }): FinishedInventoryApplication {
  assertPostFinishingWrite()
  const application = appById(input.applicationId), transfer = transferById(application.outboundId)
  if (application.receivedAt) throw new Error('本申请已整批实收，不支持分批或修改原实收。')
  verifyWholeReceipt(transfer, input.quantities)
  const time = at(input.at), operator = actorName(input.actor), total = sum(input.quantities.map(row => row.quantity))
  if (total && !bridge) throw new Error('库存与后道质检尚未联通，本次实收未保存，请重新进入。')
  for (const line of application.lines) line.receivedQty = input.quantities.find(row => row.skuId === line.skuId)!.quantity
  for (const line of transfer.lines) line.receivedQty = input.quantities.find(row => row.skuId === line.skuId)!.quantity
  transfer.receivedAt = application.receivedAt = time; transfer.receivedBy = application.receivedBy = operator
  recordDifferences(transfer, input.quantities, time)
  if (total) {
    const qc = bridge!.receiveIntoQc({ applicationId: application.id, applicationNo: application.applicationNo, warehouseId: application.warehouseId, warehouseName: application.warehouseName,
      styleId: application.styleId, styleNo: application.styleNo, styleName: application.styleName, styleImageUrl: application.imageUrl, receivedAt: time, receivedBy: input.actor,
      lines: application.lines.filter(line => line.receivedQty! > 0).map(line => ({ ...line, receivedQty: line.receivedQty! })) })
    if (!qc?.qcTaskId || !qc.qcTaskNo) throw new Error('后道质检身份缺失，本次实收未保存。')
    application.qcTaskId = qc.qcTaskId; application.qcTaskNo = qc.qcTaskNo
  }
  return copy(application)
}

/** 根QC完成命令内调用：结果和三去向准备关系与QC同一次PCS事务保存。 */
export function completeFinishedInventoryQc(input: {
  applicationId: string; qcTaskId: string; qcTaskNo?: string; completedAt?: string; operatorName?: string
  postTaskId?: string; postTaskNo?: string; processItems?: string[]
  lines?: Array<{ skuId: string; passedQty: number; defectQty: number; returnedQty: number; uninspectedQty: number; releasedQty: number }>
  results?: Array<{ skuId: string; inspectedQty: number; passedQty: number; defectQty: number; reworkQty: number }>
}): FinishedInventoryApplication {
  assertPostFinishingWrite()
  const application = appById(input.applicationId)
  if (application.qcCompletedAt) throw new Error('本申请QC已经完成，不能更正或重复生成去向。')
  if (!application.qcTaskId || application.qcTaskId !== input.qcTaskId || !application.receivedAt) throw new Error('QC与库存申请身份不一致。')
  const submitted = input.results || input.lines?.map(line => ({ ...line, reworkQty: line.returnedQty, inspectedQty: line.passedQty + line.defectQty + line.returnedQty })) || []
  const received = application.lines.filter(line => (line.receivedQty || 0) > 0)
  if (submitted.length !== received.length || new Set(submitted.map(row => row.skuId)).size !== submitted.length) throw new Error('QC结果SKU不完整或重复。')
  const results: FinishedInventoryQcResult[] = submitted.map(row => {
    const line = received.find(line => line.skuId === row.skuId)
    if (!line) throw new Error('QC包含本申请未实收的SKU。')
    const inspectedQty = qty(row.inspectedQty), passedQty = qty(row.passedQty), defectQty = qty(row.defectQty), reworkQty = qty(row.reworkQty)
    if (passedQty + defectQty + reworkQty !== inspectedQty || inspectedQty > line.receivedQty!) throw new Error('SKU实检三类与本SKU实收不一致。')
    const uninspectedQty = line.receivedQty! - inspectedQty, releasedQty = passedQty + uninspectedQty
    const supplied = input.lines?.find(item => item.skuId === row.skuId)
    if (supplied && (supplied.uninspectedQty !== uninspectedQty || supplied.releasedQty !== releasedQty)) throw new Error('QC未检放行口径不一致。')
    return { skuId: row.skuId, inspectedQty, passedQty, defectQty, reworkQty, uninspectedQty, releasedQty }
  })
  const time = at(input.completedAt), operator = input.operatorName || '后道质检'
  application.qcCompletedAt = time; application.qcResults = results
  application.postTaskId = input.postTaskId; application.postTaskNo = input.postTaskNo; application.processItems = input.processItems ? [...input.processItems] : []
  const categories: Array<{ category: FinishedInventoryTransferCategory; targetId: string; targetName: string; quantity: (result: FinishedInventoryQcResult) => number }> = [
    { category: '正常返仓', targetId: application.warehouseId, targetName: application.warehouseName, quantity: row => row.releasedQty },
    { category: '瑕疵入仓', targetId: FINISHED_INVENTORY_DEFECT_WAREHOUSE.id, targetName: FINISHED_INVENTORY_DEFECT_WAREHOUSE.name, quantity: row => row.defectQty },
    { category: '返工交接', targetId: FINISHED_INVENTORY_REWORK_FACTORY.id, targetName: FINISHED_INVENTORY_REWORK_FACTORY.name, quantity: row => row.reworkQty },
  ]
  for (const category of categories) {
    const lines = results.flatMap(result => { const quantity = category.quantity(result); return quantity ? [{ ...received.find(line => line.skuId === result.skuId)!, quantity }] : [] })
    if (!lines.length) continue
    readFinishedInventoryState().transfers.push({ id: `${application.id}-${category.category}`, applicationId: application.id, applicationNo: application.applicationNo,
      category: category.category, sourceWarehouseId: FINISHED_INVENTORY_POST_FACTORY.id, sourceWarehouseName: FINISHED_INVENTORY_POST_FACTORY.name,
      targetId: category.targetId, targetName: category.targetName, lines, createdAt: time, createdBy: operator })
  }
  return copy(application)
}
function updateCompletion(application: FinishedInventoryApplication, time: string): void {
  if (!application.qcCompletedAt) return
  const transfers = readFinishedInventoryState().transfers.filter(row => row.applicationId === application.id && row.category !== '送后道')
  const complete = transfers.every(row => !!row.receivedAt && (row.category === '返工交接' || !!row.putawayAt))
  const unresolved = readFinishedInventoryState().differences.some(row => row.applicationId === application.id && !row.resolvedAt)
  if (complete && !unresolved) application.completedAt ||= time
}
export function shipFinishedInventoryTransfer(input: { transferId: string; actor: FinishedInventoryActor | string; at?: string }): FinishedInventoryTransfer {
  assertPostFinishingWrite()
  const transfer = transferById(input.transferId), application = appById(transfer.applicationId)
  if (transfer.category === '正常返仓' && application.postTaskId && !application.postCompletedAt) throw new Error('本批已选择后道加工，须全部加工项完成后才能整批交出正常货。')
  if (!application.qcCompletedAt || transfer.category === '送后道') throw new Error('本批QC未完成，不能交出库存货。')
  if (transfer.shippedAt) throw new Error('本类货已经整批交出，不能分批或重复出货。')
  transfer.shippedAt = at(input.at); transfer.shippedBy = actorName(input.actor)
  return copy(transfer)
}
export function receiveFinishedInventoryTransfer(input: { transferId: string; targetId: string; quantities: Array<{ skuId: string; quantity: number }>; actor: FinishedInventoryActor | string; at?: string }): FinishedInventoryTransfer {
  assertPostFinishingWrite()
  const transfer = transferById(input.transferId), application = appById(transfer.applicationId)
  if (transfer.category === '送后道') throw new Error('送后道实收从库存申请办理。')
  if (!application.qcCompletedAt || !transfer.shippedAt || transfer.receivedAt) throw new Error('须先整批实际交出，且不能重复接收。')
  if (input.targetId !== transfer.targetId) throw new Error('接收仓库或返工工厂不一致，未入库。')
  verifyWholeReceipt(transfer, input.quantities)
  const time = at(input.at), operator = actorName(input.actor)
  for (const line of transfer.lines) {
    line.receivedQty = input.quantities.find(row => row.skuId === line.skuId)!.quantity
    if (transfer.category === '返工交接' || !line.receivedQty) continue
    const quality = transfer.category === '瑕疵入仓' ? '瑕疵' : '正常'
    const lot: FinishedInventoryLot = { ...line, id: `${transfer.id}::${line.skuId}`, warehouseId: transfer.targetId, warehouseName: transfer.targetName,
      zoneName: '待上架', locationCode: '待上架', quality, putaway: false, quantity: line.receivedQty, updatedAt: time, sourceRef: transfer.id, identityVerified: true }
    const beforeQty = sum(readFinishedInventoryState().lots.filter(row => row.warehouseId === lot.warehouseId && row.skuId === lot.skuId).map(row => row.quantity))
    readFinishedInventoryState().lots.push(lot)
    movement({ applicationId: application.id, transferId: transfer.id, warehouseId: lot.warehouseId, warehouseName: lot.warehouseName, skuId: lot.skuId, skuCode: lot.skuCode,
      styleId: lot.styleId, styleNo: lot.styleNo, styleName: lot.styleName, imageUrl: lot.imageUrl, locationCode: '待上架', action: '返仓实收', quantity: lot.quantity,
      beforeQty, afterQty: beforeQty + lot.quantity, at: time, operator, remark: `${transfer.category}实际接收，尚未上架不增加可售` })
    touchScope(lot.warehouseId, lot.styleId)
  }
  transfer.receivedAt = time; transfer.receivedBy = operator
  if (transfer.category !== '返工交接' && transfer.lines.every(row => row.receivedQty === 0)) transfer.putawayAt = time
  recordDifferences(transfer, input.quantities, time); updateCompletion(application, time)
  return copy(transfer)
}
export function putawayFinishedInventoryTransfer(input: { transferId: string; locations: Array<{ skuId: string; locationCode: string }>; actor: FinishedInventoryActor | string; at?: string }): FinishedInventoryTransfer {
  assertPostFinishingWrite()
  const transfer = transferById(input.transferId), application = appById(transfer.applicationId)
  if (transfer.category === '返工交接' || !transfer.receivedAt || transfer.putawayAt) throw new Error('该交接不可上架，或已完成上架。')
  const actual = transfer.lines.filter(row => (row.receivedQty || 0) > 0)
  if (input.locations.length !== actual.length || new Set(input.locations.map(row => row.skuId)).size !== actual.length) throw new Error('须为本次全部实收SKU选择适用库位。')
  const time = at(input.at), operator = actorName(input.actor)
  for (const line of actual) {
    const selected = input.locations.find(row => row.skuId === line.skuId)
    const location = FINISHED_INVENTORY_LOCATIONS.find(row => row.warehouseId === transfer.targetId && row.locationCode === selected?.locationCode)
    if (!location) throw new Error('库位不属于本次接收仓库，未上架。')
    const lot = readFinishedInventoryState().lots.find(row => row.id === `${transfer.id}::${line.skuId}`)
    if (!lot || lot.quantity !== line.receivedQty || lot.putaway) throw new Error('实际接收库存有变化，请重新读取。')
    lot.putaway = true; lot.locationCode = location.locationCode; lot.zoneName = location.zoneName; lot.updatedAt = time
    line.locationCode = location.locationCode; line.putawayAt = time
    movement({ applicationId: application.id, transferId: transfer.id, warehouseId: lot.warehouseId, warehouseName: lot.warehouseName, skuId: lot.skuId, skuCode: lot.skuCode,
      styleId: lot.styleId, styleNo: lot.styleNo, styleName: lot.styleName, imageUrl: lot.imageUrl, locationCode: lot.locationCode, action: '返仓上架', quantity: lot.quantity,
      beforeQty: 0, afterQty: lot.quantity, at: time, operator, remark: transfer.category === '正常返仓' ? '正常品上架恢复可售' : '独立瑕疵仓上架，不增加正常可售' })
    touchScope(lot.warehouseId, lot.styleId)
  }
  transfer.putawayAt = time; updateCompletion(application, time)
  return copy(transfer)
}
export function resolveFinishedInventoryDifference(input: { differenceId: string; reason: string; disposition: string; actor: FinishedInventoryActor | string; at?: string }): void {
  assertPostFinishingWrite()
  const difference = readFinishedInventoryState().differences.find(row => row.id === input.differenceId)
  if (!difference || difference.resolvedAt) throw new Error('该差异不存在或已确认，不可重复修改。')
  if (!input.reason.trim() || !input.disposition.trim()) throw new Error('填写差异真实原因和实际去向/处理。')
  difference.reason = input.reason.trim(); difference.disposition = input.disposition.trim(); difference.resolvedBy = actorName(input.actor); difference.resolvedAt = at(input.at)
  updateCompletion(appById(difference.applicationId), difference.resolvedAt)
}
export function finishedInventoryApplicationStatus(application: FinishedInventoryApplication): string {
  if (application.completedAt) return '已完成'
  if (!application.receivedAt) return '待后道实收'
  if (!application.qcTaskId) return '实收为0待核实差异'
  if (!application.qcCompletedAt) return '待完成QC'
  if (application.postTaskId && !application.postCompletedAt) return '待后道加工'
  return '待分类交接及上架'
}
export function finishedInventoryTransferStatus(transfer: FinishedInventoryTransfer): string {
  const application = getFinishedInventoryApplication(transfer.applicationId)
  if (transfer.category === '正常返仓' && !transfer.shippedAt && application?.postTaskId && !application.postCompletedAt) return '待后道加工'
  if (!transfer.shippedAt) return '待整批交出'
  if (!transfer.receivedAt) return '待整批接收'
  if (transfer.category === '返工交接' || transfer.category === '送后道' || transfer.putawayAt) return '已完成'
  return '待上架'
}
/** 管理查询统一按真实仓/SKU聚合；待上架、瑕疵均不算正常可售。 */
export function finishedInventoryAvailability(skuCode: string, warehouseId?: string) {
  const state = readFinishedInventoryState()
  const lots = state.lots.filter(row => row.skuCode === skuCode && (!warehouseId || row.warehouseId === warehouseId))
  if (!lots.length) return null
  const normal = lots.filter(row => row.quality === '正常' && row.putaway)
  const warehouses = [...new Set(normal.map(row => row.warehouseId))]
  const excluded = sum(warehouses.map(id => {
    const ids = new Set(normal.filter(row => row.warehouseId === id).map(row => row.skuId))
    return sum([...finishedInventoryExcludedBySku(id)].filter(([sku]) => ids.has(sku)).map(([, quantity]) => quantity))
  }))
  const relevantExclusions = state.exclusions.filter(row => row.active && normal.some(lot => lot.warehouseId === row.warehouseId && lot.skuId === row.skuId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(row => ({ id: row.id, orderLineId: row.orderLineId, warehouseId: row.warehouseId, skuId: row.skuId, lotId: row.lotId,
      quantity: row.quantity, stage: row.stage, active: row.active, sourceRef: row.sourceRef }))
  const relevantScopes = state.scopes.filter(row => normal.some(lot => lot.warehouseId === row.warehouseId && lot.styleId === row.styleId))
    .sort((a, b) => a.id.localeCompare(b.id)).map(row => ({ id: row.id, warehouseId: row.warehouseId, styleId: row.styleId, revision: row.revision }))
  return { quantity: sum(lots.map(row => row.quantity)), normalQuantity: sum(normal.map(row => row.quantity)), excluded,
    available: Math.max(0, sum(normal.map(row => row.quantity)) - excluded), sourceRef: lots.map(row => row.id).sort().join(','),
    sourceVersion: JSON.stringify({ lots: [...lots].sort((a, b) => a.id.localeCompare(b.id)).map(row => [row.id, row.quantity, row.putaway, row.quality, row.updatedAt]),
      exclusions: relevantExclusions, scopes: relevantScopes }) }
}
// 供隔离契约使用已有capture/restore；正常页面没有重置、清库或写seed操作。
export function finishedInventoryReadOnlySnapshot() { return captureFinishedInventoryState() }

export interface FinishedInventoryRealtimeRow extends StockRealtimeItem {
  warehouseId: string; styleId: string; pendingPutawayQuantity: number; normalAvailableQuantity: number; physicalQuantity: number
}
export function finishedInventoryRealtimeRows(): FinishedInventoryRealtimeRow[] {
  const groups = new Map<string, FinishedInventoryLot[]>()
  for (const lot of readFinishedInventoryState().lots) { const key = `${lot.warehouseId}::${lot.skuId}`; groups.set(key, [...(groups.get(key) || []), lot]) }
  return [...groups.values()].map(lots => {
    const first = lots[0]!, available = finishedInventoryAvailability(first.skuCode, first.warehouseId)!
    const pendingPutawayQuantity = sum(lots.filter(row => !row.putaway).map(row => row.quantity))
    return { id: `FI-RT-${first.warehouseId}-${first.skuId}`, warehouseId: first.warehouseId, styleId: first.styleId,
      image: first.imageUrl, productName: `${first.styleName} ${first.colorName}/${first.sizeName}`, spu: first.styleNo, sku: first.skuCode, unit: '件', warehouseName: first.warehouseName,
      warehouse_type: 'FINISHED', spotStock: available.normalQuantity, transitStock: 0, pendingShipmentQuantity: 0,
      preSaleOrderOccupiedQuantity: 0, spotOrderOccupiedQuantity: available.excluded, pendingReturnQualityQuantity: 0,
      defectiveStock: sum(lots.filter(row => row.quality === '瑕疵').map(row => row.quantity)), damagedStock: sum(lots.filter(row => row.quality === '破损').map(row => row.quantity)),
      pendingPutawayQuantity, normalAvailableQuantity: available.available, physicalQuantity: available.quantity,
    }
  })
}
export function finishedInventoryLocationRows() {
  return listFinishedInventoryLots().map(row => ({ id: row.id, warehouseName: row.warehouseName, warehouseZone: row.zoneName, warehouseLocation: row.locationCode,
    spu: row.styleNo, sku: row.skuCode, quantity: row.quantity, updatedAt: row.updatedAt, imageUrl: row.imageUrl, productName: `${row.styleName} ${row.colorName}/${row.sizeName}`, quality: row.quality, putaway: row.putaway }))
}
export function finishedInventoryOnlineRows() {
  const remaining = new Map<string, number>()
  for (const row of readFinishedInventoryState().lots) if (row.quality === '正常' && row.putaway) {
    const key = `${row.warehouseId}::${row.skuId}`
    if (!remaining.has(key)) remaining.set(key, finishedInventoryExcludedBySku(row.warehouseId).get(row.skuId) || 0)
  }
  return listFinishedInventoryLots().sort((a, b) => a.id.localeCompare(b.id)).map(row => {
    const key = `${row.warehouseId}::${row.skuId}`
    const locked = row.quality === '正常' && row.putaway ? Math.min(row.quantity, remaining.get(key) || 0) : 0
    if (locked) remaining.set(key, remaining.get(key)! - locked)
    return { id: row.id, spu: row.styleNo, sku: row.skuCode, zone: row.zoneName, stockType: !row.putaway ? '待上架' : row.quality === '瑕疵' ? '次品' : row.quality === '破损' ? '破损' : '正常',
      locationCode: row.locationCode, onHand: row.quantity, locked, available: row.quality === '正常' && row.putaway ? row.quantity - locked : 0,
      warehouseName: row.warehouseName, countedAt: row.updatedAt, updatedAt: row.updatedAt, imageUrl: row.imageUrl, productName: `${row.styleName} ${row.colorName}/${row.sizeName}` }
  })
}
export function finishedInventoryFlowRows() {
  const applications = new Map(readFinishedInventoryState().applications.map(row => [row.id, row.applicationNo]))
  return listFinishedInventoryMovements().map(row => ({ id: row.id, operateTime: row.at, warehouseName: row.warehouseName, spu: row.styleNo, sku: row.skuCode,
    productName: row.styleName, businessNo: applications.get(row.applicationId) || row.applicationId,
    docType: row.action === '送检出库' ? '库存送检出库' : row.action === '返仓上架' ? '库存送检返仓上架' : '库存送检返仓接收', actionType: row.action,
    inboundChange: row.action === '返仓实收' ? row.quantity : 0, inboundBefore: row.action === '返仓实收' ? row.beforeQty : 0,
    putawayChange: row.action === '返仓上架' ? row.quantity : 0, putawayBefore: row.action === '返仓上架' ? row.beforeQty : 0,
    transferChange: 0, transferBefore: 0, pickChange: 0, pickBefore: 0,
    outboundChange: row.action === '送检出库' ? row.quantity : 0, outboundBefore: row.action === '送检出库' ? row.beforeQty : 0,
    locationCode: row.locationCode, operatorName: row.operator, operationTime: row.at, remark: row.remark }))
}

/** 已切换仓/SKU的旧写入口必须拒绝旧源；不凭相似仓名扩大作用域。 */
export function ownsFinishedInventoryStock(warehouseName: string, skuCode: string): boolean { return readFinishedInventoryState().lots.some(row => row.warehouseName === warehouseName && row.skuCode === skuCode) }

/** 成衣质检出库单直接读取同事务保存的送检事实，不跨库复制或再次扣减。 */
export function listFinishedInventoryOutboundOrders(): import('./finished-outbound-orders.ts').FinishedOutboundOrder[] {
  return listFinishedInventoryApplications().map(app => ({
    id: app.outboundId, outboundOrderNo: `${app.applicationNo}-OUT`, relatedOrderNo: app.applicationNo,
    inventoryApplicationId: app.id, recipientName: FINISHED_INVENTORY_POST_FACTORY.name, operatorName: app.createdBy,
    trackingNo: '', warehouse: app.warehouseName, platform: '', orderType: '成衣质检', status: '已出库',
    createdAt: app.createdAt, updatedAt: app.createdAt, shippedAt: app.createdAt, deadline: '', pickedAt: '',
    cancelledAt: '', labelDownloadedAt: '', printedAt: '', pickOrderNo: '', isKol: false, printCount: 0, version: 1,
    remark: `成衣库存送后道质检 · ${app.styleName}`,
    products: app.lines.map(line => ({ spu: app.styleNo, sku: line.skuCode, imageUrl: line.imageUrl,
      quantity: line.outboundQty, pendingQuantity: 0, locations: line.allocations.map(row => ({ name: row.locationCode, quantity: row.quantity })), inventoryUpdatedAt: app.createdAt })),
    logs: [{ at: app.createdAt, action: '成衣质检下架出库', operator: app.createdBy, remark: `送往${FINISHED_INVENTORY_POST_FACTORY.name}，关联${app.applicationNo}` }],
  }))
}

/** Called by the original processing command; committed with its process records. */
export function updateFinishedInventoryPostProgress(input: { applicationId: string; postTaskId: string; completedAt?: string }): void {
  assertPostFinishingWrite()
  const application = appById(input.applicationId)
  if (application.postTaskId !== input.postTaskId) throw new Error('库存申请与后道加工单不一致，本次未保存。')
  application.postCompletedAt = input.completedAt
}
export function finishedInventoryPostShippedQuantities(applicationId: string): Array<{ skuId: string; quantity: number }> {
  return listFinishedInventoryTransfers(applicationId).filter(row=>row.category==='正常返仓' && Boolean(row.shippedAt)).flatMap(row=>row.lines.map(line=>({skuId:line.skuId,quantity:line.quantity})))
}
