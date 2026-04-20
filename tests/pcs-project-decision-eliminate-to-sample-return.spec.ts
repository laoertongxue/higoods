import assert from 'node:assert/strict'

import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

function resetAll(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectChannelProductRepository()
}

function getProjectByCode(projectCode: string) {
  const project = listProjects().find((item) => item.projectCode === projectCode)
  assert.ok(project, `应存在项目 ${projectCode}`)
  return project!
}

function submitDecision(projectCode: string, workItemTypeCode: 'SAMPLE_CONFIRM' | 'TEST_CONCLUSION', result: '通过' | '淘汰') {
  resetAll()
  const project = getProjectByCode(projectCode)
  const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode)
  assert.ok(node, `${projectCode} 应存在节点 ${workItemTypeCode}`)
  const payloadKey = workItemTypeCode === 'SAMPLE_CONFIRM' ? 'confirmResult' : 'conclusion'
  const noteKey = workItemTypeCode === 'SAMPLE_CONFIRM' ? 'confirmNote' : 'conclusionNote'
  const saveResult = saveProjectNodeFormalRecord({
    projectId: project.projectId,
    projectNodeId: node!.projectNodeId,
    payload: {
      businessDate: '2026-04-20 11:00',
      values: {
        [payloadKey]: result,
        [noteKey]: `本次判定为${result}`,
      },
    },
    completeAfterSave: true,
    operatorName: '测试用户',
  })
  assert.ok(saveResult.ok, `${workItemTypeCode} 应允许提交 ${result}`)
  return {
    projectId: project.projectId,
    node: getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode)!,
    sampleReturnNode: getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_RETURN_HANDLE')!,
    allNodes: listProjectNodes(project.projectId),
    project: getProjectById(project.projectId)!,
  }
}

const sampleConfirmEliminated = submitDecision('PRJ-20251216-004', 'SAMPLE_CONFIRM', '淘汰')
assert.equal(sampleConfirmEliminated.node.currentStatus, '已完成')
assert.equal(sampleConfirmEliminated.node.latestResultType, '淘汰')
assert.equal(sampleConfirmEliminated.sampleReturnNode.currentStatus, '进行中')
assert.equal(sampleConfirmEliminated.project.projectStatus, '进行中')
assert.equal(
  sampleConfirmEliminated.allNodes.find((node) => node.currentStatus === '进行中')?.workItemTypeCode,
  'SAMPLE_RETURN_HANDLE',
)
assert.ok(
  sampleConfirmEliminated.allNodes
    .filter((node) => node.sequenceNo > sampleConfirmEliminated.node.sequenceNo && node.workItemTypeCode !== 'SAMPLE_RETURN_HANDLE')
    .every((node) => node.currentStatus === '已取消' || node.currentStatus === '未开始' || node.currentStatus === '已完成'),
  '淘汰后，中间节点应被取消或保持历史已完成状态',
)

const testingEliminated = submitDecision('PRJ-20251216-020', 'TEST_CONCLUSION', '淘汰')
assert.equal(testingEliminated.node.currentStatus, '已完成')
assert.equal(testingEliminated.sampleReturnNode.currentStatus, '进行中')
assert.equal(testingEliminated.project.projectStatus, '进行中')
assert.equal(
  testingEliminated.allNodes.find((node) => node.currentStatus === '进行中')?.workItemTypeCode,
  'SAMPLE_RETURN_HANDLE',
)
assert.ok(
  testingEliminated.allNodes
    .filter((node) => node.workItemTypeCode !== 'TEST_CONCLUSION' && node.workItemTypeCode !== 'SAMPLE_RETURN_HANDLE')
    .every((node) => node.currentStatus !== '进行中' || node.phaseCode < testingEliminated.sampleReturnNode.phaseCode),
  '淘汰后不应继续保留其它后续进行中节点',
)

console.log('pcs-project-decision-eliminate-to-sample-return.spec.ts PASS')
