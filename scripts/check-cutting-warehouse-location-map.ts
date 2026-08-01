import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDefaultFactoryInternalWarehouses, listFactoryInternalWarehouses } from '../src/data/fcs/factory-internal-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import {
  applyWarehouseLayoutSnapshot,
  assignWarehouseLocationToShelf,
  appendWarehouseArea,
  appendWarehouseLocation,
  buildInitialWarehouseLayoutSnapshot,
  createMemoryWarehouseLayoutStorage,
  getWarehouseLayoutStorageKey,
  loadWarehouseLayoutSnapshot,
  listWarehouseLayoutChangeRecords,
  resetWarehouseLayoutSnapshot,
  saveWarehouseLayoutSnapshot,
} from '../src/pages/process-factory/cutting/warehouse-location-layout-store.ts'
import {
  adjustWarehouseStorageFootprint,
  buildWarehouseLocationMapProjection,
  buildWarehouseStorageFootprint,
  listStableWarehouseLocationRefs,
  resolveStableWarehouseLocationRef,
  classifyHistoricalWarehouseLocation,
  revalidateWarehouseLocationSelection,
  toggleWarehouseLocationSelection,
  validateWarehouseLocationSelection,
} from '../src/pages/process-factory/cutting/warehouse-location-map-model.ts'
import {
  appendWaitHandoverBaggingEvent,
  appendWaitHandoverInboundEvent,
  buildRuntimeInboundTempBagsFromWaitHandoverEvents,
  buildWaitHandoverLocationOccupancyStates,
  type WaitHandoverRuntimeTicketInput,
} from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
import { renderWarehouseLocationMap } from '../src/components/ui/warehouse-location-map.ts'
import {
  buildCurrentCuttingWarehouseMapProjection,
  buildWaitProcessRuntimeOccupancies,
  renderCuttingWarehouseLocationMapSection,
} from '../src/pages/process-factory/cutting/warehouse-location-map.ts'
import { adjustPickupSessionStorageFootprint } from '../src/data/fcs/cutting/pickup-node-domain.ts'
import type { CuttingRuntimeEvent } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

const cuttingWarehouses = buildDefaultFactoryInternalWarehouses(mockFactories)
  .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_PROCESS'), '裁床工厂缺少待加工仓')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_HANDOVER'), '裁床工厂缺少待交出仓')

const pdaWaitProcessSource = readFileSync(new URL('../src/pages/pda-warehouse-wait-process.ts', import.meta.url), 'utf8')
const pdaInboundSource = readFileSync(new URL('../src/pages/pda-cutting-inbound.ts', import.meta.url), 'utf8')
const pdaHandoverSource = readFileSync(new URL('../src/pages/pda-cutting-handover.ts', import.meta.url), 'utf8')
const warehouseHubSource = readFileSync(new URL('../src/pages/process-factory/cutting/warehouse-hub.ts', import.meta.url), 'utf8')
const warehouseMapSource = readFileSync(new URL('../src/pages/process-factory/cutting/warehouse-location-map.ts', import.meta.url), 'utf8')
const fcsHandlersSource = readFileSync(new URL('../src/main-handlers/fcs-handlers.ts', import.meta.url), 'utf8')
assert.doesNotMatch(pdaWaitProcessSource, /CUTTING_RECEIVE_LOCATIONS/, 'PDA 不得保留第二套硬编码裁床库位')
assert.doesNotMatch(`${pdaWaitProcessSource}\n${pdaInboundSource}\n${pdaHandoverSource}\n${warehouseHubSource}`, /FAB-A-0|CUT-A-01|SP-RETURN-0/, '裁床现场页不得继续展示旧硬编码库位')
assert.match(pdaWaitProcessSource, /调整剩余存放范围/)
assert.match(pdaWaitProcessSource, /}, syncCuttingPickupSessionRuntimeFacts\)/, '领料必须通过原子运行时入口写共享事件与本地会话')
assert.match(pdaInboundSource, /data-pda-inbound-location-map/)
assert.match(pdaInboundSource, /selectionLimit: 1/)
assert.match(pdaInboundSource, /不属于当前工厂/)
assert.match(pdaHandoverSource, /locationRef:/, '特殊工艺回仓必须写稳定库位路径')
assert.match(warehouseHubSource, /data-wait-handover-location-map/, 'Web 中转袋入仓必须提供待交出仓单选库位图')
assert.match(warehouseHubSource, /dataset\.waitHandoverWebAction/, '待交出仓真实页面处理器必须承接顶部 Web 动作按钮')
assert.match(fcsHandlersSource, /handleCraftCuttingWaitHandoverEvent\(target\)/, '待交出仓真实页面处理器必须接入主处理链')
assert.doesNotMatch(fcsHandlersSource, /handleCraftCuttingWaitHandoverWebActionsEvent/, '不得保留旧文本弹窗处理器')
assert.match(warehouseMapSource, /open-add-area/, '普通查看模式缺少新增库区入口')
assert.match(warehouseMapSource, /open-add-location/, '普通查看模式缺少新增库位入口')
assert.match(warehouseMapSource, /data-cutting-warehouse-modal/, '新增库区和库位必须使用独立弹窗')
assert.match(fcsHandlersSource, /data-cutting-warehouse-modal/, '新增弹窗事件必须接入裁床库位图处理链')
const viewSectionHtml = renderCuttingWarehouseLocationMapSection('WAIT_PROCESS', 'VIEW')
const layoutSectionHtml = renderCuttingWarehouseLocationMapSection('WAIT_PROCESS', 'LAYOUT')
assert.match(viewSectionHtml, /data-warehouse-map-action="open-add-area"[^>]+data-warehouse-kind="WAIT_PROCESS"[^>]+data-warehouse-id=/, '新增库区入口必须绑定当前仓库')
assert.match(viewSectionHtml, /data-warehouse-map-action="open-add-location"[^>]+data-warehouse-kind="WAIT_PROCESS"[^>]+data-warehouse-id=/, '新增库位入口必须绑定当前仓库')
assert.doesNotMatch(layoutSectionHtml, /open-add-area|open-add-location/, '编排模式不得显示新增结构入口')

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
  areaLabelOverrides: {
    [firstArea.areaId]: { areaName: '面料暂存一区' },
  },
  shelfLabelOverrides: {
    [firstShelf.shelfId]: { shelfNo: '货架 A-01' },
  },
}
const saved = saveWarehouseLayoutSnapshot(moved, 0, storage)
assert.equal(saved.ok, true)
assert.equal(saved.snapshot?.layoutVersion, 1)
const layoutHistory = listWarehouseLayoutChangeRecords(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId, storage)
assert.equal(layoutHistory.length, 1)
assert.equal(layoutHistory[0].beforeVersion, 0)
assert.equal(layoutHistory[0].afterVersion, 1)
assert.equal(layoutHistory[0].updatedBy, '系统初始化')
const siblingWarehouse = { ...structuredClone(waitProcess), warehouseId: `${waitProcess.warehouseId}-SIBLING`, warehouseName: '同类型备用待加工仓' }
const siblingSnapshot = buildInitialWarehouseLayoutSnapshot(siblingWarehouse, '备用仓初始化')
assert.equal(saveWarehouseLayoutSnapshot(siblingSnapshot, 0, storage).ok, true)
assert.equal(loadWarehouseLayoutSnapshot(waitProcess, storage).snapshot.warehouseId, waitProcess.warehouseId, '同工厂同类型多仓布局不得互相覆盖')
assert.equal(loadWarehouseLayoutSnapshot(siblingWarehouse, storage).snapshot.warehouseId, siblingWarehouse.warehouseId, '备用仓必须读取独立布局快照')

const reloaded = loadWarehouseLayoutSnapshot(waitProcess, storage)
assert.equal(reloaded.snapshot.layoutVersion, 1)
const applied = applyWarehouseLayoutSnapshot(waitProcess, reloaded.snapshot)
assert.equal(applied.warehouse.areaList[0].shelfList[0].locationList[0].locationId, secondLocation.locationId)
assert.equal(
  applied.warehouse.areaList[0].shelfList[0].locationList.find((item) => item.locationId === firstLocation.locationId)?.locationNo,
  '面料-A-02',
)
const anotherShelf = waitProcess.areaList.flatMap((area) => area.shelfList).find((shelf) => shelf.shelfId !== firstShelf.shelfId)
assert(anotherShelf, '重复归属测试需要第二个货架')
const duplicateAssignmentSnapshot = {
  ...structuredClone(initial),
  locationOrderByShelfId: {
    ...structuredClone(initial.locationOrderByShelfId),
    [firstShelf.shelfId]: [firstLocation.locationId],
    [anotherShelf.shelfId]: [firstLocation.locationId],
  },
}
const duplicateAssignmentApplied = applyWarehouseLayoutSnapshot(waitProcess, duplicateAssignmentSnapshot)
assert.equal(
  duplicateAssignmentApplied.warehouse.areaList.flatMap((area) => area.shelfList)
    .flatMap((shelf) => shelf.locationList)
    .filter((location) => location.locationId === firstLocation.locationId).length,
  1,
  '同一稳定库位不得被重复编排到多个货架',
)
assert.equal(applied.warehouse.areaList[0].areaName, '面料暂存一区')
assert.equal(applied.warehouse.areaList[0].shelfList[0].shelfNo, '货架 A-01')

const addedArea = {
  areaId: 'AREA-ADDED-CHECK',
  areaName: '演示扩展区',
  shelfList: [{
    shelfId: 'SHELF-ADDED-CHECK',
    shelfNo: '演示扩展区-01',
    shelfName: '演示扩展区-01',
    locationList: [{
      locationId: 'LOC-ADDED-CHECK-01',
      locationNo: '演示扩展区-01-01',
      locationName: '演示扩展区-01-01',
      status: 'AVAILABLE' as const,
      remark: '',
    }],
    status: 'AVAILABLE' as const,
    remark: '',
  }],
  status: 'AVAILABLE' as const,
  remark: '',
}
const addedAreaSnapshot = appendWarehouseArea(initial, addedArea)
assert.throws(
  () => appendWarehouseArea(initial, {
    ...structuredClone(addedArea),
    areaId: 'AREA-DUPLICATE-NESTED',
    shelfList: [structuredClone(addedArea.shelfList[0]), structuredClone(addedArea.shelfList[0])],
  }),
  /重复(货架|库位)/,
  '新增库区内部重复货架 ID 必须在保存前阻断',
)
assert.throws(
  () => appendWarehouseArea(initial, {
    ...structuredClone(addedArea),
    areaId: 'AREA-DUPLICATE-LOCATION',
    shelfList: [{
      ...structuredClone(addedArea.shelfList[0]),
      shelfId: 'SHELF-DUPLICATE-LOCATION',
      locationList: [structuredClone(addedArea.shelfList[0].locationList[0]), structuredClone(addedArea.shelfList[0].locationList[0])],
    }],
  }),
  /重复库位/,
  '新增库区内部重复库位 ID 必须在保存前阻断',
)
const addedAreaInputBeforeLocation = structuredClone(addedAreaSnapshot)
const nestedLocationSnapshot = appendWarehouseLocation(
  addedAreaSnapshot,
  addedArea.areaId,
  addedArea.shelfList[0].shelfId,
  {
    locationId: 'LOC-ADDED-CHECK-NESTED-02',
    locationNo: '演示扩展区-01-02',
    locationName: '演示扩展区-01-02',
    status: 'AVAILABLE',
    remark: '',
  },
)
assert.deepEqual(addedAreaSnapshot, addedAreaInputBeforeLocation, '新增库位纯函数不得修改输入快照')
assert.equal(
  nestedLocationSnapshot.addedAreaList?.[0]?.shelfList[0]?.locationList.some((location) => location.locationId === 'LOC-ADDED-CHECK-NESTED-02'),
  true,
  '新增到自定义库区货架的库位必须写入返回快照',
)
const addedLocationSnapshot = appendWarehouseLocation(
  addedAreaSnapshot,
  firstArea.areaId,
  firstShelf.shelfId,
  {
    locationId: 'LOC-ADDED-CHECK-02',
    locationNo: 'A-01-03',
    locationName: 'A-01-03',
    status: 'AVAILABLE',
    remark: '',
  },
)
const addedApplied = applyWarehouseLayoutSnapshot(waitProcess, addedLocationSnapshot)
assert.equal(addedApplied.warehouse.areaList.some((area) => area.areaId === addedArea.areaId), true, '新增库区应进入地图投影')
assert.equal(
  addedApplied.warehouse.areaList
    .flatMap((area) => area.shelfList)
    .flatMap((shelf) => shelf.locationList)
    .some((location) => location.locationId === 'LOC-ADDED-CHECK-02'),
  true,
  '新增到既有货架的库位应进入地图投影',
)
const duplicateAddedStructure = applyWarehouseLayoutSnapshot(waitProcess, {
  ...initial,
  addedAreaList: [structuredClone(firstArea)],
})
assert.match(duplicateAddedStructure.warningMessages.join('；'), /ID 已存在/, '重复新增结构必须显示 warning')

const unassignedSnapshot = {
  ...initial,
  unassignedLocationIds: [firstLocation.locationId],
}
const unassignedApplied = applyWarehouseLayoutSnapshot(waitProcess, unassignedSnapshot)
assert.equal(
  unassignedApplied.warehouse.areaList
    .flatMap((area) => area.shelfList)
    .flatMap((shelf) => shelf.locationList)
    .some((location) => location.locationId === firstLocation.locationId),
  false,
  '未编排库位不应继续显示在原货架',
)
const assignedSnapshot = assignWarehouseLocationToShelf(
  unassignedSnapshot,
  firstLocation.locationId,
  firstShelf.shelfId,
)
assert.equal(assignedSnapshot.unassignedLocationIds.includes(firstLocation.locationId), false)
assert.equal(
  assignedSnapshot.locationOrderByShelfId[firstShelf.shelfId].at(-1),
  firstLocation.locationId,
  '补齐货架归属后应追加到目标货架',
)

const staleSave = saveWarehouseLayoutSnapshot(moved, 0, storage)
assert.equal(staleSave.ok, false)
assert.equal(staleSave.message, '库位图已被更新，请刷新后重试。')

const damagedStorage = createMemoryWarehouseLayoutStorage()
damagedStorage.setItem(
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId),
  '{damaged',
)
assert.doesNotThrow(() => {
  const damagedLoad = loadWarehouseLayoutSnapshot(waitProcess, damagedStorage)
  assert.match(damagedLoad.warningMessage, /无法恢复/)
  const damagedSave = saveWarehouseLayoutSnapshot(
    damagedLoad.snapshot,
    damagedLoad.snapshot.layoutVersion,
    damagedStorage,
  )
  assert.equal(damagedSave.ok, false, '损坏的历史编排不得导致保存抛异常')
})
const resetSnapshot = resetWarehouseLayoutSnapshot(waitProcess, '恢复测试', damagedStorage)
assert.equal(resetSnapshot.snapshot?.layoutVersion, 1, '损坏编排应可通过明确恢复动作重建')
assert.equal(loadWarehouseLayoutSnapshot(waitProcess, damagedStorage).warningMessage, '')
const staleReset = resetWarehouseLayoutSnapshot(waitProcess, '过期页面', damagedStorage)
assert.equal(staleReset.ok, false, '过期页面不得覆盖已恢复的有效编排')
const malformedStructureStorage = createMemoryWarehouseLayoutStorage()
malformedStructureStorage.setItem(
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId),
  JSON.stringify({ ...initial, addedAreaList: [{ areaId: 'BROKEN' }] }),
)
const malformedStructureLoad = loadWarehouseLayoutSnapshot(waitProcess, malformedStructureStorage)
assert.match(malformedStructureLoad.warningMessage, /无法恢复/, '不完整新增结构必须回退并提示')
const malformedLocationStorage = createMemoryWarehouseLayoutStorage()
malformedLocationStorage.setItem(
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId),
  JSON.stringify({ ...initial, addedLocationListByShelfId: { [firstShelf.shelfId]: [null] } }),
)
const malformedLocationLoad = loadWarehouseLayoutSnapshot(waitProcess, malformedLocationStorage)
assert.match(malformedLocationLoad.warningMessage, /无法恢复/, '损坏的新增库位元素必须回退并提示')
assert.doesNotThrow(() => applyWarehouseLayoutSnapshot(waitProcess, malformedLocationLoad.snapshot))
assert.equal(
  resetWarehouseLayoutSnapshot(waitProcess, '结构恢复测试', malformedLocationStorage).ok,
  true,
  '可解析但结构不兼容的快照也必须支持明确恢复',
)
const malformedOrderStorage = createMemoryWarehouseLayoutStorage()
malformedOrderStorage.setItem(
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId),
  JSON.stringify({ ...initial, locationOrderByShelfId: { [firstShelf.shelfId]: { bad: true } } }),
)
const malformedOrderLoad = loadWarehouseLayoutSnapshot(waitProcess, malformedOrderStorage)
assert.match(malformedOrderLoad.warningMessage, /无法恢复/, '损坏的顺序容器必须回退并提示')

const refs = listStableWarehouseLocationRefs(waitProcess, reloaded.snapshot)
assert.equal(refs.length, waitProcess.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList)).length)
const stableResolved = resolveStableWarehouseLocationRef(waitProcess, { locationId: firstLocation.locationId }, reloaded.snapshot)
assert.equal(stableResolved?.locationNo, '面料-A-02')
const textResolved = resolveStableWarehouseLocationRef(waitProcess, {
  areaName: '面料暂存一区',
  shelfNo: '货架 A-01',
  locationNo: '面料-A-02',
}, reloaded.snapshot)
assert.equal(textResolved?.locationId, firstLocation.locationId)
assert.equal(resolveStableWarehouseLocationRef(waitProcess, { areaName: '面料 A 区', locationNo: 'FAB-A-01' }, reloaded.snapshot), null)
assert.equal(
  classifyHistoricalWarehouseLocation(waitProcess, { locationNo: firstLocation.locationNo }, initial).status,
  'UNRESOLVED',
  '仅有库位编号时不得跨库区猜测归位',
)
assert.equal(
  classifyHistoricalWarehouseLocation(waitProcess, { locationNo: '不存在的历史库位' }, initial).status,
  'UNRESOLVED',
)

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
   styleName: '测试款式',
   styleImageUrl: '/pants-sample.jpg',
   materialImageUrl: '/materials/fabric-main.jpg',
   rollDetails: [{ rollNo: 'ROLL-TEST-001', yard: 100, meter: 91.44, locationNo: selectionSeed.locationNo }],
   ticketDetails: [{ feiTicketNo: 'FEI-TEST-001', partName: '前幅', size: 'M', pieceQty: 20 }],
  }])
const stoppedWarehouse = structuredClone(selectionWarehouse)
stoppedWarehouse.areaList[0].shelfList[0].locationList[0].status = 'STOPPED'
const stoppedSnapshot = buildInitialWarehouseLayoutSnapshot(stoppedWarehouse, '停用测试')
const stoppedOccupancyProjection = buildWarehouseLocationMapProjection(stoppedWarehouse, stoppedSnapshot, [{
  ...occupiedProjection.areas[0].shelves[0].locations[1].occupancies[0],
  occupancyId: 'OCC-STOPPED',
  locationId: shelfLocationIds[0],
}])
assert.equal(
  stoppedOccupancyProjection.unlocatedOccupancies.some((occupancy) => occupancy.occupancyId === 'OCC-STOPPED'),
  true,
  '停用库位的库存事实必须进入待确认区域，不能静默消失',
)
const firstOccupancy = occupiedProjection.areas[0].shelves[0].locations[1].occupancies[0]
const singleOrderProjection = buildWarehouseLocationMapProjection(selectionWarehouse, selectionSnapshot, [
  firstOccupancy,
  { ...firstOccupancy, occupancyId: 'OCC-CONFLICT', productionOrderNo: 'PO-OTHER' },
])
assert.equal(
  singleOrderProjection.areas[0].shelves[0].locations[1].occupancies.length,
  2,
  '同一库位出现多生产单冲突时必须保留全部事实供主管核对',
)
assert.equal(
  singleOrderProjection.areas[0].shelves[0].locations[1].businessStatus,
  'OCCUPIED',
  '多生产单冲突库位必须保持占用并禁止再次选择',
)
assert.equal(
  singleOrderProjection.unlocatedOccupancies.filter((occupancy) =>
    occupancy.locationId === shelfLocationIds[1]).length,
  2,
  '冲突库位的全部生产单占用必须进入待确认区域',
)
const duplicatedFootprintProjection = buildWarehouseLocationMapProjection(selectionWarehouse, selectionSnapshot, [
  { ...firstOccupancy, locationId: shelfLocationIds[0], qty: 100 },
  { ...firstOccupancy, occupancyId: 'OCC-SAME-FOOTPRINT-2', locationId: shelfLocationIds[1], qty: 100 },
])
const duplicatedFootprintHtml = renderWarehouseLocationMap({
  projection: duplicatedFootprintProjection,
  mode: 'VIEW',
  factoryName: '中央裁床',
})
assert.match(duplicatedFootprintHtml, /2 个库位/, '同一占用范围跨库位时应按唯一库位计数')
assert.match(duplicatedFootprintHtml, /库存口径 100 yard/, '同一占用范围跨库位时总量只能计算一次')
assert.doesNotMatch(duplicatedFootprintHtml, /库存口径 200 yard/, '生产单摘要不得重复累计同一占用范围')
const mixedUnitProjection = buildWarehouseLocationMapProjection(selectionWarehouse, selectionSnapshot, [
  { ...firstOccupancy, locationId: shelfLocationIds[0], qty: 100 },
  { ...firstOccupancy, occupancyId: 'OCC-METER', footprintId: 'FOOTPRINT-METER', locationId: shelfLocationIds[2], qty: 50, unit: '米' },
])
const mixedUnitHtml = renderWarehouseLocationMap({ projection: mixedUnitProjection, mode: 'VIEW', factoryName: '中央裁床' })
assert.match(mixedUnitHtml, /库存口径 100 yard、50 米/, '不同单位必须分别汇总，禁止直接相加')
const mapHtml = renderWarehouseLocationMap({
  projection: occupiedProjection,
  mode: 'VIEW',
  factoryName: '中央裁床',
  openLocationId: shelfLocationIds[1],
})
assert.match(mapHtml, /data-warehouse-map-root/)
assert.match(mapHtml, /data-location-id=/)
assert.match(mapHtml, /空闲/)
assert.match(mapHtml, /占用/)
assert.match(mapHtml, /min-h-11/)
assert.match(mapHtml, /min-w-11/)
assert.match(mapHtml, /overflow-x-auto/)
assert.doesNotMatch(mapHtml, /库位组/)
assert.match(mapHtml, /库区：/)
assert.match(mapHtml, /PO-TEST/)
assert.match(mapHtml, /测试面料/)
assert.match(mapHtml, /入仓时间：2026-07-30 08:00/)
assert.match(mapHtml, /data-warehouse-map-action="occupancy-page"/)
assert.doesNotMatch(mapHtml, /部分占用|预留/)
assert.match(mapHtml, /生产单占用摘要/, '库位图必须展示生产单级占用摘要')
assert.match(mapHtml, /物料卷明细|袋内菲票明细/, '占用详情必须包含业务明细入口')
assert.match(mapHtml, /款式图/, '占用详情必须支持款式图')
assert.match(mapHtml, /物料图/, '待加工仓详情必须支持物料图')
const detailPaginationProjection = structuredClone(occupiedProjection)
const detailPaginationCell = detailPaginationProjection.areas[0].shelves[0].locations[1]
detailPaginationCell.occupancies[0].rollDetails = Array.from({ length: 12 }, (_, index) => ({
  rollNo: `ROLL-PAGE-${String(index + 1).padStart(3, '0')}`,
  yard: 10,
  meter: 9.14,
  locationNo: detailPaginationCell.locationNo,
}))
const originalWindow = globalThis.window
try {
  ;(globalThis as typeof globalThis & { window: Window }).window = {
    location: { search: `?occupancyDetailId=${detailPaginationCell.occupancies[0].occupancyId}&occupancyDetailPage=2` },
  } as unknown as Window
  const detailPageTwoHtml = renderWarehouseLocationMap({
    projection: detailPaginationProjection,
    mode: 'VIEW',
    factoryName: '中央裁床',
    openLocationId: detailPaginationCell.locationId,
  })
  assert.match(detailPageTwoHtml, /ROLL-PAGE-011/, '卷明细第二页必须展示第 11 条数据')
  assert.doesNotMatch(detailPageTwoHtml, /ROLL-PAGE-001/, '卷明细第二页不得重复展示第一页数据')
  assert.match(detailPageTwoHtml, /第 2 \/ 2 页 · 每页 10 条 · 共 12 条/, '卷明细分页必须显示第二页口径')
} finally {
  ;(globalThis as typeof globalThis & { window: Window }).window = originalWindow
}
const layoutMapHtml = renderWarehouseLocationMap({
  projection: occupiedProjection,
  mode: 'LAYOUT',
  factoryName: '中央裁床',
})
assert.match(layoutMapHtml, /move-shelf-up/)
assert.match(layoutMapHtml, /move-shelf-down/)
assert.match(layoutMapHtml, /rename-area/)
assert.match(layoutMapHtml, /rename-shelf/)
const selectMapHtml = renderWarehouseLocationMap({
  projection: occupiedProjection,
  mode: 'SELECT',
  factoryName: '中央裁床',
})
assert.doesNotMatch(selectMapHtml, /生产单占用摘要/, '一线选位模式不得展示管理型生产单摘要')
assert.equal(
  validateWarehouseLocationSelection(occupiedProjection, [shelfLocationIds[0], shelfLocationIds[1]]).message,
  '所选库位已被占用，请重新选择。',
)

for (const kind of ['WAIT_PROCESS', 'WAIT_HANDOVER'] as const) {
  const factOnlyMap = buildCurrentCuttingWarehouseMapProjection(kind)
  const currentMap = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: true })
  assert(currentMap, `${kind} 必须生成当前库位图投影`)
  assert(factOnlyMap, `${kind} 必须生成事实占用投影`)
  assert.equal(
    factOnlyMap.projection.areas.flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
      .some((cell) => cell.occupancies.some((occupancy) => occupancy.occupancyId.includes('-demo:'))),
    false,
    `${kind} 的共享执行投影不得注入演示占用`,
  )
  const occupiedCells = currentMap.projection.areas
    .flatMap((area) => area.shelves.flatMap((shelf) => shelf.locations))
    .filter((cell) => cell.businessStatus === 'OCCUPIED')
  assert(occupiedCells.length > 0, `${kind} 必须包含非空闲演示占用`)
  assert(occupiedCells.every((cell) => cell.occupancies.every((occupancy) => occupancy.productionOrderNo)), `${kind} 占用必须标准到生产单`)
  const currentMapHtml = renderWarehouseLocationMap({
    projection: currentMap.projection,
    mode: 'VIEW',
    factoryName: currentMap.warehouse.factoryName,
    openLocationId: occupiedCells[0].locationId,
  })
  if (kind === 'WAIT_PROCESS') {
    assert.match(currentMapHtml, /物料图|物料图待补充/, '待加工仓必须提供物料图或明确缺图提示')
    assert.match(currentMapHtml, /物料卷明细|演示卷明细|卷明细待补充/, '待加工仓必须提供卷明细或明确缺失提示')
  } else {
    assert(occupiedCells.some((cell) => cell.occupancies.some((occupancy) => occupancy.packed && occupancy.ticketNos?.length)), '待交出仓必须保留已装菲票袋事实')
    assert.match(currentMapHtml, /袋内菲票明细|袋内菲票明细待补充/, '待交出仓必须提供菲票明细或明确缺失提示')
  }
}

const selectedOne = toggleWarehouseLocationSelection(emptyProjection, [], shelfLocationIds[0])
assert.deepEqual(selectedOne.selectedLocationIds, [shelfLocationIds[0]])
const selectedTwo = toggleWarehouseLocationSelection(emptyProjection, selectedOne.selectedLocationIds, shelfLocationIds[1])
assert.deepEqual(selectedTwo.selectedLocationIds, shelfLocationIds.slice(0, 2))
const selectionHtml = renderWarehouseLocationMap({
  projection: emptyProjection,
  mode: 'SELECT',
  factoryName: '中央裁床',
  selectedLocationIds: shelfLocationIds.slice(0, 2),
})
assert.match(selectionHtml, /已选 2 个/)
assert.match(selectionHtml, new RegExp(`${selectionShelf.locationList[0].locationNo} 至 ${selectionShelf.locationList[1].locationNo}`))
assert.match(selectionHtml, /data-warehouse-map-action="clear-selection"/)
const selectedThree = toggleWarehouseLocationSelection(emptyProjection, selectedTwo.selectedLocationIds, shelfLocationIds[2])
assert.deepEqual(selectedThree.selectedLocationIds, shelfLocationIds.slice(0, 3))
const middleRemoval = toggleWarehouseLocationSelection(emptyProjection, selectedThree.selectedLocationIds, shelfLocationIds[1])
assert.equal(middleRemoval.ok, false)
assert.equal(middleRemoval.message, '只能从已选范围两端取消库位。')
const endRemoval = toggleWarehouseLocationSelection(emptyProjection, selectedThree.selectedLocationIds, shelfLocationIds[2])
assert.deepEqual(endRemoval.selectedLocationIds, shelfLocationIds.slice(0, 2))
const conflictProjection = structuredClone(emptyProjection)
const conflictedCell = conflictProjection.areas.flatMap((area) => area.shelves)
  .flatMap((shelf) => shelf.locations)
  .find((location) => location.locationId === shelfLocationIds[2])
assert.ok(conflictedCell)
conflictedCell.businessStatus = 'OCCUPIED'
const revalidatedSelection = revalidateWarehouseLocationSelection(conflictProjection, selectedThree.selectedLocationIds)
assert.equal(revalidatedSelection.ok, false)
assert.match(revalidatedSelection.message, new RegExp(conflictedCell.locationNo))
assert.deepEqual(revalidatedSelection.selectedLocationIds, shelfLocationIds.slice(0, 2))

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

const footprintRefs = listStableWarehouseLocationRefs(selectionWarehouse, selectionSnapshot).slice(0, 3)
const runtimePickupEvent: CuttingRuntimeEvent = {
  eventId: 'EVENT-PICKUP-FOOTPRINT',
  eventNo: '领料-001',
  eventType: '中转仓领料',
  eventSource: 'PDA',
  eventStatus: '已同步',
  occurredAt: '2026-07-30 08:00',
  createdAt: '2026-07-30 08:00',
  operatorId: 'U-001',
  operatorName: '测试仓管',
  operatorRole: 'PDA 仓管',
  refs: { productionOrderNo: 'PO-FOOTPRINT', handoverRecordId: 'SESSION-001:LINE-001' },
  material: { materialSku: 'MAT-FOOTPRINT', materialName: '多库位面料', materialColor: '黑色', unit: 'yard' },
  inventoryEffect: {
    inventoryScope: '裁床待加工仓',
    direction: 'IN',
    qty: 300,
    unit: 'yard',
    rollCount: 9,
    toWarehouseArea: footprintRefs[0].areaName,
    toLocationCode: footprintRefs[0].locationNo,
  },
  payload: {
    pickupSessionId: 'SESSION-001',
    prepLineId: 'LINE-001',
    pickupQty: 300,
    rollCount: 9,
    locationRefs: footprintRefs,
    storageFootprint: footprint,
    pickupBy: '测试仓管',
    pickupAt: '2026-07-30 08:00',
  },
}
const runtimeFootprintOccupancies = buildWaitProcessRuntimeOccupancies(
  selectionWarehouse,
  selectionSnapshot,
  [runtimePickupEvent],
)
assert.equal(runtimeFootprintOccupancies.length, 3, '多库位领料应占用全部连续库位')
assert(runtimeFootprintOccupancies.every((occupancy) => occupancy.qty === 300), '每个关联库位详情都应显示同一批物料总量')
assert(runtimeFootprintOccupancies.every((occupancy) => occupancy.footprintLocationNos?.length === 3))
assert.equal(runtimeFootprintOccupancies[0].rollDetails?.length, 9, '演示卷行必须使用运行时事实中的 rollCount')
const afterIssueOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [
  runtimePickupEvent,
  {
    ...structuredClone(runtimePickupEvent),
    eventId: 'EVENT-PROCESS-ISSUE',
    eventType: '待加工仓加工领料',
    occurredAt: '2026-07-30 08:20',
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'OUT', qty: 100, unit: 'yard' },
    payload: {
      issueRecordId: 'ISSUE-001',
      materialSku: 'MAT-FOOTPRINT',
      issuedQty: 100,
      locationRef: footprintRefs[0],
    },
  },
])
assert(afterIssueOccupancies.every((occupancy) => occupancy.qty === 200), '加工领料 OUT 后必须扣减当前待加工仓占用量')
const adjustedRuntimeOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [
  runtimePickupEvent,
  {
    ...structuredClone(runtimePickupEvent),
    eventId: 'EVENT-PICKUP-FOOTPRINT-ADJUST',
    eventType: '待加工仓位置调整',
    occurredAt: '2026-07-30 08:30',
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'ADJUST', qty: 120, unit: 'yard' },
    payload: { pickupSessionId: 'SESSION-001', locationRefs: footprintRefs.slice(0, 2), remainingByUnit: [{ unit: 'yard', remainingQty: 120 }] },
  },
])
assert.equal(adjustedRuntimeOccupancies.length, 2, '位置调整后只保留最新库位范围')
assert(adjustedRuntimeOccupancies.every((occupancy) => occupancy.qty === 120 && occupancy.remainingQty === 120), '位置调整后必须显示当前剩余量')
const sharedSessionBase = {
  ...structuredClone(runtimePickupEvent),
  payload: { ...structuredClone(runtimePickupEvent.payload as Record<string, unknown>), locationRefs: [footprintRefs[0]] },
}
const sharedSessionOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [
  {
    ...structuredClone(sharedSessionBase),
    eventId: 'EVENT-SHARED-LINE-60',
    material: { ...sharedSessionBase.material, materialSku: 'MAT-60' },
    inventoryEffect: { ...sharedSessionBase.inventoryEffect!, qty: 60 },
    payload: { ...(sharedSessionBase.payload as Record<string, unknown>), prepLineId: 'LINE-60', pickupQty: 60 },
  },
  {
    ...structuredClone(sharedSessionBase),
    eventId: 'EVENT-SHARED-LINE-40',
    material: { ...sharedSessionBase.material, materialSku: 'MAT-40' },
    inventoryEffect: { ...sharedSessionBase.inventoryEffect!, qty: 40 },
    payload: { ...(sharedSessionBase.payload as Record<string, unknown>), prepLineId: 'LINE-40', pickupQty: 40 },
  },
  {
    ...structuredClone(runtimePickupEvent),
    eventId: 'EVENT-SHARED-ADJUST',
    eventType: '待加工仓位置调整',
    occurredAt: '2026-07-30 08:40',
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'ADJUST', qty: 50, unit: 'yard' },
    payload: { pickupSessionId: 'SESSION-001', locationRefs: [footprintRefs[0]], remainingByUnit: [{ unit: 'yard', remainingQty: 50 }] },
  },
])
assert.deepEqual(sharedSessionOccupancies.map((item) => item.qty).sort((a, b) => a - b), [20, 30], '同会话同单位多物料行必须按原数量比例分配剩余量')
const microSessionEvents: CuttingRuntimeEvent[] = Array.from({ length: 4 }, (_, index) => ({
  ...structuredClone(runtimePickupEvent),
  eventId: `EVENT-MICRO-LINE-${index + 1}`,
  refs: { ...runtimePickupEvent.refs, handoverRecordId: `SESSION-MICRO:LINE-${index + 1}` },
  material: { ...runtimePickupEvent.material, materialSku: `MAT-MICRO-${index + 1}` },
  inventoryEffect: { ...runtimePickupEvent.inventoryEffect!, qty: 1 },
  payload: { ...(runtimePickupEvent.payload as Record<string, unknown>), pickupSessionId: 'SESSION-MICRO', prepLineId: `LINE-${index + 1}`, pickupQty: 1, locationRefs: [footprintRefs[0]] },
}))
microSessionEvents.push({
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-MICRO-ADJUST',
  eventType: '待加工仓位置调整',
  occurredAt: '2026-07-30 08:50',
  inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'ADJUST', qty: 0.02, unit: 'yard' },
  payload: { pickupSessionId: 'SESSION-MICRO', locationRefs: [footprintRefs[0]], remainingByUnit: [{ unit: 'yard', remainingQty: 0.02 }] },
})
const microOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, microSessionEvents)
assert.equal(microOccupancies.reduce((sum, item) => sum + item.qty, 0), 0.02, '极小剩余量分配不得因四舍五入多算')
assert(microOccupancies.every((item) => item.qty >= 0), '极小剩余量分配不得产生负数')
const foreignAdjustmentOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [
  runtimePickupEvent,
  {
    ...structuredClone(runtimePickupEvent),
    eventId: 'EVENT-FOREIGN-ADJUST',
    eventType: '待加工仓位置调整',
    occurredAt: '2026-07-30 09:00',
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'ADJUST', qty: 1, unit: 'yard' },
    payload: {
      pickupSessionId: 'SESSION-001',
      factoryId: 'OTHER-FACTORY',
      warehouseId: 'OTHER-WAREHOUSE',
      warehouseKind: 'WAIT_PROCESS',
      locationRefs: footprintRefs.map((ref) => ({ ...ref, factoryId: 'OTHER-FACTORY', warehouseId: 'OTHER-WAREHOUSE' })),
      remainingByUnit: [{ unit: 'yard', remainingQty: 1 }],
    },
  },
])
assert(foreignAdjustmentOccupancies.every((occupancy) => occupancy.qty === 300), '其他工厂同会话号的调整不得覆盖当前工厂占用')
const crossFactoryRuntimeOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [{
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-CROSS-FACTORY',
  payload: {
    ...structuredClone(runtimePickupEvent.payload as Record<string, unknown>),
    locationRefs: footprintRefs.map((ref) => ({ ...ref, factoryId: 'OTHER-FACTORY' })),
  },
}])
assert.equal(crossFactoryRuntimeOccupancies.length, 0, '其他工厂复用同一 locationId 的事件不得投影到当前仓库')
const globallyUniqueSnapshot = appendWarehouseLocation(
  addedLocationSnapshot,
  firstArea.areaId,
  firstShelf.shelfId,
  { locationId: 'LOC-HISTORY-GLOBAL-UNIQUE', locationNo: 'HISTORY-GLOBAL-UNIQUE-999', locationName: 'HISTORY-GLOBAL-UNIQUE-999', status: 'AVAILABLE' },
)
const originalLocalStorage = globalThis.localStorage
const originalLayoutWindow = globalThis.window
const globalLayoutStorage = createMemoryWarehouseLayoutStorage()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = globalLayoutStorage as unknown as Storage
;(globalThis as typeof globalThis & { window: Window }).window = {
  localStorage: globalLayoutStorage,
  location: { search: '' },
} as unknown as Window
saveWarehouseLayoutSnapshot(globallyUniqueSnapshot, 0, globalLayoutStorage)
const legacyTextEvent: CuttingRuntimeEvent = {
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-LEGACY-TEXT',
  payload: {
    ...structuredClone(runtimePickupEvent.payload as Record<string, unknown>),
    pickupSessionId: 'SESSION-LEGACY-TEXT',
    locationRefs: [{ areaName: firstArea.areaName, shelfNo: firstShelf.shelfNo, locationNo: 'HISTORY-GLOBAL-UNIQUE-999' }],
  },
}
const uniqueWaitProcessWarehouses = Array.from(new Map(listFactoryInternalWarehouses()
  .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING' && warehouse.warehouseKind === 'WAIT_PROCESS')
  .map((warehouse) => [warehouse.warehouseId, warehouse])).values())
const legacyTextOccupancies = uniqueWaitProcessWarehouses
  .flatMap((warehouse) => buildWaitProcessRuntimeOccupancies(
    warehouse,
    warehouse.warehouseId === waitProcess.warehouseId
      ? globallyUniqueSnapshot
      : loadWarehouseLayoutSnapshot(warehouse, globalLayoutStorage).snapshot,
    [legacyTextEvent],
  ))
assert.equal(legacyTextOccupancies.length, 1, '非首仓自定义历史库位全局唯一时只能形成一条占用')
assert.equal(legacyTextOccupancies[0]?.locationId, 'LOC-HISTORY-GLOBAL-UNIQUE', '历史文本库位全局唯一匹配时必须保留占用事实')
const unresolvedLegacyEvent: CuttingRuntimeEvent = {
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-LEGACY-UNRESOLVED',
  payload: {
    ...structuredClone(runtimePickupEvent.payload as Record<string, unknown>),
    pickupSessionId: 'SESSION-LEGACY-UNRESOLVED',
    locationRefs: [{ areaName: '历史区', shelfNo: '历史架', locationNo: '历史位-999' }],
  },
}
const unresolvedLegacyOccupancies = uniqueWaitProcessWarehouses
  .flatMap((warehouse) => buildWaitProcessRuntimeOccupancies(
    warehouse,
    buildInitialWarehouseLayoutSnapshot(warehouse, '历史兼容测试'),
    [unresolvedLegacyEvent],
  ))
assert.equal(unresolvedLegacyOccupancies.length, 0, '无法定位的历史文本事实不得强制归入任何具体仓库，应保留在事件账等待人工归档')
if (originalLocalStorage === undefined) delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage
else (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = originalLocalStorage
if (originalLayoutWindow === undefined) delete (globalThis as typeof globalThis & { window?: Window }).window
else (globalThis as typeof globalThis & { window: Window }).window = originalLayoutWindow
const nonLengthOccupancies = buildWaitProcessRuntimeOccupancies(
  selectionWarehouse,
  selectionSnapshot,
  [{
    eventId: 'EVENT-PICKUP-WEIGHT',
    eventNo: '领料-重量-001',
    eventType: '中转仓领料',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: '2026-07-30 08:10',
    createdAt: '2026-07-30 08:10',
    operatorId: 'U-001',
    operatorName: '测试仓管',
    operatorRole: 'PDA 仓管',
    refs: { productionOrderNo: 'PO-WEIGHT', handoverRecordId: 'SESSION-WEIGHT:LINE-001' },
    material: { materialSku: 'MAT-WEIGHT', materialName: '称重辅料', unit: '公斤' },
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 100, unit: '公斤' },
    payload: { pickupSessionId: 'SESSION-WEIGHT', prepLineId: 'LINE-001', pickupQty: 100, locationRefs: [footprintRefs[0]] },
  }],
)
assert.equal(nonLengthOccupancies[0]?.rollDetails?.length ?? 0, 0, '非长度单位不得伪造 Yard/米卷明细')
const partialRollOccupancies = buildWaitProcessRuntimeOccupancies(selectionWarehouse, selectionSnapshot, [{
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-PARTIAL-ROLLS',
  payload: {
    ...(runtimePickupEvent.payload as Record<string, unknown>),
    pickupSessionId: 'SESSION-PARTIAL-ROLLS',
    prepLineId: 'LINE-PARTIAL',
    pickupQty: 300,
    rollCount: 3,
    rollDetails: [{ rollNo: 'ROLL-ONLY-001', yard: 100, meter: 91.44, locationNo: footprintRefs[0].locationNo }],
  },
  inventoryEffect: { ...runtimePickupEvent.inventoryEffect!, qty: 300, rollCount: 3 },
}])
assert.equal(partialRollOccupancies[0]?.rollDetails?.length, 0, '部分卷明细不得冒充完整事实')
assert.equal(partialRollOccupancies[0]?.rollCount, 3, '部分卷明细缺失时仍须保留事实卷数')
const adjustedPickupSession = adjustPickupSessionStorageFootprint({
  pickupSessionId: 'SESSION-001',
  pickupSessionNo: '领料-001',
  pickupNodeId: 'NODE-001',
  pickupNodeVersion: 1,
  prepOrderId: 'PREP-001',
  productionOrderId: 'PO-001',
  nodeType: 'READY_TO_PICKUP',
  pickupRecordIds: ['PICKUP-001'],
  receiverName: '测试仓管',
  pickedAt: '2026-07-30 08:00',
  toWarehouseArea: footprintRefs[0].areaName,
  toLocationCode: footprintRefs[0].locationNo,
  toLocationRefs: footprintRefs,
  storageFootprint: {
    footprintId: 'SESSION-001',
    sourceType: 'PICKUP_SESSION',
    sourceId: 'SESSION-001',
    locationIds: footprintRefs.map((ref) => ref.locationId),
    unitSummaries: [{ unit: 'yard', totalQty: 300, remainingQty: 300, rollCount: 3 }],
    inboundAt: '2026-07-30 08:00',
    inboundBy: '测试仓管',
  },
  status: '本轮已领完',
  warehouseSyncStatus: '已回写',
}, footprintRefs.slice(0, 2), [{ unit: 'yard', remainingQty: 120 }])
assert.deepEqual(adjustedPickupSession.storageFootprint?.locationIds, footprintRefs.slice(0, 2).map((ref) => ref.locationId))
assert.equal(adjustedPickupSession.storageFootprint?.unitSummaries[0].remainingQty, 120)

const runtimeTicket: WaitHandoverRuntimeTicketInput = {
  feiTicketId: 'FT-MAP-001',
  feiTicketNo: 'FT-MAP-001',
  productionOrderId: 'PO-MAP',
  productionOrderNo: 'PO-MAP',
  cutOrderId: 'CUT-MAP',
  cutOrderNo: 'CUT-MAP',
  spreadingOrderId: 'SPR-MAP',
  spreadingOrderNo: 'SPR-MAP',
  spuCode: 'SPU-MAP',
  color: '黑色',
  size: 'M',
  partCode: 'FRONT',
  partName: '前幅',
  pieceQty: 20,
  pieceSequenceLabel: '1-20',
  hasSpecialCraft: false,
  specialCraftDisplay: '无',
  receiverFactoryDisplay: '待分配',
  printStatus: '已打印',
  voidStatus: '有效',
}
const runtimeStorage = createMemoryWarehouseLayoutStorage()
const baggingEvent = appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: '装袋员' },
  bagCode: 'BAG-MAP-001',
  tickets: [runtimeTicket],
  occurredAt: '2026-07-30 09:00',
  storage: runtimeStorage,
})
assert.equal(
  buildRuntimeInboundTempBagsFromWaitHandoverEvents([baggingEvent], []).length,
  0,
  '菲票装袋不得形成库位占用',
)
const inboundEvent = appendWaitHandoverInboundEvent({
  source: 'PDA',
  operator: { operatorName: '入仓员' },
  bagCode: 'BAG-MAP-001',
  warehouseArea: 'A区',
  locationCode: 'A-01-01',
  locationRef: {
    factoryId: waitProcess.factoryId,
    warehouseId: waitProcess.warehouseId.replace('WAIT_PROCESS', 'WAIT_HANDOVER'),
    warehouseKind: 'WAIT_HANDOVER',
    areaId: firstArea.areaId,
    areaName: firstArea.areaName,
    shelfId: firstShelf.shelfId,
    shelfNo: firstShelf.shelfNo,
    locationId: firstLocation.locationId,
    locationNo: firstLocation.locationNo,
  },
  idempotencyKey: 'temp-bag:BAG-MAP-001:INBOUND',
  occurredAt: '2026-07-30 09:05',
  storage: runtimeStorage,
})
const inboundBags = buildRuntimeInboundTempBagsFromWaitHandoverEvents([baggingEvent, inboundEvent], [])
assert.equal(inboundBags.length, 1, '中转袋入仓后应形成一个在仓袋')
assert.equal(inboundBags[0].bagCode, 'BAG-MAP-001')
const crossFactorySameBagEvent = structuredClone(inboundEvent)
crossFactorySameBagEvent.eventId = 'EVENT-INBOUND-SAME-BAG-OTHER-FACTORY'
crossFactorySameBagEvent.occurredAt = '2026-07-30 09:06'
crossFactorySameBagEvent.payload = {
  ...(crossFactorySameBagEvent.payload as Record<string, unknown>),
  locationRef: {
    ...((crossFactorySameBagEvent.payload as Record<string, unknown>).locationRef as Record<string, unknown>),
    factoryId: 'OTHER-FACTORY',
    warehouseId: 'OTHER-WAIT-HANDOVER',
  },
}
assert.equal(
  buildWaitHandoverLocationOccupancyStates([inboundEvent, crossFactorySameBagEvent]).length,
  2,
  '跨工厂相同袋码必须保留两个独立库位占用',
)
const crossFactoryHandoverEvent = {
  ...structuredClone(crossFactorySameBagEvent),
  eventId: 'EVENT-HANDOVER-SAME-BAG-OTHER-FACTORY',
  eventType: '新增交出记录' as const,
  occurredAt: '2026-07-30 09:08',
  inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'OUT' as const, qty: 100, unit: '片' as const },
  payload: {
    transferBagCode: 'BAG-MAP-001',
    locationRef: (crossFactorySameBagEvent.payload as Record<string, unknown>).locationRef,
  },
}
const statesAfterOtherFactoryHandover = buildWaitHandoverLocationOccupancyStates([
  inboundEvent,
  crossFactorySameBagEvent,
  crossFactoryHandoverEvent,
])
assert.equal(statesAfterOtherFactoryHandover.length, 1, '跨仓同袋同周期交出只能释放目标仓占用')
assert.notEqual(statesAfterOtherFactoryHandover[0].locationRef.factoryId, 'OTHER-FACTORY', '目标仓交出后必须保留另一工厂占用')
const secondCycleSameBagEvent = structuredClone(inboundEvent)
secondCycleSameBagEvent.eventId = 'EVENT-INBOUND-SAME-BAG-CYCLE-2'
secondCycleSameBagEvent.occurredAt = '2026-07-30 09:07'
secondCycleSameBagEvent.refs = { ...secondCycleSameBagEvent.refs, usageCycleId: 'cycle:BAG-MAP-001:2' }
secondCycleSameBagEvent.payload = { ...(secondCycleSameBagEvent.payload as Record<string, unknown>), usageCycleId: 'cycle:BAG-MAP-001:2' }
assert.equal(
  buildWaitHandoverLocationOccupancyStates([inboundEvent, secondCycleSameBagEvent]).length,
  2,
  '同一袋码不同使用周期必须保留独立占用状态',
)
assert.equal((inboundEvent.payload as Record<string, unknown>).idempotencyKey, 'temp-bag:BAG-MAP-001:INBOUND')
assert.equal(
  ((inboundEvent.payload as Record<string, unknown>).locationRef as { locationId?: string })?.locationId,
  firstLocation.locationId,
)
const baggingConfirmEvent = {
  ...structuredClone(inboundEvent),
  eventId: 'EVENT-BAGGING-CONFIRM',
  eventType: '交出装袋确认' as const,
  occurredAt: '2026-07-30 09:10',
  refs: { ...inboundEvent.refs, transferBagCode: 'BAG-MAP-TARGET' },
  payload: {
    sourceTempBagCode: 'BAG-MAP-001',
    targetTransferBagCode: 'BAG-MAP-TARGET',
  },
}
const transferredStates = buildWaitHandoverLocationOccupancyStates([
  baggingEvent,
  inboundEvent,
  baggingConfirmEvent,
])
assert.equal(transferredStates.length, 1, '换袋后同一物理库位只能保留一个占用主体')
assert.equal(transferredStates[0].bagCode, 'BAG-MAP-TARGET', '换袋后占用主体应变为目标中转袋')
assert.equal(transferredStates[0].locationRef.locationId, firstLocation.locationId, '换袋应继承原物理库位')
const handoverEvent = {
  ...structuredClone(inboundEvent),
  eventId: 'EVENT-HANDOVER',
  eventType: '新增交出记录' as const,
  occurredAt: '2026-07-30 09:20',
  refs: { ...inboundEvent.refs, transferBagCode: 'BAG-MAP-TARGET' },
  payload: {},
}
assert.equal(
  buildWaitHandoverLocationOccupancyStates([
    baggingEvent,
    inboundEvent,
    baggingConfirmEvent,
    handoverEvent,
  ]).length,
  0,
  '中转袋最终交出后应释放库位',
)
const partialSpecialCraftHandoverEvent = {
  ...structuredClone(inboundEvent),
  eventId: 'EVENT-SPECIAL-HANDOVER-PARTIAL',
  eventType: '特殊工艺交出' as const,
  occurredAt: '2026-07-30 09:15',
  refs: { ...inboundEvent.refs, transferBagCode: 'BAG-MAP-001', feiTicketIds: ['FT-MAP-001'] },
  inventoryEffect: { ...inboundEvent.inventoryEffect, direction: 'OUT' as const, qty: 5 },
  payload: { transferBagCode: 'BAG-MAP-001', handoverQty: 5 },
}
const partiallyHandedOverStates = buildWaitHandoverLocationOccupancyStates([
  baggingEvent,
  inboundEvent,
  partialSpecialCraftHandoverEvent,
])
assert.equal(partiallyHandedOverStates.length, 1, '特殊工艺部分交出不得释放整袋库位')
assert.equal(partiallyHandedOverStates[0].totalPieceQty, 15, '特殊工艺部分交出应扣减对应数量')
const partialSpecialCraftReturnEvent = {
  ...structuredClone(inboundEvent),
  eventId: 'EVENT-SPECIAL-RETURN-PARTIAL',
  eventType: '特殊工艺回仓' as const,
  occurredAt: '2026-07-30 09:30',
  refs: { ...inboundEvent.refs, transferBagCode: 'BAG-MAP-001', feiTicketIds: ['FT-MAP-001'] },
  inventoryEffect: { ...inboundEvent.inventoryEffect, direction: 'IN' as const, qty: 5 },
  payload: {
    transferBagCode: 'BAG-MAP-001',
    returnRecordId: 'RETURN-PARTIAL-001',
    returnedAt: '2026-07-30 09:30',
    returnedBy: '回仓员',
    locationRef: (inboundEvent.payload as { locationRef: unknown }).locationRef,
  },
}
const partiallyReturnedStates = buildWaitHandoverLocationOccupancyStates([
  baggingEvent,
  inboundEvent,
  partialSpecialCraftHandoverEvent,
  partialSpecialCraftReturnEvent,
])
assert.equal(partiallyReturnedStates.length, 1, '同一中转袋部分回仓后不得丢失原剩余占用')
assert.equal(partiallyReturnedStates[0].totalPieceQty, 20, '部分回仓数量应与原剩余数量合并')
const looseSpecialCraftReturnEvent = {
  ...structuredClone(inboundEvent),
  eventId: 'EVENT-SPECIAL-RETURN-LOOSE',
  eventType: '特殊工艺回仓' as const,
  refs: {
    ...inboundEvent.refs,
    transferBagCode: undefined,
    feiTicketIds: ['FT-MAP-001'],
  },
  payload: {
    returnRecordId: 'RETURN-LOOSE-001',
    returnRecordNo: 'SCR-LOOSE-001',
    returnedAt: '2026-07-30 10:00',
    returnedBy: '回仓员',
    locationRef: (inboundEvent.payload as { locationRef: unknown }).locationRef,
  },
}
const looseReturnStates = buildWaitHandoverLocationOccupancyStates([looseSpecialCraftReturnEvent])
assert.equal(looseReturnStates.length, 1, '无中转袋的特殊工艺回仓也必须占用库位')
assert.equal(looseReturnStates[0].objectNo, 'SCR-LOOSE-001')
assert.match(looseReturnStates[0].objectName || '', /特殊工艺回仓/)

console.log('check:cutting-warehouse-location-map passed')
