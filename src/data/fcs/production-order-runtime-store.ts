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
  selectedTechPackVersionId?: string
  techPackSnapshot?: { snapshotId: string; sourceTechPackVersionId: string } | null
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


export const CREATED_PRODUCTION_ORDERS_STORAGE_KEY = 'higood.formal-created-production-orders.v1'

/** 已保存正式单以当前存储为准，避免其他标签页的暂停/取消被旧内存遮住。 */
export function readProductionOrderRuntimeFact(productionOrderId: string): ProductionOrderRuntimeFact | undefined {
  const live = productionOrderRuntimeStore.find(order => order.productionOrderId === productionOrderId)
  if (typeof window === 'undefined') return live
  try {
    const raw = window.localStorage.getItem(CREATED_PRODUCTION_ORDERS_STORAGE_KEY)
    if (!raw) return live
    const saved = JSON.parse(raw)
    if (saved?.version !== 1 || !Array.isArray(saved.orders)) throw new Error('invalid production orders')
    const order = saved.orders.find((item: ProductionOrderRuntimeFact) => item.productionOrderId === productionOrderId)
    if (order && !['DRAFT','WAIT_TECH_PACK_RELEASE','READY_FOR_BREAKDOWN','WAIT_ASSIGNMENT','ASSIGNING','EXECUTING','COMPLETED','CANCELLED','ON_HOLD'].includes(order.status)) throw new Error('invalid status')
    return order ?? live
  } catch { throw new Error('无法核对主生产单状态，请恢复来源记录后重试；未允许继续加工或发料。') }
}

registerTmfProductionOrderRuntimeReader(readProductionOrderRuntimeFact)
import { registerTmfProductionOrderRuntimeReader } from './tmf-source-readers.ts'
