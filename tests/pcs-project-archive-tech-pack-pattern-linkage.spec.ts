import assert from 'node:assert/strict'

import { createPatternAsset } from '../src/data/pcs-pattern-library.ts'
import type { PatternParsedFileResult } from '../src/data/pcs-pattern-library-types.ts'
import { collectProjectArchiveAutoData, deriveProjectArchiveState } from '../src/data/pcs-project-archive-collector.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import { getStyleArchiveById } from '../src/data/pcs-style-archive-repository.ts'
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

const parsedFile: PatternParsedFileResult = {
  originalFilename: 'archive-pattern.png',
  fileExt: 'png',
  mimeType: 'image/png',
  fileSize: 1024,
  imageWidth: 100,
  imageHeight: 100,
  aspectRatio: 1,
  colorMode: 'RGB',
  dpiX: 300,
  dpiY: 300,
  frameCount: 1,
  hasAlpha: false,
  filenameTokens: [{ token: 'archive-pattern', normalized: 'archive-pattern', category: 'word', score: 0.8 }],
  previewUrl: 'mock://pattern-library/archive-preview.png',
  thumbnailUrl: 'mock://pattern-library/archive-thumb.png',
  parseStatus: 'success',
  parseSummary: '解析完成',
  dominantColors: ['综合色'],
  parseWarnings: [],
  parseResultJson: {},
}

const asset = createPatternAsset({
  patternName: '归档花型资产',
  aliases: ['ARCHIVE-PATTERN'],
  usageType: '数码印',
  category: '几何',
  categoryPrimary: '几何',
  categorySecondary: '线条',
  styleTags: ['通勤'],
  colorTags: ['综合色'],
  hotFlag: false,
  sourceType: '自研',
  sourceNote: '归档验证',
  applicableCategories: ['衬衫'],
  applicableParts: ['前片'],
  relatedPartTemplateIds: [],
  processDirection: '归档验证使用',
  maintenanceStatus: '已维护',
  license: {
    license_status: 'authorized',
    attachment_urls: [],
    copyright_owner: 'HiGood',
    license_scope: '内部研发使用',
  },
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile,
  sourceTaskId: 'pattern_task_archive_linkage_test',
  sourceTaskCode: 'PTN-ARCHIVE-LINKAGE',
  sourceTaskType: 'PATTERN_ARTWORK_TASK',
  sourceTaskName: '花型任务归档串联验证',
  sourceProjectId: project.projectId,
  sourceTechPackVersionId: version.technicalVersionId,
  sourceTechPackVersionCode: version.technicalVersionCode,
})

updateTechnicalDataVersionRecord(version.technicalVersionId, {
  versionStatus: 'PUBLISHED',
  linkedPatternAssetIds: [asset.id],
  linkedPatternAssetCodes: [asset.pattern_code],
})

const archive: ProjectArchiveRecord = {
  projectArchiveId: 'archive_pattern_linkage_test',
  archiveNo: 'ARCH-PATTERN-LINKAGE-TEST',
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
const patternDocument = collected.documents.find(
  (item) => item.documentGroup === 'ARTWORK_ASSET' && item.sourceObjectId === asset.id,
)

assert.ok(patternDocument, '项目资料归档必须采集技术包引用的花型库资产')
assert.ok(collected.files.some((item) => item.archiveDocumentId === patternDocument?.archiveDocumentId), '花型库当前文件版本必须进入归档文件')

const state = deriveProjectArchiveState({
  archive,
  documents: collected.documents,
  files: collected.files,
  missingItems: [],
  currentTechnicalVersion: collected.currentTechnicalVersion,
})

assert.deepEqual(state.currentPatternAssetIds, [asset.id])
assert.deepEqual(state.currentPatternAssetCodes, [asset.pattern_code])
assert.equal(state.currentPatternAssetCount, 1)

console.log('pcs-project-archive-tech-pack-pattern-linkage.spec.ts PASS')
