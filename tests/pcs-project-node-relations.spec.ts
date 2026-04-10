import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProjectDetailViewModel, buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectStoreSnapshot, listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()

const nodeDetailPageSource = readFileSync(new URL('../src/pages/pcs-project-work-item-detail.ts', import.meta.url), 'utf8')
assert.ok(nodeDetailPageSource.includes('renderRelationSection'), '节点详情页应新增正式关联对象信息区')
assert.ok(nodeDetailPageSource.includes('当前节点暂无关联对象'), '节点详情页应包含节点级关联对象空状态文案')
assert.ok(nodeDetailPageSource.includes('当前节点尚未建立正式模块关联'), '节点详情页应包含节点级正式关系空状态说明')

const snapshot = getProjectStoreSnapshot()
const project = snapshot.projects.find((item) => item.projectCode === 'PRJ-20251216-001') ?? snapshot.projects[0]
assert.ok(project, '应存在可验证的初始化项目')

const patternNode = listProjectNodes(project!.projectId).find((node) => node.workItemTypeCode === 'PATTERN_TASK')
assert.ok(patternNode, '应存在制版任务节点用于验证节点级关系')

const nodeDetail = buildProjectNodeDetailViewModel(project!.projectId, patternNode!.projectNodeId)
assert.ok(nodeDetail, '应能按真实 projectNodeId 打开节点详情')
assert.ok(nodeDetail!.relationSection.totalCount > 0, '节点详情页关联对象区域应来自正式关系仓储')
assert.ok(
  nodeDetail!.relationSection.items.every((item) => item.projectNodeId === patternNode!.projectNodeId),
  '节点详情页应只展示当前节点关联的正式关系记录',
)
assert.ok(
  !nodeDetail!.relationSection.items.some((item) => item.sourceObjectCode === 'AT-20260109-001'),
  '未挂项目工作项的关系记录不应误显示在节点详情页',
)

const detail = buildProjectDetailViewModel(project!.projectId)
assert.ok(detail!.relationSection.unboundRelationCount >= 1, '项目详情页应能识别未挂项目工作项的正式关系')

const noRelationNode = listProjectNodes(project!.projectId).find(
  (node) => node.workItemTypeCode !== 'PATTERN_TASK' && node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE',
)
assert.ok(noRelationNode, '应存在当前没有正式关系的节点')

const noRelationNodeDetail = buildProjectNodeDetailViewModel(project!.projectId, noRelationNode!.projectNodeId)
assert.ok(noRelationNodeDetail, '应能读取当前没有正式关系的节点详情')
assert.equal(noRelationNodeDetail!.relationSection.totalCount, 0, '无正式关系的节点详情页不应伪造关联对象')

console.log('pcs-project-node-relations.spec.ts PASS')
