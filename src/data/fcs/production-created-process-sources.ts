import { productionOrders } from './production-orders.ts'
import type { ProcessWorkOrderSourceSnapshot } from './process-work-order-domain.ts'

/** 生产单创建只拥有加工单定义与匹配来源，执行数量和执行状态仍由各加工单维护。 */
import type { ProductionCreatedProcessSourceFact } from './production-created-process-source-types.ts'
export { validateProductionCreatedProcessSources } from './production-created-process-source-types.ts'
export type { ProductionCreatedProcessSourceFact } from './production-created-process-source-types.ts'
let stageDepth = 0
let collectFacts = false
export function isProductionCreationSourceStage(): boolean { return stageDepth > 0 }
export function withProductionCreationSourceStage<T>(action: () => T, collect = false): T {
  const previous = collectFacts
  stageDepth += 1; collectFacts = collect
  try { return action() } finally { stageDepth -= 1; collectFacts = previous }
}
export function recordProductionCreatedProcessSource(fact: ProductionCreatedProcessSourceFact): void {
  if (!collectFacts) return
  const order = productionOrders.find(item => item.productionOrderId === fact.decision.productionOrderId)
  if (!order) throw new Error('提前加工匹配缺少对应生产单，本次未保存。')
  order.productionCreatedProcessSources = [...(order.productionCreatedProcessSources || []).filter(item => item.processCode !== fact.processCode || item.workOrderId !== fact.workOrderId), structuredClone(fact)]
}
export function listProductionCreatedProcessSources(processCode: 'DYE' | 'PRINT'): ProductionCreatedProcessSourceFact[] {
  return productionOrders.flatMap(order => order.productionCreatedProcessSources || []).filter(item => item.processCode === processCode)
}
/** 后续明确取消或更新后的匹配优先；重复读取不重复追加匹配操作事实。 */
export function shouldApplyProductionCreatedProcessSource(source: ProcessWorkOrderSourceSnapshot | undefined, fact: ProductionCreatedProcessSourceFact): boolean {
  if (!source || source.sourceType !== 'PRODUCTION_DEMAND' || source.matchStatus === 'CANCELLED') return false
  if (source.matchCheckedAt && source.matchCheckedAt > fact.decision.checkedAt) return false
  return !(source.matchCheckedAt === fact.decision.checkedAt && source.matchStatus === fact.decision.matchStatus
    && source.productionOrderId === fact.decision.productionOrderId)
}

