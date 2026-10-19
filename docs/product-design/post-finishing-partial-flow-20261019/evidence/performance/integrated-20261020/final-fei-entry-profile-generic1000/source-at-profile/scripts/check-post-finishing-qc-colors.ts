import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'

flow.loadPostFinishingDemoData()
const a = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const current = flow.getPostFinishingActiveQcTask(a.qcA.actorId)!
const next = flow.listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')!
assert(current)
assert.throws(() => flow.claimPostFinishingQcTask({ qcTaskNo: next.qcTaskNo, actor: a.qcA }), /请先完成当前/)
assert.equal(flow.claimPostFinishingQcTask({ qcTaskNo: current.qcTaskNo, actor: a.qcA }).qcTaskId, current.qcTaskId)
assert.throws(() => flow.releasePostFinishingQcTask({ qcTaskId: current.qcTaskId, actor: a.qcA, reason: '退出' }), /主管释放/)
flow.completePostFinishingQcTask({ qcTaskId: current.qcTaskId, actor: a.qcA, results: current.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), processItems: [] })
assert.equal(flow.getPostFinishingActiveQcTask(a.qcA.actorId), undefined)
assert.equal(flow.claimPostFinishingQcTask({ qcTaskNo: next.qcTaskNo, actor: a.qcA }).qcTaskId, next.qcTaskId)
for (const row of flow.listPostFinishingFactoryReturns()) assert.equal(row.deliveryOrderNo, `${row.productionOrderNo}-${row.returnIndex}`)
for (const row of flow.listPostFinishingFullFlowQcTasks()) assert.equal(row.qcTaskNo, `${row.deliveryOrderNo}-ZJ`)
for (const row of flow.listPostFinishingFullFlowPostTasks()) assert.equal(row.postTaskNo, `${row.qcTaskNo}-HD`)
for (const row of flow.listPostFinishingFullFlowRecheckOrders()) {
  assert.equal(row.recheckOrderNo, `${row.postTaskNo}-FJ-${String(row.sequence).padStart(3, '0')}`, '新复检按加工单内实际创建序次编号')
}
const rechecks = flow.listPostFinishingFullFlowRecheckOrders()
assert.equal(new Set(rechecks.map(row => row.recheckOrderNo)).size, rechecks.length, '同加工单多次复检的编号不得碰撞')
for (const row of flow.listPostFinishingFullFlowOutboundOrders()) assert.equal(row.outboundOrderNo, `${row.recheckOrderNo || row.qcTaskNo}-CH`)
const page = readFileSync('src/pages/process-factory/post-finishing/qc-workbench.ts', 'utf8')
assert(page.includes('data-qc-spu-color-images'))
assert(!page.includes('维护参数'))
assert(!existsSync('src/data/fcs/post-finishing-spu-technical-parameters.ts'))


flow.loadPostFinishingDemoData()
const empty = flow.getPostFinishingActiveQcTask(a.qcA.actorId)!
const noQualified = flow.completePostFinishingQcTask({
  qcTaskId: empty.qcTaskId, actor: a.qcA,
  results: empty.lines.map(line => ({ skuId: line.sku.skuId, passedQty: 0, defectQty: 0, returnQty: line.expectedQty, returnReason: '质检返工', returnReceiver: flow.listPostFinishingQcReworkFactoryOptions()[0].value })),
})
assert.equal(noQualified.status, '质检完成')
assert.equal(noQualified.postTaskNo, undefined, '零合格数量不得生成空后道任务')
assert.equal(noQualified.outboundOrderNo, undefined, '零合格数量不得生成空出货单')
assert.equal(flow.getPostFinishingActiveQcTask(a.qcA.actorId), undefined)

console.log('通过：唯一质检、五级编号、颜色图片及零合格不建空下游。')
