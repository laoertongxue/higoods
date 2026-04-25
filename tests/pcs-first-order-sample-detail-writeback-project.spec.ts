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
import {
  getFirstOrderSampleTaskById,
  listFirstOrderSampleTasksByProjectNode,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { updateFirstOrderSampleTaskDetailAndSync } from '../src/data/pcs-first-order-sample-project-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-029')
assert.ok(project, '缺少首单样衣已建未补齐 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(node, '缺少 FIRST_ORDER_SAMPLE 项目节点')
const task = listFirstOrderSampleTasksByProjectNode(project.projectId, node.projectNodeId)[0]
assert.ok(task, '缺少已创建未补齐的首单样衣任务')
assert.equal(task.sampleCode, '')
assert.equal(task.conclusionResult, '')
assert.equal(task.confirmedAt, '')

const detail = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
  status: '待确认',
  patternVersion: 'P2',
  artworkVersion: 'A1',
  samplePlanLines: [
    {
      lineId: 'new-correct-sample-01',
      sampleRole: '正确布确认样',
      materialMode: '正确布',
      quantity: 1,
      targetFactoryId: 'factory-shenzhen-01',
      targetFactoryName: '深圳工厂01',
      linkedSampleCode: 'FOS-RESULT-26002',
      status: '已确认',
      note: '首单正确布样已提交。',
    },
  ],
  finalReferenceNote: '首单样衣作为生产参照，待门禁确认。',
  sampleCode: 'FOS-RESULT-26002',
  conclusionResult: '通过',
  conclusionNote: '首单样衣确认通过。',
  confirmedAt: '2026-04-25 12:00',
  confirmedBy: '张娜',
}, '测试用户')

assert.equal(detail.ok, true)
const updated = getFirstOrderSampleTaskById(task.firstOrderSampleTaskId)
assert.equal(updated?.sampleCode, 'FOS-RESULT-26002')
assert.equal(updated?.conclusionResult, '通过')
assert.equal(updated?.conclusionNote, '首单样衣确认通过。')
assert.equal(updated?.confirmedBy, '张娜')
assert.equal(detail.projectNode?.currentStatus, '待确认')
assert.equal(detail.projectNode?.pendingActionType, '完成首单样衣确认')

const completed = updateFirstOrderSampleTaskDetailAndSync(task.firstOrderSampleTaskId, {
  status: '已通过',
  confirmedAt: '2026-04-25 12:05',
  confirmedBy: '张娜',
}, '测试用户')

assert.equal(completed.ok, true)
assert.equal(completed.projectNode?.currentStatus, '已完成')
assert.equal(completed.projectNode?.latestResultType, '首单样衣打样已完成')

const relation = listProjectRelationsByProjectNode(project.projectId, node.projectNodeId)
  .find((item) => item.sourceObjectId === task.firstOrderSampleTaskId)
assert.ok(relation, '首单样衣详情保存后应写项目关系')
assert.match(relation?.note || '', /FOS-RESULT-26002/)
assert.match(relation?.note || '', /首单样衣确认通过/)
assert.match(relation?.note || '', /张娜/)
