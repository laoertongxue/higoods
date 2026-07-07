import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { renderProductionChangesPage } from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import {
  listProductionOrderChangeScenarioCatalog,
  listProductionOrderChangeOrders,
  listProductionOrderChangeImpactRows,
  listProductionOrderChangeDocumentActions,
  listProductionOrderChangeCostImpacts,
  listProductionOrderChangeTimingImpacts,
} from '../src/data/fcs/production-tech-pack-change-domain.ts'

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function assertUniqueIds(rows: Array<{ id: string }>, label: string): void {
  const duplicatedIds = rows
    .map((row) => row.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index)
  assert.deepEqual([...new Set(duplicatedIds)], [], `${label} ID 必须唯一`)
}

const html = renderProductionChangesPage()

;[
  '生产单变更管理',
  '变更单',
  '生产影响',
  '单据处理',
  '料工费差异',
  '时效影响',
  '立即止损',
  '影响范围锁定',
  '80 个场景',
  '变更前',
  '变更后',
].forEach((text) => {
  assert.ok(html.includes(text), `页面缺少「${text}」`)
})

assert.ok(!html.includes('生产单变更影响台账'), '页面不应展示「生产单变更影响台账」')

const scenarios = listProductionOrderChangeScenarioCatalog()
const orders = listProductionOrderChangeOrders()
const impacts = listProductionOrderChangeImpactRows()
const documentActions = listProductionOrderChangeDocumentActions()
const costImpacts = listProductionOrderChangeCostImpacts()
const timingImpacts = listProductionOrderChangeTimingImpacts()
const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))

assert.equal(scenarios.length, 80, '生产单变更场景目录必须正好 80 条')
assert.ok(orders.length >= 24, '变更单样例至少 24 条')
assert.ok(impacts.length >= 36, '生产影响行至少 36 条')
assert.ok(documentActions.length >= 72, '单据处理行至少 72 条')
assert.ok(costImpacts.length >= 18, '成本影响行至少 18 条')
assert.ok(timingImpacts.length >= 18, '时效影响行至少 18 条')

assertUniqueIds(scenarios, '业务场景')
assertUniqueIds(orders, '变更单')
assertUniqueIds(impacts, '生产影响明细')
assertUniqueIds(documentActions, '单据处理明细')
assertUniqueIds(costImpacts, '料工费差异明细')
assertUniqueIds(timingImpacts, '时效影响明细')

assert.ok(
  orders.some((order) => order.executionStrategy === 'IMMEDIATE_STOP_LOSS'),
  '变更单缺少执行策略 IMMEDIATE_STOP_LOSS',
)
assert.ok(
  orders.some((order) => order.executionStrategy === 'IMMEDIATE_EXECUTION'),
  '变更单缺少执行策略 IMMEDIATE_EXECUTION',
)
assert.ok(
  orders.some((order) => order.executionStrategy === 'AFTER_APPROVAL'),
  '变更单缺少执行策略 AFTER_APPROVAL',
)

assert.ok(
  orders.some((order) => order.changeResult === 'VERSION_AND_PATCH'),
  '变更单缺少结果类型 VERSION_AND_PATCH',
)
assert.ok(
  orders.some((order) => order.changeResult === 'VERSION_RELATION'),
  '变更单缺少结果类型 VERSION_RELATION',
)
assert.ok(
  orders.some((order) => order.changeResult === 'PRODUCTION_PATCH'),
  '变更单缺少结果类型 PRODUCTION_PATCH',
)
assert.ok(
  orders.some((order) => order.changeResult === 'COST_ONLY'),
  '变更单缺少结果类型 COST_ONLY',
)

const mismatchedOrders = orders.filter((order) => scenariosById.get(order.scenarioId)?.expectedResult !== order.changeResult)
assert.deepEqual(
  mismatchedOrders.map((order) => order.id),
  [],
  '变更单的系统反推结果必须与场景目录的预期结果一致',
)

assert.ok(
  (impacts as Array<Record<string, unknown>>).some((row) => {
    const affectedQuantity = row.affectedQuantity
    return (
      hasText(row.affectedColor) &&
      hasText(row.affectedSize) &&
      hasText(row.affectedBatch) &&
      hasText(row.affectedProcess) &&
      typeof affectedQuantity === 'number' &&
      affectedQuantity > 0
    )
  }),
  '至少一条生产影响行必须包含颜色、尺码、批次、工序和大于 0 的影响数量',
)
impacts.forEach((row) => {
  assert.ok(hasText(row.affectedColor), `${row.id} 缺少受影响颜色`)
  assert.ok(hasText(row.affectedSize), `${row.id} 缺少受影响尺码`)
  assert.ok(hasText(row.affectedBatch), `${row.id} 缺少受影响批次`)
  assert.ok(hasText(row.affectedProcess), `${row.id} 缺少受影响工序`)
  assert.ok(row.affectedQuantity > 0, `${row.id} 影响数量必须大于 0`)
})

assert.ok(
  (documentActions as Array<Record<string, unknown>>).some((row) => (
    hasText(row.systemSuggestion) &&
    hasText(row.finalAction) &&
    hasText(row.actionStatus)
  )),
  '至少一条单据处理行必须包含系统建议、最终动作和动作状态',
)

assert.ok(
  (documentActions as Array<Record<string, unknown>>).some((row) => (
    hasText(row.beforeBusinessContent) &&
    hasText(row.afterBusinessContent)
  )),
  '至少一条单据处理行必须包含变更前后业务内容',
)
documentActions.forEach((row) => {
  assert.ok(hasText(row.documentNo), `${row.id} 缺少单据号`)
  assert.ok(hasText(row.beforeBusinessContent), `${row.id} 缺少变更前业务内容`)
  assert.ok(hasText(row.afterBusinessContent), `${row.id} 缺少变更后业务内容`)
  assert.ok(hasText(row.systemSuggestion), `${row.id} 缺少系统建议`)
  assert.ok(hasText(row.finalAction), `${row.id} 缺少最终处理方式`)
})

assert.ok(
  (costImpacts as Array<Record<string, unknown>>).some((row) => (
    typeof row.estimatedAmount === 'number' &&
    typeof row.actualAmount === 'number' &&
    hasText(row.responsibleParty)
  )),
  '至少一条成本影响行必须包含预计金额、实际金额和责任方',
)
costImpacts.forEach((row) => {
  assert.ok(hasText(row.itemName), `${row.id} 缺少成本项目`)
  assert.ok(typeof row.estimatedAmount === 'number', `${row.id} 缺少预计金额`)
  assert.ok(typeof row.actualAmount === 'number', `${row.id} 缺少实际金额`)
  assert.ok(hasText(row.responsibleParty), `${row.id} 缺少责任方`)
  assert.ok(hasText(row.settlementHandling), `${row.id} 缺少结算处理`)
})

const costImpactsByChangeOrderId = new Map<string, number>()
costImpacts.forEach((row) => {
  costImpactsByChangeOrderId.set(row.changeOrderId, (costImpactsByChangeOrderId.get(row.changeOrderId) ?? 0) + 1)
})
const costOnlyOrdersWithoutCostImpacts = orders
  .filter((order) => order.changeResult === 'COST_ONLY' && (costImpactsByChangeOrderId.get(order.id) ?? 0) === 0)
  .map((order) => order.id)
assert.deepEqual(costOnlyOrdersWithoutCostImpacts, [], '仅成本/结算差异变更单必须有料工费差异明细')

const costRelevantOrdersWithoutCostImpacts = orders
  .filter((order) => (order.changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0) && (costImpactsByChangeOrderId.get(order.id) ?? 0) === 0)
  .map((order) => order.id)
assert.deepEqual(costRelevantOrdersWithoutCostImpacts, [], '存在成本差异的变更单必须有料工费差异明细')

assert.ok(
  (timingImpacts as Array<Record<string, unknown>>).some((row) => (
    hasText(row.originalTime) &&
    hasText(row.newEstimatedTime) &&
    typeof row.delayDays === 'number' &&
    hasText(row.responsibleParty)
  )),
  '至少一条时效影响行必须包含原时间、新预计时间、延期天数和责任方',
)
timingImpacts.forEach((row) => {
  assert.ok(hasText(row.originalTime), `${row.id} 缺少原计划时间`)
  assert.ok(hasText(row.newEstimatedTime), `${row.id} 缺少新预计时间`)
  assert.ok(typeof row.delayDays === 'number', `${row.id} 缺少影响天数`)
  assert.ok(hasText(row.responsibleParty), `${row.id} 缺少责任归因`)
  assert.ok(hasText(row.recoveryAction), `${row.id} 缺少追回动作`)
})

const timingImpactsByChangeOrderId = new Map<string, number>()
timingImpacts.forEach((row) => {
  timingImpactsByChangeOrderId.set(row.changeOrderId, (timingImpactsByChangeOrderId.get(row.changeOrderId) ?? 0) + 1)
})
const executionOrdersWithoutTimingImpacts = orders
  .filter((order) => (
    order.changeResult !== 'COST_ONLY' &&
    order.changeResult !== 'RECORD_ONLY' &&
    (timingImpactsByChangeOrderId.get(order.id) ?? 0) === 0
  ))
  .map((order) => order.id)
assert.deepEqual(executionOrdersWithoutTimingImpacts, [], '影响版本或生产补丁执行的变更单必须有时效影响明细')

const appShellConfig = fs.readFileSync(path.resolve(process.cwd(), 'src/data/app-shell-config.ts'), 'utf8')
assert.ok(appShellConfig.includes('生产单变更管理'), '菜单配置必须包含「生产单变更管理」')
assert.ok(!appShellConfig.includes('生产单变更影响台账'), '菜单配置不应包含「生产单变更影响台账」')

const secondOrder = orders[1]
assert.ok(secondOrder, '至少需要第二条变更单用于详情切换检查')
state.productionChangeSelectedOrderId = secondOrder.id
const selectedHtml = renderProductionChangesPage()
assert.ok(
  selectedHtml.includes(`data-change-order-id="${secondOrder.id}"`),
  '变更单列表的查看详情按钮必须携带变更单 ID',
)
assert.ok(
  selectedHtml.includes(`${secondOrder.id} · ${secondOrder.productionOrderId}`),
  '闭环详情必须能按当前选中的变更单展示',
)
assert.ok(!selectedHtml.includes('默认展示第一条变更单详情'), '闭环详情不应固定提示默认展示第一条变更单')

const pageTwoOrder = orders[12]
assert.ok(pageTwoOrder, '至少需要第 13 条变更单用于分页检查')
state.productionChangeOrderPage = 2
const pageTwoHtml = renderProductionChangesPage()
assert.ok(pageTwoHtml.includes('第 2 页 / 每页 12 条'), '变更单列表必须能进入第 2 页')
assert.ok(pageTwoHtml.includes(pageTwoOrder.id), '第 2 页必须展示第 13 条变更单')
assert.ok(
  pageTwoHtml.includes(`${pageTwoOrder.id} · ${pageTwoOrder.productionOrderId}`),
  '翻页后闭环详情必须跟随当前页第一条变更单',
)

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-07-production-order-change-management.md')),
  '缺少生产单变更管理原型审查记录',
)

console.log('production order changes check passed')
