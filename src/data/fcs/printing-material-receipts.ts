import { getPrintingWorkOrderById, receivePrintingInput, validatePrintingInputReceipt } from './printing-task-domain.ts'
import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'
export function getPrintingMaterialReceiptOptions(orderId: string) {
  const order = getPrintingWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(orderId, order.plannedInput.qtyUnit) : { requiresUpstream: true, options: [] }
}
export function receivePrintingMaterial(orderId: string, input: { actualSku: string; receivedQty: number; receivedRollCount: number; receiverName: string; receiptId: string; upstreamRecordId?: string }) {
  if (!input.receiptId.trim()) throw new Error('本次接收确认号已失效，请重新打开。')
  // 所有下游状态、SKU、数量、卷数与幂等校验先完成；再扣原交出可收量。
  if (!validatePrintingInputReceipt(orderId, input)) return
  const source = getPrintingMaterialReceiptOptions(orderId)
  const order = getPrintingWorkOrderById(orderId)!
  if (source.requiresUpstream && !input.upstreamRecordId) throw new Error('请选择上游交出记录，未交出不能接收。')
  if (input.upstreamRecordId) {
    if (!source.options.some(item => item.recordId === input.upstreamRecordId)) throw new Error('所选交出不属于正式前置，或已无可接收数量。')
    receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: orderId, qty: input.receivedQty, qtyUnit: order.plannedInput.qtyUnit, receiverName: input.receiverName, receivedAt: new Date().toISOString().slice(0,19).replace('T',' ') })
  }
  receivePrintingInput(orderId, input)
}
