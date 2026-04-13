import { productionDemands, type ProductionDemand } from './production-demands.ts'
import {
  buildProductionOrderTechPackSnapshot,
  getDemandCurrentTechPackInfo,
} from './production-tech-pack-snapshot-builder.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import type { DemandSnapshot } from './production-orders.ts'

export interface ProductionUpstreamValidationIssue {
  code:
    | 'DEMAND_NOT_FOUND'
    | 'DEMAND_NOT_CONVERTED'
    | 'STYLE_ARCHIVE_NOT_FOUND'
    | 'CURRENT_TECH_PACK_MISSING'
    | 'CURRENT_TECH_PACK_NOT_PUBLISHED'
    | 'DEMAND_ORDER_MISMATCH'
  message: string
}

export interface ProductionOrderUpstreamLink {
  productionOrderId: string
  demand: ProductionDemand
  // FCS 下游只消费这里冻结出的生产单技术包快照。
  techPackSnapshot: ProductionOrderTechPackSnapshot
}

export function getProductionDemandById(demandId: string): ProductionDemand | null {
  return productionDemands.find((item) => item.demandId === demandId) ?? null
}

export function buildProductionOrderDemandSnapshot(demand: ProductionDemand): DemandSnapshot {
  return {
    demandId: demand.demandId,
    spuCode: demand.spuCode,
    spuName: demand.spuName,
    priority: demand.priority,
    requiredDeliveryDate: demand.requiredDeliveryDate,
    constraintsNote: demand.constraintsNote,
    skuLines: demand.skuLines.map((line) => ({ ...line })),
  }
}

export function validateDemandTechPackOrderLink(input: {
  productionOrderId: string
  demandId: string
  snapshotAt?: string
  snapshotBy?: string
}): {
  ok: boolean
  demand: ProductionDemand | null
  techPackSnapshot: ProductionOrderTechPackSnapshot | null
  issues: ProductionUpstreamValidationIssue[]
} {
  const issues: ProductionUpstreamValidationIssue[] = []
  const demand = getProductionDemandById(input.demandId)
  if (!demand) {
    issues.push({
      code: 'DEMAND_NOT_FOUND',
      message: `生产单 ${input.productionOrderId} 未找到需求 ${input.demandId}`,
    })
    return { ok: false, demand: null, techPackSnapshot: null, issues }
  }

  if (demand.demandStatus !== 'CONVERTED') {
    issues.push({
      code: 'DEMAND_NOT_CONVERTED',
      message: `需求 ${demand.demandId} 当前不是已转单状态`,
    })
  }

  if (demand.productionOrderId !== input.productionOrderId) {
    issues.push({
      code: 'DEMAND_ORDER_MISMATCH',
      message: `需求 ${demand.demandId} 绑定的是 ${demand.productionOrderId || '空'}，与生产单 ${input.productionOrderId} 不一致`,
    })
  }

  const techPackInfo = getDemandCurrentTechPackInfo(demand)
  if (!techPackInfo.styleId) {
    issues.push({
      code: 'STYLE_ARCHIVE_NOT_FOUND',
      message: '当前需求未关联正式款式档案',
    })
  } else if (!techPackInfo.currentTechPackVersionId) {
    issues.push({
      code: 'CURRENT_TECH_PACK_MISSING',
      message: '当前款式尚未启用技术包版本',
    })
  } else if (!techPackInfo.canConvertToProductionOrder) {
    issues.push({
      code: 'CURRENT_TECH_PACK_NOT_PUBLISHED',
      message: techPackInfo.blockReason || '当前生效技术包版本未发布',
    })
  }

  if (issues.length > 0) {
    return {
      ok: false,
      demand,
      techPackSnapshot: null,
      issues,
    }
  }

  return {
    ok: true,
    demand,
    techPackSnapshot: buildProductionOrderTechPackSnapshot({
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderId,
      demand,
      snapshotAt: input.snapshotAt || demand.updatedAt,
      snapshotBy: input.snapshotBy || '系统初始化',
    }),
    issues,
  }
}

export function listLinkedProductionOrders(): ProductionOrderUpstreamLink[] {
  return productionDemands
    .filter((demand) => demand.productionOrderId && demand.demandStatus === 'CONVERTED')
    .map((demand) => {
      const validation = validateDemandTechPackOrderLink({
        productionOrderId: demand.productionOrderId!,
        demandId: demand.demandId,
        snapshotAt: demand.updatedAt,
        snapshotBy: '系统初始化',
      })
      if (!validation.ok || !validation.demand || !validation.techPackSnapshot) return null
      return {
        productionOrderId: demand.productionOrderId!,
        demand: validation.demand,
        techPackSnapshot: validation.techPackSnapshot,
      } satisfies ProductionOrderUpstreamLink
    })
    .filter((item): item is ProductionOrderUpstreamLink => Boolean(item))
}

export function resolveLinkedDemandForProductionOrder(orderId: string): ProductionDemand | null {
  return productionDemands.find((demand) => demand.productionOrderId === orderId) ?? null
}
