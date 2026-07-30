import assert from 'node:assert/strict'

import { completeDecisionNodeWithResult } from '../src/data/pcs-project-decision-flow-service.ts'
import {
  listProjectNodes,
  listProjects,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'

const project = listProjects()[0]
assert.ok(project, '测试数据必须包含商品项目')
const nodes = listProjectNodes(project.projectId)
const conclusionNode = nodes.find((node) => node.workItemTypeCode === 'TEST_CONCLUSION')
assert.ok(conclusionNode, '固定五步必须包含测款判断节点')

const conclusionIndex = nodes.findIndex((node) => node.projectNodeId === conclusionNode.projectNodeId)
nodes.slice(0, conclusionIndex).forEach((node) => {
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

const result = completeDecisionNodeWithResult(
  project.projectId,
  conclusionNode.projectNodeId,
  '暂保留',
  '规格审查测试',
  '当前不下结论，三天后再判断。',
  '2026-07-30 16:00',
)
assert.equal(result.ok, true)
assert.equal(result.nextNode, null, '暂保留不得创建或重启下一轮测款计划')

const migratedNodes = listProjectNodes(project.projectId)
assert.ok(
  migratedNodes
    .filter((node) => node.workItemTypeCode === 'LIVE_TEST' || node.workItemTypeCode === 'VIDEO_TEST')
    .every((node) => node.currentStatus === '已完成'),
  '暂保留不得重新激活直播或短视频测款节点',
)
const heldConclusionNode = migratedNodes.find((node) => node.workItemTypeCode === 'TEST_CONCLUSION')
assert.equal(heldConclusionNode?.currentStatus, '待确认', '暂保留应保留判断入口，过些天再判断')
assert.equal(heldConclusionNode?.latestResultType, '暂保留')
assert.equal(heldConclusionNode?.pendingActionType, '稍后再判断')

console.log('pcs-project-temporary-hold.spec.ts PASS')
