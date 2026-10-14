import { productionOrders, type ProductionOrder } from '../production-orders.ts'
import { getProductionOrderChangeCurrentFacts } from '../production-tech-pack-change-domain.ts'
import { listGeneratedCutOrderSourceRecords, type GeneratedCutOrderSourceRecord } from './generated-cut-orders.ts'
import { MATERIAL_PREP_SEEDED_ORDER_IDS } from './material-prep-seed-identities.ts'
type RuntimePrepBomItem = NonNullable<ProductionOrder['techPackSnapshot']>['bomItems'][number]

export function resolveRuntimePrepMaterial(
  order: ProductionOrder,
  bom: RuntimePrepBomItem,
  facts: NonNullable<ReturnType<typeof getProductionOrderChangeCurrentFacts>>['materialFacts'],
) {
  const snapshot = order.techPackSnapshot!
  const replacement = facts.find(fact =>
    fact.sourceBomItemId === bom.id && fact.sourceTechPackVersionId === snapshot.sourceTechPackVersionId
    && fact.executionMaterialReplacement?.changeRecordId)?.executionMaterialReplacement
  return { replacement, materialSku: replacement?.materialCode.trim() || bom.materialCode?.trim() || '', unit: bom.unit?.trim() || '' }
}

export function findRuntimePrepCutSource(
  order: ProductionOrder,
  bom: RuntimePrepBomItem,
  material: { materialSku: string; unit: string },
  sources: GeneratedCutOrderSourceRecord[],
): GeneratedCutOrderSourceRecord | undefined {
  const matching = sources.filter(cut => cut.productionOrderId === order.productionOrderId
    && cut.techPackVersionId === order.techPackSnapshot!.sourceTechPackVersionId && cut.sourceBomItemIds?.includes(bom.id)
    && cut.materialSku === material.materialSku && cut.materialUnit === material.unit)
  return matching.length === 1 ? matching[0] : undefined
}

export function listRuntimeMaterialPrepCutOrderIds(): string[] {
  const seededIds = new Set(MATERIAL_PREP_SEEDED_ORDER_IDS)
  const sources = listGeneratedCutOrderSourceRecords()
  return productionOrders.flatMap(order => {
    if (seededIds.has(order.productionOrderId) || !order.techPackSnapshot) return []
    const facts = getProductionOrderChangeCurrentFacts(order.productionOrderId)?.materialFacts ?? []
    return order.techPackSnapshot.bomItems.filter(bom => bom.type !== '成衣').flatMap(bom => {
      const cut = findRuntimePrepCutSource(order, bom, resolveRuntimePrepMaterial(order, bom, facts), sources)
      return cut ? [cut.cutOrderId] : []
    })
  })
}
