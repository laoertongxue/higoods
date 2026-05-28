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

const {
  getTechnicalReviewFeishuNotifyText,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const { runDailyTechPackReviewFeishuNotifications } = await import('../src/data/pcs-tech-pack-review-feishu.ts')
const {
  listTechPackReviewNotificationsByNode,
  resetTechPackReviewNotificationRepository,
} = await import('../src/data/pcs-tech-pack-review-notification-repository.ts')
const {
  getTechnicalDataVersionById,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { replaceStyleArchiveStore } = await import('../src/data/pcs-style-archive-repository.ts')
const {
  renderPcsStyleArchiveDetailPage,
  renderPcsStyleArchiveListPage,
  resetPcsProductArchiveState,
} = await import('../src/pages/pcs-product-archives.ts')

const technicalVersionId = 'tdv_review_feishu_001'
const styleId = 'style_review_feishu_001'
const styleCode = 'STYLE-REVIEW-FEISHU'

const style = {
  styleId,
  styleCode,
  styleName: '飞书审核提醒验证款',
  styleNameEn: 'Review Notify Demo',
  styleNumber: 'NOTIFY-001',
  styleType: '成衣',
  sourceProjectId: 'PRJ-REVIEW-FEISHU',
  sourceProjectCode: 'PRJ-REVIEW-FEISHU',
  sourceProjectName: '飞书审核提醒验证项目',
  sourceProjectNodeId: '',
  categoryId: 'CAT-1',
  categoryName: '女装',
  subCategoryId: 'SUB-1',
  subCategoryName: '衬衫',
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
  currentTechPackVersionCode: 'TDV-REVIEW-FEISHU-001',
  currentTechPackVersionLabel: 'V1',
  currentTechPackVersionStatus: 'DRAFT',
  currentTechPackVersionActivatedAt: '',
  currentTechPackVersionActivatedBy: '',
  mainImageId: '',
  mainImageUrl: '',
  galleryImageIds: [],
  galleryImageUrls: [],
  imageSource: '',
  sellingPointText: '用于验证飞书审核提醒。',
  detailDescription: '审核节点需要展示飞书发送状态和发送记录。',
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
  technicalVersionCode: 'TDV-REVIEW-FEISHU-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: style.styleName,
  sourceProjectId: style.sourceProjectId,
  sourceProjectCode: style.sourceProjectCode,
  sourceProjectName: style.sourceProjectName,
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
  changeSummary: '飞书审核提醒验证',
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
      id: 'pattern-review-feishu-1',
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
      id: 'bom-review-feishu-1',
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
      id: 'mapping-review-feishu-1',
      spuCode: styleCode,
      colorCode: 'BK',
      colorName: '黑色',
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      lines: [],
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [{ id: 'MC-review-feishu-1', bomItemId: 'bom-review-feishu-1', price: 12, currency: '人民币', unit: '人民币/件' }],
  },
}

resetTechPackReviewNotificationRepository()
replaceStyleArchiveStore({ version: 2, records: [style], pendingItems: [] })
replaceTechnicalDataVersionStore({ version: 3, records: [record], contents: [content], pendingItems: [] })

let current = submitTechPackFirstStageReview(technicalVersionId, {
  buyerReviewerId: 'BUYER-UNBOUND',
  patternMakerReviewerId: 'PATTERN-001',
  merchandiserReviewerId: 'MERCH-001',
  operator: { id: 'U001', name: 'Budi Santoso' },
})
assert.equal(current.buyerReview?.lastFeishuNotifyStatus, '发送失败', '未绑定飞书的买手应记录发送失败')
assert.equal(current.patternMakerReview?.lastFeishuNotifyStatus, '已发送', '已绑定飞书的版师应记录发送成功')
assert.equal(listTechPackReviewNotificationsByNode(technicalVersionId, 'BUYER').length, 1, '提交审核应记录买手飞书发送记录')
assert.equal(listTechPackReviewNotificationsByNode(technicalVersionId, 'PATTERN_MAKER').length, 1, '提交审核应记录版师飞书发送记录')

const dailyRecords = runDailyTechPackReviewFeishuNotifications({
  dateKey: '2026-05-28',
  sentAt: '2026-05-28 09:00',
  operatorName: '系统每日提醒',
})
assert.equal(dailyRecords.length, 2, '每日提醒应覆盖买手和版师两个待审核节点')
assert.equal(
  runDailyTechPackReviewFeishuNotifications({
    dateKey: '2026-05-28',
    sentAt: '2026-05-28 15:00',
    operatorName: '系统每日提醒',
  }).length,
  0,
  '同一天同一待审核节点不能重复发送每日提醒',
)

current = getTechnicalDataVersionById(technicalVersionId)!
assert.equal(current.buyerReview?.todayFeishuNotifyAt, '2026-05-28 09:00', '买手节点应记录今日提醒发送时间')
assert.equal(current.patternMakerReview?.todayFeishuNotifiedFlag, true, '版师节点应记录今日已成功发送')
assert.equal(listTechPackReviewNotificationsByNode(technicalVersionId, 'BUYER').length, 2, '买手节点应能追溯提交审核和每日提醒两条记录')
assert.equal(listTechPackReviewNotificationsByNode(technicalVersionId, 'PATTERN_MAKER').length, 2, '版师节点应能追溯提交审核和每日提醒两条记录')
assert.equal(
  getTechnicalReviewFeishuNotifyText(current),
  '买手：发送失败 / 今日未提醒；版师：已发送 / 今日已提醒',
  '飞书摘要应区分发送失败和今日已成功提醒',
)

resetPcsProductArchiveState()
const listHtml = renderPcsStyleArchiveListPage()
assert.ok(listHtml.includes('待审核：买手：未绑定飞书买手、版师：版师B'), '款式档案列表应展示指定审核人')
assert.ok(listHtml.includes('飞书：买手：发送失败 / 今日未提醒；版师：已发送 / 今日已提醒'), '款式档案列表应展示飞书提醒状态')

const detailHtml = renderPcsStyleArchiveDetailPage(styleId)
assert.ok(detailHtml.includes('飞书：买手：发送失败 / 今日未提醒；版师：已发送 / 今日已提醒'), '款式详情应展示飞书提醒状态')

console.log('check:tech-pack-review-feishu-notification passed')
