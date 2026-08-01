import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDefaultFactoryInternalWarehouses, listFactoryInternalWarehouses } from '../src/data/fcs/factory-internal-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import {
  buildCuttingWarehouseAreaList,
  buildCuttingWarehouseLocationNo,
} from '../src/data/fcs/cutting/warehouse-location-mock.ts'
import {
  adjustWarehouseLevelPositionCount,
  applyWarehouseLayoutSnapshot,
  buildInitialWarehouseLayoutSnapshot,
  createWarehouseArea,
  createWarehouseShelf,
  createMemoryWarehouseLayoutStorage,
  getWarehouseLayoutStorageKey,
  loadWarehouseLayoutSnapshot,
  listWarehouseLayoutChangeRecords,
  revokeNewWarehouseNode,
  saveWarehouseLayoutSnapshot,
  setWarehouseLocationEnabled,
  updateWarehouseArea,
  updateWarehouseLocation,
  updateWarehouseShelf,
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

assert.equal(buildCuttingWarehouseLocationNo('A', 2, 3, 2), 'A-R02-L03-P02')
const expectedCuttingAreas = {
  WAIT_PROCESS: buildCuttingWarehouseAreaList('WAIT_PROCESS'),
  WAIT_HANDOVER: buildCuttingWarehouseAreaList('WAIT_HANDOVER'),
}
for (const kind of ['WAIT_PROCESS', 'WAIT_HANDOVER'] as const) {
  const warehouse = cuttingWarehouses.find((item) => item.warehouseKind === kind)
  assert(warehouse, `中央裁床缺少 ${kind} 仓库`)
  assert.deepEqual(warehouse.areaList, expectedCuttingAreas[kind], `${kind} 未使用裁床专属层级库位 Mock`)
  assert(warehouse.areaList.length > 1, `${kind} 必须包含多个库区`)
  assert(warehouse.areaList.every((area) => area.shelfList.length > 0), `${kind} 每个库区必须包含货架`)
  assert(warehouse.areaList.some((area) => area.shelfList.length > 1), `${kind} 必须覆盖同库区多个货架`)
  const locations = warehouse.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList))
  assert.equal(new Set(locations.map((location) => location.locationNo)).size, locations.length, `${kind} 完整库位编号必须唯一`)
  assert.equal(new Set(locations.map((location) => location.locationId)).size, locations.length, `${kind} 稳定库位 ID 必须唯一`)
}

const waitProcessMock = expectedCuttingAreas.WAIT_PROCESS
const waitHandoverMock = expectedCuttingAreas.WAIT_HANDOVER
const findShelf = (areas: typeof waitProcessMock, areaCode: string, sequence: number) =>
  areas.find((area) => area.code === areaCode)?.shelfList.find((shelf) => shelf.shelfSequence === sequence)
const positionCountsByLevel = (shelf: NonNullable<ReturnType<typeof findShelf>>) => {
  const counts = new Map<number, number>()
  shelf.locationList.forEach((location) => {
    const levelNo = location.levelNo ?? 0
    counts.set(levelNo, (counts.get(levelNo) ?? 0) + 1)
  })
  return [...counts.entries()].sort(([left], [right]) => left - right).map(([, count]) => count)
}

assert.deepEqual(positionCountsByLevel(findShelf(waitProcessMock, 'A', 1)!), [3, 3, 3, 3], '待加工仓 A区 R01 应为4层每层3位')
assert.deepEqual(positionCountsByLevel(findShelf(waitProcessMock, 'A', 2)!), [2, 2, 3], '待加工仓 A区 R02 应覆盖3层、每层2位和不等层示例')
assert.deepEqual(positionCountsByLevel(findShelf(waitProcessMock, 'B', 1)!), [1, 1, 1, 1], '待加工仓 B区 R01 应为4层每层1位')
assert.deepEqual(positionCountsByLevel(findShelf(waitHandoverMock, 'A', 1)!), [4, 4, 4, 4], '待交出仓 A区 R01 应为4层每层4位')
assert.deepEqual(positionCountsByLevel(findShelf(waitHandoverMock, 'A', 2)!), [2, 2, 3, 2], '待交出仓 A区 R02 应覆盖4层、每层2位和不等层示例')
assert.deepEqual(positionCountsByLevel(findShelf(waitHandoverMock, 'B', 1)!), [3, 3, 3], '待交出仓 B区 R01 应为3层每层3位')

const waitProcessLocationIds = new Set(waitProcessMock.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))))
const waitHandoverLocationIds = new Set(waitHandoverMock.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId))))
assert([...waitProcessLocationIds].every((id) => !waitHandoverLocationIds.has(id)), '待加工仓与待交出仓稳定库位 ID 不得交叉')
assert.notDeepEqual(waitProcessMock, waitHandoverMock, '两仓层级数据必须相互隔离')

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
const sourceBetween = (start: string, end: string) => {
  const startIndex = warehouseMapSource.indexOf(`if (action === '${start}')`)
  return warehouseMapSource.slice(startIndex, warehouseMapSource.indexOf(`if (action === '${end}'`, startIndex))
}
const renameLocationSource = sourceBetween('rename-location', 'rename-area')
const renameAreaSource = sourceBetween('rename-area', 'rename-shelf')
const renameShelfSource = sourceBetween('rename-shelf', 'assign-location')
for (const [label, source] of [['库位', renameLocationSource], ['库区', renameAreaSource], ['货架', renameShelfSource]] as const) {
  assert.doesNotMatch(source, /window\.prompt|persistSnapshot|replaceWarehouseAreaList/, `旧 ${label} 改号入口不得自由修改 v3 结构`)
  assert.match(source, /系统生成|层级维护/, `旧 ${label} 改号入口必须提示进入系统生成的层级维护`)
}
const viewSectionHtml = renderCuttingWarehouseLocationMapSection('WAIT_PROCESS', 'VIEW')
const layoutSectionHtml = renderCuttingWarehouseLocationMapSection('WAIT_PROCESS', 'LAYOUT')
assert.match(viewSectionHtml, /data-warehouse-map-action="open-add-area"[^>]+data-warehouse-kind="WAIT_PROCESS"[^>]+data-warehouse-id=/, '新增库区入口必须绑定当前仓库')
assert.match(viewSectionHtml, /data-warehouse-map-action="open-add-location"[^>]+data-warehouse-kind="WAIT_PROCESS"[^>]+data-warehouse-id=/, '新增库位入口必须绑定当前仓库')
assert.doesNotMatch(layoutSectionHtml, /open-add-area|open-add-location/, '编排模式不得显示新增结构入口')

const waitProcess = cuttingWarehouses.find((warehouse) => warehouse.warehouseKind === 'WAIT_PROCESS')
assert(waitProcess, '缺少裁床待加工仓')

const storage = createMemoryWarehouseLayoutStorage()
const initial = loadWarehouseLayoutSnapshot(waitProcess, storage).snapshot
assert.equal(initial.schemaVersion, 3)
assert.equal(initial.factoryId, waitProcess.factoryId)
assert.equal(initial.layoutVersion, 0)
assert.deepEqual(initial.areaList, waitProcess.areaList, '首次布局应深拷贝当前仓库完整结构')
assert.notEqual(initial.areaList, waitProcess.areaList, 'v3 快照不得复用主数据数组引用')

const firstArea = initial.areaList[0]
const firstShelf = firstArea.shelfList[0]
const firstLocation = firstShelf.locationList[0]
const secondLocation = firstShelf.locationList[1]
assert(firstLocation && secondLocation, '测试货架至少需要两个库位')

const areaOnly = createWarehouseArea(initial, {
  areaId: 'AREA-C',
  areaName: 'C区',
  code: 'C',
  remark: '临时扩区',
  updatedBy: '仓库主管',
})
assert.equal(areaOnly.areaList.at(-1)?.shelfList.length, 0, '新建库区不得隐式创建货架或库位')
assert.equal(areaOnly.layoutVersion, 1, '每个成功维护动作必须生成下一版本')
assert.deepEqual(initial.areaList, waitProcess.areaList, '维护纯函数不得修改输入快照')
assert.throws(
  () => createWarehouseArea(areaOnly, { areaId: 'AREA-C2', areaName: '重复区', code: 'C', updatedBy: '仓库主管' }),
  /库区代码 C 已存在/,
)
assert.throws(
  () => createWarehouseArea(areaOnly, { areaId: 'AREA-BAD', areaName: '非法区', code: 'c', updatedBy: '仓库主管' }),
  /单个大写字母/,
)

const shelfAdded = createWarehouseShelf(areaOnly, {
  areaId: 'AREA-C',
  shelfId: 'SHELF-C-R01',
  shelfSequence: 1,
  positionCounts: [2, 3, 1],
  remark: '三层不等位',
  updatedBy: '仓库主管',
})
const createdShelf = shelfAdded.areaList.find((area) => area.areaId === 'AREA-C')?.shelfList[0]
assert(createdShelf)
assert.deepEqual(positionCountsByLevel(createdShelf), [2, 3, 1], '新建货架必须按各层数量一次生成全部层位')
assert.deepEqual(
  createdShelf.locationList.map((location) => location.locationNo),
  ['C-R01-L01-P01', 'C-R01-L01-P02', 'C-R01-L02-P01', 'C-R01-L02-P02', 'C-R01-L02-P03', 'C-R01-L03-P01'],
)
assert.equal(new Set(createdShelf.locationList.map((location) => location.locationId)).size, 6, '一次生成的库位 ID 必须稳定且唯一')
assert.throws(
  () => createWarehouseShelf(shelfAdded, {
    areaId: 'AREA-C', shelfId: 'SHELF-C-R01-SECOND', shelfSequence: 1, positionCounts: [1], updatedBy: '仓库主管',
  }),
  /货架序号 1 已存在/,
)
assert.throws(
  () => createWarehouseShelf(areaOnly, {
    areaId: 'AREA-C', shelfId: 'SHELF-C-BAD', shelfSequence: 100, positionCounts: [1], updatedBy: '仓库主管',
  }),
  /1 到 99/,
)

const levelExpanded = adjustWarehouseLevelPositionCount(shelfAdded, {
  shelfId: 'SHELF-C-R01', levelNo: 2, positionCount: 5, updatedBy: '仓库主管',
}, new Set())
const expandedShelf = levelExpanded.areaList.find((area) => area.areaId === 'AREA-C')!.shelfList[0]
assert.deepEqual(positionCountsByLevel(expandedShelf), [2, 5, 1], '增加层位必须从当前最右侧继续追加')
assert.deepEqual(expandedShelf.locationList.filter((location) => location.levelNo === 2).map((location) => location.positionNo), [1, 2, 3, 4, 5])
const levelReduced = adjustWarehouseLevelPositionCount(levelExpanded, {
  shelfId: 'SHELF-C-R01', levelNo: 2, positionCount: 2, updatedBy: '仓库主管',
}, new Set())
assert.deepEqual(positionCountsByLevel(levelReduced.areaList.find((area) => area.areaId === 'AREA-C')!.shelfList[0]), [2, 2, 1], '减少层位只能从最右端移除')

const occupiedId = createdShelf.locationList.find((location) => location.levelNo === 2 && location.positionNo === 3)!.locationId
assert.throws(
  () => adjustWarehouseLevelPositionCount(shelfAdded, {
    shelfId: 'SHELF-C-R01', levelNo: 2, positionCount: 2, updatedBy: '仓库主管',
  }, new Set([occupiedId])),
  /占用.*C-R01-L02-P03/,
)
assert.throws(
  () => setWarehouseLocationEnabled(shelfAdded, { locationId: occupiedId, enabled: false, updatedBy: '仓库主管' }, new Set([occupiedId])),
  /占用.*C-R01-L02-P03/,
)
const stoppedOccupiedSnapshot = structuredClone(shelfAdded)
stoppedOccupiedSnapshot.areaList
  .find((area) => area.areaId === 'AREA-C')!
  .shelfList[0]
  .locationList.find((location) => location.locationId === occupiedId)!.status = 'STOPPED'
assert.throws(
  () => setWarehouseLocationEnabled(stoppedOccupiedSnapshot, { locationId: occupiedId, enabled: true, updatedBy: '仓库主管' }, new Set([occupiedId])),
  /占用库位 C-R01-L02-P03 不能启用/,
  '已停用但仍占用的合法 v3 库位不得重新启用，并必须列出完整编号',
)
assert.strictEqual(
  setWarehouseLocationEnabled(stoppedOccupiedSnapshot, { locationId: occupiedId, enabled: false, updatedBy: '仓库主管' }, new Set([occupiedId])),
  stoppedOccupiedSnapshot,
  '库位启停状态相同时应直接返回原快照，不产生无意义事实变化',
)
assert.throws(
  () => updateWarehouseLocation(shelfAdded, { locationId: occupiedId, levelNo: 3, positionNo: 2, updatedBy: '仓库主管' }, new Set([occupiedId])),
  /占用.*只能修改备注/,
)
const customNamedLocationSnapshot = structuredClone(shelfAdded)
const customNamedLocationArea = customNamedLocationSnapshot.areaList.find((area) => area.areaId === 'AREA-C')!
const customNamedLocationShelf = customNamedLocationArea.shelfList[0]
customNamedLocationShelf.shelfName = '主管保留整架名称'
customNamedLocationShelf.locationList.find((location) => location.locationId === occupiedId)!.locationName = '占用目标自定义名称'
customNamedLocationShelf.locationList.find((location) => location.levelNo === 2 && location.positionNo === 2)!.locationName = '相邻库位自定义名称'
const expectedLocationRemarkOnly = structuredClone(customNamedLocationSnapshot.areaList)
expectedLocationRemarkOnly
  .find((area) => area.areaId === 'AREA-C')!
  .shelfList[0]
  .locationList.find((location) => location.locationId === occupiedId)!.remark = '盘点确认'
const locationRemarkOnly = updateWarehouseLocation(
  customNamedLocationSnapshot,
  { locationId: occupiedId, remark: '盘点确认', updatedBy: '仓库主管' },
  new Set([occupiedId]),
)
assert.deepEqual(locationRemarkOnly.areaList, expectedLocationRemarkOnly, '占用库位仅改备注时，除目标 remark 外整个库区深值必须保持不变')
assert.throws(
  () => updateWarehouseArea(shelfAdded, { areaId: 'AREA-C', code: 'D', updatedBy: '仓库主管' }, new Set([occupiedId])),
  /占用.*不能修改库区代码/,
)
const secondOccupiedId = createdShelf.locationList.find((location) => location.levelNo === 1 && location.positionNo === 1)!.locationId
assert.throws(
  () => updateWarehouseArea(shelfAdded, { areaId: 'AREA-C', areaName: '占用区改名', updatedBy: '仓库主管' }, new Set([occupiedId, secondOccupiedId])),
  new RegExp(`占用.*${createdShelf.locationList.find((location) => location.locationId === occupiedId)!.locationNo}.*${createdShelf.locationList.find((location) => location.locationId === secondOccupiedId)!.locationNo}|占用.*${createdShelf.locationList.find((location) => location.locationId === secondOccupiedId)!.locationNo}.*${createdShelf.locationList.find((location) => location.locationId === occupiedId)!.locationNo}`),
  '库区任一后代占用时，除备注外不得改名称且必须列出全部冲突完整编号',
)
const customNamedOccupiedSnapshot = structuredClone(shelfAdded)
const customNamedArea = customNamedOccupiedSnapshot.areaList.find((area) => area.areaId === 'AREA-C')!
const customNamedShelf = customNamedArea.shelfList[0]
customNamedShelf.shelfName = '主管保留货架名称'
customNamedShelf.locationList[0].locationName = '主管保留库位名称'
const expectedAreaRemarkOnly = structuredClone(customNamedOccupiedSnapshot.areaList)
expectedAreaRemarkOnly.find((area) => area.areaId === 'AREA-C')!.remark = '占用区备注'
const areaRemarkOnly = updateWarehouseArea(
  customNamedOccupiedSnapshot,
  { areaId: 'AREA-C', remark: '占用区备注', updatedBy: '仓库主管' },
  new Set([occupiedId]),
)
assert.deepEqual(areaRemarkOnly.areaList, expectedAreaRemarkOnly, '占用库区仅改备注时，除目标 remark 外所有合法 v3 深值必须保持不变')
assert.throws(
  () => updateWarehouseShelf(shelfAdded, { shelfId: 'SHELF-C-R01', shelfSequence: 2, updatedBy: '仓库主管' }, new Set([occupiedId])),
  /占用.*不能修改货架序号/,
)
assert.throws(
  () => updateWarehouseShelf(shelfAdded, { shelfId: 'SHELF-C-R01', shelfName: '占用货架改名', updatedBy: '仓库主管' }, new Set([occupiedId, secondOccupiedId])),
  /占用.*C-R01-L0[12]-P0[13].*C-R01-L0[12]-P0[13]/,
  '货架任一库位占用时，除备注外不得改名称且必须列出全部冲突完整编号',
)
const expectedShelfRemarkOnly = structuredClone(customNamedOccupiedSnapshot.areaList)
expectedShelfRemarkOnly.find((area) => area.areaId === 'AREA-C')!.shelfList[0].remark = '占用货架备注'
const shelfRemarkOnly = updateWarehouseShelf(
  customNamedOccupiedSnapshot,
  { shelfId: 'SHELF-C-R01', remark: '占用货架备注', updatedBy: '仓库主管' },
  new Set([occupiedId]),
)
assert.deepEqual(shelfRemarkOnly.areaList, expectedShelfRemarkOnly, '占用货架仅改备注时，除目标 remark 外所有合法 v3 深值必须保持不变')

const idsBeforeRenumber = createdShelf.locationList.map((location) => location.locationId)
const areaRenumbered = updateWarehouseArea(shelfAdded, { areaId: 'AREA-C', code: 'D', updatedBy: '仓库主管' }, new Set())
const renumberedShelf = areaRenumbered.areaList.find((area) => area.areaId === 'AREA-C')!.shelfList[0]
assert.deepEqual(renumberedShelf.locationList.map((location) => location.locationId), idsBeforeRenumber, '结构编码变化后 locationId 必须保持稳定')
assert(renumberedShelf.locationList.every((location) => location.locationNo.startsWith('D-R01-')), '库区代码变化后全部下级完整编号必须重算')
const shelfRenumbered = updateWarehouseShelf(areaRenumbered, { shelfId: 'SHELF-C-R01', shelfSequence: 2, updatedBy: '仓库主管' }, new Set())
assert(shelfRenumbered.areaList.find((area) => area.areaId === 'AREA-C')!.shelfList[0].locationList.every((location) => location.locationNo.startsWith('D-R02-')), '货架序号变化后全部下级完整编号必须重算')
assert.throws(
  () => updateWarehouseLocation(shelfRenumbered, {
    locationId: idsBeforeRenumber[1], levelNo: 1, positionNo: 1, updatedBy: '仓库主管',
  }, new Set()),
  /完整编号 D-R02-L01-P01 已存在/,
)
assert.throws(
  () => revokeNewWarehouseNode(shelfAdded, { nodeType: 'SHELF', nodeId: 'SHELF-C-R01', createdInLayoutVersion: 2, updatedBy: '仓库主管' }, new Set([occupiedId, secondOccupiedId])),
  /C-R01-L02-P03.*C-R01-L01-P01|C-R01-L01-P01.*C-R01-L02-P03/,
  '撤销节点有引用或占用时必须列出所有冲突完整编号',
)
assert.throws(
  () => revokeNewWarehouseNode(shelfAdded, { nodeType: 'AREA', nodeId: firstArea.areaId, createdInLayoutVersion: 1, updatedBy: '仓库主管' }, new Set()),
  /仅允许撤销本次新建/,
  '调用方伪报版本也不得撤销没有内部创建元数据的既有节点',
)
const revoked = revokeNewWarehouseNode(shelfAdded, { nodeType: 'SHELF', nodeId: 'SHELF-C-R01', createdInLayoutVersion: 2, updatedBy: '仓库主管' }, new Set())
assert.equal(revoked.areaList.find((area) => area.areaId === 'AREA-C')?.shelfList.length, 0, '无引用的新建错误货架允许撤销')

const revokeStorage = createMemoryWarehouseLayoutStorage()
const revokeBaseline = loadWarehouseLayoutSnapshot(waitProcess, revokeStorage).snapshot
const persistedNewArea = createWarehouseArea(revokeBaseline, { areaId: 'AREA-REVOKE', areaName: 'C区', code: 'C', updatedBy: '仓库主管' })
assert.equal(saveWarehouseLayoutSnapshot(persistedNewArea, 0, revokeStorage).ok, true)
const reloadedNewArea = loadWarehouseLayoutSnapshot(waitProcess, revokeStorage).snapshot
const reloadedAreaNode = reloadedNewArea.areaList.find((area) => area.areaId === 'AREA-REVOKE') as typeof firstArea & { layoutCreatedInVersion?: number }
assert.equal(reloadedAreaNode.layoutCreatedInVersion, 1, '新建节点内部创建版本必须跨 localStorage JSON 持久化')
const revokedAfterReload = revokeNewWarehouseNode(reloadedNewArea, { nodeType: 'AREA', nodeId: 'AREA-REVOKE', createdInLayoutVersion: 1, updatedBy: '仓库主管' }, new Set())
assert.equal(revokedAfterReload.areaList.some((area) => area.areaId === 'AREA-REVOKE'), false, '真实新建空库区在重新加载后仍允许撤销')

const saved = saveWarehouseLayoutSnapshot(areaOnly, 0, storage)
assert.equal(saved.ok, true)
assert.equal(saved.snapshot?.layoutVersion, 1)
const layoutHistory = listWarehouseLayoutChangeRecords(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId, storage)
assert.equal(layoutHistory.length, 1)
assert.equal(layoutHistory[0].beforeVersion, 0)
assert.equal(layoutHistory[0].afterVersion, 1)
assert.equal(layoutHistory[0].updatedBy, '仓库主管')
assert.equal(layoutHistory[0].beforeSnapshot.areaList.some((area) => area.areaId === 'AREA-C'), false, '历史 before 必须是真实已加载基线，不得包含新节点')
assert.equal(layoutHistory[0].afterSnapshot.areaList.some((area) => area.areaId === 'AREA-C'), true, '历史 after 必须包含本次新节点')
const directSaveStorage = createMemoryWarehouseLayoutStorage()
const directSave = saveWarehouseLayoutSnapshot(areaOnly, 0, directSaveStorage)
assert.equal(directSave.ok, false, '未先加载基线不得直接保存变更后快照')
assert.match(directSave.message, /请刷新加载后再保存/)
const siblingWarehouse = { ...structuredClone(waitProcess), warehouseId: `${waitProcess.warehouseId}-SIBLING`, warehouseName: '同类型备用待加工仓' }
const siblingSnapshot = loadWarehouseLayoutSnapshot(siblingWarehouse, storage).snapshot
const siblingChanged = createWarehouseArea(siblingSnapshot, { areaId: 'SIBLING-C', areaName: 'C区', code: 'C', updatedBy: '备用仓主管' })
assert.equal(saveWarehouseLayoutSnapshot(siblingChanged, 0, storage).ok, true)
assert.equal(loadWarehouseLayoutSnapshot(waitProcess, storage).snapshot.warehouseId, waitProcess.warehouseId, '同工厂同类型多仓布局不得互相覆盖')
assert.equal(loadWarehouseLayoutSnapshot(siblingWarehouse, storage).snapshot.warehouseId, siblingWarehouse.warehouseId, '备用仓必须读取独立布局快照')

const reloaded = loadWarehouseLayoutSnapshot(waitProcess, storage)
assert.equal(reloaded.snapshot.layoutVersion, 1)
const applied = applyWarehouseLayoutSnapshot(waitProcess, reloaded.snapshot)
assert.deepEqual(applied.warehouse.areaList, areaOnly.areaList, 'v3 应直接应用完整快照事实')

const staleSave = saveWarehouseLayoutSnapshot(areaOnly, 0, storage)
assert.equal(staleSave.ok, false)
assert.equal(staleSave.message, '库位图已被更新，请刷新后重试。')

const oldStorage = createMemoryWarehouseLayoutStorage()
oldStorage.setItem(
  getWarehouseLayoutStorageKey(waitProcess.factoryId, waitProcess.warehouseKind, waitProcess.warehouseId),
  JSON.stringify({ ...initial, schemaVersion: 2, areaOrder: ['OLD-AREA'] }),
)
const oldLoad = loadWarehouseLayoutSnapshot(waitProcess, oldStorage)
assert.equal(oldLoad.warningMessage, '', '非 v3 旧缓存必须静默丢弃，不迁移、不提示')
assert.equal(oldLoad.snapshot.schemaVersion, 3)
assert.equal(oldLoad.snapshot.layoutVersion, 0)
assert.deepEqual(oldLoad.snapshot.areaList, waitProcess.areaList, '旧缓存失效后必须使用当前 Mock 默认布局建立 v3')

const refs = listStableWarehouseLocationRefs(waitProcess, reloaded.snapshot)
assert.equal(refs.length, waitProcess.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList)).length)
const stableResolved = resolveStableWarehouseLocationRef(waitProcess, { locationId: firstLocation.locationId }, reloaded.snapshot)
assert.equal(stableResolved?.locationNo, firstLocation.locationNo)
const textResolved = resolveStableWarehouseLocationRef(waitProcess, {
  areaName: firstArea.areaName,
  shelfNo: firstShelf.shelfNo,
  locationNo: firstLocation.locationNo,
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
selectionShelf.locationList = selectionShelf.locationList.slice(0, 3)
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
const globallyUniqueAreaSnapshot = createWarehouseArea(initial, {
  areaId: 'AREA-HISTORY-GLOBAL-UNIQUE', areaName: 'C区', code: 'C', updatedBy: '历史定位测试',
})
const globallyUniqueSnapshot = createWarehouseShelf(globallyUniqueAreaSnapshot, {
  areaId: 'AREA-HISTORY-GLOBAL-UNIQUE', shelfId: 'SHELF-HISTORY-GLOBAL-UNIQUE', shelfSequence: 1, positionCounts: [1], updatedBy: '历史定位测试',
})
const originalLocalStorage = globalThis.localStorage
const originalLayoutWindow = globalThis.window
const globalLayoutStorage = createMemoryWarehouseLayoutStorage()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = globalLayoutStorage as unknown as Storage
;(globalThis as typeof globalThis & { window: Window }).window = {
  localStorage: globalLayoutStorage,
  location: { search: '' },
} as unknown as Window
saveWarehouseLayoutSnapshot(globallyUniqueAreaSnapshot, 0, globalLayoutStorage)
saveWarehouseLayoutSnapshot(globallyUniqueSnapshot, 1, globalLayoutStorage)
const legacyTextEvent: CuttingRuntimeEvent = {
  ...structuredClone(runtimePickupEvent),
  eventId: 'EVENT-LEGACY-TEXT',
  payload: {
    ...structuredClone(runtimePickupEvent.payload as Record<string, unknown>),
    pickupSessionId: 'SESSION-LEGACY-TEXT',
    locationRefs: [{ areaName: 'C区', shelfNo: 'R01', locationNo: 'C-R01-L01-P01' }],
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
assert.equal(legacyTextOccupancies[0]?.locationId, 'SHELF-HISTORY-GLOBAL-UNIQUE-L01-P01', '历史文本库位全局唯一匹配时必须保留占用事实')
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
