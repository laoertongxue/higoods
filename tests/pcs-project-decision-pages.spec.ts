import assert from 'node:assert/strict'

import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()

const decisionProject = listProjects().find((item) =>
  listProjectNodes(item.projectId).some((node) => node.workItemTypeCode === 'TEST_CONCLUSION' && node.currentStatus === '待确认'),
)
assert.ok(decisionProject, '应存在待确认决策项目')

const decisionNode = listProjectNodes(decisionProject!.projectId).find(
  (node) => node.workItemTypeCode === 'TEST_CONCLUSION' && node.currentStatus === '待确认',
)
assert.ok(decisionNode)

const html = await renderPcsProjectWorkItemDetailPage(decisionProject!.projectId, decisionNode!.projectNodeId)
assert.match(html, /通过/)
assert.match(html, /淘汰/)
assert.doesNotMatch(html, />调整</)
assert.doesNotMatch(html, />暂缓</)
assert.doesNotMatch(html, />继续调整</)
assert.doesNotMatch(html, />终止</)
assert.match(html, /做出决策/)
assert.match(html, /样衣退回处理/)

console.log('pcs-project-decision-pages.spec.ts PASS')
