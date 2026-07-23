#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  derivePickupStatus,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordItems,
  listActivePickupNodes,
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
const pdaWaitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
const warehouseHubSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
const fcsHandlersSource = read('src/main-handlers/fcs-handlers.ts')
const pdaAccessSource = read('src/data/fcs/factory-onboarding-flow.ts')
const pdaRuntimeSource = read('src/pages/pda-runtime.ts')
const cuttingRuntimeLedgerSource = read('src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
const dataSource = read('src/data/fcs/cutting/production-material-prep.ts')

assert(appShellConfig.includes("title: '领料管理'"), 'PFOS 裁前准备缺少领料管理菜单')
assert(appShellConfig.includes("href: '/fcs/craft/cutting/pickup-management'"), 'PFOS 领料管理菜单路由错误')
assert(routesFcs.includes('/fcs/craft/cutting/pickup-management'), 'PFOS 领料管理路由缺失')
assert(routesFcs.includes('/fcs/craft/cutting/pickup-management-detail'), 'PFOS 领料详情路由缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupManagementPage'), 'PFOS 领料管理 renderer 缺失')
assert(routeRenderersFcs.includes('renderCraftCuttingPickupManagementDetailPage'), 'PFOS 领料详情 renderer 缺失')
assert(pickupManagementSource.includes('// @page-pattern: list'), '领料管理必须声明标准列表页模式')
assert(pickupManagementSource.includes('renderStandardListPage'), '领料管理必须使用标准列表页骨架')
assert(pickupManagementSource.includes('renderStandardListTable'), '领料管理必须使用标准列表表格')
assert(pickupManagementSource.includes('renderTablePagination'), '领料管理必须保留分页')
assert(pickupManagementSource.includes('listActivePickupNodes'), '领料管理必须以活动待领节点为当前待办对象')
assert(pickupManagementSource.includes('renderCraftCuttingPickupManagementDetailPage'), '领料管理必须保留节点详情页')
assert(fcsHandlersSource.includes('handleCraftCuttingPickupManagementEvent'), 'FCS handler 必须承接领料管理交互')
assert(pdaWaitProcessSource.includes('listActivePickupNodes'), 'PDA 必须读取与 PC 同源的活动待领节点')
assert(pdaWaitProcessSource.includes('appendPickupSessionFromNode'), 'PDA 确认必须调用统一节点领料入口')
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
  if (status === 'PICKUP_DONE') continue
  assert(projections.some((projection) => projection.order.pickupStatus === status), `领料工作台缺少状态样例：${status}`)
}

const activeNodes = listActivePickupNodes(null)
assert(activeNodes.length > 0, '已确认且尚未领取的物料必须形成活动待领节点')
assert(new Set(activeNodes.map((node) => node.prepOrderId)).size === activeNodes.length, '同一配料单同一时刻最多一个活动节点')
assert(activeNodes.every((node) => node.items.length > 0), '活动节点必须包含当前全部可领物料')
assert(activeNodes.some((node) => node.nodeType === 'INCOMPLETE_PICKABLE'), 'Mock 缺少未配齐可领节点')
assert(activeNodes.some((node) => node.nodeType === 'READY_TO_PICKUP'), 'Mock 缺少已配齐待领节点')
assert(activeNodes.some((node) =>
  node.items.some((item) => item.sourcePrepRecordIds.length >= 2)
), '多条已确认配料记录必须能归并到同一待领节点')
assert(activeNodes.every((node) =>
  node.items.every((item) =>
    item.sourceLocations.length > 0 &&
    item.sourceLocations.every((location) => location.unit === item.unit)
  )
), '节点物料必须保留按本行单位记录的当前来源货位事实')

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
