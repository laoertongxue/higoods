import assert from 'node:assert/strict'

import {
  approveTechPackReview,
  canEditTechnicalModule,
  canPublishTechnicalVersionByReview,
  getTechnicalReviewPendingRoles,
  invalidateReviewForBomPriceChange,
  startTechPackReview,
} from '../src/data/pcs-tech-pack-review.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionStoreSnapshot,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
} from '../src/data/pcs-technical-data-version-types.ts'
import { installTechnicalDataVersionFixtures } from '../scripts/helpers/technical-data-version-fixtures.ts'

const technicalVersionId = 'tdv_bom_price_review_invalidation'

function makeReviewNode(nodeKey: TechnicalReviewNodeKey): TechnicalReviewNode {
  const meta = nodeKey === 'BUYER'
    ? { nodeName: '买手审核' as const, reviewerRole: '买手' as const, reviewerId: 'BUYER-001', reviewerName: '买手A' }
    : nodeKey === 'PATTERN_MAKER'
    ? { nodeName: '版师审核' as const, reviewerRole: '版师' as const, reviewerId: 'PATTERN-001', reviewerName: '版师B' }
    : { nodeName: '跟单审核' as const, reviewerRole: '跟单' as const, reviewerId: 'MERCH-001', reviewerName: '跟单C' }
  return {
    nodeKey,
    nodeName: meta.nodeName,
    status: '审核-已通过',
    reviewerRole: meta.reviewerRole,
    assignedReviewerId: meta.reviewerId,
    assignedReviewerName: meta.reviewerName,
    assignedReviewerRole: meta.reviewerRole,
    assignedReviewerFeishuOpenId: `ou_${meta.reviewerId.toLowerCase()}`,
    assignedAt: '2026-08-02 09:00',
    assignedBy: '跟单C',
    reviewedBy: meta.reviewerName,
    reviewedAt: '2026-08-02 10:00',
    startedOpinion: '开始审核',
    opinion: '审核通过',
    diffSnapshotId: `${technicalVersionId}_${nodeKey}`,
    diffStatus: '无差异',
    diffSummaryText: '无差异',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
    todayFeishuNotifyAt: '',
    feishuNotifyCount: 0,
  }
}

const baseRecord: TechnicalDataVersionRecord = {
  technicalVersionId,
  technicalVersionCode: 'TP-BOM-PRICE-REVIEW-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId: 'STYLE-BOM-PRICE-REVIEW',
  styleCode: 'STYLE-BOM-PRICE-REVIEW',
  styleName: '价格复审验证款',
  sourceProjectId: 'MASTER-BOM-PRICE-REVIEW',
  sourceProjectCode: 'EM-PRICE-REVIEW',
  sourceProjectName: '价格复审验证工程主单',
  sourceProjectNodeId: '',
  primaryPlateTaskId: '',
  primaryPlateTaskCode: '',
  primaryPlateTaskVersion: '',
  linkedRevisionTaskIds: [],
  linkedPatternTaskIds: [],
  linkedArtworkTaskIds: [],
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: 'MASTER-BOM-PRICE-REVIEW-TECH_PACK_CONFIRMATION',
  createdFromTaskCode: 'MASTER-BOM-PRICE-REVIEW-TECH_PACK_CONFIRMATION',
  baseTechnicalVersionId: '',
  baseTechnicalVersionCode: '',
  changeScope: '制版生成',
  changeSummary: '价格复审验证',
  garmentDifficultyGrade: 'B',
  linkedPartTemplateIds: [],
  linkedPatternLibraryVersionIds: [],
  linkedPatternAssetIds: [],
  linkedPatternAssetCodes: [],
  versionStatus: 'DRAFT',
  reviewStage: '待发布',
  buyerReview: makeReviewNode('BUYER'),
  patternMakerReview: makeReviewNode('PATTERN_MAKER'),
  merchandiserReview: makeReviewNode('MERCHANDISER'),
  reviewSubmittedAt: '2026-08-02 09:00',
  reviewSubmittedBy: '跟单C',
  returnedFromMerchandiserFlag: false,
  reviewUnlockedModuleKeys: [],
  bomStatus: 'DRAFT',
  patternStatus: 'DRAFT',
  processStatus: 'DRAFT',
  gradingStatus: 'DRAFT',
  qualityStatus: 'DRAFT',
  colorMaterialStatus: 'DRAFT',
  designStatus: 'DRAFT',
  attachmentStatus: 'DRAFT',
  bomItemCount: 1,
  patternFileCount: 1,
  processEntryCount: 1,
  gradingRuleCount: 1,
  qualityRuleCount: 1,
  colorMaterialMappingCount: 1,
  designAssetCount: 1,
  attachmentCount: 1,
  completenessScore: 100,
  missingItemCodes: [],
  missingItemNames: [],
  publishedAt: '',
  publishedBy: '',
  createdAt: '2026-08-02 08:00',
  createdBy: '跟单C',
  updatedAt: '2026-08-02 10:00',
  updatedBy: '跟单C',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
}

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [],
  bomCustomCosts: [],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {},
}

function installApprovedFixture(): void {
  installTechnicalDataVersionFixtures({
    version: 3,
    records: [baseRecord],
    contents: [content],
    pendingItems: [],
  })
}

const changedCases = [
  ['STANDARD_MATERIAL_PRICE_CNY', 'MAT-SKU-001', 12.34, 13.21],
  ['CUSTOM_COST_IDR', 'COST-001', 15000, 18000],
  ['EXCHANGE_RATE_IDR_PER_CNY', 'CNY_IDR', 2200, 2250],
  ['BOM_UNIT_CONSUMPTION', 'BOM-001', 1.2, 1.3],
  ['BOM_LOSS_RATE', 'BOM-001', 0.03, 0.05],
] as const

for (const [changeSource, targetId, beforeValue, afterValue] of changedCases) {
  installApprovedFixture()
  const before = getTechnicalDataVersionById(technicalVersionId)
  assert.ok(before)
  const next = invalidateReviewForBomPriceChange(technicalVersionId, {
    changes: [{ changeSource, targetId, beforeValue, afterValue }],
    operator: '系统价格联动',
  })
  assert.equal(next.reviewStage, '第一阶段并行审核', `${changeSource} 应回到买手复审`)
  assert.equal(next.buyerReview?.status, '待审核', `${changeSource} 应重置买手审核`)
  assert.deepEqual(next.patternMakerReview, before.patternMakerReview, `${changeSource} 不应重置版师审核`)
  assert.deepEqual(next.merchandiserReview, before.merchandiserReview, `${changeSource} 不应重置跟单审核`)
  assert.deepEqual(next.reviewUnlockedModuleKeys, ['BOM', 'COST'], `${changeSource} 只解锁 BOM 与价格`)
  assert.equal(canEditTechnicalModule(next, 'BOM'), true)
  assert.equal(canEditTechnicalModule(next, 'COST'), true)
  assert.equal(canEditTechnicalModule(next, 'PATTERN'), false)
  assert.deepEqual(getTechnicalReviewPendingRoles(next), ['买手'])
  assert.equal(canPublishTechnicalVersionByReview(next), false, '买手复审通过前禁止发布')
}

installApprovedFixture()
const planCompatible = invalidateReviewForBomPriceChange(technicalVersionId, {
  changedBomItemIds: ['BOM-001'],
  beforePriceCny: 12.34,
  afterPriceCny: 13.21,
})
assert.equal(planCompatible.buyerReview?.status, '待审核', '实现计划中的价格变化调用格式应保持可用')
assert.equal(planCompatible.patternMakerReview?.status, '审核-已通过')

installApprovedFixture()
const unchangedBefore = getTechnicalDataVersionStoreSnapshot()
const unchanged = invalidateReviewForBomPriceChange(technicalVersionId, {
  changes: [{ changeSource: 'CUSTOM_COST_IDR', targetId: 'COST-001', beforeValue: 15000, afterValue: 15000 }],
  operator: '系统价格联动',
})
assert.equal(unchanged.reviewStage, '待发布')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), unchangedBefore, '价格未变化时不得写入')

installApprovedFixture()
const failureBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => invalidateReviewForBomPriceChange(technicalVersionId, {
    changes: [{ changeSource: 'STANDARD_MATERIAL_PRICE_CNY', targetId: 'MAT-SKU-001', beforeValue: 12.34, afterValue: Number.NaN }],
    operator: '系统价格联动',
  }),
  /价格变化数据无效/,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), failureBefore, '失败时不得产生写入')

installApprovedFixture()
let current = invalidateReviewForBomPriceChange(technicalVersionId, {
  changes: [{ changeSource: 'BOM_UNIT_CONSUMPTION', targetId: 'BOM-001', beforeValue: 1.2, afterValue: 1.3 }],
  operator: '系统价格联动',
})
current = startTechPackReview(technicalVersionId, 'BUYER', '买手A')
current = approveTechPackReview(technicalVersionId, 'BUYER', '价格变化复审通过', '买手A')
assert.equal(current.reviewStage, '待发布', '买手复审通过后恢复待发布')
assert.equal(current.patternMakerReview?.status, '审核-已通过')
assert.equal(current.merchandiserReview?.status, '审核-已通过')
assert.deepEqual(current.reviewUnlockedModuleKeys, [], '买手复审通过后收回临时解锁')
assert.equal(canPublishTechnicalVersionByReview(current), true, '买手复审通过后恢复发布资格')

console.log('pcs-tech-pack-bom-price-review-invalidation passed')
