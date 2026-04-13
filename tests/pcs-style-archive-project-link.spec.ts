import assert from 'node:assert/strict'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { buildProjectDetailViewModel, buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { prepareProjectWithPassedTesting } from './pcs-project-formal-chain-helper.ts'

const project = prepareProjectWithPassedTesting('款式档案项目关联测试项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
assert.ok(node, '测试项目应存在生成款式档案节点')

const result = generateStyleArchiveShellFromProject(project.projectId, '测试用户')
assert.ok(result.ok && result.style, '应先生成正式款式档案壳')

const detail = buildProjectDetailViewModel(project.projectId)
assert.ok(detail, '项目详情视图模型应可读取正式项目主记录')
assert.equal(detail!.linkedStyleId, result.style!.styleId, '项目详情视图模型应回读正式款式档案主关联')
assert.ok(detail!.relationSection.groups.some((group) => group.items.some((item) => item.styleArchiveDetail?.styleCode === result.style!.styleCode)), '项目详情关联对象区域应能读取正式款式档案关系')

const nodeDetail = buildProjectNodeDetailViewModel(project.projectId, node!.projectNodeId)
assert.ok(nodeDetail, '节点详情视图模型应可读取正式节点')
assert.equal(nodeDetail!.linkedStyleCode, result.style!.styleCode, '节点详情视图模型应与项目主记录保持同一条正式档案关联')
assert.ok(nodeDetail!.relationSection.items.some((item) => item.styleArchiveDetail?.styleCode === result.style!.styleCode), '节点详情关联对象区域应读取正式款式档案关系')

const projectHtml = renderPcsProjectDetailPage(project.projectId)
assert.ok(projectHtml.includes('查看款式档案'), '项目详情页生成成功后应展示查看款式档案入口')

const nodeHtml = renderPcsProjectWorkItemDetailPage(project.projectId, node!.projectNodeId)
assert.ok(nodeHtml.includes(result.style!.styleCode), '项目节点详情页应展示同一条正式款式档案记录')
assert.ok(nodeHtml.includes('款式档案关联'), '项目节点详情页应新增款式档案关联区')

console.log('pcs-style-archive-project-link.spec.ts PASS')
