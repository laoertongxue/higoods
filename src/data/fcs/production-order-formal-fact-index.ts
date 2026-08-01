// 正式生产事实的轻量只读索引。
// 仅保留首单门禁需要的 SPU 与生产状态，不加载生产单技术包快照。

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

// 原型中没有对应生产需求 Seed 的独立正式生产单，也必须进入首单门禁。
const STANDALONE_PRODUCTION_ORDER_FACTS: ProductionOrderFormalFact[] = [
  {
    productionOrderId: 'po-14671',
    spuCode: 'ASYSA26060310',
    status: 'WAIT_ASSIGNMENT',
  },
]

export function listProductionOrderFormalFacts(): ProductionOrderFormalFact[] {
  const demandFacts = productionDemands
    .filter((demand) => demand.demandStatus === 'CONVERTED' || demand.hasProductionOrder)
    .map((demand) => ({
      productionOrderId: demand.productionOrderId || `DEMAND:${demand.demandId}`,
      spuCode: demand.spuCode,
      status: 'WAIT_ASSIGNMENT' as const,
    }))
  return [...demandFacts, ...STANDALONE_PRODUCTION_ORDER_FACTS].map((fact) => ({ ...fact }))
}

export function getStandaloneProductionOrderFormalFact(productionOrderId: string): ProductionOrderFormalFact | null {
  const fact = STANDALONE_PRODUCTION_ORDER_FACTS.find((item) => item.productionOrderId === productionOrderId)
  return fact ? { ...fact } : null
}

export function hasFormalProductionOrderFact(styleCode: string): boolean {
  return listProductionOrderFormalFacts().some(
    (fact) => fact.spuCode === styleCode && !NON_FORMAL_PRODUCTION_ORDER_STATUSES.includes(fact.status),
  )
}
