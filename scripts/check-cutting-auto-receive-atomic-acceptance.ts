// Atomic requirements: EXEC-012, EXEC-011, GOV-004.
// Reuse the formal assignment/create/scan/submit fixture; never assign an execution result in this check.
import './check-cutting-dispatch-ppic-ledger-linkage.ts'
import assert from 'node:assert/strict'
import { ensureCuttingSewingDispatchSeeded, submitCuttingSewingDispatchBatch } from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { getPdaHandoverRecordsByHead } from '../src/data/fcs/pda-handover-events.ts'
import { getRuntimeTaskById } from '../src/data/fcs/runtime-process-tasks.ts'
import { getSewingCutPieceResponsibilityProjection, listSewingCutPieceHandoverEvents } from '../src/data/fcs/sewing-cut-piece-responsibility.ts'

const assignmentId = 'ASG-CUT-DISPATCH-LEDGER-LINK-001'
const store = ensureCuttingSewingDispatchSeeded()
const order = store.dispatchOrders.find((item) => item.executionAssignmentId === assignmentId)
assert(order?.runtimeTaskId, '夹具必须是正式运行任务绑定，不能使用 legacyUnbound 演示批次')
const batch = store.dispatchBatches.find((item) => item.dispatchOrderId === order.dispatchOrderId)
assert(batch?.handoverRecordId)
const taskBefore = structuredClone(getRuntimeTaskById(order.runtimeTaskId))
assert.equal(taskBefore?.status, 'IN_PROGRESS')
const projectionBefore = structuredClone(getSewingCutPieceResponsibilityProjection(assignmentId))
const eventsBefore = structuredClone(listSewingCutPieceHandoverEvents(assignmentId))
assert.equal(eventsBefore.length, 1)
assert(projectionBefore.lines.length > eventsBefore[0]!.lines.length, '缺部位仍须允许交出和开工，不能偷偷增加齐套门禁')
const first = submitCuttingSewingDispatchBatch({ dispatchBatchId: batch.dispatchBatchId, operatorName: '裁床待交出仓 王敏', submittedAt: '2026-09-02 11:00:00' })
const recordsBefore = structuredClone(getPdaHandoverRecordsByHead(first.handoverRecord.handoverId))
assert.equal(first.handoverRecord.receiverWrittenQty, first.handoverRecord.submittedQty)
assert(Number(first.handoverRecord.submittedQty) > 0)
assert.deepEqual(first.outboundRecords, [], '已提交批次再次提交不产生出仓记录')
assert.deepEqual(first.updatedWaitHandoverStockItems, [], '已提交批次不再次扣减待交出仓')
const repeated = submitCuttingSewingDispatchBatch({ dispatchBatchId: batch.dispatchBatchId, operatorName: '裁床待交出仓 王敏', submittedAt: '2026-09-03 12:00:00' })
assert.equal(repeated.handoverRecord.recordId, first.handoverRecord.recordId)
assert.deepEqual(getPdaHandoverRecordsByHead(first.handoverRecord.handoverId), recordsBefore, '重复提交不增加记录或累加实交/实收数量')
assert.deepEqual(repeated.outboundRecords, [])
assert.deepEqual(repeated.updatedWaitHandoverStockItems, [])
assert.deepEqual(getSewingCutPieceResponsibilityProjection(assignmentId), projectionBefore, '重复提交不得增加责任数量')
assert.deepEqual(listSewingCutPieceHandoverEvents(assignmentId), eventsBefore)
assert.deepEqual(getRuntimeTaskById(order.runtimeTaskId), taskBefore, '开工时间和审计保持原事实；重复交接不人工完单，也不自动改为 DONE')
console.log(JSON.stringify({ requirements: ['EXEC-012', 'EXEC-011', 'GOV-004'], productionOrderId: order.productionOrderId, runtimeTaskId: order.runtimeTaskId, dispatchBatchId: batch.dispatchBatchId, handoverRecordId: repeated.handoverRecord.recordId, receivedQty: repeated.handoverRecord.receiverWrittenQty, status: taskBefore?.status, startedAt: taskBefore?.startedAt, checks: 'formal binding; receive + start in submit; missing parts allowed; repeated record/quantity/audit stable; no completion' }, null, 2))
