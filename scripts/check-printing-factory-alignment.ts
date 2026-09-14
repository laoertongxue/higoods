import assert from 'node:assert/strict'
import { listPrintingWorkOrders, getPrintingWorkflowFacts, startPrintingProduction, recordPrintingProductionStage } from '../src/data/fcs/printing-task-domain.ts'
const orders=listPrintingWorkOrders()
assert(orders.length>=12)
for (const order of orders) {
 const facts=getPrintingWorkflowFacts(order.workOrderId)
 assert(facts.availableInputQty>=0)
 assert(facts.availableOutputQty>=0)
 if(!facts.startedAt&&order.actualInput.receivedQty>0&&!order.historicalInputQuantityUnknown) assert.notEqual(order.processingStatus,'PROCESSING')
}
const unreceived=orders.find(o=>o.actualInput.receivedQty===0&&!o.historicalInputQuantityUnknown)!
assert.throws(()=>startPrintingProduction(unreceived.workOrderId,{id:'CHECK-NO-STOCK',qty:1,operatorName:'检查员'}))
assert.throws(()=>recordPrintingProductionStage(unreceived.workOrderId,{id:'CHECK-EARLY-FINISH',stage:'PRINT',action:'FINISH',qty:1,operatorName:'检查员'}))
console.log('印花接收、开工与工序基础契约通过')

import { getFactoryReceivingSource, getDefaultFactoryReceiptPosition, listFactoryMaterialUses, listFactoryReceipts, getPrintingReceivingConflict, registerFactoryReceivingSource } from '../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt, allocateReceivedMaterialToOrder } from '../src/data/fcs/factory-receiving-links.ts'
import { getPrintingWorkOrderById, completePrintingWorkOrder, updatePrintingRollBarcode, createPrintingDispatch, scanPrintingDispatchRoll, confirmPrintingDispatch, listPrintingDispatchDocuments, removePrintingDispatchRoll, receivePrintingHandover } from '../src/data/fcs/printing-task-domain.ts'
const id='PWO-PRINT-001',first=getFactoryReceivingSource('PRINT-SRC-001')!,position=getDefaultFactoryReceiptPosition(first.targetFactoryId)
const receipt=(sourceId:string,qty:number,key:string)=>{
 const source=getFactoryReceivingSource(sourceId)!,line=source.lines[0]
 return confirmFactoryMaterialReceipt({id:key,factoryId:source.targetFactoryId,operatorName:'原型接收员',operatorId:'PRINT-RCV',receivedAt:'2026-09-14 09:00:00',remark:'专项实收',lines:[{sourceId,sourceLineId:line.id,...position,rolls:qty?[{...position,barcode:line.rolls[0].barcode,yard:qty}]:[]}]})
}
assert.equal(getPrintingWorkflowFacts(id).sourceQty,100,'总库存不得冒充本单供料')
receipt('PRINT-SRC-001',60,'CHECK-R1');receipt('PRINT-SRC-002',40,'CHECK-R2');receipt('PRINT-SRC-002',40,'CHECK-R2')
assert.equal(getPrintingWorkOrderById(id)!.actualInput.receivedQty,100,'幂等接收只入库一次')
assert.equal(getPrintingWorkOrderById(id)!.processingStatus,'WAIT_START')
assert.equal(listFactoryMaterialUses().filter(u=>u.printingOrderId===id).length,0,'接收不扣原料库存')
for(const stage of ['ARTWORK','SAMPLE'] as const)recordPrintingProductionStage(id,{id:`C-${stage}`,stage,action:'FINISH',operatorName:'打样员'})
startPrintingProduction(id,{id:'C-START',qty:100,operatorName:'领料员'})
assert.throws(()=>startPrintingProduction(id,{id:'C-START',qty:1,operatorName:'领料员'}))
assert.equal(listFactoryMaterialUses().filter(u=>u.printingOrderId===id).flatMap(u=>u.lines).reduce((n,l)=>n+l.qty,0),100)
recordPrintingProductionStage(id,{id:'C-PRINT-START',stage:'PRINT',action:'START',operatorName:'印制员'})
recordPrintingProductionStage(id,{id:'C-PRINT-FINISH',stage:'PRINT',action:'FINISH',qty:100,operatorName:'印制员'})
assert.equal(getPrintingWorkOrderById(id)!.output.completedQty,0,'印制完成不自动完成转印或产出')
assert.throws(()=>completePrintingWorkOrder(id,{usedQty:100,usedRollCount:2,completedQty:98,completedRollCount:3,printerNo:'P-01',operatorName:'完成员',lossQty:2}))
recordPrintingProductionStage(id,{id:'C-TRANSFER-START',stage:'TRANSFER',action:'START',operatorName:'转印员'})
recordPrintingProductionStage(id,{id:'C-TRANSFER-FINISH',stage:'TRANSFER',action:'FINISH',qty:98,operatorName:'转印员'})
completePrintingWorkOrder(id,{usedQty:100,usedRollCount:2,completedQty:98,completedRollCount:3,printerNo:'P-01',operatorName:'完成员',lossQty:2,batchId:'C-BATCH',finishOrder:true})
const rolls=getPrintingWorkOrderById(id)!.barcodes
assert(rolls.every(r=>r.lengthY===0&&r.quantityConfirmed===false),'平均拆分不能视为实测')
for(const [index,roll] of rolls.entries())updatePrintingRollBarcode(id,roll.id,{lengthY:[32,33,33][index],gsm:200,widthCm:160,vatNo:'B-001',warehouseName:'本厂待交出仓',remark:'逐卷实测'})
const doc=createPrintingDispatch([{workOrderId:id,barcodeIds:rolls.slice(0,2).map(r=>r.id)}],'建单员')
assert.equal(getPrintingWorkflowFacts(id).reservedOutputQty,65)
assert.equal(getPrintingWorkOrderById(id)!.handover.handedOverQty,0)
assert.throws(()=>confirmPrintingDispatch(doc,'交出员'),/扫齐/)
assert.throws(()=>createPrintingDispatch([{workOrderId:id,barcodeIds:[rolls[0].id]}],'建单员'),/重复/)
assert.throws(()=>scanPrintingDispatchRoll(doc,'WRONG','核对员'))
for(const roll of rolls.slice(0,2))scanPrintingDispatchRoll(doc,roll.barcode,'核对员')
assert.equal(getPrintingWorkOrderById(id)!.handover.handedOverQty,0,'扫齐不扣库存')
confirmPrintingDispatch(doc,'交出员')
assert.throws(()=>confirmPrintingDispatch(doc,'交出员'))
assert.equal(getPrintingWorkOrderById(id)!.handover.handedOverQty,65)
assert.equal(getPrintingWorkOrderById(id)!.pendingWritebackQty,65)
const secondDoc=createPrintingDispatch([{workOrderId:id,barcodeIds:[rolls[2].id]}],'建单员')
removePrintingDispatchRoll(secondDoc,id,rolls[2].id,'建单员')
assert.equal(listPrintingDispatchDocuments().find(d=>d.id===secondDoc)!.status,'已作废')
assert.equal(listPrintingDispatchDocuments().find(d=>d.id===secondDoc)!.lines.length,1,'作废留原始明细')
assert.equal(getPrintingWorkflowFacts(id).availableOutputQty,33)
receivePrintingHandover(id,{receivedQty:64,receiverName:'下游接收员',differenceReason:'实测少1'})
assert.equal(getPrintingWorkOrderById(id)!.handover.receivedQty,64)
assert.equal(getPrintingWorkOrderById(id)!.pendingWritebackQty,1)
assert.equal(getPrintingWorkOrderById(id)!.handover.handedOverQty,65,'下游实收不得再次扣本厂')
const stock=receipt('PRINT-SRC-004',50,'CHECK-STOCK'),beforeReceipts=listFactoryReceipts().length
allocateReceivedMaterialToOrder({id:'C-ALLOC',receiptLineId:stock.lines[0].id,printingOrderId:'PWO-PRINT-002',qty:20,operatorName:'分料员',at:'2026-09-14 09:01:00'})
assert.equal(listFactoryReceipts().length,beforeReceipts,'备料关联不新增入库')
assert.equal(getPrintingWorkOrderById('PWO-PRINT-002')!.actualInput.receivedQty,20)
assert(getPrintingReceivingConflict(id,'WRONG-SKU',first.origin))
assert(getPrintingReceivingConflict(id,first.lines[0].material.sku,{...first.origin,id:'OTHER'}))
console.log('PASS 完整业务闭环：实收100、开工100、分工序、产出98/损耗2、草稿65、实交65、实收64、余33、备料关联20；关键阻断和幂等')
