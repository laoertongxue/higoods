import assert from 'node:assert/strict'
import { buildDefaultFactoryInternalWarehouses } from '../src/data/fcs/factory-internal-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import {
  applyWarehouseLayoutSnapshot,
  buildInitialWarehouseLayoutSnapshot,
  createMemoryWarehouseLayoutStorage,
  loadWarehouseLayoutSnapshot,
  saveWarehouseLayoutSnapshot,
} from '../src/pages/process-factory/cutting/warehouse-location-layout-store.ts'
import {
  listStableWarehouseLocationRefs,
  resolveStableWarehouseLocationRef,
} from '../src/pages/process-factory/cutting/warehouse-location-map-model.ts'

const cuttingWarehouses = buildDefaultFactoryInternalWarehouses(mockFactories)
  .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_PROCESS'), '裁床工厂缺少待加工仓')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_HANDOVER'), '裁床工厂缺少待交出仓')

const waitProcess = cuttingWarehouses.find((warehouse) => warehouse.warehouseKind === 'WAIT_PROCESS')
assert(waitProcess, '缺少裁床待加工仓')

const storage = createMemoryWarehouseLayoutStorage()
const initial = buildInitialWarehouseLayoutSnapshot(waitProcess, '系统初始化')
assert.equal(initial.factoryId, waitProcess.factoryId)
assert.equal(initial.layoutVersion, 0)
assert.deepEqual(initial.areaOrder, waitProcess.areaList.map((area) => area.areaId), '首次布局应沿用主数据数组顺序')

const firstArea = waitProcess.areaList[0]
const firstShelf = firstArea.shelfList[0]
const firstLocation = firstShelf.locationList[0]
const secondLocation = firstShelf.locationList[1]
assert(firstLocation && secondLocation, '测试货架至少需要两个库位')

const moved = {
  ...initial,
  locationOrderByShelfId: {
    ...initial.locationOrderByShelfId,
    [firstShelf.shelfId]: [secondLocation.locationId, firstLocation.locationId],
  },
  locationLabelOverrides: {
    [firstLocation.locationId]: {
      locationNo: '面料-A-02',
      locationName: '面料-A-02',
    },
  },
}
const saved = saveWarehouseLayoutSnapshot(moved, 0, storage)
assert.equal(saved.ok, true)
assert.equal(saved.snapshot?.layoutVersion, 1)

const reloaded = loadWarehouseLayoutSnapshot(waitProcess, storage)
assert.equal(reloaded.snapshot.layoutVersion, 1)
const applied = applyWarehouseLayoutSnapshot(waitProcess, reloaded.snapshot)
assert.equal(applied.warehouse.areaList[0].shelfList[0].locationList[0].locationId, secondLocation.locationId)
assert.equal(
  applied.warehouse.areaList[0].shelfList[0].locationList.find((item) => item.locationId === firstLocation.locationId)?.locationNo,
  '面料-A-02',
)

const staleSave = saveWarehouseLayoutSnapshot(moved, 0, storage)
assert.equal(staleSave.ok, false)
assert.equal(staleSave.message, '库位图已被更新，请刷新后重试。')

const refs = listStableWarehouseLocationRefs(waitProcess, reloaded.snapshot)
assert.equal(refs.length, waitProcess.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList)).length)
const stableResolved = resolveStableWarehouseLocationRef(waitProcess, { locationId: firstLocation.locationId }, reloaded.snapshot)
assert.equal(stableResolved?.locationNo, '面料-A-02')
const textResolved = resolveStableWarehouseLocationRef(waitProcess, {
  areaName: firstArea.areaName,
  shelfNo: firstShelf.shelfNo,
  locationNo: '面料-A-02',
}, reloaded.snapshot)
assert.equal(textResolved?.locationId, firstLocation.locationId)
assert.equal(resolveStableWarehouseLocationRef(waitProcess, { areaName: '面料 A 区', locationNo: 'FAB-A-01' }, reloaded.snapshot), null)

const otherWarehouse = {
  ...structuredClone(waitProcess),
  factoryId: `${waitProcess.factoryId}-SECOND`,
  warehouseId: `${waitProcess.warehouseId}-SECOND`,
}
assert.equal(loadWarehouseLayoutSnapshot(otherWarehouse, storage).snapshot.layoutVersion, 0, '不同工厂布局不得互相污染')

console.log('check:cutting-warehouse-location-map passed')
