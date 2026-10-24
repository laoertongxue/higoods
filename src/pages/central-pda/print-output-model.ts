import {
  listPrintingDispatchDocuments, printingRollReserved, isPrintablePrintingRoll, getPrintingRollDispatchBlockReason,
  printingRollLabelContent, addPrintingRollBarcode, updatePrintingRollBarcode, markPrintingRollBarcodesPrinted,
  assertCentralPrintingActor, type PrintingRollBarcode,
} from '../../data/fcs/printing-task-domain.ts'
import { runPrintingRecordCommand } from '../../data/fcs/printing-records.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralPrintFact } from './print-model.ts'
export type CentralPrintRollInput=Parameters<typeof updatePrintingRollBarcode>[2]
export function centralPrintOutput(orderId:string,factoryId:string){return withFactoryProcessStaticRead(()=>{
  const fact=centralPrintFact(orderId,factoryId)
  if(!fact)return undefined
  const documents=listPrintingDispatchDocuments().filter(doc=>doc.lines.some(line=>line.workOrderId===orderId))
  const rolls=fact.order.barcodes.map(roll=>({...roll,
    reservedBy:documents.find(doc=>doc.status==='草稿'&&doc.lines.some(line=>line.workOrderId===orderId&&line.barcodeIds.includes(roll.id)))?.id,
    printable:isPrintablePrintingRoll(fact.order,roll),dispatchBlock:getPrintingRollDispatchBlockReason(fact.order,roll),
    editable:!fact.closed&&!roll.handoverRecordId&&!['已交出','已入库'].includes(roll.status)&&roll.inboundStatus!=='已上架'&&!printingRollReserved(orderId,roll.id),
  }))
  return{fact,rolls,documents,unmeasured:Math.max(0,fact.order.output.completedQty-rolls.reduce((sum,r)=>sum+r.lengthY,0))}
})}
export function centralPrintLabelRevision(orderId:string,rollId:string,factoryId:string){
  const state=centralPrintOutput(orderId,factoryId),roll=state?.rolls.find(roll=>roll.id===rollId)
  return state&&roll?JSON.stringify([state.fact.order.printOrderNo,state.fact.order.output.sku,state.fact.order.output.qtyUnit,
    state.fact.order.output.objectType,state.fact.order.output.imageUrl,printingRollLabelContent(roll)]):undefined
}
async function digest(value:unknown){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function assertOrder(id:string,actor:FactoryPdaUser){assertCentralPrintingActor(id,actor);const fact=centralPrintFact(id,actor.factoryId);if(!fact||fact.closed)throw new Error('PRINT_closed');return fact}
export async function addCentralPrintRoll(orderId:string,actor:FactoryPdaUser,operationId:string,batchId?:string){return runPrintingRecordCommand(orderId,()=>{
  const fact=assertOrder(orderId,actor),batches=fact.order.productionBatches||[]
  if(batches.length>1&&!batchId)throw new Error('PRINT_chooseBatch')
  return addPrintingRollBarcode(orderId,actor,batchId).id
},operationId,JSON.stringify({action:'print-add-roll',orderId,actor:actor.userId,batchId}))}
export async function saveCentralPrintRoll(orderId:string,rollId:string,input:CentralPrintRollInput,actor:FactoryPdaUser,operationId:string,revision:string){
  const revisionHash=await digest(revision)
  return runPrintingRecordCommand(orderId,()=>{
    assertOrder(orderId,actor)
    if(!revision||centralPrintLabelRevision(orderId,rollId,actor.factoryId)!==revision)throw new Error('CHANGED')
    const fact=centralPrintFact(orderId,actor.factoryId)!,roll=fact.order.barcodes.find(r=>r.id===rollId)
    if(!roll?.batchId&&fact.order.productionBatches?.length&&!input.batchId)throw new Error('PRINT_chooseBatch')
    updatePrintingRollBarcode(orderId,rollId,input,actor)
    return rollId
  },operationId,JSON.stringify({action:'print-save-roll',orderId,rollId,input,actor:actor.userId,revision:revisionHash}))
}
export async function markCentralPrintRollsPrinted(orderId:string,rollIds:string[],revisions:Record<string,string>,actor:FactoryPdaUser,operationId:string){
  const revisionHash=await digest(revisions)
  return runPrintingRecordCommand(orderId,()=>{
    assertOrder(orderId,actor)
    if(!rollIds.length||rollIds.some(id=>!revisions[id]||centralPrintLabelRevision(orderId,id,actor.factoryId)!==revisions[id]))throw new Error('CHANGED')
    markPrintingRollBarcodesPrinted(orderId,rollIds,actor.name,actor)
    return rollIds
  },operationId,JSON.stringify({action:'print-mark-labels',orderId,rollIds,actor:actor.userId,revision:revisionHash}))
}
export function centralPrintRollRemaining(orderId:string,rollId:string,factoryId:string){
  const state=centralPrintOutput(orderId,factoryId)
  return state?Math.max(0,state.fact.order.output.completedQty-state.rolls.filter(roll=>roll.id!==rollId).reduce((sum,roll)=>sum+roll.lengthY,0)):0
}
export type CentralPrintRoll=PrintingRollBarcode
