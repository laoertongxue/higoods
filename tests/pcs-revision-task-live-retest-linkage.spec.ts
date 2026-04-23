import assert from 'node:assert/strict'

import { getRevisionTaskCompletionMissingFields } from '../src/data/pcs-engineering-task-field-policy.ts'
import { resetRevisionTaskRepository, updateRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import { saveRevisionTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetRevisionTaskRepository()

const task = saveRevisionTaskDraft({
  projectId: '',
  title: '改版样衣回直播验证',
  sourceType: '人工创建',
  styleId: 'style_retest',
  styleCode: 'OLD-SPU-RETEST',
  styleName: '旧款',
  ownerName: '测试版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '版型需要调整。',
  evidenceSummary: '直播反馈已确认。',
  baseStyleCode: 'OLD-SPU-RETEST',
  revisionSuggestionRichText: '调整版型后回直播验证。',
  liveRetestRequired: true,
  liveRetestStatus: '待回直播验证',
})

let saved = updateRevisionTask(task.revisionTaskId, {
  generatedNewTechPackVersionFlag: true,
  generatedNewTechPackVersionAt: '2026-04-23 11:00:00',
})
assert.ok(saved)
assert.ok(getRevisionTaskCompletionMissingFields(saved!).includes('回直播验证状态'))

saved = updateRevisionTask(task.revisionTaskId, {
  liveRetestStatus: '验证通过',
  liveRetestRelationIds: ['LIVE-RETEST-001'],
})
assert.ok(saved)
assert.equal(getRevisionTaskCompletionMissingFields(saved!).includes('回直播验证状态'), false)
assert.equal(getRevisionTaskCompletionMissingFields(saved!).includes('回直播验证结论'), false)

console.log('pcs-revision-task-live-retest-linkage.spec.ts PASS')
