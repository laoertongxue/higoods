// 正式生产事实的轻量只读索引。
// 生产单模块注册运行态读取器；首单门禁每次直接读取当前生产单，不保存状态副本。

import { productionDemands } from './production-demands.ts'

export type FormalProductionOrderStatus =
  | 'DRAFT'
  | 'WAIT_TECH_PACK_RELEASE'
  | 'READY_FOR_BREAKDOWN'
  | 'WAIT_ASSIGNMENT'
  | 'ASSIGNING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'

export interface ProductionOrderFormalFact {
  productionOrderId: string
  spuCode: string
  status: FormalProductionOrderStatus
}

const NON_FORMAL_PRODUCTION_ORDER_STATUSES: FormalProductionOrderStatus[] = ['DRAFT', 'CANCELLED', 'ON_HOLD']

type ProductionOrderFormalFactReader = () => readonly ProductionOrderFormalFact[]

let productionOrderFormalFactReader: ProductionOrderFormalFactReader = () => []

export function registerProductionOrderFormalFactReader(reader: ProductionOrderFormalFactReader): void {
  productionOrderFormalFactReader = reader
}

export function listProductionOrderFormalFacts(): ProductionOrderFormalFact[] {
  const demandFacts = productionDemands
    .filter((demand) => demand.demandStatus === 'CONVERTED' || demand.hasProductionOrder)
    .map((demand) => ({
      productionOrderId: demand.productionOrderId || `DEMAND:${demand.demandId}`,
      spuCode: demand.spuCode,
      status: 'WAIT_ASSIGNMENT' as const,
    }))
  const factsByOrderId = new Map<string, ProductionOrderFormalFact>()
  for (const fact of [...demandFacts, ...productionOrderFormalFactReader()]) {
    factsByOrderId.set(fact.productionOrderId, { ...fact })
  }
  return Array.from(factsByOrderId.values())
}

export function hasFormalProductionOrderFact(styleCode: string): boolean {
  return listProductionOrderFormalFacts().some(
    (fact) => fact.spuCode === styleCode && !NON_FORMAL_PRODUCTION_ORDER_STATUSES.includes(fact.status),
  )
}
