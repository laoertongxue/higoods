import assert from 'node:assert/strict'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  },
  configurable: true,
})

const {
  approveTechPackReview,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const { publishTechnicalDataVersion } = await import('../src/data/pcs-project-technical-data-writeback.ts')
const {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { renderTechPackPage } = await import('../src/pages/tech-pack.ts')

const technicalVersionId = 'tdv_review_page_001'
const styleId = 'STYLE-REVIEW-PAGE'
const styleCode = 'STYLE-REVIEW-PAGE'

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-REVIEW-PAGE-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: '审核页面验证款',
  sourceProjectId: 'PRJ-REVIEW-PAGE',
  sourceProjectCode: 'PRJ-REVIEW-PAGE',
  sourceProjectName: '审核页面验证项目',
  sourceProjectNodeId: '',
  primaryPlateTaskId: '',
  primaryPlateTaskCode: '',
  primaryPlateTaskVersion: '',
  linkedRevisionTaskIds: [],
  linkedPatternTaskIds: [],
  linkedArtworkTaskIds: [],
  createdFromTaskType: 'MANUAL',
  createdFromTaskId: '',
  createdFromTaskCode: '',
  baseTechnicalVersionId: '',
  baseTechnicalVersionCode: '',
  changeScope: '手动新增',
  changeSummary: '审核页面验证',
  garmentDifficultyGrade: 'B',
  linkedPartTemplateIds: [],
  linkedPatternLibraryVersionIds: [],
  linkedPatternAssetIds: [],
  linkedPatternAssetCodes: [],
  archiveCollectedFlag: false,
  archiveCollectedAt: '',
  versionStatus: 'DRAFT',
  bomStatus: 'DRAFT',
  patternStatus: 'DRAFT',
  processStatus: 'DRAFT',
  gradingStatus: 'DRAFT',
  qualityStatus: 'DRAFT',
  colorMaterialStatus: 'DRAFT',
  designStatus: 'EMPTY',
  attachmentStatus: 'EMPTY',
  bomItemCount: 1,
  patternFileCount: 1,
  processEntryCount: 1,
  gradingRuleCount: 1,
  qualityRuleCount: 1,
  colorMaterialMappingCount: 1,
  designAssetCount: 0,
  attachmentCount: 0,
  completenessScore: 100,
  missingItemCodes: [],
  missingItemNames: [],
  publishedAt: '',
  publishedBy: '',
  createdAt: '2026-05-25 11:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 11:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [
    {
      id: 'pattern-review-page-1',
      recordKind: 'MATERIAL_ASSOCIATION',
      patternName: '后片纸样',
      fileName: 'back.dxf',
      fileUrl: '#',
      uploadedAt: '2026-05-25 11:00',
      uploadedBy: '版师',
    },
  ],
  patternDesc: '',
  processEntries: [
    {
      id: 'process-review-page-1',
      entryType: 'CRAFT',
      stageCode: 'PROD',
      stageName: '生产阶段',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'SEW_BASE',
      craftName: '基础车缝',
      assignmentGranularity: 'ORDER',
      defaultDocType: 'TASK',
      taskTypeMode: 'CRAFT',
      isSpecialCraft: false,
    },
  ],
  sizeTable: [{ id: 'size-review-page-1', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 1 }],
  bomItems: [
    {
      id: 'bom-review-page-1',
      type: '面料',
      name: '主面料',
      spec: '弹力棉',
      unitConsumption: 1.1,
      lossRate: 0.02,
      supplier: '供应商乙',
    },
  ],
  qualityRules: [
    {
      id: 'quality-review-page-1',
      checkItem: '尺寸',
      standardText: '按尺码表公差',
      samplingRule: '抽检',
      note: '',
    },
  ],
  colorMaterialMappings: [
    {
      id: 'mapping-review-page-1',
      spuCode: styleCode,
      colorCode: 'WH',
      colorName: '白色',
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      lines: [],
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-bom-review-page-1', bomItemId: 'bom-review-page-1', price: 18, currency: '人民币', unit: '人民币/件' }],
  },
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})

const initialHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(initialHtml.includes('技术包审核'), '技术包详情应展示审核总览')
assert.ok(initialHtml.includes('买手审核'), '审核总览应展示买手审核')
assert.ok(initialHtml.includes('版师审核'), '审核总览应展示版师审核')
assert.ok(initialHtml.includes('跟单审核'), '审核总览应展示跟单审核')
assert.ok(initialHtml.includes('提交买手、版师并行审核'), '未提交时应提供提交审核入口')
assert.ok(initialHtml.includes('核价'), '技术包页签应展示核价模块')
assert.ok(initialHtml.includes('跟单审核通过后才能发布正式版本'), '未审核通过前发布入口应被门禁阻断')

assert.throws(
  () => publishTechnicalDataVersion(technicalVersionId, '测试用户'),
  /跟单审核通过后才能发布正式版本/,
  '跟单未审核通过前不能发布正式版本',
)

submitTechPackFirstStageReview(technicalVersionId, '维护人')
startTechPackReview(technicalVersionId, 'BUYER', '买手A')
approveTechPackReview(technicalVersionId, 'BUYER', '买手通过', '买手A')
startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师通过', '版师B')

const merchandiserHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(merchandiserHtml.includes('待跟单复核'), '买手和版师都通过后应进入待跟单复核')
assert.ok(merchandiserHtml.includes('剩余部分、整体复核'), '跟单审核应标明审核范围')

assert.throws(
  () => publishTechnicalDataVersion(technicalVersionId, '测试用户'),
  /跟单审核通过后才能发布正式版本/,
  '跟单待审核时仍不能发布',
)

startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
approveTechPackReview(technicalVersionId, 'MERCHANDISER', '整体复核通过', '跟单C')

const readyRecord = getTechnicalDataVersionById(technicalVersionId)
assert.equal(readyRecord?.reviewStage, '待发布', '跟单审核通过后应进入待发布')

const published = publishTechnicalDataVersion(technicalVersionId, '测试用户')
assert.equal(published.versionStatus, 'PUBLISHED', '跟单审核通过后发布应成功')

console.log('check:tech-pack-review-page-and-release passed')
