import {buildWarehouseExecutionDocumentSnapshot,type WarehouseExecutionDoc} from './warehouse-material-execution.ts'
import {listDyeWorkOrders,getDyeDispatchMaterial} from './dyeing-task-domain.ts'
import {listWaterSolubleWorkOrders,getWaterSolubleReceivingMaterial} from './water-soluble-task-domain.ts'
import {getFactoryReceivingSource,registerFactoryReceivingSource} from './factory-receiving.ts'
import type {FactoryReceivingSource} from './factory-receiving-types.ts'

/** Import the current upstream document snapshot. A plan or ready-to-pick row is never an approval. */
export function syncFactoryReceivingWarehouseSources(docs?:WarehouseExecutionDoc[]):void {
 const dyes=listDyeWorkOrders(),waters=listWaterSolubleWorkOrders()
 const snapshot=docs?undefined:buildWarehouseExecutionDocumentSnapshot()
 for(const doc of docs??[...snapshot!.issueOrders,...snapshot!.internalTransferOrders]){
  if(doc.docType==='RETURN'||doc.receivingSourceId||!doc.targetFactoryId||!doc.warehouseId||!doc.warehouseName||!doc.approvedAt)continue
  const dye=dyes.find(o=>o.taskId===doc.runtimeTaskId||o.taskId===doc.baseTaskId)
  const water=waters.find(o=>o.taskId===doc.runtimeTaskId||o.taskId===doc.baseTaskId)
  if(!dye&&!water)continue
  // Already received historical fixtures remain in their original balance, not a second incoming shipment.
  if((dye?.materialReceipts??water?.materialReceipts)?.some(r=>!r.receiptId.startsWith('FRP-'))&&!getFactoryReceivingSource(`UPSTREAM-${doc.id}`))continue
  const id=`UPSTREAM-${doc.id}`
  const lines:FactoryReceivingSource['lines']=doc.lines.map(l=>{
   const material=l.receivingMaterial??(water?getWaterSolubleReceivingMaterial(water.waterOrderId):getDyeDispatchMaterial(dye!.dyeOrderId))
   return {id:`${id}-${l.lineId}`,material:{...material,sku:l.skuCode||l.materialCode||material.sku},plannedQty:l.plannedQty,sentQty:doc.docType==='ISSUE'?l.issuedQty:l.transferredQty,unit:l.unit,rolls:l.receivingRolls??[],label:doc.docNo,waterOrderId:water?.waterOrderId,dyeOrderId:dye?.dyeOrderId,productionOrderNo:doc.productionOrderId,taskNo:doc.taskNo}
  })
  registerFactoryReceivingSource({id,documentNo:doc.docNo,type:doc.docType==='ISSUE'?'ISSUE':'TRANSFER',origin:{kind:'WAREHOUSE',id:doc.warehouseId,name:doc.warehouseName,warehouseAttribute:/辅料/.test(doc.warehouseName)?'辅料中央仓':/纱线/.test(doc.warehouseName)?'纱线中央仓':'面料中央仓'},targetFactoryId:doc.targetFactoryId,targetFactoryName:doc.targetFactoryName!,createdAt:doc.createdAt,createdBy:doc.approvedBy||'仓库审核员',approvedAt:doc.approvedAt,approvedBy:doc.approvedBy,lines})
 }
}
