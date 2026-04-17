import assert from 'node:assert/strict'

import { upsertProjectArchive, getProjectArchiveByProjectId, resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import {
  resetProjectInlineNodeRecordRepository,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetRevisionTaskRepository, upsertRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type { RevisionTaskRecord } from '../src/data/pcs-revision-task-types.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

function resetAllRepositories(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectChannelProductRepository()
  resetTechnicalDataVersionRepository()
  resetProjectArchiveRepository()
  resetRevisionTaskRepository()
}

resetAllRepositories()

const contract = getProjectWorkItemContract('PROJECT_TRANSFER_PREP')
const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)

for (const key of [
  'linkedStyleId',
  'linkedStyleName',
  'linkedTechPackVersionLabel',
  'linkedTechPackVersionSourceTask',
  'linkedTechPackVersionTaskChain',
  'linkedTechPackVersionDiffSummary',
  'projectArchiveDocumentCount',
  'projectArchiveFileCount',
  'projectArchiveMissingItemCount',
  'projectArchiveCompletedFlag',
  'projectArchiveFinalizedAt',
]) {
  assert.ok(fieldKeys.includes(key), `PROJECT_TRANSFER_PREP 应定义正式字段 ${key}`)
}

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const transferPrepNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'TEST_CONCLUSION')
assert.ok(transferPrepNode, '演示项目应存在项目转档准备节点')
assert.ok(conclusionNode, '演示项目应存在测款结论节点')

const baseVersion = getTechnicalDataVersionById(project!.linkedTechPackVersionId || '')
const baseContent = getTechnicalDataVersionContent(project!.linkedTechPackVersionId || '')
assert.ok(baseVersion, '演示项目应存在当前技术包版本')
assert.ok(baseContent, '演示项目应存在当前技术包版本内容')

const revisionTask: RevisionTaskRecord = {
  revisionTaskId: 'RT-20260410-101',
  revisionTaskCode: 'RT-20260410-101',
  title: '中式盘扣上衣改版（补齐质检标准）',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  projectNodeId: conclusionNode!.projectNodeId,
  workItemTypeCode: 'TEST_CONCLUSION',
  workItemTypeName: '测款结论判定',
  sourceType: '测款触发',
  upstreamModule: '测款结论',
  upstreamObjectType: '项目工作项',
  upstreamObjectId: conclusionNode!.projectNodeId,
  upstreamObjectCode: conclusionNode!.projectNodeId,
  styleId: project!.linkedStyleId || '',
  styleCode: project!.linkedStyleCode || project!.styleNumber,
  styleName: project!.linkedStyleName || project!.projectName,
  referenceObjectType: '',
  referenceObjectId: '',
  referenceObjectCode: '',
  referenceObjectName: '',
  productStyleCode: project!.linkedStyleCode || project!.styleNumber,
  spuCode: project!.linkedStyleCode || project!.styleNumber,
  status: '已确认',
  ownerId: project!.ownerId,
  ownerName: project!.ownerName,
  participantNames: [project!.ownerName, '周强'],
  priorityLevel: '高',
  dueAt: '2026-04-10 18:00:00',
  revisionScopeCodes: ['QUALITY'],
  revisionScopeNames: ['质检标准'],
  revisionVersion: 'V2',
  issueSummary: '当前版本缺少质检标准，不能直接转入项目转档准备。',
  evidenceSummary: '版本检查时发现质检标准为空，需补齐后再推进正式技术包。',
  linkedTechPackVersionId: '',
  linkedTechPackVersionCode: '',
  linkedTechPackVersionLabel: '',
  linkedTechPackVersionStatus: '',
  linkedTechPackUpdatedAt: '',
  createdAt: '2026-04-10 09:00:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-10 09:30:00',
  updatedBy: '测试用户',
  note: '用于验证项目转档准备节点的正式字段承接。',
  legacyProjectRef: project!.projectCode,
  legacyUpstreamRef: conclusionNode!.projectNodeId,
}
upsertRevisionTask(revisionTask)

const nextVersion = createTechnicalDataVersionDraft(
  {
    ...baseVersion!,
    technicalVersionId: 'tdv_transfer_prep_v2',
    technicalVersionCode: 'TDV-TRANSFER-PREP-V2',
    versionLabel: 'V2',
    versionNo: baseVersion!.versionNo + 1,
    sourceProjectId: project!.projectId,
    sourceProjectCode: project!.projectCode,
    sourceProjectName: project!.projectName,
    sourceProjectNodeId: transferPrepNode!.projectNodeId,
    linkedRevisionTaskIds: [revisionTask.revisionTaskId],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    createdFromTaskType: 'REVISION',
    createdFromTaskId: revisionTask.revisionTaskId,
    createdFromTaskCode: revisionTask.revisionTaskCode,
    baseTechnicalVersionId: baseVersion!.technicalVersionId,
    baseTechnicalVersionCode: baseVersion!.technicalVersionCode,
    versionStatus: 'PUBLISHED',
    publishedAt: '2026-04-10 10:00',
    publishedBy: '测试用户',
    createdAt: '2026-04-10 09:20',
    createdBy: '测试用户',
    updatedAt: '2026-04-10 10:00',
    updatedBy: '测试用户',
    note: 'V2 补齐质检标准后作为当前生效技术包。',
    legacyVersionLabel: 'v2.0',
  },
  {
    ...baseContent!,
    technicalVersionId: 'tdv_transfer_prep_v2',
    qualityRules: [
      ...(baseContent!.qualityRules || []),
      {
        id: 'quality-transfer-prep-v2',
        checkItem: '盘扣对称与牢度',
        standardText: '盘扣左右误差不超过 0.3cm，拉力测试通过。',
        samplingRule: '首件全检',
        note: 'V2 改版补齐质检要求。',
      },
    ],
  },
)

const archive = getProjectArchiveByProjectId(project!.projectId)
assert.ok(archive, '演示项目应存在项目资料归档记录')

upsertProjectArchive({
  ...archive!,
  archiveNo: 'ARC-20260410-015',
  currentTechnicalVersionId: nextVersion.technicalVersionId,
  currentTechnicalVersionCode: nextVersion.technicalVersionCode,
  currentTechnicalVersionLabel: nextVersion.versionLabel,
  archiveStatus: 'FINALIZED',
  documentCount: 12,
  fileCount: 18,
  autoCollectedCount: 10,
  manualUploadedCount: 8,
  missingItemCount: 0,
  readyForFinalize: true,
  updatedAt: '2026-04-10 11:00',
  updatedBy: '测试用户',
  finalizedAt: '2026-04-10 11:00',
  finalizedBy: '测试用户',
  note: '项目资料已完成最终归档。',
})

updateProjectRecord(
  project!.projectId,
  {
    linkedTechPackVersionId: nextVersion.technicalVersionId,
    linkedTechPackVersionCode: nextVersion.technicalVersionCode,
    linkedTechPackVersionLabel: nextVersion.versionLabel,
    linkedTechPackVersionStatus: nextVersion.versionStatus,
    linkedTechPackVersionPublishedAt: nextVersion.publishedAt,
    projectArchiveId: archive!.projectArchiveId,
    projectArchiveNo: 'ARC-20260410-015',
    projectArchiveStatus: '已归档',
    projectArchiveDocumentCount: 12,
    projectArchiveFileCount: 18,
    projectArchiveMissingItemCount: 0,
    projectArchiveUpdatedAt: '2026-04-10 11:00',
    projectArchiveFinalizedAt: '2026-04-10 11:00',
    updatedAt: '2026-04-10 11:00',
  },
  '测试用户',
)

const html = await renderPcsProjectWorkItemDetailPage(project!.projectId, transferPrepNode!.projectNodeId)

assert.match(html, /来源款式档案ID/, '详情页应展示来源款式档案 ID')
assert.match(html, /来源款式档案名称/, '详情页应展示来源款式档案名称')
assert.match(html, /当前技术包版本标签/, '详情页应展示技术包版本标签')
assert.match(html, /当前技术包版本来源任务/, '详情页应展示技术包来源任务')
assert.match(html, /当前技术包版本来源任务链/, '详情页应展示技术包来源任务链')
assert.match(html, /当前生效版本与历史版本差异/, '详情页应展示技术包版本差异')
assert.match(html, /归档资料数量/, '详情页应展示归档资料数量')
assert.match(html, /归档文件数量/, '详情页应展示归档文件数量')
assert.match(html, /缺失项数量/, '详情页应展示归档缺失项数量')
assert.match(html, /是否已完成归档/, '详情页应展示归档完成标记')
assert.match(html, /完成归档时间/, '详情页应展示归档完成时间')
assert.match(html, /TDV-TRANSFER-PREP-V2/, '详情页应展示当前技术包版本编码')
assert.match(html, /V2/, '详情页应展示当前技术包版本标签')
assert.match(html, /改版任务 RT-20260410-101/, '详情页应展示技术包来源任务链')
assert.match(html, /完整度变化：\+15 分/, '详情页应展示当前版本与上一版本的完整度差异')
assert.match(html, /补齐项：质检标准/, '详情页应展示补齐的历史缺失项')
assert.match(html, /ARC-20260410-015/, '详情页应展示项目资料归档编号')
assert.match(html, /已归档/, '详情页应展示项目资料归档状态')
assert.match(html, /2026-04-10 11:00/, '详情页应展示完成归档时间')

console.log('pcs-project-transfer-prep-contract.spec.ts PASS')
