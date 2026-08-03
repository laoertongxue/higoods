// 生产单运行态唯一事实源。本文件不依赖生产单页面或技术包组装逻辑，
// 因此首单门禁在冷启动时也能直接读到已存在的正式生产事实。
export type ProductionOrderRuntimeStatus =
  | 'DRAFT'
  | 'WAIT_TECH_PACK_RELEASE'
  | 'READY_FOR_BREAKDOWN'
  | 'WAIT_ASSIGNMENT'
  | 'ASSIGNING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'

export interface ProductionOrderRuntimeFact {
  productionOrderId: string
  status: ProductionOrderRuntimeStatus
  demandSnapshot: {
    spuCode: string
  }
}

export const RELEASE_TARGET_SUPPLEMENT_PRODUCTION_FACT: ProductionOrderRuntimeFact = {
  productionOrderId: 'po-14671',
  status: 'WAIT_ASSIGNMENT',
  demandSnapshot: { spuCode: 'ASYSA26060310' },
}

export const productionOrderRuntimeStore: ProductionOrderRuntimeFact[] = [
  {
    ...RELEASE_TARGET_SUPPLEMENT_PRODUCTION_FACT,
    demandSnapshot: { ...RELEASE_TARGET_SUPPLEMENT_PRODUCTION_FACT.demandSnapshot },
  },
]
