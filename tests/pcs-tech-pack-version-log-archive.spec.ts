import assert from 'node:assert/strict'

import { collectProjectArchiveAutoData, deriveProjectArchiveState } from '../src/data/pcs-project-archive-collector.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import { getStyleArchiveById, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import { appendTechPackVersionLog } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  createTechnicalDataVersionDraft,
  listTechnicalDataVersions,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { assertFirstFormalProduction } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'

resetEngineeringMasterRepository()
const project = listProjects().find((item) => {
  const style = item.linkedStyleId ? getStyleArchiveById(item.linkedStyleId) : null
  if (!style) return false
  try {
    assertFirstFormalProduction(style.styleCode)
    return true
  } catch {
    return false
  }
})
assert.ok(project, '必须存在可用于工程技术包版本日志归档的商品项目')

const style = getStyleArchiveById(project.linkedStyleId)
assert.ok(style, '项目必须绑定款式档案')

const engineeringMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '测试跟单',
}).masterOrderId)
const techPackConfirmationTask = engineeringMaster.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
assert.ok(techPackConfirmationTask, '工程主单必须包含技术包确认任务')
const baseRecord = listTechnicalDataVersions()[0]
assert.ok(baseRecord, '技术资料仓必须提供版本结构演示数据')
const version = createTechnicalDataVersionDraft({
  ...baseRecord,
  technicalVersionId: 'tdv_log_archive_engineering_source',
  technicalVersionCode: 'TP-LOG-ARCHIVE-ENGINEERING',
  versionNo: 1,
  versionLabel: 'V1',
  versionStatus: 'DRAFT',
  styleId: style.styleId,
  styleCode: style.styleCode,
  styleName: style.styleName,
  sourceProjectId: engineeringMaster.masterOrderId,
  sourceProjectCode: engineeringMaster.masterOrderCode,
  sourceProjectName: engineeringMaster.styleName,
  sourceProjectNodeId: '',
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: techPackConfirmationTask.taskId,
  createdFromTaskCode: techPackConfirmationTask.taskId,
  publishedAt: '',
  publishedBy: '',
})

updateTechnicalDataVersionRecord(version.technicalVersionId, {
  versionStatus: 'PUBLISHED',
  publishedAt: '2026-04-23 10:00',
  publishedBy: '测试用户',
})
updateStyleArchive(style.styleId, {
  currentTechPackVersionId: version.technicalVersionId,
  currentTechPackVersionCode: version.technicalVersionCode,
  currentTechPackVersionLabel: version.versionLabel,
  currentTechPackVersionStatus: 'PUBLISHED',
})

appendTechPackVersionLog({
  logId: 'log_archive_collect_test',
  technicalVersionId: version.technicalVersionId,
  technicalVersionCode: version.technicalVersionCode,
  versionLabel: version.versionLabel,
  styleId: style.styleId,
  styleCode: style.styleCode,
  logType: '发布技术包版本',
  sourceTaskType: 'ENGINEERING_MASTER',
  sourceTaskId: techPackConfirmationTask.taskId,
  sourceTaskCode: techPackConfirmationTask.taskId,
  sourceTaskName: techPackConfirmationTask.taskName,
  changeScope: '制版生成',
  changeText: '验证技术包版本日志进入项目资料归档。',
  beforeVersionId: '',
  beforeVersionCode: '',
  afterVersionId: version.technicalVersionId,
  afterVersionCode: version.technicalVersionCode,
  createdAt: '2026-04-23 10:05',
  createdBy: '测试用户',
})

const archive: ProjectArchiveRecord = {
  projectArchiveId: 'archive_tech_pack_log_test',
  archiveNo: 'ARCH-TECH-PACK-LOG-TEST',
  projectId: project.projectId,
  projectCode: project.projectCode,
  projectName: project.projectName,
  styleId: style.styleId,
  styleCode: style.styleCode,
  styleName: style.styleName,
  currentTechnicalVersionId: '',
  currentTechnicalVersionCode: '',
  currentTechnicalVersionLabel: '',
  currentPatternAssetIds: [],
  currentPatternAssetCodes: [],
  currentPatternAssetCount: 0,
  currentTechPackLogCount: 0,
  closureSnapshotAt: '2026-04-23 10:00',
  closureSnapshotBy: '测试用户',
  archiveStatus: 'COLLECTING',
  documentCount: 0,
  fileCount: 0,
  autoCollectedCount: 0,
  manualUploadedCount: 0,
  missingItemCount: 0,
  readyForFinalize: false,
  createdAt: '2026-04-23 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-23 10:00',
  updatedBy: '测试用户',
  finalizedAt: '',
  finalizedBy: '',
  note: '',
}

const collected = collectProjectArchiveAutoData(archive, project, style)
const logDocuments = collected.documents.filter((item) => item.documentGroup === 'TECH_PACK_LOG')

assert.ok(logDocuments.some((item) => item.sourceObjectId === 'log_archive_collect_test'), '技术包版本日志必须进入归档文档组')

const state = deriveProjectArchiveState({
  archive,
  documents: collected.documents,
  files: collected.files,
  missingItems: [],
  currentTechnicalVersion: collected.currentTechnicalVersion,
})

assert.ok(state.currentTechPackLogCount >= 1, '归档状态必须统计技术包版本日志数量')

console.log('pcs-tech-pack-version-log-archive.spec.ts PASS')
