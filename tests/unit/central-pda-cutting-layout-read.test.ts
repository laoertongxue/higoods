import assert from 'node:assert/strict'
import test from 'node:test'
import { listFactoryInternalWarehouses } from '../../src/data/fcs/factory-internal-warehouse-locations.ts'
import { buildInitialWarehouseLayoutSnapshot, getWarehouseLayoutStorageKey, readWarehouseLayoutSnapshot as readLayout } from '../../src/pages/process-factory/cutting/warehouse-location-layout-store.ts'

const warehouse = listFactoryInternalWarehouses('FACTORY-ONBOARD-0035').find(row => row.warehouseKind === 'WAIT_PROCESS')!
const key = getWarehouseLayoutStorageKey(warehouse.factoryId, warehouse.warehouseKind, warehouse.warehouseId)
const legacyKey = `higood:cutting-warehouse-layout:v2:${warehouse.factoryId}:${warehouse.warehouseKind}:${warehouse.warehouseId}`
function storage(entries: Array<[string, string]> = []) {
  const values = new Map(entries), writes: string[] = []
  return { values, writes, getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { writes.push(key); values.set(key, value) },
    removeItem(key: string) { writes.push(key); values.delete(key) } }
}

test('C01.03: first warehouse read uses the actual static locations without persisting a business layout', () => {
  const s = storage(), result = readLayout(warehouse, s)
  assert.deepEqual(result.areaList, warehouse.areaList)
  assert.deepEqual(s.writes, [])
  assert.equal(s.values.size, 0)
})

test('C01.03: current saved layout and its original version remain exact, with no rewrite or cleanup', () => {
  const snapshot = buildInitialWarehouseLayoutSnapshot(warehouse, 'warehouse operator')
  snapshot.layoutVersion = 7
  snapshot.areaList[0].areaName = 'Original custom area'
  const raw = JSON.stringify(snapshot), s = storage([[key, raw], [legacyKey, 'old layout retained']])
  const result = readLayout(warehouse, s), actual = result
  assert.deepEqual(actual, snapshot)
  actual.areaList[0].areaName = 'temporary display change'
  assert.equal(s.values.get(key), raw)
  assert.equal(s.values.get(legacyKey), 'old layout retained')
  assert.deepEqual(s.writes, [])
})

test('C01.03: invalid, foreign and legacy-only layouts are preserved and cannot masquerade as a new empty layout', () => {
  const foreign = buildInitialWarehouseLayoutSnapshot(warehouse, 'warehouse operator')
  foreign.factoryId = 'ANOTHER_FACTORY'
  for (const entries of [[[key, '{invalid']], [[key, JSON.stringify(foreign)]], [[legacyKey, 'old data']], [[legacyKey.replace('warehouse-layout:', 'warehouse-layout-history:'), 'old history']], [[key.replace('warehouse-layout:', 'warehouse-layout-history:'), 'current history']], [[key, '']]] as Array<Array<[string,string]>>) {
    const s = storage(entries), before = [...s.values]
    assert.throws(() => readLayout(warehouse, s))
    assert.deepEqual([...s.values], before)
    assert.deepEqual(s.writes, [])
  }
})

test('C01.03: unavailable storage does not become a fabricated fresh warehouse layout', () => {
  const s = storage()
  s.getItem = () => { throw new Error('storage unavailable') }
  assert.throws(() => readLayout(warehouse, s))
  assert.deepEqual(s.writes, [])
})
