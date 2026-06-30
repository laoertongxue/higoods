import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { state } from '../src/pages/production/context.ts'
import { renderProductionOrdersPage } from '../src/pages/production/orders-domain.ts'

const firstOrder = productionOrders[0]
const secondOrder = productionOrders[1]
assert(firstOrder, '必须存在第一条生产单')
assert(secondOrder, '必须存在第二条生产单')

const collapsedHtml = renderProductionOrdersPage()
assert(!collapsedHtml.includes('<th class="min-w-[230px] px-3 py-3 text-left font-medium">配料 / 领料</th>'), '生产单管理上半部分不得展示配料 / 领料列')
assert(collapsedHtml.includes('展开台账'), '操作栏必须展示展开台账按钮')
assert(!collapsedHtml.includes('生产台账明细'), '默认不得渲染生产台账明细')
assert(!collapsedHtml.includes('1）配料 / 领料明细'), '默认不得渲染台账四个模块')

assert(firstOrder.ledgerDetails.materialIssues.length > 0, '生产单必须带配料 / 领料台账明细')
assert(firstOrder.ledgerDetails.taskFactories.length > 0, '生产单必须带任务单 / 工厂台账明细')
assert(firstOrder.ledgerDetails.keyTimes.length > 0, '生产单必须带关键时间台账明细')
assert(firstOrder.ledgerDetails.quantityQuality.length > 0, '生产单必须带数量 / 质量台账明细')

state.openLedgerOrderId = firstOrder.productionOrderId
state.loadedLedgerIds = new Set([firstOrder.productionOrderId])
state.loadingLedgerOrderId = null
const expandedHtml = renderProductionOrdersPage()
;['1）配料 / 领料明细', '2）任务单 / 工厂明细', '3）关键时间明细', '4）数量 / 质量明细'].forEach((title) => {
  assert(expandedHtml.includes(title), `展开后必须展示：${title}`)
})
assert(expandedHtml.includes('收起台账'), '展开后按钮必须变为收起台账')
assert(expandedHtml.includes('装扣子'), '第一条台账必须展示任务明细')
assert(expandedHtml.includes('任务未分配'), '第一条台账必须展示任务未分配问题')
assert(expandedHtml.includes('分配任务'), '第一条台账必须展示分配任务操作')
assert(!expandedHtml.includes('设置工厂'), '台账任务操作不得展示设置工厂')
assert(!expandedHtml.includes('未设置加工厂'), '台账任务问题不得展示未设置加工厂')
assert(!expandedHtml.includes('正在加载生产台账...'), '已加载过的台账再次展开不得显示加载态')

state.openLedgerOrderId = secondOrder.productionOrderId
state.loadedLedgerIds = new Set([firstOrder.productionOrderId, secondOrder.productionOrderId])
state.loadingLedgerOrderId = null
const secondExpandedHtml = renderProductionOrdersPage()
assert(secondExpandedHtml.includes(secondOrder.productionOrderId), '第二条生产单仍需正常渲染')
assert(secondExpandedHtml.includes('等待车缝'), '第二条台账必须展示等待车缝状态')
assert(!secondExpandedHtml.includes('任务未分配'), '展开第二条时第一条台账必须自动收起')

console.log('production order ledger row check passed')
