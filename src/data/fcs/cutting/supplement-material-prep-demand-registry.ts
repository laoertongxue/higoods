import type { SupplementMaterialDemand } from './supplement-order-registry.ts'
import type { SupplementCreatedPurchaseOrderRef } from './supplement-purchase-order-registry.ts'
import type { SupplementMaterialSupplyDecisionSnapshot } from './supplement-supply-domain.ts'

export type SupplementMaterialPrepStatus =
  | '等待库存准备' | '采购中' | '等待染色' | '染色中' | '等待印花' | '印花中'
  | '等待到仓' | '部分到仓' | '可配料' | '部分配料' | '已配料'
  | '部分接收' | '已接收' | '存在差异' | '已结束'

export const SUPPLEMENT_MATERIAL_PREP_STATUSES: readonly SupplementMaterialPrepStatus[] = [
  '等待库存准备', '采购中', '等待染色', '染色中', '等待印花', '印花中',
  '等待到仓', '部分到仓', '可配料', '部分配料', '已配料',
  '部分接收', '已接收', '存在差异', '已结束',
]

export interface SupplementMaterialPrepDemandLine {
  materialDemandId: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  approvedRequiredQty: number
  processAvailableQty: number
  arrivedQty: number
  currentAvailableQty: number
  preparedQty: number
  pickedQty: number
  remainingQty: number
  unit: string
  unresolvedDifferenceQty: number
}

export interface SupplementMaterialPrepDemand {
  demandId: string
  demandNo: string
  supplementOrderId: string
  supplementOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  sequenceNo: number
  reason: string
  status: SupplementMaterialPrepStatus
  lines: SupplementMaterialPrepDemandLine[]
  createdAt: string
}

const demands = new Map<string, SupplementMaterialPrepDemand>()

export function registerSupplementMaterialPrepDemand(input: {
  supplementOrderId: string
  supplementOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  sequenceNo: number
  reason: string
  materialDemands: ReadonlyArray<SupplementMaterialDemand>
  supplyDecisionSnapshots?: ReadonlyArray<SupplementMaterialSupplyDecisionSnapshot>
  createdPurchaseOrderRefs?: ReadonlyArray<SupplementCreatedPurchaseOrderRef>
  createdAt: string
}): SupplementMaterialPrepDemand {
  const demandId = `SUP-PREP:${input.supplementOrderId}`
  const existing = demands.get(demandId)
  if (existing) return structuredClone(existing)
  const lines = input.materialDemands.map((line): SupplementMaterialPrepDemandLine => {
    const supply = input.supplyDecisionSnapshots?.find((item) => item.materialDemandId === line.key)
    const immediatelyAvailableQty = line.dyeRequired || line.printRequired
      ? 0
      : Math.min(line.requiredQty, supply?.availableInventoryCoverageQty ?? 0)
    return {
      materialDemandId: line.key,
      materialSku: line.materialSku,
      materialName: line.materialName,
      materialImageUrl: line.materialImageUrl,
      approvedRequiredQty: line.requiredQty,
      processAvailableQty: line.dyeRequired || line.printRequired ? 0 : line.requiredQty,
      arrivedQty: immediatelyAvailableQty,
      currentAvailableQty: immediatelyAvailableQty,
      preparedQty: 0,
      pickedQty: 0,
      remainingQty: line.requiredQty,
      unit: line.unit,
      unresolvedDifferenceQty: 0,
    }
  })
  const status: SupplementMaterialPrepStatus = input.materialDemands.some((line) => line.dyeRequired)
    ? '等待染色'
    : input.materialDemands.some((line) => line.printRequired)
      ? '等待印花'
      : input.createdPurchaseOrderRefs?.length
        ? '采购中'
        : lines.some((line) => line.currentAvailableQty > 0)
          ? '可配料'
          : input.supplyDecisionSnapshots?.some((item) => item.existingTransitCoverageQty > 0)
            ? '等待到仓'
            : '等待库存准备'
  const demand: SupplementMaterialPrepDemand = {
    demandId,
    demandNo: `补料配料-${input.supplementOrderNo}`,
    supplementOrderId: input.supplementOrderId,
    supplementOrderNo: input.supplementOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    cutOrderId: input.cutOrderId,
    cutOrderNo: input.cutOrderNo,
    sequenceNo: input.sequenceNo,
    reason: input.reason,
    status,
    lines,
    createdAt: input.createdAt,
  }
  demands.set(demandId, demand)
  return structuredClone(demand)
}

export function getSupplementMaterialPrepDemand(demandId: string): SupplementMaterialPrepDemand | undefined {
  const demand = demands.get(demandId)
  return demand ? structuredClone(demand) : undefined
}

export function listSupplementMaterialPrepDemands(): SupplementMaterialPrepDemand[] {
  return [...demands.values()].map((demand) => structuredClone(demand))
}

export function updateSupplementMaterialPrepDemand(input: {
  demandId: string
  status: SupplementMaterialPrepStatus
  lines?: Array<Partial<SupplementMaterialPrepDemandLine> & Pick<SupplementMaterialPrepDemandLine, 'materialDemandId'>>
}): SupplementMaterialPrepDemand {
  const existing = demands.get(input.demandId)
  if (!existing) throw new Error('未找到补料配料需求。')
  const patches = new Map((input.lines ?? []).map((line) => [line.materialDemandId, line]))
  const next: SupplementMaterialPrepDemand = {
    ...existing,
    status: input.status,
    lines: existing.lines.map((line) => {
      const merged = { ...line, ...(patches.get(line.materialDemandId) ?? {}) }
      return { ...merged, remainingQty: Math.max(merged.approvedRequiredQty - merged.pickedQty, 0) }
    }),
  }
  demands.set(next.demandId, next)
  return structuredClone(next)
}

export function resetSupplementMaterialPrepDemandRegistryForTesting(): void {
  demands.clear()
}

export function removeSupplementMaterialPrepDemandForRollback(supplementOrderId: string): void {
  demands.delete(`SUP-PREP:${supplementOrderId}`)
}
