import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureSewingExecutionFact, listSewingExecutionFacts } from '../../src/data/fcs/sewing-execution-history.ts'
import { buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import {
  captureSewingSampleState, restoreSewingSampleState, resetSewingSampleApprovalSuggestionsForTests,
  initializeSewingSampleApprovalSuggestionForAssignment, getSewingSampleApprovalRecord, listSewingSampleApprovalRecords,
  receivePreProductionSampleByPpic, handoffPreProductionSampleToApprover, startSampleApproval, submitSampleApprovalSuggestion,
  recordSampleApprovalFeedbackToFactory, convertLegacySampleApproval, supplementLegacySampleStandard, getSampleApprovalTiming,
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
test('显式转换旧领取记录保留人和原时间，补定记录缺失原因，不伪造当时快照',()=>{
 resetSewingSampleApprovalSuggestionsForTests();ready('legacy');const state=captureSewingSampleState(),legacy=state.records[0][1]
 delete legacy.qualitySchemaVersion;delete legacy.inspectionStandardSnapshot;delete legacy.sample.approverReceivedInstant;legacy.sample.approverReceivedAt='2026-10-16 15:15:00';legacy.sample.roundNo=1
 restoreSewingSampleState(state)
 const converted=convertLegacySampleApproval({assignmentId:'legacy',commandId:'C-L',at:'2026-10-22T01:00:00Z',by:'记录核对人'})
 assert.equal(converted.currentApproverId,approver.actorId);assert.equal(converted.sample.approverReceivedAt,'2026-10-16 15:15:00');assert.equal(converted.sample.approverReceivedInstant,undefined);assert.equal(getSampleApprovalTiming(converted).timeVerified,false);assert.ok(converted.legacyHistory)
 assert.equal(converted.inspectionStandardSnapshot,undefined)
 const supplemented=supplementLegacySampleStandard({assignmentId:'legacy',commandId:'L-S',at:'2026-10-22T01:05:00Z',by:approver.actorName,reason:'旧记录原无快照，本次明确补定',snapshot:snapshot()})
 assert.equal(supplemented.sample.approverReceivedAt,converted.sample.approverReceivedAt);assert.equal(supplemented.currentApproverId,approver.actorId);assert.match(supplemented.standardSupplement!.reason,/原无快照/)
})
test('旧未发生再批归档，已有下一件保留状态；多件真实实收冲突不合并',()=>{
 resetSewingSampleApprovalSuggestionsForTests();ready('old-plan');const state=captureSewingSampleState(),record=state.records[0][1];delete record.qualitySchemaVersion
 record.suggestionVersions=[{suggestionVersionId:'OLD-S',suggestionNo:'OLD',assignmentId:record.assignmentId,runtimeTaskId:record.sample.runtimeTaskId,sampleId:record.sample.sampleId,roundNo:1,conclusion:'HAS_PROBLEM',structuredComments:{fabricApprovalComment:'',processComment:'旧意见',materialUsageComment:'',otherComment:''},approvalSheetPhotoUrls:['/shirt-sample.jpg'],referenceSnapshots:[],requiresAnotherApproval:true,uploadedAt:'2026-10-16 15:20:00',uploadedById:approver.actorId,uploadedByName:approver.actorName,feedbackSentAt:'2026-10-16 15:30:00'}]
 record.sample.roundNo=2;record.sample.status='WAITING_FACTORY_PRODUCTION';delete record.sample.ppicReceivedAt;delete record.sample.approverReceivedAt
 restoreSewingSampleState(state);const converted=convertLegacySampleApproval({assignmentId:record.assignmentId,commandId:'OLD-PLAN',at:'2026-10-22T01:00:00Z',by:'核对人'});assert.equal(converted.sample.status,'FEEDBACK_SENT');assert.equal(converted.suggestionVersions.length,1);assert.ok(converted.legacyHistory!.original)
 const conflict=captureSewingSampleState(),other=structuredClone(conflict.records[0][1]);delete other.qualitySchemaVersion;other.assignmentId='old-other';other.sample.assignmentId='old-other';other.sample.ppicReceivedAt='2026-10-17 09:00:00';conflict.records[0][1].sample.ppicReceivedAt='2026-10-16 15:00:00';conflict.records.push(['old-other',other]);restoreSewingSampleState(conflict)
 assert.throws(()=>convertLegacySampleApproval({assignmentId:'old-other',commandId:'CONFLICT',at:'2026-10-22T01:00:00Z',by:'核对人'}),/多件真实样衣/)
})
test('旧再批下一件已经实收或领取时保留当前件，旧轮意见只归档且当前意见指针不能悬空',()=>{
 for(const status of ['PPIC_RECEIVED','APPROVAL_IN_PROGRESS'] as const){
  resetSewingSampleApprovalSuggestionsForTests();ready(`legacy-physical-${status}`)
  const state=captureSewingSampleState(),record=state.records[0][1]
  delete record.qualitySchemaVersion;delete record.inspectionStandardSnapshot;delete record.sample.approverReceivedInstant
  record.sample.roundNo=2;record.sample.status=status;record.sample.ppicReceivedAt='2026-10-17 09:00:00'
  if(status==='PPIC_RECEIVED'){delete record.sample.approverReceivedAt;delete record.sample.approverReceivedBy;delete record.currentApproverId;delete record.currentApproverName}
  else record.sample.approverReceivedAt='2026-10-17 09:15:00'
  record.suggestionVersions=[{suggestionVersionId:'OLD-ROUND-1',suggestionNo:'OLD-ROUND-1',assignmentId:record.assignmentId,runtimeTaskId:record.sample.runtimeTaskId,sampleId:record.sample.sampleId,roundNo:1,conclusion:'HAS_PROBLEM',structuredComments:{fabricApprovalComment:'',processComment:'第一轮旧意见',materialUsageComment:'',otherComment:''},approvalSheetPhotoUrls:['/shirt-sample.jpg'],referenceSnapshots:[],requiresAnotherApproval:true,uploadedAt:'2026-10-16 15:20:00',uploadedById:approver.actorId,uploadedByName:approver.actorName,feedbackSentAt:'2026-10-16 15:30:00'}]
  record.latestSuggestionVersionId='OLD-ROUND-1';restoreSewingSampleState(state)
  const result=convertLegacySampleApproval({assignmentId:record.assignmentId,commandId:`C-PHYSICAL-${status}`,at:'2026-10-22T01:00:00Z',by:'旧资料核对人'})
  assert.equal(result.sample.status,status);assert.equal(result.sample.ppicReceivedAt,'2026-10-17 09:00:00');assert.equal(result.sample.roundNo,undefined)
  assert.equal(result.suggestionVersions.length,0);assert.equal(result.latestSuggestionVersionId,undefined)
  assert.equal((result.legacyHistory!.original as typeof record).suggestionVersions[0].suggestionVersionId,'OLD-ROUND-1')
  assert.equal((result.legacyHistory!.original as typeof record).suggestionVersions[0].approvalSheetPhotoUrls[0],'/shirt-sample.jpg')
  if(status==='APPROVAL_IN_PROGRESS'){assert.equal(result.currentApproverId,approver.actorId);assert.equal(result.sample.approverReceivedAt,'2026-10-17 09:15:00')}
  assert.equal(listSewingSampleApprovalRecords().length,1,'只保留本件当前样衣，不派生下一轮')
 }
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
