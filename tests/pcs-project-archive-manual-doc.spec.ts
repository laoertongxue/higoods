import assert from 'node:assert/strict'
import {
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchiveFilesByArchiveId,
  listProjectArchiveMissingItemsByArchiveId,
} from '../src/data/pcs-project-archive-repository.ts'
import { uploadProjectArchiveManualDocument } from '../src/data/pcs-project-archive-sync.ts'
import {
  createArchiveTestProject,
  createProjectArchiveForTest,
  generateStyleShellForArchiveProject,
  resetArchiveScenarioRepositories,
} from './pcs-project-archive-test-helper.ts'

resetArchiveScenarioRepositories()
const context = createArchiveTestProject('manual')
generateStyleShellForArchiveProject(context.projectId)
const archive = createProjectArchiveForTest(context.projectId)

const beforeMissing = listProjectArchiveMissingItemsByArchiveId(archive.projectArchiveId)
assert.ok(beforeMissing.some((item) => item.itemCode === 'INSPECTION_FILE'), '创建后初始缺失项应包含检测资料')
assert.ok(beforeMissing.some((item) => item.itemCode === 'QUOTATION_FILE'), '创建后初始缺失项应包含报价资料')

const afterInspection = uploadProjectArchiveManualDocument(
  archive.projectArchiveId,
  {
    documentGroup: 'INSPECTION_FILE',
    title: '检测报告',
    note: '送检结果',
    files: [
      { fileName: '检测报告.pdf', fileType: 'PDF', previewUrl: 'memory://inspection' },
      { fileName: '成分说明.png', fileType: 'PNG', previewUrl: 'memory://inspection-2' },
    ],
  },
  '测试用户',
)
assert.ok(afterInspection.missingItemCount < beforeMissing.length, '上传检测资料后缺失项数量应减少')
let missingItems = listProjectArchiveMissingItemsByArchiveId(archive.projectArchiveId)
assert.ok(!missingItems.some((item) => item.itemCode === 'INSPECTION_FILE'), '上传检测资料后应移除检测资料缺失项')
assert.ok(missingItems.some((item) => item.itemCode === 'QUOTATION_FILE'), '仅上传检测资料时，报价资料缺失项仍应保留')

const manualDocuments = listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId).filter((item) => item.manualFlag)
assert.ok(
  manualDocuments.some((item) => item.documentGroup === 'INSPECTION_FILE' && item.documentTitle === '检测报告'),
  '上传检测资料后应生成正式手工资料记录',
)
const manualFiles = listProjectArchiveFilesByArchiveId(archive.projectArchiveId).filter((item) =>
  manualDocuments.some((doc) => doc.archiveDocumentId === item.archiveDocumentId),
)
assert.ok(manualFiles.some((item) => item.fileName === '检测报告.pdf'), '上传检测资料后应生成正式手工文件记录')

const afterQuotation = uploadProjectArchiveManualDocument(
  archive.projectArchiveId,
  {
    documentGroup: 'QUOTATION_FILE',
    title: '报价单',
    note: '对外报价版本',
    files: [{ fileName: '报价单.xlsx', fileType: 'XLSX', previewUrl: 'memory://quotation' }],
  },
  '测试用户',
)
missingItems = listProjectArchiveMissingItemsByArchiveId(archive.projectArchiveId)
assert.ok(!missingItems.some((item) => item.itemCode === 'QUOTATION_FILE'), '上传报价资料后应移除报价资料缺失项')
assert.equal(
  afterQuotation.manualUploadedCount >= 2,
  true,
  '上传两类手工资料后，归档对象手工资料数量应累加',
)

console.log('pcs-project-archive-manual-doc.spec.ts PASS')
