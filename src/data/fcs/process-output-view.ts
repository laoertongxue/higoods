import type { DyeWorkOrderOnlineRow } from './dye-work-order-online-view.ts'
/** 两个实际交出列表共用的展示字段，不改变各自加工单身份。 */
export type OutputWorkOrderRow = Pick<DyeWorkOrderOnlineRow,
 'factoryId'|'factoryName'|'workOrderNo'|'taskNo'|'productCode'|'productName'|'productImageUrl'|'productionOrderNo'|'purchaseOrderNo'|'receiverName'|'downstreamPartner'|'materialName'|'colorSku'|'outputImageUrl'|'composition'|'width'|'weightGsm'|'isYarn'|'rawMaterialQty'|'completedQty'|'qtyUnit'|'orderedAt'|'handoverRecords'> & { orderId:string; sourceType?:DyeWorkOrderOnlineRow['sourceType']; designRevisionTaskNo?:string; blockedReason?:string; materialSpec?:string }
