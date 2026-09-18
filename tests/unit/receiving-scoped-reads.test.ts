import test from 'node:test'
import assert from 'node:assert/strict'
import { captureFactoryReceivingData, restoreFactoryReceivingData, listFactoryReceivingSources, listWaterHandoverReceivingSources, listWarehouseReceivingSources } from '../../src/data/fcs/factory-receiving.ts'
import { findFactoryInternalWarehouseByFactoryAndKind } from '../../src/data/fcs/factory-internal-warehouse.ts'
import { listFactoryInternalWarehouses, getFactoryInternalWarehouseRegistryReference } from '../../src/data/fcs/factory-internal-warehouse-locations.ts'

test('VERIFY-003: scoped reads preserve pending/voided sources and defensive copies', () => {
  const original = captureFactoryReceivingData()
  const data = structuredClone(original)
  data.sources[0].waterBatchId = 'read-check-water-batch'
  data.sources[0].approvedAt = undefined
  data.sources[1].waterBatchId = 'read-check-voided-batch'
  data.sources[1].voidedAt = '2026-09-19 10:00:00'
  restoreFactoryReceivingData(data)
  try {
    const all = listFactoryReceivingSources(undefined, true)
    const water = all.filter(s => s.waterBatchId)
    const warehouse = all.filter(s => s.type !== 'HANDOUT' && s.origin.kind === 'WAREHOUSE')
    assert(water.length >= 2)
    assert(warehouse.length > 0)
    assert.deepEqual(listWaterHandoverReceivingSources(), water)
    assert.deepEqual(listWarehouseReceivingSources(), warehouse)
    const copy = listWaterHandoverReceivingSources()
    copy[0].lines[0].material.name = 'must not leak'
    assert.deepEqual(listWaterHandoverReceivingSources(), water)
    const other = listWarehouseReceivingSources()
    other[0].lines.length = 0
    assert.deepEqual(listWarehouseReceivingSources(), warehouse)
  } finally { restoreFactoryReceivingData(original) }
})

test('VERIFY-003: metadata lookup reflects registry changes and returns independent locations', () => {
  for (const expected of listFactoryInternalWarehouses()) {
    assert.deepEqual(findFactoryInternalWarehouseByFactoryAndKind(expected.factoryId, expected.warehouseKind), expected)
  }
  const record = getFactoryInternalWarehouseRegistryReference()[0]
  const name = record.warehouseName
  try {
    record.warehouseName = 'registry update'
    const copy = findFactoryInternalWarehouseByFactoryAndKind(record.factoryId, record.warehouseKind)!
    assert.equal(copy.warehouseName, 'registry update')
    copy.areaList[0].areaName = 'copy only'
    assert.notEqual(record.areaList[0].areaName, 'copy only')
  } finally { record.warehouseName = name }
  assert.equal(findFactoryInternalWarehouseByFactoryAndKind('missing-factory', 'WAIT_PROCESS'), undefined)
})
