import { getWashingSources, submitWashingCommand } from '../../data/fcs/fabric-washing.ts'
import { ensureWashingRecords, readWashingState } from '../../data/fcs/fabric-washing-repository.ts'
import { type WashingCommand, type WashingHandFeel } from '../../data/fcs/fabric-washing-model.ts'
import { assertCentralPrintingActor } from '../../data/fcs/printing-task-domain.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralPrintFact } from './print-model.ts'

export interface PrintWashingDraft {
  sourceId:string; selected:string[]; decision:''|'NO_WASH'|'WASH'; handFeel:''|WashingHandFeel
  correct:boolean; sendOrderId:string; scans:string[]; scan:string; revision:string; operationId:string
}
export function centralPrintWashing(orderId:string,factoryId:string) {
 return withWashingStaticRead(()=>{
  const fact=centralPrintFact(orderId,factoryId)
  if(!fact)return undefined
  const state=readWashingState(),sources=getWashingSources(orderId)
  return {fact,sources,judgments:state.judgments.filter(j=>j.printOrderId===orderId),
   orders:state.orders.filter(o=>o.source.printOrderId===orderId&&!o.cancelledAt),
   actions:state.actions.filter(a=>sources.some(s=>s.id===a.sourceId)),
   available:(sourceId:string)=>{const source=sources.find(s=>s.id===sourceId);return source?.actualCompleted&&!source.blockedReason?source.rolls.filter(r=>r.confirmed&&r.qty>0&&!!r.unit&&!r.handedOut&&!state.judgments.some(j=>j.printOrderId===orderId&&j.rollId===r.id)).map(r=>r.id):[]}}
 })
}
export function centralPrintWashingRevision(orderId:string,factoryId:string):string {
 const s=centralPrintWashing(orderId,factoryId)
 return s?JSON.stringify([s.fact.closed,s.sources,s.judgments,s.orders]):''
}
export function newPrintWashingDraft(orderId:string,factoryId:string):PrintWashingDraft {
 const state=centralPrintWashing(orderId,factoryId),source=state?.sources.find(s=>s.actualCompleted&&!s.blockedReason)||state?.sources[0]
 const ids=source?state!.available(source.id):[]
 return {sourceId:source?.id||'',selected:ids.length===1?ids:[],decision:'',handFeel:'',correct:false,
  sendOrderId:'',scans:[],scan:'',revision:centralPrintWashingRevision(orderId,factoryId),operationId:crypto.randomUUID()}
}
/** Real scanned identity; never fill a scan from the displayed barcode. */
export function printWashingScan(draft:PrintWashingDraft,state:NonNullable<ReturnType<typeof centralPrintWashing>>,raw:string):void {
 let code=raw.trim()
 if(code.startsWith('{')){
  try {const qr=JSON.parse(code),roll=state.fact.order.barcodes.find(r=>r.id===qr.barcodeId)
   if(qr.type!=='PRINTING_OUTPUT_ROLL'||qr.workOrderId!==state.fact.order.workOrderId||qr.outputSku!==state.fact.order.output.sku||!roll)throw new Error()
   code=roll.barcode
  }catch{throw new Error('PW_wrongScan')}
 }
 const order=state.orders.find(o=>o.id===draft.sendOrderId),roll=order?.rolls.find(r=>r.barcode===code)
 if(!roll)throw new Error('PW_wrongScan')
 if(roll.sentAt)throw new Error('PW_alreadySent')
 if(draft.scans.includes(code))throw new Error('PW_duplicate')
 draft.scans.push(code);draft.scan=''
}
export function printWashingCommand(draft:PrintWashingDraft,state:NonNullable<ReturnType<typeof centralPrintWashing>>):Extract<WashingCommand,{type:'JUDGE'|'SEND'}> {
 if(state.fact.closed)throw new Error('PRINT_closed')
 if(draft.sendOrderId){
  const order=state.orders.find(o=>o.id===draft.sendOrderId)
  if(!order||order.completedAt||order.exception)throw new Error('PW_changed')
  if(!draft.scans.length)throw new Error('PW_scanFirst')
  const selected=order.rolls.filter(r=>draft.scans.includes(r.barcode))
  if(selected.length!==draft.scans.length||selected.some(r=>r.sentAt))throw new Error('PW_changed')
  return {type:'SEND',orderId:order.id,rollIds:selected.map(r=>r.id),scannedCodes:[...draft.scans]}
 }
 const source=state.sources.find(s=>s.id===draft.sourceId)
 if(!source||!source.actualCompleted||source.blockedReason)throw new Error('PW_notReady')
 if(!draft.selected.length)throw new Error('PW_selectRoll')
 if(new Set(draft.selected).size!==draft.selected.length||draft.selected.some(id=>!source.rolls.some(r=>r.id===id&&r.confirmed&&r.qty>0&&!r.handedOut)))throw new Error('PW_changed')
 if(!draft.decision)throw new Error('PW_chooseDecision')
 if(draft.decision==='WASH'&&!draft.handFeel)throw new Error('PW_chooseFeel')
 if(draft.decision==='WASH'&&draft.selected.some(id=>source.rolls.find(r=>r.id===id)?.blockedReason))throw new Error('PW_reserved')
 return {type:'JUDGE',source,rollIds:[...draft.selected],decision:draft.decision,
  ...(draft.decision==='WASH'?{handFeel:draft.handFeel||undefined}:{}),...(draft.correct?{correct:true}:{})}
}
export async function saveCentralPrintWashing(orderId:string,command:Extract<WashingCommand,{type:'JUDGE'|'SEND'}>,actor:FactoryPdaUser,operationId:string,revision:string) {
 await ensureWashingRecords(true)
 assertCentralPrintingActor(orderId,actor)
 const state=centralPrintWashing(orderId,actor.factoryId)
 if(!state||(command.type==='JUDGE'?command.source.printOrderId!==orderId:!state.orders.some(o=>o.id===command.orderId)))throw new Error('PW_changed')
 return submitWashingCommand(command,{id:actor.userId,name:actor.name,factoryId:actor.factoryId,role:'现场判断人员'},operationId,()=>{
  assertCentralPrintingActor(orderId,actor)
  if(!revision||revision!==centralPrintWashingRevision(orderId,actor.factoryId)||centralPrintFact(orderId,actor.factoryId)?.closed)throw new Error('PW_changed')
 })
}
