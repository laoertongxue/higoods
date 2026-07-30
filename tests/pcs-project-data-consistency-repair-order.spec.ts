import assert from 'node:assert/strict'

import {
  getProjectStoreSnapshot,
  listProjectNodes,
  listProjects,
  replaceProjectStore,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { repairPcsProjectDataConsistency } from '../src/data/pcs-project-data-consistency.ts'

function prepareScenario(input: {
  targetCode: 'SAMPLE_COST_REVIEW'
  earlierOpenCode?: 'SAMPLE_CONFIRM'
}): { projectId: string; targetNodeId: string } {
  resetProjectRepository()
  resetProjectInlineNodeRecordRepository()
  const project = listProjects()[0]
  assert.ok(project, '应存在固定五步演示项目')
  const nodes = listProjectNodes(project.projectId)
  const target = nodes.find((node) => node.workItemTypeCode === input.targetCode)
  assert.ok(target, `应存在 ${input.targetCode} 节点`)
  const targetIndex = nodes.findIndex((node) => node.projectNodeId === target.projectNodeId)
  const earlierOpenIndex = input.earlierOpenCode
    ? nodes.findIndex((node) => node.workItemTypeCode === input.earlierOpenCode)
    : -1
  assert.ok(!input.earlierOpenCode || (earlierOpenIndex >= 0 && earlierOpenIndex < targetIndex), '更早开放节点必须位于目标节点之前')

  const snapshot = getProjectStoreSnapshot()
  replaceProjectStore({
    ...snapshot,
    nodes: snapshot.nodes.map((node) => {
      if (node.projectId !== project.projectId) return node
      const index = nodes.findIndex((item) => item.projectNodeId === node.projectNodeId)
      if (index < targetIndex) {
        if (index === earlierOpenIndex) {
          return {
            ...node,
            currentStatus: '进行中',
            latestResultType: '',
            latestResultText: '',
            currentIssueType: '',
            currentIssueText: '',
            pendingActionType: '待执行',
            pendingActionText: `当前请处理：${node.workItemTypeName}`,
          }
        }
        return {
          ...node,
          currentStatus: '已取消',
          latestResultType: '场景准备',
          latestResultText: '前序节点已关闭。',
          currentIssueType: '',
          currentIssueText: '',
          pendingActionType: '已取消',
          pendingActionText: '节点已取消',
        }
      }
      if (index === targetIndex) {
        return {
          ...node,
          currentStatus: '已完成',
          latestResultType: '节点完成',
          latestResultText: '历史状态错误地标记为已完成。',
          currentIssueType: '',
          currentIssueText: '',
          pendingActionType: '已完成',
          pendingActionText: '节点已完成',
        }
      }
      return {
        ...node,
        currentStatus: '未开始',
        latestResultType: '',
        latestResultText: '',
        currentIssueType: '',
        currentIssueText: '',
        pendingActionType: '待开始',
        pendingActionText: '待开始执行',
      }
    }),
  })

  return { projectId: project.projectId, targetNodeId: target.projectNodeId }
}

const firstExecutable = prepareScenario({ targetCode: 'SAMPLE_COST_REVIEW' })
repairPcsProjectDataConsistency('规格审查测试')
replaceProjectStore(getProjectStoreSnapshot())
const firstExecutableNode = listProjectNodes(firstExecutable.projectId).find(
  (node) => node.projectNodeId === firstExecutable.targetNodeId,
)
assert.equal(firstExecutableNode?.currentStatus, '进行中')
assert.equal(firstExecutableNode?.latestResultType, '待补齐正式数据')
assert.equal(firstExecutableNode?.currentIssueType, '数据待补齐')
assert.equal(firstExecutableNode?.pendingActionType, '补齐正式数据')

const blockedLater = prepareScenario({
  targetCode: 'SAMPLE_COST_REVIEW',
  earlierOpenCode: 'SAMPLE_CONFIRM',
})
repairPcsProjectDataConsistency('规格审查测试')
replaceProjectStore(getProjectStoreSnapshot())
const blockedLaterNode = listProjectNodes(blockedLater.projectId).find(
  (node) => node.projectNodeId === blockedLater.targetNodeId,
)
assert.equal(blockedLaterNode?.currentStatus, '未开始')
assert.equal(blockedLaterNode?.latestResultType, '')
assert.equal(blockedLaterNode?.latestResultText, '')
assert.equal(blockedLaterNode?.currentIssueType, '')
assert.equal(blockedLaterNode?.currentIssueText, '')
assert.equal(blockedLaterNode?.pendingActionType, '待前序完成')
assert.match(blockedLaterNode?.pendingActionText || '', /样衣确认/)

console.log('pcs-project-data-consistency-repair-order.spec.ts PASS')
