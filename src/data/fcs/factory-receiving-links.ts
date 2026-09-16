import {listPrintingWorkOrders} from './printing-task-domain.ts'
import {getPrintingReceivingConflict} from './factory-receiving.ts'
import {listWaterSolubleWorkOrders} from './water-soluble-task-domain.ts'
import {DYE_DEMO_DETAILS} from './dye-work-order-demo-details.ts'
import {capturePdaHandoverState,restorePdaHandoverState,listPdaHandoverHeads,getPdaHandoverRecordsByHead,writeBackHandoverRecord,invalidatePdaHandoverHeadCache} from './pda-handover-events.ts'
import {convertReceiptQuantity,captureFactoryReceivingData,restoreFactoryReceivingData,getFactoryReceivingSource,listFactoryReceipts,listReceivingAllocations,getDyeReceivingConflict,allocateFactoryReceivedMaterial,prepareFactoryReceipt,savePreparedFactoryReceipt,type FactoryReceiptInput,type ReceivingAllocation} from './factory-receiving.ts'
import {listDyeWorkOrders} from './dyeing-task-domain.ts'
import {readWoolStore} from './wool-domain/store.ts'
export function listReceivingAllocationTargets(receiptLineId:string){
 const receipt=listFactoryReceipts().find(r=>r.lines.some(l=>l.id===receiptLineId)),line=receipt?.lines.find(l=>l.id===receiptLineId)
 if(!receipt||!line||line.printingOrderId||line.dyeOrderId||line.waterOrderId||line.woolOrderId)return []
 if(receipt.factoryId==='OWN_WOOL_FACTORY')return Object.values(readWoolStore().workOrders).filter(o=>o.factoryId===receipt.factoryId&&o.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku))).map(o=>({id:o.woolOrderId,no:o.woolOrderNo,kind:'wool' as const}))
 return [...listPrintingWorkOrders().filter(o=>o.printFactoryId===receipt.factoryId&&o.plannedInput.sku===line.material.sku&&!o.manuallyCompletedAt&&o.processingStatus!=='CANCELLED'&&!getPrintingReceivingConflict(o.workOrderId,line.material.sku,line.origin)).map(o=>({id:o.workOrderId,no:o.printOrderNo,kind:'printing' as const})),...listWaterSolubleWorkOrders().filter(o=>o.factoryId===receipt.factoryId&&o.materialCode===line.material.sku&&o.status!=='DONE').map(o=>({id:o.waterOrderId,no:o.waterOrderNo,kind:'water' as const})),...listDyeWorkOrders().filter(o=>o.dyeFactoryId===receipt.factoryId&&(DYE_DEMO_DETAILS[o.dyeOrderId]?.rawSku||o.rawMaterialSku)===line.material.sku&&!getDyeReceivingConflict(o.dyeOrderId,line.material.sku,line.origin)&&!['COMPLETED','REJECTED'].includes(o.status)).map(o=>({id:o.dyeOrderId,no:o.dyeOrderNo,kind:'dye' as const}))]
}
export function allocateReceivedMaterialToOrder(input:ReceivingAllocation){
 if(!listReceivingAllocationTargets(input.receiptLineId).some(t=>t.id===(input.printingOrderId||input.dyeOrderId||input.waterOrderId||input.woolOrderId)))throw new Error('请选择本厂、同一物料 SKU 的有效加工单；染色和印花单还须来自同一上游。')
 allocateFactoryReceivedMaterial(input)
}
export function confirmFactoryMaterialReceipt(input:FactoryReceiptInput){
 const receipt=prepareFactoryReceipt(input)
 if(input.factoryId==='OWN_WOOL_FACTORY'){
  const store=readWoolStore()
  for(const line of receipt.lines){if(line.material.kind!=='YARN'||!line.yarn)throw new Error('毛织接收来纱必须有 pcs、毛重和净重。');if(line.woolOrderId){const order=store.workOrders[line.woolOrderId];if(!order||order.factoryId!==input.factoryId||!order.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku)))throw new Error('纱线与毛织加工单不匹配，请核对来源关联。')}}
 }
 for(const line of receipt.lines)if(line.printingOrderId){const order=listPrintingWorkOrders().find(o=>o.workOrderId===line.printingOrderId);if(!order||order.printFactoryId!==input.factoryId||order.plannedInput.sku!==line.material.sku||order.manuallyCompletedAt||order.processingStatus==='CANCELLED')throw new Error('来货与本厂印花加工单、投入 SKU 或当前状态不匹配，请核对来源。')}
 const linked=[...new Set(receipt.lines.map(l=>l.sourceId))].flatMap(id=>{const source=getFactoryReceivingSource(id);return source?.originalRecordId?[source]:[]})
 const snapshot=linked.length?{factory:captureFactoryReceivingData(),pda:capturePdaHandoverState()}:undefined
 try{
  for(const source of linked){
   const record=listPdaHandoverHeads().flatMap(h=>getPdaHandoverRecordsByHead(h.handoverId)).find(r=>(r.handoverRecordId||r.recordId)===source.originalRecordId)
   if(!record)throw new Error('原交出记录无法定位，请先核对上游单据。')
   if((record.receiverWrittenAt||record.warehouseWrittenAt)&&!listFactoryReceipts().some(r=>r.lines.some(l=>l.sourceId===source.id)))throw new Error('此交接已在其他接收入口登记，请核对原入仓记录，不能再次入仓。')
  }
  savePreparedFactoryReceipt(receipt)
  for(const source of linked){
   const lines=listFactoryReceipts().flatMap(r=>r.lines).filter(l=>l.sourceId===source.id)
   const record=listPdaHandoverHeads().flatMap(h=>getPdaHandoverRecordsByHead(h.handoverId)).find(r=>(r.handoverRecordId||r.recordId)===source.originalRecordId)!
   const qty=lines.reduce((n,l)=>{const converted=convertReceiptQuantity(l.businessQty??l.qty,l.businessUnit||l.unit,record.qtyUnit||source.lines.find(s=>s.id===l.sourceLineId)?.unit||l.unit);if(converted===undefined)throw new Error('原交出单位与实收单位无法换算，请先核对计量单位。');return n+converted},0)
   writeBackHandoverRecord({handoverRecordId:source.originalRecordId!,receiverWrittenQty:qty,receiverWrittenAt:input.receivedAt,receiverWrittenBy:input.operatorName,receiverRemark:input.remark,diffReason:input.remark})
  }
  invalidatePdaHandoverHeadCache();return receipt
 }catch(error){if(snapshot){restoreFactoryReceivingData(snapshot.factory);restorePdaHandoverState(snapshot.pda)}throw error}

}
export function remainingReceivingAllocationQty(id:string){const line=listFactoryReceipts().flatMap(r=>r.lines).find(l=>l.id===id);return Math.max(0,(line?.qty||0)-listReceivingAllocations().filter(a=>a.receiptLineId===id).reduce((n,a)=>n+a.qty,0))}
