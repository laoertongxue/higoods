import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureSewingExecutionFact, listSewingExecutionFacts } from '../../src/data/fcs/sewing-execution-history.ts'
import { buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import {
  captureSewingSampleState, restoreSewingSampleState, resetSewingSampleApprovalSuggestionsForTests,
  initializeSewingSampleApprovalSuggestionForAssignment, getSewingSampleApprovalRecord, listSewingSampleApprovalRecords,
  receivePreProductionSampleByPpic, handoffPreProductionSampleToApprover, startSampleApproval, submitSampleApprovalSuggestion,
  recordSampleApprovalFeedbackToFactory,   getSampleApprovalTiming,
} from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'
import { PRODUCTION_CONTEXT_KEYS, decodeProductionContextRecords, encodeProductionContextRecords, saveProductionContextAction } from '../../src/data/fcs/production-context-records.ts'
import { readCuttingRecords, readCuttingRecordFile } from '../../src/data/fcs/cutting/cutting-record-repository.ts'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
const order=productionOrders.find(item=>item.techPackSnapshot)!
const ppic={actorId:'PPIC-QUALITY',actorName:'样衣跟单',role:'PPIC' as const}, approver={actorId:'APPROVER-QUALITY',actorName:'批版甲',role:'SAMPLE_APPROVER' as const}
const input=(id:string,factoryId='ID-F021')=>({assignmentId:id,runtimeTaskId:`TASK-${id}`,productionOrderId:order.productionOrderId,factoryId,factoryName:factoryId,processCodes:['SEW'],ppicId:ppic.actorId,ppicName:ppic.actorName,operatedAt:'2026-10-16T08:00:00Z'})
const snapshot=()=>buildInspectionSnapshotFromConfigurations({sourceKind:'PRE_PRODUCTION_SAMPLE'})
function ready(id:string){initializeSewingSampleApprovalSuggestionForAssignment(input(id));receivePreProductionSampleByPpic({commandId:`R-${id}`,assignmentId:id,actor:ppic,receivedSamplePhotoUrls:['/shirt-sample.jpg'],receivedAt:'2026-10-16T08:00:00Z'});handoffPreProductionSampleToApprover({commandId:`H-${id}`,assignmentId:id,actor:ppic,approverTeamName:'批版组',handedAt:'2026-10-16T08:10:00Z'});startSampleApproval({commandId:`S-${id}`,assignmentId:id,actor:approver,inspectionStandardSnapshot:snapshot(),receivedAt:'2026-10-16T08:15:00Z'})}
test('同厂同款同单分配别名只建立一件样衣，不跨厂共样',()=>{
 resetSewingSampleApprovalSuggestionsForTests();const first=initializeSewingSampleApprovalSuggestionForAssignment(input('alias-a'))!;const second=initializeSewingSampleApprovalSuggestionForAssignment(input('alias-b'))!
 assert.equal(first.sample.sampleId,second.sample.sampleId);assert.equal(getSewingSampleApprovalRecord('alias-b')!.assignmentId,'alias-a');assert.equal(listSewingSampleApprovalRecords().length,1)
 const other=initializeSewingSampleApprovalSuggestionForAssignment(input('alias-c','ID-F022'))!;assert.notEqual(other.sample.sampleId,first.sample.sampleId)
 assert.equal(first.sample.status,'WAITING_PPIC_RECEIVE');assert.equal(first.sample.roundNo,undefined)
})
test('领取固定标准、问题关联项目，原反馈后结束，无二次批版',()=>{
 resetSewingSampleApprovalSuggestionsForTests();ready('quality');const frozen=getSewingSampleApprovalRecord('quality')!.inspectionStandardSnapshot!
 const request={commandId:'SUB-Q',assignmentId:'quality',actor:approver,conclusion:'HAS_PROBLEM' as const,uploadedAt:'2026-10-18T08:15:00Z'}
 assert.throws(()=>submitSampleApprovalSuggestion(request),/具体标准项目/)
 assert.throws(()=>submitSampleApprovalSuggestion({...request,issues:[{itemId:'foreign',note:'不属于本单'}]}),/不属于/)
 assert.throws(()=>submitSampleApprovalSuggestion({...request,issues:[{itemId:frozen.items[0].id,note:''}]}),/问题说明/)
 assert.throws(()=>submitSampleApprovalSuggestion({...request,actor:{...approver,actorId:'another'},issues:[{itemId:frozen.items[0].id,note:'尺寸偏差'}]}),/其他批版人员/)
 const submitted=submitSampleApprovalSuggestion({...request,issues:[{itemId:frozen.items[0].id,note:'尺寸偏差'}]})
 assert.equal(submitted.issues!.length,1);assert.equal(submitted.requiresAnotherApproval,undefined)
 assert.equal(submitSampleApprovalSuggestion({...request,issues:[]}).suggestionVersionId,submitted.suggestionVersionId)
 const after=recordSampleApprovalFeedbackToFactory({commandId:'F-Q',assignmentId:'quality',actor:ppic,feedbackAt:'2026-10-20T08:00:00Z',feedbackNote:'已截图发送工厂负责人'})
 assert.equal(after.sample.status,'FEEDBACK_SENT');assert.equal(after.suggestionVersions.length,1);assert.equal(after.inspectionStandardSnapshot!.id,frozen.id)
 assert.equal(getSampleApprovalTiming(after,'2026-10-22T09:00:00Z').overdue,false,'时效终点为首次意见提交，不是反馈')
 assert.throws(()=>startSampleApproval({commandId:'RESTART-Q',assignmentId:'quality',actor:approver,inspectionStandardSnapshot:snapshot()}),/尚未由PPIC转交/)
})
test('连续48小时跨周末，绝对时间不受运行机时区影响，工厂当地显示',()=>{
 resetSewingSampleApprovalSuggestionsForTests();ready('clock');const record=getSewingSampleApprovalRecord('clock')!
 assert.equal(getSampleApprovalTiming(record,'2026-10-18T08:14:59Z').overdue,false)
 assert.equal(getSampleApprovalTiming(record,'2026-10-18T08:15:00Z').overdue,false)
 assert.equal(getSampleApprovalTiming(record,'2026-10-18T08:15:01Z').overdue,true)
 assert.equal(getSampleApprovalTiming(record).deadlineAt,'2026-10-18 15:15:00')
 assert.equal(getSampleApprovalTiming(record).timeZone,'Asia/Jakarta')
})
test('原库一次提交样衣与标准、Blob，事务中止不半套且可原命令重试',async()=>{
 const memory=installPmsMemoryIdb();const open=indexedDB.open.bind(indexedDB);const wrapped=new WeakSet<object>()
 // Existing narrow IDB helper supplies put/get/delete; this contract adds IDB add used by cutting commands.
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open:(...args:Parameters<IDBFactory['open']>)=>{const req=open(...args);const db=req.result;if(!wrapped.has(db)){const transaction=db.transaction.bind(db);db.transaction=((...input:Parameters<IDBDatabase['transaction']>)=>{const tx=transaction(...input),store=tx.objectStore.bind(tx);tx.objectStore=((name:string)=>{const result=store(name);return Object.assign(result,{add:result.put.bind(result)})});return tx}) as IDBDatabase['transaction'];wrapped.add(db)}return req}}})
 try{
  resetSewingSampleApprovalSuggestionsForTests()
  const save=(id:string,action:()=>unknown)=>saveProductionContextAction({id,intent:id,capture:captureSewingSampleState,restore:value=>restoreSewingSampleState(value as ReturnType<typeof captureSewingSampleState>),action})
  await save('PERSIST-RECEIVE',()=>{initializeSewingSampleApprovalSuggestionForAssignment(input('persist'));return receivePreProductionSampleByPpic({commandId:'P-R',assignmentId:'persist',actor:ppic,receivedSamplePhotoUrls:['data:image/png;base64,aGVsbG8='],receivedAt:'2026-10-22T01:00:00Z'})})
  const received=await readCuttingRecords();const row=received.records.find(item=>item.collection==='production-context:samples')!;assert.ok(row);const ref=(row.value as any).sample.ppicReceivedSamplePhotoUrls[0].$productionFile;assert.ok(ref);assert.equal(await (await readCuttingRecordFile(ref))!.text(),'hello')
  await save('PERSIST-START',()=>{handoffPreProductionSampleToApprover({commandId:'P-H',assignmentId:'persist',actor:ppic,approverTeamName:'批版组',handedAt:'2026-10-22T01:01:00Z'});return startSampleApproval({commandId:'P-S',assignmentId:'persist',actor:approver,receivedAt:'2026-10-22T01:02:00Z',inspectionStandardSnapshot:snapshot()})})
  const before=await readCuttingRecords();memory.setFailWrites(true)
  const submit=()=>submitSampleApprovalSuggestion({commandId:'P-U',assignmentId:'persist',actor:approver,conclusion:'NO_PROBLEM',uploadedAt:'2026-10-22T01:03:00Z'})
  await assert.rejects(save('PERSIST-SUBMIT',submit));assert.deepEqual(await readCuttingRecords(),before);assert.equal(getSewingSampleApprovalRecord('persist')!.sample.status,'APPROVAL_IN_PROGRESS')
  memory.setFailWrites(false);await save('PERSIST-SUBMIT',submit);assert.equal(getSewingSampleApprovalRecord('persist')!.sample.status,'SUGGESTION_UPLOADED');const after=await readCuttingRecords();await save('PERSIST-SUBMIT',submit);assert.deepEqual(await readCuttingRecords(),after)
  const execution=()=>ensureSewingExecutionFact({factoryId:'ID-F021',taskId:'PERSIST-EXEC',productionOrderId:'PERSIST-EXEC-ORDER',styleCode:'PERSIST-STYLE',firstExecutedAt:'2026-10-22T01:04:00Z',source:'MANUAL_START',sourceId:'PERSIST-START',actorName:'实际执行人'})
  const beforeExecution=await readCuttingRecords();memory.setFailWrites(true);await assert.rejects(save('PERSIST-EXECUTION',execution));assert.deepEqual(await readCuttingRecords(),beforeExecution);assert.equal(listSewingExecutionFacts().length,0)
  memory.setFailWrites(false);const executed=await save('PERSIST-EXECUTION',execution) as ReturnType<typeof execution>;assert.equal(executed.ordinal,1);assert.equal(listSewingExecutionFacts().length,1);await save('PERSIST-EXECUTION',execution);assert.equal(listSewingExecutionFacts().length,1)
  const encoded=encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples,after.records)!;assert.ok(encoded.includes('inspectionStandardSnapshot'));assert.ok(!encoded.includes('data:image'));assert.equal(decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples,encoded).filter(item=>item.collection==='production-context:samples').length,1)
 }finally{memory.restore()}
})
