// Explicit isolated Mock prerequisites only; UI scripts execute every measured action.
import * as core from '/src/data/fcs/production-context-records.ts'
import * as actions from '/src/data/fcs/production-context-actions.ts'
import * as runtime from '/src/data/fcs/runtime-process-tasks.ts'
import * as assignments from '/src/data/fcs/effective-task-assignments.ts'
import * as contracts from '/src/data/fcs/production-contracts.ts'
import * as returns from '/src/data/fcs/production-return-fulfillment.ts'
import * as policy from '/src/data/fcs/task-fulfillment-policy.ts'
import * as ppic from '/src/data/fcs/factory-onboarding-ppic.ts'

export async function setup(kind: 'contract' | 'completion' | 'start') {
 await core.hydrateProductionContextRecords(); actions.hydrateProductionSourceEffects()
 if(kind==='contract'||kind==='start')return actions.saveProductionSourceAction({id:'ui-fixture-assignment',intent:'isolated-mock-prerequisite',action:()=>{
  const task={...runtime.getRuntimeTaskById(kind==='start'?'MERGED-CUT-SEW-IRON-PO-DEMO-TRIPLE-0916-0WPGX2R':'TASKGEN-202603-0002-002__ORDER')!,...(kind==='start'?{taskId:'MERGED-UI-START',taskNo:'MOCK-START-001'}:{})},actor=ppic.SEWING_OUTSOURCING_DEMO_CURRENT_PPIC,at='2026-09-25 10:00:00'
  const dispatch=runtime.captureRuntimeDirectDispatchState()
  const fields={assignmentMode:'DIRECT' as const,assignmentStatus:'ASSIGNED' as const,assignedFactoryId:'ID-F021',assignedFactoryName:'CV Micro Sewing Jakarta Pusat',dispatchedAt:at,businessAssignedAt:at,dispatchedBy:actor.ppicName,dispatchPrice:1000,acceptanceStatus:kind==='start'?'ACCEPTED' as const:'PENDING' as const,status:'NOT_STARTED' as const,startedAt:undefined,updatedAt:at}
  dispatch.taskOverrides=dispatch.taskOverrides.filter(([id])=>id!==task.taskId);dispatch.taskOverrides.push([task.taskId,fields]);runtime.restoreRuntimeDirectDispatchState(dispatch)
  const updated={...task,...fields}
  if(kind==='start') {
    dispatch.reassignedTasks.push([task.taskId,{...updated,mockStartPrerequisiteMet:true,mockReceiveSummary:'隔离验收Mock：开工所需面辅料已接收',acceptedAt:at,acceptedBy:'隔离验收Mock'}])
    runtime.restoreRuntimeDirectDispatchState(dispatch)
    const order=dispatch.productionOrders.find(x=>x.productionOrderId===task.productionOrderId)!
    if(!order)throw new Error('Mock start prerequisite has no production order')
    const template=dispatch.productionOrders.find(x=>x.selectedTechPackVersionId&&x.techPackSnapshot&&x.demandSnapshot)!
    const completeOrder={...template,...order,selectedTechPackVersionId:'MOCK-START-PRECONDITION-V1',techPackSnapshot:{...(order.techPackSnapshot||template.techPackSnapshot),sourceTechPackVersionId:'MOCK-START-PRECONDITION-V1'}}
    dispatch.productionOrders=dispatch.productionOrders.map(x=>x.productionOrderId===order.productionOrderId?completeOrder:x);runtime.restoreRuntimeDirectDispatchState(dispatch)
    core.productionContextStorage.setItem(core.PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:[completeOrder]}))
  }
  const assignment=assignments.createEffectiveTaskAssignment({assignmentId:'ASG-UI-ACTUAL',runtimeTaskId:task.taskId,productionOrderId:task.productionOrderId,productionOrderNo:task.productionOrderNo,taskNo:task.taskNo,factoryId:'ID-F021',factoryName:'CV Micro Sewing Jakarta Pusat',source:'DIRECT_DISPATCH',assignedQty:task.scopeQty,skuLines:task.scopeSkuLines,processCodes:kind==='start'?['CUTTING','SEW','IRON_PACK']:['SEW'],frozenPrice:1000,priceCurrency:'IDR',priceUnit:'件',businessAssignedAt:at,operatedAt:at,operatedBy:actor.ppicName,allocationOperatorPpicId:actor.ppicId,allocationOperatorPpicName:actor.ppicName})
  const p=policy.classifyTaskFulfillmentPolicy(updated),r=returns.createProductionReturnRuleSnapshot({...assignment,policy:p})
  const contract=contracts.generateProductionContract({assignment,policy:p,returnRuleSnapshot:r,processNames:['车缝'],generatedAt:at,generatedBy:actor.ppicName})!
  return {kind,taskId:task.taskId,factoryId:'ID-F021',assignmentId:assignment.assignmentId,contractId:contract.contractId,qty:task.scopeQty}
 }})
 const pda=await import('/src/data/fcs/pda-handover-events.ts')
 const task=runtime.listRuntimeProcessTasks().find(t=>t.status==='IN_PROGRESS'&&runtime.isRuntimeTaskExecutionTask(t))!,template=pda.listPdaHandoverHeads().find(h=>h.headType==='HANDOUT'&&h.taskId===task.taskId)!
 if(!template)throw new Error('Missing valid static handout for completion fixture')
 const qty=task.scopeQty
 const head={...template,handoverId:'HO-UI-COMPLETION',handoverOrderId:'HO-UI-COMPLETION',taskId:task.taskId,sourceTaskId:task.taskId,runtimeTaskId:task.taskId,processBusinessCode:task.processBusinessCode,productionOrderId:task.productionOrderId,productionOrderNo:task.productionOrderNo,completionStatus:'OPEN' as const,factoryCompletionRequired:true,factoryMarkedComplete:false,plannedQty:qty,qtyExpectedTotal:qty,taskStatus:'IN_PROGRESS' as const}
 pda.upsertPdaHandoverHeadMock(head);pda.upsertPdaHandoutRecordMock({recordId:'HR-UI-COMPLETION',handoverId:head.handoverId,taskId:task.taskId,seqNo:1,status:'WRITTEN_BACK',handoverRecordStatus:'WRITTEN_BACK_MATCH',plannedQty:qty,submittedQty:qty,warehouseWrittenQty:qty,receiverWrittenQty:qty,qtyUnit:'件',factorySubmittedAt:'2026-09-25 10:00:00',factoryProofFiles:[],receiverProofFiles:[],warehouseWrittenAt:'2026-09-25 10:05:00'})
 const snapshot=pda.capturePdaHandoverState();localStorage.setItem('higood.formal-merged-handout-actions.v1',JSON.stringify({version:1,...Object.fromEntries(['handoverHeadAdditions','pickupRecordAdditions','handoutRecordAdditions','pickupRecordOverrides','handoutRecordOverrides','handoutRecordVersionHistory','headCompletionOverrides'].map(key=>[key,snapshot[key].filter(([id])=>id==='HO-UI-COMPLETION'||id==='HR-UI-COMPLETION')]))}))
 return {kind,taskId:task.taskId,headId:head.handoverId,factoryId:task.assignedFactoryId,legacyHeadSource:localStorage.getItem('higood.formal-merged-handout-actions.v1'),check:pda.canCompletePdaHandoutHead(head.handoverId)}
}
