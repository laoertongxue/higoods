import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureSewingDeliverySlaSnapshotStore,
  createSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
  restoreSewingDeliverySlaSnapshotStore,
  saveSewingDeliverySlaSnapshot,
} from '../../src/data/fcs/sewing-delivery-sla.ts'
import { captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState } from '../../src/data/fcs/effective-task-assignments.ts'
import { listSewingOutsourcingReturnTrackingRows } from '../../src/data/fcs/sewing-outsourcing-return-tracking.ts'
import { renderSewingOutsourcingReturnsPage } from '../../src/pages/sewing-outsourcing/returns.ts'
import { renderPdaSewingDeliveryProgress } from '../../src/pages/pda-exec-detail.ts'
import { renderSewingDeliverySlaDetail, renderSewingDeliverySlaListCell } from '../../src/pages/progress-board/task-domain.ts'

const input = {
  assignmentId: 'business-start-test', runtimeTaskId: 'business-start-test', productionOrderId: 'business-start-test',
  factoryId: 'business-start-test', factoryName: '测试工厂', assignedQty: 100,
  acceptedAt: '2026-08-04 15:30:00', slaKind: 'INDEPENDENT_SEWING' as const,
}

test('CONTRACT-002: later factory acceptance retains its fact without postponing business allocation deadlines', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ ...input, businessAssignedAt: '2026-08-01 09:00:00' })
  assert.equal(snapshot.acceptedAt, input.acceptedAt)
  assert.equal(snapshot.businessAssignedAt, '2026-08-01 09:00:00')
  assert.equal(snapshot.timingStatus, 'CONFIRMED')
  assert.deepEqual(snapshot.milestones.map((node) => node.deadlineAt), [
    '2026-08-04 23:59:59', '2026-08-08 23:59:59', '2026-08-09 23:59:59',
  ])
})

test('CONTRACT-002: missing business allocation time produces a visible verification gap instead of acceptance-based deadlines', () => {
  const snapshot = createSewingDeliverySlaSnapshot(input)
  assert.equal(snapshot.acceptedAt, input.acceptedAt)
  assert.equal(snapshot.timingStatus, 'PENDING_BUSINESS_ASSIGNMENT')
  assert.match(snapshot.timingMessage!, /业务分配日期.*待核实/)
  assert.deepEqual(snapshot.milestones, [])
  const invalid = createSewingDeliverySlaSnapshot({ ...input, businessAssignedAt: '2026-02-30' })
  assert.equal(invalid.timingStatus, 'PENDING_BUSINESS_ASSIGNMENT')
  assert.deepEqual(invalid.milestones, [])
})

test('CONTRACT-002: historical acceptance-based snapshots remain intact but cannot establish current contract deadlines', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ ...input, businessAssignedAt: '2026-08-01 09:00:00' })
  const { businessAssignedAt: _businessAssignedAt, timingStatus: _status, timingMessage: _message, ...historical } = snapshot
  historical.ruleVersion = 'PPIC-20260907-START-WEEK-SUNDAY'
  const original = JSON.stringify(historical)
  const projection = projectSewingDeliverySla(historical, [], '2026-08-10 09:00:00')
  assert.equal(JSON.stringify(historical), original)
  assert.deepEqual(projection.milestones, [])
  assert.equal(projection.snapshot.timingStatus, 'PENDING_BUSINESS_ASSIGNMENT')
  assert.match(projection.snapshot.timingMessage!, /业务分配日期.*待核实/)
})

test('CONTRACT-002: shared PDA and progress board show missing allocation dates without claiming zero-receipt tasks are complete', () => {
  const snapshot = createSewingDeliverySlaSnapshot(input)
  const projection = projectSewingDeliverySla(snapshot, [], '2026-08-10 09:00:00')
  const view = { runtimeTaskId: input.runtimeTaskId, submittedQty: 0, confirmedReceivedQty: 0, projection }
  assert.equal(projection.remainingQty, 100)
  assert.equal(projection.completed, false)
  for (const html of [
    renderPdaSewingDeliveryProgress(view, '件', '2026-08-10 09:00:00'),
    renderSewingDeliverySlaListCell(view, '件'),
    renderSewingDeliverySlaDetail(view, '件'),
  ]) {
    assert.match(html, /业务分配日期待核实，回货时效暂不能判定/)
    assert.doesNotMatch(html, /全部节点已完成|已完成全部节点|0 小时/)
    assert.doesNotMatch(html, /0\s*\/\s*100|>0%<|>100 件<\/span>\s*<span[^>]*>下一节点/)
    assert.match(html, /100/)
  }
  assert.match(renderSewingDeliverySlaListCell(view, '件'), /回货比例待核实/)
  assert.match(renderSewingDeliverySlaDetail(view, '件'), /回货比例待核实/)
})

test('CONTRACT-002: confirmed dates still show the next contractual node and complete only after all 100 pieces are received', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ ...input, businessAssignedAt: '2026-08-01 09:00:00', acceptedAt: '2026-08-01 10:00:00' })
  const pending = projectSewingDeliverySla(snapshot, [], '2026-08-02 09:00:00')
  const pendingView = { runtimeTaskId: input.runtimeTaskId, submittedQty: 0, confirmedReceivedQty: 0, projection: pending }
  assert.match(renderPdaSewingDeliveryProgress(pendingView, '件', '2026-08-02 09:00:00'), /30% · 30 件/)
  assert.match(renderSewingDeliverySlaListCell(pendingView, '件'), /下一节点 30%/)
  assert.match(renderSewingDeliverySlaDetail(pendingView, '件'), /2026-08-04 23:59:59/)
  const complete = projectSewingDeliverySla(snapshot, [{ recordId: 'complete-100', submittedAt: '2026-08-02 09:00:00', submittedQty: 100, receivedAt: '2026-08-02 10:00:00', receivedQty: 100 }], '2026-08-03 09:00:00')
  const completeView = { runtimeTaskId: input.runtimeTaskId, submittedQty: 100, confirmedReceivedQty: 100, projection: complete }
  assert.equal(complete.completed, true)
  assert.equal(complete.remainingQty, 0)
  assert.match(renderPdaSewingDeliveryProgress(completeView, '件', '2026-08-03 09:00:00'), /全部节点已完成/)
  assert.match(renderSewingDeliverySlaListCell(completeView, '件'), /已完成全部节点/)
})

test('CONTRACT-002: outsourcing tracking uses allocation dates for tender tasks and marks missing dates as unverified', () => {
  const first = listSewingOutsourcingReturnTrackingRows()[0]!
  const assignmentState = captureEffectiveTaskAssignmentState()
  const slaState = captureSewingDeliverySlaSnapshotStore()
  try {
    const changed = structuredClone(assignmentState)
    const assignment = changed.assignments.find(([id]) => id === first.assignment.assignmentId)![1]
    assignment.source = 'TENDER_AWARD'
    restoreEffectiveTaskAssignmentState(changed)
    saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({
      ...input, assignmentId: assignment.assignmentId, runtimeTaskId: assignment.runtimeTaskId,
      productionOrderId: assignment.productionOrderId, factoryId: assignment.factoryId, factoryName: assignment.factoryName,
      assignedQty: assignment.assignedQty, businessAssignedAt: assignment.businessAssignedAt, acceptedAt: '2026-08-25 09:00:00',
    }))
    const row = listSewingOutsourcingReturnTrackingRows().find((item) => item.assignment.assignmentId === assignment.assignmentId)!
    assert.equal(row.acceptedAt, '2026-08-25 09:00:00')
    assert.equal(row.returnProjection.snapshot.assignmentDate, '2026-08-20')
    assert.equal(row.returnProjection.milestones[0]!.deadlineDate, '2026-08-23')
    assert.equal(row.timingStatus, 'CONFIRMED')

    assignment.businessAssignedAt = ''
    restoreEffectiveTaskAssignmentState(changed)
    const missing = listSewingOutsourcingReturnTrackingRows().find((item) => item.assignment.assignmentId === assignment.assignmentId)!
    assert.equal(missing.acceptedAt, '2026-08-25 09:00:00')
    assert.equal(missing.timingStatus, 'PENDING_BUSINESS_ASSIGNMENT')
    assert.match(missing.timingMessage, /业务分配日期.*待核实/)
    assert.deepEqual(missing.returnProjection.milestones, [])
    const html = renderSewingOutsourcingReturnsPage()
    assert.match(html, /业务分配日期待核实，回货时效暂不能判定/)
    assert.doesNotMatch(html, /待有效接单，尚未起算/)
  } finally {
    restoreEffectiveTaskAssignmentState(assignmentState)
    restoreSewingDeliverySlaSnapshotStore(slaState)
  }
})
