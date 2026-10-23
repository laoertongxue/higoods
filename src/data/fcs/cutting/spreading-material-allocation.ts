import type { CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import { convertCuttingQuantity } from './cutting-quantity-unit.ts'

/** Material already issued to this bed remains available at the work station until returned. */
export function spreadingAllocatedMaterial(input: { events: CuttingRuntimeEvent[]; spreadingOrderId: string; factoryId: string; cutOrderIds: string[]; unit: string }) {
  const active = input.events.filter(event => event.eventStatus !== '已取消')
  const byId = new Map(active.map(event => [event.eventId, event]))
  const quantities = new Map<string, number>(); let unitIssue = false
  const locations = (event: CuttingRuntimeEvent) => (event.payload as { warehouseLocations?: Array<{ factoryId: string; warehouseId: string; warehouseKind: string }> }).warehouseLocations || []
  for (const issue of active.filter(event => event.eventType === '待加工仓加工接收' && event.inventoryEffect?.direction === 'OUT'
    && event.refs.spreadingOrderId === input.spreadingOrderId && input.cutOrderIds.includes(event.refs.cutOrderId || ''))) {
    const payload = issue.payload as { sourceInboundEventIds?: string[] }, refs = locations(issue)
    if (!refs.length || refs.some(ref => ref.factoryId !== input.factoryId || ref.warehouseKind !== 'WAIT_PROCESS') || !payload.sourceInboundEventIds?.length) continue
    const sources = payload.sourceInboundEventIds.map(id => byId.get(id))
    if (sources.some(source => !source || source.inventoryEffect?.direction !== 'IN' || source.inventoryEffect.unit !== issue.inventoryEffect!.unit || source.refs.cutOrderId !== issue.refs.cutOrderId
      || source.refs.productionOrderId !== issue.refs.productionOrderId || source.material?.materialSku !== issue.material?.materialSku
      || !locations(source).some(ref => ref.factoryId === input.factoryId && refs.some(target => target.warehouseId === ref.warehouseId)))) continue
    const returns = active.filter(event => event.eventType === '待加工仓回收入仓'
      && (event.payload as { sourceIssueEventId?: string }).sourceIssueEventId === issue.eventId)
    const unit = issue.inventoryEffect!.unit
    if (returns.some(event => event.inventoryEffect?.direction !== 'IN' || event.inventoryEffect.unit !== unit
      || event.material?.materialSku !== issue.material?.materialSku || !locations(event).length
      || locations(event).some(ref => ref.factoryId !== input.factoryId || ref.warehouseKind !== 'WAIT_PROCESS' || !refs.some(original => original.warehouseId === ref.warehouseId)))) continue
    const remaining = issue.inventoryEffect!.qty - returns.reduce((sum, event) => sum + (event.inventoryEffect?.qty || 0), 0)
    if (!Number.isFinite(remaining) || remaining < 0) continue
    const quantity = convertCuttingQuantity(remaining, unit, input.unit)
    if (quantity === null) { unitIssue = true; continue }
    const id = issue.refs.cutOrderId!
    quantities.set(id, (quantities.get(id) || 0) + quantity)
  }
  return { quantity: Number([...quantities.values()].reduce((sum, value) => sum + value, 0).toFixed(2)), quantities, unitIssue }
}
