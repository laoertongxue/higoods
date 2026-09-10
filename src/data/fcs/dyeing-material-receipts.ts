import { localDateTimeText } from '../../utils.ts'
import { runDyeProcessMutation, completeDyeInputReceipt, getDyeWorkOrderById } from './dyeing-task-domain.ts'
import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'

export function getDyeMaterialReceiptOptions(orderId: string) {
  const order = getDyeWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(
    orderId,
    order.qtyUnit,
    (order.materialReceipts ?? []).map((item) => ({ sourceRecordId: item.upstreamRecordId, qty: item.qty })),
    { targetFactoryId: order.dyeFactoryId, targetTaskId: order.taskId, materialCodes: [order.rawMaterialSku, order.materialId], bomItemIds: [order.sourceSnapshot?.bomItemId, ...(order.sourceSnapshot?.bomItemIds ?? [])].filter((value): value is string => Boolean(value)) },
  ) : { requiresSource: true as const, requiresUpstream: false, sourceMode: 'UNRESOLVED' as const, options: [], blockReason: '未找到染色加工单。' }
}
export function receiveDyeMaterial(orderId: string, input: { qty: number; receiptId: string; upstreamRecordId?: string; operatorName: string }) {
  return runDyeProcessMutation(() => {
  const source = getDyeMaterialReceiptOptions(orderId)
  const order = getDyeWorkOrderById(orderId)
  if (!order || order.status === 'COMPLETED' || order.status === 'REJECTED') throw new Error('当前加工单不能接收。')
  if (!Number.isFinite(input.qty) || input.qty <= 0 || !input.receiptId.trim()) throw new Error('请填写本次实际接收数量。')
  if (order.materialReceipts?.some(item => item.receiptId === input.receiptId)) throw new Error('本次接收已处理，请勿重复提交。')
  if (source.requiresSource && !input.upstreamRecordId) throw new Error(source.blockReason || '请选择本次接收的来源记录。')
  if (input.upstreamRecordId) {
    const selectedSource = source.options.find(item => item.recordId === input.upstreamRecordId)
    if (!selectedSource) throw new Error('所选来源不属于本加工单，或已无剩余可接收数量。')
    if (input.qty > selectedSource.availableQty) throw new Error(`接收数量不能超过来源可收数量 ${selectedSource.availableQty} ${selectedSource.unit}。`)
    if (selectedSource.sourceType === 'UPSTREAM_HANDOUT') {
    receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: orderId, qty: input.qty, qtyUnit: order.qtyUnit, receiverName: input.operatorName, receivedAt: localDateTimeText() })
    }
  }
  return completeDyeInputReceipt(orderId, { outputQty: input.qty, receiptId: input.receiptId, upstreamRecordId: input.upstreamRecordId, operatorName: input.operatorName })

  })
}
