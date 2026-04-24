import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listPostFinishingActionRecords,
  listPostFinishingRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'

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
const specialCraftDetail = read('src/pages/process-factory/special-craft/work-order-detail.ts')
const appShell = read('src/data/app-shell-config.ts')
const routes = read('src/router/routes-fcs.ts')
const renderers = read('src/router/route-renderers-fcs.ts')
const factoryProfile = read('src/pages/factory-profile.ts')
const factoryMock = read('src/data/fcs/factory-mock-data.ts')
const factoryMaster = read('src/data/fcs/factory-master-store.ts')

assertNotIncludes(printingList, 'renderViewTabs', '印花加工单列表页不应再调用 renderViewTabs')
assertNotIncludes(printingList, 'renderViewHint', '印花加工单列表页不应再展示视图说明卡')
assertNotIncludes(dyeingList, 'renderViewTabs', '染色加工单列表页不应再调用 renderViewTabs')
assertNotIncludes(dyeingList, 'renderFormulaView', '染色加工单列表页不应再调用 renderFormulaView')
assertNotIncludes(specialCraftShared, '当前特殊工艺', '特殊工艺页面布局不应再渲染当前特殊工艺信息卡')
assertNotIncludes(specialCraftShared, 'subNavItems', '特殊工艺页面布局不应再渲染顶部二级切换卡片')

;['base', 'pattern', 'execution', 'handover', 'review', 'progress', 'exception'].forEach((tab) => {
  assertIncludes(printingDetail, `'${tab}'`, `印花详情页缺少 tab=${tab}`)
})
;['base', 'sample', 'execution', 'formula', 'handover', 'review', 'statistics', 'exception'].forEach((tab) => {
  assertIncludes(dyeingDetail, `'${tab}'`, `染色详情页缺少 tab=${tab}`)
})
;['base', 'lines', 'fei', 'quantity', 'difference', 'events'].forEach((tab) => {
  assertIncludes(specialCraftDetail, `'${tab}'`, `特殊工艺详情页缺少 tab=${tab}`)
})

assertNotIncludes(appShell, '染色配方', '染厂菜单不应出现染色配方')
assertIncludes(appShell, '染色统计', '染厂菜单必须出现染色统计')
;['src/pages/process-factory/dyeing/work-orders.ts', 'src/pages/process-factory/dyeing/work-order-detail.ts', 'src/pages/process-factory/dyeing/reports.ts'].forEach((path) => {
  assertNotIncludes(read(path), '染色报表', `${path} 不应出现用户可见的染色报表`)
})

;[factoryProfile, factoryMock, factoryMaster].forEach((source, index) => {
  const label = ['factory-profile.ts', 'factory-mock-data.ts', 'factory-master-store.ts'][index]
  ;['开扣眼', '装扣子', '熨烫', '包装'].forEach((term) => {
    assertNotIncludes(source, term, `${label} 的工厂档案接单能力不应展示 ${term}`)
  })
})
assertIncludes(factoryProfile, '后道', '工厂档案必须保留后道能力')
assertIncludes(factoryProfile, '质检', '后道工厂能力必须包含质检')
assertIncludes(factoryProfile, '复检', '后道工厂能力必须包含复检')

;['后道工厂管理', '后道单', '质检单', '复检单', '后道待加工仓', '后道交出仓', '后道统计'].forEach((label) => {
  assertIncludes(appShell, label, `后道工厂菜单缺少 ${label}`)
})
;[
  'renderPostFinishingWorkOrdersPage',
  'renderPostFinishingQcOrdersPage',
  'renderPostFinishingRecheckOrdersPage',
  'renderPostFinishingWaitProcessWarehousePage',
  'renderPostFinishingWaitHandoverWarehousePage',
  'renderPostFinishingStatisticsPage',
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
].forEach((route) => {
  assertIncludes(routes, route, `后道路由缺少 ${route}`)
})

const postCounts = new Map<string, number>()
listPostFinishingActionRecords().forEach((record) => {
  postCounts.set(record.actionType, (postCounts.get(record.actionType) || 0) + 1)
})
;['后道', '质检', '复检'].forEach((actionType) => {
  assert((postCounts.get(actionType) || 0) >= 3, `后道 mock 数据中 ${actionType} 记录不足 3 行`)
})

const handoverRecordIds = new Set(listPostFinishingWaitHandoverWarehouseRecords().map((record) => record.recheckActionId))
listPostFinishingRecheckOrders()
  .filter((record) => record.status.includes('完成'))
  .forEach((record) => {
    assert(handoverRecordIds.has(record.actionId), `复检完成记录未关联后道交出仓: ${record.actionId}`)
  })

listPostFinishingWorkOrders()
  .filter((order) => order.routeMode === '非专门工厂含后道')
  .forEach((order) => {
    assert(order.currentFactoryId !== order.managedPostFactoryId, `非专门后道场景当前工厂不应等于后道工厂: ${order.postOrderNo}`)
    if (order.qcAction) {
      assert(order.qcAction.factoryId === order.managedPostFactoryId, `非专门工厂不应生成本厂质检单: ${order.postOrderNo}`)
    }
    if (order.recheckAction) {
      assert(order.recheckAction.factoryId === order.managedPostFactoryId, `非专门工厂不应生成本厂复检单: ${order.postOrderNo}`)
    }
  })

console.log('process factory tabs and post finishing checks passed')
