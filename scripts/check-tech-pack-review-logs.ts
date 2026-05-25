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
Object.defineProperty(globalThis, 'HTMLInputElement', { value: class HTMLInputElement {}, configurable: true })
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: class HTMLSelectElement {}, configurable: true })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: class HTMLTextAreaElement {}, configurable: true })

const {
  approveTechPackReview,
  rejectTechPackReview,
  returnTechPackReviewToFirstStage,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const {
  listTechPackVersionLogsByVersionId,
  resetTechPackVersionLogRepository,
} = await import('../src/data/pcs-tech-pack-version-log-repository.ts')
const { buildTechnicalVersionListByStyle } = await import('../src/data/pcs-technical-data-version-view-model.ts')
const { replaceTechnicalDataVersionStore } = await import('../src/data/pcs-technical-data-version-repository.ts')
const { handleTechPackEvent, renderTechPackPage } = await import('../src/pages/tech-pack.ts')

const technicalVersionId = 'tdv_review_log_001'
const styleId = 'STYLE-REVIEW-LOG'
const styleCode = 'STYLE-REVIEW-LOG'

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-REVIEW-LOG-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: '审核日志验证款',
  sourceProjectId: 'PRJ-REVIEW-LOG',
  sourceProjectCode: 'PRJ-REVIEW-LOG',
  sourceProjectName: '审核日志验证项目',
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
  changeSummary: '审核日志验证',
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
  createdAt: '2026-05-25 14:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 14:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [
    {
      id: 'bom-review-log-1',
      type: '面料',
      name: '主面料',
      spec: '棉',
      unitConsumption: 1,
      lossRate: 0.03,
      supplier: '供应商甲',
    },
  ],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-review-log-1', bomItemId: 'bom-review-log-1', price: 12, currency: '人民币', unit: '人民币/件' }],
  },
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})
resetTechPackVersionLogRepository()

submitTechPackFirstStageReview(technicalVersionId, '维护人')
startTechPackReview(technicalVersionId, 'BUYER', '买手A')
rejectTechPackReview(technicalVersionId, 'BUYER', '价格需复核', '买手A')
submitTechPackFirstStageReview(technicalVersionId, '维护人')
startTechPackReview(technicalVersionId, 'BUYER', '买手A')
approveTechPackReview(technicalVersionId, 'BUYER', '复核通过', '买手A')
startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '纸样通过', '版师B')
startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
returnTechPackReviewToFirstStage(technicalVersionId, '整体复核发现问题', '跟单C')

const logs = listTechPackVersionLogsByVersionId(technicalVersionId)
const logTypes = new Set(logs.map((item) => item.logType))
assert.ok(logTypes.has('提交技术包审核'), '应记录提交技术包审核日志')
assert.ok(logTypes.has('开始技术包审核'), '应记录开始技术包审核日志')
assert.ok(logTypes.has('技术包审核通过'), '应记录审核通过日志')
assert.ok(logTypes.has('技术包审核不通过'), '应记录审核不通过日志')
assert.ok(logTypes.has('跟单打回第一阶段'), '应记录跟单打回第一阶段日志')
assert.ok(logs.some((item) => item.changeText.includes('物料清单、核价')), '买手审核日志应说明物料清单、核价范围')
assert.ok(logs.some((item) => item.changeText.includes('纸样管理、款色用料对应')), '版师审核日志应说明纸样管理、款色用料对应范围')

const listItem = buildTechnicalVersionListByStyle(styleId)[0]
assert.ok(listItem.versionLogCount >= 5, '技术包版本列表应统计审核日志数量')

const closedPageHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(closedPageHtml.includes('查看版本日志'), '技术包详情应展示查看版本日志入口')
assert.equal(closedPageHtml.includes('技术包版本日志'), false, '未打开弹窗时不应直接展示版本日志面板')
assert.equal(closedPageHtml.includes('提交技术包审核'), false, '未打开弹窗时不应直接展示提交审核日志')
assert.equal(closedPageHtml.includes('跟单打回第一阶段'), false, '未打开弹窗时不应直接展示跟单打回日志')

handleTechPackEvent({
  closest: (selector: string) =>
    selector === '[data-tech-action]'
      ? ({ dataset: { techAction: 'open-version-logs' } } as HTMLElement)
      : null,
} as unknown as HTMLElement)
const openedPageHtml = renderTechPackPage(styleCode, { styleId, technicalVersionId })
assert.ok(openedPageHtml.includes('技术包版本日志'), '点击查看版本日志后应展示弹窗标题')
assert.ok(openedPageHtml.includes('提交技术包审核'), '版本日志弹窗应展示提交审核日志')
assert.ok(openedPageHtml.includes('跟单打回第一阶段'), '版本日志弹窗应展示跟单打回日志')

console.log('check:tech-pack-review-logs passed')
