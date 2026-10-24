import { isPreparedInventoryPostRoute } from '../../src/data/fcs/post-finishing-qc-entry.ts'
import assert from 'node:assert/strict'
import { before, beforeEach, test } from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import * as stock from '../../src/data/wls/finished-inventory-quality.ts'
import { restoreFinishedInventoryState } from '../../src/data/wls/finished-inventory-records.ts'
import { createFinishedInventoryBaseSeed as createFinishedInventorySeed } from '../../src/data/wls/finished-inventory-quality-seed.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'
const actor=flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcA, responsible=flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator
before(async()=>{await ensureQualityManagementRecords()})
beforeEach(()=>{
 flow.resetPostFinishingFullFlow();restoreFinishedInventoryState(createFinishedInventorySeed())
 stock.registerFinishedInventoryQcBridge({receiveIntoQc:flow.createInventoryPostFinishingQcTask})
 flow.registerPostFinishingInventoryQcCompletion(stock.completeFinishedInventoryQc)
 flow.registerPostFinishingInventoryPostBridge({progress:stock.updateFinishedInventoryPostProgress,shipped:stock.finishedInventoryPostShippedQuantities})
})
function complete(items:string[],rejectFirstSku:boolean|'ALL'=false,sample=false){
 const lot=stock.listFinishedInventoryLots()[0], preview=stock.previewFinishedInventoryQuality(lot.warehouseId,lot.styleId)
 const app=stock.createFinishedInventoryQualityApplication({preview,actor,operationId:crypto.randomUUID()})
 const received=stock.receiveFinishedInventoryQualityApplication({applicationId:app.id,actor,quantities:app.lines.map(line=>({skuId:line.skuId,quantity:line.outboundQty}))})
 const qc=flow.claimPostFinishingQcTask({qcTaskNo:received.qcTaskNo!,actor})
 const issue=qc.inspection!.snapshot.items[0]
 let remaining=flow.getPostFinishingQcInspectionSummary(qc.qcTaskId).remainingQty
 const lines=qc.lines.map((line,i)=>{
  const quantity=sample?Math.min(remaining,line.expectedQty):line.expectedQty;if(sample)remaining-=quantity
  const rejected=rejectFirstSku&&(i===0||rejectFirstSku==='ALL')
  return {skuId:line.sku.skuId,passedQty:rejected?0:quantity,defectQty:rejected?quantity:0,returnQty:0,issues:rejected&&quantity?[{itemId:issue.id,reason:'逐件缺陷核实',evidenceUrls:[line.sku.imageUrl]}]:[]}
 })
 flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor,operationId:'ROUND',lines})
 if(flow.getPostFinishingQcInspectionSummary(qc.qcTaskId).pendingAudit)flow.upgradePostFinishingQcInspection({qcTaskId:qc.qcTaskId,actor,nextPercent:100,note:'全部实检边界'})
 const done=flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor,processItems:items})
 return {app:stock.getFinishedInventoryApplication(app.id)!,qc:done,task:done.postTaskId?flow.getPostFinishingFullFlowPostTask(done.postTaskId)!:undefined}
}
test('库存QC不选加工项直接分类出货，没有加工单或第二份出货事实',()=>{
 const {app,task}=complete([]);assert.equal(task,undefined);assert.equal(app.postTaskId,undefined)
 const normal=stock.listFinishedInventoryTransfers(app.id).find(row=>row.category==='正常返仓')!
 assert.ok(stock.shipFinishedInventoryTransfer({transferId:normal.id,actor}).shippedAt)
 assert.equal(flow.listPostFinishingFullFlowOutboundOrders().some(row=>row.qcTaskId===app.qcTaskId),false)
})
test('所选项目按顺序加工，只加工正常放行SKU，未完成阻止返仓且禁止另建分批出货',()=>{
 const {app,task}=complete(['包装','熨烫'],true);assert.ok(task)
 assert.equal(isPreparedInventoryPostRoute('/fcs/craft/post-finishing/work-orders/'+encodeURIComponent(task.postTaskId)),true);
 assert.equal(isPreparedInventoryPostRoute('/fcs/craft/post-finishing/work-orders?sourceKind=WAREHOUSE_STOCK'),true);assert.equal(isPreparedInventoryPostRoute('/fcs/craft/post-finishing/work-orders'),false);assert.equal(isPreparedInventoryPostRoute('/fcs/craft/post-finishing/work-orders/UNKNOWN'),false);
 assert.deepEqual(task.processItems,['熨烫','包装']);assert.equal(task.lines.length,1)
 assert.equal(task.lines[0].expectedQty,app.lines[1].outboundQty)
 const normal=stock.listFinishedInventoryTransfers(app.id).find(row=>row.category==='正常返仓')!, skuId=task.lines[0].sku.skuId, qty=task.lines[0].expectedQty
 assert.throws(()=>stock.shipFinishedInventoryTransfer({transferId:normal.id,actor}),/加工/)
 const append=(processItem:'熨烫'|'包装',quantity:number,id:string)=>flow.appendPostFinishingProcessCompletion({postTaskId:task.postTaskId,actor,responsible,processItem,quantities:[{skuId,quantity}],operationId:id})
 assert.throws(()=>append('包装',1,'BAD-ORDER'),/前序|超过/)
 assert.throws(()=>append('熨烫',qty+1,'OVER'),/最多|超过/)
 append('熨烫',qty,'IRON');append('熨烫',qty,'IRON')
 assert.equal(stock.getFinishedInventoryApplication(app.id)!.postCompletedAt,undefined)
 append('包装',qty,'PACK');assert.ok(stock.getFinishedInventoryApplication(app.id)!.postCompletedAt)
 assert.throws(()=>flow.submitPostFinishingForOutbound({postTaskId:task.postTaskId,actor:responsible,quantities:[{skuId,quantity:qty}],operationId:'WRONG-OUT'} as any),/整批/)
 stock.shipFinishedInventoryTransfer({transferId:normal.id,actor})
 const pack=flow.getPostFinishingProcessProgress(task.postTaskId).records.find(row=>row.processItem==='包装')!
 assert.throws(()=>flow.correctPostFinishingProcessCompletion({recordId:pack.recordId,actor:flow.POST_FINISHING_ACCEPTANCE_ACTORS.postSupervisor,reason:'不能减少已交出量',quantities:[{skuId,quantity:qty-1}],operationId:'CORRECT'}),/出货|后序/)
 assert.equal(flow.getPostFinishingProcessProgress(task.postTaskId).totalReservedQty,qty)
})

test('全部为瑕疵即使勾选加工项也不建空加工单，瑕疵仍按原去向交接',()=>{ const {app,task}=complete(['熨烫'],'ALL');assert.equal(task,undefined);assert.equal(app.postTaskId,undefined);const transfers=stock.listFinishedInventoryTransfers(app.id).filter(row=>row.category!=='送后道');assert.deepEqual(transfers.map(row=>row.category),['瑕疵入仓']);assert.equal(transfers[0].lines.reduce((n,row)=>n+row.quantity,0),80) })

test('抽检24合格并未检放行56，所选后道加工量为全部正常放行80而非仅实检24',()=>{const {app,task}=complete(['熨烫'],false,true);assert.equal(app.qcResults!.reduce((n,row)=>n+row.passedQty,0),24);assert.equal(app.qcResults!.reduce((n,row)=>n+row.uninspectedQty,0),56);assert.equal(task!.lines.reduce((n,row)=>n+row.expectedQty,0),80)})
