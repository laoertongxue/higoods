import assert from 'node:assert/strict'
import { getProjectById, getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { listProjectRelationsByProject } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectArchiveByProjectId } from '../src/data/pcs-project-archive-repository.ts'
import { buildProjectArchivePageViewModel } from '../src/data/pcs-project-archive-view-model.ts'
import { finalizeProjectArchive } from '../src/data/pcs-project-archive-sync.ts'
import { renderPcsProjectArchivePage } from '../src/pages/pcs-project-archive.ts'
import {
  createArchiveTestProject,
  createProjectArchiveForTest,
  createPublishedTechnicalVersionForArchiveProject,
  generateStyleShellForArchiveProject,
  recordInboundSampleForArchiveProject,
  resetArchiveScenarioRepositories,
  uploadRequiredManualDocuments,
} from './pcs-project-archive-test-helper.ts'

resetArchiveScenarioRepositories()
const blockedContext = createArchiveTestProject('finalize-blocked')
generateStyleShellForArchiveProject(blockedContext.projectId)
const blockedArchive = createProjectArchiveForTest(blockedContext.projectId)
assert.throws(
  () => finalizeProjectArchive(blockedArchive.projectArchiveId, '测试用户'),
  /仍有缺失项/,
  '缺失项不为 0 时不应允许完成项目资料归档',
)

resetArchiveScenarioRepositories()
const readyContext = createArchiveTestProject('finalize-ready')
generateStyleShellForArchiveProject(readyContext.projectId)
const readyArchive = createProjectArchiveForTest(readyContext.projectId)
const publishedVersion = createPublishedTechnicalVersionForArchiveProject(readyContext.projectId)
recordInboundSampleForArchiveProject(readyContext.projectId)
const afterManualUpload = uploadRequiredManualDocuments(readyArchive.projectArchiveId)
assert.equal(afterManualUpload.readyForFinalize, true, '检测资料和报价资料补齐后应允许完成归档')

const archivePageHtml = renderPcsProjectArchivePage(readyContext.projectId)
const archiveViewModel = buildProjectArchivePageViewModel(readyArchive.projectArchiveId)
assert.ok(archiveViewModel, '项目资料归档页应能从正式仓储构建页面视图模型')
assert.ok(archivePageHtml.includes('技术与图纸'), '项目资料归档页应展示技术与图纸分组')
assert.ok(archivePageHtml.includes('样衣与打样'), '项目资料归档页应展示样衣与打样分组')
assert.ok(archivePageHtml.includes('检测与报价'), '项目资料归档页应展示检测与报价分组')
assert.ok(
  archiveViewModel!.technicalDocuments.some((item) => item.sourceObjectId === publishedVersion.technicalVersionId),
  '项目资料归档页技术与图纸分组应来自正式技术资料版本仓储',
)
assert.ok(
  archiveViewModel!.sampleDocuments.some((item) => item.documentGroup === 'SAMPLE_ASSET'),
  '项目资料归档页样衣与打样分组应来自正式样衣仓储或样衣事件同步结果',
)
assert.ok(
  archiveViewModel!.manualDocuments.some((item) => item.documentTitle === '检测报告'),
  '项目资料归档页检测与报价分组应来自正式手工资料记录',
)

const finalized = finalizeProjectArchive(readyArchive.projectArchiveId, '测试用户')
assert.equal(finalized.archiveStatus, 'FINALIZED', '完成归档后正式归档状态应为已归档')
assert.ok(finalized.finalizedAt, '完成归档后应记录正式归档完成时间')

const project = getProjectById(readyContext.projectId)
assert.equal(project!.projectArchiveStatus, 'FINALIZED', '完成归档后商品项目主记录应同步回写正式归档状态')
assert.equal(project!.projectArchiveFinalizedAt, finalized.finalizedAt, '完成归档后商品项目主记录应回写归档完成时间')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(readyContext.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.currentStatus, '已完成', '完成归档后项目转档准备节点应改为已完成')
assert.equal(transferNode!.latestResultType, '项目资料已归档', '完成归档后项目节点应回写正式结果类型')
assert.equal(transferNode!.pendingActionType, '', '完成归档后项目节点不应再保留待处理事项')

const archiveRelation = listProjectRelationsByProject(readyContext.projectId).find(
  (item) => item.sourceModule === '项目资料归档' && item.sourceObjectId === finalized.projectArchiveId,
)
assert.ok(archiveRelation, '完成归档后应仍能读取同一条正式归档项目关系')
assert.equal(archiveRelation!.sourceStatus, 'FINALIZED', '完成归档后项目关系状态应同步更新为正式归档状态枚举')

console.log('pcs-project-archive-finalize.spec.ts PASS')
