import assert from 'node:assert/strict'

import { collectProjectArchiveAutoData } from '../src/data/pcs-project-archive-collector.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { savePatternTaskDraft } from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetPatternTaskRepository()

const project = listProjects()[0]
assert.ok(project, '必须存在商品项目演示数据')

const task = savePatternTaskDraft({
  projectId: project.projectId,
  title: '花型任务归档图片采集',
  sourceType: '项目模板阶段',
  productStyleCode: 'SPU-PATTERN-ARCHIVE',
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: 1,
  fabricName: '印花面料',
  demandImageIds: ['mock://pattern-demand/archive-demand.png'],
  liveReferenceImageIds: ['mock://pattern-live/archive-live.png'],
  imageReferenceIds: ['mock://pattern-reference/archive-reference.png'],
  completionImageIds: ['mock://pattern-complete/archive-complete.png'],
  patternFileIds: ['mock-file://pattern-artwork/archive-source.ai'],
  buyerReviewStatus: '买手已通过',
  artworkVersion: 'A1',
  assignedTeamCode: 'CN_TEAM',
  assignedMemberId: 'cn_guanhao',
})

const archive: ProjectArchiveRecord = {
  projectArchiveId: 'archive_pattern_task_files_test',
  archiveNo: 'ARCH-PATTERN-TASK-FILES-TEST',
  projectId: project.projectId,
  projectCode: project.projectCode,
  projectName: project.projectName,
  styleId: '',
  styleCode: '',
  styleName: '',
  currentTechnicalVersionId: '',
  currentTechnicalVersionCode: '',
  currentTechnicalVersionLabel: '',
  currentPatternAssetIds: [],
  currentPatternAssetCodes: [],
  currentPatternAssetCount: 0,
  currentTechPackLogCount: 0,
  closureSnapshotAt: '2026-04-24 10:00',
  closureSnapshotBy: '测试用户',
  archiveStatus: 'COLLECTING',
  documentCount: 0,
  fileCount: 0,
  autoCollectedCount: 0,
  manualUploadedCount: 0,
  missingItemCount: 0,
  readyForFinalize: false,
  createdAt: '2026-04-24 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-24 10:00',
  updatedBy: '测试用户',
  finalizedAt: '',
  finalizedBy: '',
  note: '',
}

const collected = collectProjectArchiveAutoData(archive, project, null)
const document = collected.documents.find(
  (item) => item.documentGroup === 'PATTERN_TASK_RECORD' && item.sourceObjectId === task.patternTaskId,
)

assert.ok(document, '项目资料归档必须采集花型任务记录')
assert.equal(document?.fileCount, 5, '花型任务记录应采集完成图、花型文件、需求图和参考图')
assert.equal(document?.previewUrl, 'mock://pattern-complete/archive-complete.png', '花型任务完成确认图片应作为归档预览')
assert.equal(document?.primaryFileName, 'archive-complete.png', '花型任务完成确认图片应作为主文件')

const files = collected.files.filter((item) => item.archiveDocumentId === document?.archiveDocumentId)
assert.deepEqual(files.map((item) => item.fileType), ['完成确认图片', '花型文件', '需求图片', '直播参考图', '图片参考图'])
assert.deepEqual(files.map((item) => item.isPrimary), [true, false, false, false, false])

console.log('pcs-project-archive-pattern-task-files.spec.ts PASS')
