import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const writebackSource = readFileSync(
  resolve(process.cwd(), 'src/data/pcs-first-sample-project-writeback.ts'),
  'utf8',
)
assert.doesNotMatch(writebackSource, /createOrUpdateFirstSampleTaskFromProjectNode/)
assert.doesNotMatch(writebackSource, /syncFirstSampleTaskToProjectNode/)

resetProjectRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const task = getFirstSampleTaskById('FS-20260425-002')
assert.ok(task, '缺少首版样衣项目级关系检查任务')
assert.equal(task.projectNodeId, '')
const projectNodesBefore = listProjectNodes(task.projectId)

const result = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
  status: '待确认',
  sampleCode: 'FS-RESULT-CHECK',
  sampleImageIds: ['mock://sample-result/fs-check'],
  fitConfirmationSummary: '版型待最终确认。',
}, '检查脚本')
assert.equal(result.ok, true, result.message)

const relation = findFirstSampleTaskRelations(task.firstSampleTaskId)[0]
assert.ok(relation, '首版样衣详情保存后必须写入商品项目关系')
assert.equal(relation.projectId, task.projectId)
assert.equal(relation.projectNodeId, null)
assert.equal(relation.stepCode, '')
assert.match(relation.note, /fitConfirmationSummary/)
assert.deepEqual(listProjectNodes(task.projectId), projectNodesBefore)

console.log('FIRST_SAMPLE 首版样衣项目级关系写回检查通过。')
