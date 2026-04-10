import assert from 'node:assert/strict'
import { appStore } from '../src/state/store.ts'
import { getProjectById, getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { getProjectArchiveByProjectId } from '../src/data/pcs-project-archive-repository.ts'
import {
  createArchiveTestProject,
  generateStyleShellForArchiveProject,
  resetArchiveScenarioRepositories,
} from './pcs-project-archive-test-helper.ts'
import { handlePcsProjectDetailEvent, renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import {
  handlePcsProjectWorkItemDetailEvent,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-project-work-item-detail.ts'

resetArchiveScenarioRepositories()
const detailContext = createArchiveTestProject('detail-entry')
generateStyleShellForArchiveProject(detailContext.projectId)

const beforeCreateHtml = renderPcsProjectDetailPage(detailContext.projectId)
assert.ok(beforeCreateHtml.includes('创建项目资料归档'), '项目详情页在未建归档时应显示创建入口')

handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'create-project-archive' },
  }),
} as unknown as HTMLElement)

const createdArchive = getProjectArchiveByProjectId(detailContext.projectId)
assert.ok(createdArchive, '从项目详情页创建归档时应写入正式归档对象')
assert.equal(
  appStore.getState().pathname,
  `/pcs/projects/${encodeURIComponent(detailContext.projectId)}/archive`,
  '从项目详情页创建归档后应跳转到正式归档页',
)

const afterCreateHtml = renderPcsProjectDetailPage(detailContext.projectId)
assert.ok(afterCreateHtml.includes('查看项目资料归档'), '项目详情页在已建归档后应显示查看入口')
assert.ok(afterCreateHtml.includes(createdArchive!.archiveNo), '项目详情页应展示正式归档编号')

resetArchiveScenarioRepositories()
const nodeContext = createArchiveTestProject('node-entry')
generateStyleShellForArchiveProject(nodeContext.projectId)
const transferNode = getProjectNodeRecordByWorkItemTypeCode(nodeContext.projectId, 'PROJECT_TRANSFER_PREP')
assert.ok(transferNode, '测试项目必须存在项目转档准备节点')

const beforeNodeCreateHtml = renderPcsProjectWorkItemDetailPage(nodeContext.projectId, transferNode!.projectNodeId)
assert.ok(beforeNodeCreateHtml.includes('创建项目资料归档'), '项目节点详情页在未建归档时应显示创建入口')

handlePcsProjectWorkItemDetailEvent({
  closest: () => ({
    dataset: { pcsWorkItemAction: 'create-project-archive' },
  }),
} as unknown as HTMLElement)

const nodeArchive = getProjectArchiveByProjectId(nodeContext.projectId)
assert.ok(nodeArchive, '从项目节点详情页创建归档时应写入正式归档对象')
assert.equal(
  appStore.getState().pathname,
  `/pcs/projects/${encodeURIComponent(nodeContext.projectId)}/archive`,
  '从项目节点详情页创建归档后应跳转到正式归档页',
)

const nodeDetailHtml = renderPcsProjectWorkItemDetailPage(nodeContext.projectId, transferNode!.projectNodeId)
assert.ok(nodeDetailHtml.includes('查看项目资料归档'), '项目节点详情页在已建归档后应显示查看入口')
assert.ok(nodeDetailHtml.includes(nodeArchive!.archiveNo), '项目节点详情页应展示正式归档编号')

const project = getProjectById(nodeContext.projectId)
assert.equal(project!.projectArchiveId, nodeArchive!.projectArchiveId, '项目详情页和项目节点详情页应写入同一条正式归档记录')

console.log('pcs-project-detail-archive-entry.spec.ts PASS')
