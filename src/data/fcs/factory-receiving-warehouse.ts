import {listFactoryReceipts,getHistoricalReceiptPosition,listReceivingAllocations} from './factory-receiving.ts'
import type {FactoryWarehouseInboundRecord} from './factory-internal-warehouse.ts'
/** Actual receipt lines are the only inbound source; scans and deliveries never enter here. */
export function buildFactoryReceiptInboundRecords():FactoryWarehouseInboundRecord[]{
 return listFactoryReceipts().filter(r=>r.factoryId!=='OWN_WOOL_FACTORY').flatMap(receipt=>receipt.lines.filter(l=>l.qty>0).flatMap(line=>{
  const splits=line.rolls?.length?line.rolls.map(r=>({...r,qty:r.yard,barcode:r.barcode})):[{warehouseId:line.warehouseId,locationId:line.locationId,qty:line.qty,barcode:''}]
  return splits.map((split,i)=>{const p=getHistoricalReceiptPosition(receipt.factoryId,split),id=`FIN-${line.id}-${i+1}`;return {
   inboundRecordId:id,inboundRecordNo:id,warehouseId:p.warehouse.warehouseId,warehouseName:p.warehouse.warehouseName,factoryId:receipt.factoryId,factoryName:p.warehouse.factoryName,factoryKind:p.warehouse.factoryKind,
   processCode:'PROC_DYE',processName:'染色',craftCode:'DYE',craftName:'染色',sourceRecordId:id,sourceRecordNo:line.sourceDocumentNo,sourceRecordType:line.sourceType==='HANDOUT'?'HANDOVER_RECEIVE':'TRANSFER_RECEIVE',sourceObjectName:line.origin.name,
   taskId:line.taskNo,taskNo:line.taskNo,productionOrderNo:line.productionOrderNo,stockMaterialId:line.material.sku,stockMaterialName:line.material.name,itemKind:line.material.kind==='FABRIC'?'面料':line.material.kind==='YARN'?'纱线':'辅料',itemName:line.material.name,materialSku:line.material.sku,fabricColor:line.material.color,fabricRollNo:split.barcode||undefined,
   expectedQty:split.qty,receivedQty:split.qty,differenceQty:0,unit:line.unit,receiverName:receipt.operatorName,operatorUserId:receipt.operatorId,operatorFactoryId:receipt.factoryId,receivedAt:receipt.receivedAt,areaName:p.area.areaName,shelfNo:p.shelf.shelfNo,locationNo:p.location.locationNo,status:'已入库',photoList:[line.material.imageUrl],generatedStockItemId:`STK-${id}`,remark:`接收 ${receipt.id}；批次 ${line.material.batchNo}；${line.yarn?`${line.yarn.pcs} pcs，毛重 ${line.yarn.grossGrams/1000} kg，净重 ${line.qty} kg；`:''}${line.dyeOrderId?'已关联染色加工单':'备料来货，未关联加工单'}；${receipt.remark}`,
  } satisfies FactoryWarehouseInboundRecord})
 }))
}
export function getDyeFactoryReceiptProjection(orderId:string,unit:string){
 const allocations=listReceivingAllocations()
 return listFactoryReceipts().flatMap(r=>r.lines.flatMap(l=>{
  const qty=l.dyeOrderId===orderId?l.qty:allocations.filter(a=>a.receiptLineId===l.id&&a.dyeOrderId===orderId).reduce((n,a)=>n+a.qty,0)
  const associated=l.dyeOrderId===orderId||allocations.some(a=>a.receiptLineId===l.id&&a.dyeOrderId===orderId)
  const converted=l.unit.toLowerCase()===unit.toLowerCase()?qty:l.unit==='Yard'&&['米','m'].includes(unit)?qty*.9144:undefined
  return associated&&converted!==undefined?[{receiptId:`FRP-${l.id}-${orderId}`,upstreamRecordId:l.sourceId,qty:converted,receiverName:r.operatorName,receivedAt:r.receivedAt}]:[]
 }))
}
