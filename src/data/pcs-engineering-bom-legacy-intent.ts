import { getMaterialArchiveById, resolveMaterialSkuIdentity } from './pcs-material-archive-repository.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
import type { TechnicalBomItem } from './pcs-technical-data-version-types.ts'

/** 将旧 SKU 用料意向承接为技术草稿；读取不写、不改 SKU，也不推断不存在的物料身份。 */
export function projectLegacySkuMaterialIntent(
  items: TechnicalBomItem[], skus: SkuArchiveRecord[], consumedSourceIds: string[] = [],
): { bomItems: TechnicalBomItem[]; sourceIds: string[]; unresolvedSourceIds: string[] } {
  const bomItems = structuredClone(items)
  const sourceIds = new Set([...consumedSourceIds, ...items.flatMap(item => item.legacyIntentSourceId ? [item.legacyIntentSourceId] : [])])
  const unresolvedSourceIds: string[] = []
  for (const sku of skus) {
    for (const [index, intent] of (sku.expectedMaterials || []).entries()) {
      const sourceId = `sku-intent:${sku.skuId}:${index}:${intent.materialSkuId || intent.materialSkuCode}`
      if (sourceIds.has(sourceId)) continue
      const material = resolveMaterialSkuIdentity(intent.materialSkuId) || resolveMaterialSkuIdentity(intent.materialSkuCode)
      if (!material || !Number.isFinite(intent.quantity) || intent.quantity <= 0 || !intent.unit.trim()) {
        unresolvedSourceIds.push(sourceId)
        continue
      }
      const existing = bomItems.find(item => item.materialSkuId === material.materialSkuId && (item.applicableSkuCodes || []).some(id => id === sku.skuId || id === sku.skuCode))
      sourceIds.add(sourceId)
      if (existing) continue
      const kind: Record<string, TechnicalBomItem['type']> = { fabric: '面料', yarn: '纱线', accessory: '辅料', consumable: '包装材料', parts: '其他' }
      bomItems.push({
        id: `BOM-INTENT-${encodeURIComponent(sourceId)}`, legacyIntentSourceId: sourceId,
        type: kind[getMaterialArchiveById(material.materialId)?.kind || ''] || '其他', name: material.materialName, spec: material.specName,
        materialCode: material.materialCode, materialSkuId: material.materialSkuId, unit: intent.unit,
        colorLabel: sku.colorName, unitConsumption: intent.quantity, sampleQuantity: 1, lossRate: 0,
        applicableSkuCodes: [sku.skuCode], supplier: '', costReferenceMode: 'CURRENT',
        remark: ['历史用料意向承接，待技术人员确认正式用料。', intent.note || ''].filter(Boolean).join(' '),
      })
    }
  }
  return { bomItems, sourceIds: [...sourceIds], unresolvedSourceIds }
}
