import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { ensureQualityManagementRecords, buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { createPostQcInspection, submitPostQcRound } from '../../src/data/fcs/post-finishing-quality.ts'
import { listPostFinishingQcOrders, listPostFinishingQcOrderEntities, getPostFinishingTaskByProductionOrder, getPostFinishingTaskById, listPostFinishingTasks, listPostFinishingActionRecords } from '../../src/data/fcs/post-finishing-current-read-model.ts'
import { renderPostFinishingQcTaskMaster, renderPostFinishingQcTaskDetail, renderPostFinishingQcInspectionAppendix, buildProductionQcMasterPrintDocument, buildPostFinishingQcOrderPrintDocument, renderPostFinishingQcPrintTemplate } from '../../src/pages/print/templates/post-finishing-qc-print-template.ts'
import { buildPrintDocument, renderPrintDocument } from '../../src/data/fcs/print-template-registry.ts'
import { getQcFactDetail } from '../../src/pages/qc-records/fact-view.ts'
import { getPostFinishingExecutionStatistics } from '../../src/data/fcs/process-statistics-domain.ts'
import { createFactoryHandoverRecord, listPdaHandoverHeads, getPdaHandoverRecordsByHead } from '../../src/data/fcs/pda-handover-events.ts'
const actors=flow.POST_FINISHING_ACCEPTANCE_ACTORS
const issues=[{itemId:'garment-clean',note:'同件污渍'}, {itemId:'garment-sewing',note:'同件跳线'}]
const at=Date.UTC(2026,9,22,1)

test('通用打印原生产单号/原QC编号直达只读取对应质检，主表和详情保留本单内容',()=>{
  flow.loadPostFinishingDemoData()
  const all=listPostFinishingQcOrderEntities(),qc=all[0]
  assert(qc)
  const source=getPostFinishingTaskByProductionOrder(qc.productionOrderNo)!
  const stringify=JSON.stringify,unrelated:string[]=[]
  JSON.stringify=((value:unknown,...rest:unknown[])=>{
    if(value&&typeof value==='object'&&'qcTaskId' in value&&'productionOrderId' in value&&'lines' in value&&value.productionOrderId!==qc.productionOrderId)unrelated.push(String(value.qcTaskId))
    return (stringify as Function)(value,...rest)
  }) as typeof JSON.stringify
  try {
    for(const sourceId of [source.productionOrderId,source.productionOrderNo,source.postTaskId,source.postTaskNo]) {
      const doc=buildProductionQcMasterPrintDocument({documentType:'PRODUCTION_QC_MASTER',sourceType:'POST_FINISHING_TASK',sourceId})
      assert.equal(doc.headerFields.find(row=>row.label==='生产单号')?.value,source.productionOrderNo)
      assert(renderPostFinishingQcPrintTemplate(doc).includes(source.spuCode))
    }
    for(const sourceId of [qc.qcOrderId,qc.qcOrderNo]) {
      assert.deepEqual(listPostFinishingQcOrderEntities(sourceId),[qc])
      const doc=buildPostFinishingQcOrderPrintDocument({documentType:'POST_FINISHING_QC_ORDER',sourceType:'POST_FINISHING_QC_ORDER',sourceId})
      assert.equal(doc.sourceId,qc.qcOrderId)
      assert(renderPostFinishingQcPrintTemplate(doc).includes(qc.spuCode))
    }
    assert.deepEqual(unrelated,[],'真实打印适配及二次渲染均不能复制其他生产单QC')
    assert.deepEqual(listPostFinishingQcOrderEntities('QUALITY-NOT-A-QC'),[])
  } finally { JSON.stringify=stringify }
})

test('后道原单直达保持完整数量及历史，正式ID和生产单编号只复制本生产单QC，上游任务别名仍可追溯',()=>{
  flow.loadPostFinishingDemoData()
  const all=listPostFinishingTasks()
  const source=all.find(row=>row.qcOrderCount>0)!
  assert(source)
  assert(flow.listPostFinishingFullFlowQcTasks().some(row=>row.productionOrderId!==source.productionOrderId),'夹具须包含其他生产单QC')
  const stringify=JSON.stringify
  const unrelated:string[]=[]
  JSON.stringify=((value:unknown,...rest:unknown[])=>{
    if(value&&typeof value==='object'&&'qcTaskId' in value&&'productionOrderId' in value&&'lines' in value&&value.productionOrderId!==source.productionOrderId)unrelated.push(String(value.qcTaskId))
    return (stringify as Function)(value,...rest)
  }) as typeof JSON.stringify
  try {
    assert.deepEqual(getPostFinishingTaskById(source.postTaskId),source)
    assert.deepEqual(getPostFinishingTaskById(source.postTaskNo),source)
    assert.deepEqual(getPostFinishingTaskByProductionOrder(source.productionOrderId),source)
    assert.deepEqual(getPostFinishingTaskByProductionOrder(source.productionOrderNo),source)
    assert.deepEqual(unrelated,[],'直达不得先复制无关生产单全部标准快照再筛选')
  } finally { JSON.stringify=stringify }
  for(const task of all) {
    assert.deepEqual(getPostFinishingTaskById(task.postTaskId),task)
    assert.deepEqual(getPostFinishingTaskByProductionOrder(task.productionOrderNo),task)
    for(const alias of task.sourceTaskNos)assert.deepEqual(getPostFinishingTaskById(alias),all.find(row=>row.postTaskId===alias||row.postTaskNo===alias||row.sourceTaskNos.includes(alias)))
  }
  assert.equal(getPostFinishingTaskByProductionOrder('QUALITY-NOT-A-PRODUCTION-ORDER'),undefined)
  assert.equal(getPostFinishingTaskById('QUALITY-NOT-A-TASK'),undefined)
})

async function completedPost() {
  await ensureQualityManagementRecords()
  flow.resetPostFinishingFullFlow()
  const source=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
  const delivery=flow.registerPostFinishingFactoryReturn({productionOrderNo:source.productionOrderNo,returnIndex:1,triggerSource:'车缝正常交出',idempotencyKey:'CURRENT-SURFACES',quantities:source.skus.map(sku=>({skuId:sku.skuId,registeredQty:20})),deliveryPersonName:'专项送货人',deliveryPersonPhone:'',evidenceImageUrls:[source.skus[0].imageUrl],actor:actors.factoryCourier,nowMs:at})
  flow.confirmPostFinishingFactoryReturn({deliveryId:delivery.deliveryId,firstCounts:delivery.lines.map(line=>({skuId:line.sku.skuId,actualQty:line.registeredQty})),actor:actors.returnConfirmer,nowMs:at+1000})
  const qc=flow.sendPostFinishingFactoryReturnToQc({deliveryId:delivery.deliveryId,actor:actors.sender,nowMs:at+2000})
  flow.claimPostFinishingQcTask({qcTaskNo:qc.qcTaskNo,actor:actors.qcA,nowMs:at+3000})
  flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:'surfaces-full',lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:19,defectQty:1,returnQty:0,issues})),nowMs:at+4000})
  const inProgress=listPostFinishingQcOrders().find(row=>row.actionRecordId===qc.qcTaskId)!
  assert.equal(inProgress.inspectedGarmentQty,100);assert.equal(inProgress.passedGarmentQty,95);assert.equal(inProgress.defectAcceptedGarmentQty,5)
  flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcA,url:'/fixtures/isolated-test-signed-paper.png',name:'专项隔离测试纸单',nowMs:at+5000})
  const done=flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:actors.qcA,processItems:['包装'],nowMs:at+6000})
  const post=flow.getPostFinishingFullFlowPostTask(done.postTaskId!)!
  flow.appendPostFinishingProcessCompletion({postTaskId:post.postTaskId,processItem:'包装',quantities:post.lines.map(line=>({skuId:line.sku.skuId,quantity:line.expectedQty})),actor:actors.postOperator,responsible:actors.postOperator,operationId:'surfaces-pack',nowMs:at+7000})
  return {source,qc:flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)!,post}
}

test('后道当前投影与汇集按实检成衣计数，同件多个问题不叠加为多件',async()=>{
  const {source,qc}=await completedPost()
  const projected=listPostFinishingQcOrders().find(row=>row.actionRecordId===qc.qcTaskId)!
  assert.equal(projected.inspectedGarmentQty,100)
  assert.equal(projected.passedGarmentQty,95)
  assert.equal(projected.defectAcceptedGarmentQty,5)
  assert(projected.qcSkuResults?.every(row=>row.inspectionKnown))
  const fact=getQcFactDetail(qc.qcTaskId)!
  assert.equal(fact.inspectedQty,100);assert.equal(fact.defectQty,5)
  assert.equal(fact.reworkChargebackAmountText,'—','未登记费用不能自动计罚款')
  assert.equal(getPostFinishingTaskByProductionOrder(source.productionOrderNo)?.qcDoneQty,100)
  assert.deepEqual(listPostFinishingActionRecords('复检'),[])
})

test('同一原加工单分两张出货，准备不算实际发出，dispatch后才等待实收',async()=>{
  const {source,post}=await completedPost()
  const children=[2,3].map((quantity,index)=>flow.submitPostFinishingForOutbound({postTaskId:post.postTaskId,quantities:[{skuId:post.lines[0].sku.skuId,quantity}],actor:actors.postOperator,operationId:`surfaces-out-${index}`,nowMs:at+8000+index}))
  assert.notEqual(children[0].outboundOrderId,children[1].outboundOrderId)
  assert(children.every(row=>row.status==='待出货'&&!row.recheckOrderId))
  const movement=flow.listPostFinishingWaitHandoverWarehouseMovements().find(row=>row.outboundOrderNo===children[0].outboundOrderNo && row.movementType==='出货准备入区')!
  assert.equal(movement.quantities.reduce((n,line)=>n+line.quantity,0),2,'准备出货入区流水取实际本单数量，不取尚为0的已发出量')
  const before=getPostFinishingExecutionStatistics({workOrderId:post.postTaskId})
  assert.equal(before.handedOverGarmentQty,0);assert.equal(before.waitHandoverGarmentQty,0)
  assert.equal(before.waitOutboundOrderCount,2);assert.equal(before.waitOutboundGarmentQty,95)
  const request={documentType:'POST_FINISHING_OUTBOUND_ORDER' as const,sourceType:'POST_FINISHING_OUTBOUND_ORDER' as const,sourceId:children[0].outboundOrderId}
  const prepared=buildPrintDocument(request)
  assert.equal(prepared.headerFields.find(row=>row.label==='状态')?.value,'待出货')
  assert.equal(prepared.tables[0].rows[0][7],'0','打印实际发出为0，不用本单数量代替')
  flow.dispatchPostFinishingOutboundOrder({outboundOrderId:children[0].outboundOrderId,actor:actors.postOperator,nowMs:at+10000})
  const dispatched=buildPrintDocument(request)
  assert.equal(dispatched.tables[0].rows[0][7],'2')
  assert.match(renderPrintDocument(dispatched),/实际发出时间/)
  let stats=getPostFinishingExecutionStatistics({workOrderId:post.postTaskId})
  assert.equal(stats.handedOverGarmentQty,2);assert.equal(stats.waitHandoverGarmentQty,2)
  assert.equal(stats.waitOutboundOrderCount,1)
  assert.throws(()=>flow.receivePostFinishingOutboundOrder({outboundOrderNo:children[1].outboundOrderNo,actor:actors.warehouseReceiver,receivedQuantities:[{skuId:post.lines[0].sku.skuId,receivedQty:3}]}),/实际发出|待出货|待仓库/)
  flow.receivePostFinishingOutboundOrder({outboundOrderNo:children[0].outboundOrderNo,actor:actors.warehouseReceiver,receivedQuantities:[{skuId:post.lines[0].sku.skuId,receivedQty:2}],nowMs:at+12000})
  stats=getPostFinishingExecutionStatistics({workOrderId:post.postTaskId})
  assert.equal(stats.receivedGarmentQty,2);assert.equal(stats.waitHandoverGarmentQty,0)
  assert.equal(getPostFinishingTaskByProductionOrder(source.productionOrderNo)?.waitOutboundQty,3)
  const head=listPdaHandoverHeads().find(head=>head.sourceDocId===children[1].outboundOrderId)!
  assert(head,'PDA交接以原出货单为来源')
  const count=getPdaHandoverRecordsByHead(head.handoverId).length
  assert.throws(()=>createFactoryHandoverRecord({handoverOrderId:head.handoverId,submittedQty:3,factorySubmittedAt:'2026-10-22 10:00:00',factorySubmittedBy:'专项操作员',scanCode:post.lines[0].sku.skuCode}),/原后道出货单|原出货单/)
  assert.equal(getPdaHandoverRecordsByHead(head.handoverId).length,count,'拒绝创建第二套通用交出事实')
})

test('两套QC纸面共用固定标准及真实抽检29+1，70未抽放行与99正常放行分开',()=>{
  flow.loadPostFinishingDemoData()
  const existing=flow.listPostFinishingFullFlowQcTasks().find(row=>row.results?.length)!
  const snapshot=buildInspectionSnapshotFromConfigurations({sourceKind:'PRODUCTION_RETURN'})
  snapshot.ruleSnapshot!.minQuantity=0
  const inspection=createPostQcInspection(snapshot)
  const sku=existing.lines[0].sku
  submitPostQcRound(inspection,[{skuId:sku.skuId,quantity:100}],{operationId:'surface-sample',actorId:'TEST',submittedAt:new Date(at).toISOString(),lines:[{skuId:sku.skuId,passedQty:29,defectQty:1,returnQty:0,issues}]})
  const skuSnapshot=structuredClone(snapshot)
  skuSnapshot.items.find(item=>item.id==='garment-clean')!.content='此SKU须额外清理领口线头'
  inspection.snapshot.skuSnapshots=[{skuId:sku.skuId,snapshot:skuSnapshot}]
  inspection.basisClarifications=[{id:'basis-test',itemId:'garment-clean',conflictDescription:'资料手写与图示不一致',adoptedBasis:'已确认以封版照片为准',clarificationNote:'专项澄清留痕',at:new Date(at).toISOString(),by:'专项质检员'}]
  const sampled={...existing,lines:[{sku,expectedQty:100}],inspection,status:'质检完成' as const,results:[{sku,expectedQty:100,passedQty:29,defectQty:1,returnQty:0,uninspectedQty:70,releasedQty:99}]}
  for(const html of [renderPostFinishingQcTaskMaster(sampled),renderPostFinishingQcTaskDetail(sampled)]) {
    assert.match(html,/实检 30 件/);assert.match(html,/实检合格 29 件/);assert.match(html,/未抽随批放行 70 件/);assert.match(html,/正常放行 99 件/)
    assert.match(html,/本次固定检查要求/);assert(html.includes(snapshot.basicStandard.id));assert.match(html,/同件污渍/)
    assert.match(html,/此SKU须额外清理领口线头/);assert.match(html,/已确认以封版照片为准/)
    assert.match(html,/质检员签字/);assert.match(html,/车缝工厂负责人签字/)
  }
  const inventory={...sampled,sourceKind:'WAREHOUSE_STOCK' as const,productionOrderNo:'',productionOrderId:'',sourceWarehouseName:'库存原仓',inventoryApplicationId:'STOCK-ISOLATED'}
  const inventoryHtml=renderPostFinishingQcTaskMaster(inventory)
  assert.match(inventoryHtml,/不适用（库存送检）/);assert.match(inventoryHtml,/库存原仓/)
  assert.doesNotMatch(renderPostFinishingQcInspectionAppendix(inventory),/签字：/)
})

test('新演示已完成QC具有实际轮次与固定标准，汇集和打印读取同一实检数量',()=>{
  flow.loadPostFinishingDemoData()
  const completed=flow.listPostFinishingFullFlowQcTasks().filter(row=>row.status==='质检完成')
  assert(completed.length>0)
  for(const task of completed) {
    assert(task.inspection?.snapshot.items.length);assert(task.inspection.rounds.length)
    if(task.sourceKind!=='WAREHOUSE_STOCK')assert(task.inspection.papers.length)
    assert.equal(task.inspection.snapshot.selectedAt,task.claimedAt)
    assert(task.inspection.snapshot.selectedAt>='2026-10-22T00:00:00.000Z')
    assert(task.inspection.snapshot.selectedAt<=task.inspection.rounds[0].submittedAt)
    const projected=listPostFinishingQcOrders().find(row=>row.actionRecordId===task.qcTaskId)!
    assert(projected.qcSkuResults?.every(row=>row.inspectionKnown===true))
    assert.equal(getQcFactDetail(task.qcTaskId)?.inspectionKnown,true)
    assert.doesNotMatch(renderPostFinishingQcTaskDetail(task),/历史未记录/)
    assert.match(renderPostFinishingQcInspectionAppendix(task),/尺寸规格/)
  }
})


test('未开检打印说明当前待办，已开检缺标准直接拒绝而不走历史兜底',()=>{
  flow.loadPostFinishingDemoData()
  const pending=flow.listPostFinishingFullFlowQcTasks().find(task=>task.status==='待质检')!
  assert(pending)
  assert.match(renderPostFinishingQcInspectionAppendix(pending),/尚未开检/)
  assert.doesNotMatch(renderPostFinishingQcTaskDetail(pending),/历史记录|历史未记录/)
  assert.throws(()=>renderPostFinishingQcInspectionAppendix({...pending,status:'质检完成'}),/缺少开检标准/)
})

test('新静态演示的固定标准身份、取用时间和纸单在重开时稳定',()=>{
  flow.loadPostFinishingDemoData()
  const before=flow.listPostFinishingFullFlowQcTasks().filter(task=>task.inspection).map(task=>task.inspection)
  flow.loadPostFinishingDemoData()
  assert.deepEqual(flow.listPostFinishingFullFlowQcTasks().filter(task=>task.inspection).map(task=>task.inspection),before)
})
