import { productionDemands, type ProductionDemand } from './production-demands.ts'
import { getCompatTechPackBySpuCode, type TechPack } from '../pcs-technical-data-runtime-source.ts'
import type { DemandSnapshot, TechPackSnapshot } from './production-orders.ts'

export interface ProductionUpstreamValidationIssue {
  code:
    | 'DEMAND_NOT_FOUND'
    | 'DEMAND_NOT_CONVERTED'
    | 'TECH_PACK_NOT_FOUND'
    | 'TECH_PACK_NOT_RELEASED'
    | 'DEMAND_ORDER_MISMATCH'
  message: string
}

export interface ProductionOrderUpstreamLink {
  productionOrderId: string
  demand: ProductionDemand
  techPack: TechPack
}

function normalizeVersionLabel(versionLabel: string | null | undefined): string {
  const trimmed = String(versionLabel || '').trim()
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'beta') return 'v1.0'
  return trimmed
}

export function getProductionDemandById(demandId: string): ProductionDemand | null {
  return productionDemands.find((item) => item.demandId === demandId) ?? null
}

export function getReleasedTechPackByDemand(demand: ProductionDemand): TechPack | null {
  const techPack = getCompatTechPackBySpuCode(demand.spuCode)
  if (!techPack || techPack.status !== 'RELEASED') return null
  return techPack
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

export function buildProductionOrderTechPackSnapshot(techPack: TechPack, snapshotAt = techPack.lastUpdatedAt): TechPackSnapshot {
  return {
    status: 'RELEASED',
    versionLabel: normalizeVersionLabel(techPack.versionLabel),
    snapshotAt,
  }
}

export function validateDemandTechPackOrderLink(input: {
  productionOrderId: string
  demandId: string
}): { ok: boolean; demand: ProductionDemand | null; techPack: TechPack | null; issues: ProductionUpstreamValidationIssue[] } {
  const issues: ProductionUpstreamValidationIssue[] = []
  const demand = getProductionDemandById(input.demandId)
  if (!demand) {
    issues.push({
      code: 'DEMAND_NOT_FOUND',
      message: `生产单 ${input.productionOrderId} 未找到需求 ${input.demandId}`,
    })
    return { ok: false, demand: null, techPack: null, issues }
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

  const techPack = getCompatTechPackBySpuCode(demand.spuCode) ?? null
  if (!techPack) {
    issues.push({
      code: 'TECH_PACK_NOT_FOUND',
      message: `需求 ${demand.demandId} 关联 SPU ${demand.spuCode} 的技术资料不存在`,
    })
  } else if (techPack.status !== 'RELEASED') {
    issues.push({
      code: 'TECH_PACK_NOT_RELEASED',
      message: `需求 ${demand.demandId} 关联 SPU ${demand.spuCode} 的技术资料未发布`,
    })
  }

  return {
    ok: issues.length === 0,
    demand,
    techPack: techPack && techPack.status === 'RELEASED' ? techPack : null,
    issues,
  }
}

export function listLinkedProductionOrders(): ProductionOrderUpstreamLink[] {
  return productionDemands
    .filter((demand) => demand.productionOrderId && demand.demandStatus === 'CONVERTED')
    .map((demand) => {
      const techPack = getReleasedTechPackByDemand(demand)
      if (!techPack) return null
      return {
        productionOrderId: demand.productionOrderId!,
        demand,
        techPack,
      } satisfies ProductionOrderUpstreamLink
    })
    .filter((item): item is ProductionOrderUpstreamLink => Boolean(item))
}

export function resolveLinkedDemandForProductionOrder(orderId: string): ProductionDemand | null {
  return productionDemands.find((demand) => demand.productionOrderId === orderId) ?? null
}

export function resolveReleasedTechPackForProductionOrder(orderId: string): TechPack | null {
  const demand = resolveLinkedDemandForProductionOrder(orderId)
  if (!demand) return null
  return getReleasedTechPackByDemand(demand)
}
