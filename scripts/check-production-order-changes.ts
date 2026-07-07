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

assert.ok(
  (costImpacts as Array<Record<string, unknown>>).some((row) => (
    typeof row.estimatedAmount === 'number' &&
    typeof row.actualAmount === 'number' &&
    hasText(row.responsibleParty)
  )),
  '至少一条成本影响行必须包含预计金额、实际金额和责任方',
)

const costImpactsByChangeOrderId = new Map<string, number>()
costImpacts.forEach((row) => {
  costImpactsByChangeOrderId.set(row.changeOrderId, (costImpactsByChangeOrderId.get(row.changeOrderId) ?? 0) + 1)
})
const costOnlyOrdersWithoutCostImpacts = orders
  .filter((order) => order.changeResult === 'COST_ONLY' && (costImpactsByChangeOrderId.get(order.id) ?? 0) === 0)
  .map((order) => order.id)
assert.deepEqual(costOnlyOrdersWithoutCostImpacts, [], '仅成本/结算差异变更单必须有料工费差异明细')

assert.ok(
  (timingImpacts as Array<Record<string, unknown>>).some((row) => (
    hasText(row.originalTime) &&
    hasText(row.newEstimatedTime) &&
    typeof row.delayDays === 'number' &&
    hasText(row.responsibleParty)
  )),
  '至少一条时效影响行必须包含原时间、新预计时间、延期天数和责任方',
)

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

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-07-production-order-change-management.md')),
  '缺少生产单变更管理原型审查记录',
)

console.log('production order changes check passed')
