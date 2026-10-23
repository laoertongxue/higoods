import assert from 'node:assert/strict'
import test from 'node:test'
import { listFactoryInternalWarehouses } from '../../src/data/fcs/factory-internal-warehouse-locations.ts'
import { buildInitialWarehouseLayoutSnapshot, updateWarehouseArea, warehouseLayoutSourceKeys, type WarehouseLayoutChangeRecord } from '../../src/pages/process-factory/cutting/warehouse-location-layout-store.ts'
import { layoutRecordId, layoutChangeRecordId, validateWarehouseLayoutStoredRecords, type WarehouseLayoutMigration } from '../../src/data/fcs/cutting/warehouse-layout-record-contract.ts'
import type { CuttingStoredRecord } from '../../src/data/fcs/cutting/cutting-record-repository.ts'

function fixture() {
  const warehouse = listFactoryInternalWarehouses('FACTORY-ONBOARD-0035').find(w => w.warehouseKind === 'WAIT_PROCESS')!
  const before = buildInitialWarehouseLayoutSnapshot(warehouse, 'Original operator')
  const after = updateWarehouseArea(before, { areaId: before.areaList[0].areaId, areaName: 'Actual custom area', updatedBy: 'Warehouse employee' }, [])
  const change: WarehouseLayoutChangeRecord = { changeRecordId: 'original-change-2', factoryId: after.factoryId, warehouseKind: after.warehouseKind, warehouseId: after.warehouseId, beforeVersion: before.layoutVersion, afterVersion: after.layoutVersion, beforeSnapshot: before, afterSnapshot: after, updatedAt: after.updatedAt, updatedBy: after.updatedBy }
  const rows: CuttingStoredRecord[] = [{ id: layoutRecordId(after), collection: 'warehouse-layouts', value: after }, { id: layoutChangeRecordId(change), collection: 'warehouse-layout-changes', value: change }]
  return { warehouse, before, after, change, rows }
}

test('C01.04b: original layout IDs, versions and before/after history remain paired', () => {
  const f = fixture()
  assert.doesNotThrow(() => validateWarehouseLayoutStoredRecords(f.rows))
  const stale = structuredClone(f.rows)
  stale[0].value = f.before
  assert.throws(() => validateWarehouseLayoutStoredRecords(stale), /历史|版本/)
  assert.throws(() => validateWarehouseLayoutStoredRecords([f.rows[1]]), /历史|配置/)
})

test('C01.04b: a second history fact cannot claim the same warehouse version', () => {
  const f = fixture(), other = { ...f.change, changeRecordId: 'other-claim-of-v2' }
  assert.throws(() => validateWarehouseLayoutStoredRecords([...f.rows, { id: layoutChangeRecordId(other), collection: 'warehouse-layout-changes', value: other }]), /历史|版本/)
})

test('C01.04b: unfinished migration requires its exact warehouse targets; malformed or missing targets cannot certify cleanup', () => {
  const f = fixture(), job: WarehouseLayoutMigration = { id: 'warehouse-layout-migration:fixture', phase: 'VERIFIED', factoryId: f.after.factoryId, warehouseKind: f.after.warehouseKind, warehouseId: f.after.warehouseId, sources: [{ key: warehouseLayoutSourceKeys(f.after.factoryId, f.after.warehouseKind, f.after.warehouseId)[0], fingerprint: 'original-source-hash' }], recordIds: f.rows.map(row => row.id), contentFingerprint: 'target-hash' }
  const row: CuttingStoredRecord = { id: job.id, collection: 'warehouse-layout-migrations', value: job }
  assert.doesNotThrow(() => validateWarehouseLayoutStoredRecords([...f.rows, row]))
  assert.throws(() => validateWarehouseLayoutStoredRecords([row]), /迁移|配置/)
  assert.throws(() => validateWarehouseLayoutStoredRecords([...f.rows, { ...row, value: null }]), /迁移|记录/)
  assert.throws(() => validateWarehouseLayoutStoredRecords([...f.rows, { ...row, value: { ...job, sources: [...job.sources, ...job.sources] } }]), /迁移/)
})

test('C01.04b: modified operator and timestamp cannot disagree with the committed after-snapshot', () => {
  const f = fixture(), other = { ...f.change, updatedBy: 'Another employee' }
  assert.throws(() => validateWarehouseLayoutStoredRecords([f.rows[0], { id: layoutChangeRecordId(other), collection: 'warehouse-layout-changes', value: other }]), /历史/)
})
