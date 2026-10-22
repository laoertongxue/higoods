import assert from 'node:assert/strict'
import test from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { getPostFinishingAuthorizationDisplay } from '../../src/data/fcs/post-finishing-authorization.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'

// Current public return → fixed-standard QC → item processing → direct outbound contracts.
// The former recheck assertions are translated to allocation/dispatch/receipt; no new recheck is executed.
const actors=flow.POST_FINISHING_ACCEPTANCE_ACTORS,chain=['开扣眼','装扣子','熨烫','包装'] as const
const now=Date.parse('2026-10-19T08:00:00+08:00')
const originalPlans=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map(source=>source.skus.map(sku=>sku.plannedQty))
test.before(async()=>{await ensureQualityManagementRecords()})
test.afterEach(()=>flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((source,i)=>source.skus.forEach((sku,j)=>{sku.plannedQty=originalPlans[i][j]})))
function createQc(items:string[],quantities=[1000,0,0,0,0],allDefect=false){
 flow.resetPostFinishingFullFlow();const source=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
 source.skus.forEach((sku,i)=>{sku.plannedQty=Math.max(originalPlans[0][i],quantities[i] || 0)})
 const delivery=flow.registerPostFinishingFactoryReturn({productionOrderNo:source.productionOrderNo,executionTaskId:source.executionTaskId,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'MULTIPLE-OUTBOUND-SOURCE',quantities:source.skus.map((sku,i)=>({skuId:sku.skuId,registeredQty:quantities[i] || 0})),deliveryPersonName:'多次出货隔离送货人',deliveryPersonPhone:'',evidenceImageUrls:[source.skus[0].imageUrl],actor:actors.factoryCourier,nowMs:now})
 flow.confirmPostFinishingFactoryReturn({deliveryId:delivery.deliveryId,actor:actors.returnConfirmer,firstCounts:delivery.lines.map(line=>({skuId:line.sku.skuId,actualQty:line.registeredQty})),nowMs:now+1000})
 const qc=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:actors.sender,nowMs:now+2000}),claimed=flow.claimPostFinishingQcTask({qcTaskNo:qc.qcTaskNo,actor:actors.qcA,nowMs:now+3000})
 flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:'MULTIPLE-OUTBOUND-QC-ROUND',lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:allDefect?0:line.expectedQty,defectQty:allDefect?line.expectedQty:0,returnQty:0,issues:allDefect && line.expectedQty?[{itemId:claimed.inspection!.snapshot.items[0].id,note:'隔离全瑕疵输入'}]:[]})),nowMs:now+3500})
 flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcA,name:'隔离双签测试文件.png',url:'/test-only-signed-paper.png',nowMs:now+3600})
 const completed=flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,processItems:items,actor:actors.qcA,nowMs:now+4000})
 return {source,delivery,qc:completed,task:flow.listPostFinishingFullFlowPostTasks().find(row=>row.qcTaskId===qc.qcTaskId)}
}
function createTask(items:string[]=[...chain],quantities=[1000,0,0,0,0]){const fixture=createQc(items,quantities);assert.ok(fixture.task);return {...fixture,task:fixture.task}}
const progress=(id:string)=>flow.getPostFinishingProcessProgress(id)
function append(id:string,item:string,skuId:string,quantity:number,operationId:string){return flow.appendPostFinishingProcessCompletion({postTaskId:id,processItem:item,quantities:[{skuId,quantity}],operationId,responsible:actors.postOperator,actor:actors.postOperator,nowMs:now+10000})}
function submit(id:string,skuId:string,quantity:number,operationId:string,nowMs=now+20000){return flow.submitPostFinishingForOutbound({postTaskId:id,quantities:[{skuId,quantity}],operationId,actor:actors.postOperator,nowMs})}
function dispatch(record:flow.PostFinishingOutboundOrder,at=now+40000){return flow.dispatchPostFinishingOutboundOrder({outboundOrderId:record.outboundOrderId,actor:actors.postOperator,nowMs:at})}
function receive(record:flow.PostFinishingOutboundOrder){return flow.receivePostFinishingOutboundOrder({outboundOrderNo:record.outboundOrderNo,actor:actors.warehouseReceiver,nowMs:now+50000,receivedQuantities:record.lines.map(line=>({skuId:line.sku.skuId,receivedQty:line.outboundQty}))})}

test('PFN-005/006：无加工也生成待出货，正常量0不生成空加工或出货，复检保持退役',()=>{
 let fixture=createQc([],[100,0,0,0,0]);assert.equal(fixture.task,undefined);assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length,0)
 let out=flow.listPostFinishingFullFlowOutboundOrders();assert.equal(out.length,1);assert.equal(out[0].sourceType,'质检直达');assert.equal(out[0].status,'待出货');assert.equal(out[0].lines.reduce((n,l)=>n+l.outboundQty,0),100)
 fixture=createQc([...chain],[100,0,0,0,0],true);assert.equal(fixture.task,undefined);assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length,0);assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length,0)
})

test('PFN-028—035/039—046：D1按100/100/800三张直接出货，逐张交出接收，父状态不提前',()=>{
 const {source,delivery,task}=createTask(),skuId=source.skus[0].skuId
 ;[500,300,200,100].forEach((q,i)=>append(task.postTaskId,chain[i],skuId,q,`INITIAL-${i}`))
 const first=submit(task.postTaskId,skuId,100,'OUTBOUND-1');assert.equal(first.status,'待出货');assert.equal(progress(task.postTaskId).availableForOutboundQty,0)
 assert.throws(()=>submit(task.postTaskId,skuId,1,'NO-SUPPLY'));assert.equal(submit(task.postTaskId,skuId,100,'OUTBOUND-1').outboundOrderId,first.outboundOrderId);assert.throws(()=>submit(task.postTaskId,skuId,99,'OUTBOUND-1'))
 assert.throws(()=>receive(first),/不能|尚未|交出/);dispatch(first);dispatch(first);assert.equal(progress(task.postTaskId).availableForOutboundQty,0)
 receive(first);assert.equal(receive(first).alreadyReceived,true);assert.equal(flow.listPostFinishingWarehouseReceipts().length,1)
 assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成');assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status,'后道中')
 append(task.postTaskId,'包装',skuId,100,'PACK-SECOND');const second=submit(task.postTaskId,skuId,100,'OUTBOUND-2',now+60000);dispatch(second)
 assert.equal(flow.listPostFinishingFullFlowOutboundOrders().filter(row=>row.status==='待仓库接收').length,1)
 ;[500,700,800,800].forEach((q,i)=>append(task.postTaskId,chain[i],skuId,q,`FINISH-${i}`))
 assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status,'后道完成');assert.equal(progress(task.postTaskId).availableForOutboundQty,800);assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成')
 const third=submit(task.postTaskId,skuId,800,'OUTBOUND-3',now+120000);dispatch(third)
 const out=flow.listPostFinishingFullFlowOutboundOrders();assert.deepEqual(out.map(row=>row.lines.reduce((n,l)=>n+l.outboundQty,0)),[100,100,800]);assert.equal(new Set(out.map(row=>row.outboundOrderId)).size,3);assert.equal(new Set(out.map(row=>row.outboundOrderNo)).size,3);assert.equal(new Set(out.map(row=>row.createdAt)).size,3)
 assert.ok(out.every(row=>row.postTaskId===task.postTaskId && row.deliveryId===delivery.deliveryId && row.lines.every(l=>l.outboundQty>0)));assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length,0)
 assert.equal(flow.tracePostFinishingFullFlow(second.outboundOrderNo).outboundOrder?.outboundOrderId,second.outboundOrderId);assert.equal(flow.tracePostFinishingFullFlow(third.outboundOrderNo).outboundOrder?.outboundOrderId,third.outboundOrderId)
 assert.equal(flow.getPostFinishingWaitHandoverWarehouseRecord(third.outboundOrderId)?.outboundOrderId,third.outboundOrderId)
 receive(third);assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成');assert.equal(flow.getPostFinishingFullFlowOutboundOrder(second.outboundOrderId)?.status,'待仓库接收')
 assert.throws(()=>flow.receivePostFinishingOutboundOrder({outboundOrderNo:second.outboundOrderNo,actor:actors.postOperator,receivedQuantities:second.lines.map(line=>({skuId:line.sku.skuId,receivedQty:line.outboundQty}))}))
 receive(second);assert.equal(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成');assert.equal(flow.listPostFinishingWarehouseReceipts().length,3)
 assert.equal(progress(task.postTaskId).totalCompletedQty,1000);assert.equal(progress(task.postTaskId).totalReservedQty,1000);assert.equal(progress(task.postTaskId).availableForOutboundQty,0)
 assert.equal(flow.listPostFinishingWaitHandoverWarehouseRecords().length,3);assert.ok(flow.listPostFinishingWaitHandoverWarehouseRecords().every(row=>row.status==='已交出' && row.createdBy.actorId===actors.postOperator.actorId && row.lines.every(line=>line.availableQty===0)))
})

test('PFN-022/043/A29：加工1000只出并仓收100，父单不结束，余900仍可继续出货',()=>{
 const {source,delivery,task}=createTask(),skuId=source.skus[0].skuId;chain.forEach((item,i)=>append(task.postTaskId,item,skuId,1000,`ALL-${i}`))
 const first=submit(task.postTaskId,skuId,100,'FIRST-100');dispatch(first);receive(first);const view=progress(task.postTaskId)
 assert.equal(flow.getPostFinishingFullFlowPostTask(task.postTaskId)?.status,'后道完成');assert.deepEqual(view.processes.map(row=>row.completedQty),[1000,1000,1000,1000]);assert.equal(view.totalCompletedQty,1000);assert.equal(view.totalReservedQty,100);assert.equal(view.availableForOutboundQty,900)
 assert.equal(flow.listPostFinishingWarehouseReceipts().reduce((n,row)=>n+row.lines.reduce((m,l)=>m+l.receivedQty,0),0),100);assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成')
 const remaining=submit(task.postTaskId,skuId,900,'CONTINUE-900');assert.equal(remaining.lines.reduce((n,l)=>n+l.outboundQty,0),900);assert.equal(remaining.status,'待出货');assert.equal(progress(task.postTaskId).availableForOutboundQty,0);assert.notEqual(flow.getPostFinishingFactoryReturn(delivery.deliveryId)?.status,'已完成')
})

test('PFN-030/031/036：待出货、待仓收、已实收均持续占用；原复检/扫码/重贴命令不可执行',()=>{
 const {source,task}=createTask(['熨烫'],[100,0,0,0,0]),sku=source.skus[0];append(task.postTaskId,'熨烫',sku.skuId,100,'ALL-IRON')
 const records=Array.from({length:4},(_,i)=>submit(task.postTaskId,sku.skuId,20,`STATE-${i}`));dispatch(records[1]);dispatch(records[2]);receive(records[2]);assert.equal(progress(task.postTaskId).totalReservedQty,80);assert.equal(progress(task.postTaskId).availableForOutboundQty,20)
 assert.deepEqual(flow.listPostFinishingFullFlowOutboundOrders().map(row=>row.status),['待出货','待仓库接收','已接收入库','待出货'])
 for(const name of ['claimPostFinishingRecheckOrder','scanPostFinishingRecheckSkuBarcode','markPostFinishingRecheckSkuRelabeled','completePostFinishingRecheckOrderFullFlow'])assert.equal(Object.hasOwn(flow,name),false,`${name}不再作为可执行导出`)
 assert.equal(progress(task.postTaskId).totalReservedQty,80);assert.equal(flow.listPostFinishingFullFlowRecheckOrders().length,0)
})

test('PFN-037/038/040：空出货拒绝；仓收无效或过期授权不改实收；少收不释放已分配供给',()=>{
 const {source,task}=createTask(['包装'],[200,0,0,0,0]),skuId=source.skus[0].skuId;append(task.postTaskId,'包装',skuId,200,'PACK-200');assert.throws(()=>submit(task.postTaskId,skuId,0,'EMPTY'))
 const record=submit(task.postTaskId,skuId,100,'RESERVE-100');dispatch(record)
 const before=flow.getPostFinishingFullFlowOutboundOrder(record.outboundOrderId),time=now+180000,authorization={scanValue:getPostFinishingAuthorizationDisplay('AUTH-WH-001',time).scanPayload,differenceReason:'隔离实物复点少1',nowMs:time}
 const request=(auth:any,nowMs=time)=>flow.receivePostFinishingOutboundOrder({outboundOrderNo:record.outboundOrderNo,actor:actors.warehouseReceiver,receivedQuantities:record.lines.map(l=>({skuId:l.sku.skuId,receivedQty:99})),authorization:auth,nowMs})
 assert.throws(()=>request({scanValue:'INVALID',differenceReason:'差异'}));assert.deepEqual(flow.getPostFinishingFullFlowOutboundOrder(record.outboundOrderId),before)
 assert.throws(()=>request({...authorization,nowMs:time+60000},time+60000));assert.deepEqual(flow.getPostFinishingFullFlowOutboundOrder(record.outboundOrderId),before)
 const received=request(authorization);assert.equal(received.receipt.lines.reduce((n,l)=>n+l.receivedQty,0),99);assert.equal(flow.getPostFinishingFullFlowOutboundOrder(record.outboundOrderId)!.lines.reduce((n,l)=>n+l.outboundQty,0),100)
 assert.equal(progress(task.postTaskId).totalReservedQty,100);assert.equal(progress(task.postTaskId).availableForOutboundQty,100);assert.equal(request(authorization).alreadyReceived,true)
})

test('PFN-029/038：追加出货只能使用同SKU未分配完成量，授权不能凭空增加加工供给',()=>{
 const {source,task}=createTask(['包装'],[200,0,0,0,0]),skuId=source.skus[0].skuId;append(task.postTaskId,'包装',skuId,200,'PACK-200');submit(task.postTaskId,skuId,100,'RESERVE-100');const before=progress(task.postTaskId)
 assert.throws(()=>submit(task.postTaskId,skuId,101,'OVER-REMAINING'));assert.deepEqual(progress(task.postTaskId),before)
 const second=submit(task.postTaskId,skuId,99,'SECOND-99');assert.equal(second.lines[0].outboundQty,99);assert.equal(progress(task.postTaskId).totalReservedQty,199);assert.equal(progress(task.postTaskId).availableForOutboundQty,1)
 const noSpare=createTask(['包装'],[100,0,0,0,0]),id=noSpare.source.skus[0].skuId;append(noSpare.task.postTaskId,'包装',id,100,'NO-SPARE');submit(noSpare.task.postTaskId,id,100,'ALL-RESERVED');const full=progress(noSpare.task.postTaskId);assert.throws(()=>submit(noSpare.task.postTaskId,id,1,'NO-SUPPLY'));assert.deepEqual(progress(noSpare.task.postTaskId),full);assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length,1)
})

test('PFN-038/040/050：多SKU本次选择0不占用、不入出货明细，余量归原SKU',()=>{
 const {source,task}=createTask(['装扣子'],[10,10,0,0,0]);for(const sku of source.skus.slice(0,2))append(task.postTaskId,'装扣子',sku.skuId,10,`BUTTON-${sku.skuId}`)
 const record=flow.submitPostFinishingForOutbound({postTaskId:task.postTaskId,quantities:[{skuId:source.skus[0].skuId,quantity:0},{skuId:source.skus[1].skuId,quantity:10}],actor:actors.postOperator,operationId:'PARTIAL-ZERO',nowMs:now+20000})
 assert.deepEqual(record.lines.map(l=>({skuId:l.sku.skuId,quantity:l.outboundQty})),[{skuId:source.skus[1].skuId,quantity:10}]);assert.ok(flow.listPostFinishingWaitHandoverWarehouseRecords()[0].lines.every(line=>line.inboundQty>0));assert.equal(progress(task.postTaskId).totalReservedQty,10);assert.equal(progress(task.postTaskId).availableForOutboundQty,10)
 assert.equal(progress(task.postTaskId).lines.find(l=>l.sku.skuId===source.skus[0].skuId)!.availableForOutboundQty,10);assert.equal(progress(task.postTaskId).lines.find(l=>l.sku.skuId===source.skus[1].skuId)!.availableForOutboundQty,0)
})
