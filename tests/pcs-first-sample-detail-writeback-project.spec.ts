import assert from 'node:assert/strict'

import { listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  getFirstSampleTaskById,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { updateFirstSampleTaskDetailAndSync } from '../src/data/pcs-first-sample-project-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()

const task = getFirstSampleTaskById('FS-20260425-002')
assert.ok(task, '缺少首版样衣已建未补齐 mock 任务')
assert.equal(task.projectNodeId, '')
assert.equal(task.sampleCode, '')
assert.equal(task.fitConfirmationSummary, '')
const projectNodesBefore = listProjectNodes(task.projectId)

const result = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
  status: '待确认',
  sampleCode: 'FS-RESULT-26002',
  sampleImageIds: ['mock://sample-result/fs-26002-1'],
  fitConfirmationSummary: '版型待最终确认。',
  artworkConfirmationSummary: '花型位置待买手确认。',
  productionReadinessNote: '待验收后确认是否可复用。',
  confirmedAt: '',
}, '测试用户')

assert.equal(result.ok, true)
assert.equal(result.projectNode, null)
const updated = getFirstSampleTaskById(task.firstSampleTaskId)
assert.equal(updated?.sampleCode, 'FS-RESULT-26002')
assert.deepEqual(updated?.sampleImageIds, ['mock://sample-result/fs-26002-1'])
assert.equal(updated?.fitConfirmationSummary, '版型待最终确认。')
assert.deepEqual(listProjectNodes(task.projectId), projectNodesBefore)
