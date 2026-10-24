import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'
import { preparePostFinishingInventoryBridge } from '../../src/data/fcs/post-finishing-inventory-bridge.ts'
import { createFinishedInventoryBaseSeed } from '../../src/data/wls/finished-inventory-quality-seed.ts'
import { restoreFinishedInventoryState } from '../../src/data/wls/finished-inventory-records.ts'
import * as inventory from '../../src/data/wls/finished-inventory-quality.ts'
const qc={actorId:'QC-INTEGRATION',actorName:'隔离QC办理人',roleName:'QC质检员'}
const wh={actorId:'WH-INTEGRATION',actorName:'隔离成衣仓办理人',roleName:'仓库收货人员'}
let seq=0
beforeEach(async()=>{flow.resetPostFinishingFullFlow();const state=createFinishedInventoryBaseSeed();state.exclusions=[];restoreFinishedInventoryState(state);await ensureQualityManagementRecords();await preparePostFinishingInventoryBridge()})
function linesFor(task:flow.PostFinishingQcTask,passedQty:number,defectQty=0,returnQty=0){
 const summary=flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!,itemId=task.inspection!.snapshot.items[0].id
 let passed=passedQty,defect=defectQty,returned=returnQty
 const result=summary.lines.map(line=>{let available=line.uninspectedQty;const d=Math.min(defect,available);defect-=d;available-=d;const r=Math.min(returned,available);returned-=r;available-=r;const p=Math.min(passed,available);passed-=p;return {skuId:line.skuId,passedQty:p,defectQty:d,returnQty:r,issues:d+r?[{itemId,note:'隔离标准问题'}]:[]}})
 assert.equal(passed+defect+returned,0,'测试输入不能超过SKU实物可用量');return result
}
function inventoryQc(){const first=inventory.listFinishedInventoryLots()[0],preview=inventory.previewFinishedInventoryQuality(first.warehouseId,first.styleId),app=inventory.createFinishedInventoryQualityApplication({preview,operationId:`post-quality-integration-${++seq}`,actor:wh})
 const received=inventory.receiveFinishedInventoryQualityApplication({applicationId:app.id,quantities:app.lines.map(row=>({skuId:row.skuId,quantity:row.outboundQty})),actor:wh})
 return {app:received,task:flow.claimPostFinishingQcTask({qcTaskNo:received.qcTaskNo!,actor:qc})}
}
test('真实库存申请→原QC30/50/100三轮→三类分流，累计抵扣且普通升级不改其他单',()=>{
 const {app,task}=inventoryQc();assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.quantity,100)
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:qc,operationId:'integration-r1',lines:linesFor(task,27,3)})
 assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.pendingAudit!.roundNumber,1)
 assert.throws(()=>flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc}),/稽查/)
 flow.upgradePostFinishingQcInspection({qcTaskId:task.qcTaskId,actor:qc,nextPercent:50,note:'抽检发现问题，提高本批目标'})
 assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.remainingQty,20)
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:qc,operationId:'integration-r2',lines:linesFor(task,18,2)})
 assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.pendingAudit!.unqualifiedQty,2)
 flow.upgradePostFinishingQcInspection({qcTaskId:task.qcTaskId,actor:qc,nextPercent:100,note:'本批改为全检'})
 assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.remainingQty,50)
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:qc,operationId:'integration-r3',lines:linesFor(task,50)})
 const completed=flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc}),summary=flow.getPostFinishingQcInspectionSummary(completed)!
 assert.equal(completed.status,'质检完成');assert.deepEqual([summary.inspectedQty,summary.passedQty,summary.defectQty,summary.returnQty,summary.uninspectedQty,summary.releasedQty],[100,95,5,0,0,95])
 assert.equal(summary.pendingAudit,undefined);assert.equal(completed.inspection!.rounds.length,3)
 const transfers=inventory.listFinishedInventoryTransfers(app.id).filter(row=>row.category!=='送后道')
 assert.equal(transfers.find(row=>row.category==='正常返仓')!.lines.reduce((n,row)=>n+row.quantity,0),95)
 assert.equal(transfers.find(row=>row.category==='瑕疵入仓')!.lines.reduce((n,row)=>n+row.quantity,0),5)
 assert.equal(flow.getPostFinishingFullFlowQcTask(task.qcTaskId)!.inspection!.paperVersion,3)
})
test('抽检30含29合格1瑕疵：正常放行99，实检合格仍29，未检70独立',()=>{
 const {app,task}=inventoryQc()
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:qc,operationId:'sample-release',lines:linesFor(task,29,1)})
 const completed=flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc}),summary=flow.getPostFinishingQcInspectionSummary(completed)!
 assert.deepEqual([summary.quantity,summary.inspectedQty,summary.passedQty,summary.defectQty,summary.uninspectedQty,summary.releasedQty],[100,30,29,1,70,99])
 assert.equal(inventory.listFinishedInventoryTransfers(app.id).find(row=>row.category==='正常返仓')!.lines.reduce((n,row)=>n+row.quantity,0),99)
 assert.equal(completed.results!.reduce((n,row)=>n+(row.uninspectedQty || 0),0),70)
})
test('生产全检没有稽查，纸单缺失阻断；完成后唯一待出货→实际交出→仓接收',()=>{
 const source=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
 const delivery=flow.registerPostFinishingFactoryReturn({productionOrderNo:source.productionOrderNo,executionTaskId:source.executionTaskId,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'production-integration',quantities:source.skus.map(sku=>({skuId:sku.skuId,registeredQty:20})),deliveryPersonName:'隔离送货人',deliveryPersonPhone:'',evidenceImageUrls:[source.skus[0].imageUrl],actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier})
 flow.confirmPostFinishingFactoryReturn({deliveryId:delivery.deliveryId,firstCounts:delivery.lines.map(line=>({skuId:line.sku.skuId,actualQty:line.registeredQty})),actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer})
 const pending=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.sender}),task=flow.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor:qc})
 assert.equal(task.inspection!.percent,100,'默认无真实工厂履历按第一次全检')
 const n=flow.getPostFinishingQcInspectionSummary(task)!.quantity
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:qc,operationId:'production-full',lines:linesFor(task,n-1,1)})
 assert.equal(flow.getPostFinishingQcInspectionSummary(task.qcTaskId)!.pendingAudit,undefined)
 assert.throws(()=>flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc,processItems:[]}),/纸面双签/)
 flow.attachPostFinishingQcSignedPaper({qcTaskId:task.qcTaskId,actor:qc,name:'隔离双签测试文件.png',url:'/test-only-signed-paper.png'})
 const done=flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc,processItems:[]})
 const outbound=flow.listPostFinishingFullFlowOutboundOrders().filter(row=>row.qcTaskId===done.qcTaskId)
 assert.equal(outbound.length,1);assert.equal(outbound[0].status,'待出货');assert.equal(outbound[0].lines.reduce((sum,row)=>sum+row.outboundQty,0),n-1)
 const receive=()=>flow.receivePostFinishingOutboundOrder({outboundOrderNo:outbound[0].outboundOrderNo,actor:wh,receivedQuantities:outbound[0].lines.map(row=>({skuId:row.sku.skuId,receivedQty:row.outboundQty}))})
 assert.throws(receive,/不能|尚未|交出/)
 flow.dispatchPostFinishingOutboundOrder({outboundOrderId:outbound[0].outboundOrderId,actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator})
 const received=receive();assert.equal(received.outbound.status,'已接收入库');assert.equal(receive().alreadyReceived,true)
 assert.equal(flow.listPostFinishingFullFlowRecheckOrders().filter(row=>row.qcTaskId===done.qcTaskId).length,0)
 assert.throws(()=>flow.releasePostFinishingQcTask({qcTaskId:done.qcTaskId,actor:qc,reason:'不得接替'}),/不支持/)
})

test('未检足即使携带旧短少授权也不能完单；换人提交与退领均拒绝，未生成分类交接',()=>{
 const {app,task}=inventoryQc(),other={...qc,actorId:'QC-OTHER'}
 const before=flow.getPostFinishingFullFlowQcTask(task.qcTaskId),transfers=inventory.listFinishedInventoryTransfers(app.id)
 assert.throws(()=>flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:qc,authorization:{scanValue:'legacy-shortage-authorization',differenceReason:'原短少授权不得绕过应检量'}}),/应检|未检|尚需|未足/)
 assert.throws(()=>flow.claimPostFinishingQcTask({qcTaskNo:task.qcTaskNo,actor:other}),/领取|办理|占用/)
 assert.throws(()=>flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor:other,operationId:'other-user-round',lines:linesFor(task,30)}),/原领取|领取|办理/)
 assert.throws(()=>flow.releasePostFinishingQcTask({qcTaskId:task.qcTaskId,actor:other,supervisor:true,reason:'不能接替'}),/不支持/)
 assert.deepEqual(flow.getPostFinishingFullFlowQcTask(task.qcTaskId),before)
 assert.deepEqual(inventory.listFinishedInventoryTransfers(app.id),transfers)
 assert.equal(transfers.filter(row=>row.category!=='送后道').length,0)
})

test('同一回货重复送检复用原领取QC，不能靠再次送检新建绕过；完成前没有出货',()=>{
 const source=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
 const delivery=flow.registerPostFinishingFactoryReturn({productionOrderNo:source.productionOrderNo,executionTaskId:source.executionTaskId,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'duplicate-send-check',quantities:source.skus.map(sku=>({skuId:sku.skuId,registeredQty:20})),deliveryPersonName:'隔离送货人',deliveryPersonPhone:'',evidenceImageUrls:[source.skus[0].imageUrl],actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier})
 flow.confirmPostFinishingFactoryReturn({deliveryId:delivery.deliveryId,firstCounts:delivery.lines.map(line=>({skuId:line.sku.skuId,actualQty:line.registeredQty})),actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer})
 const pending=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.sender}),claimed=flow.claimPostFinishingQcTask({qcTaskNo:pending.qcTaskNo,actor:qc})
 const repeated=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.sender})
 assert.equal(repeated.qcTaskId,claimed.qcTaskId);assert.equal(repeated.claimedBy!.actorId,qc.actorId)
 assert.equal(flow.listPostFinishingFullFlowQcTasks().filter(row=>row.deliveryId===delivery.deliveryId).length,1)
 assert.equal(flow.listPostFinishingFullFlowOutboundOrders().filter(row=>row.qcTaskId===claimed.qcTaskId).length,0)
 assert.throws(()=>flow.completePostFinishingQcTask({qcTaskId:claimed.qcTaskId,actor:qc,processItems:[]}),/应检|未检|尚需|未足/)
 assert.equal(flow.listPostFinishingFullFlowOutboundOrders().filter(row=>row.qcTaskId===claimed.qcTaskId).length,0)
})
