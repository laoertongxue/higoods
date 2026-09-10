import { getPrintingWorkOrderById, receivePrintingInput, validatePrintingInputReceipt } from './printing-task-domain.ts'
import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'
export function getPrintingMaterialReceiptOptions(orderId: string) {
  const order = getPrintingWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(
    orderId,
    order.plannedInput.qtyUnit,
    (order.actualInput.receipts ?? []).map((item) => ({ sourceRecordId: item.upstreamRecordId, qty: item.qty })),
    { targetFactoryId: order.printFactoryId, targetTaskId: order.taskNo, materialCodes: [order.plannedInput.sku, order.plannedInput.spu] },
  ) : { requiresSource: true as const, requiresUpstream: false, sourceMode: 'UNRESOLVED' as const, options: [], blockReason: '未找到印花加工单。' }
}
export function receivePrintingMaterial(orderId: string, input: { actualSku: string; receivedQty: number; receivedRollCount: number; receiverName: string; receiptId: string; upstreamRecordId: string }) {
  if (!input.receiptId.trim()) throw new Error('本次接收确认号已失效，请重新打开。')
  // 所有下游状态、SKU、数量、卷数与幂等校验先完成；再扣原交出可收量。
  if (!validatePrintingInputReceipt(orderId, input)) return
  const source = getPrintingMaterialReceiptOptions(orderId)
  const order = getPrintingWorkOrderById(orderId)!
  if (source.requiresSource && !input.upstreamRecordId) throw new Error(source.blockReason || '请选择本次接收的来源记录。')
  const selectedSource = source.options.find(item => item.recordId === input.upstreamRecordId)
  if (!selectedSource) throw new Error('所选来源不属于本加工单，或已无可接收数量。')
  if (input.receivedQty > selectedSource.availableQty) throw new Error(`接收数量不能超过来源可收数量 ${selectedSource.availableQty} ${selectedSource.unit}。`)
  if (selectedSource.sourceType === 'UPSTREAM_HANDOUT') {
    receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: orderId, qty: input.receivedQty, qtyUnit: order.plannedInput.qtyUnit, receiverName: input.receiverName, receivedAt: new Date().toISOString().slice(0,19).replace('T',' ') })
  }
  receivePrintingInput(orderId, input)
}
