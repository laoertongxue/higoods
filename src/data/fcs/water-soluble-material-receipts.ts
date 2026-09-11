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
  return {ok:false,message:'请从染厂待接收按原单登记实收重量/卷码及库位，再返回开始水溶。'}
}
