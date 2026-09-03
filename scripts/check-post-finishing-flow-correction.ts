import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  POST_STAGE_FLOW_NODES,
  POST_STAGE_PROCESSES,
  normalizePostStageProcessCode,
} from '../src/data/fcs/post-stage-taxonomy.ts'
import { buildPostStageExecutionSequence, type PostProcessRoute } from '../src/data/fcs/post-process-route.ts'

const actualProcessCodes = POST_STAGE_PROCESSES.map((item) => item.code)
assert.deepEqual(actualProcessCodes, ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'])
assert.deepEqual(POST_STAGE_PROCESSES.map((item) => item.name), ['开扣眼', '装扣子', '烫包'])
assert.deepEqual(POST_STAGE_FLOW_NODES.map((item) => item.code), ['ARRIVAL_CONFIRM', 'QC', 'RECHECK', 'HANDOVER'])
assert.equal(normalizePostStageProcessCode('IRON_PACK'), 'IRON_PACK')
assert.equal(normalizePostStageProcessCode('UNKNOWN'), null)

const fullSequence = buildPostStageExecutionSequence({
  requiresReceivingQc: true,
  requiresPostExecution: true,
  requiresFinalRecheck: true,
  requiredPostProcessCodes: actualProcessCodes,
} as PostProcessRoute)
assert.deepEqual(
  fullSequence.map((item) => item.code),
  ['ARRIVAL_CONFIRM', 'QC', 'BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK', 'RECHECK', 'HANDOVER'],
  '需要实际工序时必须按收货→质检→实际工序→复检→交接执行',
)
const noProcessSequence = buildPostStageExecutionSequence({
  requiresReceivingQc: true,
  requiresPostExecution: false,
  requiresFinalRecheck: true,
  requiredPostProcessCodes: [],
} as PostProcessRoute)
assert.deepEqual(
  noProcessSequence.map((item) => item.code),
  ['ARRIVAL_CONFIRM', 'QC', 'RECHECK', 'HANDOVER'],
  '无需实际工序时仍必须经过收货、质检、复检和交接',
)

const workOrders = listPostFinishingWorkOrders()
assert.ok(workOrders.length >= 5, '后道加工单 Mock 不足')
const allowedNames = new Set(['开扣眼', '装扣子', '烫包'])
for (const order of workOrders) {
  assert.ok(order.skuLines.length > 0, `${order.postOrderNo} 缺少 SKU 明细`)
  assert.ok(order.postProjectLines.length > 0, `${order.postOrderNo} 缺少实际工序项目`)
  order.postProjectLines.forEach((line) => assert.ok(allowedNames.has(line.projectName), `${order.postOrderNo} 出现伪工序 ${line.projectName}`))
  assert.ok(order.postProcessItems.every((name) => allowedNames.has(name)), `${order.postOrderNo} 存在非当前后道工序`)
}

const visibleSources = [
  '../src/data/app-shell-config.ts',
  '../src/router/routes-fcs.ts',
  '../src/pages/unified-dispatch-workbench.ts',
  '../src/pages/process-factory/post-finishing/tasks.ts',
  '../src/pages/process-factory/post-finishing/work-orders.ts',
  '../src/pages/process-factory/post-finishing/work-order-detail.ts',
  '../src/pages/process-factory/post-finishing/statistics.ts',
  '../src/pages/pda-exec-detail.ts',
  '../src/pages/production/detail-domain.ts',
  '../src/pages/print/templates/post-finishing-route-card-template.ts',
  '../src/data/fcs/task-print-cards.ts',
]
const forbidden = ['阶段任务', '实际工序单', '车缝+后道', '>开始后道<', '>完成后道<']
for (const pathname of visibleSources) {
  const source = readFileSync(new URL(pathname, import.meta.url), 'utf8')
  forbidden.forEach((text) => assert.ok(!source.includes(text), `${pathname} 不得展示「${text}」`))
}
const detailSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-order-detail.ts', import.meta.url), 'utf8')
assert.ok(detailSource.includes('开始${escapeHtml(line.projectName)}'), 'Web 必须按实际工序名称展示开始动作')
assert.ok(detailSource.includes('完成${escapeHtml(line.projectName)}'), 'Web 必须按实际工序名称展示完成动作')
const pdaSource = readFileSync(new URL('../src/pages/pda-exec-detail.ts', import.meta.url), 'utf8')
assert.ok(pdaSource.includes("task.skuLines.reduce((sum, line) => sum + line.plannedQty, 0)"), 'PDA 成衣数量必须从 SKU 明细汇总，不能显示未定义字段')
assert.ok(pdaSource.includes('实际工序完成成衣件数') && pdaSource.includes('关联后道加工单号'), 'PDA 必须区分实际工序事实与后道加工单对象')

console.log(JSON.stringify({
  后道阶段实际工序: POST_STAGE_PROCESSES.map((item) => item.name),
  流程节点: POST_STAGE_FLOW_NODES.map((item) => item.name),
  后道加工单数: workOrders.length,
  无实际工序路线: '收货→质检→复检→交接',
  命名门禁: '通过',
}, null, 2))
