import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  listProjects,
  replaceProjectStore,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { buildProjectDetailViewModel, buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { createTechnicalDataVersionFromProject, createTechnicalDataVersionFromStyle } from '../src/data/pcs-project-technical-data-writeback.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { resetStyleArchiveRepository, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { handlePcsProjectDetailEvent, renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'

function prepareProjectWithStyleShell() {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()

  const project = listProjects().find(
    (item) =>
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE') &&
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP'),
  )
  assert.ok(project, '应存在可用于建立技术资料版本的初始化项目')

  updateProjectRecord(
    project!.projectId,
    {
      projectStatus: '进行中',
      currentPhaseCode: 'PHASE_04',
      currentPhaseName: '开发推进',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
      linkedTechnicalVersionId: '',
      linkedTechnicalVersionCode: '',
      linkedTechnicalVersionLabel: '',
      linkedTechnicalVersionStatus: '',
      linkedTechnicalVersionPublishedAt: '',
    },
    '测试用户',
  )

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
  assert.ok(styleNode && transferNode, '项目必须同时具备款式档案节点和项目转档准备节点')
  updateProjectNodeRecord(project!.projectId, styleNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')
  updateProjectNodeRecord(project!.projectId, transferNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

  const styleResult = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
  assert.ok(styleResult.ok && styleResult.style, '应先生成正式款式档案壳')
  return {
    projectId: project!.projectId,
    transferNodeId: transferNode!.projectNodeId,
  }
}

const prepared = prepareProjectWithStyleShell()
const created = createTechnicalDataVersionFromProject(prepared.projectId, '测试用户')

const updatedProject = getProjectById(prepared.projectId)
assert.equal(updatedProject!.linkedTechnicalVersionId, created.record.technicalVersionId, '商品项目主记录应回写最新技术资料版本主关联')
assert.equal(updatedProject!.linkedTechnicalVersionStatus, 'DRAFT', '新建草稿后项目主记录应显示草稿状态')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(prepared.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestInstanceId, created.record.technicalVersionId, '项目转档准备节点应回写最新技术资料版本实例 ID')
assert.equal(transferNode!.latestResultType, '已建立技术资料版本', '项目转档准备节点应回写正式结果类型')
assert.equal(transferNode!.pendingActionType, '补全技术资料', '项目转档准备节点应回写下一步待处理事项')

const technicalRelations = listProjectRelationsByProject(prepared.projectId).filter(
  (item) => item.sourceModule === '技术资料' && item.sourceObjectId === created.record.technicalVersionId,
)
assert.equal(technicalRelations.length, 1, '建立技术资料版本后应写入一条正式项目关系')
assert.equal(technicalRelations[0].workItemTypeCode, 'PROJECT_TRANSFER_PREP', '技术资料版本关系必须挂到项目转档准备节点')

const detail = buildProjectDetailViewModel(prepared.projectId)
assert.ok(detail, '项目详情视图模型应可读取正式商品项目')
assert.equal(detail!.linkedTechnicalVersionCode, created.record.technicalVersionCode, '项目详情视图模型应读取正式技术资料版本编号')
assert.ok(
  detail!.relationSection.groups.some((group) =>
    group.items.some((item) => item.technicalVersionDetail?.technicalVersionCode === created.record.technicalVersionCode),
  ),
  '项目详情关联对象区域应可读取正式技术资料版本关系',
)

const nodeDetail = buildProjectNodeDetailViewModel(prepared.projectId, prepared.transferNodeId)
assert.ok(nodeDetail, '项目节点详情视图模型应可读取正式节点')
assert.equal(nodeDetail!.linkedTechnicalVersionCode, created.record.technicalVersionCode, '项目节点详情应与商品项目保持同一条正式技术资料版本关联')
assert.ok(
  nodeDetail!.relationSection.items.some(
    (item) => item.technicalVersionDetail?.technicalVersionCode === created.record.technicalVersionCode,
  ),
  '项目节点详情关联对象区应读取正式技术资料版本关系',
)

const projectHtml = renderPcsProjectDetailPage(prepared.projectId)
handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'select-work-item', workItemId: prepared.transferNodeId },
  }),
} as unknown as HTMLElement)
const projectTechnicalHtml = renderPcsProjectDetailPage(prepared.projectId)
assert.ok(projectTechnicalHtml.includes('查看技术资料版本'), '项目详情页在已建立技术资料版本后应显示查看入口')
assert.ok(projectTechnicalHtml.includes(created.record.technicalVersionCode), '项目详情页应展示正式技术资料版本编号')

const nodeHtml = renderPcsProjectWorkItemDetailPage(prepared.projectId, prepared.transferNodeId)
assert.ok(nodeHtml.includes('技术资料版本关联'), '项目节点详情页应新增技术资料版本关联区')
assert.ok(nodeHtml.includes(created.record.technicalVersionCode), '项目节点详情页应展示同一条正式技术资料版本记录')

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()

const projectWithoutStyle = listProjects().find((item) => getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP'))
assert.ok(projectWithoutStyle, '应存在可验证缺少款式档案场景的项目')
updateProjectRecord(projectWithoutStyle!.projectId, {
  projectStatus: '进行中',
  currentPhaseCode: 'PHASE_04',
  currentPhaseName: '开发推进',
  linkedStyleId: '',
  linkedStyleCode: '',
  linkedStyleName: '',
}, '测试用户')
assert.throws(
  () => createTechnicalDataVersionFromProject(projectWithoutStyle!.projectId, '测试用户'),
  /尚未生成正式款式档案/,
  '项目未生成款式档案壳时不应允许建立技术资料版本',
)

const canceledPrepared = prepareProjectWithStyleShell()
const canceledNode = getProjectNodeRecordByWorkItemTypeCode(canceledPrepared.projectId, 'PROJECT_TRANSFER_PREP')
updateProjectNodeRecord(canceledPrepared.projectId, canceledNode!.projectNodeId, { currentStatus: '已取消' }, '测试用户')
assert.throws(
  () => createTechnicalDataVersionFromProject(canceledPrepared.projectId, '测试用户'),
  /节点已取消/,
  '项目转档准备节点已取消时不应允许建立技术资料版本',
)

const missingNodePrepared = prepareProjectWithStyleShell()
const snapshot = getProjectStoreSnapshot()
const sourceProject = getProjectById(missingNodePrepared.projectId)!
const sourcePhases = snapshot.phases.filter((item) => item.projectId === missingNodePrepared.projectId)
const sourceNodes = snapshot.nodes.filter((item) => item.projectId === missingNodePrepared.projectId)
const missingNodeProjectId = 'prj_missing_transfer_prep'
replaceProjectStore({
  version: snapshot.version,
  projects: [
    ...snapshot.projects,
    {
      ...sourceProject,
      projectId: missingNodeProjectId,
      projectCode: 'PRJ-MISSING-TRANSFER',
      projectName: '缺少项目转档准备节点项目',
      linkedTechnicalVersionId: '',
      linkedTechnicalVersionCode: '',
      linkedTechnicalVersionLabel: '',
      linkedTechnicalVersionStatus: '',
      linkedTechnicalVersionPublishedAt: '',
    },
  ],
  phases: [
    ...snapshot.phases,
    ...sourcePhases.map((item) => ({
      ...item,
      projectId: missingNodeProjectId,
      projectPhaseId: `${item.projectPhaseId}_copy`,
    })),
  ],
  nodes: [
    ...snapshot.nodes,
    ...sourceNodes
      .filter((item) => item.workItemTypeCode !== 'PROJECT_TRANSFER_PREP')
      .map((item) => ({
        ...item,
        projectId: missingNodeProjectId,
        projectNodeId: `${item.projectNodeId}_copy`,
      })),
  ],
})
updateStyleArchive(sourceProject.linkedStyleId!, {
  sourceProjectId: missingNodeProjectId,
  sourceProjectCode: 'PRJ-MISSING-TRANSFER',
  sourceProjectName: '缺少项目转档准备节点项目',
})
assert.throws(
  () => createTechnicalDataVersionFromProject(missingNodeProjectId, '测试用户'),
  /未配置“项目转档准备”节点/,
  '项目缺少项目转档准备节点时不应允许建立技术资料版本',
)

console.log('pcs-project-technical-version-relation.spec.ts PASS')
