import assert from 'node:assert/strict'
import {
  renderPcsProjectCreatePage,
  renderPcsProjectDetailPage,
  renderPcsProjectListPage,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-projects.ts'
import { listProjects, listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const listHtml = await renderPcsProjectListPage()

assert.match(listHtml, /商品项目列表/, '列表页应渲染商品项目标题')
assert.match(listHtml, /新建商品项目/, '列表页应提供新建项目入口')
assert.match(listHtml, /设计款中式盘扣上衣|双渠道归档项目/, '列表页应包含演示项目数据')

const project = listProjects()[0]
assert.ok(project, '应存在可用的演示项目')

const detailHtml = await renderPcsProjectDetailPage(project.projectId)

assert.match(detailHtml, /阶段与工作项/, '详情页应渲染阶段导航')
assert.match(detailHtml, /项目日志/, '详情页应渲染项目日志区域')
assert.match(detailHtml, /当前存在待决策闸口|项目概览/, '详情页应渲染项目概览或决策闸口')

const node = listProjectNodes(project.projectId)[0]
assert.ok(node, '应存在可用的项目节点')

const workItemHtml = await renderPcsProjectWorkItemDetailPage(project.projectId, node.projectNodeId)

assert.match(workItemHtml, /全量信息/, '工作项详情页应渲染全量信息页签')
assert.match(workItemHtml, /记录/, '工作项详情页应渲染记录页签')
assert.match(workItemHtml, /附件与引用/, '工作项详情页应渲染附件与引用页签')
assert.match(workItemHtml, /操作日志/, '工作项详情页应渲染操作日志页签')

const sampleAcquireProject = listProjects().find((item) =>
  listProjectNodes(item.projectId).some(
    (candidate) => candidate.workItemTypeCode === 'SAMPLE_ACQUIRE' && candidate.currentStatus !== '未开始',
  ),
)
assert.ok(sampleAcquireProject, '应存在包含样衣获取节点的演示项目')

const sampleAcquireNode = listProjectNodes(sampleAcquireProject.projectId).find(
  (candidate) => candidate.workItemTypeCode === 'SAMPLE_ACQUIRE' && candidate.currentStatus !== '未开始',
)
assert.ok(sampleAcquireNode, '应存在样衣获取节点')

const sampleAcquireHtml = await renderPcsProjectWorkItemDetailPage(sampleAcquireProject.projectId, sampleAcquireNode.projectNodeId)

assert.match(sampleAcquireHtml, /全量信息/, '样衣获取节点应渲染全量信息页签')
assert.match(sampleAcquireHtml, /样衣来源方式/, '样衣获取节点应渲染正式字段标签')
assert.match(sampleAcquireHtml, /保存正式字段|新增正式记录/, '样衣获取节点应提供字段保存入口')

const decisionProject = listProjects().find((item) =>
  listProjectNodes(item.projectId).some(
    (candidate) => candidate.workItemTypeCode === 'TEST_CONCLUSION' && candidate.currentStatus === '待确认',
  ),
)
assert.ok(decisionProject, '应存在待判定测款结论的演示项目')

const decisionNode = listProjectNodes(decisionProject.projectId).find(
  (candidate) => candidate.workItemTypeCode === 'TEST_CONCLUSION' && candidate.currentStatus === '待确认',
)
assert.ok(decisionNode, '应存在待判定的测款结论节点')

const decisionHtml = await renderPcsProjectWorkItemDetailPage(decisionProject.projectId, decisionNode.projectNodeId)

assert.match(decisionHtml, /测款结论/, '测款结论节点应渲染正式字段分组')
assert.match(decisionHtml, /通过/, '测款结论节点应包含通过分支')
assert.match(decisionHtml, /淘汰/, '测款结论节点应包含淘汰分支')
assert.doesNotMatch(decisionHtml, />调整</, '测款结论节点不应再包含调整分支')
assert.doesNotMatch(decisionHtml, />暂缓</, '测款结论节点不应再包含暂缓分支')
assert.match(decisionHtml, /做出决策/, '待确认测款结论节点应保留决策入口')
assert.doesNotMatch(decisionHtml, /保存并流转节点/, '待确认测款结论节点不应直接显示执行类保存入口')

const sampleConfirmProject = listProjects().find((item) =>
  listProjectNodes(item.projectId).some(
    (candidate) => candidate.workItemTypeCode === 'SAMPLE_CONFIRM' && candidate.currentStatus !== '未开始',
  ),
)
assert.ok(sampleConfirmProject, '应存在包含样衣确认节点的演示项目')

const sampleConfirmNode = listProjectNodes(sampleConfirmProject.projectId).find(
  (candidate) => candidate.workItemTypeCode === 'SAMPLE_CONFIRM' && candidate.currentStatus !== '未开始',
)
assert.ok(sampleConfirmNode, '应存在样衣确认节点')

const sampleConfirmHtml = await renderPcsProjectWorkItemDetailPage(sampleConfirmProject.projectId, sampleConfirmNode.projectNodeId)

assert.match(sampleConfirmHtml, /样衣确认/, '样衣确认节点应渲染正式字段录入')
assert.doesNotMatch(sampleConfirmHtml, />继续调整</, '样衣确认节点不应再包含继续调整分支')

function findProjectByNode(workItemTypeCode: string, preferredProjectNamePart = '') {
  return listProjects().find((item) => {
    if (preferredProjectNamePart && !item.projectName.includes(preferredProjectNamePart)) return false
    return listProjectNodes(item.projectId).some((node) => node.workItemTypeCode === workItemTypeCode)
  })
}

const createHtml = await renderPcsProjectCreatePage()

assert.match(createHtml, /创建商品项目/, '创建页应渲染创建标题')
assert.match(createHtml, /基础信息/, '创建页应渲染基础信息卡片')
assert.match(createHtml, /模板预览/, '创建页应渲染模板预览区域')

console.log('pcs-projects.spec.ts PASS')
process.exit(0)
