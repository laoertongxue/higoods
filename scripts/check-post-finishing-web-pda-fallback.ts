#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  PostFinishingFlowGateError,
  claimPostFinishingQcTask,
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
  nowMs: nextTime(),
})
assert(completedQc.postTaskNo, '质检完成后必须生成后道加工单')
let task = startPostFinishingPostTask({
  postTaskNo: completedQc.postTaskNo,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.length, task.lines.length, '开始后道时必须逐 SKU 建立共享草稿')

expectGate('INVALID_QUANTITY', () => completePostFinishingPostTaskFromDraft({
  postTaskId: task.postTaskId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))

const firstLine = task.lines[0]
expectGate('INVALID_STATUS', () => setPostFinishingPostUnprocessedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  unprocessedQty: 3,
  unprocessedReason: '',
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))
task = setPostFinishingPostProcessedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  processedQty: firstLine.expectedQty - 3,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.[0].processedQty, firstLine.expectedQty - 3, 'PDA/Web 已处理数量必须写入同一份 SKU 草稿')
expectGate('INVALID_QUANTITY', () => setPostFinishingPostUnprocessedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  unprocessedQty: 4,
  unprocessedReason: '超过本 SKU 剩余数量',
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))
task = setPostFinishingPostUnprocessedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  unprocessedQty: 3,
  unprocessedReason: '现场尚未完成本批处理',
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.[0].unprocessedQty, 3, '未处理数量必须独立保存在共享草稿')
assert.equal(task.draftLines?.[0].unprocessedReason, '现场尚未完成本批处理', '未处理数量必须保存现场说明')
expectGate('NOT_CLAIM_OWNER', () => setPostFinishingPostProcessedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  processedQty: firstLine.expectedQty - 1,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
  nowMs: nextTime(),
}))

const webFallbackActor: PostFinishingActor = {
  actorId: 'PF-WEB-FALLBACK-001',
  actorName: 'Web接管操作员',
  roleName: '后道操作员',
  account: 'PF_WEB_FALLBACK',
}
expectGate('INVALID_STATUS', () => takeOverPostFinishingPostTask({
  postTaskId: task.postTaskId,
  actor: webFallbackActor,
  reason: ' ',
  nowMs: nextTime(),
}))
task = takeOverPostFinishingPostTask({
  postTaskId: task.postTaskId,
  actor: webFallbackActor,
  reason: 'PDA故障，转Web继续',
  nowMs: nextTime(),
})
assert.equal(task.startedBy?.actorId, webFallbackActor.actorId, 'Web 接管必须切换当前操作人')
assert.equal(task.lastTakeoverReason, 'PDA故障，转Web继续', 'Web 接管必须留存原因')

const allUnprocessedLine = task.lines.at(-1)!
for (const line of task.lines.slice(0, -1)) {
  if (line.sku.skuId === firstLine.sku.skuId) continue
  task = setPostFinishingPostProcessedQuantity({
    postTaskId: task.postTaskId,
    skuId: line.sku.skuId,
    processedQty: line.expectedQty,
    actor: webFallbackActor,
    nowMs: nextTime(),
  })
}
task = setPostFinishingPostUnprocessedQuantity({
  postTaskId: task.postTaskId,
  skuId: allUnprocessedLine.sku.skuId,
  unprocessedQty: allUnprocessedLine.expectedQty,
  unprocessedReason: '整批未处理，待人工后续决定',
  actor: webFallbackActor,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.at(-1)?.processedQty, 0, '整批未处理场景不应强迫填写已处理数量')
task = completePostFinishingPostTaskFromDraft({
  postTaskId: task.postTaskId,
  actor: webFallbackActor,
  nowMs: nextTime(),
})
assert.equal(task.status, '后道完成', '每个 SKU 的已处理与未处理数量归类完成后才允许完成后道')
assert(task.results?.every((line) => line.processedQty + line.unprocessedQty === line.expectedQty), '完成结果必须逐 SKU 保持处理数量守恒')
assert.equal(task.results?.[0].processedQty, firstLine.expectedQty - 3, '第一条 SKU 必须保留真实已处理数量')
assert.equal(task.results?.at(-1)?.processedQty, 0, '整批未处理时必须允许零已处理')
assert.equal(task.results?.at(-1)?.unprocessedQty, allUnprocessedLine.expectedQty, '整批未处理数量必须完整保留到完成结果')
assert(task.results?.every((line) => !('defectQty' in line) && !('returnQty' in line) && !('passedQty' in line)), '后道完成结果不得包含质检或返厂字段')
assert(getPostFinishingFullFlowPostTask(task.postTaskNo)?.recheckOrderNo, '有已处理产出时完成后道必须生成处理后交出复核单')

const logActions = listPostFinishingOperationLogs({ keyword: task.postTaskNo }).map((log) => log.action)
for (const action of ['填报后道已处理数量', '填报后道未处理数量', '接管后道加工单', '完成后道']) {
  assert(logActions.includes(action), `操作日志必须包含：${action}`)
}

const warehouseSource = source('../src/pages/process-factory/post-finishing/warehouse.ts')
const workOrdersSource = source('../src/pages/process-factory/post-finishing/work-orders.ts')
const workOrderDetailSource = source('../src/pages/process-factory/post-finishing/work-order-detail.ts')
const pdaSource = source('../src/pages/pda-post-finishing-flow.ts')
const auditSource = source('../src/pages/process-factory/post-finishing/audit-records.ts')
const pdaRoutesSource = source('../src/router/routes-pda.ts')

assert(warehouseSource.includes('回货确认') && warehouseSource.includes('完整送货单号'), '待加工仓必须保留 Web 输入完整送货单号的回货确认入口')
assert(workOrdersSource.includes('开始后道') && workOrdersSource.includes('查看加工单') && !workOrdersSource.includes('PDA 执行（优先）'), '后道加工单列表必须提供 Web 开始后道与查看加工单入口')
assert(workOrderDetailSource.includes('执行后道加工单') && workOrderDetailSource.includes('data-web-post-processed-qty') && workOrderDetailSource.includes('data-web-post-adjust-field="unprocessedQty"') && !workOrderDetailSource.includes('toggle-process-item'), 'Web 后道详情必须执行共享已处理/未处理数量，不重复勾选质检已确认项目')
assert(pdaSource.includes('本批后道项目') && pdaSource.includes('data-post-processed-qty') && !pdaSource.includes('toggle-process-item'), 'PDA 后道详情必须以 SKU 已处理数量为主动作')
assert(pdaSource.includes('data-post-adjust-field="unprocessedQty"') && pdaSource.includes('data-post-adjust-field="unprocessedReason"'), 'PDA 必须支持填写未处理数量与说明')
for (const forbidden of ['data-post-defect-adjustment-mode', 'data-post-defect-reason-qty', 'data-return-receiver-search', 'select-return-receiver']) {
  assert(!pdaSource.includes(forbidden), `PDA 后道执行不得保留质量或返厂能力：${forbidden}`)
}
assert(pdaRoutesSource.includes("'/fcs/pda/post-finishing/sku-adjustment'"), 'PDA SKU 未处理数量路由必须注册')
for (const tab of ['业务链总览', '差异与质检', '操作时间线']) {
  assert(auditSource.includes(tab), `差异与操作日志详情缺少分层页签：${tab}`)
}
assert(auditSource.includes('按阶段查看单据链') && auditSource.includes('按环节归组的操作记录'), '差异与操作日志必须按阶段和环节组织，不得继续全量平铺')

console.log(JSON.stringify({
  suite: '后道 Web 执行与 PDA 数量归类一致性',
  skuCount: task.lines.length,
  processedQuantityFacts: task.results?.map((line) => line.processedQty),
  unprocessedQuantityFacts: task.results?.map((line) => line.unprocessedQty),
  webTakeoverActor: task.startedBy?.actorName,
  status: task.status,
  recheckOrderNo: task.recheckOrderNo,
  result: '通过',
}, null, 2))
