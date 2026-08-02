import type {
  EngineeringBomCustomCostDraft,
  EngineeringBomPricingSnapshot,
  EngineeringLinkedPartTemplateVersionSnapshot,
} from './pcs-engineering-bom-types.ts'
import type { TechnicalBomItem } from './pcs-technical-data-version-types.ts'
import { resolveEngineeringBomMaterialLine } from './pcs-engineering-bom-material-resolver.ts'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundIdr(value: number): number {
  return Math.round(value)
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableNormalize(item)]),
    )
  }
  return value
}

function isStableDeepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableNormalize(left)) === JSON.stringify(stableNormalize(right))
}

export interface EngineeringBomPricingSnapshotTrustedTarget {
  bomItems: TechnicalBomItem[]
  bomCustomCosts: EngineeringBomCustomCostDraft[]
  exchangeRateIdrPerCny: number
  linkedPartTemplateVersions: EngineeringLinkedPartTemplateVersionSnapshot[]
  frozenAt?: string
  frozenBy?: string
}

export function assertEngineeringBomPricingSnapshotValid(
  snapshot: EngineeringBomPricingSnapshot,
  trustedTarget?: EngineeringBomPricingSnapshotTrustedTarget,
): void {
  if (snapshot.snapshotVersion !== 1) throw new Error('正式 BOM 与价格快照版本无效。')
  if (!snapshot.frozenAt.trim() || !snapshot.frozenBy.trim()) throw new Error('正式 BOM 与价格快照缺少固化信息。')
  if (snapshot.exchangeRateSource !== '系统最新汇率') throw new Error('正式 BOM 与价格快照的汇率来源无效。')
  if (
    (trustedTarget?.frozenAt !== undefined && snapshot.frozenAt !== trustedTarget.frozenAt)
    || (trustedTarget?.frozenBy !== undefined && snapshot.frozenBy !== trustedTarget.frozenBy)
  ) {
    throw new Error('正式 BOM 与价格快照的固化审计字段与规范构建上下文不一致。')
  }
  if (!Number.isFinite(snapshot.exchangeRateIdrPerCny) || snapshot.exchangeRateIdrPerCny <= 0) throw new Error('正式 BOM 与价格快照汇率无效。')
  if (trustedTarget && snapshot.exchangeRateIdrPerCny !== trustedTarget.exchangeRateIdrPerCny) {
    throw new Error('正式 BOM 与价格快照的汇率与系统最新汇率不一致。')
  }
  if (!Array.isArray(snapshot.bomItems) || snapshot.bomItems.length === 0) throw new Error('正式 BOM 与价格快照缺少 BOM 明细。')
  if (!Array.isArray(snapshot.materialPriceSnapshots) || snapshot.materialPriceSnapshots.length !== snapshot.bomItems.length) {
    throw new Error('正式 BOM 与价格快照的物料价格明细不完整。')
  }
  const snapshotBomItemsById = new Map(snapshot.bomItems.map((item) => [item.id, item]))
  if (snapshotBomItemsById.size !== snapshot.bomItems.length || [...snapshotBomItemsById.keys()].some((id) => !id.trim())) {
    throw new Error('正式 BOM 与价格快照的 BOM 行 ID 缺失或重复。')
  }
  const targetBomItems = trustedTarget?.bomItems
  const authoritativeTargetBomItems = targetBomItems ?? snapshot.bomItems
  const targetBomItemsById = new Map(authoritativeTargetBomItems.map((item) => [item.id, item]))
  if (
    targetBomItemsById.size !== authoritativeTargetBomItems.length
    || [...targetBomItemsById.keys()].some((id) => !id.trim())
    || authoritativeTargetBomItems.length !== snapshot.bomItems.length
  ) {
    throw new Error('正式快照与目标技术包当前 BOM 行集合不一致。')
  }
  if (targetBomItems && !isStableDeepEqual(snapshot.bomItems, targetBomItems)) {
    throw new Error('正式快照与目标技术包当前 BOM 全部业务字段不一致。')
  }
  for (const [bomItemId, targetItem] of targetBomItemsById) {
    const snapshotItem = snapshotBomItemsById.get(bomItemId)
    if (!snapshotItem || (snapshotItem.materialSkuId || '').trim() !== (targetItem.materialSkuId || '').trim()) {
      throw new Error(`正式快照与目标技术包当前 BOM 不一致：${bomItemId}`)
    }
  }
  const priceBomItemIds = new Set<string>()
  let rawMaterialCostCny = 0
  for (const line of snapshot.materialPriceSnapshots) {
    if (!line.bomItemId?.trim() || priceBomItemIds.has(line.bomItemId)) throw new Error('正式 BOM 与价格快照的 bomItemId 缺失或重复，无法一一对应。')
    priceBomItemIds.add(line.bomItemId)
    const bomItem = targetBomItemsById.get(line.bomItemId)
    if (!bomItem) throw new Error(`正式 BOM 与价格快照的 bomItemId 不一致：${line.bomItemId}`)
    if ((bomItem.materialSkuId || '').trim() !== line.materialSkuId.trim()) throw new Error(`正式 BOM 与价格快照的物料 SKU 不一致：${line.bomItemId}`)
    if (bomItem.unitConsumption !== line.usage || (bomItem.sampleQuantity ?? 1) !== line.sampleQuantity || (bomItem.unit || '').trim() !== line.usageUnit.trim() || bomItem.lossRate !== line.lossRate) {
      throw new Error(`正式 BOM 与价格快照的用量、单位或损耗不一致：${line.bomItemId}`)
    }
    if (!line.materialSkuId.trim() || !Number.isFinite(line.standardUnitPriceCny) || line.standardUnitPriceCny <= 0) throw new Error('正式 BOM 与价格快照存在无效物料价格。')
    if (!Number.isFinite(line.conversionToPricingUnit) || line.conversionToPricingUnit <= 0) throw new Error('正式 BOM 与价格快照存在无效单位换算。')
    if (targetBomItems) {
      const trustedLine = resolveEngineeringBomMaterialLine({
        bomItemId: bomItem.id,
        materialSkuId: bomItem.materialSkuId || '',
        usage: bomItem.unitConsumption,
        sampleQuantity: bomItem.sampleQuantity ?? 1,
        usageUnit: bomItem.unit || '',
        lossRate: bomItem.lossRate,
      })
      if (trustedLine.standardUnitPriceCny === null || trustedLine.materialCostCny === null) {
        throw new Error(`正式 BOM 与价格快照无法取得当前物料档案有效标准单价：${line.bomItemId}`)
      }
      if (!isStableDeepEqual(line, trustedLine)) {
        throw new Error(`正式 BOM 与价格快照的物料价格或单位换算与当前物料档案不一致：${line.bomItemId}`)
      }
    }
    const rawLineCostCny = line.usage * line.sampleQuantity * (1 + line.lossRate) * line.conversionToPricingUnit * line.standardUnitPriceCny
    if (line.materialCostCny !== roundCny(rawLineCostCny)) {
      throw new Error(`正式 BOM 与价格快照的逐行物料成本重算不一致：${line.bomItemId}`)
    }
    rawMaterialCostCny += rawLineCostCny
  }
  if ([...targetBomItemsById.keys()].some((bomItemId) => !priceBomItemIds.has(bomItemId))) throw new Error('正式 BOM 与价格快照的 bomItemId 集合不一致，无法一一对应。')
  if (!Array.isArray(snapshot.customCostsIdr) || !Array.isArray(snapshot.linkedPartTemplateVersions)) throw new Error('正式 BOM 与价格快照结构无效。')
  if (!isStableDeepEqual(snapshot.materialLines, snapshot.materialPriceSnapshots)) {
    throw new Error('正式 BOM 与价格快照的物料价格明细不一致。')
  }
  if (!isStableDeepEqual(snapshot.customCosts, snapshot.customCostsIdr)) {
    throw new Error('正式 BOM 与价格快照的自定义成本明细不一致。')
  }
  if (trustedTarget) {
    const trustedCustomCostsIdr = trustedTarget.bomCustomCosts.map((item) => ({ ...item, currency: 'IDR' as const }))
    if (!isStableDeepEqual(snapshot.customCostsIdr, trustedCustomCostsIdr)) {
      throw new Error('正式 BOM 与价格快照的自定义成本与目标技术包不一致。')
    }
  }
  for (const item of snapshot.customCostsIdr) {
    if (!item.title.trim() || item.currency !== 'IDR' || !Number.isFinite(item.amountIdr) || item.amountIdr < 0) throw new Error('正式 BOM 与价格快照存在无效自定义成本。')
  }
  for (const template of snapshot.linkedPartTemplateVersions) {
    if (!template.partTemplateId.trim() || !template.templatePackageId.trim() || !template.templateName.trim() || !template.updatedAt.trim()) throw new Error('正式 BOM 与价格快照存在无效部件模板版本。')
  }
  if (trustedTarget && !isStableDeepEqual(snapshot.linkedPartTemplateVersions, trustedTarget.linkedPartTemplateVersions)) {
    throw new Error('正式 BOM 与价格快照的关联部件模板版本摘要与目标技术包不一致。')
  }
  for (const value of [snapshot.materialCostCny, snapshot.comprehensiveCostCny, snapshot.comprehensiveCostIdr]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('正式 BOM 与价格快照成本汇总无效。')
  }
  const expectedMaterialCostCny = roundCny(rawMaterialCostCny)
  const expectedCustomCostIdr = roundIdr(snapshot.customCostsIdr.reduce((total, item) => total + item.amountIdr, 0))
  const expectedComprehensiveCostCny = roundCny(rawMaterialCostCny + expectedCustomCostIdr / snapshot.exchangeRateIdrPerCny)
  const expectedComprehensiveCostIdr = roundIdr(rawMaterialCostCny * snapshot.exchangeRateIdrPerCny + expectedCustomCostIdr)
  if (
    snapshot.materialCostCny !== expectedMaterialCostCny
    || snapshot.cost.materialCostCny !== expectedMaterialCostCny
  ) {
    throw new Error('正式 BOM 与价格快照的物料成本重算不一致。')
  }
  if (snapshot.cost.customCostIdr !== expectedCustomCostIdr) {
    throw new Error('正式 BOM 与价格快照的自定义成本重算不一致。')
  }
  if (
    snapshot.cost.exchangeRateIdrPerCny !== snapshot.exchangeRateIdrPerCny
    || snapshot.comprehensiveCostCny !== expectedComprehensiveCostCny
    || snapshot.cost.comprehensiveCostCny !== expectedComprehensiveCostCny
    || snapshot.comprehensiveCostIdr !== expectedComprehensiveCostIdr
    || snapshot.cost.comprehensiveCostIdr !== expectedComprehensiveCostIdr
  ) {
    throw new Error('正式 BOM 与价格快照按汇率计算的综合成本重算不一致。')
  }
}
