import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureSewingOutsourcingSampleDemo, SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS } from '../../src/data/fcs/sewing-outsourcing-demo.ts'
import { captureSewingSampleState, restoreSewingSampleState, resetSewingSampleApprovalSuggestionsForTests, receivePreProductionSampleByPpic, handoffPreProductionSampleToApprover, getSewingSampleApprovalRecord, buildSewingSampleStaticFixture } from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'

test('刷新时静态样衣命令重建不重放到已移交的持久用户状态，构造失败恢复输入', () => {
  resetSewingSampleApprovalSuggestionsForTests()
  ensureSewingOutsourcingSampleDemo()
  const assignmentId = SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent
  const record = getSewingSampleApprovalRecord(assignmentId)!
  const actor = { actorId: record.sample.currentPpicId, actorName: record.sample.currentPpicName, role: 'PPIC' as const }
  receivePreProductionSampleByPpic({ commandId: 'USER-RECEIVE', assignmentId, actor, receivedSamplePhotoUrls: ['/saved-user-photo.jpg'], receivedAt: '2026-09-25 12:00:00' })
  handoffPreProductionSampleToApprover({ commandId: 'USER-HANDOFF', assignmentId, actor, approverTeamName: '批版组', handedAt: '2026-09-25 12:01:00' })
  const saved = captureSewingSampleState()
  const userState = { records: saved.records.filter(([id]) => id === assignmentId), commands: saved.commands.filter(([id]) => id.startsWith('USER-')), sequence: saved.sequence }
  resetSewingSampleApprovalSuggestionsForTests()
  restoreSewingSampleState(userState)
  assert.doesNotThrow(() => ensureSewingOutsourcingSampleDemo())
  assert.deepEqual(getSewingSampleApprovalRecord(assignmentId), userState.records[0][1])
  assert.equal(captureSewingSampleState().records.length, 3)
  assert.equal(captureSewingSampleState().commands.filter(([id]) => id.startsWith('USER-')).length, 2)
  const before = captureSewingSampleState()
  assert.throws(() => buildSewingSampleStaticFixture(() => { throw new Error('fixture aborted') }), /fixture aborted/)
  assert.deepEqual(captureSewingSampleState(), before)
  assert.doesNotThrow(() => ensureSewingOutsourcingSampleDemo())
  assert.deepEqual(captureSewingSampleState(), before)
})
