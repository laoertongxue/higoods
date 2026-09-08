import { getProcessOrderTaskRelationView } from './process-order-task-links.ts'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'

// 仅把明确前置加工单映射到它的原交出记录，不按物料、工厂或计划量猜来源。
export function getPreparationMaterialReceiptSources(orderId: string, qtyUnit: string) {
  const relation = getProcessOrderTaskRelationView(orderId)
  const predecessors = relation?.predecessors ?? []
  const heads = listPdaHandoverHeads().filter(head => head.headType === 'HANDOUT' && predecessors.some(doc => doc.documentId === head.taskId || doc.documentNo === head.taskNo || doc.documentNo === head.sourceTaskNo))
  const options = heads.flatMap(head => getPdaHandoverRecordsByHead(head.handoverId).map(record => ({ ...record, qtyUnit: record.qtyUnit || head.qtyUnit }))).filter(record => record.handoverRecordStatus !== 'VOIDED').map(record => ({
    recordId: record.handoverRecordId || record.recordId,
    label: record.handoverRecordNo || record.recordId,
    unit: record.qtyUnit || '',
    availableQty: Math.max((record.submittedQty ?? record.plannedQty ?? 0) - (record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0), 0),
  })).filter(record => record.unit === qtyUnit && record.availableQty > 0)
  return { requiresUpstream: predecessors.length > 0 || Boolean(relation?.pendingPredecessors.length), options }
}
