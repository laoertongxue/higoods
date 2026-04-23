import assert from 'node:assert/strict'

import { getPatternTechPackActionMeta } from '../src/data/pcs-tech-pack-task-generation.ts'
import { resetPatternTaskRepository, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { savePatternTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetPatternTaskRepository()

const task = savePatternTaskDraft({
  projectId: '',
  title: '花型技术包串联',
  sourceType: '项目模板阶段',
  productStyleCode: 'SPU-2026-018',
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: 1,
  fabricName: '印花面料',
  demandImageIds: ['mock://pattern-demand/c.png'],
  completionImageIds: ['mock://pattern-complete/c.png'],
  buyerReviewStatus: '买手已通过',
  artworkVersion: 'A1',
  assignedTeamCode: 'CN_TEAM',
  assignedMemberId: 'cn_guanhao',
})
updatePatternTask(task.patternTaskId, { status: '已确认' })

assert.doesNotThrow(() => getPatternTechPackActionMeta(task.patternTaskId))
const action = getPatternTechPackActionMeta(task.patternTaskId)
assert.match(action.label, /技术包|花型/, '花型任务仍保留技术包动作入口')

console.log('pcs-pattern-task-tech-pack-linkage.spec.ts PASS')
