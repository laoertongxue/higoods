import { refreshPcsRecordStateAfterExternalChange } from '../../data/pcs-record-runtime.ts'
import { hydrateCuttingEventRecords } from '../../data/fcs/cutting/cutting-event-repository.ts'
import { buildPickupRuntimeContext } from '../../runtime/fcs/cutting/pickup-management-runtime.ts'
import { listGeneratedCutOrderSourceRecords, withGeneratedCutOrderReadFrame } from '../../data/fcs/cutting/generated-cut-orders.ts'
import { listRuntimeProcessTasks } from '../../data/fcs/runtime-process-tasks.ts'
import { isCuttingProcessTask } from '../../data/fcs/cutting/cutting-task-routing.ts'
import { resolveCentralCuttingPickupSources } from '../../data/fcs/cutting/central-cutting-source.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse-locations.ts'
import { buildCuttingWarehouseMapProjectionForWarehouse, buildWaitProcessRuntimeOccupancies } from '../process-factory/cutting/warehouse-location-map.ts'
import { listWarehouseLocationMapCells } from '../process-factory/cutting/warehouse-location-map-model.ts'
import { listCuttingRuntimeEventsByInventoryScope, type CuttingRuntimeEvent } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { hydrateProductionMaterialPrepStore } from '../../data/fcs/cutting/production-material-prep.ts'
import { confirmCuttingPickupNodeReceipt } from '../../data/fcs/cutting/cutting-pickup-command.ts'
import { adjustCuttingPickupStorageFootprint } from '../../data/fcs/cutting/cutting-pickup-footprint-command.ts'
import { readCuttingCommand } from '../../data/fcs/cutting/cutting-record-repository.ts'
import type { PickupStorageLocationRef, PickupSession } from '../../data/fcs/cutting/pickup-node-domain.ts'

export async function prepareCentralCutting() { await refreshPcsRecordStateAfterExternalChange(); await hydrateCuttingEventRecords() }
export const cuttingEventPayload = (event: CuttingRuntimeEvent) => event.payload as Record<string, unknown>
export function centralCuttingFactories() { return listFactoryMasterRecords().filter(factory => factory.status === 'active' && isCentralPdaFactory(factory)) }
export function assertCentralCuttingActor(actor: FactoryPdaUser) {
  const factory = getFactoryMasterRecordById(actor.factoryId), user = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
  if (!factory || factory.status !== 'active' || !isCentralPdaFactory(factory) || !user || user.status !== 'ACTIVE' || user.name !== actor.name) throw new Error('CUT_actor')
}
export function readCentralCuttingFacts(factoryId: string) {
  return withGeneratedCutOrderReadFrame(() => {
    const factory = getFactoryMasterRecordById(factoryId), sources = listGeneratedCutOrderSourceRecords({ includeDimensionScenarios: false })
    const context = buildPickupRuntimeContext(), tasks = listRuntimeProcessTasks().filter(isCuttingProcessTask)
    const incoming = context.activeNodes.flatMap(node => {
      const projection = context.projections.find(projection => projection.order.prepOrderId === node.prepOrderId)
      const cuttingSources = resolveCentralCuttingPickupSources(node, projection, sources, factory, tasks)
      return cuttingSources && projection ? [{ node, projection, cuttingSources }] : []
    })
    const warehouses = factory && factory.status === 'active' && isCentralPdaFactory(factory) ? listFactoryInternalWarehouses(factoryId).filter(warehouse => warehouse.isEnabled && warehouse.factoryKind === 'CENTRAL_CUTTING') : []
    const events = listCuttingRuntimeEventsByInventoryScope('裁床待加工仓')
    const sessions = hydrateProductionMaterialPrepStore().pickupSessions.filter(session => events.some(event => event.eventType === '中转仓接收'
      && cuttingEventPayload(event).pickupSessionId === session.pickupSessionId && (cuttingEventPayload(event).warehouseLocations as PickupStorageLocationRef[] | undefined)?.some(ref => ref.factoryId === factoryId)))
    const assigned = factory && factory.status === 'active' && isCentralPdaFactory(factory) ? sources.filter(source => source.cuttingTaskAssigneeFactoryId === factoryId
      && ['ASSIGNED', 'AWARDED'].includes(source.cuttingTaskAssignmentStatus) && source.executionRoute !== 'CONFLICT') : []
    const warehouseEvents = [...events, ...listCuttingRuntimeEventsByInventoryScope('裁床待交出仓')].filter(event => {
      const payload = cuttingEventPayload(event)
      return payload.factoryId === factoryId && warehouses.some(w => w.warehouseId === payload.warehouseId)
        || (payload.warehouseLocations as PickupStorageLocationRef[] | undefined)?.some(ref => ref.factoryId === factoryId && warehouses.some(w => w.warehouseId === ref.warehouseId))
    })
    return { factory, incoming, sessions, assigned, tasks, warehouses, events, warehouseEvents }
  })
}
export type CentralCuttingFacts = ReturnType<typeof readCentralCuttingFacts>
export type CentralCuttingIncoming = CentralCuttingFacts['incoming'][number]
export function centralCuttingPositions(factoryId: string, warehouseId: string, excludeSessionId?: string) {
  const map = buildCuttingWarehouseMapProjectionForWarehouse('WAIT_PROCESS', warehouseId, { excludePickupSessionId: excludeSessionId })
  if (!map || map.warehouse.factoryId !== factoryId) throw new Error('CUT_position')
  return { ...map, cells: listWarehouseLocationMapCells(map.projection) }
}
export function centralCuttingLocationRefs(factoryId: string, warehouseId: string, ids: string[], excludeSessionId?: string): PickupStorageLocationRef[] {
  const map = centralCuttingPositions(factoryId, warehouseId, excludeSessionId)
  const selected = ids.map(id => map.cells.find(cell => cell.locationId === id))
  if (selected.some(cell => !cell || cell.businessStatus !== 'EMPTY' || cell.status !== 'AVAILABLE' || cell.areaStatus !== 'AVAILABLE' || cell.shelfStatus !== 'AVAILABLE') || new Set(ids).size !== ids.length) throw new Error('CUT_position')
  return selected.map(cell => ({ factoryId: cell!.factoryId, warehouseId: cell!.warehouseId, warehouseKind: 'WAIT_PROCESS', areaId: cell!.areaId,
    areaName: cell!.areaName, shelfId: cell!.shelfId, shelfNo: cell!.shelfNo, locationId: cell!.locationId, locationNo: cell!.locationNo }))
}
export function centralCuttingReceiveInput(row: CentralCuttingIncoming, refs: PickupStorageLocationRef[], actor: FactoryPdaUser) {
  return { pickupNodeId: row.node.nodeId, pickupNodeVersion: row.node.version, expectedNodeSnapshot: JSON.stringify(row.node),
    receiverName: actor.name, receiverUserId: actor.userId, cuttingSources: structuredClone(row.cuttingSources), eventSource: 'PDA' as const,
    operatorRole: '现场接收人员', toLocationRefs: structuredClone(refs), expectedFactoryId: actor.factoryId }
}
export async function saveCentralCuttingReceipt(input: ReturnType<typeof centralCuttingReceiveInput>, actor: FactoryPdaUser) {
  assertCentralCuttingActor(actor)
  if (input.receiverUserId !== actor.userId || input.receiverName !== actor.name || input.expectedFactoryId !== actor.factoryId) throw new Error('CUT_actor')
  const prior = await readCuttingCommand(`cutting-node-receipt:${input.pickupNodeId}:v${input.pickupNodeVersion}`)
  if (prior?.intent === JSON.stringify(input)) return confirmCuttingPickupNodeReceipt(input)
  await prepareCentralCutting()
  const assertCurrent = () => {
    assertCentralCuttingActor(actor)
    const current = readCentralCuttingFacts(actor.factoryId).incoming.find(row => row.node.nodeId === input.pickupNodeId)
    if (!current || JSON.stringify(current.node) !== input.expectedNodeSnapshot || JSON.stringify(current.cuttingSources) !== JSON.stringify(input.cuttingSources)) throw new Error('CUT_changed')
  }
  assertCurrent()
  return confirmCuttingPickupNodeReceipt(input, { assertCurrent })
}
export async function saveCentralCuttingFootprint(input: Parameters<typeof adjustCuttingPickupStorageFootprint>[0], actor: FactoryPdaUser) {
  assertCentralCuttingActor(actor)
  if (input.operatorId !== actor.userId || input.operatorName !== actor.name) throw new Error('CUT_actor')
  await prepareCentralCutting()
  const session = readCentralCuttingFacts(actor.factoryId).sessions.find(row => row.pickupSessionId === input.pickupSessionId)
  if (!session) throw new Error('CUT_changed')
  return adjustCuttingPickupStorageFootprint(input, { assertCurrent: () => assertCentralCuttingActor(actor) })
}
export function centralCuttingSessionScope(session: PickupSession, facts: CentralCuttingFacts) {
  const event = facts.events.find(event => event.eventType === '中转仓接收' && cuttingEventPayload(event).pickupSessionId === session.pickupSessionId)
  return event ? (cuttingEventPayload(event).warehouseLocations as PickupStorageLocationRef[] | undefined)?.[0] : undefined
}
export function centralCuttingStock(factoryId: string, warehouseId: string) {
  const map = buildCuttingWarehouseMapProjectionForWarehouse('WAIT_PROCESS', warehouseId)
  if (!map || map.warehouse.factoryId !== factoryId) return []
  return buildWaitProcessRuntimeOccupancies(map.warehouse, map.snapshot, listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'))
}
/** Current physical remainder; the receipt snapshot continues to show what was originally received. */
export function centralCuttingSessionRemaining(session: PickupSession, facts: CentralCuttingFacts) {
  const scope = centralCuttingSessionScope(session, facts)
  if (!scope) throw new Error('CUT_changed')
  const stocks = new Map(centralCuttingStock(scope.factoryId, scope.warehouseId).filter(row => row.sourceSessionId === session.pickupSessionId)
    .map(row => [row.sourceEventId, row]))
  return (session.storageFootprint?.unitSummaries || []).map(row => ({ ...row, remainingQty: Number([...stocks.values()]
    .filter(stock => stock.unit === row.unit).reduce((sum, stock) => sum + stock.qty, 0).toFixed(2)) }))
}
export function centralCuttingWarehouse(factoryId: string, kind: 'WAIT_PROCESS' | 'WAIT_HANDOVER', warehouseId: string) {
  const map = buildCuttingWarehouseMapProjectionForWarehouse(kind, warehouseId)
  if (!map || map.warehouse.factoryId !== factoryId) throw new Error('CUT_position')
  return { ...map, cells: listWarehouseLocationMapCells(map.projection) }
}
