import assert from 'node:assert/strict'
import test from 'node:test'
import {installPmsMemoryIdb} from '../helpers/pms-memory-idb.ts'
import {saveProductionContextAction,productionContextStorage,PRODUCTION_CONTEXT_KEYS} from '../../src/data/fcs/production-context-records.ts'
import {saveSewingSampleSourceUiAction} from '../../src/data/fcs/production-context-actions.ts'
import {captureSewingSampleState,restoreSewingSampleState,resetSewingSampleApprovalSuggestionsForTests,initializeSewingSampleApprovalSuggestionForAssignment,
 receivePreProductionSampleByPpic,getSewingSampleApprovalRecord} from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'
import {productionOrders} from '../../src/data/fcs/production-orders.ts'
import {readCuttingRecords,readCuttingRecordFile} from '../../src/data/fcs/cutting/cutting-record-repository.ts'

test('专用原库单件动作失败回滚与原重试、同步旧JSON及generic动作保留新样衣',async()=>{
 const memory=installPmsMemoryIdb(),open=indexedDB.open.bind(indexedDB),wrapped=new WeakSet<object>()
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open:(...args:Parameters<IDBFactory['open']>)=>{
  const req=open(...args),db=req.result
  if(!wrapped.has(db)){const transaction=db.transaction.bind(db);db.transaction=((...input:Parameters<IDBDatabase['transaction']>)=>{const tx=transaction(...input),store=tx.objectStore.bind(tx);tx.objectStore=((name:string)=>{const value=store(name);return Object.assign(value,{add:value.put.bind(value)})});return tx}) as IDBDatabase['transaction'];wrapped.add(db)}return req
 }}})
 try{
  resetSewingSampleApprovalSuggestionsForTests()
  const order=productionOrders.find(o=>o.techPackSnapshot)!,actor={actorId:'SCOPE-PPIC',actorName:'实际跟单',role:'PPIC' as const}
  await saveProductionContextAction({id:'SCOPE-INITIAL-LEGAL',intent:'隔离合法两厂待收样衣',capture:captureSewingSampleState,restore:value=>restoreSewingSampleState(value as ReturnType<typeof captureSewingSampleState>),action:()=>{
   for(const [id,factoryId] of [['SCOPE-ONE','ID-F021'],['SCOPE-TWO','ID-F022']])initializeSewingSampleApprovalSuggestionForAssignment({assignmentId:id,runtimeTaskId:`TASK-${id}`,productionOrderId:order.productionOrderId,factoryId,factoryName:factoryId,processCodes:['SEW'],ppicId:actor.actorId,ppicName:actor.actorName,operatedAt:'2026-10-22T01:00:00Z'})
   return true
  }})
  const original=await readCuttingRecords(),other=getSewingSampleApprovalRecord('SCOPE-TWO'),input='data:image/png;base64,aGVsbG8='
  const receive=()=>saveSewingSampleSourceUiAction('SCOPE-ONE','SCOPE-RECEIVE','same unsaved original input',()=>receivePreProductionSampleByPpic({assignmentId:'SCOPE-ONE',commandId:'SCOPE-RECEIVE',actor,receivedAt:'2026-10-22T02:00:00Z',receivedSamplePhotoUrls:[input]}))
  memory.setFailWrites(true);await assert.rejects(receive());assert.deepEqual(await readCuttingRecords(),original);assert.equal(getSewingSampleApprovalRecord('SCOPE-ONE')!.sample.status,'WAITING_PPIC_RECEIVE');assert.deepEqual(getSewingSampleApprovalRecord('SCOPE-TWO'),other)
  memory.setFailWrites(false);const received=await receive();assert.equal(received.sample.status,'PPIC_RECEIVED');assert.deepEqual(getSewingSampleApprovalRecord('SCOPE-TWO'),other)
  const after=await readCuttingRecords(),one=after.records.find(r=>r.id==='production-context:samples:SCOPE-ONE')!.value as any,ref=one.sample.ppicReceivedSamplePhotoUrls[0].$productionFile
  assert.equal(await (await readCuttingRecordFile(ref))!.text(),'hello')
  // Do not read old samples JSON before this generic action: it must flush the
  // dirty original view itself before copying all serialized source keys.
  await saveProductionContextAction({id:'SCOPE-GENERIC',intent:'原generic非样衣序次动作',capture:()=>productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.runtime),restore:value=>productionContextStorage.setItem(PRODUCTION_CONTEXT_KEYS.runtime,value as string),action:()=>{
   const raw=productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.runtime),value=raw?JSON.parse(raw):{version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:0}
   productionContextStorage.setItem(PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify({...value,auditSeq:value.auditSeq+1}));return true
  }})
  assert.equal(getSewingSampleApprovalRecord('SCOPE-ONE')!.sample.status,'PPIC_RECEIVED');assert.deepEqual(getSewingSampleApprovalRecord('SCOPE-TWO'),other)
  const old=JSON.parse(productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.samples)!)
  assert.equal(old.records.find((r:any)=>r.assignmentId==='SCOPE-ONE').sample.status,'PPIC_RECEIVED')
  assert.equal((await readCuttingRecords()).records.filter(r=>r.id==='production-context:sample-commands:SCOPE-RECEIVE').length,1)
 }finally{memory.restore()}
})
