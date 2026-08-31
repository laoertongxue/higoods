import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listPostFinishingActionRecords,
  listPostFinishingRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

const printingList = read('src/pages/process-factory/printing/work-orders.ts')
const dyeingList = read('src/pages/process-factory/dyeing/work-orders.ts')
const specialCraftShared = read('src/pages/process-factory/special-craft/shared.ts')
const printingDetail = read('src/pages/process-factory/printing/work-order-detail.ts')
const dyeingDetail = read('src/pages/process-factory/dyeing/work-order-detail.ts')
const specialCraftDetail = read('src/pages/process-factory/special-craft/task-detail.ts')
const appShell = read('src/data/app-shell-config.ts')
const routes = read('src/router/routes-fcs.ts')
const renderers = read('src/router/route-renderers-fcs.ts')
const factoryProfile = read('src/pages/factory-profile.ts')
const factoryMock = read('src/data/fcs/factory-mock-data.ts')
const mergedTaskDomain = read('src/data/fcs/merged-production-task.ts')

assertNotIncludes(printingList, 'renderViewTabs', '印花加工单列表页不应再调用 renderViewTabs')
assertNotIncludes(printingList, 'renderViewHint', '印花加工单列表页不应再展示视图说明卡')
assertNotIncludes(dyeingList, 'renderViewTabs', '染色加工单列表页不应再调用 renderViewTabs')
assertNotIncludes(dyeingList, 'renderFormulaView', '染色加工单列表页不应再调用 renderFormulaView')
assertNotIncludes(specialCraftShared, '当前特殊工艺', '特殊工艺页面布局不应再渲染当前特殊工艺信息卡')
assertNotIncludes(specialCraftShared, 'subNavItems', '特殊工艺页面布局不应再渲染顶部二级切换卡片')

assertNotIncludes(printingDetail, 'renderViewTabs', '印花详情页已收口为单页事实视图，不应恢复顶部视图 Tab')
;['base', 'sample', 'execution', 'formula', 'handover', 'review', 'statistics', 'exception'].forEach((tab) => {
  assertIncludes(dyeingDetail, `'${tab}'`, `染色详情页缺少 tab=${tab}`)
})
;['overview', 'demand', 'warehouse', 'events'].forEach((tab) => {
  assertIncludes(specialCraftDetail, `'${tab}'`, `特殊工艺任务详情页缺少 tab=${tab}`)
})

assertNotIncludes(appShell, '染色配方', '染厂菜单不应出现染色配方')
assertIncludes(appShell, '染色统计', '染厂菜单必须出现染色统计')
;['src/pages/process-factory/dyeing/work-orders.ts', 'src/pages/process-factory/dyeing/work-order-detail.ts', 'src/pages/process-factory/dyeing/reports.ts'].forEach((path) => {
  assertNotIncludes(read(path), '染色报表', `${path} 不应出现用户可见的染色报表`)
})

assertIncludes(factoryProfile, '合并任务只允许车缝+烫包、裁剪+车缝+烫包两种固定范围', '工厂档案缺少固定合并任务边界')
const activeFactoryAbilities = listFactoryMasterRecords()
  .flatMap((factory) => factory.processAbilities)
  .filter((ability) => (ability.status ?? 'ACTIVE') !== 'DISABLED')
for (const [processCode, processName] of [['BUTTONHOLE', '开扣眼'], ['BUTTON_ATTACH', '装扣子'], ['IRON_PACK', '烫包']] as const) {
  assert(activeFactoryAbilities.some((ability) => ability.processCode === processCode && ability.processName === processName), `工厂能力数据缺少后道阶段实际工序 ${processName}`)
}
for (const flowOnlyCode of ['POST_FINISHING', 'QC', 'RECHECK']) {
  assert(!activeFactoryAbilities.some((ability) => ability.processCode === flowOnlyCode), `工厂能力数据不得保留流程节点 ${flowOnlyCode}`)
}
assertIncludes(factoryMock, "['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK']", '工厂 Mock 必须使用后道三项当前工序能力')
assertNotIncludes(factoryProfile, "craftName: '质检'", '质检是回货后的流程节点，不得作为工厂实际工序能力')
assertNotIncludes(factoryProfile, "craftName: '复检'", '复检是回货后的流程节点，不得作为工厂实际工序能力')
assertIncludes(mergedTaskDomain, '车缝+烫包', '合并任务规则必须使用实际工序名称烫包')
assertNotIncludes(mergedTaskDomain, '车缝+后道', '合并任务规则不得把阶段名当作实际工序')

;['后道工厂管理', '回货确认与送检', 'Web 质检工作台', '质检任务管理', '后道加工任务', '复检单', '后道待交出仓', '后道出货单', '差异与操作日志'].forEach((label) => {
  assertIncludes(appShell, label, `后道阶段菜单缺少 ${label}`)
})
;[
  'renderPostFinishingWorkOrdersPage',
  'renderPostFinishingQcOrdersPage',
  'renderPostFinishingRecheckOrdersPage',
  'renderPostFinishingWaitProcessWarehousePage',
  'renderPostFinishingWaitHandoverWarehousePage',
  'renderPostFinishingStatisticsPage',
  'renderPostFinishingOutboundOrdersPage',
].forEach((renderer) => {
  assertIncludes(renderers, renderer, `后道 renderer 缺少 ${renderer}`)
})
;[
  '/fcs/craft/post-finishing/work-orders',
  '/fcs/craft/post-finishing/qc-orders',
  '/fcs/craft/post-finishing/recheck-orders',
  '/fcs/craft/post-finishing/wait-process-warehouse',
  '/fcs/craft/post-finishing/wait-handover-warehouse',
  '/fcs/craft/post-finishing/statistics',
  '/fcs/craft/post-finishing/outbound-orders',
].forEach((route) => {
  assertIncludes(routes, route, `后道路由缺少 ${route}`)
})

const postCounts = new Map<string, number>()
listPostFinishingActionRecords().forEach((record) => {
  postCounts.set(record.actionType, (postCounts.get(record.actionType) || 0) + 1)
})
;[['扫码收货', 3], ['后道', 3], ['质检', 3], ['复检', 2]].forEach(([actionType, minimum]) => {
  assert((postCounts.get(String(actionType)) || 0) >= Number(minimum), `后道阶段 mock 数据中 ${actionType} 记录不足 ${minimum} 行`)
})

const handoverRecordIds = new Set(listPostFinishingWaitHandoverWarehouseRecords().map((record) => record.recheckOrderId))
listPostFinishingRecheckOrders()
  .filter((record) => record.status.includes('完成'))
  .forEach((record) => {
    assert(handoverRecordIds.has(record.actionId), `复检完成记录未关联后道交出仓: ${record.actionId}`)
  })

listPostFinishingWorkOrders()
  .filter((order) => order.routeMode === '车缝厂已做后道')
  .forEach((order) => {
    assert(order.isPostDoneBySewingFactory, `车缝厂已做后道场景必须标记后道来源: ${order.postOrderNo}`)
    assert(order.sourceSewingFactoryId !== order.managedPostFactoryId, `车缝厂已做后道场景必须保留来源车缝工厂: ${order.postOrderNo}`)
    assert(order.postAction.status === '跳过后道', `车缝厂已做后道场景后道工厂不得再执行后道: ${order.postOrderNo}`)
    if (order.qcAction) {
      assert(order.qcAction.factoryId === order.managedPostFactoryId, `车缝厂不得生成本厂质检单: ${order.postOrderNo}`)
    }
    if (order.recheckAction) {
      assert(order.recheckAction.factoryId === order.managedPostFactoryId, `车缝厂不得生成本厂复检单: ${order.postOrderNo}`)
    }
  })

console.log('process factory tabs and post finishing checks passed')
