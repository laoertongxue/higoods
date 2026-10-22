import { readFactoryQcState } from './factory-qc-records.ts'
import { productionOrders } from './production-orders.ts'
import { type FactoryQcState, type StenterHandfeelOrder } from './factory-qc-model.ts'

let printingRead: FactoryQcState | undefined
/** Keep one committed snapshot for one synchronous render, never across an action. */
export function withPrintingHandfeelRead<T>(read: () => T): T {
  const previous = printingRead
  printingRead = previous || readFactoryQcState()
  try { return read() } finally { printingRead = previous }
}
const snapshot = () => printingRead || readFactoryQcState()
export function printingHandfeelOrders(printOrderId: string): StenterHandfeelOrder[] {
  return snapshot().handfeelOrders.filter(order => order.source.kind === 'PRINTING' && order.source.id === printOrderId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}
/** A processing requirement changes the displayed next stop, not actual handout/receipt facts. */
export function printingDownstreamNames(printOrderId: string, fallback: string): string[] {
  const orders = printingHandfeelOrders(printOrderId)
  return [...new Set((orders.length ? orders.map(order => order.factoryName) : [fallback]).filter(Boolean))]
}
export function printingHandfeelLogs(printOrderId: string) {
  const state = snapshot(), orders = new Map(state.qcOrders.filter(order => order.source.kind === 'PRINTING' && order.source.id === printOrderId).map(order => [order.id, order]))
  return state.actions.filter(action => action.kind === 'DECIDE' && action.qcId && orders.has(action.qcId)).map(action => ({
    id: action.id, operatedAt: action.at, operatorName: action.by, action: '记录整单手感决定',
    remark: action.note || `来源QC ${orders.get(action.qcId!)!.no}`,
  }))
}
const canonicalVersion = (id: string) => id.replace(/^TDV-DEMAND-/, 'tdv_demand_')
export function technicalHandfeelOrders(technicalVersionId: string, productionOrderId?: string): StenterHandfeelOrder[] {
  if (!technicalVersionId) return []
  return readFactoryQcState().handfeelOrders.filter(order => {
    const boundVersion = order.source.techPackVersionId || productionOrders.find(item => item.productionOrderId === order.source.productionOrderId)?.techPackSnapshot?.sourceTechPackVersionId
    return !!boundVersion && canonicalVersion(boundVersion) === canonicalVersion(technicalVersionId)
      && (!productionOrderId || order.source.productionOrderId === productionOrderId)
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}
