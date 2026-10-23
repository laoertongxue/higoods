import { adjustPickupSessionStorageFootprint, type PickupSession, type PickupStorageLocationRef } from './pickup-node-domain.ts'
import { hydrateProductionMaterialPrepStore, updatePickupSessionStorageFootprint } from './production-material-prep.ts'
import { runCuttingEventAction } from './cutting-event-repository.ts'
import { appendCuttingRuntimeEventIdempotent, CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, deserializeCuttingRuntimeEventLedgerStorage, type AppendCuttingRuntimeEventInput, type CuttingRuntimeQtyUnit } from './cutting-runtime-event-ledger.ts'
import { buildCuttingWarehouseMapProjectionForWarehouse } from '../../../pages/process-factory/cutting/warehouse-location-map.ts'
import { listWarehouseLocationMapCells, revalidateWarehouseLocationSelection } from '../../../pages/process-factory/cutting/warehouse-location-map-model.ts'
import { warehouseLayoutSourceKeys } from '../../../pages/process-factory/cutting/warehouse-location-layout-store.ts'
import { formatIndonesiaBusinessDateTime } from '../indonesia-business-time.ts'

export interface CuttingPickupFootprintInput {
  pickupSessionId: string
  expectedFootprint: string
  locationRefs: PickupStorageLocationRef[]
  remainingByUnit: Array<{ unit: string; remainingQty: number }>
  operatorName: string
  operatorId: string
  operatorRole: string
  eventSource: 'PDA' | 'WEB'
  operationId: string
}

/** Retain the original range rule; a location adjustment never combines different quantity units. */
export function prepareCuttingPickupFootprintAdjustment(session: PickupSession, input: CuttingPickupFootprintInput, occurredAt: string, sourceScope?: Pick<PickupStorageLocationRef, 'factoryId' | 'warehouseId'>) {
  if (!input.operationId.trim() || !input.operatorId.trim() || !input.operatorName.trim()) throw new Error('当前操作人或确认编号缺失，请重新进入。')
  if (!session.storageFootprint || session.pickupSessionId !== input.pickupSessionId || JSON.stringify(session.storageFootprint) !== input.expectedFootprint) throw new Error('接收存放记录已变化，请重新读取后核对。')
  const units = session.storageFootprint.unitSummaries.map(row => row.unit)
  if (new Set(units).size !== units.length || input.remainingByUnit.length !== units.length || new Set(input.remainingByUnit.map(row => row.unit)).size !== units.length
    || input.remainingByUnit.some(row => !units.includes(row.unit))) throw new Error('剩余数量必须逐项保留原接收单位。')
  if (new Set(input.locationRefs.map(ref => ref.locationId)).size !== input.locationRefs.length) throw new Error('所选库位重复，请重新选择。')
  const scope = sourceScope || session.toLocationRefs?.[0] || input.locationRefs[0]
  if (!scope) throw new Error('原接收仓库信息缺失，请重新读取。')
  if (input.locationRefs.some(ref => ref.warehouseKind !== 'WAIT_PROCESS' || ref.factoryId !== scope?.factoryId || ref.warehouseId !== scope?.warehouseId)) throw new Error('所选库位不属于原接收待加工仓。')
  const next = adjustPickupSessionStorageFootprint(session, input.locationRefs, input.remainingByUnit)
  next.lastStorageAdjustmentId = input.operationId
  const events = next.storageFootprint!.unitSummaries.map((row, index): AppendCuttingRuntimeEventInput<'待加工仓位置调整'> & { idempotencyKey: string } => ({
    eventId: `cutting-event:footprint:${input.operationId}:${index}`, idempotencyKey: `cutting-footprint:${input.operationId}:${index}`, eventType: '待加工仓位置调整', eventSource: input.eventSource,
    operatorName: input.operatorName.trim(), operatorId: input.operatorId, operatorRole: input.operatorRole, occurredAt,
    refs: { productionOrderId: session.productionOrderId, handoverRecordId: session.pickupSessionId },
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'ADJUST', qty: row.remainingQty, unit: row.unit as CuttingRuntimeQtyUnit,
      toWarehouseArea: input.locationRefs[0]?.areaName || '', toLocationCode: input.locationRefs[0]?.locationNo || '' },
    payload: { adjustmentId: input.operationId, pickupSessionId: session.pickupSessionId, factoryId: scope?.factoryId, warehouseId: scope?.warehouseId, warehouseKind: 'WAIT_PROCESS',
      previousLocationIds: session.storageFootprint!.locationIds, warehouseLocations: structuredClone(input.locationRefs),
      remainingByUnit: next.storageFootprint!.unitSummaries.map(row => ({ unit: row.unit, remainingQty: row.remainingQty })), storageFootprint: structuredClone(next.storageFootprint!),
      adjustedAt: occurredAt, adjustedBy: input.operatorName.trim(), adjustedById: input.operatorId },
  }))
  return { next, events }
}

/** Current session/detail locations and all original-unit adjustment events commit together. */
export async function adjustCuttingPickupStorageFootprint(input: CuttingPickupFootprintInput, options: { assertCurrent?: () => void } = {}): Promise<PickupSession> {
  const original = structuredClone(input)
  return runCuttingEventAction({
    id: `cutting-footprint:${original.operationId}`, intent: JSON.stringify(original), pickupReceipt: true, assertCurrent: options.assertCurrent,
    action: storage => {
      options.assertCurrent?.()
      const session = hydrateProductionMaterialPrepStore(storage).pickupSessions.find(row => row.pickupSessionId === original.pickupSessionId)
      if (!session) throw new Error('原接收记录不存在，请重新读取。')
      const inbound = deserializeCuttingRuntimeEventLedgerStorage(storage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)).events
        .find(event => event.eventType === '中转仓接收' && (event.payload as Record<string, unknown>).pickupSessionId === session.pickupSessionId)
      const sourceRefs = (inbound?.payload as { warehouseLocations?: PickupStorageLocationRef[] } | undefined)?.warehouseLocations
      const scope = sourceRefs?.[0]
      if (!scope || original.locationRefs.some(ref => ref.factoryId !== scope.factoryId || ref.warehouseId !== scope.warehouseId || ref.warehouseKind !== 'WAIT_PROCESS')) throw new Error('所选库位不属于原接收待加工仓。')
      for (const key of warehouseLayoutSourceKeys(scope.factoryId, 'WAIT_PROCESS', scope.warehouseId)) storage.getItem(key)
      const current = buildCuttingWarehouseMapProjectionForWarehouse('WAIT_PROCESS', scope.warehouseId, { excludePickupSessionId: session.pickupSessionId })
      if (!current || current.warehouse.factoryId !== scope.factoryId) throw new Error('原接收待加工仓已不可用，请重新读取。')
      const now = new Date(), occurredAt = `${formatIndonesiaBusinessDateTime(now)}.${String(now.getMilliseconds()).padStart(3, '0')}`
      const plan = prepareCuttingPickupFootprintAdjustment(session, original, occurredAt, scope)
      const hasRemaining = plan.next.storageFootprint!.unitSummaries.some(row => row.remainingQty > 0)
      if (hasRemaining) {
        const selection = revalidateWarehouseLocationSelection(current.projection, original.locationRefs.map(ref => ref.locationId))
        if (!selection.ok) throw new Error(selection.message)
      } else if (original.locationRefs.length) throw new Error('全部余量为零时请清空存放库位。')
      const cells = listWarehouseLocationMapCells(current.projection)
      if (original.locationRefs.some(ref => !cells.some(cell => ['factoryId', 'warehouseId', 'areaId', 'areaName', 'shelfId', 'shelfNo', 'locationId', 'locationNo'].every(key => cell[key as keyof typeof cell] === ref[key as keyof typeof ref])))) throw new Error('所选库位资料已变化，请重新选择。')
      const next = updatePickupSessionStorageFootprint({ pickupSessionId: original.pickupSessionId, locationRefs: original.locationRefs, remainingByUnit: original.remainingByUnit, adjustmentId: original.operationId }, storage)
      if (JSON.stringify(next) !== JSON.stringify(plan.next)) throw new Error('本次存放范围计算不一致，全部未保存。')
      for (const event of plan.events) appendCuttingRuntimeEventIdempotent(event, storage)
      return next
    },
  })
}
