import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root='/Users/laoer/.codex/worktrees/81b7/higoods';
const fixed=Date.parse('2026-10-20T03:00:00+08:00'), RealDate=Date;
globalThis.Date=class extends RealDate {constructor(...args){if(args.length)super(...args);else super(fixed)}static now(){return fixed}};
const load=p=>import(pathToFileURL(root+'/'+p).href);
const f=await load('src/data/fcs/post-finishing-full-flow.ts'),v=await load('src/data/fcs/post-finishing-current-read-model.ts');
await load('src/data/fcs/special-craft-task-orders.ts');
const dye=await load('src/data/fcs/dyeing-task-domain.ts');dye.listDyeWorkOrders();
const a=f.POST_FINISHING_ACCEPTANCE_ACTORS,s=f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0],old=s.skus[0].plannedQty,stages=[];
let clock=fixed;const at=()=>++clock;
function snapshot(stage){
 const tasks=v.listPostFinishingTasks(),work=v.listPostFinishingWorkOrders();
 stages.push({stage,tasks,scoped:v.listPostFinishingTasks(new Set([s.productionOrderId])),empty:v.listPostFinishingTasks(new Set()),unknown:v.listPostFinishingTasks(new Set(['UNKNOWN-PRODUCTION'])),work,point:work.map(o=>({id:v.getPostFinishingWorkOrderById(o.postOrderId),no:v.getPostFinishingWorkOrderById(o.postOrderNo),source:v.getPostFinishingWorkOrderBySourceTaskId(o.sourceTaskId)})),progress:f.listPostFinishingFullFlowPostTasks().map(t=>({id:t.postTaskId,progress:f.getPostFinishingProcessProgress(t)}))});
}
function setup(){f.resetPostFinishingFullFlow();s.skus[0].plannedQty=1000;const d=f.registerPostFinishingFactoryReturn({productionOrderNo:s.productionOrderNo,executionTaskId:s.executionTaskId,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'DIRECTORY-EQUIVALENCE',quantities:s.skus.map((q,i)=>({skuId:q.skuId,registeredQty:i?0:1000})),deliveryPersonName:'任务读取等价隔离送货人',deliveryPersonPhone:'',evidenceImageUrls:[s.skus[0].imageUrl],actor:a.factoryCourier,nowMs:at()});f.confirmPostFinishingFactoryReturn({deliveryId:d.deliveryId,firstCounts:d.lines.map(q=>({skuId:q.sku.skuId,actualQty:q.registeredQty})),actor:a.returnConfirmer,nowMs:at()});const q=f.sendPostFinishingFactoryReturnToQc({deliveryId:d.deliveryId,actor:a.sender,nowMs:at()});f.claimPostFinishingQcTask({qcTaskNo:q.qcTaskNo,actor:a.qcA,nowMs:at()});const r=f.completePostFinishingQcTask({qcTaskId:q.qcTaskId,processItems:[...f.POST_FINISHING_PROCESS_ITEMS],results:q.lines.map(l=>({skuId:l.sku.skuId,passedQty:l.expectedQty,defectQty:0,returnQty:0})),actor:a.qcA,nowMs:at()});return f.getPostFinishingFullFlowPostTask(r.postTaskId)}
function append(t,item,quantity,key){f.appendPostFinishingProcessCompletion({postTaskId:t.postTaskId,processItem:item,quantities:[{skuId:s.skus[0].skuId,quantity}],responsible:a.postOperator,actor:a.postSupervisor,operationId:key,nowMs:at()})}
function submit(t,quantity,key){return f.submitPostFinishingForRecheck({postTaskId:t.postTaskId,quantities:[{skuId:s.skus[0].skuId,quantity}],actor:a.postOperator,operationId:key,nowMs:at()})}
function finish(rc){f.claimPostFinishingRecheckOrder({recheckOrderNo:rc.recheckOrderNo,actor:a.recheckerA,nowMs:at()});for(const l of rc.lines.filter(l=>l.expectedQty>0))f.scanPostFinishingRecheckSkuBarcode({recheckOrderId:rc.recheckOrderId,skuId:l.sku.skuId,scannedBarcode:l.sku.barcode,actor:a.recheckerA,nowMs:at()});f.completePostFinishingRecheckOrderFullFlow({recheckOrderId:rc.recheckOrderId,results:rc.lines.map(l=>({skuId:l.sku.skuId,handoverQty:l.expectedQty})),actor:a.recheckerA,nowMs:at()});return f.listPostFinishingFullFlowOutboundOrders().find(o=>o.recheckOrderId===rc.recheckOrderId)}
function receive(out){f.receivePostFinishingOutboundOrder({outboundOrderNo:out.outboundOrderNo,receivedQuantities:out.lines.map(l=>({skuId:l.sku.skuId,receivedQty:l.outboundQty})),actor:a.warehouseReceiver,nowMs:at()})}
const page=await load('src/pages/print/print-preview.ts');
const types=['POST_FINISHING_OUTBOUND_ORDER','POST_FINISHING_OUTBOUND_BARCODE'];
const adapters=await Promise.all(types.map(type=>page.isolatedLoadPrintAdapter(type)));
function capture(stage,orders,output){for(const order of orders)for(const [i,type] of types.entries()){const doc=adapters[i].buildPrintDocument({documentType:type,sourceType:'POST_FINISHING_OUTBOUND_ORDER',sourceId:order.outboundOrderId});output.push({stage,type,document:doc,html:adapters[i].renderPrintDocument(doc)});}}
const output=[];
try{
 f.loadPostFinishingDemoData();capture('original-demo',f.listPostFinishingFullFlowOutboundOrders(),output);
 const t=setup();for(const [i,item] of f.POST_FINISHING_PROCESS_ITEMS.entries())append(t,item,1000,'FULL-'+i);
 const one=finish(submit(t,100,'PRINT-RC-1'));capture('first100-pending',[one],output);receive(one);capture('first100-received',[f.getPostFinishingFullFlowOutboundOrder(one.outboundOrderId)],output);
 const two=finish(submit(t,100,'PRINT-RC-2'));receive(two);
 const three=finish(submit(t,800,'PRINT-RC-3'));capture('three-independent-100-100-800',f.listPostFinishingFullFlowOutboundOrders(),output);receive(three);capture('all1000-received',f.listPostFinishingFullFlowOutboundOrders(),output);
 const errors=[];for(const [i,type] of types.entries())for(const sourceType of ['POST_FINISHING_QC_ORDER','HANDOVER_RECORD','PRODUCTION_ORDER','PICKUP_SLIP_RECORD','',undefined]){let message='';try{adapters[i].buildPrintDocument({documentType:type,sourceType,sourceId:one.outboundOrderId})}catch(error){message=error.message}assert.equal(message,`未找到打印模板：${type} / ${sourceType}`);errors.push({type,sourceType:String(sourceType),message})}
 for(const [i,type] of types.entries()){assert.throws(()=>adapters[i].buildPrintDocument({documentType:type,sourceType:'POST_FINISHING_OUTBOUND_ORDER',sourceId:'MISSING-OUTBOUND'}),/未找到后道出货单/)}
 const bytes=JSON.stringify({boundary:'Same original template builders/renderers, public command-created sources, fixed isolated clock, private adapter exposed only by Node hook; not browser/persistence/performance evidence.',output,errors});writeFileSync(process.argv[2],bytes);console.log(JSON.stringify({documents:output.length,errorSources:errors.length,missingRejected:2,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}));
}finally{s.skus[0].plannedQty=old}
