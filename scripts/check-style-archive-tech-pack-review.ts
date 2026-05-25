import assert from 'node:assert/strict'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import type { StyleArchiveShellRecord } from '../src/data/pcs-style-archive-types.ts'

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

const { submitTechPackFirstStageReview } = await import('../src/data/pcs-tech-pack-review.ts')
const { replaceTechnicalDataVersionStore } = await import('../src/data/pcs-technical-data-version-repository.ts')
const { replaceStyleArchiveStore } = await import('../src/data/pcs-style-archive-repository.ts')
const {
  handlePcsProductArchiveEvent,
  handlePcsProductArchiveInput,
  renderPcsStyleArchiveDetailPage,
  renderPcsStyleArchiveListPage,
  resetPcsProductArchiveState,
} = await import('../src/pages/pcs-product-archives.ts')

const technicalVersionId = 'tdv_style_archive_review_001'
const styleId = 'style_archive_review_001'
const styleCode = 'STYLE-ARCHIVE-REVIEW'

const style = {
  styleId,
  styleCode,
  styleName: '款式档案审核提示验证款',
  styleNameEn: 'Review Demo Style',
  styleNumber: 'REV-001',
  styleType: '成衣',
  sourceProjectId: 'PRJ-STYLE-ARCHIVE-REVIEW',
  sourceProjectCode: 'PRJ-STYLE-ARCHIVE-REVIEW',
  sourceProjectName: '款式档案审核提示项目',
  sourceProjectNodeId: 'NODE-STYLE-ARCHIVE-REVIEW',
  categoryId: 'CAT-1',
  categoryName: '女装',
  subCategoryId: 'SUB-1',
  subCategoryName: '连衣裙',
  brandId: 'BRAND-1',
  brandName: 'HiGood',
  yearTag: '2026',
  seasonTags: ['夏季'],
  styleTags: ['通勤'],
  targetAudienceTags: ['都市女性'],
  targetChannelCodes: ['官网'],
  priceRangeLabel: '299-399',
  archiveStatus: 'ACTIVE',
  baseInfoStatus: '已建档',
  specificationStatus: '已建立',
  techPackStatus: '已建立',
  costPricingStatus: '未建立',
  specificationCount: 2,
  techPackVersionCount: 1,
  costVersionCount: 0,
  channelProductCount: 0,
  currentTechPackVersionId: technicalVersionId,
  currentTechPackVersionCode: 'TDV-STYLE-ARCHIVE-REVIEW-001',
  currentTechPackVersionLabel: 'V1',
  currentTechPackVersionStatus: 'DRAFT',
  currentTechPackVersionActivatedAt: '',
  currentTechPackVersionActivatedBy: '',
  mainImageId: '',
  mainImageUrl: '',
  galleryImageIds: [],
  galleryImageUrls: [],
  imageSource: '',
  sellingPointText: '用于验证款式档案列表和详情显示技术包审核信息。',
  detailDescription: '审核状态应在列表、概览和技术包版本表中清晰可见。',
  packagingInfo: '单件包装',
  remark: '',
  generatedAt: '2026-05-25 13:00',
  generatedBy: '测试用户',
  updatedAt: '2026-05-25 13:00',
  updatedBy: '测试用户',
  legacyOriginProject: '',
} satisfies StyleArchiveShellRecord

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-STYLE-ARCHIVE-REVIEW-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: style.styleName,
  sourceProjectId: style.sourceProjectId,
  sourceProjectCode: style.sourceProjectCode,
  sourceProjectName: style.sourceProjectName,
  sourceProjectNodeId: style.sourceProjectNodeId,
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
  changeSummary: '款式档案审核提示验证',
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
  createdAt: '2026-05-25 13:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 13:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [
    {
      id: 'pattern-style-archive-review-1',
      recordKind: 'MATERIAL_ASSOCIATION',
      patternName: '前片纸样',
      fileName: 'front.dxf',
      fileUrl: '#',
      uploadedAt: '2026-05-25 13:00',
      uploadedBy: '版师',
    },
  ],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [
    {
      id: 'bom-style-archive-review-1',
      type: '面料',
      name: '主面料',
      spec: '棉',
      unitConsumption: 1,
      lossRate: 0.03,
      supplier: '供应商甲',
    },
  ],
  qualityRules: [],
  colorMaterialMappings: [
    {
      id: 'mapping-style-archive-review-1',
      spuCode: styleCode,
      colorCode: 'BK',
      colorName: '黑色',
      status: 'AUTO_DRAFT',
      generatedMode: 'SYSTEM',
      lines: [],
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-style-archive-review-1', bomItemId: 'bom-style-archive-review-1', price: 12, currency: '人民币', unit: '人民币/件' }],
  },
}

replaceStyleArchiveStore({
  version: 2,
  records: [style],
  pendingItems: [],
})
replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})
submitTechPackFirstStageReview(technicalVersionId, '维护人')

resetPcsProductArchiveState()
const listHtml = renderPcsStyleArchiveListPage()
assert.ok(listHtml.includes('技术包审核'), '款式档案列表应有技术包审核列和筛选')
assert.ok(listHtml.includes('待买手、版师审核'), '列表应显示当前技术包审核状态')
assert.ok(listHtml.includes('待审核：买手、版师'), '列表应显示待审核角色')
assert.ok(listHtml.includes('需要审核'), '列表筛选应包含需要审核选项')
assert.ok(listHtml.includes(`/pcs/products/styles/${styleId}/technical-data/${technicalVersionId}`), '列表审核版本应能进入技术包详情')

handlePcsProductArchiveInput({
  dataset: { pcsProductArchiveField: 'style-list-review' },
  value: 'needsReview',
  checked: false,
} as unknown as Element)
const filteredNeedsReviewHtml = renderPcsStyleArchiveListPage()
assert.ok(filteredNeedsReviewHtml.includes(styleCode), '技术包审核筛选为需要审核时应保留待审核款式')

handlePcsProductArchiveInput({
  dataset: { pcsProductArchiveField: 'style-list-review' },
  value: 'waitingPublish',
  checked: false,
} as unknown as Element)
const filteredWaitingPublishHtml = renderPcsStyleArchiveListPage()
assert.equal(filteredWaitingPublishHtml.includes(styleCode), false, '技术包审核筛选为待发布时不应展示仍在审核中的款式')

resetPcsProductArchiveState()
const overviewHtml = renderPcsStyleArchiveDetailPage(styleId)
assert.ok(overviewHtml.includes('技术包审核'), '款式详情概览应显示技术包审核信息')
assert.ok(overviewHtml.includes('待审核：买手、版师'), '款式详情概览应显示待审核角色')

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'set-style-detail-tab', value: 'versions' },
} as unknown as HTMLElement)
const versionsHtml = renderPcsStyleArchiveDetailPage(styleId)
assert.ok(versionsHtml.includes('审核状态'), '款式详情技术包版本表应有审核状态列')
assert.ok(versionsHtml.includes('待买手、版师审核'), '款式详情技术包版本表应显示审核状态')
assert.ok(versionsHtml.includes('去买手、版师审核'), '款式详情技术包版本表应显示审核动作提示')
assert.ok(versionsHtml.includes('查看版本日志'), '款式详情技术包版本表应显示查看版本日志入口')
assert.equal(versionsHtml.includes('技术包版本日志'), false, '未打开弹窗时款式详情不应直接展示技术包版本日志')

handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'open-tech-pack-version-logs', versionId: technicalVersionId },
} as unknown as HTMLElement)
const versionLogDialogHtml = renderPcsStyleArchiveDetailPage(styleId)
assert.ok(versionLogDialogHtml.includes('技术包版本日志'), '点击查看版本日志后应展示日志弹窗')
assert.ok(versionLogDialogHtml.includes('TDV-STYLE-ARCHIVE-REVIEW-001'), '日志弹窗应展示对应技术包版本编码')
assert.ok(versionLogDialogHtml.includes('提交技术包审核'), '日志弹窗应展示该版本的审核日志')

console.log('check:style-archive-tech-pack-review passed')
