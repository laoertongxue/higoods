#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  PostFinishingFlowGateError,
  claimPostFinishingQcTask,
  appendPostFinishingProcessCompletion,
  getPostFinishingProcessProgress,
  listPostFinishingFullFlowRecheckOrders,
  submitPostFinishingForRecheck,
  completePostFinishingPostTaskFromDraft,
  completePostFinishingQcTask,
  confirmPostFinishingFactoryReturn,
  getPostFinishingFullFlowPostTask,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  sendPostFinishingFactoryReturnToQc,
  setPostFinishingPostProcessedQuantity,
  setPostFinishingPostUnprocessedQuantity,
  startPostFinishingPostTask,
  takeOverPostFinishingPostTask,
  type PostFinishingActor,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import { listPostFinishingOperationLogs } from '../src/data/fcs/post-finishing-operation-log.ts'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function expectGate(code: PostFinishingFlowGateError['code'], run: () => unknown): void {
  assert.throws(run, (error: unknown) => error instanceof PostFinishingFlowGateError && error.code === code)
}

let nowMs = Date.UTC(2026, 8, 2, 2, 0, 0)
const nextTime = () => { nowMs += 1_000; return nowMs }

resetPostFinishingFullFlow()
const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
const registered = registerPostFinishingFactoryReturn({
  productionOrderNo: order.productionOrderNo,
  returnIndex: 1,
  triggerSource: '管理端补登记',
  idempotencyKey: 'WEB-PDA-FALLBACK-CHAIN',
  quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
  deliveryPersonName: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier.actorName,
  deliveryPersonPhone: '081200000001',
  evidenceImageUrls: ['/materials/fabric-main.jpg'],
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
  nowMs: nextTime(),
})
const confirmed = confirmPostFinishingFactoryReturn({
  deliveryId: registered.deliveryId,
  firstCounts: registered.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
  nowMs: nextTime(),
})
const qcTask = sendPostFinishingFactoryReturnToQc({
  deliveryId: confirmed.deliveryId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
  nowMs: nextTime(),
})
claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA, nowMs: nextTime() })
const completedQc = completePostFinishingQcTask({
  qcTaskId: qcTask.qcTaskId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
  results: qcTask.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })),
  processItems: ['包装', '装扣子'],
  nowMs: nextTime(),
})
assert(completedQc.postTaskNo, '质检完成后必须生成后道加工单')
const task = getPostFinishingFullFlowPostTask(completedQc.postTaskNo!)!
assert.deepEqual(task.processItems, ['装扣子', '包装'], '实际加工链按质检选择排序，未选项目不参与')
const firstLine = task.lines[0]
const pdaActor = POST_FINISHING_ACCEPTANCE_ACTORS.postOperator
const webActor = POST_FINISHING_ACCEPTANCE_ACTORS.postSupervisor
const register = (processItem: '装扣子' | '包装', quantity: number, actor: PostFinishingActor, operationId: string) => appendPostFinishingProcessCompletion({
  postTaskId: task.postTaskId, processItem, quantities: task.lines.map(line => ({ skuId: line.sku.skuId, quantity })),
  actor, responsible: actor, operationId, nowMs: nextTime(),
})
expectGate('INVALID_QUANTITY', () => register('包装', 1, webActor, 'BEFORE-PREVIOUS'))
register('装扣子', 10, pdaActor, 'PDA-BUTTON-10')
register('包装', 4, webActor, 'WEB-PACK-4')
register('包装', 4, webActor, 'WEB-PACK-4')
let progress = getPostFinishingProcessProgress(task.postTaskId)
assert.equal(progress.processes.find(row => row.processItem === '装扣子')?.completedQty, 50)
assert.equal(progress.totalCompletedQty, 20, '5SKU各包装4件只提供20件成衣，不累加不同工序工作量')
assert.equal(progress.records.length, 2, '同意图跨端重试不增加加工事实')
assert.deepEqual(progress.records.map(row => row.responsible.actorId), [pdaActor.actorId, webActor.actorId], '各条责任保留，不锁死在开始人名下')
assert.equal(listPostFinishingFullFlowRecheckOrders().length, 0, '加工保存不自动建复检')
expectGate('NOT_CLAIM_OWNER', () => register('装扣子', 1, POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA, 'NON-POST'))
for (const run of [
  () => setPostFinishingPostProcessedQuantity({ postTaskId: task.postTaskId, skuId: firstLine.sku.skuId, processedQty: 20, actor: pdaActor }),
  () => setPostFinishingPostUnprocessedQuantity({ postTaskId: task.postTaskId, skuId: firstLine.sku.skuId, unprocessedQty: 20, unprocessedReason: '旧归类', actor: pdaActor }),
  () => completePostFinishingPostTaskFromDraft({ postTaskId: task.postTaskId, actor: pdaActor }),
  () => takeOverPostFinishingPostTask({ postTaskId: task.postTaskId, actor: webActor, reason: '旧接管' }),
]) expectGate('INVALID_STATUS', run)
assert.equal(getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道中', '正常80件余量不被未处理归类结案')
const first = submitPostFinishingForRecheck({ postTaskId: task.postTaskId, quantities: task.lines.map(line => ({ skuId: line.sku.skuId, quantity: 4 })), actor: webActor, operationId: 'WEB-RECHECK-1', nowMs: nextTime() })
assert.equal(getPostFinishingProcessProgress(task.postTaskId).availableForRecheckQty, 0, '待领取即扣减可交量')
appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem: '包装', quantities: [{ skuId: firstLine.sku.skuId, quantity: 2 }], responsible: pdaActor, actor: pdaActor, operationId: 'PDA-PACK-2', nowMs: nextTime() })
const second = submitPostFinishingForRecheck({ postTaskId: task.postTaskId, quantities: [{ skuId: firstLine.sku.skuId, quantity: 2 }], actor: pdaActor, operationId: 'PDA-RECHECK-2', nowMs: nextTime() })
assert.notEqual(second.recheckOrderId, first.recheckOrderId)
assert.equal(listPostFinishingFullFlowRecheckOrders().length, 2, 'Web与PDA交替创建两次真实复检，原记录保留')
for (const processItem of ['装扣子', '包装'] as const) {
  const item = getPostFinishingProcessProgress(task.postTaskId).processes.find(row => row.processItem === processItem)!
  appendPostFinishingProcessCompletion({ postTaskId: task.postTaskId, processItem, quantities: item.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.availableQty })), responsible: webActor, actor: webActor, operationId: `WEB-REMAINDER-${processItem}`, nowMs: nextTime() })
}
progress = getPostFinishingProcessProgress(task.postTaskId)
assert.equal(progress.totalCompletedQty, 100)
assert.equal(progress.totalReservedQty, 22)
assert.equal(progress.availableForRecheckQty, 78)
assert.equal(getPostFinishingFullFlowPostTask(task.postTaskId)?.status, '后道完成')
const logActions = listPostFinishingOperationLogs({ keyword: task.postTaskNo }).map(log => log.action)
for (const action of ['登记装扣子完成', '登记包装完成', '交复检']) assert(logActions.includes(action), `操作日志保留分项和具体交复检动作：${action}`)

const warehouseSource = source('../src/pages/process-factory/post-finishing/warehouse.ts')
const workOrdersSource = source('../src/pages/process-factory/post-finishing/work-orders.ts')
const workOrderDetailSource = source('../src/pages/process-factory/post-finishing/work-order-detail.ts')
const pdaSource = source('../src/pages/pda-post-finishing-flow.ts')
const auditSource = source('../src/pages/process-factory/post-finishing/audit-records.ts')
const pdaRoutesSource = source('../src/router/routes-pda.ts')

assert(warehouseSource.includes('回货确认') && warehouseSource.includes('完整送货单号'), '待加工仓必须保留 Web 输入完整送货单号的回货确认入口')
assert(workOrdersSource.includes('登记加工') && workOrdersSource.includes('查看加工单') && !workOrdersSource.includes('PDA 执行（优先）'), 'Web列表使用分项登记及查看入口')
assert(workOrderDetailSource.includes('data-post-entry-quantity') && workOrderDetailSource.includes('data-post-entry-responsible') && workOrderDetailSource.includes('open-recheck'), 'Web提供本次数量、责任及独立交复检')
assert(!workOrderDetailSource.includes('data-web-post-processed-qty') && !workOrderDetailSource.includes('data-web-post-adjust-field'), 'Web旧整单归类表单退出活跃表面')
assert(pdaSource.includes('data-post-process-qty') && pdaSource.includes('save-process-completion') && pdaSource.includes('submit-for-recheck'), 'PDA提供同一分项增量和独立交复检命令')
assert(!pdaSource.includes('data-post-adjust-field=') && !pdaSource.includes('data-post-processed-qty'), 'PDA没有旧已处理/未处理可写控件')
assert(pdaSource.includes('旧整单“未处理数量”登记入口已停用'), '旧深链接显示退役说明而不继续写旧事实')
for (const forbidden of ['data-post-defect-adjustment-mode', 'data-post-defect-reason-qty', 'data-return-receiver-search', 'select-return-receiver']) {
  assert(!pdaSource.includes(forbidden), `PDA 后道执行不得保留质量或返厂能力：${forbidden}`)
}
assert(pdaRoutesSource.includes("'/fcs/pda/post-finishing/sku-adjustment'"), '旧SKU深链接仍有明确只读退役落点')
for (const tab of ['业务链总览', '差异与质检', '操作时间线']) {
  assert(auditSource.includes(tab), `差异与操作日志详情缺少分层页签：${tab}`)
}
assert(auditSource.includes('按阶段查看单据链') && auditSource.includes('按环节归组的操作记录'), '差异与操作日志必须按阶段和环节组织，不得继续全量平铺')

console.log(JSON.stringify({
  suite: '后道Web与PDA分项增量、责任与多次交复检一致性',
  skuCount: task.lines.length,
  processProgress: progress.processes.map(row => ({ processItem: row.processItem, applicable: row.applicable, completedQty: row.completedQty })),
  totalCompletedQty: progress.totalCompletedQty,
  reservedQty: progress.totalReservedQty,
  availableForRecheckQty: progress.availableForRecheckQty,
  recheckOrderNos: listPostFinishingFullFlowRecheckOrders().map(row => row.recheckOrderNo),
  result: '通过',
}, null, 2))
