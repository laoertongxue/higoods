import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import {
  MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE,
  getTechnicalDataVersionBomWorkspace,
  resolveEngineeringBomDraft,
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
import {
  refreshBomPricingWorkspaceLocally,
  renderBomPricingWorkspace,
} from '../src/pages/tech-pack/cost-domain.ts'

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

const firstPage = renderBomPricingWorkspace({
  workspace,
  editable: true,
  materialPage: 1,
  customCostPage: 1,
  pageSize: 5,
  bomItemIds: bomItems.map((item) => item.id),
})
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
assert.match(firstPage, /data-bom-pricing-row-cost="BOM-PAGE-1"/, '物料行小计必须有稳定的局部刷新目标')
assert.match(firstPage, /data-bom-pricing-summary="material-cost-cny"/, '物料成本摘要必须可局部刷新')
assert.match(firstPage, /data-bom-pricing-summary="comprehensive-cost-cny"/, '综合人民币成本必须可局部刷新')
assert.match(firstPage, /data-bom-pricing-summary="comprehensive-cost-idr"/, '综合印尼盾成本必须可局部刷新')
assert.match(firstPage, /data-bom-pricing-summary="exchange-rate"/, '汇率必须在同一局部刷新路径更新')

type FakeRefreshNode = {
  dataset: Record<string, string>
  textContent: string
  className: string
}
const rowCostNode: FakeRefreshNode = { dataset: { bomPricingRowCost: 'BOM-PAGE-1' }, textContent: '旧行小计', className: '' }
const rowStatusNode: FakeRefreshNode = { dataset: { bomPricingRowStatus: 'BOM-PAGE-1' }, textContent: '旧状态', className: '' }
const summaryNodes = [
  'material-cost-cny',
  'custom-cost-idr',
  'exchange-rate',
  'comprehensive-cost-cny',
  'comprehensive-cost-idr',
].map((key): FakeRefreshNode => ({ dataset: { bomPricingSummary: key }, textContent: `旧-${key}`, className: '' }))
let rootInnerHtmlWrites = 0
const focusedInput = { id: '正在编辑的单位用量输入框' }
const fakeRoot = {
  activeInput: focusedInput,
  get innerHTML() { return '不可替换的工作区' },
  set innerHTML(_value: string) { rootInnerHtmlWrites += 1 },
  querySelectorAll(selector: string) {
    if (selector === '[data-bom-pricing-row-cost]') return [rowCostNode]
    if (selector === '[data-bom-pricing-row-status]') return [rowStatusNode]
    if (selector === '[data-bom-pricing-summary]') return summaryNodes
    return []
  },
}

const usageUpdatedWorkspace = saveTechnicalDataVersionBomMaterialLine(versionId, 'BOM-PAGE-1', {
  usage: 2,
  sampleQuantity: 3,
  usageUnit: '米',
  lossRate: 0.1,
}, '买手')
refreshBomPricingWorkspaceLocally({
  root: fakeRoot as unknown as ParentNode,
  workspace: usageUpdatedWorkspace,
  technicalVersionId: versionId,
})
assert.equal(rowCostNode.textContent, `¥ ${usageUpdatedWorkspace.materialLines[0]?.materialCostCny?.toFixed(2)}`)
assert.equal(summaryNodes[0]?.textContent, `¥ ${usageUpdatedWorkspace.cost.materialCostCny.toFixed(2)}`)
assert.equal(summaryNodes[3]?.textContent, `¥ ${usageUpdatedWorkspace.cost.comprehensiveCostCny.toFixed(2)}`)
assert.equal(summaryNodes[4]?.textContent, `Rp ${Math.round(usageUpdatedWorkspace.cost.comprehensiveCostIdr).toLocaleString('id-ID')}`)
assert.equal(rootInnerHtmlWrites, 0, '局部刷新不得替换工作区 innerHTML')
assert.equal(fakeRoot.activeInput, focusedInput, '局部刷新必须保留当前输入焦点节点')

const customCostUpdatedWorkspace = saveTechnicalDataVersionBomCustomCosts(
  versionId,
  [{ title: '车位费', amountIdr: 90000 }],
  '买手',
)
refreshBomPricingWorkspaceLocally({
  root: fakeRoot as unknown as ParentNode,
  workspace: customCostUpdatedWorkspace,
  technicalVersionId: versionId,
})
assert.equal(summaryNodes[1]?.textContent, 'Rp 90.000')
assert.equal(summaryNodes[3]?.textContent, `¥ ${customCostUpdatedWorkspace.cost.comprehensiveCostCny.toFixed(2)}`)
assert.equal(summaryNodes[4]?.textContent, `Rp ${Math.round(customCostUpdatedWorkspace.cost.comprehensiveCostIdr).toLocaleString('id-ID')}`)
assert.equal(summaryNodes[2]?.textContent, '1 CNY = 2.250 IDR')
assert.equal(rootInnerHtmlWrites, 0)

const eventSource = readFileSync(new URL('../src/pages/tech-pack/events.ts', import.meta.url), 'utf8')
assert.match(
  eventSource,
  /const workspace = saveTechnicalDataVersionBomMaterialLine[\s\S]{0,1200}refreshBomPricingWorkspaceLocally\(\{ root: workspaceRoot, workspace, technicalVersionId \}\)/,
  'BOM 物料保存成功后必须立即调用局部刷新',
)
assert.match(
  eventSource,
  /const workspace = saveTechnicalDataVersionBomCustomCosts[\s\S]{0,800}refreshBomPricingWorkspaceLocally\(\{ root: workspaceRoot, workspace, technicalVersionId \}\)/,
  '自定义费用保存成功后必须立即调用局部刷新',
)

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

const invalidPriceWithoutConversionSku = createMaterial({ price: 0, pricingUnit: '码', usageUnit: '米' })
const invalidPriceWithoutConversion = resolveEngineeringBomDraft({
  materialLines: [{
    materialSkuId: invalidPriceWithoutConversionSku.materialSkuId,
    usage: 1,
    sampleQuantity: 1,
    usageUnit: '米',
    lossRate: 0,
  }],
  customCosts: [],
})
assert.equal(invalidPriceWithoutConversion.materialLines[0]?.priceStatus, '标准单价失效')
assert.equal(invalidPriceWithoutConversion.materialLines[0]?.materialCostCny, null)

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
