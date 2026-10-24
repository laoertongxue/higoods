import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import mock from '../../src/data/wls/finished-inventory-quality-mock.json' with {type:'json'}
import { createFinishedInventorySeed, FINISHED_INVENTORY_DEFECT_WAREHOUSE, FINISHED_INVENTORY_REWORK_FACTORY } from '../../src/data/wls/finished-inventory-quality-seed.ts'
import { listSkuArchives } from '../../src/data/pcs-sku-archive-repository.ts'
import { listPostFinishingFullFlowQcTasks, listPostFinishingFullFlowPostTasks, listPostFinishingTaskQuantitySummaries, getPostFinishingProcessProgress, registerPostFinishingInventoryPostBridge } from '../../src/data/fcs/post-finishing-full-flow.ts'
import { finishedInventoryApplicationStatus, updateFinishedInventoryPostProgress, finishedInventoryPostShippedQuantities } from '../../src/data/wls/finished-inventory-quality.ts'
import { getQualityConfiguration } from '../../src/data/fcs/quality-management-records.ts'

registerPostFinishingInventoryPostBridge({progress:updateFinishedInventoryPostProgress,shipped:finishedInventoryPostShippedQuantities})

test('默认13条库存质检覆盖两页及各待办，两笔线上完整流程已并入连续库存',()=>{
 const seed=createFinishedInventorySeed(),qcs=listPostFinishingFullFlowQcTasks(),posts=listPostFinishingFullFlowPostTasks()
 assert.equal(seed.applications.length,13);assert.ok(seed.applications.length<=20)
 const states=seed.applications.map(finishedInventoryApplicationStatus)
 for(const stage of ['待后道实收','待完成QC','待后道加工','待分类交接及上架','已完成'])assert.ok(states.includes(stage),stage)
 assert.equal(states.filter(stage=>stage==='已完成').length,5)
 assert.equal(seed.lots.filter(lot=>lot.styleId==='style_r1_wms_tee'&&lot.quality==='正常').reduce((n,row)=>n+row.quantity,0),92)
 for(const app of seed.applications){
  const outbound=seed.transfers.find(row=>row.id===app.outboundId)!;assert.ok(outbound);assert.equal(outbound.category,'送后道')
  assert.equal(outbound.applicationId,app.id);assert.equal(outbound.lines.reduce((n,row)=>n+row.quantity,0),app.lines.reduce((n,row)=>n+row.outboundQty,0))
  if(!app.receivedAt){assert.equal(app.qcTaskId,undefined);continue}
  const qc=qcs.find(row=>row.qcTaskId===app.qcTaskId)!;assert.ok(qc);assert.equal(qc.sourceKind,'WAREHOUSE_STOCK');assert.equal(qc.inventoryApplicationId,app.id)
  for(const line of app.lines)assert.equal(qc.lines.find(row=>row.sku.skuId===line.skuId)!.expectedQty,line.receivedQty)
  if(!app.qcCompletedAt)continue
  assert.equal(qc.status,'质检完成');assert.ok(qc.inspection!.rounds.length)
  assert.ok(Date.parse(qc.inspection!.snapshot.selectedAt)>=Date.parse(getQualityConfiguration(qc.inspection!.snapshot.basicStandard.id)!.effectiveAt!))
  assert.ok(Date.parse(qc.inspection!.snapshot.selectedAt)<=Date.parse(qc.completedAt!))
  if(app.postTaskId){const post=posts.find(row=>row.postTaskId===app.postTaskId)!;assert.ok(post);assert.deepEqual(post.processItems,app.processItems);const progress=getPostFinishingProcessProgress(post);assert.equal(!!app.postCompletedAt,progress.lines.every(line=>line.completedQty===line.expectedQty))}
 }
 const partial=mock.cases.find(row=>row.stage.includes('熨烫已完成'))!,app=seed.applications.find(row=>row.id===partial.id)!
 const progress=getPostFinishingProcessProgress(app.postTaskId!)
 assert.equal(progress.processes.find(row=>row.processItem==='熨烫')!.completedQty,96)
 assert.equal(progress.processes.find(row=>row.processItem==='包装')!.completedQty,0)
 assert.ok(listPostFinishingTaskQuantitySummaries().every(row=>row.productionOrderNo&& !row.postTaskId.startsWith('PF-POST-INV-')))
})

test('Mock身份、对应图片、出库库位、分类去向与实物守恒；短收不被掩盖',()=>{
 const seed=createFinishedInventorySeed(),archives=new Map(listSkuArchives().map(row=>[row.skuId,row]))
 for(const key of ['lots','applications','transfers','movements','differences','scopes'] as const)assert.equal(new Set(seed[key].map(row=>row.id)).size,seed[key].length,key)
 for(const lot of seed.lots){const sku=archives.get(lot.skuId)!;assert.ok(sku);assert.equal(lot.imageUrl,sku.skuImageUrl);assert.ok(existsSync(new URL('../../public'+lot.imageUrl,import.meta.url)));assert.ok(Number.isSafeInteger(lot.quantity)&&lot.quantity>=0)}
 for(const app of seed.applications)for(const line of app.lines){assert.equal(line.allocations.reduce((n,row)=>n+row.quantity,0),line.outboundQty);for(const allocation of line.allocations){const lot=seed.lots.find(row=>row.id===allocation.lotId)!;assert.ok(lot);assert.equal(lot.skuId,line.skuId);assert.equal(lot.warehouseId,app.warehouseId)}}
 for(const transfer of seed.transfers){if(transfer.category==='瑕疵入仓')assert.equal(transfer.targetId,FINISHED_INVENTORY_DEFECT_WAREHOUSE.id);if(transfer.category==='返工交接')assert.equal(transfer.targetId,FINISHED_INVENTORY_REWORK_FACTORY.id);if(transfer.putawayAt)assert.ok(transfer.receivedAt);if(transfer.receivedAt)assert.ok(transfer.shippedAt)}
 const styles=new Set(seed.applications.map(row=>row.styleId))
 for(const styleId of styles){
  let total=seed.lots.filter(row=>row.styleId===styleId).reduce((n,row)=>n+row.quantity,0)
  for(const app of seed.applications.filter(row=>row.styleId===styleId)){
   if(!app.receivedAt)total+=app.lines.reduce((n,row)=>n+row.outboundQty,0)
   else if(!app.qcCompletedAt)total+=app.lines.reduce((n,row)=>n+row.receivedQty!,0)
   else for(const transfer of seed.transfers.filter(row=>row.applicationId===app.id&&row.category!=='送后道'))if(!transfer.receivedAt||transfer.category==='返工交接')total+=transfer.lines.reduce((n,row)=>n+row.quantity,0)
   total+=seed.differences.filter(row=>row.applicationId===app.id).reduce((n,row)=>n-row.quantity,0)
  }
  assert.equal(total,styleId==='style_r1_wms_tee'?105:100,styleId)
 }
 assert.equal(seed.differences.filter(row=>!row.resolvedAt).length,1)
 assert.ok(seed.differences.some(row=>row.resolvedAt&&row.reason&&row.disposition))
 assert.ok(seed.transfers.some(row=>row.category==='正常返仓'&&row.receivedAt&&!row.putawayAt))
 assert.ok(seed.transfers.some(row=>row.category==='返工交接'&&row.shippedAt&&!row.receivedAt))
})

test('线上不加工80件与加工76件的原单号可直接追溯，第二笔消耗第一笔返仓实物',()=>{
 const seed=createFinishedInventorySeed(),qcs=listPostFinishingFullFlowQcTasks(),posts=listPostFinishingFullFlowPostTasks()
 const first=seed.applications.find(row=>row.applicationNo==='INVQC-20261024-222e43126b')!
 const second=seed.applications.find(row=>row.applicationNo==='INVQC-20261024-2db1fa26c7')!
 assert.ok(first);assert.ok(second)
 for(const [app,outbound,normal,processItems] of [[first,80,76,[]],[second,76,72,['熨烫','包装']]] as const){
  assert.equal(finishedInventoryApplicationStatus(app),'已完成')
  assert.equal(app.lines.reduce((n,row)=>n+row.outboundQty,0),outbound)
  assert.equal(app.lines.reduce((n,row)=>n+row.receivedQty!,0),outbound)
  assert.deepEqual(app.processItems||[],[...processItems])
  assert.equal(app.qcResults!.reduce((n,row)=>n+row.passedQty,0),normal)
  assert.equal(app.qcResults!.reduce((n,row)=>n+row.defectQty,0),2)
  assert.equal(app.qcResults!.reduce((n,row)=>n+row.reworkQty,0),2)
  const qc=qcs.find(row=>row.qcTaskId===app.qcTaskId)!
  assert.ok(qc);assert.equal(qc.sourceKind,'WAREHOUSE_STOCK');assert.equal(qc.inspection!.rounds.length,2)
  const transfers=seed.transfers.filter(row=>row.applicationId===app.id&&row.category!=='送后道')
  assert.equal(transfers.length,3)
  for(const row of transfers){assert.ok(row.shippedAt);assert.ok(row.receivedAt);if(row.category!=='返工交接')assert.ok(row.putawayAt)}
  if(processItems.length){const post=posts.find(row=>row.postTaskId===app.postTaskId)!;assert.ok(post);assert.equal(getPostFinishingProcessProgress(post).lines.reduce((n,row)=>n+row.completedQty,0),normal)}
  else assert.equal(app.postTaskId,undefined)
 }
 assert.ok(Date.parse(first.completedAt!)<Date.parse(second.createdAt))
 const firstReturn=seed.transfers.find(row=>row.applicationId===first.id&&row.category==='正常返仓')!
 const lots=new Map(seed.lots.map(row=>[row.id,row]))
 const reused=second.lines.flatMap(line=>line.allocations).filter(allocation=>lots.get(allocation.lotId)!.sourceRef===firstReturn.id).reduce((n,row)=>n+row.quantity,0)
 assert.ok(reused>=56,'原仓首笔剩余仅20件，第二笔76件至少56件来自首笔返仓')
})
