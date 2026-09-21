import type { ProductionOrder } from './production-orders.ts'
import type { TechnicalProcessEntry } from '../pcs-technical-data-version-types.ts'
import { validateProcessRouteGraph } from '../tech-pack-process-route.ts'
import { calculateWebbingRequirements, cloneWebbingSpecifications, WEBBING_CUT_PROCESS, WEBBING_TIP_PROCESS, type WebbingSpecification } from './webbing-specifications.ts'

export interface TmfProductionDemand {
  id: string
  productionOrderId: string
  productionOrderNo: string
  techPackSnapshotId: string
  techPackVersionId: string
  /** 换版处理后保留旧要求及原规格实物，不再作为待处理需求。 */
  supersededBySnapshotId?: string
  routeEntryId: string
  sourceRouteEntryId: string
  bomItemId: string
  garmentSkuCode: string
  garmentColor: string
  garmentSize: string
  garmentQuantity: number
  materialSkuId: string
  sourceMaterialSkuId: string
  specification: WebbingSpecification
  requiredPieces: number
  theoreticalCutMeters: number
  requiredDeliveryDate: string | null
  /** 由实际前置关系保存；不在运行时按工序名称补路线。 */
  routeSnapshot: TechnicalProcessEntry[]
  /** 采用版本的端头辅材来源；历史需求缺失时不能猜测补造采购。 */
  tipMaterialSources?: Array<{ bomItemId: string; materialSkuId: string; materialName: string; imageUrl: string; unit: string }>
}

/** 仅从已绑定的生产单快照计算；不会修改技术包、创建采购或直接增加库存。 */
export function deriveTmfProductionDemands(
  order: Pick<ProductionOrder, 'productionOrderId' | 'productionOrderNo' | 'status' | 'techPackSnapshot' | 'demandSnapshot'>,
): TmfProductionDemand[] {
  if (['DRAFT', 'WAIT_TECH_PACK_RELEASE', 'CANCELLED', 'COMPLETED', 'ON_HOLD'].includes(order.status)) throw new Error('当前生产单状态不能生成新的织带加工需求。')
  const pack = order.techPackSnapshot
  if (!pack || pack.status !== 'RELEASED' || pack.productionOrderId !== order.productionOrderId
    || !pack.snapshotId || !pack.sourceTechPackVersionId) throw new Error('生产单尚未绑定有效的已发布技术包快照。')
  const cuts = pack.processEntries.filter((entry) => entry.processCode === WEBBING_CUT_PROCESS)
  const entriesById = new Map(pack.processEntries.map((entry) => [entry.id, entry]))
  if (entriesById.size !== pack.processEntries.length) throw new Error('技术包路线包含重复节点，不能生成织带需求。')
  const result: TmfProductionDemand[] = []
  const usedSources = new Set<string>()
  const garmentCodes = new Set<string>()
  for (const garment of order.demandSnapshot.skuLines) {
    if (!garment.skuCode.trim() || garmentCodes.has(garment.skuCode)
      || !Number.isSafeInteger(garment.qty) || garment.qty < 0) throw new Error('生产单成衣 SKU 重复或数量无效，请核对来源。')
    garmentCodes.add(garment.skuCode)
  }
  for (const cut of cuts) {
    const branch: TechnicalProcessEntry[] = []
    const visited = new Set<string>()
    const collect = (entry: TechnicalProcessEntry): void => {
      if (visited.has(entry.id)) return
      visited.add(entry.id)
      branch.push(entry)
      for (const id of entry.predecessorEntryIds ?? []) {
        const predecessor = entriesById.get(id)
        if (!predecessor) throw new Error(`前序工艺 ${id} 不存在，不能生成加工需求。`)
        collect(predecessor)
      }
    }
    collect(cut)
    pack.processEntries.filter((entry) => entry.processCode === WEBBING_TIP_PROCESS && entry.predecessorEntryIds?.includes(cut.id)).forEach(collect)
    const issues = validateProcessRouteGraph(branch, { requireComplete: true })
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('；'))
    const roots = branch.filter((entry) => !(entry.predecessorEntryIds ?? []).length)
    if (roots.length !== 1 || !roots[0].inputMaterialSkuId) throw new Error('织带路线必须有明确的首道投入半成品 SKU。')
    const root = roots[0]
    for (const spec of cut.webbingSpecifications ?? []) {
      const bom = pack.bomItems.find((item) => item.id === spec.bomItemId)
      if (!bom || bom.type !== '辅料') throw new Error(`规格 ${spec.id} 没有关联当前技术包的辅料 BOM。`)
      if (!bom.materialSkuId || bom.materialSkuId !== root.inputMaterialSkuId) throw new Error(`规格 ${spec.id} 的 BOM 半成品与首道投入 SKU 不一致，请先确认路线及款色用料。`)
      const applicableCodes = bom.applicableSkuCodes ?? []
      const garments = order.demandSnapshot.skuLines.filter((line) => line.size === spec.garmentSize
        && (!applicableCodes.length || applicableCodes.includes(line.skuCode)))
      if (!garments.length) throw new Error(`规格 ${spec.id} 的尺码或适用成衣 SKU 不在本生产单中。`)
      for (const garment of garments) {
        if (garment.qty === 0) continue
        const sourceKey = JSON.stringify([spec.bomItemId, spec.usage, garment.skuCode])
        if (usedSources.has(sourceKey)) throw new Error('同一 BOM 用途和成衣 SKU 被重复截断节点覆盖，不能重复生成需求。')
        usedSources.add(sourceKey)
        const [quantity] = calculateWebbingRequirements([spec], { [garment.size]: garment.qty })
        result.push({
          id: JSON.stringify([order.productionOrderId, pack.snapshotId, cut.id, spec.id, garment.skuCode]),
          productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
          techPackSnapshotId: pack.snapshotId, techPackVersionId: pack.sourceTechPackVersionId,
          routeEntryId: cut.id, sourceRouteEntryId: root.id, bomItemId: spec.bomItemId,
          garmentSkuCode: garment.skuCode, garmentColor: garment.color, garmentSize: garment.size,
          garmentQuantity: garment.qty, materialSkuId: cut.inputMaterialSkuId!, sourceMaterialSkuId: root.inputMaterialSkuId!,
          specification: cloneWebbingSpecifications([spec])![0], requiredPieces: quantity.requiredPieces,
          theoreticalCutMeters: quantity.requiredMeters, requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate,
          routeSnapshot: structuredClone(branch),
          tipMaterialSources: [...new Set([spec.endA, spec.endB].filter(end => end.method !== 'NONE').map(end => end.materialBomItemId))]
            .flatMap(id => {
              const item = pack.bomItems.find(item => item.id === id)
              return item?.materialSkuId ? [{ bomItemId: item.id, materialSkuId: item.materialSkuId, materialName: item.name, imageUrl: '', unit: item.unit || '' }] : []
            }),
        })
      }
    }
  }
  return result
}
