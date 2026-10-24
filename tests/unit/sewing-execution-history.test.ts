import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureSewingExecutionFact, getSewingExecutionHistoryForTask, listSewingExecutionFacts } from '../../src/data/fcs/sewing-execution-history.ts'
import { productionContextStorage, PRODUCTION_CONTEXT_KEYS, decodeProductionContextRecords, encodeProductionContextRecords } from '../../src/data/fcs/production-context-records.ts'
import { listRuntimeProcessTasks, recordRuntimeTaskExecution, autoStartRuntimeSewingTaskFromCutPieceHandover, captureRuntimeDirectDispatchState, restoreRuntimeDirectDispatchState } from '../../src/data/fcs/runtime-process-tasks.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { getFactoryActivePpicSnapshot } from '../../src/data/fcs/factory-master-store.ts'
import { buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { resetSewingSampleApprovalSuggestionsForTests, initializeSewingSampleApprovalSuggestionForAssignment, receivePreProductionSampleByPpic,
 handoffPreProductionSampleToApprover,startSampleApproval,submitSampleApprovalSuggestion,recordSampleApprovalFeedbackToFactory,
 getSewingSampleApprovalRecord,captureSewingSampleState,restoreSewingSampleState } from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'
const first=(factoryId:string,productionOrderId:string,taskId:string)=>({factoryId,productionOrderId,styleCode:`STYLE-${productionOrderId}`,taskId,firstExecutedAt:'2026-10-22T01:00:00Z',source:'MANUAL_START' as const,sourceId:`start-${taskId}`,actorName:'真实开工人'})
test('一厂前三个真实逻辑任务固定序次，SKU别名、多批和重放不再计次，无历史按第一',()=>{
 productionContextStorage.removeItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions)
 assert.equal(getSewingExecutionHistoryForTask({factoryId:'f',taskId:'unknown'}).ordinal,1)
 const a=ensureSewingExecutionFact(first('f','o1','t1'));assert.equal(a.ordinal,1)
 const alias=ensureSewingExecutionFact(first('f','o1','t1-size-M'));assert.equal(alias.id,a.id);assert.equal(alias.ordinal,1);assert.equal(alias.taskAliases.length,2)
 for(let i=2;i<=4;i++)assert.equal(ensureSewingExecutionFact(first('f',`o${i}`,`t${i}`)).ordinal,i)
 assert.equal(ensureSewingExecutionFact(first('f','o1','t1')).ordinal,1)
 assert.equal(getSewingExecutionHistoryForTask({factoryId:'f',taskId:'not-yet-alias',productionOrderId:'o1',styleCode:'STYLE-o1'}).ordinal,1)
 assert.equal(listSewingExecutionFacts('f').length,4);assert.equal(ensureSewingExecutionFact(first('other','o1','t1')).ordinal,1)
 const raw=productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions)!,rows=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.sewingExecutions,raw)
 assert.equal(rows.length,5);assert.equal(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.sewingExecutions,rows),raw)
 const broken=JSON.parse(raw);broken.facts[1].ordinal=1;assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.sewingExecutions,JSON.stringify(broken)),/重复/)
})
test('只读任务列表与预造startedAt不产生真实历史，实际手动与交接开工入口才建立',()=>{
 productionContextStorage.removeItem(PRODUCTION_CONTEXT_KEYS.sewingExecutions)
 const tasks=listRuntimeProcessTasks();assert.ok(tasks.length);assert.equal(listSewingExecutionFacts().length,0)
 const template=tasks.find(task=>task.processBusinessCode==='SEW' && !task.isSplitSource)!
 assert.ok(template)
 const state=captureRuntimeDirectDispatchState()
 try{
  const original=captureRuntimeDirectDispatchState()
  for(const [index,taskId] of ['REAL-MANUAL','REAL-AUTO'].entries()){
   const task={...structuredClone(template),taskId,baseTaskId:taskId,scopeKey:taskId,executionEnabled:true,isSplitSource:false,isSplitResult:false,mergedIntoTaskId:undefined,assignedFactoryId:'ID-F021',assignedFactoryName:'三方工厂',assignmentStatus:'ASSIGNED' as const,acceptanceStatus:'ACCEPTED' as const,status:'NOT_STARTED' as const,startedAt:undefined,dependsOnTaskIds:[],baseDependsOnTaskIds:[],productionOrderId:template.productionOrderId}
   original.reassignedTasks.push([taskId,task])
  }
  restoreRuntimeDirectDispatchState(original,false)
  recordRuntimeTaskExecution('REAL-MANUAL',{status:'IN_PROGRESS',startedAt:'2026-10-22T01:00:00Z',updatedAt:'2026-10-22T01:00:00Z',auditLogs:[{id:'real-start',by:'工厂操作员',at:'2026-10-22T01:00:00Z',action:'START',detail:'实际开始'} as any]})
  assert.equal(listSewingExecutionFacts().length,1)
  autoStartRuntimeSewingTaskFromCutPieceHandover({taskId:'REAL-AUTO',handoverRecordNo:'HAND-REAL',receivedAt:'2026-10-22T01:01:00Z',receivedBy:'裁片接收员'})
  autoStartRuntimeSewingTaskFromCutPieceHandover({taskId:'REAL-AUTO',handoverRecordNo:'HAND-REAL-SECOND-BATCH',receivedAt:'2026-10-22T01:02:00Z',receivedBy:'裁片接收员'})
  const facts=listSewingExecutionFacts();assert.equal(facts.length,1,'同厂同单同款两个SKU投影仍是一次真实车缝任务');assert.deepEqual(facts[0].taskAliases,['REAL-MANUAL','REAL-AUTO'])
 }finally{restoreRuntimeDirectDispatchState(state,false)}
})
test('同一真实任务的样衣待收、有问题已反馈、无问题待反馈均不阻断合法手动或裁片接收开工',()=>{
 const template=listRuntimeProcessTasks().find(task=>task.processBusinessCode==='SEW' && !task.isSplitSource)!
 const orderTemplate=productionOrders.find(order=>order.productionOrderId===template.productionOrderId)!
 assert.ok(orderTemplate.techPackSnapshot)
 const beforeRuntime=captureRuntimeDirectDispatchState(),beforeSamples=captureSewingSampleState(),addedOrders=new Set<string>()
 const ppicSnapshot=getFactoryActivePpicSnapshot('ID-F021')!,ppic={actorId:ppicSnapshot.ppicId,actorName:ppicSnapshot.ppicName,role:'PPIC' as const}
 const approver={actorId:'GATE-APPROVER',actorName:'门槛专项批版人',role:'SAMPLE_APPROVER' as const},now='2026-10-22T01:00:00Z'
 try{
  for(const phase of ['PENDING','HAS_PROBLEM','FEEDBACK_PENDING'] as const)for(const entry of ['MANUAL','CUT_PIECE'] as const){
   const orderId=`PP-GATE-ORDER-${phase}-${entry}`,taskId=`PP-GATE-TASK-${phase}-${entry}`,assignmentId=`PP-GATE-ASG-${phase}-${entry}`
   const order=structuredClone(orderTemplate);order.productionOrderId=orderId;order.productionOrderNo=orderId
   order.techPackSnapshot={...order.techPackSnapshot!,productionOrderId:orderId,productionOrderNo:orderId}
   productionOrders.push(order);addedOrders.add(orderId)
   const state=captureRuntimeDirectDispatchState(),task={...structuredClone(template),taskId,baseTaskId:taskId,scopeKey:taskId,productionOrderId:orderId,
    executionEnabled:true,isSplitSource:false,isSplitResult:false,mergedIntoTaskId:undefined,assignedFactoryId:'ID-F021',assignedFactoryName:'三方工厂',
    assignmentStatus:'ASSIGNED' as const,acceptanceStatus:'ACCEPTED' as const,status:'NOT_STARTED' as const,startedAt:undefined,dependsOnTaskIds:[],baseDependsOnTaskIds:[]}
   state.reassignedTasks.push([taskId,task]);restoreRuntimeDirectDispatchState(state,false)
   initializeSewingSampleApprovalSuggestionForAssignment({assignmentId,runtimeTaskId:taskId,productionOrderId:orderId,productionOrderNo:orderId,
    factoryId:'ID-F021',factoryName:'三方工厂',taskNo:taskId,processCodes:['SEW'],ppicId:ppic.actorId,ppicName:ppic.actorName,operatedAt:now})
   if(phase!=='PENDING'){
    const matchingImage=order.techPackSnapshot.imageSnapshot.productImages[0] || order.techPackSnapshot.imageSnapshot.styleImages[0]
    assert.ok(matchingImage,'保留同源款式实物识别素材，不以缺图绕过接收前置')
    receivePreProductionSampleByPpic({commandId:`${assignmentId}:receive`,assignmentId,actor:ppic,receivedSamplePhotoUrls:[matchingImage],receivedAt:now})
    handoffPreProductionSampleToApprover({commandId:`${assignmentId}:handoff`,assignmentId,actor:ppic,approverTeamName:'批版组',handedAt:now})
    const standard=buildInspectionSnapshotFromConfigurations({sourceKind:'PRE_PRODUCTION_SAMPLE'})
    startSampleApproval({commandId:`${assignmentId}:claim`,assignmentId,actor:approver,receivedAt:now,inspectionStandardSnapshot:standard})
    submitSampleApprovalSuggestion({commandId:`${assignmentId}:opinion`,assignmentId,actor:approver,uploadedAt:now,
     conclusion:phase==='HAS_PROBLEM'?'HAS_PROBLEM':'NO_PROBLEM',issues:phase==='HAS_PROBLEM'?[{itemId:standard.items[0].id,note:'本件有尺寸问题'}]:[]})
    if(phase==='HAS_PROBLEM')recordSampleApprovalFeedbackToFactory({commandId:`${assignmentId}:feedback`,assignmentId,actor:ppic,feedbackAt:now,feedbackNote:'已反馈原意见，有问题仍不阻断大货'})
   }
   const sampleBefore=getSewingSampleApprovalRecord(assignmentId)!
   assert.equal(sampleBefore.sample.runtimeTaskId,taskId,'样衣与本次实际启动的是同一真实任务')
   assert.equal(sampleBefore.sample.status,phase==='PENDING'?'WAITING_PPIC_RECEIVE':phase==='HAS_PROBLEM'?'FEEDBACK_SENT':'SUGGESTION_UPLOADED')
   const started=entry==='MANUAL'?recordRuntimeTaskExecution(taskId,{status:'IN_PROGRESS',startedAt:now,updatedAt:now,auditLogs:[{id:`START-${taskId}`,by:'实际开工人',at:now,action:'START',detail:'合法已分配已接单任务开始'} as any]})
    :autoStartRuntimeSewingTaskFromCutPieceHandover({taskId,handoverRecordNo:`RECEIVED-${taskId}`,receivedAt:now,receivedBy:'实际裁片接收人'})
   assert.equal(started.status,'IN_PROGRESS');assert.equal(started.startedAt,now)
   assert.deepEqual(getSewingSampleApprovalRecord(assignmentId),sampleBefore,'开工不代替批版、反馈或更改质量结论')
  }
 }finally{
  restoreRuntimeDirectDispatchState(beforeRuntime,false);restoreSewingSampleState(beforeSamples)
  for(let i=productionOrders.length-1;i>=0;i--)if(addedOrders.has(productionOrders[i].productionOrderId))productionOrders.splice(i,1)
 }
})
