import assert from 'node:assert/strict'

import { collectProjectArchiveAutoData } from '../src/data/pcs-project-archive-collector.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'
import type { ProjectArchiveRecord } from '../src/data/pcs-project-archive-types.ts'

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-010') || listProjects()[0]
assert.ok(project, '必须存在商品项目演示数据')

const archive: ProjectArchiveRecord = {
  projectArchiveId: 'archive_sample_chain_test',
  archiveNo: 'ARCH-SAMPLE-CHAIN-TEST',
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
  closureSnapshotAt: '2026-04-23 10:00:00',
  closureSnapshotBy: '测试用户',
  archiveStatus: 'COLLECTING',
  documentCount: 0,
  fileCount: 0,
  autoCollectedCount: 0,
  manualUploadedCount: 0,
  missingItemCount: 0,
  readyForFinalize: false,
  createdAt: '2026-04-23 10:00:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-23 10:00:00',
  updatedBy: '测试用户',
  finalizedAt: '',
  finalizedBy: '',
  note: '',
}

const result = collectProjectArchiveAutoData(archive, project, null)
const titles = result.documents.map((document) => document.documentTitle).join(' / ')

assert.match(titles, /首版样衣|产前版样衣|样衣/)
assert.ok(result.documents.some((document) => document.sourceModule === '首版样衣打样' || document.sourceModule === '产前版样衣'))

console.log('pcs-sample-chain-archive-linkage.spec.ts PASS')
