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
  compareBomPriceChanges,
  saveTechnicalDataVersionBomCustomCosts,
} from '../src/data/pcs-engineering-bom-pricing.ts'
import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import {
  getLatestPcsExchangeRate,
  updateLatestPcsExchangeRate,
} from '../src/data/pcs-exchange-rate-config.ts'
import { setBomPriceReviewInvalidationFailureForTesting } from '../src/data/pcs-tech-pack-bom-price-review-invalidation.ts'
import {
  listTechPackReviewNotificationsByVersionId,
  resetTechPackReviewNotificationRepository,
} from '../src/data/pcs-tech-pack-review-notification-repository.ts'
import {
  listTechPackVersionLogsByVersionId,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import { saveTechnicalDataVersionBomMaterialLine } from '../src/data/pcs-engineering-bom-pricing.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  getTechnicalDataVersionStoreSnapshot,
  updateTechnicalDataVersionContent,
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
  linkedDesignRevisionTaskIds: [],
  linkedPatternTaskIds: [],
  linkedArtworkTaskIds: [],
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: 'MASTER-BOM-PRICE-REVIEW-TECH_PACK_CONFIRMATION',
  createdFromTaskCode: 'MASTER-BOM-PRICE-REVIEW-TECH_PACK_CONFIRMATION',
  baseTechnicalVersionId: '',
  baseTechnicalVersionCode: '',
  changeScope: '工程主单生成',
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

function installApprovedFixture(contentOverride: TechnicalDataVersionContent = content): void {
  resetTechPackVersionLogRepository()
  resetTechPackReviewNotificationRepository()
  installTechnicalDataVersionFixtures({
    version: 3,
    records: [baseRecord],
    contents: [contentOverride],
    pendingItems: [],
  })
}

function installUnsubmittedFixture(contentOverride: TechnicalDataVersionContent): void {
  resetTechPackVersionLogRepository()
  resetTechPackReviewNotificationRepository()
  installTechnicalDataVersionFixtures({
    version: 3,
    records: [{
      ...baseRecord,
      reviewStage: '未提交审核',
      buyerReview: undefined,
      patternMakerReview: undefined,
      merchandiserReview: undefined,
      reviewSubmittedAt: '',
      reviewSubmittedBy: '',
      reviewUnlockedModuleKeys: [],
    }],
    contents: [contentOverride],
    pendingItems: [],
  })
}

function installInReviewFixture(
  buyerStatus: '待审核' | '审核中' | '无需审核',
  contentOverride: TechnicalDataVersionContent,
): void {
  resetTechPackVersionLogRepository()
  resetTechPackReviewNotificationRepository()
  installTechnicalDataVersionFixtures({
    version: 3,
    records: [{
      ...baseRecord,
      reviewStage: '第一阶段并行审核',
      buyerReview: {
        ...makeReviewNode('BUYER'),
        status: buyerStatus,
        reviewedBy: '',
        reviewedAt: '',
        opinion: '',
      },
      reviewUnlockedModuleKeys: [],
    }],
    contents: [contentOverride],
    pendingItems: [],
  })
}

function createPricedMaterial() {
  const archive = createMaterialArchive({
    kind: 'fabric',
    materialName: `价格失效测试面料-${Date.now()}-${Math.random()}`,
    materialNameEn: 'Price invalidation fabric',
    categoryName: '测试面料',
    specSummary: '测试',
    composition: '棉',
    processTags: [],
    widthText: '150cm',
    gramWeightText: '180g',
    pricingUnit: '米',
    mainUnit: '米',
    auxiliaryUnits: ['Yard'],
    unitConversions: [{ fromUnit: 'Yard', toUnit: '米', factor: 0.9144 }],
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  })
  const sku = createMaterialSkuRecord(archive.materialId, {
    colorName: '黑色',
    specName: '标准',
    sizeName: '-',
    skuImageUrl: '',
    costPrice: 12.34,
    freightCost: 0,
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    barcode: '',
  })
  assert.ok(sku)
  return sku
}

function contentWithBom(materialSkuId: string): TechnicalDataVersionContent {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  return {
    ...content,
    bomItems: [{
      id: 'BOM-001',
      type: '面料',
      name: sku.materialName,
      spec: sku.specName,
      materialCode: sku.materialCode,
      materialSkuId,
      unit: '米',
      unitConsumption: 1,
      sampleQuantity: 1,
      lossRate: 0,
      supplier: '测试供应商',
    }],
    bomCustomCosts: [{ title: '车位费', amountIdr: 15000 }],
  }
}

const samePriceSkuSwitchBefore = {
  ...content,
  bomItems: [{
    id: 'BOM-SAME-PRICE-SKU',
    type: '面料' as const,
    name: '同价物料 A',
    spec: '标准',
    materialCode: 'MAT-SAME-PRICE',
    materialSkuId: 'MAT-SKU-SAME-PRICE-A',
    unit: '米',
    unitConsumption: 1,
    sampleQuantity: 1,
    lossRate: 0,
    supplier: '测试供应商',
  }],
}
const samePriceSkuSwitchAfter = {
  ...samePriceSkuSwitchBefore,
  bomItems: samePriceSkuSwitchBefore.bomItems.map((item) => ({
    ...item,
    name: '同价物料 B',
    materialSkuId: 'MAT-SKU-SAME-PRICE-B',
  })),
}
assert.deepEqual(
  compareBomPriceChanges(samePriceSkuSwitchBefore, samePriceSkuSwitchAfter),
  [{
    changeSource: 'MATERIAL_SKU_CHANGE',
    targetId: 'BOM-SAME-PRICE-SKU',
    beforeValue: 'MAT-SKU-SAME-PRICE-A',
    afterValue: 'MAT-SKU-SAME-PRICE-B',
  }],
  '标准单价相同也不能吞掉真实物料 SKU 更换',
)
assert.deepEqual(
  compareBomPriceChanges(samePriceSkuSwitchBefore, {
    ...samePriceSkuSwitchBefore,
    bomItems: samePriceSkuSwitchBefore.bomItems.map((item) => ({ ...item, sampleQuantity: 2 })),
  }),
  [{
    changeSource: 'BOM_SAMPLE_QUANTITY',
    targetId: 'BOM-SAME-PRICE-SKU',
    beforeValue: 1,
    afterValue: 2,
  }],
  '打样数量变化必须作为独立 BOM 价格事实',
)
assert.deepEqual(
  compareBomPriceChanges(samePriceSkuSwitchBefore, {
    ...samePriceSkuSwitchBefore,
    bomItems: samePriceSkuSwitchBefore.bomItems.map((item) => ({ ...item, unit: 'Yard' })),
  }),
  [{
    changeSource: 'BOM_USAGE_UNIT',
    targetId: 'BOM-SAME-PRICE-SKU',
    beforeValue: '米',
    afterValue: 'Yard',
  }],
  '用量单位身份变化必须触发，不能只比较换算后的数值',
)
assert.deepEqual(
  compareBomPriceChanges(samePriceSkuSwitchBefore, {
    ...samePriceSkuSwitchBefore,
    bomItems: samePriceSkuSwitchBefore.bomItems.map((item) => ({ ...item })),
  }),
  [],
  '打样数量和用量单位同值保存不得产生价格变化事实',
)

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
  assert.notEqual(next.buyerReview?.diffSnapshotId, before.buyerReview?.diffSnapshotId, `${changeSource} 必须重建买手差异快照`)
  assert.equal(next.buyerReview?.diffStatus, '有差异', `${changeSource} 必须将当前变化写入差异状态`)
  assert.match(next.buyerReview?.diffSummaryText || '', /BOM 与价格变化/, `${changeSource} 必须更新差异摘要`)
  const reviewLogs = listTechPackVersionLogsByVersionId(technicalVersionId)
  assert.equal(reviewLogs.length, 1, `${changeSource} 必须追加一条审核生命周期日志`)
  assert.equal(reviewLogs[0]?.logType, 'BOM 与价格变化重新审核')
  assert.match(reviewLogs[0]?.changeText || '', /买手重新审核/)
  const notifications = listTechPackReviewNotificationsByVersionId(technicalVersionId)
  assert.equal(notifications.length, 1, `${changeSource} 必须发送一条买手复审通知`)
  assert.equal(notifications[0]?.nodeKey, 'BUYER')
  assert.equal(notifications[0]?.notificationType, '打回复审')
}

installApprovedFixture()
saveTechnicalDataVersionBomCustomCosts(
  technicalVersionId,
  [{ title: '车位费', amountIdr: 18000 }],
  '买手',
)
const customCostSaved = getTechnicalDataVersionById(technicalVersionId)
assert.equal(customCostSaved?.buyerReview?.status, '待审核', '真实自定义费用保存必须触发买手复审')
assert.deepEqual(customCostSaved?.reviewUnlockedModuleKeys, ['BOM', 'COST'])
assert.equal(customCostSaved?.patternMakerReview?.status, '审核-已通过')
assert.equal(customCostSaved?.merchandiserReview?.status, '审核-已通过')

const pricedSku = createPricedMaterial()
for (const [field, nextValue] of [
  ['usage', 1.2],
  ['lossRate', 0.05],
  ['sampleQuantity', 2],
  ['usageUnit', 'Yard'],
] as const) {
  installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
  saveTechnicalDataVersionBomMaterialLine(
    technicalVersionId,
    'BOM-001',
    { [field]: nextValue },
    '买手',
  )
  const saved = getTechnicalDataVersionById(technicalVersionId)
  assert.equal(saved?.buyerReview?.status, '待审核', `真实 ${field} 保存必须触发买手复审`)
  assert.deepEqual(saved?.reviewUnlockedModuleKeys, ['BOM', 'COST'])
  assert.equal(saved?.patternMakerReview?.status, '审核-已通过')
  assert.equal(saved?.merchandiserReview?.status, '审核-已通过')
}

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const skuBeforePriceChange = getMaterialSkuRecordById(pricedSku.materialSkuId)
assert.ok(skuBeforePriceChange)
assert.ok(updateMaterialSkuRecord(pricedSku.materialSkuId, {
  colorName: skuBeforePriceChange.colorName,
  specName: skuBeforePriceChange.specName,
  sizeName: skuBeforePriceChange.sizeName,
  skuImageUrl: skuBeforePriceChange.skuImageUrl,
  costPrice: 13.21,
  freightCost: skuBeforePriceChange.freightCost,
  weightKg: skuBeforePriceChange.weightKg,
  lengthCm: skuBeforePriceChange.lengthCm,
  widthCm: skuBeforePriceChange.widthCm,
  heightCm: skuBeforePriceChange.heightCm,
  barcode: skuBeforePriceChange.barcode,
}))
assert.equal(
  getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.status,
  '待审核',
  '真实物料标准单价保存必须触发引用技术包的买手复审',
)

installUnsubmittedFixture(contentWithBom(pricedSku.materialSkuId))
const unsubmittedMaterialBefore = getTechnicalDataVersionById(technicalVersionId)
const unsubmittedSkuBefore = getMaterialSkuRecordById(pricedSku.materialSkuId)
assert.ok(unsubmittedSkuBefore)
assert.ok(updateMaterialSkuRecord(pricedSku.materialSkuId, {
  colorName: unsubmittedSkuBefore.colorName,
  specName: unsubmittedSkuBefore.specName,
  sizeName: unsubmittedSkuBefore.sizeName,
  skuImageUrl: unsubmittedSkuBefore.skuImageUrl,
  costPrice: unsubmittedSkuBefore.costPrice + 1,
  freightCost: unsubmittedSkuBefore.freightCost,
  weightKg: unsubmittedSkuBefore.weightKg,
  lengthCm: unsubmittedSkuBefore.lengthCm,
  widthCm: unsubmittedSkuBefore.widthCm,
  heightCm: unsubmittedSkuBefore.heightCm,
  barcode: unsubmittedSkuBefore.barcode,
}))
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.reviewStage, '未提交审核', '未提交草稿不得因标准单价变化进入第一阶段审核')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.assignedReviewerId, '')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.reviewSubmittedAt, '')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 0)
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 0)

installInReviewFixture('待审核', contentWithBom(pricedSku.materialSkuId))
const pendingBuyerBefore = getTechnicalDataVersionById(technicalVersionId)?.buyerReview
const pendingSkuBefore = getMaterialSkuRecordById(pricedSku.materialSkuId)
assert.ok(pendingSkuBefore)
assert.ok(updateMaterialSkuRecord(pricedSku.materialSkuId, {
  colorName: pendingSkuBefore.colorName,
  specName: pendingSkuBefore.specName,
  sizeName: pendingSkuBefore.sizeName,
  skuImageUrl: pendingSkuBefore.skuImageUrl,
  costPrice: pendingSkuBefore.costPrice + 1,
  freightCost: pendingSkuBefore.freightCost,
  weightKg: pendingSkuBefore.weightKg,
  lengthCm: pendingSkuBefore.lengthCm,
  widthCm: pendingSkuBefore.widthCm,
  heightCm: pendingSkuBefore.heightCm,
  barcode: pendingSkuBefore.barcode,
}))
assert.deepEqual(getTechnicalDataVersionById(technicalVersionId)?.buyerReview, pendingBuyerBefore, '待审核中的买手节点不得因标准价变化被重置')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 0, '待审核中不得新增复审日志')
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 0, '待审核中不得重复通知复审')

installInReviewFixture('审核中', contentWithBom(pricedSku.materialSkuId))
const reviewingBuyerBefore = getTechnicalDataVersionById(technicalVersionId)?.buyerReview
saveTechnicalDataVersionBomMaterialLine(technicalVersionId, 'BOM-001', { usage: 1.25 }, '买手')
assert.deepEqual(getTechnicalDataVersionById(technicalVersionId)?.buyerReview, reviewingBuyerBefore, '审核中的买手节点不得因直接 BOM 保存被重置')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 0, '审核中不得新增复审日志')
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 0, '审核中不得重复通知复审')

installInReviewFixture('无需审核', contentWithBom(pricedSku.materialSkuId))
const noReviewBuyerBefore = getTechnicalDataVersionById(technicalVersionId)?.buyerReview
saveTechnicalDataVersionBomMaterialLine(technicalVersionId, 'BOM-001', { lossRate: 0.05 }, '买手')
const noReviewBuyerAfter = getTechnicalDataVersionById(technicalVersionId)?.buyerReview
assert.equal(noReviewBuyerAfter?.status, '待审核', '无需审核是既有完成结论，BOM 变化后必须进入买手复审')
assert.notEqual(noReviewBuyerAfter?.diffSnapshotId, noReviewBuyerBefore?.diffSnapshotId, '无需审核失效后必须生成新差异快照')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 1, '无需审核失效后必须写复审日志')
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 1, '无需审核失效后必须发买手复审通知')
assert.equal(unsubmittedMaterialBefore?.reviewStage, '未提交审核')

installUnsubmittedFixture(contentWithBom(pricedSku.materialSkuId))
const unsubmittedRate = getLatestPcsExchangeRate().idrPerCny
updateLatestPcsExchangeRate({ idrPerCny: unsubmittedRate + 1, updatedBy: '系统管理员' })
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.reviewStage, '未提交审核', '未提交草稿不得因汇率变化进入第一阶段审核')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.assignedReviewerId, '')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 0)
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 0)

installUnsubmittedFixture(contentWithBom(pricedSku.materialSkuId))
saveTechnicalDataVersionBomMaterialLine(
  technicalVersionId,
  'BOM-001',
  { usage: 1.25 },
  '买手',
)
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.reviewStage, '未提交审核', '未提交草稿直接保存 BOM 不得绕过提交审核入口')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.assignedReviewerId, '')
assert.equal(listTechPackVersionLogsByVersionId(technicalVersionId).length, 0)
assert.equal(listTechPackReviewNotificationsByVersionId(technicalVersionId).length, 0)

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const currentRate = getLatestPcsExchangeRate().idrPerCny
updateLatestPcsExchangeRate({ idrPerCny: currentRate + 1, updatedBy: '系统管理员' })
assert.equal(
  getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.status,
  '待审核',
  '真实系统汇率保存必须触发草稿技术包的买手复审',
)

installApprovedFixture({ ...content, bomCustomCosts: [{ title: '车位费', amountIdr: 15000 }] })
const customCostOnlyRate = getLatestPcsExchangeRate().idrPerCny
updateLatestPcsExchangeRate({ idrPerCny: customCostOnlyRate + 1, updatedBy: '系统管理员' })
assert.equal(
  getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.status,
  '待审核',
  '只有自定义印尼盾费用的草稿也必须在汇率变化后触发买手复审',
)

const replacementSku = createPricedMaterial()
installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
saveTechnicalDataVersionBomMaterialLine(
  technicalVersionId,
  'BOM-001',
  { materialSkuId: replacementSku.materialSkuId },
  '买手',
)
assert.equal(
  getTechnicalDataVersionById(technicalVersionId)?.buyerReview?.status,
  '待审核',
  'BOM 更换为不同标准单价的物料 SKU 时必须触发买手复审',
)

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
saveTechnicalDataVersionBomMaterialLine(
  technicalVersionId,
  'BOM-001',
  { usage: 1, lossRate: 0, sampleQuantity: 1, usageUnit: '米' },
  '买手',
)
const noChangeBefore = getTechnicalDataVersionStoreSnapshot()
saveTechnicalDataVersionBomMaterialLine(
  technicalVersionId,
  'BOM-001',
  { usage: 1, lossRate: 0, sampleQuantity: 1, usageUnit: '米' },
  '买手',
)
saveTechnicalDataVersionBomCustomCosts(technicalVersionId, [{ title: '车位费', amountIdr: 15000 }], '买手')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), noChangeBefore, '真实保存值未变化时不得失效审核或写入')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const samePriceBefore = getTechnicalDataVersionStoreSnapshot()
const samePriceSkuBefore = getMaterialSkuRecordById(pricedSku.materialSkuId)
assert.ok(samePriceSkuBefore)
assert.ok(updateMaterialSkuRecord(pricedSku.materialSkuId, {
  colorName: samePriceSkuBefore.colorName,
  specName: samePriceSkuBefore.specName,
  sizeName: samePriceSkuBefore.sizeName,
  skuImageUrl: samePriceSkuBefore.skuImageUrl,
  costPrice: samePriceSkuBefore.costPrice,
  freightCost: samePriceSkuBefore.freightCost,
  weightKg: samePriceSkuBefore.weightKg,
  lengthCm: samePriceSkuBefore.lengthCm,
  widthCm: samePriceSkuBefore.widthCm,
  heightCm: samePriceSkuBefore.heightCm,
  barcode: samePriceSkuBefore.barcode,
}))
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), samePriceBefore, '标准单价未变化不得失效技术包审核')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const unrelatedSku = createPricedMaterial()
const unrelatedSkuBefore = getMaterialSkuRecordById(unrelatedSku.materialSkuId)
assert.ok(unrelatedSkuBefore)
const unrelatedSkuReviewBefore = getTechnicalDataVersionStoreSnapshot()
assert.ok(updateMaterialSkuRecord(unrelatedSku.materialSkuId, {
  colorName: unrelatedSkuBefore.colorName,
  specName: unrelatedSkuBefore.specName,
  sizeName: unrelatedSkuBefore.sizeName,
  skuImageUrl: unrelatedSkuBefore.skuImageUrl,
  costPrice: unrelatedSkuBefore.costPrice + 1,
  freightCost: unrelatedSkuBefore.freightCost,
  weightKg: unrelatedSkuBefore.weightKg,
  lengthCm: unrelatedSkuBefore.lengthCm,
  widthCm: unrelatedSkuBefore.widthCm,
  heightCm: unrelatedSkuBefore.heightCm,
  barcode: unrelatedSkuBefore.barcode,
}))
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), unrelatedSkuReviewBefore, '未被 BOM 引用的物料变价不得失效技术包审核')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const sameRate = getLatestPcsExchangeRate()
const sameRateReviewBefore = getTechnicalDataVersionStoreSnapshot()
assert.deepEqual(
  updateLatestPcsExchangeRate({ idrPerCny: sameRate.idrPerCny, updatedBy: '系统管理员' }),
  sameRate,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), sameRateReviewBefore, '汇率未变化不得失效技术包审核')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const unrelatedBefore = getTechnicalDataVersionById(technicalVersionId)
updateTechnicalDataVersionContent(technicalVersionId, {
  patternDesc: '普通纸样说明修改',
  patternFiles: [{
    id: 'PATTERN-UNRELATED-001',
    fileName: '普通纸样.dxf',
    fileUrl: '/mock/普通纸样.dxf',
    uploadedAt: '2026-08-02 11:00',
    uploadedBy: '版师B',
    sourceMode: 'MANUAL',
  }],
  patternDesigns: [{
    id: 'ARTWORK-UNRELATED-001',
    name: '普通花型成果',
    designSideType: 'FRONT',
    fileName: '普通花型.png',
  }],
  attachments: [{
    id: 'ATTACHMENT-UNRELATED-001',
    fileName: '普通附件.pdf',
    fileType: 'PDF',
    fileSize: '120KB',
    uploadedAt: '2026-08-02 11:00',
    uploadedBy: '跟单C',
    downloadUrl: '/mock/普通附件.pdf',
  }],
})
assert.deepEqual(
  getTechnicalDataVersionById(technicalVersionId)?.buyerReview,
  unrelatedBefore?.buyerReview,
  '普通纸样、附件或花型内容保存不得误触发 BOM 与价格审核失效',
)

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const failedSaveBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => saveTechnicalDataVersionBomCustomCosts(technicalVersionId, [{ title: '错误费用', amountIdr: Number.NaN }], '买手'),
  /金额/,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), failedSaveBefore, '真实保存失败时内容与审核必须全部零写入')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const dedicatedRollbackBefore = getTechnicalDataVersionStoreSnapshot()
setBomPriceReviewInvalidationFailureForTesting(technicalVersionId)
try {
  assert.throws(
    () => saveTechnicalDataVersionBomMaterialLine(
      technicalVersionId,
      'BOM-001',
      { sampleQuantity: 2 },
      '买手',
    ),
    /模拟 BOM 与价格审核失效写入失败/,
    '打样数量变化触发复审失败时必须回滚专用保存入口',
  )
} finally {
  setBomPriceReviewInvalidationFailureForTesting(null)
}
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), dedicatedRollbackBefore, '专用保存入口复审失败必须回滚内容与审核')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const materialRollbackBefore = getMaterialSkuRecordById(pricedSku.materialSkuId)
const materialRollbackReviewBefore = getTechnicalDataVersionStoreSnapshot()
assert.ok(materialRollbackBefore)
setBomPriceReviewInvalidationFailureForTesting(technicalVersionId)
try {
  assert.throws(
    () => updateMaterialSkuRecord(pricedSku.materialSkuId, {
      colorName: materialRollbackBefore.colorName,
      specName: materialRollbackBefore.specName,
      sizeName: materialRollbackBefore.sizeName,
      skuImageUrl: materialRollbackBefore.skuImageUrl,
      costPrice: materialRollbackBefore.costPrice + 2,
      freightCost: materialRollbackBefore.freightCost,
      weightKg: materialRollbackBefore.weightKg,
      lengthCm: materialRollbackBefore.lengthCm,
      widthCm: materialRollbackBefore.widthCm,
      heightCm: materialRollbackBefore.heightCm,
      barcode: materialRollbackBefore.barcode,
    }),
    /模拟 BOM 与价格审核失效写入失败/,
  )
} finally {
  setBomPriceReviewInvalidationFailureForTesting(null)
}
assert.deepEqual(getMaterialSkuRecordById(pricedSku.materialSkuId), materialRollbackBefore, '审核失效失败必须回滚物料标准单价')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), materialRollbackReviewBefore, '审核失效失败必须回滚技术包仓储')

installApprovedFixture(contentWithBom(pricedSku.materialSkuId))
const rateRollbackBefore = getLatestPcsExchangeRate()
const rateRollbackReviewBefore = getTechnicalDataVersionStoreSnapshot()
setBomPriceReviewInvalidationFailureForTesting(technicalVersionId)
try {
  assert.throws(
    () => updateLatestPcsExchangeRate({ idrPerCny: rateRollbackBefore.idrPerCny + 3, updatedBy: '系统管理员' }),
    /模拟 BOM 与价格审核失效写入失败/,
  )
} finally {
  setBomPriceReviewInvalidationFailureForTesting(null)
}
assert.deepEqual(getLatestPcsExchangeRate(), rateRollbackBefore, '审核失效失败必须回滚系统汇率')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), rateRollbackReviewBefore, '汇率回滚时技术包仓储也必须保持原样')

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
