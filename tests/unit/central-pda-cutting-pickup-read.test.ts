import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductionMaterialPrepSeedStore, serializeProductionMaterialPrepStore, PRODUCTION_MATERIAL_PREP_STORAGE_KEY, listActivePickupNodes, appendPickupSessionFromNode, hydrateProductionMaterialPrepStore, getMaterialPrepOrderProjection, isAccessoryWarehouseScopeLine } from '../../src/data/fcs/cutting/production-material-prep.ts'

function memory() {
  const values = new Map<string, string>([[PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore())]])
  const writes: string[] = []
  return { writes, values, getItem: (key: string) => values.get(key) ?? null, setItem(key: string, value: string) { writes.push(key); values.set(key, value) } }
}

test('C01.04c.1: viewing active pickup nodes does not persist unrelated node snapshots or copy static records', () => {
  const storage = memory(), raw = storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
  const first = listActivePickupNodes(storage), second = listActivePickupNodes(storage)
  assert.ok(first.length > 0)
  assert.deepEqual(second, first)
  assert.deepEqual(storage.writes, [])
  assert.equal(storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY), raw)
})

test('C01.04c.1: explicit receipt retains only its selected node snapshot together with its original items and units', () => {
  const storage = memory(), before = hydrateProductionMaterialPrepStore(storage)
  const nodes = listActivePickupNodes(storage), node = nodes.find(row => row.items.every(item => !item.printReceiptSources && item.materialType === '面料'))!
  assert.ok(node)
  const projection = getMaterialPrepOrderProjection(node.prepOrderId, storage)!
  assert.ok(node.items.every(item => projection.lines.some(line => line.prepLineId === item.prepLineId && !isAccessoryWarehouseScopeLine(line, projection.order))))
  const session = appendPickupSessionFromNode({ pickupNodeId: node.nodeId, pickupNodeVersion: node.version, receiverName: 'Named original warehouse employee', warehouseArea: 'Original receiving area', locationCode: 'Original receiving position', waitProcessLedgerEventId: 'read-contract-actual-node', idempotencyKey: 'read-contract-actual-node' }, storage)
  const after = hydrateProductionMaterialPrepStore(storage)
  assert.equal(session.pickupNodeId, node.nodeId)
  assert.deepEqual(session.pickupNodeSnapshot?.items, node.items)
  const selected = after.pickupNodeSnapshots.find(row => row.nodeId === node.nodeId)
  assert.equal(selected?.version, node.version)
  assert.equal(after.pickupNodeSnapshots.length, before.pickupNodeSnapshots.filter(row => row.nodeId !== node.nodeId).length + 1)
  assert.equal(session.receiverName, 'Named original warehouse employee')
  assert.deepEqual(after.pickupRecords.filter(row => session.pickupRecordIds.includes(row.pickupRecordId)).map(row => row.pickedQty), node.items.map(item => item.currentAvailableQty))
})
