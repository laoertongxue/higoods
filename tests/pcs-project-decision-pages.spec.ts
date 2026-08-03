import assert from 'node:assert/strict'

import {
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectStepDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()

const decisionProject = listProjects().find((item) =>
  listProjectNodes(item.projectId).some((node) => node.stepCode === 'TEST_CONCLUSION'),
)
assert.ok(decisionProject, '当前演示数据应存在测款判断项目')

const decisionNode = listProjectNodes(decisionProject!.projectId).find(
  (node) => node.stepCode === 'TEST_CONCLUSION',
)
assert.ok(decisionNode)
const decisionNodes = listProjectNodes(decisionProject!.projectId)
const decisionIndex = decisionNodes.findIndex((node) => node.projectNodeId === decisionNode!.projectNodeId)
decisionNodes.slice(0, decisionIndex).forEach((node) => {
  updateProjectNodeRecord(
    decisionProject!.projectId,
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
  decisionProject!.projectId,
  decisionNode!.projectNodeId,
  {
    currentStatus: '待确认',
    pendingActionType: '做出决策',
    pendingActionText: '请做出测款判断',
  },
  '规格审查测试',
)

const html = await renderPcsProjectStepDetailPage(decisionProject!.projectId, decisionNode!.projectNodeId)
assert.match(html, /通过/)
assert.match(html, /不通过/)
assert.match(html, /暂保留/)
assert.doesNotMatch(html, />调整</)
assert.doesNotMatch(html, />暂缓</)
assert.doesNotMatch(html, />继续调整</)
assert.doesNotMatch(html, />终止</)
assert.match(html, /做出决策/)

console.log('pcs-project-decision-pages.spec.ts PASS')
