import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  loadPostFinishingDemoData,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingFullFlowRecheckOrders,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  POST_STAGE_FLOW_NODES,
  POST_STAGE_PROCESSES,
  normalizePostStageProcessCode,
} from '../src/data/fcs/post-stage-taxonomy.ts'

const actualProcessCodes = POST_STAGE_PROCESSES.map((item) => item.code)
assert.deepEqual(actualProcessCodes, ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'])
assert.deepEqual(POST_STAGE_PROCESSES.map((item) => item.name), ['开扣眼', '装扣子', '烫包'])
assert.deepEqual(POST_STAGE_FLOW_NODES.map((item) => item.code), ['ARRIVAL_CONFIRM', 'QC', 'RECHECK', 'HANDOVER'])
assert.equal(normalizePostStageProcessCode('IRON_PACK'), 'IRON_PACK')
assert.equal(normalizePostStageProcessCode('UNKNOWN'), null)

const staticRouteSource = readFileSync(new URL('../src/data/fcs/post-process-route.ts', import.meta.url), 'utf8')
assert.ok(!staticRouteSource.includes('requiredPostProcessCodes'), '历史静态后道路由不得保存或决定本批 QC 后道项目')
assert.ok(!staticRouteSource.includes('buildPostStageExecutionSequence'), '历史静态后道路由不得再生成当前批次执行节点')

loadPostFinishingDemoData()
const postTasks = listPostFinishingFullFlowPostTasks()
const qcTasks = listPostFinishingFullFlowQcTasks()
const rechecks = listPostFinishingFullFlowRecheckOrders()
const outbounds = listPostFinishingFullFlowOutboundOrders()
const allowedProjects = new Set(POST_STAGE_PROCESSES.map((item) => item.name))

assert.ok(postTasks.length > 0, '当前全流程必须包含 QC 选中项目后生成的后道加工单')
for (const task of postTasks) {
  assert.ok(task.processItems.length > 0, `${task.postTaskNo} 本批后道项目不得为空`)
  assert.ok(task.processItems.every((item) => allowedProjects.has(item)), `${task.postTaskNo} 出现非当前后道项目`)
  assert.ok(qcTasks.some((qc) => qc.qcTaskId === task.qcTaskId), `${task.postTaskNo} 必须追溯唯一 QC`)
}

const directOutbounds = outbounds.filter((item) => item.sourceType === '质检直达')
assert.ok(directOutbounds.length > 0, 'QC 空项目必须存在直达成衣仓交接样例')
for (const outbound of directOutbounds) {
  assert.ok(!postTasks.some((task) => task.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} 不得生成后道加工单`)
  assert.ok(!rechecks.some((order) => order.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} 不得生成处理后交出复核单`)
}
for (const outbound of outbounds.filter((item) => item.sourceType === '后道加工后')) {
  assert.ok(postTasks.some((task) => task.postTaskId === outbound.postTaskId), `${outbound.outboundOrderNo} 缺少后道加工单来源`)
  assert.ok(rechecks.some((order) => order.recheckOrderId === outbound.recheckOrderId), `${outbound.outboundOrderNo} 缺少处理后交出复核来源`)
}

const visibleSources = [
  '../src/pages/process-factory/post-finishing/work-orders.ts',
  '../src/pages/process-factory/post-finishing/work-order-detail.ts',
  '../src/pages/pda-post-finishing-flow.ts',
  '../src/pages/print/templates/post-finishing-route-card-template.ts',
]
for (const pathname of visibleSources) {
  const source = readFileSync(new URL(pathname, import.meta.url), 'utf8')
  for (const text of ['阶段任务', '实际工序单', '车缝+后道']) {
    assert.ok(!source.includes(text), `${pathname} 不得展示「${text}」`)
  }
}
const detailSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-order-detail.ts', import.meta.url), 'utf8')
assert.ok(detailSource.includes('本批后道项目'), 'Web 后道加工单必须展示本批后道项目')
assert.ok(!detailSource.includes('实际工序'), 'Web 后道加工单不得恢复旧“实际工序”口径')
const pdaSource = readFileSync(new URL('../src/pages/pda-post-finishing-flow.ts', import.meta.url), 'utf8')
assert.ok(pdaSource.includes('本批后道项目') && pdaSource.includes('本批数量归类'), 'PDA 必须展示本批后道项目并逐 SKU 归类数量')

console.log(JSON.stringify({
  后道项目: POST_STAGE_PROCESSES.map((item) => item.name),
  质量节点: 'QC 唯一',
  QC空项目: '直达成衣仓待接收交接，不建后道加工单或处理后复核',
  静态路由: '仅历史只读责任与进度兼容，不计算本批项目',
}, null, 2))
