import { getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import { getLatestPcsExchangeRate } from './pcs-exchange-rate-config.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  freezePublishedTechnicalDataVersionBomPricingSnapshot,
  runTechnicalDataVersionRepositoryTransaction,
  updateTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository.ts'
import {
  invalidateReviewForBomPriceChange,
  type BomPriceReviewChange,
} from './pcs-tech-pack-bom-price-review-invalidation.ts'
import type { TechnicalDataVersionContent } from './pcs-technical-data-version-types.ts'
import type {
  EngineeringBomCostResult,
  EngineeringBomDraft,
  EngineeringBomMaterialLineDraft,
  EngineeringBomOperatorRole,
  EngineeringBomPricingSnapshot,
  EngineeringBomResolvedDraft,
  EngineeringBomResolvedMaterialLine,
} from './pcs-engineering-bom-types.ts'
import { assertEngineeringBomPricingSnapshotValid } from './pcs-engineering-bom-snapshot-validation.ts'
import {
  MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE,
  resolveEngineeringBomConversion,
  resolveEngineeringBomMaterialLine,
} from './pcs-engineering-bom-material-resolver.ts'
export { assertEngineeringBomPricingSnapshotValid } from './pcs-engineering-bom-snapshot-validation.ts'
export { MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE } from './pcs-engineering-bom-material-resolver.ts'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundIdr(value: number): number {
  return Math.round(value)
}

function assertPositiveNumber(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须大于 0。`)
}

function assertLossRate(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('损耗率必须在 0（含）到 1（不含）之间。')
}

function requireBuyer(role: EngineeringBomOperatorRole): void {
  if (role !== '买手') throw new Error('只有买手可以维护 BOM 与价格。')
}

function requireEditableTechnicalVersion(technicalVersionId: string): void {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.versionStatus !== 'DRAFT') throw new Error('已发布的正式版本技术包不能编辑。')
}

function getBomMaterialIdentity(item: TechnicalDataVersionContent['bomItems'][number]): string {
  return item.materialSkuId?.trim() || item.materialCode?.trim() || item.id
}

export function compareBomPriceChanges(
  beforeContent: Pick<TechnicalDataVersionContent, 'bomItems' | 'bomCustomCosts'>,
  afterContent: Pick<TechnicalDataVersionContent, 'bomItems' | 'bomCustomCosts'>,
): BomPriceReviewChange[] {
  const changes: BomPriceReviewChange[] = []
  const beforeItems = new Map(beforeContent.bomItems.map((item) => [item.id, item]))
  const afterItems = new Map(afterContent.bomItems.map((item) => [item.id, item]))
  const itemIds = new Set([...beforeItems.keys(), ...afterItems.keys()])

  itemIds.forEach((bomItemId) => {
    const before = beforeItems.get(bomItemId)
    const after = afterItems.get(bomItemId)
    const beforeIdentity = before ? getBomMaterialIdentity(before) : ''
    const afterIdentity = after ? getBomMaterialIdentity(after) : ''
    if (beforeIdentity !== afterIdentity) {
      changes.push({
        changeSource: 'MATERIAL_SKU_CHANGE',
        targetId: bomItemId,
        beforeValue: beforeIdentity,
        afterValue: afterIdentity,
      })
    }
    if (!before || !after) return
    if (before.unitConsumption !== after.unitConsumption) {
      changes.push({
        changeSource: 'BOM_UNIT_CONSUMPTION',
        targetId: bomItemId,
        beforeValue: before.unitConsumption,
        afterValue: after.unitConsumption,
      })
    }
    if (before.lossRate !== after.lossRate) {
      changes.push({
        changeSource: 'BOM_LOSS_RATE',
        targetId: bomItemId,
        beforeValue: before.lossRate,
        afterValue: after.lossRate,
      })
    }
    const beforeSampleQuantity = before.sampleQuantity ?? 1
    const afterSampleQuantity = after.sampleQuantity ?? 1
    if (beforeSampleQuantity !== afterSampleQuantity) {
      changes.push({
        changeSource: 'BOM_SAMPLE_QUANTITY',
        targetId: bomItemId,
        beforeValue: beforeSampleQuantity,
        afterValue: afterSampleQuantity,
      })
    }
    const beforeUsageUnit = (before.unit ?? '').trim()
    const afterUsageUnit = (after.unit ?? '').trim()
    if (beforeUsageUnit !== afterUsageUnit) {
      changes.push({
        changeSource: 'BOM_USAGE_UNIT',
        targetId: bomItemId,
        beforeValue: beforeUsageUnit,
        afterValue: afterUsageUnit,
      })
    }
  })

  const beforeCustomCostIdr = (beforeContent.bomCustomCosts ?? []).reduce((sum, item) => sum + item.amountIdr, 0)
  const afterCustomCostIdr = (afterContent.bomCustomCosts ?? []).reduce((sum, item) => sum + item.amountIdr, 0)
  if (beforeCustomCostIdr !== afterCustomCostIdr) {
    changes.push({
      changeSource: 'CUSTOM_COST_IDR',
      targetId: 'BOM-CUSTOM-COST',
      beforeValue: beforeCustomCostIdr,
      afterValue: afterCustomCostIdr,
    })
  }
  return changes
}

export function buildEngineeringBomMaterialLine(
  input: EngineeringBomMaterialLineDraft,
  role: EngineeringBomOperatorRole,
): EngineeringBomMaterialLineDraft {
  requireBuyer(role)
  assertPositiveNumber(input.usage, '单位用量')
  assertPositiveNumber(input.sampleQuantity, '打样数量')
  assertLossRate(input.lossRate)
  const sku = getMaterialSkuRecordById(input.materialSkuId)
  if (!sku || sku.status !== 'ACTIVE') throw new Error('未找到可用的物料 SKU，无法加入 BOM。')
  if (!Number.isFinite(sku.costPrice) || sku.costPrice <= 0) throw new Error(MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE)
  resolveEngineeringBomConversion(sku.materialSkuId, input.usageUnit, sku.pricingUnit)
  return {
    materialSkuId: sku.materialSkuId,
    usage: input.usage,
    sampleQuantity: input.sampleQuantity,
    usageUnit: input.usageUnit.trim(),
    lossRate: input.lossRate,
  }
}

export function calculateEngineeringBomCost(input: {
  exchangeRateIdrPerCny: number
  materialLines: Array<{
    materialSkuId: string
    usage: number
    sampleQuantity?: number
    usageUnit: string
    pricingUnit: string
    conversionToPricingUnit: number | null
    lossRate: number
    standardUnitPriceCny: number | null
  }>
  customCosts: Array<{ title: string; amountIdr: number }>
}): EngineeringBomCostResult {
  assertPositiveNumber(input.exchangeRateIdrPerCny, '汇率')
  let rawMaterialCostCny = 0
  for (const line of input.materialLines) {
    if (!Number.isFinite(line.standardUnitPriceCny) || Number(line.standardUnitPriceCny) <= 0) {
      throw new Error(MATERIAL_STANDARD_PRICE_REQUIRED_MESSAGE)
    }
    if (!Number.isFinite(line.conversionToPricingUnit) || Number(line.conversionToPricingUnit) <= 0) {
      throw new Error('缺少所需单位换算关系，无法计算 BOM 成本。')
    }
    assertPositiveNumber(line.usage, '单位用量')
    assertPositiveNumber(line.sampleQuantity ?? 1, '打样数量')
    assertLossRate(line.lossRate)
    rawMaterialCostCny +=
      line.usage *
      (line.sampleQuantity ?? 1) *
      (1 + line.lossRate) *
      Number(line.conversionToPricingUnit) *
      Number(line.standardUnitPriceCny)
  }
  const customCostIdr = input.customCosts.reduce((total, item) => {
    if (!item.title.trim()) throw new Error('自定义成本项名称不能为空。')
    if (!Number.isFinite(item.amountIdr) || item.amountIdr < 0) throw new Error('自定义成本项金额不能小于 0。')
    return total + item.amountIdr
  }, 0)
  return {
    materialCostCny: roundCny(rawMaterialCostCny),
    customCostIdr: roundIdr(customCostIdr),
    comprehensiveCostCny: roundCny(rawMaterialCostCny + customCostIdr / input.exchangeRateIdrPerCny),
    comprehensiveCostIdr: roundIdr(rawMaterialCostCny * input.exchangeRateIdrPerCny + customCostIdr),
    exchangeRateIdrPerCny: input.exchangeRateIdrPerCny,
  }
}

export function resolveEngineeringBomDraft(draft: EngineeringBomDraft): EngineeringBomResolvedDraft {
  const materialLines = draft.materialLines.map(resolveEngineeringBomMaterialLine)
  const validLines = materialLines.filter(
    (line): line is EngineeringBomResolvedMaterialLine & { standardUnitPriceCny: number } => line.standardUnitPriceCny !== null,
  )
  const rate = getLatestPcsExchangeRate()
  const cost = calculateEngineeringBomCost({
    exchangeRateIdrPerCny: rate.idrPerCny,
    materialLines: validLines,
    customCosts: draft.customCosts,
  })
  return {
    materialLines,
    customCosts: draft.customCosts.map((item) => ({ ...item, currency: 'IDR' })),
    cost,
  }
}

export function assertEngineeringBomCanSubmitForReview(
  draft: EngineeringBomResolvedDraft,
  role: EngineeringBomOperatorRole,
): void {
  requireBuyer(role)
  const invalid = draft.materialLines.find((item) => item.priceStatus === '标准单价失效')
  if (invalid) throw new Error(`物料 ${invalid.materialSkuCode} 标准单价失效，不能提交技术包审核。`)
}

export function buildTechnicalDataVersionBomDraft(
  technicalVersionId: string,
): EngineeringBomDraft | null {
  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!content) throw new Error('未找到技术包版本内容，无法校验 BOM 与价格。')

  // 既有技术包没有物料 SKU 定价字段，继续沿用原审核和启用策略。
  // 一旦任一行进入新 BOM 定价模型，则所有行都必须具备可追溯的物料 SKU。
  if (!content.bomItems.some((item) => Boolean(item.materialSkuId))) return null

  return {
    materialLines: content.bomItems.map((item) => {
      if (!item.materialSkuId) throw new Error(`BOM 行 ${item.name} 未关联物料 SKU，不能提交技术包审核。`)
      return {
        bomItemId: item.id,
        materialSkuId: item.materialSkuId,
        usage: item.unitConsumption,
        sampleQuantity: item.sampleQuantity ?? 1,
        usageUnit: item.unit || '',
        lossRate: item.lossRate,
      }
    }),
    customCosts: content.bomCustomCosts ?? [],
  }
}

export function getTechnicalDataVersionBomWorkspace(technicalVersionId: string): EngineeringBomResolvedDraft {
  const draft = buildTechnicalDataVersionBomDraft(technicalVersionId)
  if (!draft) {
    return resolveEngineeringBomDraft({ materialLines: [], customCosts: [] })
  }
  return resolveEngineeringBomDraft(draft)
}

export function saveTechnicalDataVersionBomMaterialLine(
  technicalVersionId: string,
  bomItemId: string,
  patch: Partial<EngineeringBomMaterialLineDraft>,
  role: EngineeringBomOperatorRole,
): EngineeringBomResolvedDraft {
  return runTechnicalDataVersionRepositoryTransaction(() => {
    requireBuyer(role)
    requireEditableTechnicalVersion(technicalVersionId)
    const content = getTechnicalDataVersionContent(technicalVersionId)
    if (!content) throw new Error('未找到技术包版本内容。')
    const item = content.bomItems.find((candidate) => candidate.id === bomItemId)
    if (!item) throw new Error('未找到要维护的 BOM 物料行。')
    const materialSkuId = patch.materialSkuId ?? item.materialSkuId
    if (!materialSkuId) throw new Error('BOM 物料行未关联物料 SKU。')
    const nextLine = buildEngineeringBomMaterialLine({
      materialSkuId,
      usage: patch.usage ?? item.unitConsumption,
      sampleQuantity: patch.sampleQuantity ?? item.sampleQuantity ?? 1,
      usageUnit: patch.usageUnit ?? item.unit ?? '',
      lossRate: patch.lossRate ?? item.lossRate,
    }, role)
    const sku = getMaterialSkuRecordById(nextLine.materialSkuId)
    if (!sku) throw new Error('未找到可用的物料 SKU，无法加入 BOM。')
    const nextItems = content.bomItems.map((candidate) => candidate.id === bomItemId
      ? {
          ...candidate,
          materialSkuId: nextLine.materialSkuId,
          materialCode: sku.materialCode,
          name: sku.materialName,
          spec: sku.specName,
          unit: nextLine.usageUnit,
          unitConsumption: nextLine.usage,
          sampleQuantity: nextLine.sampleQuantity,
          lossRate: nextLine.lossRate,
        }
      : candidate)
    const changes = compareBomPriceChanges(content, { ...content, bomItems: nextItems })
    const contentChanged = JSON.stringify(nextItems) !== JSON.stringify(content.bomItems)
    if (contentChanged) updateTechnicalDataVersionContent(technicalVersionId, { bomItems: nextItems })
    if (changes.length > 0) {
      invalidateReviewForBomPriceChange(technicalVersionId, { changes, operator: '系统价格联动' })
    }
    return getTechnicalDataVersionBomWorkspace(technicalVersionId)
  })
}

export function saveTechnicalDataVersionBomCustomCosts(
  technicalVersionId: string,
  customCosts: EngineeringBomDraft['customCosts'],
  role: EngineeringBomOperatorRole,
): EngineeringBomResolvedDraft {
  return runTechnicalDataVersionRepositoryTransaction(() => {
    requireBuyer(role)
    requireEditableTechnicalVersion(technicalVersionId)
    const beforeContent = getTechnicalDataVersionContent(technicalVersionId)
    if (!beforeContent) throw new Error('未找到技术包版本内容。')
    calculateEngineeringBomCost({
      exchangeRateIdrPerCny: getLatestPcsExchangeRate().idrPerCny,
      materialLines: [],
      customCosts,
    })
    const nextCustomCosts = customCosts.map((item) => ({ title: item.title.trim(), amountIdr: item.amountIdr }))
    const contentChanged = JSON.stringify(nextCustomCosts) !== JSON.stringify(beforeContent.bomCustomCosts ?? [])
    if (contentChanged) updateTechnicalDataVersionContent(technicalVersionId, { bomCustomCosts: nextCustomCosts })
    const changes = compareBomPriceChanges(beforeContent, { ...beforeContent, bomCustomCosts: nextCustomCosts })
    if (changes.length > 0) {
      invalidateReviewForBomPriceChange(technicalVersionId, {
        changes,
        operator: '系统价格联动',
      })
    }
    return getTechnicalDataVersionBomWorkspace(technicalVersionId)
  })
}

export function assertTechnicalDataVersionBomCanSubmitForReview(technicalVersionId: string): void {
  const draft = buildTechnicalDataVersionBomDraft(technicalVersionId)
  if (!draft) return
  assertEngineeringBomCanSubmitForReview(resolveEngineeringBomDraft(draft), '买手')
}

export function freezeEngineeringBomPricingSnapshot(input: EngineeringBomDraft & { frozenAt: string; frozenBy: string }): EngineeringBomPricingSnapshot {
  const resolved = resolveEngineeringBomDraft(input)
  assertEngineeringBomCanSubmitForReview(resolved, '买手')
  const materialLines = resolved.materialLines.map((item) => ({
    ...item,
    standardUnitPriceCny: item.standardUnitPriceCny as number,
    materialCostCny: item.materialCostCny as number,
  }))
  return {
    snapshotVersion: 1,
    frozenAt: input.frozenAt,
    frozenBy: input.frozenBy,
    exchangeRateIdrPerCny: resolved.cost.exchangeRateIdrPerCny,
    exchangeRateSource: '系统最新汇率',
    materialLines,
    customCosts: resolved.customCosts,
    cost: { ...resolved.cost },
    bomItems: [],
    materialPriceSnapshots: materialLines.map((item) => ({
      ...item,
      bomItemId: item.bomItemId ?? '',
    })),
    customCostsIdr: resolved.customCosts.map((item) => ({ ...item })),
    materialCostCny: resolved.cost.materialCostCny,
    comprehensiveCostCny: resolved.cost.comprehensiveCostCny,
    comprehensiveCostIdr: resolved.cost.comprehensiveCostIdr,
    linkedPartTemplateVersions: [],
  }
}

export function freezeTechnicalDataVersionBomPricingSnapshot(
  technicalVersionId: string,
  frozenAt: string,
  frozenBy: string,
): EngineeringBomPricingSnapshot {
  return freezePublishedTechnicalDataVersionBomPricingSnapshot(technicalVersionId, frozenAt, frozenBy)
}
