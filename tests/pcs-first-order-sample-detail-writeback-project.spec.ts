import assert from 'node:assert/strict'

import { listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { findFirstOrderSampleTaskRelations, updateFirstOrderSampleTaskDetailAndSync } from '../src/data/pcs-first-order-sample-project-writeback.ts'
import {
  getFirstOrderSampleTaskById,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const task = getFirstOrderSampleTaskById('FOS-20260425-002')
assert.ok(task, '缺少首单样衣已建未补齐 mock 任务')
assert.equal(task.projectNodeId, '')
assert.equal(task.sampleCode, '')
assert.equal(task.conclusionResult, '')
const projectNodesBefore = listProjectNodes(task.projectId)

const detail = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
  status: '已通过',
  patternVersion: 'P2',
  artworkVersion: 'A1',
  samplePlanLines: [{
    lineId: 'new-correct-sample-01',
    sampleRole: '正确布确认样',
    materialMode: '正确布',
    quantity: 1,
    targetFactoryId: 'factory-shenzhen-01',
    targetFactoryName: '深圳工厂01',
    linkedSampleCode: 'FOS-RESULT-26002',
    status: '已确认',
    note: '首单正确布样已提交。',
  }],
  finalReferenceNote: '首单样衣作为生产参照。',
  sampleCode: 'FOS-RESULT-26002',
  conclusionResult: '通过',
  conclusionNote: '首单样衣确认通过。',
  confirmedAt: '2026-04-25 12:05',
  confirmedBy: '张娜',
}, '测试用户')

assert.equal(detail.ok, true)
assert.equal(detail.projectNode, null)
assert.match(detail.message, /独立任务/)
const updated = getFirstOrderSampleTaskById(task.firstOrderSampleTaskId)
assert.equal(updated?.sampleCode, 'FOS-RESULT-26002')
assert.equal(updated?.conclusionResult, '通过')
assert.equal(updated?.confirmedBy, '张娜')
assert.deepEqual(listProjectNodes(task.projectId), projectNodesBefore)
assert.equal(findFirstOrderSampleTaskRelations(task.firstOrderSampleTaskId).length, 0)

console.log('pcs-first-order-sample-detail-writeback-project.spec.ts PASS')
