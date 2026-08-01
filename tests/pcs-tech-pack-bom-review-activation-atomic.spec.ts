import assert from 'node:assert/strict'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import { updateLatestPcsExchangeRate } from '../src/data/pcs-exchange-rate-config.ts'
import { submitTechPackFirstStageReview } from '../src/data/pcs-tech-pack-review.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import {
  getStyleArchiveById,
  listStyleArchives,
} from '../src/data/pcs-style-archive-repository.ts'
import { listTechPackVersionLogsByVersionId } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalBomItem,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

function createMaterial(input: {
  costPrice: number
  pricingUnit: string
  usageUnit: string
  conversionFactor?: number
}) {
  const archive = createMaterialArchive({
    kind: 'fabric',
    materialName: `审核启用原子性面料 ${Date.now()} ${Math.random()}`,
    materialNameEn: 'Atomic activation material',
    categoryName: '测试面料',
    specSummary: '测试',
    composition: '棉',
    processTags: [],
    widthText: '150cm',
    gramWeightText: '180g',
    pricingUnit: input.pricingUnit,
    mainUnit: input.usageUnit,
    auxiliaryUnits: input.pricingUnit === input.usageUnit ? [] : [input.pricingUnit],
    unitConversions:
      input.pricingUnit === input.usageUnit || input.conversionFactor === undefined
        ? []
        : [{ fromUnit: input.usageUnit, toUnit: input.pricingUnit, factor: input.conversionFactor }],
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  })
  const sku = createMaterialSkuRecord(archive.materialId, {
    colorName: '黑色',
    specName: '标准',
    sizeName: '-',
    skuImageUrl: '',
    costPrice: input.costPrice,
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

function changePrice(materialSkuId: string, costPrice: number): void {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  assert.ok(updateMaterialSkuRecord(materialSkuId, {
    colorName: sku.colorName,
    specName: sku.specName,
    sizeName: sku.sizeName,
    skuImageUrl: sku.skuImageUrl,
    costPrice,
    freightCost: sku.freightCost,
    weightKg: sku.weightKg,
    lengthCm: sku.lengthCm,
    widthCm: sku.widthCm,
    heightCm: sku.heightCm,
    barcode: sku.barcode,
  }))
}

const baseRecord = listTechnicalDataVersions()[0]
const style = listStyleArchives().find((item) => item.sourceProjectId) ?? listStyleArchives()[0]
assert.ok(baseRecord)
assert.ok(style)

function makeRecord(input: {
  id: string
  status: TechnicalDataVersionRecord['versionStatus']
  reviewStage: TechnicalDataVersionRecord['reviewStage']
}): TechnicalDataVersionRecord {
  return {
    ...baseRecord,
    technicalVersionId: input.id,
    technicalVersionCode: `TP-${input.id}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    versionStatus: input.status,
    reviewStage: input.reviewStage,
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    reviewSubmittedAt: '',
    reviewSubmittedBy: '',
    returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [],
    publishedAt: input.status === 'PUBLISHED' ? '2026-08-01 10:00' : '',
    publishedBy: input.status === 'PUBLISHED' ? '跟单甲' : '',
    missingItemCodes: [],
    missingItemNames: [],
    updatedAt: '2026-08-01 10:00',
    updatedBy: '测试用户',
  }
}

function makeBomItem(id: string, materialSkuId: string, usageUnit: string): TechnicalBomItem {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  return {
    id,
    type: '面料',
    name: sku.materialName,
    spec: sku.specName,
    materialCode: sku.materialCode,
    materialSkuId,
    unit: usageUnit,
    unitConsumption: 1,
    sampleQuantity: 1,
    lossRate: 0,
    supplier: '测试供应商',
  }
}

function makeContent(technicalVersionId: string, bomItems: TechnicalBomItem[]): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    processRouteStatus: 'CONFIRMED',
    processRouteConfirmedBy: '跟单甲',
    processRouteConfirmedAt: '2026-08-01 09:50',
    processRouteUpdatedBy: '跟单甲',
    processRouteUpdatedAt: '2026-08-01 09:50',
    processRouteChangeReason: '',
    sizeTable: [],
    bomItems,
    bomCustomCosts: [{ title: '车位费', amountIdr: 15000 }],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

// 首次提交审核必须实时校验物料标准价，并在失败时保持审核状态、日志和内容原子不变。
const invalidPriceSku = createMaterial({ costPrice: 0, pricingUnit: '米', usageUnit: '米' })
const reviewVersionId = `task7_review_guard_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: reviewVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
  makeContent(reviewVersionId, [makeBomItem('BOM-REVIEW-1', invalidPriceSku.materialSkuId, '米')]),
)
const reviewRecordBefore = getTechnicalDataVersionById(reviewVersionId)
const reviewContentBefore = getTechnicalDataVersionContent(reviewVersionId)
const reviewLogsBefore = listTechPackVersionLogsByVersionId(reviewVersionId)
assert.throws(
  () => submitTechPackFirstStageReview(reviewVersionId, '买手甲'),
  /标准单价|暂无标准单价/,
)
assert.deepEqual(getTechnicalDataVersionById(reviewVersionId), reviewRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(reviewVersionId), reviewContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(reviewVersionId), reviewLogsBefore)

// 正式启用必须先完整构建快照；后续行缺换算时，款式指针、内容快照和启用日志均不得变化。
const validSku = createMaterial({ costPrice: 8.7654, pricingUnit: '米', usageUnit: '米' })
const missingConversionSku = createMaterial({ costPrice: 12.3456, pricingUnit: '码', usageUnit: '米' })
const conversionReviewVersionId = `task7_review_conversion_guard_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: conversionReviewVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
  makeContent(conversionReviewVersionId, [
    makeBomItem('BOM-REVIEW-CONVERSION-1', missingConversionSku.materialSkuId, '米'),
  ]),
)
const conversionReviewRecordBefore = getTechnicalDataVersionById(conversionReviewVersionId)
const conversionReviewContentBefore = getTechnicalDataVersionContent(conversionReviewVersionId)
const conversionReviewLogsBefore = listTechPackVersionLogsByVersionId(conversionReviewVersionId)
assert.throws(
  () => submitTechPackFirstStageReview(conversionReviewVersionId, '买手甲'),
  /单位换算/,
)
assert.deepEqual(getTechnicalDataVersionById(conversionReviewVersionId), conversionReviewRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(conversionReviewVersionId), conversionReviewContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(conversionReviewVersionId), conversionReviewLogsBefore)

const invalidActivationVersionId = `task7_activation_invalid_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: invalidActivationVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(invalidActivationVersionId, [
    makeBomItem('BOM-ACT-1', validSku.materialSkuId, '米'),
    makeBomItem('BOM-ACT-2', missingConversionSku.materialSkuId, '米'),
  ]),
)
const styleBefore = getStyleArchiveById(style.styleId)
const invalidActivationRecordBefore = getTechnicalDataVersionById(invalidActivationVersionId)
const invalidContentBefore = getTechnicalDataVersionContent(invalidActivationVersionId)
const invalidLogsBefore = listTechPackVersionLogsByVersionId(invalidActivationVersionId)
assert.throws(
  () => activateTechPackVersionForStyle(style.styleId, invalidActivationVersionId, '跟单甲'),
  /单位换算/,
)
assert.deepEqual(getStyleArchiveById(style.styleId), styleBefore)
assert.deepEqual(getTechnicalDataVersionById(invalidActivationVersionId), invalidActivationRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(invalidActivationVersionId), invalidContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(invalidActivationVersionId), invalidLogsBefore)

// 成功启用只冻结一次当时的标准价和汇率；之后档案及系统汇率变化不影响正式快照。
const successVersionId = `task7_activation_success_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: successVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(successVersionId, [makeBomItem('BOM-ACT-OK-1', validSku.materialSkuId, '米')]),
)
updateLatestPcsExchangeRate({ idrPerCny: 2250, updatedBy: '系统管理员' })
activateTechPackVersionForStyle(style.styleId, successVersionId, '跟单甲')
const successContent = getTechnicalDataVersionContent(successVersionId)
assert.equal(successContent?.bomPricingSnapshot?.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(successContent?.bomPricingSnapshot?.exchangeRateIdrPerCny, 2250)
assert.equal(getStyleArchiveById(style.styleId)?.currentTechPackVersionId, successVersionId)

changePrice(validSku.materialSkuId, 19.9999)
updateLatestPcsExchangeRate({ idrPerCny: 2500, updatedBy: '系统管理员' })
const frozenContent = getTechnicalDataVersionContent(successVersionId)
assert.equal(frozenContent?.bomPricingSnapshot?.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(frozenContent?.bomPricingSnapshot?.exchangeRateIdrPerCny, 2250)

console.log('pcs-tech-pack-bom-review-activation-atomic.spec.ts PASS')
