import { getPrintingDocumentCompletion, completePrintWorkOrderDocument, assertCentralPrintingActor } from '../../data/fcs/printing-task-domain.ts'
import { runPrintingRecordCommand } from '../../data/fcs/printing-records.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralPrintFact } from './print-model.ts'

export function centralPrintCompletion(orderId:string,factoryId:string){
 return centralPrintFact(orderId,factoryId)?getPrintingDocumentCompletion(orderId):undefined
}
export async function saveCentralPrintCompletion(orderId:string,actor:FactoryPdaUser,operationId:string,expectedRevision:string){
 return runPrintingRecordCommand(orderId,()=>{
  assertCentralPrintingActor(orderId,actor)
  const fact=centralPrintFact(orderId,actor.factoryId),state=getPrintingDocumentCompletion(orderId)
  if(!fact||fact.closed||!expectedRevision||state.revision!==expectedRevision)throw new Error('CHANGED')
  if(!state.ready)throw new Error('PRINT_completionNotReady')
  const saved=completePrintWorkOrderDocument(orderId,{operatorName:actor.name},actor)
  return{orderId,completedAt:saved.manuallyCompletedAt,completedByUserId:saved.manuallyCompletedByUserId}
 },operationId,JSON.stringify({action:'central-print-complete',orderId,actor:actor.userId,expectedRevision}))
}
