import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
import { renderTechPackPage } from '../src/pages/tech-pack.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function preparePublishedVersion() {
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

const contextSource = read('src/pages/tech-pack/context.ts')
assert.ok(!contextSource.includes('getOrCreateTechPack'), '技术资料页面上下文不应再依赖 getOrCreateTechPack 作为正式主来源')
assert.ok(!contextSource.includes('updateTechPack('), '技术资料页面上下文不应再直接更新旧 FCS 技术包对象')

const pageSource = read('src/pages/tech-pack/core.ts')
assert.ok(pageSource.includes('技术资料版本 -'), '技术资料页面主标题应统一为技术资料版本')

const { style, version } = preparePublishedVersion()
const html = renderTechPackPage(style.styleCode, {
  styleId: style.styleId,
  technicalVersionId: version.technicalVersionId,
})
assert.ok(html.includes(`技术资料版本 - ${version.technicalVersionCode}`), '正式技术资料页面应展示正式版本编号')
assert.ok(html.includes('质检标准'), '正式技术资料页面应包含质检标准页签')
assert.ok(!html.includes('技术包 -'), '正式技术资料页面不应继续使用技术包主标题')

console.log('pcs-tech-pack-page-real-source.spec.ts PASS')
