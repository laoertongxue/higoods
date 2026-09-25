import type { ProductionDemandProcessMatchDecision } from './process-work-order-domain.ts'

export interface ProductionCreatedProcessSourceFact {
  processCode: 'DYE' | 'PRINT'
  workOrderId: string
  decision: ProductionDemandProcessMatchDecision
}
export function validateProductionCreatedProcessSources(value: unknown, productionOrderId: string): void {
  if (value === undefined) return
  if (!Array.isArray(value)) throw new Error('生产单提前加工匹配来源格式错误')
  const seen = new Set<string>()
  for (const item of value) {
    const decision = item?.decision
    const key = `${item?.processCode}:${item?.workOrderId}`
    if (!item || !['DYE', 'PRINT'].includes(item.processCode) || typeof item.workOrderId !== 'string' || !item.workOrderId.trim()
      || !decision || decision.productionOrderId !== productionOrderId || !['WAIT_TECH_PACK', 'MATCHED', 'MATCH_FAILED'].includes(decision.matchStatus)
      || typeof decision.checkedAt !== 'string' || !decision.checkedAt.trim() || typeof decision.operatorName !== 'string' || !decision.operatorName.trim()
      || seen.has(key) || (decision.matchStatus === 'MATCHED' && (!decision.formalSnapshot || decision.formalSnapshot.productionOrderId !== productionOrderId))) {
      throw new Error('生产单提前加工匹配身份或冻结来源不一致')
    }
    seen.add(key)
  }
}
