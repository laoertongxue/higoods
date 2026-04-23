import assert from 'node:assert/strict'

import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { savePatternTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetPatternTaskRepository()

const task = savePatternTaskDraft({
  projectId: '',
  title: '设计师款花型需求',
  sourceType: '项目模板阶段',
  demandSourceType: '设计师款',
  processType: '直喷',
  requestQty: 3,
  fabricSku: 'FAB-PRINT-001',
  fabricName: '雪纺印花坯布',
  demandImageIds: ['mock://pattern-demand/a.png'],
  patternSpuCode: 'SPU-TEST-001',
  assignedTeamCode: 'BDG_TEAM',
  assignedMemberId: 'bdg_ramzi_adli',
  patternCategoryCode: '植物与花卉',
  patternStyleTags: ['热带', '度假'],
  hotSellerFlag: true,
})

assert.equal(task.demandSourceType, '设计师款')
assert.equal(task.processType, '直喷')
assert.equal(task.requestQty, 3)
assert.equal(task.fabricSku, 'FAB-PRINT-001')
assert.deepEqual(task.demandImageIds, ['mock://pattern-demand/a.png'])
assert.equal(task.assignedTeamName, '万隆团队')
assert.equal(task.assignedMemberName, 'ramzi adli')
assert.equal(task.patternCategoryCode, '植物与花卉')
assert.deepEqual(task.patternStyleTags, ['热带', '度假'])
assert.equal(task.hotSellerFlag, true)

console.log('pcs-pattern-task-demand-fields.spec.ts PASS')
