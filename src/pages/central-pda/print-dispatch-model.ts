import {
  getPrintingWorkOrderById, listPrintingWorkOrders, listPrintingDispatchDocuments, isPrintingRollReadyForDispatch,
  createPrintingDispatch, scanPrintingDispatchRoll, confirmPrintingDispatch, removePrintingDispatchRoll, voidPrintingDispatch,
  assertCentralPrintingActor, type PrintingDispatchDocument,
} from '../../data/fcs/printing-task-domain.ts'
import { findPdaHandoverRecord } from '../../data/fcs/pda-handover-events.ts'
import { ensureSpecialCraftRecords } from '../../data/fcs/special-craft-records.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { runPrintingRecordCommand } from '../../data/fcs/printing-records.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { centralPrintFact, centralPrintRevision } from './print-model.ts'

export const printDispatchGroup=(o:{printFactoryId:string;receivingTargetId:string;receivingTargetName:string;receivingTargetWarehouseName:string;output:{qtyUnit:string}})=>JSON.stringify([o.printFactoryId,o.receivingTargetId,o.receivingTargetName,o.receivingTargetWarehouseName,o.output.qtyUnit])
export interface PrintDispatchDraft { documentId:string;scan:string;operationId:string;revision:string }
export function centralPrintDispatch(orderId:string,factoryId:string){return withFactoryProcessStaticRead(()=>{
 const fact=centralPrintFact(orderId,factoryId);if(!fact)return undefined
 const group=printDispatchGroup(fact.order),targetReady=!!(fact.order.receivingTargetId&&fact.order.receivingTargetName&&fact.order.receivingTargetWarehouseName),orders=listPrintingWorkOrders().filter(o=>o.printFactoryId===factoryId&&printDispatchGroup(o)===group)
 const allDocs=listPrintingDispatchDocuments(),docs=allDocs.filter(d=>d.lines.some(l=>l.workOrderId===orderId)||d.lines.length&&d.lines.every(l=>{const o=getPrintingWorkOrderById(l.workOrderId);return o&&printDispatchGroup(o)===group}))
 const reserved=new Map<string,string>()
 for(const d of allDocs.filter(d=>d.status==='草稿'))for(const l of d.lines)for(const id of l.barcodeIds)reserved.set(l.workOrderId+'|'+id,d.id)
 const physical=orders.flatMap(order=>order.barcodes.map(roll=>({order,roll,closed:!!order.manuallyCompletedAt||order.processingStatus==='CANCELLED',reservedBy:reserved.get(order.workOrderId+'|'+roll.id)})))
 const candidates=physical.filter(c=>targetReady&&!c.closed&&!c.roll.handoverRecordId&&!['已交出','已入库'].includes(c.roll.status)&&isPrintingRollReadyForDispatch(c.order,c.roll))
 return {fact,docs,candidates,physical,group,targetReady}
})}
export function centralPrintDispatchDocument(id:string){return withFactoryProcessStaticRead(()=>{
 const doc=listPrintingDispatchDocuments().find(d=>d.id===id);if(!doc)return undefined
 const rows=doc.lines.flatMap(line=>{const order=getPrintingWorkOrderById(line.workOrderId);return line.barcodeIds.map(id=>{
  const current=order?.barcodes.find(r=>r.id===id),saved=line.rolls?.find(r=>r.id===id),roll=doc.status==='草稿'?current||saved:saved||current
  return {order,workOrderId:line.workOrderId,roll:roll?{...roll,handoverRecordId:roll.handoverRecordId||current?.handoverRecordId}:undefined}
 })})
 const records=doc.status==='已交出'?[...new Set(rows.map(r=>r.roll?.handoverRecordId).filter((id):id is string=>!!id))].map(id=>findPdaHandoverRecord(id)).filter((r):r is NonNullable<typeof r>=>!!r&&r.handoverRecordStatus!=='VOIDED'):[]
 const unknown=rows.some(r=>!r.order||!r.roll),scanned=rows.filter(r=>doc.scans?.some(s=>s.workOrderId===r.workOrderId&&s.barcodeId===r.roll?.id)).length
 return {doc,rows,records,unknown,scanned,total:rows.reduce((n,r)=>n+(r.roll?.lengthY||0),0),unit:rows[0]?.order?.output.qtyUnit||'',canConfirm:doc.status==='草稿'&&!unknown&&!!doc.scanCompletedAt&&scanned===rows.length,
  receiptUnknown:doc.status==='已交出'&&(!records.length||rows.some(r=>!r.roll?.handoverRecordId)||records.length!==new Set(rows.map(r=>r.roll?.handoverRecordId)).size)}
})}
export function centralPrintDispatchRevision(orderId:string,factoryId:string,documentId=''):string{return withFactoryProcessStaticRead(()=>{
 const fact=centralPrintFact(orderId,factoryId),d=documentId?centralPrintDispatchDocument(documentId):undefined
 return fact?JSON.stringify([orderId,factoryId,centralPrintRevision(orderId),d?.doc,d?.rows.map(r=>[r.workOrderId,centralPrintRevision(r.workOrderId),r.roll])]):''
})}
export function identifyPrintDispatchRoll(orderId:string,factoryId:string,raw:string,includeUnavailable=false){
 const state=centralPrintDispatch(orderId,factoryId);if(!state)throw new Error('PD_changed')
 if(!state.targetReady)throw new Error('PD_targetMissing')
 const rows=includeUnavailable?state.physical:state.candidates
 const code=raw.trim();if(!code)throw new Error('PD_scanFirst')
 if(code.startsWith('{')){
  try{const qr=JSON.parse(code),found=rows.find(c=>c.order.workOrderId===qr.workOrderId&&c.roll.id===qr.barcodeId&&c.order.output.sku===qr.outputSku)
   if(qr.type!=='PRINTING_OUTPUT_ROLL'||!found)throw new Error();return found
  }catch{throw new Error('PD_wrongScan')}
 }
 const found=rows.filter(c=>c.roll.barcode===code)
 if(found.length!==1)throw new Error('PD_wrongScan')
 return found[0]
}
function assertDispatch(orderId:string,actor:FactoryPdaUser,documentId:string,revision:string){
 assertCentralPrintingActor(orderId,actor)
 const state=centralPrintDispatch(orderId,actor.factoryId),current=documentId?state?.docs.find(d=>d.id===documentId):undefined
 if(!state||state.fact.closed||documentId&&(!current||current.status!=='草稿')||!revision||revision!==centralPrintDispatchRevision(orderId,actor.factoryId,documentId))throw new Error('PD_changed')
 if(!state.targetReady)throw new Error('PD_targetMissing')
 if(current)for(const l of current.lines)assertCentralPrintingActor(l.workOrderId,actor)
}
async function prepare(actor:FactoryPdaUser,orderId:string){await ensureSpecialCraftRecords(true);assertCentralPrintingActor(orderId,actor)}
async function revisionHash(revision:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(revision));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
/** The physical scan creates/merges the native draft and records this same real scan in one save. */
export async function scanCentralPrintDispatch(orderId:string,documentId:string,raw:string,actor:FactoryPdaUser,operationId:string,revision:string){
 await prepare(actor,orderId)
 const found=identifyPrintDispatchRoll(orderId,actor.factoryId,raw,true),existing=documentId?centralPrintDispatchDocument(documentId):undefined,hash=await revisionHash(revision)
 const target=[orderId,found.order.workOrderId,...existing?.doc.lines.map(l=>l.workOrderId)||[]]
 return runPrintingRecordCommand(target,()=>{
  assertDispatch(orderId,actor,documentId,revision)
  const current=identifyPrintDispatchRoll(orderId,actor.factoryId,raw),doc=documentId?centralPrintDispatchDocument(documentId)?.doc:undefined
  if(current.reservedBy&&current.reservedBy!==documentId)throw new Error('PD_reserved')
  if(doc?.scanCompletedAt&&doc.scans?.some(s=>s.workOrderId===current.order.workOrderId&&s.barcodeId===current.roll.id))throw new Error('PD_duplicate')
  const member=doc?.lines.some(l=>l.workOrderId===current.order.workOrderId&&l.barcodeIds.includes(current.roll.id))
  const id=member?documentId:createPrintingDispatch([{workOrderId:current.order.workOrderId,barcodeIds:[current.roll.id]}],actor.name,documentId||undefined,actor)
  scanPrintingDispatchRoll(id,current.roll.barcode,actor.name,actor)
  return id
 },operationId,JSON.stringify({action:'central-print-dispatch-scan',orderId,documentId,raw:raw.trim(),actor:actor.userId,revision:hash}))
}
export type PrintDispatchAction={kind:'CONFIRM'}|{kind:'VOID'}|{kind:'REMOVE';workOrderId:string;rollId:string}
export async function saveCentralPrintDispatch(orderId:string,documentId:string,action:PrintDispatchAction,actor:FactoryPdaUser,operationId:string,revision:string){
 await prepare(actor,orderId)
 const document=centralPrintDispatchDocument(documentId),target=[orderId,documentId,...document?.doc.lines.map(l=>l.workOrderId)||[]],hash=await revisionHash(revision)
 return runPrintingRecordCommand(target,()=>{
  assertDispatch(orderId,actor,documentId,revision)
  if(action.kind==='CONFIRM')confirmPrintingDispatch(documentId,actor.name,actor)
  else if(action.kind==='VOID')voidPrintingDispatch(documentId,actor.name,actor)
  else removePrintingDispatchRoll(documentId,action.workOrderId,action.rollId,actor.name,actor)
  return documentId
 },operationId,JSON.stringify({action:'central-print-dispatch',orderId,documentId,input:action,actor:actor.userId,revision:hash}))
}
