import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareCuttingPickupFootprintAdjustment } from '../../src/data/fcs/cutting/cutting-pickup-footprint-command.ts'
import type { PickupSession, PickupStorageLocationRef } from '../../src/data/fcs/cutting/pickup-node-domain.ts'

const ref: PickupStorageLocationRef = { factoryId: 'factory-actual-scope', warehouseId: 'warehouse-actual-scope', warehouseKind: 'WAIT_PROCESS', areaId: 'area-A', areaName: 'A', shelfId: 'shelf-01', shelfNo: '01', locationId: 'location-01', locationNo: 'A-01' }
const session: PickupSession = {
  pickupSessionId: 'session-original', pickupSessionNo: 'Receipt 001', pickupNodeId: 'node-original', pickupNodeVersion: 1, prepOrderId: 'prep-original', productionOrderId: 'production-original', nodeType: 'READY_TO_PICKUP', pickupRecordIds: ['pickup-original'], receiverName: 'Original receiving employee', pickedAt: '2026-10-21 08:00:00', toWarehouseArea: ref.areaName, toLocationCode: ref.locationNo, toLocationRefs: [ref], status: '本轮已领完', warehouseSyncStatus: '已回写',
  storageFootprint: { footprintId: 'footprint-original', sourceType: 'PICKUP_SESSION', sourceId: 'session-original', locationIds: [ref.locationId], unitSummaries: [{ unit: 'yard', totalQty: 20, remainingQty: 20, rollCount: 2 }, { unit: '米', totalQty: 12, remainingQty: 12, rollCount: 1 }], inboundAt: '2026-10-21 08:00:00', inboundBy: 'Original receiving employee' },
}
const input = () => ({ pickupSessionId: session.pickupSessionId, expectedFootprint: JSON.stringify(session.storageFootprint), locationRefs: [ref], remainingByUnit: [{ unit: 'yard', remainingQty: 10 }, { unit: '米', remainingQty: 7 }], operatorName: 'Current adjustment employee', operatorId: 'actual-adjustment-uid', eventSource: 'PDA' as const, operatorRole: '仓管', operationId: 'operation-original' })

test('C01.04c.5a: storage adjustment preserves original receipt responsibility and records each original unit separately', () => {
  const before = structuredClone(session), plan = prepareCuttingPickupFootprintAdjustment(session, input(), '2026-10-21 09:00:00.001')
  assert.deepEqual(session, before)
  assert.equal(plan.next.receiverName, session.receiverName)
  assert.equal(plan.next.lastStorageAdjustmentId, input().operationId)
  assert.deepEqual(plan.events.map(e => [e.inventoryEffect?.qty, e.inventoryEffect?.unit]), [[10, 'yard'], [7, '米']])
  assert.ok(plan.events.every(e => e.operatorId === 'actual-adjustment-uid' && e.operatorName === 'Current adjustment employee'))
  assert.ok(plan.events.every(e => e.inventoryEffect?.direction === 'ADJUST' && e.payload.storageFootprint.sourceId === session.pickupSessionId))
  assert.deepEqual(plan.next.storageFootprint?.unitSummaries.map(s => s.remainingQty), [10, 7])
})

test('C01.04c.5a: clearing locations requires zero remainder in every original unit', () => {
  assert.throws(() => prepareCuttingPickupFootprintAdjustment(session, { ...input(), locationRefs: [] }, '2026-10-21 09:00:00.001'), /至少一个库位/)
  const plan = prepareCuttingPickupFootprintAdjustment(session, { ...input(), locationRefs: [], remainingByUnit: [{ unit: 'yard', remainingQty: 0 }, { unit: '米', remainingQty: 0 }] }, '2026-10-21 09:00:00.001')
  assert.deepEqual(plan.next.toLocationRefs, [])
  assert.ok(plan.events.every(e => e.inventoryEffect?.qty === 0))
  const repeated = prepareCuttingPickupFootprintAdjustment(plan.next, { ...input(), expectedFootprint: JSON.stringify(plan.next.storageFootprint), locationRefs: [], remainingByUnit: [{ unit: 'yard', remainingQty: 0 }, { unit: '米', remainingQty: 0 }] }, '2026-10-21 09:00:01.001', ref)
  assert.ok(repeated.events.every(e => e.payload.factoryId === ref.factoryId && e.payload.warehouseId === ref.warehouseId))
})

test('C01.04c.5a: stale scope, excess, duplicate or changed units cannot alter remaining material', () => {
  for (const change of [
    { expectedFootprint: 'stale-original' },
    { remainingByUnit: [{ unit: 'yard', remainingQty: 21 }, { unit: '米', remainingQty: 7 }] },
    { remainingByUnit: [{ unit: 'yard', remainingQty: 10 }, { unit: 'yard', remainingQty: 7 }] },
    { remainingByUnit: [{ unit: 'Yard', remainingQty: 10 }, { unit: '米', remainingQty: 7 }] },
    { locationRefs: [{ ...ref, factoryId: 'another-factory' }] },
    { locationRefs: [ref, ref] },
    { operatorName: '' },
  ]) assert.throws(() => prepareCuttingPickupFootprintAdjustment(session, { ...input(), ...change }, '2026-10-21 09:00:00.001'))
})


test('C01.04c.5a: each operation and original unit has a stable event identity even within the same second', () => {
  const at = '2026-10-21 09:00:00.000'
  const first = prepareCuttingPickupFootprintAdjustment(session, input(), at)
  const retry = prepareCuttingPickupFootprintAdjustment(session, input(), at)
  const second = prepareCuttingPickupFootprintAdjustment(session, { ...input(), operationId: 'another-confirmation' }, at)
  assert.equal(new Set([...first.events, ...second.events].map(row => row.eventId)).size, 4)
  assert.deepEqual(first.events.map(row => row.eventId), retry.events.map(row => row.eventId))
})
