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
import { techPacks } from '../src/data/fcs/tech-packs.ts'
import { renderTechPackPage } from '../src/pages/tech-pack.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function prepareDraftVersionOnly() {
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
  return { style: styleResult.style!, version: created.record }
}

function preparePublishedVersion() {
  const draft = prepareDraftVersionOnly()
  saveTechnicalDataVersionContent(draft.version.technicalVersionId, {
    patternFiles: [{ id: 'pattern-1', fileName: '主纸样.dxf', fileUrl: 'local://pattern', uploadedAt: '2026-04-10 10:00', uploadedBy: '测试用户' }],
    processEntries: [{ id: 'process-1', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '前准备', processCode: 'P001', processName: '车缝', assignmentGranularity: 'ORDER', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false }],
    sizeTable: [{ id: 'grading-1', part: '胸围', S: 48, M: 50, L: 52, XL: 54, tolerance: 1 }],
    bomItems: [{ id: 'bom-1', type: '面料', name: '主面料', spec: '95% 棉', unitConsumption: 1.2, lossRate: 0.03, supplier: '供应商甲' }],
    qualityRules: [{ id: 'quality-1', checkItem: '领口平整度', standardText: '无明显起皱', samplingRule: '全检', note: '' }],
    colorMaterialMappings: [{ id: 'mapping-1', spuCode: draft.style.styleCode, colorCode: 'BK', colorName: '黑色', status: 'CONFIRMED', generatedMode: 'MANUAL', lines: [{ id: 'line-1', materialName: '主面料', materialType: '面料', unit: '米', sourceMode: 'MANUAL' }] }],
  }, '测试用户')
  const published = publishTechnicalDataVersion(draft.version.technicalVersionId, '测试用户')
  return { style: draft.style, version: published }
}

const routeSource = read('src/router/routes.ts')
assert.ok(routeSource.includes('fcs\\/tech-pack'), '应保留 FCS 技术资料兼容入口路由')
assert.ok(routeSource.includes('compatibilityMode: true'), 'FCS 技术资料兼容入口应切到兼容模式')

const draftOnly = prepareDraftVersionOnly()
const draftHtml = renderTechPackPage(draftOnly.style.styleCode, { compatibilityMode: true })
assert.ok(
  draftHtml.includes('已存在正式款式档案，但还没有当前生效技术资料版本，请在商品中心补建。'),
  '兼容入口在已有款式档案但未发布正式版本时应提示去商品中心补建',
)
assert.ok(!draftHtml.includes('data-tech-action="open-release"'), '兼容入口不应提供发布动作')

const published = preparePublishedVersion()
const compatHtml = renderTechPackPage(published.style.styleCode, { compatibilityMode: true })
assert.ok(compatHtml.includes('当前为兼容查看入口，请在商品中心维护技术资料版本'), '兼容入口在找到正式版本时应显示兼容提示')
assert.ok(compatHtml.includes(published.version.technicalVersionCode), '兼容入口应回读 PCS 正式技术资料版本编号')
assert.ok(!compatHtml.includes('data-tech-action="open-release"'), '兼容入口在正式版本场景也必须保持只读')

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
const legacySnapshot = techPacks[0]
assert.ok(legacySnapshot, '应存在历史 FCS 技术资料快照样例')
const legacyHtml = renderTechPackPage(legacySnapshot!.spuCode, { compatibilityMode: true })
assert.ok(legacyHtml.includes('当前为历史兼容快照，请尽快在商品中心建立正式技术资料版本'), '兼容入口在只有历史快照时应展示历史兼容提示')
assert.ok(legacyHtml.includes('纸样管理'), '兼容入口应能查看历史纸样内容')
assert.ok(legacyHtml.includes('物料清单'), '兼容入口应能查看历史物料内容')

const unknownHtml = renderTechPackPage('UNKNOWN-SPU-CODE', { compatibilityMode: true })
assert.ok(unknownHtml.includes('当前无可用技术资料。'), '未知 SPU 的兼容入口应显示明确空状态')
assert.ok(!unknownHtml.includes('技术包 -'), '兼容入口找不到正式版本时不应回退旧演示对象')

console.log('fcs-tech-pack-compat-entry.spec.ts PASS')
