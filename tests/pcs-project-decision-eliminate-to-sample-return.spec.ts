import assert from 'node:assert/strict'

import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import {
  getProjectById,
  getProjectNodeRecordByStepCode,
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

function findCurrentProjectWithNode(stepCode: TestedDecisionCode) {
  const project = listProjects().find((item) =>
    Boolean(getProjectNodeRecordByStepCode(item.projectId, stepCode)),
  )
  assert.ok(project, `当前演示数据应存在包含 ${stepCode} 的项目`)
  return project
}

function prepareDecisionNode(projectId: string, stepCode: TestedDecisionCode): void {
  const nodes = listProjectNodes(projectId)
  const decisionNode = nodes.find((node) => node.stepCode === stepCode)
  assert.ok(decisionNode, `项目应存在 ${stepCode} 节点`)
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

function submitNotPassedAndCompleteReturn(stepCode: TestedDecisionCode) {
  resetAll()
  const project = findCurrentProjectWithNode(stepCode)
  prepareDecisionNode(project.projectId, stepCode)
  const decisionNode = getProjectNodeRecordByStepCode(project.projectId, stepCode)!
  const payloadKey = stepCode === 'SAMPLE_CONFIRM' ? 'confirmResult' : 'conclusion'
  const noteKey = stepCode === 'SAMPLE_CONFIRM' ? 'confirmNote' : 'conclusionNote'

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
  assert.equal(decisionResult.ok, true, `${stepCode} 应允许提交不通过：${decisionResult.message}`)

  const routedDecisionNode = getProjectNodeRecordByStepCode(project.projectId, stepCode)!
  const sampleReturnNode = getProjectNodeRecordByStepCode(project.projectId, 'SAMPLE_RETURN_HANDLE')
  assert.equal(routedDecisionNode.currentStatus, '已完成')
  assert.equal(routedDecisionNode.latestResultType, '不通过')
  assert.equal(sampleReturnNode?.currentStatus, '进行中')
  assert.equal(decisionResult.nextNode?.projectNodeId, sampleReturnNode?.projectNodeId)
  assert.equal(getProjectById(project.projectId)?.projectStatus, '进行中')
  assert.equal(
    listProjectNodes(project.projectId).find((node) => node.currentStatus === '进行中')?.stepCode,
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
        sampleCode: `SAMPLE-${stepCode}`,
        returnDocCode: `RETURN-${stepCode}`,
      },
    },
    completeAfterSave: true,
    operatorName: '规格审查测试',
  })
  assert.equal(returnResult.ok, true, `样衣退回处理应允许完成：${returnResult.message}`)

  const completedReturnNode = getProjectNodeRecordByStepCode(project.projectId, 'SAMPLE_RETURN_HANDLE')!
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
