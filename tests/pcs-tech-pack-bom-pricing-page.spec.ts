import assert from 'node:assert/strict'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import {
  MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE,
  getTechnicalDataVersionBomWorkspace,
  saveTechnicalDataVersionBomCustomCosts,
  saveTechnicalDataVersionBomMaterialLine,
} from '../src/data/pcs-engineering-bom-pricing.ts'
import { updateLatestPcsExchangeRate } from '../src/data/pcs-exchange-rate-config.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type { TechnicalBomItem, TechnicalDataVersionContent } from '../src/data/pcs-technical-data-version-types.ts'
import { renderBomPricingWorkspace } from '../src/pages/tech-pack/cost-domain.ts'

function createMaterial(input: { price: number; pricingUnit: string; usageUnit: string; factor?: number }) {
  const archive = createMaterialArchive({
    kind: 'fabric',
    materialName: `BOM 与价格页面测试面料 ${Date.now()} ${Math.random()}`,
    materialNameEn: 'BOM pricing page material',
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
      input.pricingUnit === input.usageUnit || input.factor === undefined
        ? []
        : [{ fromUnit: input.usageUnit, toUnit: input.pricingUnit, factor: input.factor }],
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  })
  const sku = createMaterialSkuRecord(archive.materialId, {
    colorName: '黑色',
    specName: '标准',
    sizeName: '-',
    skuImageUrl: '',
    costPrice: input.price,
    freightCost: 999,
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    barcode: '',
  })
  assert.ok(sku)
  return sku
}

const pricedSku = createMaterial({ price: 12.3456, pricingUnit: '码', usageUnit: '米', factor: 1.0936 })
const base = listTechnicalDataVersions()[0]
assert.ok(base)
const versionId = `task7_page_${Date.now()}`
const bomItems: TechnicalBomItem[] = Array.from({ length: 6 }, (_, index) => ({
  id: `BOM-PAGE-${index + 1}`,
  type: '面料',
  name: pricedSku.materialName,
  spec: `测试-${index + 1}`,
  materialCode: pricedSku.materialCode,
  materialSkuId: pricedSku.materialSkuId,
  unit: '米',
  unitConsumption: 1,
  sampleQuantity: 1,
  lossRate: 0,
  supplier: '测试供应商',
}))
const content: TechnicalDataVersionContent = {
  technicalVersionId: versionId,
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems,
  bomCustomCosts: [],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {},
}
createTechnicalDataVersionDraft(
  {
    ...base,
    technicalVersionId: versionId,
    technicalVersionCode: `TP-${versionId}`,
    versionStatus: 'DRAFT',
    reviewStage: '未提交审核',
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    publishedAt: '',
    publishedBy: '',
  },
  content,
)
updateLatestPcsExchangeRate({ idrPerCny: 2250, updatedBy: '系统管理员' })

assert.throws(
  () => saveTechnicalDataVersionBomMaterialLine(versionId, 'BOM-PAGE-1', {
    usage: 1.25,
    sampleQuantity: 2,
    usageUnit: '米',
    lossRate: 0.05,
  }, '跟单'),
  /只有买手可以维护 BOM 与价格/,
  '非买手不能绕过页面直接修改 BOM',
)
saveTechnicalDataVersionBomMaterialLine(versionId, 'BOM-PAGE-1', {
  usage: 1.25,
  sampleQuantity: 2,
  usageUnit: '米',
  lossRate: 0.05,
}, '买手')
saveTechnicalDataVersionBomCustomCosts(versionId, [{ title: '车位费', amountIdr: 44000 }], '买手')
assert.throws(
  () => saveTechnicalDataVersionBomCustomCosts(versionId, [{ title: '错误费用', amountIdr: 1 }], '版师'),
  /只有买手可以维护 BOM 与价格/,
)

const saved = getTechnicalDataVersionContent(versionId)
assert.equal(saved?.bomItems[0]?.unitConsumption, 1.25)
assert.equal(saved?.bomItems[0]?.sampleQuantity, 2)
assert.equal(saved?.bomItems[0]?.lossRate, 0.05)
assert.deepEqual(saved?.bomCustomCosts, [{ title: '车位费', amountIdr: 44000 }])

const workspace = getTechnicalDataVersionBomWorkspace(versionId)
assert.equal(workspace.cost.exchangeRateIdrPerCny, 2250)
assert.equal(workspace.customCosts[0]?.currency, 'IDR')
assert.equal(workspace.materialLines[0]?.standardUnitPriceCny, 12.3456)
assert.equal(workspace.materialLines[0]?.conversionToPricingUnit, 1.0936)
assert.equal(workspace.materialLines[0]?.usage, 1.25)
assert.equal(workspace.materialLines[0]?.sampleQuantity, 2)

const firstPage = renderBomPricingWorkspace({ workspace, editable: true, materialPage: 1, customCostPage: 1, pageSize: 5 })
assert.match(firstPage, /BOM 与价格/)
assert.match(firstPage, /标准单价（CNY）/)
assert.match(firstPage, /12\.3456/)
assert.doesNotMatch(firstPage, /data-tech-field="material-price"/)
assert.doesNotMatch(firstPage, /data-tech-field="material-currency"/)
assert.doesNotMatch(firstPage, /freightCost|运费成本/)
assert.match(firstPage, /data-tech-field="bom-pricing-usage"/)
assert.match(firstPage, /data-skip-input-rerender="true"/)
assert.match(firstPage, /第 1 页 \/ 共 2 页/)
assert.match(firstPage, /人民币\/印尼盾汇率/)
assert.match(firstPage, /自定义费用（IDR）/)
assert.doesNotMatch(firstPage, /custom-cost-currency|custom-cost-unit/)

const readonlyPage = renderBomPricingWorkspace({ workspace, editable: false, materialPage: 1, customCostPage: 1, pageSize: 5 })
assert.doesNotMatch(readonlyPage, /data-tech-field="bom-pricing-usage"/)
assert.doesNotMatch(readonlyPage, /data-tech-action="add-bom-custom-cost"/)

const skuBeforeInvalidation = getMaterialSkuRecordById(pricedSku.materialSkuId)
assert.ok(skuBeforeInvalidation)
assert.ok(updateMaterialSkuRecord(pricedSku.materialSkuId, {
  colorName: skuBeforeInvalidation.colorName,
  specName: skuBeforeInvalidation.specName,
  sizeName: skuBeforeInvalidation.sizeName,
  skuImageUrl: skuBeforeInvalidation.skuImageUrl,
  costPrice: 0,
  freightCost: skuBeforeInvalidation.freightCost,
  weightKg: skuBeforeInvalidation.weightKg,
  lengthCm: skuBeforeInvalidation.lengthCm,
  widthCm: skuBeforeInvalidation.widthCm,
  heightCm: skuBeforeInvalidation.heightCm,
  barcode: skuBeforeInvalidation.barcode,
}))
const invalidWorkspace = getTechnicalDataVersionBomWorkspace(versionId)
assert.equal(invalidWorkspace.materialLines[0]?.priceStatus, '标准单价失效')
assert.match(renderBomPricingWorkspace({ workspace: invalidWorkspace, editable: true }), /标准单价失效/)

const noPriceSku = createMaterial({ price: 0, pricingUnit: '米', usageUnit: '米' })
assert.throws(
  () => saveTechnicalDataVersionBomMaterialLine(versionId, 'BOM-PAGE-1', {
    materialSkuId: noPriceSku.materialSkuId,
    usage: 1,
    sampleQuantity: 1,
    usageUnit: '米',
    lossRate: 0,
  }, '买手'),
  (error: unknown) => error instanceof Error && error.message === MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE,
)

const noConversionSku = createMaterial({ price: 10, pricingUnit: '码', usageUnit: '米' })
assert.throws(
  () => saveTechnicalDataVersionBomMaterialLine(versionId, 'BOM-PAGE-1', {
    materialSkuId: noConversionSku.materialSkuId,
    usage: 1,
    sampleQuantity: 1,
    usageUnit: '米',
    lossRate: 0,
  }, '买手'),
  /单位换算/,
)

console.log('PCS tech-pack BOM pricing page checks passed')
