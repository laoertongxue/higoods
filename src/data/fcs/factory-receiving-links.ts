import {listPrintingWorkOrders} from './printing-task-domain.ts'
import {getPrintingReceivingConflict} from './factory-receiving.ts'
import {listWaterSolubleWorkOrders} from './water-soluble-task-domain.ts'
import {DYE_DEMO_DETAILS} from './dye-work-order-demo-details.ts'
import {capturePdaHandoverState,restorePdaHandoverState,listPdaHandoverHeads,getPdaHandoverRecordsByHead,writeBackHandoverRecord,invalidatePdaHandoverHeadCache} from './pda-handover-events.ts'
import {convertReceiptQuantity,captureFactoryReceivingData,restoreFactoryReceivingData,getFactoryReceivingSource,listFactoryReceipts,listReceivingAllocations,getDyeReceivingConflict,allocateFactoryReceivedMaterial,prepareFactoryReceipt,savePreparedFactoryReceipt,type FactoryReceiptInput,type ReceivingAllocation} from './factory-receiving.ts'
import {listDyeWorkOrders} from './dyeing-task-domain.ts'
import {readWoolStore} from './wool-domain/store.ts'
import {getPdaSession} from './store-domain-pda.ts'
export function listReceivingAllocationTargets(receiptLineId:string){
 const receipt=listFactoryReceipts().find(r=>r.lines.some(l=>l.id===receiptLineId)),line=receipt?.lines.find(l=>l.id===receiptLineId)
 if(!receipt||!line||line.material.kind==='WOOL_PIECE'||line.printingOrderId||line.dyeOrderId||line.waterOrderId||line.woolOrderId)return []
 const woolStore=readWoolStore()
 const woolOrders=Object.values(woolStore.workOrders).filter(o=>o.stage==='KNITTING'&&o.factoryId===receipt.factoryId&&!woolStore.completions.some(c=>c.woolOrderId===o.woolOrderId))
 if(line.material.kind==='YARN'&&woolOrders.length)return woolOrders.filter(o=>o.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku))).map(o=>({id:o.woolOrderId,no:o.woolOrderNo,kind:'wool' as const}))
 return [...listPrintingWorkOrders().filter(o=>o.printFactoryId===receipt.factoryId&&o.plannedInput.sku===line.material.sku&&!o.manuallyCompletedAt&&o.processingStatus!=='CANCELLED'&&!getPrintingReceivingConflict(o.workOrderId,line.material.sku,line.origin)).map(o=>({id:o.workOrderId,no:o.printOrderNo,kind:'printing' as const})),...listWaterSolubleWorkOrders().filter(o=>o.factoryId===receipt.factoryId&&o.materialCode===line.material.sku&&o.status!=='DONE').map(o=>({id:o.waterOrderId,no:o.waterOrderNo,kind:'water' as const})),...listDyeWorkOrders().filter(o=>o.dyeFactoryId===receipt.factoryId&&(DYE_DEMO_DETAILS[o.dyeOrderId]?.rawSku||o.rawMaterialSku)===line.material.sku&&!getDyeReceivingConflict(o.dyeOrderId,line.material.sku,line.origin)&&!['COMPLETED','REJECTED'].includes(o.status)).map(o=>({id:o.dyeOrderId,no:o.dyeOrderNo,kind:'dye' as const}))]
}
export function allocateReceivedMaterialToOrder(input:ReceivingAllocation){
 const session=getPdaSession(),receipt=listFactoryReceipts().find(r=>r.lines.some(l=>l.id===input.receiptLineId))
 if(session&&receipt?.factoryId!==session.factoryId)throw new Error('当前操作人只能分配本厂实际接收的备料。')
 if(listReceivingAllocations().some(a=>a.id===input.id)){allocateFactoryReceivedMaterial(input);return}

 if(!listReceivingAllocationTargets(input.receiptLineId).some(t=>t.id===(input.printingOrderId||input.dyeOrderId||input.waterOrderId||input.woolOrderId)))throw new Error('请选择本厂、同一物料 SKU 的有效加工单；染色和印花单还须来自同一上游。')
 allocateFactoryReceivedMaterial(input)
}
export function confirmFactoryMaterialReceipt(input:FactoryReceiptInput){
 const session=getPdaSession()
 if(session&&session.factoryId!==input.factoryId)throw new Error('当前操作人只能接收本厂来货，请核对登录工厂。')
 const receipt=prepareFactoryReceipt(input)
 if(listFactoryReceipts(input.factoryId).some(saved=>saved.id===receipt.id))return receipt
 const store=readWoolStore()
 for(const line of receipt.lines){
  if(line.material.kind==='WOOL_PIECE'){
   const source=getFactoryReceivingSource(line.sourceId)!
   if(line.woolOrderId&&store.completions.some(completion=>completion.woolOrderId===line.woolOrderId))throw new Error('该加工单已经完单，不能继续接收。')
   if(line.woolOrderId){
    const order=store.workOrders[line.woolOrderId],piece=order?.externalPieces.find(piece=>piece.pieceKey===line.woolPieceKey),last=piece?.routeNodes.at(-1)
    if(!order||order.stage!=='LINKING'||order.factoryId!==input.factoryId||!piece||!last||last.sourceEntryId!==line.woolRouteNodeId||source.origin.id!==last.factoryId)throw new Error('回货片与本厂缝盘单、末道工艺或交出厂不匹配。')
   }else{
    const found=Object.values(store.workOrders).filter(order=>order.stage==='KNITTING').some(order=>order.externalPieces.some(piece=>piece.pieceKey===line.woolPieceKey&&piece.routeNodes.some(node=>node.sourceEntryId===line.woolRouteNodeId&&node.taskOrderId===line.woolCraftOrderId&&node.factoryId===input.factoryId)))
    if(!found)throw new Error('外发片与本厂已派工节点不匹配，请核对片、工艺及接收加工单。')
   }
   const original=store.handovers.find(handover=>handover.handoverId===source.originalRecordId)
   if(original&&(original.pieceKey!==line.woolPieceKey||original.receiverId!==input.factoryId||original.routeNodeId!==line.woolRouteNodeId||original.targetWorkOrderId!==line.woolCraftOrderId||source.origin.id!==store.workOrders[original.woolOrderId]?.factoryId||source.lines.reduce((qty,item)=>qty+item.sentQty,0)>original.handoverQty))throw new Error('来货来源与横机实际交出明细不一致。')
   if(!original){
    const handover=store.craftRecords.find(record=>record.recordId===source.originalRecordId&&record.action==='HANDOVER')
    if(!handover||handover.pieceKey!==line.woolPieceKey||handover.targetFactoryId!==input.factoryId||handover.targetOrderId!==(line.woolOrderId||line.woolCraftOrderId)||source.lines.reduce((qty,item)=>qty+item.sentQty,0)>handover.qty)throw new Error('来货必须对应实际工艺交出，且接收工厂、片、目标单和数量一致。')
    const sender=store.workOrders[handover.woolOrderId]?.externalPieces.find(piece=>piece.pieceKey===handover.pieceKey)?.routeNodes.find(node=>node.sourceEntryId===handover.routeNodeId)
    if(!sender||sender.factoryId!==source.origin.id)throw new Error('来源交出厂与实际工艺节点不一致。')
    if(line.woolOrderId&&handover.routeNodeId!==line.woolRouteNodeId)throw new Error('最终回货必须来自该片末道工艺的实际交出。')
   }
  }else if(line.woolOrderId){
   const order=store.workOrders[line.woolOrderId]
   if(line.material.kind!=='YARN'||!line.yarn||!order||order.stage!=='KNITTING'||order.factoryId!==input.factoryId||store.completions.some(completion=>completion.woolOrderId===order.woolOrderId)||!order.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku)))throw new Error('纱线与本厂横机加工单不匹配或加工单已完单，请核对来源关联。')
  }
 }
 for(const line of receipt.lines)if(line.printingOrderId){const order=listPrintingWorkOrders().find(o=>o.workOrderId===line.printingOrderId);if(!order||order.printFactoryId!==input.factoryId||order.plannedInput.sku!==line.material.sku||order.manuallyCompletedAt||order.processingStatus==='CANCELLED')throw new Error('来货与本厂印花加工单、投入 SKU 或当前状态不匹配，请核对来源。')}
 const linked=[...new Set(receipt.lines.filter(line=>line.material.kind!=='WOOL_PIECE').map(l=>l.sourceId))].flatMap(id=>{const source=getFactoryReceivingSource(id);return source?.originalRecordId?[source]:[]})
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
