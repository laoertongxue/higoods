// 正式生产事实的轻量只读索引。
// 首单门禁每次直接读取唯一的生产单运行态数组，不保存副本，也不开放替换入口。

import { productionDemands } from './production-demands.ts'
import {
  productionOrderRuntimeStore,
  type ProductionOrderRuntimeStatus,
} from './production-order-runtime-store.ts'

export type FormalProductionOrderStatus = ProductionOrderRuntimeStatus

export interface ProductionOrderFormalFact {
  productionOrderId: string
  spuCode: string
  status: FormalProductionOrderStatus
}

const NON_FORMAL_PRODUCTION_ORDER_STATUSES: FormalProductionOrderStatus[] = ['DRAFT', 'CANCELLED', 'ON_HOLD']

export function listProductionOrderFormalFacts(): ProductionOrderFormalFact[] {
  const demandFacts = productionDemands
    .filter((demand) => demand.demandStatus === 'CONVERTED' || demand.hasProductionOrder)
    .map((demand) => ({
      productionOrderId: demand.productionOrderId || `DEMAND:${demand.demandId}`,
      spuCode: demand.spuCode,
      status: 'WAIT_ASSIGNMENT' as const,
    }))
  const factsByOrderId = new Map<string, ProductionOrderFormalFact>()
  const orderFacts = productionOrderRuntimeStore.map((order) => ({
    productionOrderId: order.productionOrderId,
    spuCode: order.demandSnapshot.spuCode,
    status: order.status,
  }))
  for (const fact of [...demandFacts, ...orderFacts]) {
    factsByOrderId.set(fact.productionOrderId, { ...fact })
  }
  return Array.from(factsByOrderId.values())
}

export function hasFormalProductionOrderFact(styleCode: string): boolean {
  return listProductionOrderFormalFacts().some(
    (fact) => fact.spuCode === styleCode && !NON_FORMAL_PRODUCTION_ORDER_STATUSES.includes(fact.status),
  )
}
