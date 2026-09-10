import { getPreparationMaterialReceiptSources } from './preparation-material-receipt-sources.ts'
import { receivePreparationHandoverForTask } from './pda-handover-events.ts'
import { getWaterSolubleWorkOrderById, getWaterSolubleCurrentAction, executeWaterSolublePdaAction, type WaterSolublePdaActionInput, type WaterSolubleActionResult } from './water-soluble-task-domain.ts'
import { validateWaterSolublePdaActor } from './water-soluble-pda-actor.ts'

export function getWaterSolubleMaterialReceiptOptions(orderId: string) {
  const order = getWaterSolubleWorkOrderById(orderId)
  return order ? getPreparationMaterialReceiptSources(
    order.waterOrderId,
    order.qtyUnit,
    (order.materialReceipts ?? []).map((item) => ({ sourceRecordId: item.upstreamRecordId, qty: item.qty })),
    { targetFactoryId: order.factoryId, targetTaskId: order.taskId, materialCodes: [order.materialCode, order.bomItemId], bomItemIds: [order.bomItemId] },
  ) : { requiresSource: true as const, requiresUpstream: false, sourceMode: 'UNRESOLVED' as const, options: [], blockReason: '未找到水溶加工单。' }
}

// 只编排已有上游交出账和水溶接收命令；原料数量快照保留上游事件引用。
export function executeWaterSolubleInputReceipt(input: Extract<WaterSolublePdaActionInput, { action: 'RECEIVE_INPUT' }>): WaterSolubleActionResult {
  const reject = (message: string): WaterSolubleActionResult => ({ ok: false, message })
  const source = getWaterSolubleMaterialReceiptOptions(input.orderId)
  const order = getWaterSolubleWorkOrderById(input.orderId)
  if (!order || order.taskId !== input.taskId || order.status !== input.expectedStatus) return reject('当前加工单或步骤已变化，请重新进入。')
  if (getWaterSolubleCurrentAction(order)?.actionCode !== input.expectedNode) return reject('当前接收动作已失效。')
  const actorError = validateWaterSolublePdaActor(input.actor, order.factoryId, 'OPERATE')
  if (actorError) return reject(actorError)
  if (!input.receiptId?.trim() || !Number.isFinite(input.qty) || Number(input.qty) <= 0) return reject('请填写本次实际接收数量。')
  if (order.materialReceipts?.some((item) => item.receiptId === input.receiptId)) return reject('本次接收已处理，请勿重复提交。')
  if (source.requiresSource && !input.upstreamRecordId) return reject(source.blockReason || '请选择本次接收的来源记录。')
  if (input.upstreamRecordId) {
    const selectedSource = source.options.find((record) => record.recordId === input.upstreamRecordId)
    if (!selectedSource) return reject('所选来源不属于本加工单，或已无可接收数量。')
    if (Number(input.qty) > selectedSource.availableQty) return reject(`接收数量不能超过来源可收数量 ${selectedSource.availableQty} ${selectedSource.unit}。`)
    if (selectedSource.sourceType === 'UPSTREAM_HANDOUT') {
    try {
      receivePreparationHandoverForTask(input.upstreamRecordId, { receiptId: input.receiptId, targetTaskOrderId: order.waterOrderId, qty: Number(input.qty), qtyUnit: order.qtyUnit, receiverName: input.actor.userName, receivedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
    } catch (error) { return reject(error instanceof Error ? error.message : '接收失败。') }
    }
  }
  return executeWaterSolublePdaAction(input)
}
