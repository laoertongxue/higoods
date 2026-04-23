import assert from 'node:assert/strict'

import { collectProjectArchiveAutoData, deriveProjectArchiveState } from '../src/data/pcs-project-archive-collector.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import { getStyleArchiveById } from '../src/data/pcs-style-archive-repository.ts'
import { appendTechPackVersionLog } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  listTechnicalDataVersionsByStyleId,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'

const project = listProjects().find((item) => {
  const style = item.linkedStyleId ? getStyleArchiveById(item.linkedStyleId) : null
  return Boolean(style && listTechnicalDataVersionsByStyleId(style.styleId).length > 0)
})
assert.ok(project, '必须存在带款式档案和技术包版本的项目演示数据')

const style = getStyleArchiveById(project.linkedStyleId)
assert.ok(style, '项目必须绑定款式档案')

const version = listTechnicalDataVersionsByStyleId(style.styleId)[0]
assert.ok(version, '款式必须存在技术包版本')

updateTechnicalDataVersionRecord(version.technicalVersionId, {
  versionStatus: 'PUBLISHED',
  publishedAt: '2026-04-23 10:00',
  publishedBy: '测试用户',
})

appendTechPackVersionLog({
  logId: 'log_archive_collect_test',
  technicalVersionId: version.technicalVersionId,
  technicalVersionCode: version.technicalVersionCode,
  versionLabel: version.versionLabel,
  styleId: style.styleId,
  styleCode: style.styleCode,
  logType: '发布技术包版本',
  sourceTaskType: 'PLATE',
  sourceTaskId: 'plate_task_archive_test',
  sourceTaskCode: 'PLATE-ARCHIVE-TEST',
  sourceTaskName: '制版任务归档验证',
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
