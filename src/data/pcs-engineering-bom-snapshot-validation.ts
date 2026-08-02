import type { EngineeringBomPricingSnapshot } from './pcs-engineering-bom-types.ts'
import type { TechnicalBomItem } from './pcs-technical-data-version-types.ts'

function roundCny(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundIdr(value: number): number {
  return Math.round(value)
}

export function assertEngineeringBomPricingSnapshotValid(
  snapshot: EngineeringBomPricingSnapshot,
  targetBomItems: TechnicalBomItem[] = snapshot.bomItems,
): void {
  if (snapshot.snapshotVersion !== 1) throw new Error('正式 BOM 与价格快照版本无效。')
  if (!snapshot.frozenAt.trim() || !snapshot.frozenBy.trim()) throw new Error('正式 BOM 与价格快照缺少固化信息。')
  if (!Number.isFinite(snapshot.exchangeRateIdrPerCny) || snapshot.exchangeRateIdrPerCny <= 0) throw new Error('正式 BOM 与价格快照汇率无效。')
  if (!Array.isArray(snapshot.bomItems) || snapshot.bomItems.length === 0) throw new Error('正式 BOM 与价格快照缺少 BOM 明细。')
  if (!Array.isArray(snapshot.materialPriceSnapshots) || snapshot.materialPriceSnapshots.length !== snapshot.bomItems.length) {
    throw new Error('正式 BOM 与价格快照的物料价格明细不完整。')
  }
  const snapshotBomItemsById = new Map(snapshot.bomItems.map((item) => [item.id, item]))
  if (snapshotBomItemsById.size !== snapshot.bomItems.length || [...snapshotBomItemsById.keys()].some((id) => !id.trim())) {
    throw new Error('正式 BOM 与价格快照的 BOM 行 ID 缺失或重复。')
  }
  const targetBomItemsById = new Map(targetBomItems.map((item) => [item.id, item]))
  if (
    targetBomItemsById.size !== targetBomItems.length
    || [...targetBomItemsById.keys()].some((id) => !id.trim())
    || targetBomItems.length !== snapshot.bomItems.length
  ) {
    throw new Error('正式快照与目标技术包当前 BOM 行集合不一致。')
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
    const rawLineCostCny = line.usage * line.sampleQuantity * (1 + line.lossRate) * line.conversionToPricingUnit * line.standardUnitPriceCny
    if (line.materialCostCny !== roundCny(rawLineCostCny)) {
      throw new Error(`正式 BOM 与价格快照的逐行物料成本重算不一致：${line.bomItemId}`)
    }
    rawMaterialCostCny += rawLineCostCny
  }
  if ([...targetBomItemsById.keys()].some((bomItemId) => !priceBomItemIds.has(bomItemId))) throw new Error('正式 BOM 与价格快照的 bomItemId 集合不一致，无法一一对应。')
  if (!Array.isArray(snapshot.customCostsIdr) || !Array.isArray(snapshot.linkedPartTemplateVersions)) throw new Error('正式 BOM 与价格快照结构无效。')
  for (const item of snapshot.customCostsIdr) {
    if (!item.title.trim() || item.currency !== 'IDR' || !Number.isFinite(item.amountIdr) || item.amountIdr < 0) throw new Error('正式 BOM 与价格快照存在无效自定义成本。')
  }
  for (const template of snapshot.linkedPartTemplateVersions) {
    if (!template.partTemplateId.trim() || !template.templatePackageId.trim() || !template.templateName.trim() || !template.updatedAt.trim()) throw new Error('正式 BOM 与价格快照存在无效部件模板版本。')
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
