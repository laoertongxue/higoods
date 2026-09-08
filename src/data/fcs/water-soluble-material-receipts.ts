import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'
import { getWaterSolubleWorkOrderById, getWaterSolubleCurrentAction, executeWaterSolublePdaAction, type WaterSolublePdaActionInput, type WaterSolubleActionResult } from './water-soluble-task-domain.ts'
import { validateWaterSolublePdaActor } from './water-soluble-pda-actor.ts'

export function getWaterSolubleMaterialReceiptOptions(orderId: string) {
  const order = getWaterSolubleWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(order.waterOrderId, order.qtyUnit) : { requiresUpstream: true, options: [] }
}

// 只编排已有上游交出账和水溶接收命令；原料数量快照保留上游事件引用。
export function executeWaterSolubleMaterialReceipt(input: Extract<WaterSolublePdaActionInput, { action: 'MATERIAL_READY' }>): WaterSolubleActionResult {
  const reject = (message: string): WaterSolubleActionResult => ({ ok: false, message })
  const source = getWaterSolubleMaterialReceiptOptions(input.orderId)
  const order = getWaterSolubleWorkOrderById(input.orderId)
  if (!order || order.taskId !== input.taskId || order.status !== input.expectedStatus) return reject('当前加工单或步骤已变化，请重新进入。')
  if (getWaterSolubleCurrentAction(order)?.actionCode !== input.expectedNode) return reject('当前接收动作已失效。')
  const actorError = validateWaterSolublePdaActor(input.actor, order.factoryId, 'OPERATE')
  if (actorError) return reject(actorError)
  if (!input.receiptId?.trim() || !Number.isFinite(input.qty) || Number(input.qty) <= 0) return reject('请填写本次实际接收数量。')
  if (order.materialReceipts?.some((item) => item.receiptId === input.receiptId)) return reject('本次接收已处理，请勿重复提交。')
  if (source.requiresUpstream && !input.upstreamRecordId) return reject('请选择本次接收的上游交出记录；未交出时不能接收。')
  if (input.upstreamRecordId) {
    if (!source.options.some((record) => record.recordId === input.upstreamRecordId)) return reject('所选交出记录不属于当前前置任务，或已无可接收数量。')
    try {
      receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: order.waterOrderId, qty: Number(input.qty), qtyUnit: order.qtyUnit, receiverName: input.actor.userName, receivedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
    } catch (error) { return reject(error instanceof Error ? error.message : '接收失败。') }
  }
  return executeWaterSolublePdaAction(input)
}
