import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureSewingSampleState, restoreSewingSampleState, resetSewingSampleApprovalSuggestionsForTests,
  getSewingSampleApprovalRecord, listSewingSampleApprovalListEntries, registerSewingSampleStaticDefaults,
  hasSewingSampleStaticDefaults,
} from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'
import { captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState } from '../../src/data/fcs/effective-task-assignments.ts'
import { ensureSewingOutsourcingSampleDemo, getDefaultSewingSampleApprovalRecords, SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS } from '../../src/data/fcs/sewing-outsourcing-demo.ts'
import { renderSampleApprovalSuggestionsPage } from '../../src/pages/sewing-outsourcing/sample-approval-suggestions.ts'

/** Count full record/history copies, without using an elapsed-time threshold as a unit assertion. */
function observeCopies<T>(action: () => T) {
  const originalClone = globalThis.structuredClone, originalStringify = JSON.stringify
  let historyCopies = 0, wholeStateCopies = 0, historySerializations = 0
  globalThis.structuredClone = ((value: any, options?: StructuredSerializeOptions) => {
    if (value?.assignmentId?.startsWith('SCOPE-HISTORY-')) historyCopies++
    if (Array.isArray(value?.records) && value.records.length >= 2000) wholeStateCopies++
    return originalClone(value, options)
  }) as typeof structuredClone
  JSON.stringify = ((value: any, ...args: any[]) => {
    if (value?.assignmentId?.startsWith('SCOPE-HISTORY-')) historySerializations++
    return (originalStringify as any)(value, ...args)
  }) as typeof JSON.stringify
  try { return { result: action(), counters: () => ({ historyCopies, wholeStateCopies, historySerializations }) } }
  finally { globalThis.structuredClone = originalClone; JSON.stringify = originalStringify }
}

test('完整2000条先参与身份/状态筛选和统计，列表仅复制当页20件资料；再次render不重建历史基准', () => {
  resetSewingSampleApprovalSuggestionsForTests()
  ensureSewingOutsourcingSampleDemo()
  const beforeSamples = captureSewingSampleState(), beforeAssignments = captureEffectiveTaskAssignmentState()
  const template = getDefaultSewingSampleApprovalRecords()[2]
  const assignment = beforeAssignments.assignments.find(([id]) => id === SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent)![1]
  const sampleState = structuredClone(beforeSamples), assignmentState = structuredClone(beforeAssignments)
  for (let index = 0; index < 2000; index++) {
    const assignmentId = `SCOPE-HISTORY-${index}`, runtimeTaskId = `SCOPE-TASK-${index}`
    const record = structuredClone(template)
    record.assignmentId = assignmentId; record.sample.assignmentId = assignmentId
    record.assignmentAliases = [{ assignmentId, runtimeTaskId }]
    record.sample.runtimeTaskId = runtimeTaskId; record.sample.sampleId = `SCOPE-SAMPLE-${index}`
    record.sample.sampleNo = `SCOPE-NO-${index}`; record.sample.productionOrderId = `SCOPE-ORDER-${index}`
    record.sample.productionOrderNo = `SCOPE-ORDER-${index}`; record.sample.styleCode = `SCOPE-STYLE-${index}`
    record.sample.status = index % 2 === 0 ? 'WAITING_PPIC_RECEIVE' : 'FEEDBACK_SENT'
    record.legacyHistory = { original: { preservedHistory: 'full old record '.repeat(500) }, convertedAt: '2026-10-22T01:00:00Z',
      convertedBy: '原记录核对人', unverifiedTime: true, note: '全文保留，仅本页复制' }
    sampleState.records.push([assignmentId, record])
    assignmentState.assignments.push([assignmentId, { ...structuredClone(assignment), assignmentId, runtimeTaskId }])
    assignmentState.current.push([runtimeTaskId, [assignmentId]])
  }
  resetSewingSampleApprovalSuggestionsForTests()
  restoreSewingSampleState(sampleState); restoreEffectiveTaskAssignmentState(assignmentState)
  try {
    const first = observeCopies(() => renderSampleApprovalSuggestionsPage()) // cold default registration with all 2000 saved records already present
    assert.deepEqual(first.counters(), { historyCopies: 19, wholeStateCopies: 0, historySerializations: 0 })
    assert.match(first.result, /待PPIC接收的产前版样衣/)
    assert.match(first.result, />1001<\//, '首页待收计数包括2000历史中全部1000条及原静态1条')
    assert.match(first.result, />1000<\//, '完成计数仍包括全部1000历史完成记录')
    assert.equal((first.result.match(/data-sample-approval-action="show-card"/g) || []).length, 20)
    assert.ok(first.result.includes('SCOPE-NO-36')); assert.ok(!first.result.includes('SCOPE-NO-38'))
    const second = observeCopies(() => renderSampleApprovalSuggestionsPage())
    assert.deepEqual(second.counters(), first.counters())
    assert.equal(getSewingSampleApprovalRecord('SCOPE-HISTORY-1999')!.legacyHistory!.note, '全文保留，仅本页复制')
  } finally { restoreSewingSampleState(beforeSamples); restoreEffectiveTaskAssignmentState(beforeAssignments) }
})

test('轻列表字段及别名、完整getter、默认资料均返回隔离副本', () => {
  resetSewingSampleApprovalSuggestionsForTests(); ensureSewingOutsourcingSampleDemo()
  const id = SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack
  const before = getSewingSampleApprovalRecord(id)!
  const entries = listSewingSampleApprovalListEntries(), entry = entries.find(item => item.assignmentId === id)!
  assert.equal('inspectionStandardSnapshot' in entry, false); assert.equal('legacyHistory' in entry, false)
  assert.equal('referenceSnapshots' in entry, false); assert.equal('suggestionVersions' in entry, false)
  entry.sample.styleName = '不得污染内部事实'; entry.assignmentAliases[0].assignmentId = '不得污染别名'
  const full = getSewingSampleApprovalRecord(id)!
  full.sample.status = 'FEEDBACK_SENT'; full.inspectionStandardSnapshot!.items[0].content = '不得修改冻结要求'
  full.suggestionVersions[0].issues![0].note = '不得修改历史问题'
  const defaults = getDefaultSewingSampleApprovalRecords(); defaults[2].sample.styleName = '不得修改默认资料'
  assert.deepEqual(getSewingSampleApprovalRecord(id), before)
  assert.notEqual(getDefaultSewingSampleApprovalRecords()[2].sample.styleName, '不得修改默认资料')
})

test('默认版本更新只改变未被修改的基准，持久覆盖、别名、旧意见完整保留；失败可重试', () => {
  resetSewingSampleApprovalSuggestionsForTests()
  const defaults = getDefaultSewingSampleApprovalRecords()
  const saved = structuredClone(defaults[0]); saved.sample.status = 'PPIC_RECEIVED'
  saved.sample.ppicReceivedSamplePhotoUrls = ['/actual-saved-sample.jpg']
  saved.assignmentAliases!.push({ assignmentId: 'SAVED-ALIAS', runtimeTaskId: 'SAVED-TASK' })
  saved.legacyHistory = { original: { oldOpinion: '原已存意见及原图' }, convertedAt: '2026-10-22T01:00:00Z',
    convertedBy: '核对人', unverifiedTime: true, note: '原历史不得被静态版本替换' }
  restoreSewingSampleState({ records: [[saved.assignmentId, saved]], commands: [['SAVED-COMMAND', { assignmentId: saved.assignmentId, action: 'PPIC_RECEIVED' }]], sequence: 4 })
  const observed = observeCopies(() => registerSewingSampleStaticDefaults('scope-v1', defaults, () => 'registered'))
  assert.equal(observed.result, 'registered'); assert.equal(hasSewingSampleStaticDefaults('scope-v1'), true)
  assert.deepEqual(getSewingSampleApprovalRecord('SAVED-ALIAS'), saved)
  const next = structuredClone(defaults); next[0].sample.styleName = '新版默认名称'; next[1].sample.styleName = '新版未修改基准'
  registerSewingSampleStaticDefaults('scope-v2', next, () => undefined)
  assert.deepEqual(getSewingSampleApprovalRecord(saved.assignmentId), saved)
  assert.equal(getSewingSampleApprovalRecord(next[1].assignmentId)!.sample.styleName, '新版未修改基准')
  const before = captureSewingSampleState()
  assert.throws(() => registerSewingSampleStaticDefaults('scope-failed', defaults, () => { throw new Error('默认分配构造未完成') }), /构造未完成/)
  assert.deepEqual(captureSewingSampleState(), before)
  assert.equal(hasSewingSampleStaticDefaults('scope-v2'), true)
  assert.equal(hasSewingSampleStaticDefaults('scope-failed'), false)
  resetSewingSampleApprovalSuggestionsForTests()
  assert.equal(hasSewingSampleStaticDefaults('scope-v2'), false)
  ensureSewingOutsourcingSampleDemo()
  assert.equal(captureSewingSampleState().records.length, 3)
})
