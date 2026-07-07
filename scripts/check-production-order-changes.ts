import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { renderProductionChangesPage } from '../src/pages/production/changes-domain.ts'
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

assert.equal(scenarios.length, 80, '生产单变更场景目录必须正好 80 条')
assert.ok(orders.length >= 24, '变更单样例至少 24 条')
assert.ok(impacts.length >= 36, '生产影响行至少 36 条')
assert.ok(documentActions.length >= 72, '单据处理行至少 72 条')
assert.ok(costImpacts.length >= 18, '成本影响行至少 18 条')
assert.ok(timingImpacts.length >= 18, '时效影响行至少 18 条')

const serializedOrders = JSON.stringify(orders)
;[
  'IMMEDIATE_STOP_LOSS',
  'IMMEDIATE_EXECUTION',
  'AFTER_APPROVAL',
].forEach((strategy) => {
  assert.ok(serializedOrders.includes(strategy), `变更单缺少执行策略 ${strategy}`)
})

;[
  'VERSION_AND_PATCH',
  'VERSION_RELATION',
  'PRODUCTION_PATCH',
  'COST_ONLY',
].forEach((resultType) => {
  assert.ok(serializedOrders.includes(resultType), `变更单缺少结果类型 ${resultType}`)
})

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

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-07-production-order-change-management.md')),
  '缺少生产单变更管理原型审查记录',
)

console.log('production order changes check passed')
