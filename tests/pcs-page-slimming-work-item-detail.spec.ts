import assert from 'node:assert/strict'
import {
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-projects.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()

const project = listProjects()[0]
assert.ok(project, '应存在项目数据')
const node = listProjectNodes(project.projectId)[0]
assert.ok(node, '应存在项目节点')

const html = await renderPcsProjectWorkItemDetailPage(project.projectId, node.projectNodeId)
assert.doesNotMatch(html, /字段分层清单|字段模型说明|任务中心说明|本页用于|该模块用于/, '工作项详情不应再出现说明型文案')
assert.match(html, /全量信息/, '工作项详情应保留全量信息页签')
assert.match(html, /记录/, '工作项详情应保留记录页签')
assert.match(html, /附件与引用/, '工作项详情应保留附件与引用页签')
assert.match(html, /操作日志/, '工作项详情应保留操作日志页签')

console.log('pcs-page-slimming-work-item-detail.spec.ts PASS')
