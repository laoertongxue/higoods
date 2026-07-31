import assert from 'node:assert/strict'

import {
  findFirstSampleTaskRelations,
  updateFirstSampleTaskDetailAndSync,
} from '../src/data/pcs-first-sample-project-writeback.ts'
import {
  getFirstSampleTaskById,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { renderPcsFirstSampleTaskDetailPage } from '../src/pages/pcs-engineering-tasks.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const task = getFirstSampleTaskById('FS-20260425-008')
assert.ok(task, '缺少首版样衣完成展示 mock 任务')
assert.equal(task.projectNodeId, '')
const projectNodesBefore = listProjectNodes(task.projectId)

const syncResult = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {}, '测试用户')
assert.equal(syncResult.ok, true)
const relation = findFirstSampleTaskRelations(task.firstSampleTaskId)[0]
assert.ok(relation)
assert.equal(relation.projectNodeId, null)
assert.equal(relation.stepCode, '')
assert.deepEqual(listProjectNodes(task.projectId), projectNodesBefore)

const html = renderPcsFirstSampleTaskDetailPage(task.firstSampleTaskId)
for (const text of ['深圳工厂02', 'FS-RESULT-25001']) {
  assert.ok(html.includes(text), `完成任务详情缺少字段：${text}`)
}
assert.equal(task.sourceTaskCode, 'PT-20260425-008')
assert.equal(task.sourceTechPackVersionCode, 'TDV-20260425-008')
assert.equal(task.sampleMaterialMode, '正确布')
assert.equal(task.samplePurpose, '首单复用候选')

console.log('pcs-first-sample-completed-node-display.spec.ts PASS')
