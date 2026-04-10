import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
} from '../src/data/pcs-project-repository.ts'
import {
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
} from '../src/data/pcs-project-archive-repository.ts'
import { syncProjectArchive } from '../src/data/pcs-project-archive-sync.ts'
import { createTechnicalDataVersionFromProject } from '../src/data/pcs-project-technical-data-writeback.ts'
import {
  createArchiveTestProject,
  createFirstSampleRecordForArchiveProject,
  createProjectArchiveForTest,
  createPublishedTechnicalVersionForArchiveProject,
  createRevisionRecordForArchiveProject,
  generateStyleShellForArchiveProject,
  resetArchiveScenarioRepositories,
} from './pcs-project-archive-test-helper.ts'

resetArchiveScenarioRepositories()
const context = createArchiveTestProject('sync')
generateStyleShellForArchiveProject(context.projectId)
const archive = createProjectArchiveForTest(context.projectId)
const beforeCount = listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId).length

const technicalVersion = createPublishedTechnicalVersionForArchiveProject(context.projectId)
const afterTechnical = getProjectArchiveByProjectId(context.projectId)!
const afterTechnicalDocuments = listProjectArchiveDocumentsByArchiveId(afterTechnical.projectArchiveId)
assert.ok(afterTechnicalDocuments.length > beforeCount, '技术资料版本正式写入后应自动同步到项目资料归档')
assert.ok(
  afterTechnicalDocuments.some(
    (item) =>
      item.documentGroup === 'TECHNICAL_DATA' &&
      item.sourceObjectId === technicalVersion.technicalVersionId,
  ),
  '归档对象应自动收集正式技术资料版本资料',
)

const revisionResult = createRevisionRecordForArchiveProject(context.projectId)
assert.equal(revisionResult.ok, true, '测试项目应能创建正式改版任务')
const afterRevision = getProjectArchiveByProjectId(context.projectId)!
assert.ok(
  listProjectArchiveDocumentsByArchiveId(afterRevision.projectArchiveId).some(
    (item) =>
      item.documentGroup === 'REVISION_RECORD' &&
      item.sourceObjectId === revisionResult.task.revisionTaskId,
  ),
  '改版任务正式写入后应自动同步到项目资料归档',
)

const firstSampleResult = createFirstSampleRecordForArchiveProject(context.projectId)
assert.equal(firstSampleResult.ok, true, '测试项目应能创建正式首版样衣打样任务')
const afterFirstSample = getProjectArchiveByProjectId(context.projectId)!
assert.ok(
  listProjectArchiveDocumentsByArchiveId(afterFirstSample.projectArchiveId).some(
    (item) =>
      item.documentGroup === 'SAMPLE_ASSET' &&
      item.sourceObjectId === firstSampleResult.task.firstSampleTaskId,
  ),
  '首版样衣打样正式写入后应自动同步到项目资料归档',
)

const documentsBeforeResync = listProjectArchiveDocumentsByArchiveId(afterFirstSample.projectArchiveId)
syncProjectArchive(afterFirstSample.projectArchiveId, '测试用户')
const documentsAfterResync = listProjectArchiveDocumentsByArchiveId(afterFirstSample.projectArchiveId)
assert.equal(
  documentsAfterResync.length,
  documentsBeforeResync.length,
  '重复同步同一项目资料归档时，不应重复生成相同来源资料记录',
)

const updatedProject = getProjectById(context.projectId)
const transferNode = getProjectNodeRecordByWorkItemTypeCode(context.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(updatedProject!.projectArchiveId, afterFirstSample.projectArchiveId, '自动同步后商品项目主记录应保持同一条正式归档主关联')
assert.equal(transferNode!.latestInstanceId, afterFirstSample.projectArchiveId, '自动同步后项目节点应持续指向同一条正式归档记录')

resetArchiveScenarioRepositories()
const noArchiveContext = createArchiveTestProject('no-auto-create')
generateStyleShellForArchiveProject(noArchiveContext.projectId)
createTechnicalDataVersionFromProject(noArchiveContext.projectId, '测试用户')
assert.equal(
  getProjectArchiveByProjectId(noArchiveContext.projectId),
  null,
  '自动同步只对已存在归档对象的项目生效，不应偷偷创建新的归档对象',
)

console.log('pcs-project-archive-sync.spec.ts PASS')
