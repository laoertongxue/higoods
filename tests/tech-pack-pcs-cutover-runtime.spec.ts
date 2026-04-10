import assert from 'node:assert/strict'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { createTechnicalDataVersionFromStyle, publishTechnicalDataVersion, saveTechnicalDataVersionContent } from '../src/data/pcs-project-technical-data-writeback.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { techPacks } from '../src/data/fcs/tech-packs.ts'
import { resolveTechnicalDataEntryBySpuCode } from '../src/data/pcs-technical-data-entry-resolver.ts'
import { resolveTechnicalSnapshotBySpuCode } from '../src/data/pcs-technical-data-runtime-source.ts'

function prepareStyleWithDraftOrPublished(publish = false) {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()

  const project = listProjects().find(
    (item) =>
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE') &&
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP'),
  )
  assert.ok(project, '应存在可用于建立技术资料版本的商品项目')

  updateProjectRecord(project!.projectId, {
    projectStatus: '进行中',
    currentPhaseCode: 'PHASE_04',
    currentPhaseName: '开发推进',
    linkedStyleId: '',
    linkedStyleCode: '',
    linkedStyleName: '',
    linkedStyleGeneratedAt: '',
  }, '测试用户')

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
  updateProjectNodeRecord(project!.projectId, styleNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')
  updateProjectNodeRecord(project!.projectId, transferNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

  const styleResult = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
  assert.ok(styleResult.ok && styleResult.style, '应先生成正式款式档案壳')
  const created = createTechnicalDataVersionFromStyle(styleResult.style!.styleId, '测试用户')

  if (!publish) {
    return { style: styleResult.style!, version: created.record }
  }

  saveTechnicalDataVersionContent(created.record.technicalVersionId, {
    patternFiles: [{ id: 'pattern-1', fileName: '主纸样.dxf', fileUrl: 'local://pattern', uploadedAt: '2026-04-10 10:00', uploadedBy: '测试用户' }],
    processEntries: [{ id: 'process-1', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '前准备', processCode: 'P001', processName: '车缝', assignmentGranularity: 'ORDER', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false }],
    sizeTable: [{ id: 'grading-1', part: '胸围', S: 48, M: 50, L: 52, XL: 54, tolerance: 1 }],
    bomItems: [{ id: 'bom-1', type: '面料', name: '主面料', spec: '95% 棉', unitConsumption: 1.2, lossRate: 0.03, supplier: '供应商甲' }],
    qualityRules: [{ id: 'quality-1', checkItem: '领口平整度', standardText: '无明显起皱', samplingRule: '全检', note: '' }],
    colorMaterialMappings: [{ id: 'mapping-1', spuCode: styleResult.style!.styleCode, colorCode: 'BK', colorName: '黑色', status: 'CONFIRMED', generatedMode: 'MANUAL', lines: [{ id: 'line-1', materialName: '主面料', materialType: '面料', unit: '米', sourceMode: 'MANUAL' }] }],
  }, '测试用户')
  const published = publishTechnicalDataVersion(created.record.technicalVersionId, '测试用户')
  return { style: styleResult.style!, version: published }
}

const published = prepareStyleWithDraftOrPublished(true)
const publishedResolution = resolveTechnicalSnapshotBySpuCode(published.style.styleCode)
assert.equal(publishedResolution.sourceKind, 'pcs_published', '运行时适配层应优先返回 PCS 当前生效版本')
assert.equal(publishedResolution.technicalVersionId, published.version.technicalVersionId, '运行时适配层应返回正式当前生效版本主键')

const publishedEntry = resolveTechnicalDataEntryBySpuCode(published.style.styleCode)
assert.equal(publishedEntry.kind, 'pcs_version', '存在正式当前生效版本时应直达 PCS 正式版本页')
assert.ok(
  publishedEntry.targetPath.includes(`/pcs/products/styles/${encodeURIComponent(published.style.styleId)}/technical-data/${encodeURIComponent(published.version.technicalVersionId)}`),
  '正式当前生效版本应跳到 PCS 技术资料版本详情',
)

const draftOnly = prepareStyleWithDraftOrPublished(false)
const styleEntry = resolveTechnicalDataEntryBySpuCode(draftOnly.style.styleCode)
assert.equal(styleEntry.kind, 'pcs_style', '存在正式款式档案但没有当前生效版本时应进入 PCS 款式档案页')
assert.ok(styleEntry.targetPath.includes(`/pcs/products/styles/${encodeURIComponent(draftOnly.style.styleId)}`), '应跳到 PCS 款式档案页')

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()

const legacySnapshot = techPacks[0]
assert.ok(legacySnapshot, '应存在历史 FCS 技术资料快照')
const legacyResolution = resolveTechnicalSnapshotBySpuCode(legacySnapshot!.spuCode)
assert.equal(legacyResolution.sourceKind, 'fcs_legacy', '没有正式版本时应回退历史 FCS 技术资料快照')

const unknownResolution = resolveTechnicalSnapshotBySpuCode('UNKNOWN-SPU-CODE')
assert.equal(unknownResolution.sourceKind, 'missing', '两边都不存在时应返回缺失状态')

console.log('tech-pack-pcs-cutover-runtime.spec.ts PASS')
