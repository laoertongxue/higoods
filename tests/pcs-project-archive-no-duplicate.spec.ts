import assert from 'node:assert/strict'
import {
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchives,
} from '../src/data/pcs-project-archive-repository.ts'
import { createProjectArchive, syncProjectArchive, uploadProjectArchiveManualDocument } from '../src/data/pcs-project-archive-sync.ts'
import {
  createArchiveTestProject,
  createPublishedTechnicalVersionForArchiveProject,
  generateStyleShellForArchiveProject,
  resetArchiveScenarioRepositories,
} from './pcs-project-archive-test-helper.ts'

resetArchiveScenarioRepositories()
const context = createArchiveTestProject('duplicate')
generateStyleShellForArchiveProject(context.projectId)

const first = createProjectArchive(context.projectId, '测试用户')
assert.equal(first.ok, true, '首次创建应成功')
assert.equal(first.existed, false, '首次创建不应返回已存在')

const second = createProjectArchive(context.projectId, '测试用户')
assert.equal(second.ok, true, '重复创建时应返回已有归档对象')
assert.equal(second.existed, true, '重复创建时不应再次创建第二个归档对象')
assert.equal(
  listProjectArchives().filter((item) => item.projectId === context.projectId).length,
  1,
  '同一项目只允许存在一个当前正式项目资料归档对象',
)

createPublishedTechnicalVersionForArchiveProject(context.projectId)
const archive = getProjectArchiveByProjectId(context.projectId)!
const beforeSyncCount = listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId).filter(
  (item) => item.documentGroup === 'TECHNICAL_DATA',
).length
syncProjectArchive(archive.projectArchiveId, '测试用户')
const afterSyncCount = listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId).filter(
  (item) => item.documentGroup === 'TECHNICAL_DATA',
).length
assert.equal(afterSyncCount, beforeSyncCount, '同一项目重复同步时，技术资料版本归档记录不应重复')

const afterFirstManualUpload = uploadProjectArchiveManualDocument(
  archive.projectArchiveId,
  {
    documentGroup: 'OTHER_FILE',
    title: '补充说明',
    note: '重复测试',
    files: [{ fileName: '补充说明.txt', fileType: 'TXT', previewUrl: 'memory://other-1' }],
  },
  '测试用户',
)
const afterSecondManualUpload = uploadProjectArchiveManualDocument(
  archive.projectArchiveId,
  {
    documentGroup: 'OTHER_FILE',
    title: '补充说明',
    note: '重复测试',
    files: [{ fileName: '补充说明.txt', fileType: 'TXT', previewUrl: 'memory://other-1' }],
  },
  '测试用户',
)
assert.equal(
  afterSecondManualUpload.manualUploadedCount,
  afterFirstManualUpload.manualUploadedCount,
  '相同归档对象下重复上传同标题同文件集合的手工资料，不应重复生成正式资料记录',
)

console.log('pcs-project-archive-no-duplicate.spec.ts PASS')
