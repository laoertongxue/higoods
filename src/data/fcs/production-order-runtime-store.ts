import type { ProductionOrder } from './production-orders.ts'

// 生产单运行态唯一事实源。仅生产单领域负责写入，其他模块只能持有同一数组引用读取事实。
export const productionOrderRuntimeStore: ProductionOrder[] = []
