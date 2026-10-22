import assert from 'node:assert/strict'
import test from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import { ensureQualityManagementRecords } from '../../src/data/fcs/quality-management-records.ts'
const actor=flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor
async function opened(id:string) {
 await ensureQualityManagementRecords()
 const ref=flow.createInventoryPostFinishingQcTask({applicationId:id,applicationNo:id,warehouseId:'WH-ISOLATED',warehouseName:'隔离仓',styleId:'STYLE-ISOLATED',styleNo:'STYLE-ISOLATED',styleName:'隔离样衣',styleImageUrl:'/shirt-sample.jpg',receivedAt:'2026-10-22T01:00:00Z',receivedBy:actor,
  lines:[{skuId:'SKU-'+id,skuCode:'SKU-'+id,colorName:'白色',sizeName:'M',imageUrl:'/shirt-sample.jpg',receivedQty:10}]})
 const task=flow.claimPostFinishingQcTask({qcTaskNo:ref.qcTaskNo,actor})
 return task
}
test('STD-029: 逐项目澄清依据保留原标准/原参照，不能用不存在项目或空依据',async()=>{
 const task=await opened('SUP-BASIS'),before=structuredClone(task.inspection!.snapshot),itemId=before.items[0].id
 assert.throws(()=>flow.clarifyPostFinishingQcBasis({qcTaskId:task.qcTaskId,actor,itemId:'not-in-standard',conflictDescription:'两份资料冲突',adoptedBasis:'已确认资料',clarificationNote:'明确采用理由',operationId:'bad-basis'}),/本次检查项目/)
 const next=flow.clarifyPostFinishingQcBasis({qcTaskId:task.qcTaskId,actor,itemId,conflictDescription:'两份尺寸资料对同一部位要求不同',adoptedBasis:'本次明确采用封版样衣和已确认尺寸表',clarificationNote:'按项目澄清后检查',operationId:'basis-1'})
 assert.throws(()=>flow.clarifyPostFinishingQcBasis({qcTaskId:task.qcTaskId,actor,itemId,conflictDescription:'不同冲突',adoptedBasis:'已保存依据',clarificationNote:'不同内容',operationId:'basis-1'}),/相同操作身份/)
 assert.deepEqual(next.inspection!.snapshot,before);assert.equal(next.inspection!.basisClarifications!.length,1)
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor,operationId:'basis-round',lines:[{skuId:task.lines[0].sku.skuId,passedQty:3,defectQty:0,returnQty:0}]})
 // Unit-only completion bridge; actual same-transaction logistics is verified in browser storage contracts.
 flow.registerPostFinishingInventoryQcCompletion(()=>{})
 flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor})
 assert.throws(()=>flow.clarifyPostFinishingQcBasis({qcTaskId:task.qcTaskId,actor,itemId,conflictDescription:'完成后改依据',adoptedBasis:'新依据',clarificationNote:'不应更正旧检查',operationId:'after-done'}),/在检QC/)
})
test('STD-026/027: 独立追检明确对象范围项目关联原QC，不重开原结果、不再生成物流或新QC',async()=>{
 const task=await opened('SUP-FOLLOW'),itemId=task.inspection!.snapshot.items[0].id
 assert.throws(()=>flow.recordPostFinishingIndependentCheck({qcTaskId:task.qcTaskId,actor,objectDescription:'实物',scopeDescription:'明确10件',itemIds:[itemId],reason:'标准更新后另行明确',result:'实际检查无问题',operationId:'before-done'}),/已完成/)
 flow.submitPostFinishingQcRound({qcTaskId:task.qcTaskId,actor,operationId:'follow-round',lines:[{skuId:task.lines[0].sku.skuId,passedQty:3,defectQty:0,returnQty:0}]})
 flow.registerPostFinishingInventoryQcCompletion(()=>{})
 const completed=flow.completePostFinishingQcTask({qcTaskId:task.qcTaskId,actor}),qcCount=flow.listPostFinishingFullFlowQcTasks().length,outCount=flow.listPostFinishingFullFlowOutboundOrders().length
 const request={qcTaskId:task.qcTaskId,actor,objectDescription:'原库存送检款同一批现有衣服',scopeDescription:'另行确认的10件、仅领围项目',itemIds:[itemId],reason:'标准更新后业务另行明确的检查',result:'实际核查后无新增问题',operationId:'follow-note'}
 assert.throws(()=>flow.recordPostFinishingIndependentCheck({...request,scopeDescription:''}),/范围/)
 const next=flow.recordPostFinishingIndependentCheck(request)
 assert.deepEqual(next.results,completed.results);assert.equal(next.status,'质检完成');assert.equal(next.independentChecks![0].originalRecordId,task.qcTaskId)
 assert.equal(flow.listPostFinishingFullFlowQcTasks().length,qcCount);assert.equal(flow.listPostFinishingFullFlowOutboundOrders().length,outCount)
 assert.throws(()=>flow.recordPostFinishingIndependentCheck({...request,result:'同一操作身份换内容'}),/相同操作身份/)
 flow.recordPostFinishingIndependentCheck(request);assert.equal(flow.getPostFinishingFullFlowQcTask(task.qcTaskId)!.independentChecks!.length,1)
})
