import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByProjectNode,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasksByProjectNode,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { updateFirstSampleTaskDetailAndSync } from '../src/data/pcs-first-sample-project-writeback.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-026')
assert.ok(project, '缺少首版样衣已建未补齐 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_SAMPLE')
assert.ok(node, '缺少 FIRST_SAMPLE 项目节点')
const task = listFirstSampleTasksByProjectNode(project.projectId, node.projectNodeId)[0]
assert.ok(task, '缺少已创建未补齐的首版样衣任务')
assert.equal(task.sampleCode, '')
assert.equal(task.fitConfirmationSummary, '')

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
const updated = getFirstSampleTaskById(task.firstSampleTaskId)
assert.equal(updated?.sampleCode, 'FS-RESULT-26002')
assert.deepEqual(updated?.sampleImageIds, ['mock://sample-result/fs-26002-1'])
assert.equal(updated?.fitConfirmationSummary, '版型待最终确认。')
assert.equal(result.projectNode?.currentStatus, '待确认')
assert.equal(result.projectNode?.pendingActionType, '完成首版样衣验收')

const relation = listProjectRelationsByProjectNode(project.projectId, node.projectNodeId)
  .find((item) => item.sourceObjectId === task.firstSampleTaskId)
assert.ok(relation, '首版样衣详情保存后应写项目关系')
assert.match(relation?.note || '', /FS-RESULT-26002/)
assert.match(relation?.note || '', /版型待最终确认/)
