import type { CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import type { CuttingStoredRecord } from './cutting-record-repository.ts'
import { validateCentralSpreadingMaterialRecords } from './spreading-material-records.ts'

/** New material movements retain their actual source through readback and backup restoration. */
export function validateCuttingMaterialRecordLinks(records: CuttingStoredRecord[]): void {
  validateCentralSpreadingMaterialRecords(records)
  const rows = records.filter(row => row.collection === 'cutting-events').map(row => row.value as CuttingRuntimeEvent)
  const moves = rows.filter(event => /^cutting-(?:issue|return):/.test(event?.eventId || ''))
  if (!moves.length) return
  const byId = new Map(rows.map(event => [event?.eventId, event]))
  function fail(): never { throw new Error('领用或回仓的原批次、单位、数量或交接责任不完整，原资料未被覆盖。') }
  const text = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
  const refs = (payload: Record<string, unknown>) => Array.isArray(payload.warehouseLocations) ? payload.warehouseLocations as Array<Record<string, unknown>> : []
  const returned = new Map<string, number>()
  for (const event of moves) {
    const payload = event.payload as unknown as Record<string, unknown>, effect = event.inventoryEffect
    if (!payload || !effect || effect.inventoryScope !== '裁床待加工仓' || !positive(effect.qty) || !text(effect.unit)
      || !text(event.operatorId) || !text(event.operatorName) || !text(event.occurredAt) || !text(event.refs?.cutOrderId)
      || !text(event.refs.productionOrderId) || !text(event.refs.spreadingOrderId) || !text(event.material?.materialSku)
      || payload.unit !== effect.unit || event.material.unit !== effect.unit || payload.materialSku !== event.material.materialSku
      || payload.spreadingOrderId !== event.refs.spreadingOrderId || payload.spreadingOrderNo !== event.refs.spreadingOrderNo
      || !Number.isSafeInteger(payload.rollCount) || Number(payload.rollCount) <= 0 || payload.rollCount !== effect.rollCount) fail()
    const locations = refs(payload), first = locations[0]
    if (!first || !text(first.factoryId) || !text(first.warehouseId) || locations.some(ref => !text(ref.locationId)
      || ref.factoryId !== first.factoryId || ref.warehouseId !== first.warehouseId || ref.warehouseKind !== 'WAIT_PROCESS')) fail()
    const issue = event.eventId.startsWith('cutting-issue:')
    const sourceIds = issue ? payload.sourceInboundEventIds : [payload.sourceIssueEventId]
    if (!Array.isArray(sourceIds) || sourceIds.length !== 1 || !text(sourceIds[0])) fail()
    const source = byId.get(sourceIds[0]), sourcePayload = source?.payload as unknown as Record<string, unknown> | undefined
    if (!source || !sourcePayload || source.inventoryEffect?.inventoryScope !== effect.inventoryScope || source.inventoryEffect.unit !== effect.unit
      || source.refs.cutOrderId !== event.refs.cutOrderId || source.refs.productionOrderId !== event.refs.productionOrderId
      || source.material?.materialSku !== event.material.materialSku
      || source.eventStatus === '已取消' && event.eventStatus !== '已取消'
      || JSON.stringify(payload.cuttingSource) !== JSON.stringify(sourcePayload.cuttingSource)) fail()
    const originalLocations = refs(sourcePayload)
    if (!originalLocations.length || originalLocations.some(ref => ref.factoryId !== first.factoryId || ref.warehouseId !== first.warehouseId || ref.warehouseKind !== 'WAIT_PROCESS')) fail()
    if (issue) {
      if (event.eventType !== '待加工仓加工接收' || effect.direction !== 'OUT' || source.inventoryEffect.direction !== 'IN'
        || payload.issueRecordId !== event.eventId || payload.issuedQty !== effect.qty || payload.issuedBy !== event.operatorName || payload.issuedAt !== event.occurredAt
        || payload.receivedBy !== source.operatorName || payload.receivedById !== source.operatorId || payload.pickupSessionId !== sourcePayload.pickupSessionId) fail()
    } else {
      if (event.eventType !== '待加工仓回收入仓' || effect.direction !== 'IN' || source.eventType !== '待加工仓加工接收' || source.inventoryEffect.direction !== 'OUT'
        || source.refs.spreadingOrderId !== event.refs.spreadingOrderId || payload.returnRecordId !== event.eventId || payload.returnedQty !== effect.qty
        || payload.returnedBy !== event.operatorName || payload.returnedAt !== event.occurredAt || effect.qty > source.inventoryEffect.qty
        || payload.sourcePickupSessionId !== sourcePayload.pickupSessionId) fail()
      if (event.eventStatus !== '已取消') returned.set(source.eventId, (returned.get(source.eventId) || 0) + effect.qty)
    }
  }
  for (const [id, quantity] of returned) if (quantity > (byId.get(id)?.inventoryEffect?.qty || 0) + 1e-7) fail()
}
