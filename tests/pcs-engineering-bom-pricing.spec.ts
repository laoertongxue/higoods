import assert from 'node:assert/strict'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import {
  assertEngineeringBomCanSubmitForReview,
  buildEngineeringBomMaterialLine,
  buildTechnicalDataVersionBomDraft,
  calculateEngineeringBomCost,
  freezeTechnicalDataVersionBomPricingSnapshot,
  resolveEngineeringBomDraft,
} from '../src/data/pcs-engineering-bom-pricing.ts'
import { resolveEngineeringBomTechnicalProcessSequence } from '../src/data/pcs-engineering-bom-material-resolver.ts'
import * as bomPricingPublicApi from '../src/data/pcs-engineering-bom-pricing.ts'
import {
  getLatestPcsExchangeRate,
  updateLatestPcsExchangeRate,
} from '../src/data/pcs-exchange-rate-config.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetTechnicalDataVersionRepository()
const technicalVersionStyle = listStyleArchives()[0]
assert.ok(technicalVersionStyle)
const technicalVersionMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: technicalVersionStyle.styleId,
  styleCode: technicalVersionStyle.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单甲',
  createdById: 'USER-M-A', createdBy: '跟单甲', createdByRole: '跟单', preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: technicalVersionStyle.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '正式销售订单', formalProductionSource: '正式生产单', checkedAt: '2026-08-04 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-PRICE', thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00', reason: '已满足做大货要求', uniqueTriggerKey: 'TEST-PRICE' }, creationReason: '跟单核实创建',
}).masterOrderId)
const technicalVersionSourceTaskId = `${technicalVersionMaster.masterOrderId}-TECH_PACK_CONFIRMATION`

function createPricedMaterial(input: {
  costPrice: number
  pricingUnit: string
  usageUnit: string
  factor: number | null
}) {
  const archive = createMaterialArchive({
    kind: 'fabric',
    materialName: `Task7 定价测试面料 ${Date.now()} ${Math.random()}`,
    materialNameEn: 'Task7 pricing material',
    categoryName: '测试面料',
    specSummary: '测试',
    composition: '棉',
    processTags: [],
    widthText: '150cm',
    gramWeightText: '180g',
    pricingUnit: input.pricingUnit,
    mainUnit: input.usageUnit,
    auxiliaryUnits: input.usageUnit === input.pricingUnit ? [] : [input.pricingUnit],
    unitConversions:
      input.factor === null || input.usageUnit === input.pricingUnit
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
    costPrice: input.costPrice,
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

function changeSkuCost(materialSkuId: string, costPrice: number) {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  const updated = updateMaterialSkuRecord(materialSkuId, {
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
  })
  assert.ok(updated)
}

const planned = calculateEngineeringBomCost({
  exchangeRateIdrPerCny: 2200,
  materialLines: [
    {
      materialSkuId: 'MAT-1',
      usage: 1.25,
      sampleQuantity: 1,
      usageUnit: '米',
      pricingUnit: '码',
      conversionToPricingUnit: 1.0936,
      lossRate: 0.05,
      standardUnitPriceCny: 12.3456,
    },
  ],
  customCosts: [{ title: '车位费', amountIdr: 44000 }],
})
assert.equal(planned.materialCostCny, 17.72)
assert.equal(planned.customCostIdr, 44000)
assert.equal(planned.comprehensiveCostCny, 37.72)
assert.equal(planned.comprehensiveCostIdr, 82985)

assert.throws(
  () =>
    calculateEngineeringBomCost({
      exchangeRateIdrPerCny: 2200,
      materialLines: [
        {
          materialSkuId: 'MAT-NO-PRICE',
          usage: 1,
          sampleQuantity: 1,
          usageUnit: '米',
          pricingUnit: '码',
          conversionToPricingUnit: null,
          lossRate: 0,
          standardUnitPriceCny: null,
        },
      ],
      customCosts: [],
    }),
  /该物料暂无标准单价，无法加入。请先维护该物料的标准单价。/,
)

const noPriceSku = createPricedMaterial({ costPrice: 0, pricingUnit: '米', usageUnit: '米', factor: 1 })
assert.throws(
  () =>
    buildEngineeringBomMaterialLine(
      {
        materialSkuId: noPriceSku.materialSkuId,
        usage: 1,
        sampleQuantity: 1,
        usageUnit: '米',
        lossRate: 0,
      },
      '买手',
    ),
  /该物料暂无标准单价，无法加入。请先维护该物料的标准单价。/,
)

const noConversionSku = createPricedMaterial({ costPrice: 10, pricingUnit: '码', usageUnit: '米', factor: null })
assert.throws(
  () =>
    buildEngineeringBomMaterialLine(
      {
        materialSkuId: noConversionSku.materialSkuId,
        usage: 1,
        sampleQuantity: 1,
        usageUnit: '米',
        lossRate: 0,
      },
      '买手',
    ),
  /单位换算/,
)

const pricedSku = createPricedMaterial({ costPrice: 12.3456, pricingUnit: '码', usageUnit: '米', factor: 1.0936 })
assert.throws(
  () =>
    buildEngineeringBomMaterialLine(
      {
        materialSkuId: pricedSku.materialSkuId,
        usage: 1.25,
        sampleQuantity: 2,
        usageUnit: '米',
        lossRate: 0.05,
      },
      '跟单',
    ),
  /只有买手可以维护 BOM 与价格/,
)

const draftLine = buildEngineeringBomMaterialLine(
  {
    materialSkuId: pricedSku.materialSkuId,
    styleCode: 'SPU-PRICING-001',
    productColor: '黑色',
    usage: 1.25,
    sampleQuantity: 2,
    usageUnit: '米',
    lossRate: 0.05,
    applicableSkuIds: ['SPU-PRICING-001-BLACK-S'],
    printRequirement: '是',
    printRequirementText: '需要印花',
    dyeRequirement: '是',
    dyeRequirementText: '需要染色',
    waterSolubleRequirementText: '需要水溶',
    printSide: '双面',
    frontPatternResultId: 'PATTERN-FRONT',
    liningPatternResultId: 'PATTERN-INSIDE',
    linkedPatternResultIds: ['PATTERN-FRONT', 'PATTERN-INSIDE'],
    processCode: 'PROC-PRINT-DYE',
    remark: '工艺要求',
  },
  '买手',
)
assert.equal('standardUnitPriceCny' in draftLine, false, '草稿 BOM 不应保存价格快照')

updateLatestPcsExchangeRate({ idrPerCny: 2200, updatedBy: '系统管理员' })
const firstDraft = resolveEngineeringBomDraft({
  materialLines: [draftLine],
  customCosts: [{
    customCostId: 'COST-SEWING',
    title: '车位费',
    amountIdr: 44000,
    note: '整款费用',
    displayOrder: 1,
    maintainedBy: '买手甲',
    maintainedAt: '2026-08-04 10:00:00',
  }],
})
assert.equal(firstDraft.cost.materialCostCny, 35.44, '单位用量 × 打样数量 × 损耗 × 单位换算应进入成本')
assert.ok(
  Math.abs((firstDraft.materialLines[0]?.totalRequirementQuantity || 0) - 2.8707) < 1e-10,
  '本次总需求量应换算为计价单位数量，且中间计算不提前截断',
)
assert.deepEqual(firstDraft.materialLines[0]?.technicalProcessSequence, ['水溶', '染色'], '水溶和染色同时存在时必须先水溶后染色')
assert.deepEqual(firstDraft.materialLines[0]?.applicableSkuIds, ['SPU-PRICING-001-BLACK-S'])
assert.equal(firstDraft.materialLines[0]?.frontPatternResultId, 'PATTERN-FRONT')
assert.deepEqual(
  resolveEngineeringBomTechnicalProcessSequence({ waterSolubleRequirementText: '否', dyeRequirement: '是' }),
  ['染色'],
  '明确不需要水溶时不能生成水溶工艺',
)
assert.equal(firstDraft.cost.exchangeRateIdrPerCny, 2200)
assert.equal(firstDraft.cost.comprehensiveCostCny, 55.44)
assert.equal(firstDraft.cost.comprehensiveCostIdr, 121969)
assert.equal(firstDraft.customCosts[0]?.currency, 'IDR')
assert.equal(firstDraft.customCosts[0]?.maintainedBy, '买手甲')
assert.equal(firstDraft.customCosts[0]?.note, '整款费用')

changeSkuCost(pricedSku.materialSkuId, 20)
updateLatestPcsExchangeRate({ idrPerCny: 2300, updatedBy: '系统管理员' })
const latestDraft = resolveEngineeringBomDraft({
  materialLines: [draftLine],
  customCosts: [{ title: '车位费', amountIdr: 44000 }],
})
assert.equal(latestDraft.cost.materialCostCny, 57.41, '草稿必须直接读取最新标准单价')
assert.equal(latestDraft.cost.exchangeRateIdrPerCny, 2300, '草稿必须直接读取系统最新汇率')

const snapshot = structuredClone(resolveEngineeringBomDraft({
  materialLines: [draftLine],
  customCosts: [{ title: '车位费', amountIdr: 44000 }],
}))
assert.equal(snapshot.materialLines[0]?.standardUnitPriceCny, 20)
assert.equal(snapshot.cost.exchangeRateIdrPerCny, 2300)
assert.equal(snapshot.customCosts[0]?.currency, 'IDR')
assert.equal(
  'freezeEngineeringBomPricingSnapshot' in bomPricingPublicApi,
  false,
  '公开 API 不得返回缺少 BOM 事实和 bomItemId 的伪正式快照',
)

changeSkuCost(pricedSku.materialSkuId, 30)
updateLatestPcsExchangeRate({ idrPerCny: 2400, updatedBy: '系统管理员' })
assert.equal(snapshot.materialLines[0]?.standardUnitPriceCny, 20, '已解析草稿副本不得随物料档案变化')
assert.equal(snapshot.cost.exchangeRateIdrPerCny, 2300, '已解析草稿副本不得随系统配置变化')
assert.equal(getLatestPcsExchangeRate().idrPerCny, 2400)

changeSkuCost(pricedSku.materialSkuId, 0)
const invalidDraft = resolveEngineeringBomDraft({ materialLines: [draftLine], customCosts: [] })
assert.equal(invalidDraft.materialLines[0]?.priceStatus, '标准单价失效')
assert.throws(() => assertEngineeringBomCanSubmitForReview(invalidDraft, '买手'), /标准单价失效/)
assert.throws(() => assertEngineeringBomCanSubmitForReview(invalidDraft, '跟单'), /只有买手可以维护 BOM 与价格/)

const formalSku = createPricedMaterial({ costPrice: 8.7654, pricingUnit: '米', usageUnit: '米', factor: 1 })
const baseVersion = listTechnicalDataVersions()[0]
assert.ok(baseVersion)
const draftVersionId = `tdv_task7_draft_${Date.now()}`
createTechnicalDataVersionDraft(
  {
    ...baseVersion,
    technicalVersionId: draftVersionId,
    technicalVersionCode: `TP-TASK7-DRAFT-${Date.now()}`,
    styleId: technicalVersionStyle.styleId,
    styleCode: technicalVersionStyle.styleCode,
    sourceProjectId: technicalVersionMaster.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: technicalVersionSourceTaskId,
    versionStatus: 'DRAFT',
    reviewStage: '草稿',
    publishedAt: '',
    publishedBy: '',
  },
  {
    technicalVersionId: draftVersionId,
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
  },
)
assert.throws(
  () => freezeTechnicalDataVersionBomPricingSnapshot(draftVersionId, '2026-08-01 11:01', '跟单甲'),
  /审核发布/,
  '草稿技术包不得形成正式 BOM 成本快照',
)
const formalVersionId = `tdv_task7_${Date.now()}`
createTechnicalDataVersionDraft(
  {
    ...baseVersion,
    technicalVersionId: formalVersionId,
    technicalVersionCode: `TP-TASK7-${Date.now()}`,
    styleId: technicalVersionStyle.styleId,
    styleCode: technicalVersionStyle.styleCode,
    sourceProjectId: technicalVersionMaster.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: technicalVersionSourceTaskId,
    versionStatus: 'PUBLISHED',
    reviewStage: '已发布',
    publishedAt: '2026-08-01 11:00',
    publishedBy: '跟单甲',
  },
  {
    technicalVersionId: formalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    sizeTable: [],
    bomItems: [
      {
        id: 'BOM-TASK7-1',
        type: '面料',
        name: formalSku.materialName,
        spec: '黑色',
        materialCode: formalSku.materialCode,
        materialSkuId: formalSku.materialSkuId,
        unit: '米',
        unitConsumption: 1.5,
        sampleQuantity: 1,
        lossRate: 0.02,
        supplier: '测试供应商',
        colorLabel: '黑色',
        applicableSkuCodes: ['SKU-BLACK-S', 'SKU-BLACK-M'],
        printRequirement: '需要印花',
        dyeRequirement: '需要染色',
        waterSolubleRequirement: '是',
        printSideMode: 'REVERSE',
        frontPatternDesignId: '',
        insidePatternDesignId: 'PATTERN-INSIDE-1',
        linkedPatternIds: ['PATTERN-INSIDE-1'],
        usageProcessCodes: ['PROC-PRINT-DYE'],
        remark: '先水溶后染色',
      },
    ],
    bomCustomCosts: [{ title: '车位费', amountIdr: 12000 }],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  },
)
updateLatestPcsExchangeRate({ idrPerCny: 2250, updatedBy: '系统管理员' })
freezeTechnicalDataVersionBomPricingSnapshot(formalVersionId, '2026-08-01 11:05', '跟单甲')
const activatedContent = getTechnicalDataVersionContent(formalVersionId)
assert.ok(activatedContent?.bomPricingSnapshot, '技术包正式生效时必须形成 BOM 价格与汇率快照')
assert.equal(activatedContent.bomPricingSnapshot.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(activatedContent.bomPricingSnapshot.exchangeRateIdrPerCny, 2250)
const mappedFormalDraft = buildTechnicalDataVersionBomDraft(formalVersionId)
assert.ok(mappedFormalDraft)
assert.equal(mappedFormalDraft.productColor, '黑色')
assert.deepEqual(mappedFormalDraft.applicableSkuIds, ['SKU-BLACK-S', 'SKU-BLACK-M'])
assert.equal(mappedFormalDraft.materialLines[0]?.printSide, '反面')
assert.equal(mappedFormalDraft.materialLines[0]?.frontPatternResultId, '')
assert.equal(mappedFormalDraft.materialLines[0]?.liningPatternResultId, activatedContent.bomItems[0]?.insidePatternDesignId)
assert.equal(mappedFormalDraft.materialLines[0]?.processCode, 'PROC-PRINT-DYE')
assert.ok(mappedFormalDraft.materialLines[0]?.linkedPatternResultIds?.includes(activatedContent.bomItems[0]?.insidePatternDesignId || ''))
changeSkuCost(formalSku.materialSkuId, 9.9999)
updateLatestPcsExchangeRate({ idrPerCny: 2500, updatedBy: '系统管理员' })
const frozenContent = getTechnicalDataVersionContent(formalVersionId)
assert.equal(frozenContent?.bomPricingSnapshot?.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(frozenContent?.bomPricingSnapshot?.exchangeRateIdrPerCny, 2250)

console.log('PCS engineering BOM pricing checks passed')
