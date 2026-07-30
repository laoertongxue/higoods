#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  allocatePickupReturnAcrossSources,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  derivePickupStatus,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordContext,
  getMaterialPrepRecordItems,
  hydrateProductionMaterialPrepStore,
  listMaterialPrepOrderProjections,
  materialPrepWorkbenchTabs,
  pickMaterialPrepRecord,
  pickupWorkbenchTabs,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  rejectMaterialPrepRecord,
  serializeProductionMaterialPrepStore,
  stageMaterialPrepRecord,
  type PickupOrderStatus,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  listActivePickupNodesRuntime as listActivePickupNodes,
  listPickupDemandFactsRuntime as listPickupDemandFacts,
} from '../src/runtime/fcs/cutting/pickup-management-runtime.ts'
import {
  listPickupOrderGroups,
} from '../src/pages/process-factory/cutting/pickup-management-projection.ts'

const repoRoot = process.cwd()

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const appShellConfig = read('src/data/app-shell-config.ts')
const routesFcs = read('src/router/routes-fcs.ts')
const routeRenderersFcs = read('src/router/route-renderers-fcs.ts')
const pickupManagementSource = read('src/pages/process-factory/cutting/pickup-management.ts')
const pickupManagementListSource = read('src/pages/process-factory/cutting/pickup-management-list.ts')
const pickupManagementProjectionSource = read('src/pages/process-factory/cutting/pickup-management-projection.ts')
const pickupManagementRuntimeSource = read('src/runtime/fcs/cutting/pickup-management-runtime.ts')
const supplementRecordSource = read('src/data/fcs/cutting/supplement-records.ts')
const supplementManagementSource = read('src/pages/process-factory/cutting/supplement-management.ts')
const pdaWaitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
const warehouseHubSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
const fcsHandlersSource = read('src/main-handlers/fcs-handlers.ts')
const pdaAccessSource = read('src/data/fcs/factory-onboarding-flow.ts')
const pdaRuntimeSource = read('src/pages/pda-runtime.ts')
const cuttingRuntimeLedgerSource = read('src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
const dataSource = read('src/data/fcs/cutting/production-material-prep.ts')

assert(appShellConfig.includes("title: '领料管理'"), 'PFOS 缺少独立领料管理菜单')
for (const [title, href] of [
  ['已配齐待领料', '/fcs/craft/cutting/pickup-management/ready'],
  ['未配齐配料', '/fcs/craft/cutting/pickup-management/incomplete'],
  ['已领料', '/fcs/craft/cutting/pickup-management/history'],
] as const) {
  assert(
    appShellConfig.includes(`title: '${title}'`) && appShellConfig.includes(`href: '${href}'`),
    `PFOS 领料管理缺少规范子菜单：${title}`,
  )
  assert(routesFcs.includes(`'${href}'`), `PFOS 领料管理规范路由缺失：${href}`)
}
assert(
  routesFcs.includes("renderRouteRedirect('/fcs/craft/cutting/pickup-management/ready'"),
  '旧领料管理路由必须只重定向到已配齐待领料',
)
assert(
  !/title: '裁前准备'[\s\S]*?href: '\/fcs\/craft\/cutting\/pickup-management'/.test(appShellConfig),
  '裁前准备不得保留旧领料管理菜单项',
)
assert(routesFcs.includes('/fcs/craft/cutting/pickup-management-detail'), 'PFOS 领料详情路由缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupReadyPage'), 'PFOS 已配齐待领料 renderer 缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupIncompletePage'), 'PFOS 未配齐配料 renderer 缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupHistoryPage'), 'PFOS 已领料 renderer 缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupManagementDetailPage'), 'PFOS 领料详情 renderer 缺失')
assert(pickupManagementListSource.includes('// @page-pattern: list'), '领料管理三列表必须声明标准列表页模式')
assert(pickupManagementListSource.includes('renderStandardListPage'), '领料管理三列表必须使用标准列表页骨架')
assert(pickupManagementListSource.includes('renderStandardListTable'), '领料管理三列表必须使用标准列表表格')
assert(pickupManagementListSource.includes('renderTablePagination'), '领料管理三列表必须保留分页')
assert(pickupManagementSource.includes('listActivePickupNodes'), '领料管理必须以活动待领节点为当前待办对象')
assert(pickupManagementSource.includes('renderCraftCuttingPickupManagementDetailPage'), '领料管理必须保留节点详情页')
assert(fcsHandlersSource.includes('handleCraftCuttingPickupManagementEvent'), 'FCS handler 必须承接领料管理交互')
assert(pdaWaitProcessSource.includes('listActivePickupNodes'), 'PDA 必须读取与 PC 同源的活动待领节点')
assert(pdaWaitProcessSource.includes('appendPickupSessionFromNode'), 'PDA 确认必须调用统一节点领料入口')
assert(
  !dataSource.includes("pages/process-factory/cutting/supplement-management"),
  '纯数据层不得反向依赖补料管理页面',
)
assert(
  !dataSource.includes('listSupplementRecords()'),
  '纯数据节点读取不得隐式触发补料页面 Mock 初始化',
)
assert(
  !dataSource.includes('listPlatformDyeResultViews')
  && !dataSource.includes('listPlatformPrintResultViews'),
  '纯数据节点读取不得隐式读取加工结果，必须由 runtime 显式传入',
)
assert(
  pickupManagementRuntimeSource.includes('ensureSupplementRecordPickupSeeds()')
  && pickupManagementRuntimeSource.includes('listPlatformDyeResultViews()')
  && pickupManagementRuntimeSource.includes('listPlatformPrintResultViews()'),
  '页面级 runtime 必须明确组装补料和加工结果事实',
)
assert(
  supplementRecordSource.includes(`export function listSupplementRecords(): SupplementRecord[] {
  return structuredClone(supplementRecords)
}`),
  '补料记录纯查询不得隐式初始化 Mock 数据',
)
assert(
  supplementManagementSource.includes(`export function listSupplementRecords(): SupplementRecord[] {
  return listSupplementRecordsFromStore()
}`)
  && supplementManagementSource.includes('export function bootstrapSupplementManagementMockData()'),
  '补料页面 list 查询必须保持纯读，Mock 初始化只能由显式 bootstrap/route-enter 触发',
)
assert(
  pickupManagementProjectionSource.includes('buildPickupRuntimeContext(storage)')
  && pickupManagementSource.includes('pickup-management-runtime.ts')
  && pdaWaitProcessSource.includes('pickup-management-runtime.ts'),
  'Web 三列表、详情与 PDA 必须统一通过 runtime facade 读取节点事实',
)
assert(pdaWaitProcessSource.includes('确认全部领料'), 'PDA 必须明确一次领取节点全部物料')
assert(pdaAccessSource.includes("!targetRoute.startsWith('/fcs/pda')"), 'PDA 登录守卫不得误拦截非 PDA 路由')
assert(pdaRuntimeSource.includes("startsWith('/fcs/pda')"), 'PDA 登录重定向必须限定 PDA 路由')
assert(!`${dataSource}\n${pickupManagementSource}\n${pdaWaitProcessSource}\n${warehouseHubSource}`.includes("unit: '米'"), '配料、领料与待加工仓链路不得继续写入旧单位“米”')
assert(cuttingRuntimeLedgerSource.includes("if (text === '米') return 'yard'"), '运行流水必须兼容历史“米”并统一为 yard')
assert(!pickupWorkbenchTabs.some((tab) =>
  ['WAIT_CONTINUE_PICKUP', 'PARTIAL_PICKABLE'].includes(tab.key as PickupOrderStatus)
), '裁床领料状态不得把“继续等待”或“部分可领”作为裁床动作')
const crossUnitStatus = derivePickupStatus(
  [
    { prepLineId: 'yard-line', unit: 'yard', requiredQty: 100, confirmedPrepQty: 1100 },
    { prepLineId: 'piece-line', unit: '条', requiredQty: 1000, confirmedPrepQty: 0 },
  ] as never,
  [],
  [{ prepLineId: 'yard-line', pickedQty: 1100 }] as never,
  false,
)
assert(crossUnitStatus !== 'PICKUP_DONE', '不同单位不得通过全单数量加总抵消成“已领料完结”')
const returnedPickupStatus = derivePickupStatus(
  [{ prepLineId: 'returned-line', unit: 'yard', requiredQty: 100, confirmedPrepQty: 100 }] as never,
  [],
  [{ prepLineId: 'returned-line', pickedQty: 100, returnQty: 50 }] as never,
  false,
)
assert(returnedPickupStatus === 'WAIT_PICKUP', '领 100 退 50 后有效已领必须为 50，不得派生为已领料完结')
const completedPickupStatus = derivePickupStatus(
  [{ prepLineId: 'completed-line', unit: 'yard', requiredQty: 100, confirmedPrepQty: 100 }] as never,
  [],
  [{ prepLineId: 'completed-line', pickedQty: 100, returnQty: 0 }] as never,
  false,
)
assert(completedPickupStatus === 'PICKUP_DONE', '无退回且逐行全部领完时必须派生为已领料完结')
const allocatedReturn = allocatePickupReturnAcrossSources([
  { prepRecordId: 'source-a', prepLineId: 'line-a', pickedQty: 65, rollCount: 1, unit: 'yard', sourceWarehouseName: '中转仓', sourceWarehouseArea: 'A', sourceLocationCode: 'A-01' },
  { prepRecordId: 'source-b', prepLineId: 'line-a', pickedQty: 100, rollCount: 1, unit: 'yard', sourceWarehouseName: '中转仓', sourceWarehouseArea: 'A', sourceLocationCode: 'A-02' },
], 100)
assert(allocatedReturn[0].effectivePickedQty === 0, '退回必须先冲减第一来源的 65')
assert(allocatedReturn[1].effectivePickedQty === 65, '第一来源冲完后必须继续冲减第二来源 35')
assert(
  allocatedReturn.reduce((sum, allocation) => sum + allocation.effectivePickedQty, 0) === 65,
  '来源有效已领之和必须等于行级 picked - returned',
)

const projections = listMaterialPrepOrderProjections(null)
assert(projections.length >= 8, '生产单级裁床配料单样例不足')
assert(new Set(projections.map((projection) => projection.order.prepOrderId)).size === projections.length, '配料单 ID 必须唯一')
assert(new Set(projections.map((projection) => projection.order.productionOrderId)).size === projections.length, '一个生产单只能对应一张持续有效的裁床配料单')
for (const projection of projections) {
  assert(projection.order.productionOrderId && projection.order.productionOrderNo, '配料单必须以生产单为主对象')
  assert(projection.lines.length >= 8, `${projection.order.productionOrderNo} 物料需求行不足 8 项`)
  for (const [materialType, minimum] of [['面料', 3], ['辅料', 3], ['纱线', 1], ['包材', 1]] as const) {
    assert(
      projection.lines.filter((line) => line.materialType === materialType).length >= minimum,
      `${projection.order.productionOrderNo} ${materialType}物料样例不足`,
    )
  }
  for (const line of projection.lines) {
    assert(line.unit !== '米', `${projection.order.productionOrderNo} ${line.materialSku} 不得使用旧单位“米”`)
    assert(line.materialSku && line.color && line.spec && line.unit, '物料需求行必须按 SKU、颜色、规格、单位独立计算')
  }
}

for (const status of materialPrepWorkbenchTabs.map((tab) => tab.key)) {
  assert(projections.some((projection) => projection.order.overallPrepStatus === status), `配料工作台缺少状态样例：${status}`)
}
for (const status of pickupWorkbenchTabs.map((tab) => tab.key)) {
  assert(projections.some((projection) => projection.order.pickupStatus === status), `领料工作台缺少状态样例：${status}`)
}
for (const projection of projections) {
  const unitSummaries = (projection as typeof projection & {
    unitSummaries?: Array<{
      unit: string
      confirmedPrepQty: number
      effectivePickedQty: number
      returnedQty: number
      availableToPickupQty: number
    }>
  }).unitSummaries
  assert(unitSummaries?.length, `${projection.order.productionOrderNo} 必须按单位输出数量汇总`)
  assert(new Set(unitSummaries.map((summary) => summary.unit)).size === unitSummaries.length, '单位汇总不得重复单位')
  if (unitSummaries.length > 1) {
    assert(projection.totalAvailableToPickupQty === null, '多单位配料单不得继续输出无量纲可领总数')
  }
}
const returnedProjection = projections.find((projection) => projection.pickupReturnRecords.length > 0)
assert(returnedProjection, '必须存在退回场景')
assert(
  returnedProjection.unitSummaries.some((summary) => summary.returnedQty > 0 && summary.availableToPickupQty > 0),
  '退回数量必须回到对应单位的当前可领事实',
)
const multiUnitRecord = projections.flatMap((projection) =>
  projection.prepRecords.map((record) => ({ projection, record }))
).find(({ projection, record }) => {
  const units = getMaterialPrepRecordItems(record).map((item) =>
    projection.lines.find((line) => line.prepLineId === item.prepLineId)?.unit || ''
  )
  return new Set(units.filter(Boolean)).size > 1
})
assert(multiUnitRecord, '必须存在多单位配料记录以验证记录级汇总')
const multiUnitContext = getMaterialPrepRecordContext(multiUnitRecord.record.prepRecordId, null)
assert(multiUnitContext?.availableToPickupUnitSummaries.length! > 1, '多单位配料记录必须按单位输出可领汇总')
assert(multiUnitContext?.totalAvailableToPickupQty === null, '多单位配料记录不得输出无量纲可领总数')

const activeNodes = listActivePickupNodes(null)
const incompleteGroups = listPickupOrderGroups('INCOMPLETE', null)
const readyGroups = listPickupOrderGroups('READY', null)
assert(incompleteGroups.length > 0, 'Mock 缺少未配齐领料分组')
assert(incompleteGroups.every((group) =>
  group.carrierType === 'WAREHOUSE_LOCATIONS' &&
  group.materialRows.some((row) => row.currentLocations.length > 0)
), '未配齐分组必须由专属库位承载，且至少一项物料展示当前位置')
assert(readyGroups.length > 0, 'Mock 缺少已配齐待领分组')
assert(readyGroups.every((group) =>
  group.carrierType === 'PALLET' &&
  group.palletId === '' &&
  group.palletDisplayLabel === '待领托盘（暂未编号）' &&
  group.materialRows.every((row) => row.currentLocations.length === 0)
), '已配齐分组必须由未编号待领托盘承载')
assert(activeNodes.length > 0, '已确认且尚未领取的物料必须形成活动待领节点')
assert(new Set(activeNodes.map((node) => node.prepOrderId)).size === activeNodes.length, '同一配料单同一时刻最多一个活动节点')
assert(activeNodes.every((node) => node.items.length > 0), '活动节点必须包含当前全部可领物料')
const incompleteNodes = activeNodes.filter((node) => node.nodeType === 'INCOMPLETE_PICKABLE')
const readyNodes = activeNodes.filter((node) => node.nodeType === 'READY_TO_PICKUP')
assert(incompleteNodes.length > 0, 'Mock 缺少未配齐可领节点')
assert(readyNodes.length > 0, 'Mock 缺少已配齐待领节点')
assert(incompleteNodes.every((node) =>
  node.carrierType === 'WAREHOUSE_LOCATIONS' &&
  node.palletId === '' &&
  node.palletDisplayLabel === '' &&
  node.readySource === null &&
  node.items.every((item) =>
    item.sourceLocations.length > 0 &&
    item.sourceLocations.every((location) => location.unit === item.unit)
  )
), '未配齐节点每项物料必须保留来源库位，并由库位承载')
assert(readyNodes.every((node) =>
  node.carrierType === 'PALLET' &&
  node.palletId === '' &&
  node.palletDisplayLabel === '待领托盘（暂未编号）' &&
  (node.readySource === 'DIRECT_READY' || node.readySource === 'UPGRADED_FROM_INCOMPLETE')
), '已配齐节点必须由未编号托盘承载并记录配齐来源')
assert(readyNodes.every((node) =>
  node.items.every((item) =>
    item.sourceLocations.every((location) => location.sourcePrepRecordIds.length > 0)
  )
), '已配齐节点若保留来源库位追溯快照，快照必须关联来源配料记录')
assert(activeNodes.some((node) =>
  node.items.some((item) => item.sourcePrepRecordIds.length >= 2)
), '多条已确认配料记录必须能归并到同一待领节点')

const directReadyStorage = new MemoryStorage()
directReadyStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const directReadyNode = listActivePickupNodes(directReadyStorage)
  .find((node) => node.nodeType === 'READY_TO_PICKUP')
assert(directReadyNode?.readySource === 'DIRECT_READY', '首次直接配齐节点必须明确标记 DIRECT_READY')
const serializedDirectReadyStore = directReadyStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
assert(serializedDirectReadyStore, '直接配齐节点快照必须持久化')
const reloadedDirectReadyStorage = new MemoryStorage()
reloadedDirectReadyStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializedDirectReadyStore)
assert(
  listActivePickupNodes(reloadedDirectReadyStorage)
    .find((node) => node.nodeId === directReadyNode.nodeId)?.readySource === 'DIRECT_READY',
  '直接配齐节点序列化重载后必须保持 DIRECT_READY',
)
const legacyDirectReadyStore = hydrateProductionMaterialPrepStore(reloadedDirectReadyStorage)
const legacyDirectReadySnapshot = legacyDirectReadyStore.pickupNodeSnapshots
  .find((snapshot) => snapshot.nodeId === directReadyNode.nodeId) as
    | (typeof legacyDirectReadyStore.pickupNodeSnapshots[number] & {
        nodeType?: typeof directReadyNode.nodeType
        readySource?: typeof directReadyNode.readySource
      })
    | undefined
assert(legacyDirectReadySnapshot, '旧快照兼容测试必须找到直接配齐节点快照')
delete legacyDirectReadySnapshot.nodeType
delete legacyDirectReadySnapshot.readySource
const legacyDirectReadyStorage = new MemoryStorage()
legacyDirectReadyStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(legacyDirectReadyStore),
)
assert(
  listActivePickupNodes(legacyDirectReadyStorage)
    .find((node) => node.nodeId === directReadyNode.nodeId)?.readySource === 'DIRECT_READY',
  '缺少新字段的旧直接配齐快照不得误标为 UPGRADED_FROM_INCOMPLETE',
)

const locationOwners = new Map<string, string>()
for (const node of incompleteNodes) {
  for (const item of node.items) {
    for (const location of item.sourceLocations) {
      const locationKey = [
        location.sourceWarehouseName,
        location.sourceWarehouseArea,
        location.sourceLocationCode,
      ].join('|')
      const existingOwner = locationOwners.get(locationKey)
      assert(
        !existingOwner || existingOwner === node.productionOrderId,
        `专属库位 ${locationKey} 不得同时属于生产单 ${existingOwner} 与 ${node.productionOrderId}`,
      )
      locationOwners.set(locationKey, node.productionOrderId)
    }
  }
}
assert(incompleteNodes.some((node) =>
  new Set(node.items.flatMap((item) => item.sourceLocations.map((location) =>
    `${location.sourceWarehouseName}|${location.sourceWarehouseArea}|${location.sourceLocationCode}`
  ))).size > 1
), 'Mock 必须覆盖同一生产单使用多个专属库位')
assert(incompleteNodes.some((node) =>
  node.items.some((item) => item.sourceLocations.length > 1)
), 'Mock 必须覆盖同一物料使用多个专属库位')

const upgradeStorage = new MemoryStorage()
upgradeStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const incompleteBeforeUpgrade = listActivePickupNodes(upgradeStorage)
  .find((node) => node.productionOrderId === 'PO-202603-0101')
assert(incompleteBeforeUpgrade, '缺少可用于验证未配齐升级的活动节点')
const upgradeProjection = getMaterialPrepOrderProjection(incompleteBeforeUpgrade.prepOrderId, upgradeStorage)
assert(upgradeProjection, '未配齐升级测试缺少配料单投影')
for (const [index, line] of upgradeProjection.lines.entries()) {
  if (line.remainingNeedQty <= 0) continue
  const record = appendManualPrepRecord({
    prepOrderId: upgradeProjection.order.prepOrderId,
    prepLineId: line.prepLineId,
    preparedQty: line.remainingNeedQty,
    rollCount: 1,
    warehouseArea: '中转仓升级测试区',
    locationCode: `TR-UPGRADE-${String(index + 1).padStart(3, '0')}`,
    operatorName: '中转仓 升级测试员',
  }, upgradeStorage)
  assert(pickMaterialPrepRecord(record.prepRecordId, '仓库 升级测试员', upgradeStorage), '升级测试配料记录必须完成拣货')
  assert(stageMaterialPrepRecord(record.prepRecordId, '中转仓升级测试区', '跟单 升级测试员', upgradeStorage), '升级测试配料记录必须完成暂存')
  assert(confirmMaterialPrepRecord(record.prepRecordId, '中转仓 升级测试员', upgradeStorage), '升级测试配料记录必须完成确认')
}
const upgradedNode = listActivePickupNodes(upgradeStorage)
  .find((node) => node.prepOrderId === incompleteBeforeUpgrade.prepOrderId)
assert(upgradedNode?.nodeId === incompleteBeforeUpgrade.nodeId, '未配齐升级后必须沿用原活动节点')
assert(
  listPickupDemandFacts(upgradeStorage)
    .filter((fact) => fact.prepOrderId === incompleteBeforeUpgrade.prepOrderId)
    .some((fact) => !fact.processComplete),
  '升级反例必须保留尚未最终完成的加工需求',
)
assert(
  upgradedNode.nodeType === 'INCOMPLETE_PICKABLE',
  '逐项配料齐全但必需加工未最终完成时仍必须保持未配齐',
)
assert(
  !listPickupOrderGroups('READY', upgradeStorage as Storage)
    .some((group) => group.prepOrderId === incompleteBeforeUpgrade.prepOrderId),
  '必需加工未最终完成时不得进入已配齐待领分组',
)
assert(
  upgradedNode.items.every((item) =>
    item.sourceLocations.every((location) => location.sourcePrepRecordIds.length > 0)
  ),
  '升级后底层节点若保留来源库位，必须仅作为可追溯快照',
)
assert(
  listActivePickupNodes(upgradeStorage)
    .find((node) => node.nodeId === upgradedNode.nodeId)?.readySource === null,
  '加工阻断的未配齐节点在重复投影时不得误标为升级配齐',
)

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const lifecycleProjection = listMaterialPrepOrderProjections(storage)
  .find((projection) => projection.lines.some((line) => line.remainingNeedQty > 0))
assert(lifecycleProjection, '缺少可用于验证配料生命周期的生产单')
const lifecycleLine = lifecycleProjection.lines.find((line) => line.remainingNeedQty > 0)!
const draft = appendManualPrepRecord({
  prepOrderId: lifecycleProjection.order.prepOrderId,
  prepLineId: lifecycleLine.prepLineId,
  preparedQty: Math.min(lifecycleLine.remainingNeedQty, 1),
  rollCount: 1,
  warehouseArea: '中转仓测试区',
  locationCode: 'TR-CHECK-001',
  operatorName: '中转仓 测试员',
}, storage)
assert(getMaterialPrepRecordItems(draft).length === 1, '新增配料记录必须保留物料明细')
assert(confirmMaterialPrepRecord(draft.prepRecordId, '中转仓 测试员', storage) === null, 'DRAFT 不得越级直接确认')
assert(pickMaterialPrepRecord(draft.prepRecordId, '仓库 拣货员', storage)?.recordStatus === 'PICKED', 'DRAFT 必须先进入 PICKED')
assert(stageMaterialPrepRecord(draft.prepRecordId, '中转仓测试区', '跟单 暂存员', storage)?.recordStatus === 'STAGED', 'PICKED 必须再进入 STAGED')
assert(confirmMaterialPrepRecord(draft.prepRecordId, '中转仓 确认员', storage)?.recordStatus === 'CONFIRMED', 'STAGED 才能进入 CONFIRMED')
assert(listActivePickupNodes(storage).some((node) =>
  node.items.some((item) => item.sourcePrepRecordIds.includes(draft.prepRecordId))
), '确认后的配料记录必须进入对应活动节点')

rejectMaterialPrepRecord(
  draft.prepRecordId,
  '测试打回',
  '验证整条记录打回后退出活动节点',
  '裁床 测试员',
  storage,
)
assert(!listActivePickupNodes(storage).some((node) =>
  node.items.some((item) => item.sourcePrepRecordIds.includes(draft.prepRecordId))
), '被打回配料记录不得继续出现在活动节点')

closeMaterialPrepOrder(lifecycleProjection.order.prepOrderId, '测试按实关闭', '中转仓 测试员', storage)
const closedProjection = getMaterialPrepOrderProjection(lifecycleProjection.order.prepOrderId, storage)
assert(closedProjection?.order.overallPrepStatus === 'CLOSED', '关闭后配料单必须进入已关闭')
assert(closedProjection.order.pickupStatus === 'ACTUAL_CLOSED', '关闭后领料端必须派生为按实完结')

console.log(
  JSON.stringify({
    PFOS领料路由: '通过',
    PFOS列表详情与PDA同源: '通过',
    一生产单一配料单: '通过',
    每单最多一活动节点: '通过',
    配料记录生命周期: 'DRAFT → PICKED → STAGED → CONFIRMED',
    当前来源货位与单位: '通过',
    配料状态覆盖: materialPrepWorkbenchTabs.map((tab) => tab.key),
    领料状态定义: pickupWorkbenchTabs.map((tab) => tab.key),
    已领料完结与退回规则: '通过',
  }, null, 2),
)
