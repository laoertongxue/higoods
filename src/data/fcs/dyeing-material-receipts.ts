import { localDateTimeText } from '../../utils.ts'
import { runDyeProcessMutation, completeDyeMaterialReady, getDyeWorkOrderById } from './dyeing-task-domain.ts'
import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'

export function getDyeMaterialReceiptOptions(orderId: string) {
  const order = getDyeWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(orderId, order.qtyUnit) : { requiresUpstream: true, options: [] }
}
export function receiveDyeMaterial(orderId: string, input: { qty: number; receiptId: string; upstreamRecordId?: string; operatorName: string }) {
  return runDyeProcessMutation(() => {
  const source = getDyeMaterialReceiptOptions(orderId)
  const order = getDyeWorkOrderById(orderId)
  if (!order || order.status === 'COMPLETED' || order.status === 'REJECTED') throw new Error('当前加工单不能接收。')
  if (!Number.isFinite(input.qty) || input.qty <= 0 || !input.receiptId.trim()) throw new Error('请填写本次实际接收数量。')
  if (order.materialReceipts?.some(item => item.receiptId === input.receiptId)) throw new Error('本次接收已处理，请勿重复提交。')
  if (source.requiresUpstream && !input.upstreamRecordId) throw new Error('请选择上游交出记录，未交出不能接收。')
  if (input.upstreamRecordId) {
    if (!source.options.some(item => item.recordId === input.upstreamRecordId)) throw new Error('所选记录不属于本加工单前置，或已无剩余可接收数量。')
    receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: orderId, qty: input.qty, qtyUnit: order.qtyUnit, receiverName: input.operatorName, receivedAt: localDateTimeText() })
  }
  return completeDyeMaterialReady(orderId, { outputQty: input.qty, receiptId: input.receiptId, upstreamRecordId: input.upstreamRecordId, operatorName: input.operatorName })

  })
}
