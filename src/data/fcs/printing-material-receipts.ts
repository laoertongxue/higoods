import { listPrintingFactoryOptions } from './printing-factories.ts'
import { getPrintingWorkOrderById, listPrintingWorkOrders } from './printing-task-domain.ts'
import { listFactoryReceivingSources, getSourceActualReceipts, convertReceiptQuantity, getFactoryReceivingSource, registerFactoryReceivingSource } from './factory-receiving.ts'
import type { PreparationMaterialReceiptSourceResult } from './preparation-material-receipt-sources.ts'
import type {FactoryReceivingSource} from './factory-receiving-types.ts'
/** Explicit prototype incoming documents; only missing examples are seeded, never overwrite receipt history. */
export function ensurePrintingReceivingExamples():void {
 const first=getPrintingWorkOrderById('PWO-PRINT-001'),second=getPrintingWorkOrderById('PWO-PRINT-002')
 if(!first||!second)return
 const specs=[{id:'PRINT-SRC-001',order:first,qty:60,approved:true,attached:true},{id:'PRINT-SRC-002',order:first,qty:40,approved:true,attached:true},{id:'PRINT-SRC-003',order:second,qty:50,approved:true,attached:true},{id:'PRINT-SRC-004',order:second,qty:50,approved:true,attached:false},{id:'PRINT-SRC-005',order:second,qty:10,approved:false,attached:false}]
 for(const spec of specs){
  if(getFactoryReceivingSource(spec.id))continue
  const o=spec.order,m=o.plannedInput
  const source:FactoryReceivingSource={id:spec.id,processCode:'PRINT',documentNo:`DB-PRINT-DEMO-${spec.id.slice(-3)}`,type:'TRANSFER',origin:{kind:'WAREHOUSE',id:'WH-FABRIC-001',name:'面料中央仓(GKP)',warehouseAttribute:'面料中央仓'},targetFactoryId:o.printFactoryId,targetFactoryName:o.printFactoryName,createdAt:'2026-09-14 08:00:00',createdBy:'原型仓库员',approvedAt:spec.approved?'2026-09-14 08:05:00':undefined,approvedBy:spec.approved?'原型审核员':undefined,handedOutAt:spec.approved?'2026-09-14 08:10:00':undefined,workOrderNo:spec.attached?o.printOrderNo:undefined,lines:[{id:`${spec.id}-L1`,material:{sku:m.sku,name:m.materialName,kind:'FABRIC',imageUrl:m.imageUrl,color:'本白',composition:m.composition||'100% 棉',specification:`幅宽 ${m.widthCm} cm / 克重 ${m.gsm} g/㎡`,batchNo:`PRINT-IN-${spec.id.slice(-3)}`},plannedQty:spec.qty,sentQty:spec.approved?spec.qty:0,unit:'Yard',rolls:[{barcode:`PRINT-RAW-${spec.id.slice(-3)}`,yard:spec.qty}],label:`PRINT-RAW-${spec.id.slice(-3)}`,printingOrderId:spec.attached?o.workOrderId:undefined,productionOrderNo:spec.attached?o.demandSource.productionOrderNo:undefined,taskNo:spec.attached?o.taskNo:undefined}]}
  registerFactoryReceivingSource(source)
 }
}
export function getPrintingMaterialReceiptOptions(orderId:string):PreparationMaterialReceiptSourceResult {
 const order=getPrintingWorkOrderById(orderId)
 const sources=order?listFactoryReceivingSources(order.printFactoryId).filter(s=>s.lines.some(l=>l.printingOrderId===orderId&&l.material.sku===order.plannedInput.sku)):[]
 return {requiresSource:true,requiresUpstream:sources.some(s=>s.type==='HANDOUT'),sourceMode:sources.length?(sources[0].type==='HANDOUT'?'UPSTREAM_HANDOUT':'CENTRAL_TRANSFER'):'UNRESOLVED',options:sources.flatMap(s=>s.lines.filter(l=>l.printingOrderId===orderId&&l.material.sku===order!.plannedInput.sku).map(l=>({sourceType:s.type==='HANDOUT'?'UPSTREAM_HANDOUT' as const:'CENTRAL_TRANSFER' as const,recordId:s.id,documentId:s.id,documentNo:s.documentNo,lineId:l.id,label:`${s.documentNo} · ${s.origin.name}`,unit:order!.plannedInput.qtyUnit,availableQty:Math.max(0,(convertReceiptQuantity(l.sentQty,l.unit,order!.plannedInput.qtyUnit)??0)-getSourceActualReceipts(s.id).filter(r=>r.sourceLineId===l.id).reduce((n,r)=>n+(convertReceiptQuantity(r.qty,r.unit,order!.plannedInput.qtyUnit)??0),0)),sourceWarehouseId:s.origin.id,sourceWarehouseName:s.origin.name}))),blockReason:sources.length?undefined:'尚无已审核或已实际交出的本单来货，请先核对上游单据。'}
}
/** Old generic quantity form cannot identify actual rolls or storage position. */
export function receivePrintingMaterial(_orderId:string,_input:{actualSku:string;receivedQty:number;receivedRollCount:number;receiverName:string;receiptId:string;upstreamRecordId:string}):never {
 throw new Error('请从印花待接收登记原卷、实际数量和本厂库位，确认接收并入库。')
}
export function printingReceivingFactoryOptions(){return listPrintingFactoryOptions(listPrintingWorkOrders()).map(factory=>({factoryId:factory.id,name:'印花仓管',id:`PRINT-RCV-${factory.id}`,label:`${factory.name} / 印花仓管`}))}
