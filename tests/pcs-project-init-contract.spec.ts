import assert from 'node:assert/strict'

import {
  getProjectConfigSourceMapping,
  listProjectWorkItemFieldDefinitions,
} from '../src/data/pcs-project-domain-contract.ts'
import {
  createEmptyProjectDraft,
  listProjectNodes,
  listProjects,
} from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

const draftKeys = Object.keys(createEmptyProjectDraft()).sort()
const projectInitFieldKeys = listProjectWorkItemFieldDefinitions('PROJECT_INIT').map((field) => field.fieldKey)
const uniqueFieldKeys = Array.from(new Set(projectInitFieldKeys)).sort()

assert.equal(projectInitFieldKeys.length, draftKeys.length, 'PROJECT_INIT 字段总数应与项目创建草稿一致')
assert.equal(uniqueFieldKeys.length, draftKeys.length, 'PROJECT_INIT 不应出现重复字段定义')
assert.deepEqual(uniqueFieldKeys, draftKeys, 'PROJECT_INIT 正式字段应完整覆盖创建草稿全部字段')

const missingMappings = draftKeys.filter((fieldKey) => !getProjectConfigSourceMapping(fieldKey))
assert.deepEqual(missingMappings, [], 'PROJECT_INIT 全部字段都应具备来源映射')

const project = listProjects()[0]
assert.ok(project, '应存在商品项目演示数据')

const projectInitNode = listProjectNodes(project.projectId).find((node) => node.workItemTypeCode === 'PROJECT_INIT')
assert.ok(projectInitNode, '演示项目应包含 PROJECT_INIT 节点')

const detailHtml = renderPcsProjectWorkItemDetailPage(project.projectId, projectInitNode.projectNodeId)
assert.match(detailHtml, /项目类型/, 'PROJECT_INIT 详情应展示项目类型')
assert.match(detailHtml, /年份/, 'PROJECT_INIT 详情应展示年份')
assert.match(detailHtml, /季节标签/, 'PROJECT_INIT 详情应展示季节标签')
assert.match(detailHtml, /目标客群标签/, 'PROJECT_INIT 详情应展示目标客群标签')
assert.match(detailHtml, /样衣来源方式/, 'PROJECT_INIT 详情应展示样衣来源方式')
assert.match(detailHtml, /负责人名称/, 'PROJECT_INIT 详情应展示负责人名称快照')

console.log('pcs-project-init-contract.spec.ts PASS')
