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
  adjustWarehouseStorageFootprint,
  buildWarehouseLocationMapProjection,
  buildWarehouseStorageFootprint,
  listStableWarehouseLocationRefs,
  resolveStableWarehouseLocationRef,
  toggleWarehouseLocationSelection,
  validateWarehouseLocationSelection,
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

const selectionWarehouse = structuredClone(waitProcess)
const selectionShelf = selectionWarehouse.areaList[0].shelfList[0]
const selectionSeed = selectionShelf.locationList[0]
selectionShelf.locationList = [1, 2, 3].map((index) => ({
  ...selectionSeed,
  locationId: `${selectionSeed.locationId}-SELECT-${index}`,
  locationNo: `${selectionSeed.locationNo}-选${index}`,
  locationName: `${selectionSeed.locationName}-选${index}`,
}))
const selectionSnapshot = buildInitialWarehouseLayoutSnapshot(selectionWarehouse, '选择测试')
const shelfLocationIds = selectionShelf.locationList.map((location) => location.locationId)
const emptyProjection = buildWarehouseLocationMapProjection(selectionWarehouse, selectionSnapshot, [])
assert.equal(
  validateWarehouseLocationSelection(emptyProjection, shelfLocationIds.slice(0, 2)).ok,
  true,
  '同货架连续空闲库位应允许选择',
)
assert.equal(
  validateWarehouseLocationSelection(emptyProjection, [shelfLocationIds[0], shelfLocationIds[2]]).ok,
  false,
  '中间跨一个库位不得选择',
)
const occupiedProjection = buildWarehouseLocationMapProjection(selectionWarehouse, selectionSnapshot, [{
  occupancyId: 'OCC-MIDDLE',
  footprintId: 'FOOTPRINT-MIDDLE',
  locationId: shelfLocationIds[1],
  productionOrderNo: 'PO-TEST',
  objectNo: 'MAT-TEST',
  objectName: '测试面料',
  qty: 100,
  unit: 'yard',
  inboundAt: '2026-07-30 08:00',
  inboundBy: '测试仓管',
}])
assert.equal(
  validateWarehouseLocationSelection(occupiedProjection, [shelfLocationIds[0], shelfLocationIds[1]]).message,
  '所选库位已被占用，请重新选择。',
)

const selectedOne = toggleWarehouseLocationSelection(emptyProjection, [], shelfLocationIds[0])
assert.deepEqual(selectedOne.selectedLocationIds, [shelfLocationIds[0]])
const selectedTwo = toggleWarehouseLocationSelection(emptyProjection, selectedOne.selectedLocationIds, shelfLocationIds[1])
assert.deepEqual(selectedTwo.selectedLocationIds, shelfLocationIds.slice(0, 2))
const selectedThree = toggleWarehouseLocationSelection(emptyProjection, selectedTwo.selectedLocationIds, shelfLocationIds[2])
assert.deepEqual(selectedThree.selectedLocationIds, shelfLocationIds.slice(0, 3))
const middleRemoval = toggleWarehouseLocationSelection(emptyProjection, selectedThree.selectedLocationIds, shelfLocationIds[1])
assert.equal(middleRemoval.ok, false)
assert.equal(middleRemoval.message, '只能从已选范围两端取消库位。')
const endRemoval = toggleWarehouseLocationSelection(emptyProjection, selectedThree.selectedLocationIds, shelfLocationIds[2])
assert.deepEqual(endRemoval.selectedLocationIds, shelfLocationIds.slice(0, 2))

const footprint = buildWarehouseStorageFootprint({
  footprintId: 'pickup-session:TEST',
  sourceType: 'PICKUP_SESSION',
  sourceId: 'pickup-session:TEST',
  locationIds: shelfLocationIds.slice(0, 3),
  totalQty: 300,
  unit: 'yard',
  inboundAt: '2026-07-30 08:00',
  inboundBy: '测试仓管',
})
assert.equal(footprint.totalQty, 300, '多库位总数量只能保存一次')
assert.equal(footprint.locationIds.length, 3)
const adjusted = adjustWarehouseStorageFootprint(footprint, shelfLocationIds.slice(0, 2), 120, emptyProjection)
assert.equal(adjusted.ok, true)
assert.deepEqual(adjusted.footprint?.locationIds, shelfLocationIds.slice(0, 2))
assert.equal(adjusted.footprint?.remainingQty, 120)
const released = adjustWarehouseStorageFootprint(footprint, [], 0, emptyProjection)
assert.equal(released.ok, true)
assert.deepEqual(released.footprint?.locationIds, [])

console.log('check:cutting-warehouse-location-map passed')
