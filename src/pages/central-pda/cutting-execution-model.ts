import { withGeneratedCutOrderReadFrame } from '../../data/fcs/cutting/generated-cut-orders.ts'
import { buildMarkerSpreadingProjection } from '../process-factory/cutting/marker-spreading-projection.ts'
import { assertCentralCuttingActor, centralCuttingWarehouse, centralCuttingLocationRefs, cuttingEventPayload, prepareCentralCutting, readCentralCuttingFacts, type CentralCuttingFacts } from './cutting-model.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import type { PickupStorageLocationRef } from '../../data/fcs/cutting/pickup-node-domain.ts'
import { cuttingIssueSourceSnapshot, cuttingReturnSourceSnapshot, prepareCuttingProcessIssue, prepareCuttingProcessReturn, type CuttingMaterialMovementInput, type CuttingIssueSource, type CuttingReturnSource } from '../../data/fcs/cutting/cutting-process-material.ts'
import { runCuttingEventAction, committedCuttingEvents } from '../../data/fcs/cutting/cutting-event-repository.ts'
import { appendCuttingRuntimeEventIdempotent } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { formatIndonesiaBusinessDateTime } from '../../data/fcs/indonesia-business-time.ts'
import { warehouseLayoutSourceKeys } from '../process-factory/cutting/warehouse-location-layout-store.ts'
import { spreadingIssueConsumedQuantity } from '../../data/fcs/cutting/spreading-material-consumption.ts'

export function readCentralCuttingExecution(facts: CentralCuttingFacts) {
 return withGeneratedCutOrderReadFrame(() => {
  const projection = buildMarkerSpreadingProjection({ includeCreateSources: false, includeViewModel: false })
  const orders = projection.spreadingOrders.filter(order => order.sourceCutOrderIds.length > 0 && order.sourceCutOrderIds.every(id => {
    const source = facts.assigned.find(source => source.cutOrderId === id)
    if (!source) return false
    const executions = facts.tasks.filter(task => task.executionEnabled !== false && !task.isSplitSource && task.productionOrderId === source.productionOrderId
      && (task.taskId === source.cuttingTaskId || task.rootTaskNo === source.cuttingTaskNo))
    return executions.length > 0 && executions.every(task => task.status !== 'CANCELLED' && task.assignedFactoryId === facts.factory?.id && ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus))
  }))
  const stocks: Omit<CuttingIssueSource, 'order' | 'sourceIdentity'>[] = []
  const persisted = new Set(committedCuttingEvents().map(event => event.eventId))
  for (const warehouse of facts.warehouses.filter(w => w.warehouseKind === 'WAIT_PROCESS')) {
    const current = centralCuttingWarehouse(warehouse.factoryId, 'WAIT_PROCESS', warehouse.warehouseId)
    // One footprint appears at several locations; its quantity is counted once.
    const stockRows = current.cells.flatMap(cell => cell.occupancies).filter(stock => Boolean(stock.sourceEventId))
    const stockBySource = new Map(stockRows.map(stock => [stock.sourceEventId, stock]))
    for (const [id, stock] of stockBySource) {
      const inbound = facts.events.find(event => event.eventId === id), source = facts.assigned.find(source => source.cutOrderId === inbound?.refs.cutOrderId)
      if (!inbound || !persisted.has(inbound.eventId) || !source || source.materialSku !== inbound.material?.materialSku || source.productionOrderId !== inbound.refs.productionOrderId || !(stock.qty > 0)) continue
      const same = stockRows.filter(item => item.sourceEventId === id)
      const cells = same.map(item => current.cells.find(cell => cell.locationId === item.locationId))
      if (cells.some(cell => !cell || cell.status !== 'AVAILABLE' || cell.areaStatus !== 'AVAILABLE' || cell.shelfStatus !== 'AVAILABLE')) continue
      const locations: PickupStorageLocationRef[] = cells.map(cell => ({ factoryId: warehouse.factoryId, warehouseId: warehouse.warehouseId, warehouseKind: 'WAIT_PROCESS',
        areaId: cell!.areaId, areaName: cell!.areaName, shelfId: cell!.shelfId, shelfNo: cell!.shelfNo, locationId: cell!.locationId, locationNo: cell!.locationNo }))
      stocks.push({ inbound, availableQty: stock.qty, locations })
    }
  }
  const issues = orders.flatMap(order => stocks.filter(stock => order.sourceCutOrderIds.includes(stock.inbound.refs.cutOrderId || '') && stock.inbound.material?.materialSku === order.materialIdentity.materialSku)
    .map(stock => ({ ...stock, order, sourceIdentity: order.sourceCutOrderIds.map(id => facts.assigned.find(source => source.cutOrderId === id)) })))
  // Returns belong to the original physical warehouse even if dispatch changes later.
  const returns: CuttingReturnSource[] = facts.warehouseEvents.filter(event => event.eventType === '待加工仓加工接收' && event.eventStatus !== '已取消'
    && Array.isArray(cuttingEventPayload(event).sourceInboundEventIds)).map(issue => ({ issue,
    consumedQty: spreadingIssueConsumedQuantity(projection.store.sessions, issue.eventId, issue.inventoryEffect?.unit || ''),
    returnedQty: facts.events.filter(event => event.eventType === '待加工仓回收入仓' && event.eventStatus !== '已取消'
      && cuttingEventPayload(event).sourceIssueEventId === issue.eventId && event.inventoryEffect?.unit === issue.inventoryEffect?.unit)
      .reduce((sum, event) => sum + (event.inventoryEffect?.qty || 0), 0) }))
  return { orders, issues, returns, store: projection.store, rowsById: projection.rowsById }
 })
}
export type CentralCuttingExecution = ReturnType<typeof readCentralCuttingExecution>
const occurredAt = () => { const now = new Date(); return `${formatIndonesiaBusinessDateTime(now)}.${String(now.getMilliseconds()).padStart(3, '0')}` }
export function centralCuttingMovementInput(source: CuttingIssueSource | CuttingReturnSource, actor: FactoryPdaUser, quantity: number, rollCount: number, operationId: string): CuttingMaterialMovementInput {
  return { operationId, expectedSource: 'inbound' in source ? cuttingIssueSourceSnapshot(source) : cuttingReturnSourceSnapshot(source), quantity, rollCount,
    operatorId: actor.userId, operatorName: actor.name, factoryId: actor.factoryId }
}
function assertActorInput(input: CuttingMaterialMovementInput, actor: FactoryPdaUser) {
  assertCentralCuttingActor(actor)
  if (input.factoryId !== actor.factoryId || input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('CUT_actor')
}
export async function saveCentralCuttingIssue(input: CuttingMaterialMovementInput & { inboundEventId: string; spreadingOrderId: string }, actor: FactoryPdaUser) {
  assertActorInput(input, actor); await prepareCentralCutting()
  const source = () => {
    assertActorInput(input, actor)
    const facts = readCentralCuttingFacts(actor.factoryId), current = readCentralCuttingExecution(facts).issues.find(row => row.inbound.eventId === input.inboundEventId && row.order.spreadingOrderId === input.spreadingOrderId)
    if (!current) throw new Error('CUT_changed')
    prepareCuttingProcessIssue(current, input, occurredAt())
    return current
  }
  return runCuttingEventAction({ id: `cutting-issue:${input.operationId}`, intent: JSON.stringify(input), assertCurrent: () => { source() }, action: storage => {
    const current = source()
    for (const key of warehouseLayoutSourceKeys(actor.factoryId, 'WAIT_PROCESS', current.locations[0].warehouseId)) storage.getItem(key)
    const event = prepareCuttingProcessIssue(current, input, occurredAt())
    return appendCuttingRuntimeEventIdempotent(event, storage).event
  } })
}
export async function saveCentralCuttingReturn(input: CuttingMaterialMovementInput & { issueEventId: string; locations: PickupStorageLocationRef[] }, actor: FactoryPdaUser) {
  assertActorInput(input, actor); await prepareCentralCutting()
  const source = () => {
    assertActorInput(input, actor)
    const current = readCentralCuttingExecution(readCentralCuttingFacts(actor.factoryId)).returns.find(row => row.issue.eventId === input.issueEventId)
    if (!current || !input.locations.length) throw new Error('CUT_changed')
    const refs = centralCuttingLocationRefs(actor.factoryId, input.locations[0].warehouseId, input.locations.map(ref => ref.locationId))
    if (JSON.stringify(refs) !== JSON.stringify(input.locations)) throw new Error('CUT_position')
    prepareCuttingProcessReturn(current, refs, input, occurredAt())
    return current
  }
  return runCuttingEventAction({ id: `cutting-return:${input.operationId}`, intent: JSON.stringify(input), assertCurrent: () => { source() }, action: storage => {
    const current = source()
    for (const key of warehouseLayoutSourceKeys(actor.factoryId, 'WAIT_PROCESS', input.locations[0].warehouseId)) storage.getItem(key)
    return appendCuttingRuntimeEventIdempotent(prepareCuttingProcessReturn(current, input.locations, input, occurredAt()), storage).event
  } })
}
