import assert from 'node:assert/strict'

import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

type TestedDecisionCode = 'SAMPLE_CONFIRM' | 'TEST_CONCLUSION'

function resetAll(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectChannelProductRepository()
}

function findCurrentProjectWithNode(workItemTypeCode: TestedDecisionCode) {
  const project = listProjects().find((item) =>
    Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, workItemTypeCode)),
  )
  assert.ok(project, `当前演示数据应存在包含 ${workItemTypeCode} 的项目`)
  return project
}

function prepareDecisionNode(projectId: string, workItemTypeCode: TestedDecisionCode): void {
  const nodes = listProjectNodes(projectId)
  const decisionNode = nodes.find((node) => node.workItemTypeCode === workItemTypeCode)
  assert.ok(decisionNode, `项目应存在 ${workItemTypeCode} 节点`)
  const decisionIndex = nodes.findIndex((node) => node.projectNodeId === decisionNode.projectNodeId)

  nodes.slice(0, decisionIndex).forEach((node) => {
    updateProjectNodeRecord(
      projectId,
      node.projectNodeId,
      {
        currentStatus: '已完成',
        latestResultType: '前序业务已完成',
        latestResultText: '验收准备：前序业务已完成。',
        pendingActionType: '已完成',
        pendingActionText: '节点已完成',
      },
      '规格审查测试',
    )
  })
  updateProjectNodeRecord(
    projectId,
    decisionNode.projectNodeId,
    {
      currentStatus: '进行中',
      pendingActionType: '提交判断',
      pendingActionText: '请提交当前判断',
    },
    '规格审查测试',
  )
}

function submitNotPassedAndCompleteReturn(workItemTypeCode: TestedDecisionCode) {
  resetAll()
  const project = findCurrentProjectWithNode(workItemTypeCode)
  prepareDecisionNode(project.projectId, workItemTypeCode)
  const decisionNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode)!
  const payloadKey = workItemTypeCode === 'SAMPLE_CONFIRM' ? 'confirmResult' : 'conclusion'
  const noteKey = workItemTypeCode === 'SAMPLE_CONFIRM' ? 'confirmNote' : 'conclusionNote'

  const decisionResult = saveProjectNodeFormalRecord({
    projectId: project.projectId,
    projectNodeId: decisionNode.projectNodeId,
    payload: {
      businessDate: '2026-07-31 10:00',
      values: {
        [payloadKey]: '不通过',
        [noteKey]: '当前样衣或测款结果不通过，进入样衣退回处理。',
      },
    },
    completeAfterSave: true,
    operatorName: '规格审查测试',
  })
  assert.equal(decisionResult.ok, true, `${workItemTypeCode} 应允许提交不通过：${decisionResult.message}`)

  const routedDecisionNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode)!
  const sampleReturnNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_RETURN_HANDLE')
  assert.equal(routedDecisionNode.currentStatus, '已完成')
  assert.equal(routedDecisionNode.latestResultType, '不通过')
  assert.equal(sampleReturnNode?.currentStatus, '进行中')
  assert.equal(decisionResult.nextNode?.projectNodeId, sampleReturnNode?.projectNodeId)
  assert.equal(getProjectById(project.projectId)?.projectStatus, '进行中')
  assert.equal(
    listProjectNodes(project.projectId).find((node) => node.currentStatus === '进行中')?.workItemTypeCode,
    'SAMPLE_RETURN_HANDLE',
  )

  const returnResult = saveProjectNodeFormalRecord({
    projectId: project.projectId,
    projectNodeId: sampleReturnNode!.projectNodeId,
    payload: {
      businessDate: '2026-07-31 11:00',
      values: {
        handleType: '报废处理',
        handledQty: 1,
        handledBy: '样衣管理员',
        handledAt: '2026-07-31 11:00',
        returnResult: '样衣已完成报废登记，实物和单据均已收尾。',
        sampleCode: `SAMPLE-${workItemTypeCode}`,
        returnDocCode: `RETURN-${workItemTypeCode}`,
      },
    },
    completeAfterSave: true,
    operatorName: '规格审查测试',
  })
  assert.equal(returnResult.ok, true, `样衣退回处理应允许完成：${returnResult.message}`)

  const completedReturnNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_RETURN_HANDLE')!
  const completedProject = getProjectById(project.projectId)!
  const completedNodes = listProjectNodes(project.projectId)
  assert.equal(completedReturnNode.currentStatus, '已完成')
  assert.equal(completedReturnNode.latestResultType, '节点完成')
  assert.ok(
    completedNodes.every((node) => node.currentStatus === '已完成' || node.currentStatus === '已取消'),
    '样衣退回完成后，项目所有节点都应形成已完成或已取消的收尾事实',
  )
  assert.equal(completedProject.projectStatus, '已归档', '样衣退回闭环后项目应完成收尾并归档')
}

submitNotPassedAndCompleteReturn('SAMPLE_CONFIRM')
submitNotPassedAndCompleteReturn('TEST_CONCLUSION')

console.log('pcs-project-decision-eliminate-to-sample-return.spec.ts PASS')
