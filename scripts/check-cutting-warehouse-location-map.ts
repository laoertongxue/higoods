import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDefaultFactoryInternalWarehouses } from '../src/data/fcs/factory-internal-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import {
  applyWarehouseLayoutSnapshot,
  assignWarehouseLocationToShelf,
  buildInitialWarehouseLayoutSnapshot,
  createMemoryWarehouseLayoutStorage,
  getWarehouseLayoutStorageKey,
  loadWarehouseLayoutSnapshot,
  listWarehouseLayoutChangeRecords,
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
import { buildWaitProcessRuntimeOccupancies } from '../src/pages/process-factory/cutting/warehouse-location-map.ts'
import { adjustPickupSessionStorageFootprint } from '../src/data/fcs/cutting/pickup-node-domain.ts'

const cuttingWarehouses = buildDefaultFactoryInternalWarehouses(mockFactories)
  .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_PROCESS'), '裁床工厂缺少待加工仓')
assert(cuttingWarehouses.some((warehouse) => warehouse.warehouseKind === 'WAIT_HANDOVER'), '裁床工厂缺少待交出仓')

const pdaWaitProcessSource = readFileSync(new URL('../src/pages/pda-warehouse-wait-process.ts', import.meta.url), 'utf8')
const pdaInboundSource = readFileSync(new URL('../src/pages/pda-cutting-inbound.ts', import.meta.url), 'utf8')
const pdaHandoverSource = readFileSync(new URL('../src/pages/pda-cutting-handover.ts', import.meta.url), 'utf8')
const warehouseHubSource = readFileSync(new URL('../src/pages/process-factory/cutting/warehouse-hub.ts', import.meta.url), 'utf8')
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
assert(
  fcsHandlersSource.indexOf('handleCraftCuttingWaitHandoverEvent(target)')
    < fcsHandlersSource.indexOf('handleCraftCuttingWaitHandoverWebActionsEvent(target)'),
  '待交出仓真实页面处理器必须先于旧文本弹窗处理器命中',
)

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
const layoutHistory = listWarehouseLayoutChangeRecords(waitProcess.factoryId, waitProcess.warehouseKind, storage)
assert.equal(layoutHistory.length, 1)
assert.equal(layoutHistory[0].beforeVersion, 0)
assert.equal(layoutHistory[0].afterVersion, 1)
assert.equal(layoutHistory[0].updatedBy, '系统初始化')

const reloaded = loadWarehouseLayoutSnapshot(waitProcess, storage)
assert.equal(reloaded.snapshot.layoutVersion, 1)
const applied = applyWarehouseLayoutSnapshot(waitProcess, reloaded.snapshot)
assert.equal(applied.warehouse.areaList[0].shelfList[0].locationList[0].locationId, secondLocation.locationId)
assert.equal(
  applied.warehouse.areaList[0].shelfList[0].locationList.find((item) => item.locationId === firstLocation.locationId)?.locationNo,
  '面料-A-02',
)
assert.equal(applied.warehouse.areaList[0].areaName, '面料暂存一区')
assert.equal(applied.warehouse.areaList[0].shelfList[0].shelfNo, '货架 A-01')

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
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind),
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
assert.equal(
  classifyHistoricalWarehouseLocation(waitProcess, { locationNo: firstLocation.locationNo }, initial).status,
  'MATCHED',
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
}])
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
const layoutMapHtml = renderWarehouseLocationMap({
  projection: occupiedProjection,
  mode: 'LAYOUT',
  factoryName: '中央裁床',
})
assert.match(layoutMapHtml, /move-shelf-up/)
assert.match(layoutMapHtml, /move-shelf-down/)
assert.match(layoutMapHtml, /rename-area/)
assert.match(layoutMapHtml, /rename-shelf/)
assert.equal(
  validateWarehouseLocationSelection(occupiedProjection, [shelfLocationIds[0], shelfLocationIds[1]]).message,
  '所选库位已被占用，请重新选择。',
)

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
const runtimeFootprintOccupancies = buildWaitProcessRuntimeOccupancies(
  selectionWarehouse,
  selectionSnapshot,
  [{
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
      toWarehouseArea: footprintRefs[0].areaName,
      toLocationCode: footprintRefs[0].locationNo,
    },
    payload: {
      pickupSessionId: 'SESSION-001',
      prepLineId: 'LINE-001',
      pickupQty: 300,
      locationRefs: footprintRefs,
      storageFootprint: footprint,
      pickupBy: '测试仓管',
      pickupAt: '2026-07-30 08:00',
    },
  }],
)
assert.equal(runtimeFootprintOccupancies.length, 3, '多库位领料应占用全部连续库位')
assert.equal(
  runtimeFootprintOccupancies.reduce((sum, occupancy) => sum + occupancy.qty, 0),
  300,
  '同一物料的多库位存放总量只能计算一次',
)
assert(runtimeFootprintOccupancies.every((occupancy) => occupancy.footprintLocationNos?.length === 3))
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
