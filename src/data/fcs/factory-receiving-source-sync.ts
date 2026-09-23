import {withProcessOrderTaskRelationRead} from './process-order-task-links.ts'
import {syncTmfUpstreamReceivingSources} from './tmf-upstream-receiving.ts'
import {getPreparationMaterialReceiptSources} from './preparation-material-receipt-sources.ts'
import {listFactoryReceivingSources,listFactoryReceipts,listFactoryDeliveryNotes,getPrintingReceivingConflict} from './factory-receiving.ts'
import {listPrintingWorkOrders} from './printing-task-domain.ts'
import {buildWarehouseExecutionDocumentSnapshot,type WarehouseExecutionDoc} from './warehouse-material-execution.ts'
import {listDyeWorkOrders,getDyeDispatchMaterial} from './dyeing-task-domain.ts'
import {listWaterSolubleWorkOrders,getWaterSolubleReceivingMaterial} from './water-soluble-task-domain.ts'
import {getFactoryReceivingSource,registerFactoryReceivingSource} from './factory-receiving.ts'
import type {FactoryReceivingSource} from './factory-receiving-types.ts'

/** Import the current upstream document snapshot. A plan or ready-to-pick row is never an approval. */
export function syncFactoryReceivingWarehouseSources(docs?:WarehouseExecutionDoc[]):void {
 syncTmfUpstreamReceivingSources()
 const dyes=listDyeWorkOrders(),waters=listWaterSolubleWorkOrders(),prints=listPrintingWorkOrders()
 const snapshot=docs?undefined:buildWarehouseExecutionDocumentSnapshot()
 // Bind only actual, already registered upstream dispatches on the same material route.
 withProcessOrderTaskRelationRead(() => {
 for(const print of prints){
  const options=getPreparationMaterialReceiptSources(print.workOrderId,print.plannedInput.qtyUnit,[],{},docs??[...snapshot!.issueOrders,...snapshot!.internalTransferOrders]).options.filter(o=>o.sourceType==='UPSTREAM_HANDOUT')
  for(const option of options){
   const source=listFactoryReceivingSources(print.printFactoryId).find(s=>s.originalRecordId===option.recordId)
   if(!source||source.lines.some(l=>l.material.sku!==print.plannedInput.sku||l.dyeOrderId||l.waterOrderId||l.woolOrderId||l.printingOrderId&&l.printingOrderId!==print.workOrderId))continue
   if(listFactoryDeliveryNotes().some(d=>d.lines.some(l=>l.sourceId===source.id))||listFactoryReceipts().some(r=>r.lines.some(l=>l.sourceId===source.id))||getPrintingReceivingConflict(print.workOrderId,print.plannedInput.sku,source.origin))continue
   registerFactoryReceivingSource({...source,processCode:'PRINT',lines:source.lines.map(l=>({...l,printingOrderId:print.workOrderId}))})
  }
 }
 })
 for(const doc of docs??[...snapshot!.issueOrders,...snapshot!.internalTransferOrders]){
  if(doc.docType==='RETURN'||doc.receivingSourceId||!doc.targetFactoryId||!doc.warehouseId||!doc.warehouseName||!doc.approvedAt)continue
  const dye=dyes.find(o=>o.taskId===doc.runtimeTaskId||o.taskId===doc.baseTaskId)
  const water=waters.find(o=>o.taskId===doc.runtimeTaskId||o.taskId===doc.baseTaskId)
  const print=prints.find(o=>o.taskNo===doc.taskNo||o.workOrderId===doc.baseTaskId||o.taskNo===doc.runtimeTaskId)
  if(!dye&&!water&&!print)continue
  if(print&&doc.targetFactoryId!==print.printFactoryId)continue
  // Already received historical fixtures remain in their original balance, not a second incoming shipment.
  if((dye?.materialReceipts??water?.materialReceipts??print?.actualInput.receipts)?.some(r=>!r.receiptId.startsWith('FRP-'))&&!getFactoryReceivingSource(`UPSTREAM-${doc.id}`))continue
  const id=`UPSTREAM-${doc.id}`
  const lines:FactoryReceivingSource['lines']=doc.lines.map(l=>{
   const material=l.receivingMaterial??(print?{sku:print.plannedInput.sku,name:print.plannedInput.materialName,kind:(print.plannedInput.objectType==='纱线'?'YARN':print.plannedInput.objectType==='面料'?'FABRIC':'ACCESSORY') as 'YARN'|'FABRIC'|'ACCESSORY',imageUrl:print.plannedInput.imageUrl,color:'原单未记录',composition:print.plannedInput.composition||'原单未记录',specification:`${print.plannedInput.gsm} g/㎡ / ${print.plannedInput.widthCm} cm`,batchNo:doc.docNo}:water?getWaterSolubleReceivingMaterial(water.waterOrderId):getDyeDispatchMaterial(dye!.dyeOrderId))
   return {id:`${id}-${l.lineId}`,material:{...material,sku:l.skuCode||l.materialCode||material.sku},plannedQty:l.plannedQty,sentQty:doc.docType==='ISSUE'?l.issuedQty:l.transferredQty,unit:l.unit,rolls:l.receivingRolls??[],label:doc.docNo,waterOrderId:water?.waterOrderId,dyeOrderId:dye?.dyeOrderId,printingOrderId:print?.workOrderId,productionOrderNo:doc.productionOrderId,taskNo:doc.taskNo}
  })
  if(print&&lines.some(l=>l.material.sku!==print.plannedInput.sku))continue
  registerFactoryReceivingSource({id,processCode:print?'PRINT':undefined,documentNo:doc.docNo,type:doc.docType==='ISSUE'?'ISSUE':'TRANSFER',origin:{kind:'WAREHOUSE',id:doc.warehouseId,name:doc.warehouseName,warehouseAttribute:/辅料/.test(doc.warehouseName)?'辅料中央仓':/纱线/.test(doc.warehouseName)?'纱线中央仓':'面料中央仓'},targetFactoryId:doc.targetFactoryId,targetFactoryName:doc.targetFactoryName!,createdAt:doc.createdAt,createdBy:doc.approvedBy||'仓库审核员',approvedAt:doc.approvedAt,approvedBy:doc.approvedBy,lines})
 }
}
