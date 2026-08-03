import assert from 'node:assert/strict'

import { completeDecisionNodeWithResult } from '../src/data/pcs-project-decision-flow-service.ts'
import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'
import {
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'

const expectedOptions = {
  FEASIBILITY_REVIEW: ['进入测款', '样衣退回'],
  SAMPLE_CONFIRM: ['通过', '不通过'],
  TEST_CONCLUSION: ['通过', '不通过', '暂保留'],
} as const

for (const code of Object.keys(expectedOptions) as Array<keyof typeof expectedOptions>) {
  const contract = getProjectStepDefinition(code)
  const decisionField = contract.fieldDefinitions.find((field) =>
    ['reviewConclusion', 'confirmResult', 'conclusion'].includes(field.fieldKey),
  )
  assert.ok(decisionField, `${code} 应存在决策字段`)
  assert.deepEqual(
    (decisionField?.options || []).map((item) => item.value),
    [...expectedOptions[code]],
    `${code} 决策选项必须符合当前业务语义`,
  )
  assert.equal(decisionField?.required, true, `${code} 决策字段必须必填`)
}

resetProjectRepository()
const project = listProjects().find((item) =>
  listProjectNodes(item.projectId).some((node) => node.stepCode === 'TEST_CONCLUSION'),
)
assert.ok(project, '当前演示数据应存在测款判断项目')
const nodesBeforeHold = listProjectNodes(project.projectId)
const conclusionNode = nodesBeforeHold.find((node) => node.stepCode === 'TEST_CONCLUSION')
assert.ok(conclusionNode, '固定五步必须包含测款判断节点')
const conclusionIndex = nodesBeforeHold.findIndex((node) => node.projectNodeId === conclusionNode.projectNodeId)

nodesBeforeHold.slice(0, conclusionIndex).forEach((node) => {
  updateProjectNodeRecord(
    project.projectId,
    node.projectNodeId,
    {
      currentStatus: '已完成',
      latestResultType: '前序业务已完成',
      pendingActionType: '已完成',
      pendingActionText: '节点已完成',
    },
    '规格审查测试',
  )
})
updateProjectNodeRecord(
  project.projectId,
  conclusionNode.projectNodeId,
  {
    currentStatus: '进行中',
    pendingActionType: '提交测款判断',
    pendingActionText: '请提交当前判断',
  },
  '规格审查测试',
)
const testingStatusesBeforeHold = listProjectNodes(project.projectId)
  .filter((node) => node.stepCode === 'LIVE_TEST' || node.stepCode === 'VIDEO_TEST')
  .map((node) => ({ projectNodeId: node.projectNodeId, currentStatus: node.currentStatus }))

const holdResult = completeDecisionNodeWithResult(
  project.projectId,
  conclusionNode.projectNodeId,
  '暂保留',
  '规格审查测试',
  '三天后依据现有测款事实再次判断。',
  '2026-07-31 12:00',
)
assert.equal(holdResult.ok, true)
assert.equal(holdResult.nextNode, null, '暂保留不得启动下一轮测款')
const nodesAfterHold = listProjectNodes(project.projectId)
assert.deepEqual(
  nodesAfterHold
    .filter((node) => node.stepCode === 'LIVE_TEST' || node.stepCode === 'VIDEO_TEST')
    .map((node) => ({ projectNodeId: node.projectNodeId, currentStatus: node.currentStatus })),
  testingStatusesBeforeHold,
  '暂保留不得创建或重新激活直播、短视频测款节点',
)
const heldConclusionNode = nodesAfterHold.find((node) => node.projectNodeId === conclusionNode.projectNodeId)
assert.equal(heldConclusionNode?.currentStatus, '待确认')
assert.equal(heldConclusionNode?.latestResultType, '暂保留')
assert.equal(heldConclusionNode?.pendingActionType, '稍后再判断')

console.log('pcs-project-decision-options.spec.ts PASS')
