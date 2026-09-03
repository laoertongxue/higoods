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
  listPostFinishingPostReturnReceiverOptions,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  savePostFinishingPostSkuAdjustment,
  sendPostFinishingFactoryReturnToQc,
  setPostFinishingPostCompletedQuantity,
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
  needPostFinishing: true,
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
expectGate('DEFECT_REASON_REQUIRED', () => savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'INCREASE',
  defectReasonQuantities: [{ reason: '', quantity: 1 }],
  returnQty: 0,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))

task = savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'INCREASE',
  defectReasonQuantities: [
    { reason: '车缝不良', quantity: 1 },
    { reason: '脏污', quantity: 2 },
  ],
  returnQty: 0,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.deepEqual(task.draftLines?.[0].defectReasonQuantities, [
  { reason: '脏污', quantity: 2 },
  { reason: '车缝不良', quantity: 1 },
], '未填写完成数量时也必须允许按每种原因分别增加瑕疵')
expectGate('INVALID_QUANTITY', () => savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'INCREASE',
  defectReasonQuantities: [{ reason: '压痕', quantity: firstLine.expectedQty }],
  returnQty: 0,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))
expectGate('INVALID_QUANTITY', () => completePostFinishingPostTaskFromDraft({
  postTaskId: task.postTaskId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))
task = setPostFinishingPostCompletedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  completedQty: firstLine.expectedQty,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.[0].completedQty, firstLine.expectedQty, 'PDA/Web 完成数量必须写入同一份 SKU 草稿')
expectGate('NOT_CLAIM_OWNER', () => setPostFinishingPostCompletedQuantity({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  completedQty: firstLine.expectedQty - 1,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
  nowMs: nextTime(),
}))
expectGate('INVALID_QUANTITY', () => savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'DECREASE',
  defectReasonQuantities: [{ reason: '压痕', quantity: 1 }],
  returnQty: 0,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
}))
task = savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'DECREASE',
  defectReasonQuantities: [{ reason: '脏污', quantity: 1 }],
  returnQty: 0,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.deepEqual(task.draftLines?.[0].defectReasonQuantities, [
  { reason: '脏污', quantity: 1 },
  { reason: '车缝不良', quantity: 1 },
], '减少瑕疵必须按具体原因扣减，不能只改总数')
const returnReceiver = listPostFinishingPostReturnReceiverOptions(task.postTaskId)[0].value
task = savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: firstLine.sku.skuId,
  adjustmentMode: 'INCREASE',
  defectReasonQuantities: [],
  returnQty: 1,
  returnReason: '返厂返修',
  returnReceiver,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.[0].returnReceiver, returnReceiver, '返厂接收对象必须来自共享可搜索选项')

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

const allDefectLine = task.lines.at(-1)!
for (const line of task.lines.slice(0, -1)) {
  task = setPostFinishingPostCompletedQuantity({
    postTaskId: task.postTaskId,
    skuId: line.sku.skuId,
    completedQty: line.expectedQty,
    actor: webFallbackActor,
    nowMs: nextTime(),
  })
}
task = savePostFinishingPostSkuAdjustment({
  postTaskId: task.postTaskId,
  skuId: allDefectLine.sku.skuId,
  adjustmentMode: 'INCREASE',
  defectReasonQuantities: [{ reason: '脏污', quantity: allDefectLine.expectedQty }],
  returnQty: 0,
  actor: webFallbackActor,
  nowMs: nextTime(),
})
assert.equal(task.draftLines?.at(-1)?.completedQty, 0, '整批瑕疵场景不应强迫先填写完成数量')
task = completePostFinishingPostTaskFromDraft({
  postTaskId: task.postTaskId,
  actor: webFallbackActor,
  nowMs: nextTime(),
})
assert.equal(task.status, '后道完成', '每个 SKU 填写完成数量或整批归入瑕疵后才允许完成后道')
assert(task.results?.every((line) => line.completedQty === line.expectedQty), '完成结果必须逐 SKU 留存实际完成数量')
assert.equal(task.results?.[0].passedQty, firstLine.expectedQty - 3, '合格数量必须由完成数量减瑕疵与返厂计算')
assert.equal(task.results?.at(-1)?.passedQty, 0, '整批均为瑕疵时必须允许零合格完成')
assert.equal(task.results?.at(-1)?.defectQty, allDefectLine.expectedQty, '整批瑕疵必须完整保留到完成结果')
assert.deepEqual(task.results?.[0].defectReasonQuantities, [
  { reason: '脏污', quantity: 1 },
  { reason: '车缝不良', quantity: 1 },
], '完成结果必须保留每种瑕疵原因对应数量')
assert(getPostFinishingFullFlowPostTask(task.postTaskNo)?.recheckOrderNo, '完成后道必须生成复检单，不依赖是否已交出')

const logActions = listPostFinishingOperationLogs({ keyword: task.postTaskNo }).map((log) => log.action)
for (const action of ['填报后道完成数量', '增加后道瑕疵', '减少后道瑕疵', '接管后道加工单', '完成后道']) {
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
assert(workOrderDetailSource.includes('执行后道加工单') && workOrderDetailSource.includes('data-web-post-completed-qty') && !workOrderDetailSource.includes('toggle-process-item'), 'Web 后道详情必须执行共享完成数量，不重复勾选质检已确认项目')
assert(pdaSource.includes('质检已确认加工项目') && pdaSource.includes('data-post-completed-qty') && !pdaSource.includes('toggle-process-item'), 'PDA 后道详情必须以 SKU 完成数量为主动作')
assert(pdaSource.includes('data-post-defect-adjustment-mode') && pdaSource.includes('data-post-defect-reason-qty'), 'PDA 必须支持增加或减少瑕疵，并逐原因填写数量')
assert(!pdaSource.includes('请先返回后道加工单填写并保存该 SKU 的完成数量') && !workOrderDetailSource.includes('请先返回后道加工单填写并保存该 SKU 的完成数量'), 'PDA/Web 调整瑕疵不得依赖先填完成数量')
assert(pdaSource.includes('data-return-receiver-search') && pdaSource.includes('select-return-receiver'), 'PDA 返厂接收对象必须使用移动端可搜索选择器')
assert(!pdaSource.includes('data-post-adjust-file="defectImage"') && !pdaSource.includes('data-post-adjust-field="responsibleParty"'), 'PDA 后道调整必须删除责任方和现场证据图片板块')
assert(pdaRoutesSource.includes("'/fcs/pda/post-finishing/sku-adjustment'"), 'PDA SKU 瑕疵调整路由必须注册')
for (const tab of ['业务链总览', '差异与瑕疵', '操作时间线']) {
  assert(auditSource.includes(tab), `差异与操作日志详情缺少分层页签：${tab}`)
}
assert(auditSource.includes('按阶段查看单据链') && auditSource.includes('按环节归组的操作记录'), '差异与操作日志必须按阶段和环节组织，不得继续全量平铺')

console.log(JSON.stringify({
  suite: '后道 Web 执行与 PDA 数量归类一致性',
  skuCount: task.lines.length,
  completedQuantityFacts: task.results?.map((line) => line.completedQty),
  defectReasonQuantities: task.results?.[0].defectReasonQuantities,
  webTakeoverActor: task.startedBy?.actorName,
  status: task.status,
  recheckOrderNo: task.recheckOrderNo,
  result: '通过',
}, null, 2))
