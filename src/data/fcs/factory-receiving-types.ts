import type {DyePartner} from './dye-work-order-demo-details.ts'
import type {YarnWeight, YarnTubeCounts} from './yarn-weight.ts'
export type ReceivingMaterialKind = 'FABRIC' | 'ACCESSORY' | 'YARN'
export interface ReceivingMaterial {
  sku: string; name: string; kind: ReceivingMaterialKind; imageUrl: string; color: string
  composition: string; specification: string; batchNo: string
}
export interface SourceRoll {barcode:string; yard:number}
export interface FactoryReceivingSourceLine {
  id:string; material:ReceivingMaterial; plannedQty:number; unit:string; sentQty:number
  rolls:SourceRoll[]; label:string; yarn?:YarnWeight
  dyeOrderId?:string;waterOrderId?:string; woolOrderId?:string; productionOrderNo?:string; taskNo?:string
}
export interface FactoryReceivingSource {
  id:string; documentNo:string; type:'TRANSFER'|'ISSUE'|'HANDOUT'; origin:DyePartner
  targetFactoryId:string; targetFactoryName:string; createdAt:string; createdBy:string
  approvedAt?:string; approvedBy?:string; handedOutAt?:string; voidedAt?:string
  waterBatchId?:string;lines:FactoryReceivingSourceLine[]; workOrderNo?:string; originalRecordId?:string
}
export interface FactoryDeliveryLine {
  id:string; sourceId:string; sourceLineId:string; qty:number; unit:string; rollBarcodes:string[]
}
export interface FactoryDeliveryNote {
  id:string; barcode:string; deliveredAt:string; createdBy:string; lines:FactoryDeliveryLine[]
}
export interface ReceiptPosition {warehouseId:string;locationId:string}
export interface ReceiptRoll extends ReceiptPosition {barcode:string;yard:number}
export interface FactoryReceiptLineInput extends ReceiptPosition {
  sourceId:string;sourceLineId:string;deliveryLineId?:string;rolls?:ReceiptRoll[]
  businessQty?:number;businessUnit?:string;weightKg?:number;grossKg?:number;tubes?:YarnTubeCounts;pcs?:number
}
export interface FactoryReceiptInput {
  id:string; factoryId:string;operatorName:string;operatorId:string;receivedAt:string
  deliveryId?:string;remark:string;lines:FactoryReceiptLineInput[]
}
export interface FactoryReceiptLine extends FactoryReceiptLineInput {
  id:string; material:ReceivingMaterial; qty:number;unit:'Yard'|'kg';yarn?:YarnWeight
  sourceDocumentNo:string; sourceType:FactoryReceivingSource['type']; origin:DyePartner
  dyeOrderId?:string;waterOrderId?:string;woolOrderId?:string;productionOrderNo?:string;taskNo?:string
}
export interface FactoryReceipt extends Omit<FactoryReceiptInput,'lines'> {lines:FactoryReceiptLine[]; fingerprint:string}
export interface ReceivingAllocation {id:string;receiptLineId:string;dyeOrderId?:string;waterOrderId?:string;woolOrderId?:string;qty:number;operatorName:string;at:string}
