import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { createTechnicalDataVersionFromStyle, publishTechnicalDataVersion, saveTechnicalDataVersionContent } from '../src/data/pcs-project-technical-data-writeback.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { getStyleArchiveById, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  getEffectiveTechnicalDataVersionByStyleId,
  getTechnicalDataVersionById,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { handleProductStyleDetailEvent, renderProductStyleDetailPage } from '../src/pages/pcs-product-style-detail.ts'
import { handlePcsProjectDetailEvent, renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'

function prepareStyleShell() {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()

  const project = listProjects().find(
    (item) =>
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE') &&
      getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP'),
  )
  assert.ok(project, '应存在既可生成款式档案又可建立技术资料版本的商品项目')

  updateProjectRecord(
    project!.projectId,
    {
      projectStatus: '进行中',
      currentPhaseCode: 'PHASE_04',
      currentPhaseName: '开发推进',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
      linkedTechnicalVersionId: '',
      linkedTechnicalVersionCode: '',
      linkedTechnicalVersionLabel: '',
      linkedTechnicalVersionStatus: '',
      linkedTechnicalVersionPublishedAt: '',
    },
    '测试用户',
  )

  const styleNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'STYLE_ARCHIVE_CREATE')
  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
  assert.ok(styleNode && transferNode, '项目节点应完整')
  updateProjectNodeRecord(project!.projectId, styleNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')
  updateProjectNodeRecord(project!.projectId, transferNode!.projectNodeId, { currentStatus: '未开始' }, '测试用户')

  const styleResult = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
  assert.ok(styleResult.ok && styleResult.style, '应先生成正式款式档案壳')
  return {
    projectId: project!.projectId,
    transferNodeId: transferNode!.projectNodeId,
    styleId: styleResult.style!.styleId,
  }
}

const prepared = prepareStyleShell()

const version1 = createTechnicalDataVersionFromStyle(prepared.styleId, '测试用户')
assert.ok(version1.record.missingItemCodes.includes('QUALITY'), '质检标准为空时缺失项必须包含 QUALITY')
assert.throws(
  () => publishTechnicalDataVersion(version1.record.technicalVersionId, '测试用户'),
  /核心域未补全/,
  '核心 6 个域未补全时不应允许发布',
)

saveTechnicalDataVersionContent(
  version1.record.technicalVersionId,
  {
    patternFiles: [
      {
        id: 'pattern-1',
        fileName: '主纸样.dxf',
        fileUrl: 'local://pattern-1',
        uploadedAt: '2026-04-10 10:00',
        uploadedBy: '测试用户',
      },
    ],
    processEntries: [
      {
        id: 'process-1',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '前准备',
        processCode: 'P001',
        processName: '车缝',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 12,
        timeUnit: '分钟/件',
      },
    ],
    sizeTable: [
      {
        id: 'grading-1',
        part: '胸围',
        S: 48,
        M: 50,
        L: 52,
        XL: 54,
        tolerance: 1,
      },
    ],
    bomItems: [
      {
        id: 'bom-1',
        type: '面料',
        name: '主面料',
        spec: '95% 棉',
        unitConsumption: 1.2,
        lossRate: 0.03,
        supplier: '供应商甲',
      },
    ],
    qualityRules: [
      {
        id: 'quality-1',
        checkItem: '领口平整度',
        standardText: '无明显起皱与变形',
        samplingRule: '全检',
        note: '',
      },
    ],
    colorMaterialMappings: [
      {
        id: 'mapping-1',
        spuCode: 'SPU-TEST',
        colorCode: 'BK',
        colorName: '黑色',
        status: 'CONFIRMED',
        generatedMode: 'MANUAL',
        lines: [
          {
            id: 'mapping-line-1',
            materialName: '主面料',
            materialType: '面料',
            unit: '米',
            sourceMode: 'MANUAL',
          },
        ],
      },
    ],
  },
  '测试用户',
)

const published1 = publishTechnicalDataVersion(version1.record.technicalVersionId, '测试用户')
assert.equal(published1.versionStatus, 'PUBLISHED', '补全核心 6 个域后应允许发布')
assert.equal(getEffectiveTechnicalDataVersionByStyleId(prepared.styleId)?.technicalVersionId, version1.record.technicalVersionId, '第一版发布后应成为当前生效版本')

const version2 = createTechnicalDataVersionFromStyle(prepared.styleId, '测试用户', {
  copyFromVersionId: version1.record.technicalVersionId,
})
assert.equal(getEffectiveTechnicalDataVersionByStyleId(prepared.styleId)?.technicalVersionId, version1.record.technicalVersionId, '已有当前生效版本时，新建草稿版本不应覆盖旧生效版本')

const published2 = publishTechnicalDataVersion(version2.record.technicalVersionId, '测试用户')
assert.equal(getTechnicalDataVersionById(version1.record.technicalVersionId)?.effectiveFlag, false, '发布新版本后旧生效版本应自动失效')
assert.equal(getTechnicalDataVersionById(version2.record.technicalVersionId)?.effectiveFlag, true, '发布新版本后新版本应成为当前生效版本')

const style = getStyleArchiveById(prepared.styleId)
assert.equal(style!.effectiveTechnicalVersionId, version2.record.technicalVersionId, '款式档案应回写当前生效技术资料版本主键')
assert.equal(style!.effectiveTechnicalVersionCode, published2.technicalVersionCode, '款式档案应回写当前生效技术资料版本编号')
assert.equal(style!.technicalDataStatus, '已发布', '发布后款式档案技术资料状态应为已发布')

const project = getProjectById(prepared.projectId)
assert.equal(project!.linkedTechnicalVersionId, version2.record.technicalVersionId, '商品项目主记录应回写最近一次正式关联版本')
assert.equal(project!.linkedTechnicalVersionStatus, 'PUBLISHED', '发布后商品项目主记录应显示已发布状态')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(prepared.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestResultType, '技术资料版本已发布', '发布后项目转档准备节点应回写正式发布结果')
assert.equal(transferNode!.pendingActionType, '补全规格与成本资料', '发布后项目转档准备节点应回写下一步提示')

renderProductStyleDetailPage(prepared.styleId)
const technicalButton = {
  closest: () => ({
    dataset: { styleDetailAction: 'set-tab', tabKey: 'technical' },
  }),
} as unknown as Element
handleProductStyleDetailEvent(technicalButton)
const styleHtml = renderProductStyleDetailPage(prepared.styleId)
assert.ok(styleHtml.includes(published2.technicalVersionCode), '款式档案详情页应展示当前生效技术资料版本')

renderPcsProjectDetailPage(prepared.projectId)
handlePcsProjectDetailEvent({
  closest: () => ({
    dataset: { pcsProjectDetailAction: 'select-work-item', workItemId: prepared.transferNodeId },
  }),
} as unknown as HTMLElement)
const projectHtml = renderPcsProjectDetailPage(prepared.projectId)
assert.ok(projectHtml.includes(published2.technicalVersionCode), '项目详情页应展示同一条当前生效技术资料版本')

const nodeHtml = renderPcsProjectWorkItemDetailPage(prepared.projectId, prepared.transferNodeId)
assert.ok(nodeHtml.includes(published2.technicalVersionCode), '项目节点详情页应展示同一条当前生效技术资料版本')

console.log('pcs-technical-version-publish-writeback.spec.ts PASS')
