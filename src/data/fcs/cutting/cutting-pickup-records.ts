import { isBrowserBusinessStorageStaged, type BrowserStorageLike } from '../../browser-storage.ts'
import { ProductionContextReadError } from '../production-context-records.ts'
import type { ProductionMaterialPrepWorkflowStore } from './production-material-prep.ts'
import type { CuttingRecordSnapshot, CuttingStoredRecord } from './cutting-record-repository.ts'

/** Receipt facts only. Unadopted preparation, returns, staging and closures retain their source. */
const groups = { pickupRecords: 'pickupRecordId', pickupSessions: 'pickupSessionId', pickupNodeSnapshots: 'nodeId' } as const
type Group = keyof typeof groups
const prefix = 'cutting-pickup:'
let committed: CuttingStoredRecord[] | undefined
let viewSignature = '', viewEpoch = 0
export function getCuttingPickupRecordEpoch(): number { return viewEpoch }
const clone = <T>(value: T): T => structuredClone(value)
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())
const quantity = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
export function isNativeCuttingPickupStorage(storage: BrowserStorageLike | null): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined' || isBrowserBusinessStorageStaged()) return false
  try { return !storage || storage === window.localStorage } catch { return true }
}
export function assertReadablePreparationSource(raw: string | null): void {
  if (raw === null) return
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new ProductionContextReadError('原配料资料格式不完整，原资料已保留，请先核对。') }
  const fields = { prepRecords: 'prepRecordId', ...groups, pickupReturnRecords: 'returnRecordId', rejectRecords: 'rejectId', stagingRecords: 'stagingRecordId', closedOrders: 'prepOrderId' }
  if (!object(value) || Object.entries(fields).some(([field, id]) => value[field] !== undefined && (!Array.isArray(value[field])
    || value[field].some((row: unknown) => !object(row) || !text(row[id]))
    || new Set(value[field].map((row: Record<string, any>) => row[id])).size !== value[field].length))) {
    throw new ProductionContextReadError('原配料资料身份或明细不完整，原资料已保留，请先核对。')
  }
}
function record(group: Group, value: Record<string, any>): CuttingStoredRecord {
  return { id: `${prefix}${group}:${value[groups[group]]}`, collection: `${prefix}${group}`, value: clone(value) }
}
export function pickupStoreRows(store: ProductionMaterialPrepWorkflowStore): CuttingStoredRecord[] {
  const rows = (Object.keys(groups) as Group[]).flatMap(group => store[group].map(value => {
    const item: unknown = value
    if (!object(item) || !text(item[groups[group]])) throw new Error('原接收记录身份不完整，原资料已保留。')
    return record(group, item)
  }))
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('原接收记录编号重复，原资料已保留。')
  return rows
}
export function validateCuttingPickupRecords(rows: CuttingStoredRecord[]): void {
  for (const row of rows.filter(row => row.collection.startsWith(prefix))) {
    const group = row.collection.slice(prefix.length) as Group, value = row.value
    if (!(group in groups) || !object(value) || !text(value[groups[group]]) || row.id !== record(group, value).id || !text(value.prepOrderId)) throw new Error('接收记录身份不完整，原资料已保留。')
    if (group === 'pickupRecords' && (!text(value.prepLineId) || !text(value.receiverName) || !text(value.pickedAt) || !quantity(value.pickedQty) || !quantity(value.rollCount))) throw new Error('接收明细数量或责任信息不完整。')
    if (value.receiverUserId !== undefined && !text(value.receiverUserId)) throw new Error('接收账号信息不完整。')
    if (group === 'pickupSessions' && (!text(value.pickupNodeId) || !Number.isSafeInteger(value.pickupNodeVersion) || value.pickupNodeVersion < 1 || !text(value.receiverName)
      || !text(value.pickedAt) || !Array.isArray(value.pickupRecordIds) || !value.pickupRecordIds.length || value.pickupRecordIds.some((id: unknown) => !text(id))
      || new Set(value.pickupRecordIds).size !== value.pickupRecordIds.length || !object(value.pickupNodeSnapshot))) throw new Error('接收会话缺少原节点、明细或责任信息。')
    if (group === 'pickupNodeSnapshots' && (!Number.isSafeInteger(value.version) || value.version < 1 || !text(value.fingerprint) || !Number.isSafeInteger(value.sequence) || value.sequence < 1)) throw new Error('接收节点版本不完整。')
  }
}
export function hydrateCuttingPickupRecords(snapshot: CuttingRecordSnapshot): void {
  validateCuttingPickupRecords(snapshot.records)
  validateCuttingPickupRecordLinks(snapshot.records)
  const rows = snapshot.records.filter(row => row.collection.startsWith(prefix)).sort((a, b) => a.id.localeCompare(b.id))
  const signature = JSON.stringify(rows)
  if (signature === viewSignature) return
  committed = clone(rows)
  viewSignature = signature
  viewEpoch++
}
export function validateCuttingPickupRecordLinks(rows: CuttingStoredRecord[]): void {
  const sessions = rows.filter(row => row.collection === `${prefix}pickupSessions`).map(row => row.value as any)
  const pickups = new Map(rows.filter(row => row.collection === `${prefix}pickupRecords`).map(row => [(row.value as any).pickupRecordId, row.value as any]))
  const nodes = new Map(rows.filter(row => row.collection === `${prefix}pickupNodeSnapshots`).map(row => [(row.value as any).nodeId, row.value as any]))
  const fail = (): never => { throw new Error('接收会话与明细、原节点或入仓记录不一致，原资料已保留。') }
  for (const session of sessions) {
    const node = session.pickupNodeSnapshot, version = nodes.get(session.pickupNodeId)
    if (!object(node) || !Array.isArray(node.items) || !node.items.length || node.nodeId !== session.pickupNodeId || node.version !== session.pickupNodeVersion
      || node.prepOrderId !== session.prepOrderId || !version || version.version !== session.pickupNodeVersion || version.prepOrderId !== session.prepOrderId
      || node.items.length !== session.pickupRecordIds.length || session.warehouseSyncStatus !== '已回写') fail()
    node.items.forEach((item: any, index: number) => {
      const pickup = pickups.get(session.pickupRecordIds[index])
      const events = rows.filter(row => row.collection === 'cutting-events' && object(row.value) && object(row.value.refs)
        && row.value.eventType === '中转仓接收' && row.value.refs.handoverRecordId === `${session.pickupSessionId}:${item.prepLineId}`).map(row => row.value as any)
      if (!pickup || pickup.pickupSessionId !== session.pickupSessionId || pickup.pickupNodeId !== session.pickupNodeId || pickup.prepOrderId !== session.prepOrderId
        || pickup.prepLineId !== item.prepLineId || pickup.pickedQty !== item.currentAvailableQty || pickup.rollCount !== item.rollCount || pickup.receiverName !== session.receiverName || pickup.pickedAt !== session.pickedAt
        || events.length !== 1 || events[0].inventoryEffect?.qty !== pickup.pickedQty || events[0].inventoryEffect?.unit !== item.unit
        || events[0].inventoryEffect?.inventoryScope !== '裁床待加工仓' || events[0].inventoryEffect?.direction !== 'IN'
        || events[0].inventoryEffect?.rollCount !== item.rollCount || events[0].occurredAt !== session.pickedAt
        || events[0].operatorName !== session.receiverName || events[0].payload?.pickupRecordId !== pickup.pickupRecordId
        || events[0].material?.materialSku !== item.materialSku) fail()
      if (pickup.receiverUserId !== session.receiverUserId || session.receiverUserId !== undefined
        && (events[0].operatorId !== session.receiverUserId || events[0].payload.pickupById !== session.receiverUserId)) fail()
      if (session.cuttingSources !== undefined) {
        if (!text(session.receiverUserId) || !Array.isArray(session.cuttingSources) || session.cuttingSources.length !== node.items.length
          || new Set(session.cuttingSources.map((source: any) => source?.prepLineId)).size !== node.items.length) fail()
        const source = session.cuttingSources.find((source: any) => source?.prepLineId === item.prepLineId)
        if (!object(source) || source.productionOrderId !== session.productionOrderId || source.materialSku !== item.materialSku || source.sourceUnit !== item.unit
          || !['cutOrderId', 'cutOrderNo', 'cuttingTaskId', 'cuttingTaskNo', 'factoryId', 'techPackVersionId', 'materialName', 'materialImageUrl', 'taskUnit'].every(key => text(source[key]))
          || !Array.isArray(source.executionTaskIds) || !source.executionTaskIds.length || source.executionTaskIds.some((id: unknown) => !text(id))
          || new Set(source.executionTaskIds).size !== source.executionTaskIds.length || source.factoryId !== events[0].payload.warehouseLocations?.[0]?.factoryId
          || source.cutOrderId !== events[0].refs.cutOrderId || source.cutOrderNo !== events[0].refs.cutOrderNo
          || JSON.stringify(source) !== JSON.stringify(events[0].payload.cuttingSource)) fail()
      }
    })
    const inbound = rows.find(row => row.collection === 'cutting-events' && object(row.value) && row.value.eventType === '中转仓接收'
      && row.value.payload?.pickupSessionId === session.pickupSessionId)?.value as any
    if (!object(session.storageFootprint) || !inbound?.payload?.storageFootprint) fail()
    if (!session.lastStorageAdjustmentId) {
      if (JSON.stringify(session.storageFootprint) !== JSON.stringify(inbound.payload.storageFootprint)) fail()
    } else {
      const footprint = session.storageFootprint, original = inbound.payload.storageFootprint
      const adjustments = rows.filter(row => row.collection === 'cutting-events' && object(row.value) && row.value.eventType === '待加工仓位置调整'
        && row.value.payload?.pickupSessionId === session.pickupSessionId && row.value.payload?.adjustmentId === session.lastStorageAdjustmentId).map(row => row.value as any)
      const summaries = footprint.unitSummaries
      if (!Array.isArray(summaries) || !Array.isArray(original.unitSummaries) || summaries.length !== original.unitSummaries.length
        || new Set(summaries.map((row: any) => row.unit)).size !== summaries.length || adjustments.length !== summaries.length
        || JSON.stringify(footprint.locationIds) !== JSON.stringify((session.toLocationRefs || []).map((ref: any) => ref.locationId))
        || footprint.footprintId !== original.footprintId || footprint.sourceId !== session.pickupSessionId || footprint.sourceType !== 'PICKUP_SESSION'
        || footprint.inboundAt !== original.inboundAt || footprint.inboundBy !== original.inboundBy) fail()
      for (const summary of summaries) {
        const source = original.unitSummaries.find((row: any) => row.unit === summary.unit)
        const matches = adjustments.filter(event => event.inventoryEffect?.unit === summary.unit)
        if (!source || summary.totalQty !== source.totalQty || summary.rollCount !== source.rollCount || !quantity(summary.remainingQty) || summary.remainingQty > summary.totalQty || matches.length !== 1) fail()
        const event = matches[0], payload = event.payload
        if (event.refs?.handoverRecordId !== session.pickupSessionId || event.inventoryEffect?.inventoryScope !== '裁床待加工仓'
          || event.inventoryEffect?.direction !== 'ADJUST' || event.inventoryEffect?.qty !== summary.remainingQty
          || !text(event.operatorId) || !text(event.operatorName) || payload.adjustedBy !== event.operatorName || payload.adjustedById !== event.operatorId || payload.adjustedAt !== event.occurredAt
          || JSON.stringify(payload.storageFootprint) !== JSON.stringify(footprint) || JSON.stringify(payload.warehouseLocations) !== JSON.stringify(session.toLocationRefs)
          || JSON.stringify(payload.remainingByUnit) !== JSON.stringify(summaries.map((row: any) => ({ unit: row.unit, remainingQty: row.remainingQty })))
          || payload.factoryId !== inbound.payload.warehouseLocations?.[0]?.factoryId || payload.warehouseId !== inbound.payload.warehouseLocations?.[0]?.warehouseId
          || payload.warehouseKind !== 'WAIT_PROCESS' || event.operatorId !== adjustments[0].operatorId || event.occurredAt !== adjustments[0].occurredAt) fail()
      }
      for (const id of session.pickupRecordIds) {
        const pickup = pickups.get(id)
        if (JSON.stringify(pickup.toLocationRefs) !== JSON.stringify(session.toLocationRefs) || pickup.warehouseArea !== session.toWarehouseArea || pickup.locationCode !== session.toLocationCode) fail()
      }
    }
  }
  for (const pickup of pickups.values()) if (!sessions.some(session => session.pickupSessionId === pickup.pickupSessionId && session.pickupRecordIds.includes(pickup.pickupRecordId))) fail()
}
function currentRows(): CuttingStoredRecord[] {
  if (!committed) throw new ProductionContextReadError('接收记录尚未读取，请重新进入页面。')
  return committed
}
export function applyCuttingPickupRecordView(store: ProductionMaterialPrepWorkflowStore, raw: string | null, storage: BrowserStorageLike | null): ProductionMaterialPrepWorkflowStore {
  if (!isNativeCuttingPickupStorage(storage)) return store
  if (!storage) throw new ProductionContextReadError('原配料资料无法读取，未使用空记录代替。')
  const old = raw === null ? {} : JSON.parse(raw)
  const next = clone(store)
  for (const group of Object.keys(groups) as Group[]) {
    const rows = currentRows().filter(row => row.collection === `${prefix}${group}`)
    const ids = new Set(rows.map(row => (row.value as any)[groups[group]]))
    if ((old[group] || []).some((row: Record<string, any>) => ids.has(row[groups[group]]))) throw new ProductionContextReadError('旧页面重新写入了已接管的接收记录，请先核对并迁移；双方资料已保留。')
    ;(next[group] as any[]) = [...rows.map(row => clone(row.value)), ...next[group].filter(value => !ids.has((value as any)[groups[group]]))]
  }
  return next
}
export function protectCuttingPickupLegacyWrite(before: ProductionMaterialPrepWorkflowStore, after: ProductionMaterialPrepWorkflowStore, storage: BrowserStorageLike | null): ProductionMaterialPrepWorkflowStore {
  if (!isNativeCuttingPickupStorage(storage)) return after
  if ((Object.keys(groups) as Group[]).some(group => JSON.stringify(before[group]) !== JSON.stringify(after[group]))) throw new Error('接收记录尚未保存，请从当前接收确认按钮重试。')
  const next = clone(after)
  for (const group of Object.keys(groups) as Group[]) {
    const ids = new Set(currentRows().filter(row => row.collection === `${prefix}${group}`).map(row => (row.value as any)[groups[group]]))
    ;(next[group] as any[]) = next[group].filter(row => !ids.has((row as any)[groups[group]]))
  }
  return next
}
/** Only the registered receipt groups may change while computing this receipt. */
export function preparePickupReceiptRows(before: ProductionMaterialPrepWorkflowStore, after: ProductionMaterialPrepWorkflowStore, rawLegacy: string | null): CuttingStoredRecord[] {
  for (const group of ['prepRecords', 'pickupReturnRecords', 'rejectRecords', 'stagingRecords', 'closedOrders'] as const) {
    if (JSON.stringify(before[group]) !== JSON.stringify(after[group])) throw new Error('本次接收包含未登记的配料修改，全部未保存。')
  }
  const previous = new Map(pickupStoreRows(before).map(row => [row.id, row]))
  const next = pickupStoreRows(after), nextIds = new Set(next.map(row => row.id))
  if ([...previous.keys()].some(id => !nextIds.has(id))) throw new Error('本次接收不能删除原接收事实，全部未保存。')
  const changed = next.filter(row => JSON.stringify(previous.get(row.id)) !== JSON.stringify(row))
  // Unchanged historical/static records are not adopted or recertified by this receipt.
  validateCuttingPickupRecords(changed)
  const legacy = rawLegacy === null ? {} : JSON.parse(rawLegacy)
  for (const row of changed) {
    const group = row.collection.slice(prefix.length) as Group
    if ((legacy[group] || []).some((value: Record<string, any>) => value[groups[group]] === (row.value as any)[groups[group]])) throw new ProductionContextReadError('本次涉及已有旧接收记录，请先迁移后继续；原资料未覆盖。')
  }
  return changed
}
