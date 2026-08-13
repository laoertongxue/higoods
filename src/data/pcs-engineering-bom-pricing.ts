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
  EngineeringBomCustomCostDecision,
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

function requirementFlag(value: string | undefined): '是' | '否' | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined
  return normalized === '无' || normalized === '否' || normalized === '不需要' ? '否' : '是'
}

function technicalPrintSideToDraft(value: TechnicalDataVersionContent['bomItems'][number]['printSideMode']): EngineeringBomMaterialLineDraft['printSide'] {
  if (value === 'DOUBLE') return '双面'
  if (value === 'REVERSE') return '反面'
  if (value === 'SINGLE') return '正面'
  return '无'
}

function draftPrintSideToTechnical(value: EngineeringBomMaterialLineDraft['printSide']): TechnicalDataVersionContent['bomItems'][number]['printSideMode'] {
  if (value === '双面') return 'DOUBLE'
  if (value === '反面') return 'REVERSE'
  if (value === '正面') return 'SINGLE'
  return ''
}

function requirementTextToTechnicalFlag(value: string | undefined): '是' | '否' {
  return requirementFlag(value) === '是' ? '是' : '否'
}

export function technicalBomItemToEngineeringLine(
  item: TechnicalDataVersionContent['bomItems'][number],
  styleCode = '',
): EngineeringBomMaterialLineDraft {
  if (!item.materialSkuId) throw new Error(`BOM 行 ${item.name} 未关联物料 SKU，不能提交技术包审核。`)
  const linkedPatternResultIds = [...new Set([
    ...(item.linkedPatternIds || []),
    ...(item.frontPatternDesignIds || []),
    ...(item.insidePatternDesignIds || []),
    item.frontPatternDesignId || '',
    item.insidePatternDesignId || '',
  ].map((value) => value.trim()).filter(Boolean))]
  return {
    bomItemId: item.id,
    materialSkuId: item.materialSkuId,
    styleCode,
    productColor: item.colorLabel?.trim() || '',
    materialType: item.type,
    specification: item.spec,
    usage: item.unitConsumption,
    sampleQuantity: item.sampleQuantity ?? 1,
    usageUnit: item.unit || '',
    lossRate: item.lossRate,
    applicableSkuIds: [...(item.applicableSkuCodes || [])],
    printRequirement: requirementFlag(item.printRequirement),
    printRequirementText: item.printRequirement || '',
    dyeRequirement: requirementFlag(item.dyeRequirement),
    dyeRequirementText: item.dyeRequirement || '',
    shrinkRequirementText: item.shrinkRequirement || '',
    washRequirementText: item.washRequirement || '',
    waterSolubleRequirementText: item.waterSolubleRequirement || '',
    printSide: technicalPrintSideToDraft(item.printSideMode),
    frontPatternResultId: item.frontPatternDesignId || item.frontPatternDesignIds?.[0] || '',
    liningPatternResultId: item.insidePatternDesignId || item.insidePatternDesignIds?.[0] || '',
    linkedPatternResultIds,
    processCode: item.usageProcessCodes?.[0] || '',
    remark: item.remark || '',
  }
}

export function compareBomPriceChanges(
  beforeContent: Pick<TechnicalDataVersionContent, 'bomItems' | 'bomCustomCosts' | 'bomCustomCostDecision'>,
  afterContent: Pick<TechnicalDataVersionContent, 'bomItems' | 'bomCustomCosts' | 'bomCustomCostDecision'>,
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
  const beforeDecision = beforeContent.bomCustomCostDecision
    ?? ((beforeContent.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED')
  const afterDecision = afterContent.bomCustomCostDecision
    ?? ((afterContent.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED')
  if (beforeDecision !== afterDecision && beforeCustomCostIdr === afterCustomCostIdr) {
    changes.push({
      changeSource: 'CUSTOM_COST_IDR',
      targetId: 'BOM-CUSTOM-COST-DECISION',
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
    ...input,
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
    customCosts: draft.customCosts.map((item) => ({
      ...item,
      note: item.note || '',
      displayOrder: Number(item.displayOrder || 0),
      maintainedBy: item.maintainedBy || '',
      maintainedAt: item.maintainedAt || '',
      currency: 'IDR',
    })),
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

  const record = getTechnicalDataVersionById(technicalVersionId)
  const colors = [...new Set(content.bomItems.map((item) => item.colorLabel?.trim()).filter(Boolean))]
  const skuScope = [...new Set(content.bomItems.flatMap((item) => item.applicableSkuCodes || []))]

  return {
    styleCode: record?.styleCode || '',
    productColor: colors.length === 1 ? colors[0] : '',
    applicableSkuIds: skuScope,
    materialLines: content.bomItems.map((item) => technicalBomItemToEngineeringLine(item, record?.styleCode || '')),
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
      bomItemId,
      styleCode: patch.styleCode,
      sequenceNo: patch.sequenceNo,
      productColor: patch.productColor ?? item.colorLabel,
      materialType: patch.materialType ?? item.type,
      materialImageUrl: patch.materialImageUrl,
      specification: patch.specification ?? item.spec,
      usage: patch.usage ?? item.unitConsumption,
      sampleQuantity: patch.sampleQuantity ?? item.sampleQuantity ?? 1,
      usageUnit: patch.usageUnit ?? item.unit ?? '',
      lossRate: patch.lossRate ?? item.lossRate,
      applicableSkuIds: patch.applicableSkuIds ?? item.applicableSkuCodes,
      printRequirement: patch.printRequirement ?? requirementFlag(item.printRequirement),
      printRequirementText: patch.printRequirementText
        ?? (patch.printRequirement === undefined ? item.printRequirement : patch.printRequirement === '是' ? '需要印花' : '无'),
      dyeRequirement: patch.dyeRequirement ?? requirementFlag(item.dyeRequirement),
      dyeRequirementText: patch.dyeRequirementText
        ?? (patch.dyeRequirement === undefined ? item.dyeRequirement : patch.dyeRequirement === '是' ? '需要染色' : '无'),
      purchaseRequirement: patch.purchaseRequirement,
      shrinkRequirementText: patch.shrinkRequirementText ?? item.shrinkRequirement,
      washRequirementText: patch.washRequirementText ?? item.washRequirement,
      waterSolubleRequirementText: patch.waterSolubleRequirementText ?? item.waterSolubleRequirement,
      printSide: patch.printSide ?? technicalPrintSideToDraft(item.printSideMode),
      frontPatternResultId: patch.frontPatternResultId ?? item.frontPatternDesignId,
      liningPatternResultId: patch.liningPatternResultId ?? item.insidePatternDesignId,
      linkedPatternResultIds: patch.linkedPatternResultIds ?? item.linkedPatternIds,
      processCode: patch.processCode ?? item.usageProcessCodes?.[0],
      remark: patch.remark ?? item.remark,
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
          colorLabel: nextLine.productColor || '',
          applicableSkuCodes: [...(nextLine.applicableSkuIds || [])],
          printRequirement: nextLine.printRequirementText || (nextLine.printRequirement === '是' ? '需要印花' : '无'),
          dyeRequirement: nextLine.dyeRequirementText || (nextLine.dyeRequirement === '是' ? '需要染色' : '无'),
          shrinkRequirement: requirementTextToTechnicalFlag(nextLine.shrinkRequirementText),
          washRequirement: requirementTextToTechnicalFlag(nextLine.washRequirementText),
          waterSolubleRequirement: requirementTextToTechnicalFlag(nextLine.waterSolubleRequirementText),
          printSideMode: draftPrintSideToTechnical(nextLine.printSide),
          frontPatternDesignId: nextLine.frontPatternResultId || '',
          insidePatternDesignId: nextLine.liningPatternResultId || '',
          linkedPatternIds: [...(nextLine.linkedPatternResultIds || [])],
          usageProcessCodes: nextLine.processCode ? [nextLine.processCode] : [],
          remark: nextLine.remark || '',
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
  decision?: EngineeringBomCustomCostDecision,
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
    const nextCustomCosts = customCosts.map((item, index) => ({
      ...item,
      title: item.title.trim(),
      amountIdr: item.amountIdr,
      note: item.note?.trim() || '',
      displayOrder: Number.isFinite(item.displayOrder) ? Number(item.displayOrder) : index + 1,
      maintainedBy: item.maintainedBy?.trim() || '',
      maintainedAt: item.maintainedAt?.trim() || '',
    }))
    const nextDecision = decision
      ?? (nextCustomCosts.length > 0 ? 'HAS_CUSTOM_COST' : beforeContent.bomCustomCostDecision ?? 'UNDECIDED')
    if (nextDecision === 'HAS_CUSTOM_COST' && nextCustomCosts.length === 0) {
      throw new Error('已选择“本次有自定义费用”，请至少填写一项费用。')
    }
    if (nextDecision !== 'HAS_CUSTOM_COST' && nextCustomCosts.length > 0) {
      throw new Error('已有自定义费用明细，请选择“本次有自定义费用”。')
    }
    const semanticCosts = (items: EngineeringBomDraft['customCosts']) => items.map((item) => ({
      title: item.title.trim(),
      amountIdr: item.amountIdr,
      note: item.note?.trim() || '',
    }))
    const nextContent = {
      ...beforeContent,
      bomCustomCosts: nextCustomCosts,
      bomCustomCostDecision: nextDecision,
    }
    const contentChanged = JSON.stringify({
      costs: semanticCosts(nextCustomCosts),
      decision: nextDecision,
    }) !== JSON.stringify({
      costs: semanticCosts(beforeContent.bomCustomCosts ?? []),
      decision: beforeContent.bomCustomCostDecision ?? 'UNDECIDED',
    })
    if (contentChanged) updateTechnicalDataVersionContent(technicalVersionId, {
      bomCustomCosts: nextCustomCosts,
      bomCustomCostDecision: nextDecision,
    })
    const changes = compareBomPriceChanges(beforeContent, nextContent)
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
  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!content) return
  const decision = content.bomCustomCostDecision
    ?? ((content.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED')
  if (decision === 'UNDECIDED') {
    throw new Error('请先由买手确认本次是否有自定义费用。没有费用时请选择“本次无自定义费用”。')
  }
  if (decision === 'HAS_CUSTOM_COST' && (content.bomCustomCosts?.length ?? 0) === 0) {
    throw new Error('已选择“本次有自定义费用”，请至少填写一项费用。')
  }
  const draft = buildTechnicalDataVersionBomDraft(technicalVersionId)
  if (!draft) return
  assertEngineeringBomCanSubmitForReview(resolveEngineeringBomDraft(draft), '买手')
}

export function freezeTechnicalDataVersionBomPricingSnapshot(
  technicalVersionId: string,
  frozenAt: string,
  frozenBy: string,
): EngineeringBomPricingSnapshot {
  return freezePublishedTechnicalDataVersionBomPricingSnapshot(technicalVersionId, frozenAt, frozenBy)
}
