import {prepareFactoryReceipt,savePreparedFactoryReceipt,type FactoryReceiptInput} from './factory-receiving.ts'
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
/** Compatibility entry: scalar quantities cannot describe rolls, actual weights or positions. */
export function receiveDyeMaterial(orderId:string,input:{qty:number;receiptId:string;upstreamRecordId?:string;operatorName:string;factoryReceipt?:FactoryReceiptInput}) {
  if(!input.factoryReceipt)throw new Error('请进入本厂待接收，按原卷码、实收数量和库位登记。旧数量入口已停用。')
  const order=getDyeWorkOrderById(orderId),draft=input.factoryReceipt
  if(!order||order.dyeFactoryId!==draft.factoryId)throw new Error('接收工厂与染色加工单不一致。')
  const receipt=prepareFactoryReceipt(draft)
  if(receipt.lines.some(l=>l.dyeOrderId!==orderId))throw new Error('来源明细未关联当前染色加工单，请从本厂待接收登记备料。')
  savePreparedFactoryReceipt(receipt)
  return getDyeWorkOrderById(orderId)
}
