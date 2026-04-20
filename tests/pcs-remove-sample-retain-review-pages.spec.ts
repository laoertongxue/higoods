import assert from 'node:assert/strict'

import { listProjects, listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectDetailPage, renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'
import { renderPcsTemplateDetailPage, renderPcsTemplateEditorPage, renderPcsTemplateListPage } from '../src/pages/pcs-templates.ts'
import { renderPcsWorkItemDetailPage, renderPcsWorkItemLibraryPage } from '../src/pages/pcs-work-items.ts'

resetProjectRepository()

const templateListHtml = renderPcsTemplateListPage()
assert.ok(!templateListHtml.includes('样衣留存评估'), '模板列表页不应显示样衣留存评估')

const templateDetailHtml = renderPcsTemplateDetailPage('TPL-002')
assert.ok(!templateDetailHtml.includes('样衣留存评估'), '模板详情页不应显示样衣留存评估')
assert.ok(templateDetailHtml.includes('样衣退回处理'), '模板详情页应显示样衣退回处理')

const templateEditorHtml = renderPcsTemplateEditorPage('TPL-003')
assert.ok(!templateEditorHtml.includes('样衣留存评估'), '模板编辑页不应再允许选择样衣留存评估')

const workItemListHtml = renderPcsWorkItemLibraryPage()
assert.ok(!workItemListHtml.includes('样衣留存评估'), '工作项库页面不应显示样衣留存评估')

const missingWorkItemHtml = renderPcsWorkItemDetailPage('WI-020')
assert.ok(
  /未找到|不存在|返回/.test(missingWorkItemHtml),
  '工作项详情页不应再能正常打开已删除的样衣留存评估',
)

const project = listProjects()[0]!
const projectDetailHtml = await renderPcsProjectDetailPage(project.projectId)
assert.ok(!projectDetailHtml.includes('样衣留存评估'), '项目详情页不应显示样衣留存评估')

const returnNode = listProjectNodes(project.projectId).find((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE')
assert.ok(returnNode, '演示项目应存在样衣退回处理节点')

const nodeDetailHtml = await renderPcsProjectWorkItemDetailPage(project.projectId, returnNode!.projectNodeId)
assert.ok(!nodeDetailHtml.includes('样衣留存评估'), '项目节点详情页不应显示样衣留存评估')
assert.ok(nodeDetailHtml.includes('样衣退回处理'), '项目节点详情页应显示样衣退回处理')
