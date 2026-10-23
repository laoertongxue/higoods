import assert from 'node:assert/strict'
import test from 'node:test'
import { cuttingIssueSourceSnapshot, cuttingReturnSourceSnapshot, prepareCuttingProcessIssue, prepareCuttingProcessReturn, type CuttingIssueSource, type CuttingMaterialMovementInput } from '../../src/data/fcs/cutting/cutting-process-material.ts'
import type { CuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { PickupStorageLocationRef } from '../../src/data/fcs/cutting/pickup-node-domain.ts'

const ref: PickupStorageLocationRef = { factoryId: 'central-own', warehouseId: 'wait-process', warehouseKind: 'WAIT_PROCESS', areaId: 'area-A', areaName: 'A', shelfId: 'shelf-1', shelfNo: '01', locationId: 'loc-1', locationNo: 'A-01' }
const source = (): CuttingIssueSource => ({ inbound: { eventId: 'IN-real', eventType: '中转仓接收', eventStatus: '已记录', operatorName: 'Original receiver', operatorId: 'receiver-uid', refs: { cutOrderId: 'cut-one', cutOrderNo: 'CUT-001', productionOrderId: 'prod-one', productionOrderNo: 'PO-001' }, material: { materialSku: 'fabric-one', materialName: 'Fabric', unit: 'yard' }, inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 180, unit: 'yard', rollCount: 2 }, payload: { pickupSessionId: 'receipt-real', warehouseLocations: [{ ...ref }], cuttingSource: { cutOrderId: 'cut-one' } } } as CuttingRuntimeEvent,
 availableQty: 180, locations: [{ ...ref }], order: { spreadingOrderId: 'pb-real', spreadingOrderNo: 'PB-001', markerPlanId: 'plan-real', markerPlanNo: 'MKP-001', sourceCutOrderIds: ['cut-one'], productionOrderIds: ['prod-one'], materialIdentity: { materialSku: 'fabric-one' }, status: 'WAITING_SPREADING' } as CuttingIssueSource['order'], sourceIdentity: ['actual-current-dispatch'] })
const input = (row = source()): CuttingMaterialMovementInput => ({ operationId: 'op-one', expectedSource: cuttingIssueSourceSnapshot(row), factoryId: ref.factoryId, operatorId: 'current-uid', operatorName: 'Current employee', quantity: 50, rollCount: 1 })

test('C01.06: one real inbound batch issues in its original unit with both receiving and processing responsibility', () => {
 const row = source(), before = structuredClone(row), result = prepareCuttingProcessIssue(row, input(row), '2026-10-21 09:00:00.001')
 assert.deepEqual(row, before)
 assert.equal(result.inventoryEffect?.qty, 50); assert.equal(result.inventoryEffect?.unit, 'yard')
 assert.deepEqual(result.payload.sourceInboundEventIds, ['IN-real'])
 assert.equal(result.refs.spreadingOrderId, 'pb-real'); assert.equal(result.payload.receivedById, 'receiver-uid')
 assert.equal(result.operatorId, 'current-uid'); assert.deepEqual(result.payload.rollNos, [])
 assert.equal(result.eventId, prepareCuttingProcessIssue(row, input(row), '2026-10-21 09:00:00.001').eventId)
 assert.notEqual(result.eventId, prepareCuttingProcessIssue(row, { ...input(row), operationId: 'op-two' }, '2026-10-21 09:00:00.001').eventId)
})

test('C01.06: stale quantities, other source, completed bed, foreign warehouse and non-length units cannot issue', () => {
 for (const mutate of [
   (row: CuttingIssueSource) => { row.availableQty = 49 },
   (row: CuttingIssueSource) => { row.order.materialIdentity.materialSku = 'foreign-fabric' },
   (row: CuttingIssueSource) => { row.order.sourceCutOrderIds = ['other-cut'] },
   (row: CuttingIssueSource) => { row.order.status = 'CUT_DONE' },
   (row: CuttingIssueSource) => { row.locations[0].factoryId = 'foreign-factory' },
   (row: CuttingIssueSource) => { row.inbound.inventoryEffect!.unit = '片' },
 ]) { const row = source(); mutate(row); assert.throws(() => prepareCuttingProcessIssue(row, input(row), '2026-10-21 09:00:00.001')) }
 assert.throws(() => prepareCuttingProcessIssue(source(), { ...input(), expectedSource: 'old' }, ''), /CUT_changed/)
 for (const quantity of [0, -1, NaN, Infinity, .001]) assert.throws(() => prepareCuttingProcessIssue(source(), { ...input(), quantity }, ''))
 for (const rollCount of [0, -1, 1.5]) assert.throws(() => prepareCuttingProcessIssue(source(), { ...input(), rollCount }, ''), /CUT_rollCount/)
})

test('C01.06: partial returns cannot exceed the actual issue less already returned; original warehouse and units remain', () => {
 const issue = { ...prepareCuttingProcessIssue(source(), input(), '2026-10-21 09:00:00.001'), eventStatus: '已记录' } as CuttingRuntimeEvent
 const returns = { issue, returnedQty: 10 }, request = { ...input(), quantity: 20, expectedSource: cuttingReturnSourceSnapshot(returns) }
 const result = prepareCuttingProcessReturn(returns, [ref], request, '2026-10-21 10:00:00.001')
 assert.equal(result.payload.sourceIssueEventId, issue.eventId); assert.equal(result.inventoryEffect?.unit, 'yard')
 assert.equal(result.inventoryEffect?.qty, 20); assert.equal(result.payload.sourcePickupSessionId, 'receipt-real')
 assert.throws(() => prepareCuttingProcessReturn(returns, [ref], { ...request, quantity: 41 }, ''), /CUT_returnLimit/)
 assert.throws(() => prepareCuttingProcessReturn(returns, [{ ...ref, warehouseId: 'another-warehouse' }], request, ''), /CUT_changed/)
 assert.throws(() => prepareCuttingProcessReturn(returns, [ref], { ...request, expectedSource: 'old' }, ''), /CUT_changed/)
})

import { validateCuttingMaterialRecordLinks } from '../../src/data/fcs/cutting/cutting-material-record-links.ts'
import type { CuttingStoredRecord } from '../../src/data/fcs/cutting/cutting-record-repository.ts'
const linkedRecords = (): CuttingStoredRecord[] => {
 const actual = source(), issued = { ...prepareCuttingProcessIssue(actual, input(actual), '2026-10-21 09:00:00.001'), eventStatus: '已记录' } as CuttingRuntimeEvent
 const returns = { issue: issued, returnedQty: 0 }, returned = { ...prepareCuttingProcessReturn(returns, [ref], { ...input(), quantity: 20, expectedSource: cuttingReturnSourceSnapshot(returns) }, '2026-10-21 10:00:00.001'), eventStatus: '已记录' } as CuttingRuntimeEvent
 return [actual.inbound, issued, returned].map(value => ({ id: 'cutting-event:' + value.eventId, collection: 'cutting-events', value }))
}
test('C01.06: restored movements keep actual IN/OUT/return links, units and both employee responsibilities', () => {
 const original = linkedRecords(); assert.doesNotThrow(() => validateCuttingMaterialRecordLinks(original))
 for (const mutate of [
   (rows: CuttingStoredRecord[]) => { rows.shift() },
   (rows: CuttingStoredRecord[]) => { (rows[1].value as CuttingRuntimeEvent).payload = { ...(rows[1].value as CuttingRuntimeEvent).payload, sourceInboundEventIds: ['foreign-inbound'] } },
   (rows: CuttingStoredRecord[]) => { (rows[1].value as CuttingRuntimeEvent).payload = { ...(rows[1].value as CuttingRuntimeEvent).payload, receivedById: 'another-receiver' } },
   (rows: CuttingStoredRecord[]) => { const value=rows[2].value as CuttingRuntimeEvent; value.inventoryEffect!.unit='米'; (value.payload as Record<string, unknown>).unit='米' },
   (rows: CuttingStoredRecord[]) => { (rows[2].value as CuttingRuntimeEvent).refs.spreadingOrderId='another-bed' },
 ]) { const rows=structuredClone(original); mutate(rows); assert.throws(() => validateCuttingMaterialRecordLinks(rows), /原批次、单位、数量或交接责任/) }
})
test('C01.06: several restored returns cannot collectively exceed their linked actual issue', () => {
 const rows=linkedRecords(), first=rows[2].value as CuttingRuntimeEvent; first.inventoryEffect!.qty=30; (first.payload as Record<string, unknown>).returnedQty=30
 const second=structuredClone(rows[2]), value=second.value as CuttingRuntimeEvent; value.eventId='cutting-return:another-return'; (value.payload as Record<string, unknown>).returnRecordId=value.eventId; second.id='cutting-event:'+value.eventId; rows.push(second)
 assert.throws(() => validateCuttingMaterialRecordLinks(rows), /原批次、单位、数量或交接责任/)
})
