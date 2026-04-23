#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  getFactoryMobileTodoCount,
  getFactoryMobileTodoSummary,
  getFactoryMobileTodos,
} from '../src/data/fcs/factory-mobile-todos.ts'
import { getFactoryMobileWarehouseCards, getFactoryMobileWarehouseOverview } from '../src/data/fcs/factory-mobile-warehouse.ts'
import {
  listFactoryInternalWarehouses,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeOrders,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
} from '../src/data/fcs/factory-internal-warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function joinText(parts: string[]): string {
  return parts.join('')
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function flattenMenuItems(groups: typeof menusBySystem.fcs) {
  return groups.flatMap((group) => group.items).flatMap((item) => item.children || [item])
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const shellSource = read('src/pages/pda-shell.ts')
const notifySource = read('src/pages/pda-notify.ts')
const notifyDetailSource = read('src/pages/pda-notify-detail.ts')
const warehouseSource = read('src/pages/pda-warehouse.ts')
const waitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
const waitHandoverSource = read('src/pages/pda-warehouse-wait-handover.ts')
const inboundSource = read('src/pages/pda-warehouse-inbound-records.ts')
const outboundSource = read('src/pages/pda-warehouse-outbound-records.ts')
const stocktakeSource = read('src/pages/pda-warehouse-stocktake.ts')
const sharedWarehouseSource = read('src/pages/pda-warehouse-shared.ts')
const handoverDetailSource = read('src/pages/pda-handover-detail.ts')
const todoDataSource = read('src/data/fcs/factory-mobile-todos.ts')
const warehouseViewSource = read('src/data/fcs/factory-mobile-warehouse.ts')
const routeSource = read('src/router/routes-pda.ts')
const rendererSource = read('src/router/route-renderers.ts')
const handlerSource = read('src/main-handlers/pda-handlers.ts')

const mobilePageSources = [
  shellSource,
  notifySource,
  notifyDetailSource,
  warehouseSource,
  waitProcessSource,
  waitHandoverSource,
  inboundSource,
  outboundSource,
  stocktakeSource,
].join('\n')

const wmsForbiddenTerms = [
  joinText(['库存', '三态']),
  joinText(['可用', '库存']),
  joinText(['占用', '库存']),
  joinText(['在途', '库存']),
  ['available', 'Stock'].join(''),
  ['occupied', 'Stock'].join(''),
  ['inTransit', 'Stock'].join(''),
  joinText(['上架', '任务']),
  joinText(['拣货', '波次']),
  joinText(['拣货', '路径']),
  joinText(['库位', '规则']),
  joinText(['完整', '库存账']),
]

const legacyWarehouseTerms = [joinText(['来', '料仓']), joinText(['半成品', '仓'])]
const factoryId = listFactoryInternalWarehouses()[0]?.factoryId || 'ID-F001'
const factoryName = listFactoryInternalWarehouses()[0]?.factoryName || '示例工厂'
const todos = getFactoryMobileTodos(factoryId)
const todoCount = getFactoryMobileTodoCount(factoryId)
const todoSummary = getFactoryMobileTodoSummary(factoryId)
const warehouseOverview = getFactoryMobileWarehouseOverview(factoryId, factoryName)
const warehouseCards = getFactoryMobileWarehouseCards(factoryId, factoryName)
const activeTodoCount = todos.filter((item) => item.status === '待处理' || item.status === '处理中').length
const mobileMenuItems = flattenMenuItems(menusBySystem.fcs).filter((item) => String(item.href || '').startsWith('/fcs/pda'))

assertContains(packageSource, '"check:factory-mobile-app-redesign": "tsx scripts/check-factory-mobile-app-redesign.ts"', 'package.json 缺少工厂端移动应用改造检查命令')

;['接单', '执行', '交接', '仓管', '结算'].forEach((token) => {
  assertContains(shellSource, `label: '${token}'`, `底部 Tab 缺少：${token}`)
})
assertNotContains(shellSource, "label: '待办'", '底部 Tab 不应保留待办')
assertContains(shellSource, 'data-pda-todo-trigger="true"', '缺少右上角待办入口')
assertContains(shellSource, 'getFactoryMobileTodoCount', '待办入口未接待办数量')
assertContains(shellSource, '当前待办', '缺少当前待办弹窗')
assertContains(shellSource, '查看全部', '当前待办弹窗缺少查看全部')
assertContains(shellSource, 'hasShownTodoModalInSession'.replace('hasShownTodoModalInSession', 'shownTodoSessionKey'), '缺少会话级待办弹窗控制')

;[
  '待接单',
  '待领料',
  '待开工',
  '待完工',
  '待交出',
  '差异待处理',
  '异常待处理',
  '对账待确认',
].forEach((token) => {
  assertContains(todoDataSource, `'${token}'`, `待办类型缺少：${token}`)
})
assertContains(todoDataSource, 'getFactoryMobileTodos', '缺少待办查询 helper')
assertContains(todoDataSource, 'getFactoryMobileTodoCount', '缺少待办数量 helper')
assertContains(todoDataSource, 'getFactoryMobileTodoById', '缺少待办详情 helper')
assertContains(todoDataSource, 'getFactoryMobileTodoSummary', '缺少待办汇总 helper')
assert(todoCount === activeTodoCount, '待办总数必须只统计待处理和处理中')
assert(todoSummary.total === todoCount, '待办汇总总数必须与待办总数一致')

assertContains(notifySource, '待办汇总', '缺少待办汇总页')
assertContains(notifyDetailSource, '待办详情', '缺少待办详情页')
assertContains(notifyDetailSource, '去处理', '待办详情缺少去处理动作')
assertContains(notifyDetailSource, '返回', '待办详情缺少返回动作')

assertContains(routeSource, '/fcs/pda/warehouse', '缺少仓管首页路由')
assertContains(routeSource, '/fcs/pda/warehouse/wait-process', '缺少待加工仓路由')
assertContains(routeSource, '/fcs/pda/warehouse/wait-handover', '缺少待交出仓路由')
assertContains(routeSource, '/fcs/pda/warehouse/inbound-records', '缺少入库记录路由')
assertContains(routeSource, '/fcs/pda/warehouse/outbound-records', '缺少出库记录路由')
assertContains(routeSource, '/fcs/pda/warehouse/stocktake', '缺少盘点路由')
assertContains(routeSource, '/fcs/pda/notify', '缺少待办汇总路由')
assertContains(routeSource, '/fcs/pda/task-receive', '缺少接单路由')
assertContains(routeSource, '/fcs/pda/exec', '缺少执行路由')
assertContains(routeSource, '/fcs/pda/handover', '缺少交接路由')
assertContains(routeSource, '/fcs/pda/settlement', '缺少结算路由')

;[
  'renderPdaWarehousePage',
  'renderPdaWarehouseWaitProcessPage',
  'renderPdaWarehouseWaitHandoverPage',
  'renderPdaWarehouseInboundRecordsPage',
  'renderPdaWarehouseOutboundRecordsPage',
  'renderPdaWarehouseStocktakePage',
].forEach((token) => {
  assertContains(rendererSource, token, `缺少页面渲染器：${token}`)
  assertContains(handlerSource, token.replace('render', 'handle').replace('Page', 'Event'), `缺少页面事件分发：${token}`)
})

assertContains(warehouseSource, '仓管', '缺少仓管首页')
;['待加工仓', '待交出仓', '入库记录', '出库记录', '盘点', '差异'].forEach((token) => {
  assertContains(warehouseSource + sharedWarehouseSource, token, `仓管首页缺少：${token}`)
})
assert(warehouseCards.length === 6, '仓管首页卡片数量必须为 6')
assert(warehouseCards.some((card) => card.title === '待加工仓'), '仓管首页缺少待加工仓卡片')
assert(warehouseCards.some((card) => card.title === '待交出仓'), '仓管首页缺少待交出仓卡片')
assert(warehouseCards.some((card) => card.title === '入库记录'), '仓管首页缺少入库记录卡片')
assert(warehouseCards.some((card) => card.title === '出库记录'), '仓管首页缺少出库记录卡片')
assert(warehouseCards.some((card) => card.title === '盘点'), '仓管首页缺少盘点卡片')
assert(warehouseCards.some((card) => card.title === '差异'), '仓管首页缺少差异卡片')

;[
  '来源单号',
  '来源对象',
  '所属任务',
  '物料 / 裁片类型',
  '面料 SKU / 裁片部位',
  '颜色',
  '尺码',
  '菲票号',
  '中转袋号',
  '卷号',
  '应收数量',
  '实收数量',
  '差异数量',
  '库区',
  '货架',
  '库位',
  '状态',
].forEach((token) => {
  assertContains(waitProcessSource, token, `待加工仓页面字段缺少：${token}`)
})

;[
  '来源任务',
  '加工完成数量',
  '损耗数量',
  '待交出数量',
  '接收方',
  '交出单',
  '交出记录',
  '回写数量',
  '差异 / 异议',
  '状态',
].forEach((token) => {
  assertContains(waitHandoverSource, token, `待交出仓页面字段缺少：${token}`)
})

;[
  '入库单号',
  '来源单号',
  '来源对象',
  '所属任务',
  '物料 / 裁片类型',
  '应收数量',
  '实收数量',
  '差异数量',
  '操作人',
  '操作时间',
  '状态',
].forEach((token) => {
  assertContains(inboundSource, token, `入库记录页面字段缺少：${token}`)
})

;[
  '出库单号',
  '来源任务',
  '交出单',
  '交出记录',
  '接收方',
  '出库数量',
  '回写数量',
  '差异数量',
  '操作人',
  '出库时间',
  '状态',
].forEach((token) => {
  assertContains(outboundSource, token, `出库记录页面字段缺少：${token}`)
})

;['盘点', '创建全盘', '待加工仓', '待交出仓', '账面数量', '实盘数量', '差异原因'].forEach((token) => {
  assertContains(stocktakeSource, token, `盘点页面缺少：${token}`)
})
assertNotContains(stocktakeSource, joinText(['抽', '盘']), '盘点页面不应支持抽盘')
assertNotContains(stocktakeSource, joinText(['循环', '盘']), '盘点页面不应支持循环盘')

assertContains(warehouseViewSource, "from './factory-internal-warehouse.ts'", '仓管视图层未复用 Prompt 2 工厂内部仓模型')
assertNotContains(warehouseViewSource, 'interface FactoryWaitProcessStockItem', '仓管视图层不应重复定义库存主模型')
assertNotContains(warehouseViewSource, 'interface FactoryWaitHandoverStockItem', '仓管视图层不应重复定义待交出库存主模型')

assert(listFactoryWaitProcessStockItems().some((item) => item.factoryId === factoryId), '缺少待加工仓数据')
assert(listFactoryWaitHandoverStockItems().some((item) => item.factoryId === factoryId), '缺少待交出仓数据')
assert(listFactoryWarehouseInboundRecords().some((item) => item.factoryId === factoryId), '缺少入库记录数据')
assert(listFactoryWarehouseOutboundRecords().some((item) => item.factoryId === factoryId), '缺少出库记录数据')
assert(listFactoryWarehouseStocktakeOrders().some((item) => item.factoryId === factoryId), '缺少盘点数据')
assert(warehouseOverview.waitProcessCount >= 0, '仓管概览待加工数量异常')
assert(warehouseOverview.waitHandoverCount >= 0, '仓管概览待交出数量异常')
assert(warehouseOverview.todayInboundQty >= 0, '仓管概览今日入库数量异常')
assert(warehouseOverview.todayOutboundQty >= 0, '仓管概览今日出库数量异常')
assert(warehouseOverview.objectionCount >= 0, '仓管概览异议中数量异常')
;['待加工数量', '待交出数量', '今日入库', '今日出库', '差异', '异议中'].forEach((token) => {
  assertContains(sharedWarehouseSource + warehouseViewSource, token, `工厂端仓管统计卡缺少：${token}`)
})

const mobileWarehouseSources = [
  warehouseSource,
  waitProcessSource,
  waitHandoverSource,
  inboundSource,
  outboundSource,
  stocktakeSource,
  warehouseViewSource,
].join('\n')

wmsForbiddenTerms.forEach((term) => {
  assertNotContains(mobileWarehouseSources, term, `移动端仓管不应出现：${term}`)
})
legacyWarehouseTerms.forEach((term) => {
  assertNotContains(mobileWarehouseSources, term, `移动端仓管仍保留旧仓库称呼：${term}`)
})

assertNotContains(waitProcessSource, buildToken('新增', '库存'), `待加工仓页面不应允许${buildToken('手动', '新增', '库存')}`)
assertNotContains(waitHandoverSource, buildToken('新增', '库存'), `待交出仓页面不应允许${buildToken('手动', '新增', '库存')}`)
assertNotContains(inboundSource, buildToken('新增', '入库记录'), '入库记录页面不应出现手动新增主入口')
assertNotContains(outboundSource, buildToken('新增', '出库记录'), '出库记录页面不应出现手动新增主入口')
assertNotContains(waitProcessSource, buildToken('确认', '领料'), '待加工仓页面不应承接确认领料主流程')
assertNotContains(waitProcessSource, buildToken('手动', '入库'), `待加工仓页面不应承接${buildToken('手动', '入库')}主流程`)
assertNotContains(waitHandoverSource, buildToken('新增', '交出记录'), '待交出仓页面不应承接新增交出记录主流程')
assertNotContains(waitHandoverSource, buildToken('手动', '出库'), `待交出仓页面不应承接${buildToken('手动', '出库')}主流程`)
assertContains(waitProcessSource, '来源动作', '待加工仓页面缺少来源动作展示')
assertContains(waitProcessSource, '入库记录', '待加工仓页面缺少入库记录展示')
assertContains(waitHandoverSource, '出库记录', '待交出仓页面缺少出库记录展示')
assert(
  inboundSource.includes('自动转单') || inboundSource.includes('getWarehouseGeneratedModeLabel'),
  '入库记录页面缺少自动转单展示',
)
assert(
  outboundSource.includes('自动转单') || outboundSource.includes('getWarehouseGeneratedModeLabel'),
  '出库记录页面缺少自动转单展示',
)
assertContains(handoverDetailSource, '已入待加工仓', '交接详情缺少待加工仓联动提示')
assertContains(handoverDetailSource, '已生成出库记录', '交接详情缺少出库联动提示')

assert(mobileMenuItems.some((item) => item.title === '仓管' && item.href === '/fcs/pda/warehouse'), '移动端菜单缺少仓管入口')

console.log(
  JSON.stringify(
    {
      底部Tab: '通过',
      待办入口: '通过',
      待办页面: '通过',
      仓管页面: '通过',
      仓库模型复用: '通过',
    },
    null,
    2,
  ),
)
