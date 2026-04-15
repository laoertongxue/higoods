import assert from 'node:assert/strict'
import {
  renderPcsProjectCreatePage,
  renderPcsProjectDetailPage,
  renderPcsProjectListPage,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-projects.ts'
import { listProjects, listProjectNodes } from '../src/data/pcs-project-repository.ts'

const listHtml = renderPcsProjectListPage()

assert.match(listHtml, /商品项目列表/, '列表页应渲染商品项目标题')
assert.match(listHtml, /新建商品项目/, '列表页应提供新建项目入口')
assert.match(listHtml, /设计款中式盘扣上衣|双渠道归档项目/, '列表页应包含演示项目数据')

const project = listProjects()[0]
assert.ok(project, '应存在可用的演示项目')

const detailHtml = renderPcsProjectDetailPage(project.projectId)

assert.match(detailHtml, /阶段与工作项/, '详情页应渲染阶段导航')
assert.match(detailHtml, /项目日志/, '详情页应渲染项目日志区域')
assert.match(detailHtml, /当前存在待决策闸口|项目概览/, '详情页应渲染项目概览或决策闸口')

const node = listProjectNodes(project.projectId)[0]
assert.ok(node, '应存在可用的项目节点')

const workItemHtml = renderPcsProjectWorkItemDetailPage(project.projectId, node.projectNodeId)

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

const sampleAcquireHtml = renderPcsProjectWorkItemDetailPage(sampleAcquireProject.projectId, sampleAcquireNode.projectNodeId)

assert.match(sampleAcquireHtml, /正式字段录入/, '样衣获取节点应渲染正式字段录入区域')
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

const decisionHtml = renderPcsProjectWorkItemDetailPage(decisionProject.projectId, decisionNode.projectNodeId)

assert.match(decisionHtml, /测款结论/, '测款结论节点应渲染正式字段分组')
assert.match(decisionHtml, /通过/, '测款结论节点应包含通过分支')
assert.match(decisionHtml, /调整/, '测款结论节点应包含调整分支')
assert.match(decisionHtml, /暂缓/, '测款结论节点应包含暂缓分支')
assert.match(decisionHtml, /淘汰/, '测款结论节点应包含淘汰分支')
assert.match(decisionHtml, /保存并流转节点/, '测款结论节点应提供保存并流转入口')
assert.match(decisionHtml, /做出决策/, '待确认测款结论节点应保留决策入口')

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

const sampleConfirmHtml = renderPcsProjectWorkItemDetailPage(sampleConfirmProject.projectId, sampleConfirmNode.projectNodeId)

assert.match(sampleConfirmHtml, /样衣确认/, '样衣确认节点应渲染正式字段录入')
assert.match(sampleConfirmHtml, /继续调整/, '样衣确认节点应包含继续调整分支')

function findProjectByNameAndNode(projectNamePart: string, workItemTypeCode: string) {
  return listProjects().find(
    (item) =>
      item.projectName.includes(projectNamePart) &&
      listProjectNodes(item.projectId).some((node) => node.workItemTypeCode === workItemTypeCode),
  )
}

const archivedProject = findProjectByNameAndNode('归档项目', 'CHANNEL_PRODUCT_LISTING')
assert.ok(archivedProject, '应存在归档态演示项目用于覆盖完成链路字段')

const auditCases: Array<{
  workItemTypeCode: string
  projectNamePart: string
  expectedSnippets: string[]
}> = [
  { workItemTypeCode: 'PROJECT_INIT', projectNamePart: '宽松基础T恤', expectedSnippets: ['项目模板', '企划提案', 'Chicmore', '商品企划组'] },
  { workItemTypeCode: 'SAMPLE_ACQUIRE', projectNamePart: '归档项目', expectedSnippets: ['样衣来源方式', '外采', 'https://example.com/mock-sample'] },
  { workItemTypeCode: 'SAMPLE_INBOUND_CHECK', projectNamePart: '归档项目', expectedSnippets: ['样衣编号', `${archivedProject!.projectCode}-Y001`] },
  { workItemTypeCode: 'FEASIBILITY_REVIEW', projectNamePart: '归档项目', expectedSnippets: ['可行性结论', '通过'] },
  { workItemTypeCode: 'SAMPLE_SHOOT_FIT', projectNamePart: '归档项目', expectedSnippets: ['拍摄安排', '完成试穿拍摄'] },
  { workItemTypeCode: 'SAMPLE_CONFIRM', projectNamePart: '归档项目', expectedSnippets: ['确认结果', '通过'] },
  { workItemTypeCode: 'SAMPLE_COST_REVIEW', projectNamePart: '归档项目', expectedSnippets: ['核价金额', '86'] },
  { workItemTypeCode: 'SAMPLE_PRICING', projectNamePart: '归档项目', expectedSnippets: ['价格带', '定价口径确认'] },
  { workItemTypeCode: 'CHANNEL_PRODUCT_LISTING', projectNamePart: '归档项目', expectedSnippets: ['Global-Store', '239', 'USD', '已更新'] },
  { workItemTypeCode: 'VIDEO_TEST', projectNamePart: '归档项目', expectedSnippets: ['微信视频号 / 连衣裙测款号', '32,800', '17,686'] },
  { workItemTypeCode: 'LIVE_TEST', projectNamePart: '归档项目', expectedSnippets: [`${archivedProject!.projectCode}-LIVE-001`, '45,200', '22,944'] },
  { workItemTypeCode: 'TEST_DATA_SUMMARY', projectNamePart: '归档项目', expectedSnippets: ['双渠道测款结果稳定', '78,000', '40,630', '渠道拆分', '测款来源拆分', '币种拆分'] },
  { workItemTypeCode: 'TEST_CONCLUSION', projectNamePart: '归档项目', expectedSnippets: ['测款结论', '通过', `${archivedProject!.projectCode}-CP-001`] },
  { workItemTypeCode: 'STYLE_ARCHIVE_CREATE', projectNamePart: '归档项目', expectedSnippets: ['款式档案编码', `SPU-${archivedProject!.projectCode.split('-').slice(-1)[0]}`, '可生产'] },
  { workItemTypeCode: 'PROJECT_TRANSFER_PREP', projectNamePart: '归档项目', expectedSnippets: ['当前技术包版本', `TP-${archivedProject!.projectCode.split('-').slice(-1)[0]}-V2`, `ARC-${archivedProject!.projectCode.split('-').slice(-2).join('-')}`] },
  { workItemTypeCode: 'PATTERN_TASK', projectNamePart: '归档项目', expectedSnippets: ['制版说明', 'S-L', 'P1'] },
  { workItemTypeCode: 'PATTERN_ARTWORK_TASK', projectNamePart: '礼服设计研发项目', expectedSnippets: ['花型任务'] },
  { workItemTypeCode: 'FIRST_SAMPLE', projectNamePart: '归档项目', expectedSnippets: ['广州一厂', `${archivedProject!.projectCode}-Y001`] },
  { workItemTypeCode: 'PRE_PRODUCTION_SAMPLE', projectNamePart: '礼服设计研发项目', expectedSnippets: ['产前版样衣'] },
  { workItemTypeCode: 'SAMPLE_RETAIN_REVIEW', projectNamePart: '归档项目', expectedSnippets: ['留存结论', '留样'] },
  { workItemTypeCode: 'SAMPLE_RETURN_HANDLE', projectNamePart: '归档项目', expectedSnippets: ['处理结果', '已退回供应商'] },
]

assert.equal(auditCases.length, 21, '应逐项核对 21 个工作项')

for (const auditCase of auditCases) {
  const projectRecord = findProjectByNameAndNode(auditCase.projectNamePart, auditCase.workItemTypeCode)
  assert.ok(projectRecord, `${auditCase.workItemTypeCode} 应存在对应演示项目`)
  const targetNode = listProjectNodes(projectRecord!.projectId).find((item) => item.workItemTypeCode === auditCase.workItemTypeCode)
  assert.ok(targetNode, `${auditCase.workItemTypeCode} 应存在对应工作项节点`)
  const html = renderPcsProjectWorkItemDetailPage(projectRecord!.projectId, targetNode!.projectNodeId)
  for (const snippet of auditCase.expectedSnippets) {
    assert.ok(html.includes(snippet), `${auditCase.workItemTypeCode} 应展示「${snippet}」`)
  }
}

const createHtml = renderPcsProjectCreatePage()

assert.match(createHtml, /创建商品项目/, '创建页应渲染创建标题')
assert.match(createHtml, /基础信息/, '创建页应渲染基础信息卡片')
assert.match(createHtml, /模板预览/, '创建页应渲染模板预览区域')

console.log('pcs-projects.spec.ts PASS')
