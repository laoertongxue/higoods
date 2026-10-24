import assert from 'node:assert/strict'
import test from 'node:test'
import {decodeProductionContextRecords,encodeProductionContextRecords,PRODUCTION_CONTEXT_KEYS} from '../../src/data/fcs/production-context-records.ts'
import {getDefaultSewingSampleApprovalRecords} from '../../src/data/fcs/sewing-outsourcing-demo.ts'
import {normalizeSeamEmbroideryReferences} from '../../src/data/fcs/seam-embroidery-identity.ts'
import type {CuttingStoredRecord} from '../../src/data/fcs/cutting/cutting-record-repository.ts'
const key=PRODUCTION_CONTEXT_KEYS.samples
function data(count=1){
 const template=getDefaultSewingSampleApprovalRecords()[2]
 const items=Array.from({length:40},(_,index)=>({...structuredClone(template.inspectionStandardSnapshot!.items[index%template.inspectionStandardSnapshot!.items.length]),id:`COLD-ITEM-${index}`}))
 return {version:3,records:Array.from({length:count},(_,index)=>{
  const record=structuredClone(template),id=`COLD-SAMPLE-${index}`
  record.assignmentId=id;record.sample.assignmentId=id;record.sample.sampleId=`COLD-PHYSICAL-${index}`
  record.inspectionStandardSnapshot!.items=structuredClone(items)
  record.suggestionVersions[0].issues=[{itemId:'COLD-ITEM-0',note:'原历史具体问题不丢失'}]
  record.sample.ppicReceivedSamplePhotoUrls=[{$productionFile:'production-context-file:'+'a'.repeat(64)}] as any
  record.legacyHistory={original:{untouchedField:{nested:['原全文',index,{originalPicture:{$productionFile:'production-context-file:'+'b'.repeat(64)}}]}},convertedAt:'2026-10-22T00:00:00Z',convertedBy:'原核对人',unverifiedTime:true,note:'明确合成的原样衣schema/序列化压力夹具'}
  return record
 }),commands:Array.from({length:count},(_,index)=>[`COLD-COMMAND-${index}`,{assignmentId:`COLD-SAMPLE-${index}`,action:'SUBMIT_SUGGESTION'}]),sequence:count+6000}
}
const rows=(value=data())=>decodeProductionContextRecords(key,JSON.stringify(value))

test('2000件40项固定快照只生成一次完整raw，不再parse自己生成的raw或逐件深度stringify；全文/引用完整',()=>{
 const original=data(2000),saved=rows(original),stringify=JSON.stringify,parse=JSON.parse
 let parses=0,allRawSerializations=0,deepRowSerializations=0
 JSON.parse=((...args:Parameters<typeof JSON.parse>)=>{parses++;return parse(...args)}) as typeof JSON.parse
 JSON.stringify=((value:any,...args:any[])=>{if(value?.version===3&&value.records?.length===2000)allRawSerializations++;if(value?.assignmentId?.startsWith('COLD-SAMPLE-'))deepRowSerializations++;return (stringify as any)(value,...args)}) as typeof JSON.stringify
 let encoded:string
 try{encoded=encodeProductionContextRecords(key,saved)!}finally{JSON.stringify=stringify;JSON.parse=parse}
 assert.deepEqual({parses,allRawSerializations,deepRowSerializations},{parses:0,allRawSerializations:1,deepRowSerializations:0})
 assert.equal(encoded!,JSON.stringify(original))
 assert.deepEqual(decodeProductionContextRecords(key,encoded!),saved)
 const last=JSON.parse(encoded!).records.at(-1)
 assert.equal(last.inspectionStandardSnapshot.items.length,40);assert.equal(last.suggestionVersions[0].issues[0].note,'原历史具体问题不丢失')
 assert.equal(last.legacyHistory.original.untouchedField.nested[2].originalPicture.$productionFile,'production-context-file:'+'b'.repeat(64))
 assert.equal(last.sample.ppicReceivedSamplePhotoUrls[0].$productionFile,'production-context-file:'+'a'.repeat(64))
})

test('普通samples仍拒坏样衣/快照/问题/sequence/重复id及精确row-command-meta身份，不因省去roundtrip放过',()=>{
 const original=rows(),sample=(r:CuttingStoredRecord[])=>r.find(row=>row.collection==='production-context:samples')!.value as any
 const cases:Array<[string,(r:CuttingStoredRecord[])=>void]>=[
  ['inner assignment mismatch',r=>{sample(r).sample.assignmentId='FOREIGN'}],
  ['missing sample identity',r=>{delete sample(r).sample.sampleId}],
  ['unknown current state',r=>{sample(r).sample.status='INVENTED'}],
  ['invalid snapshot',r=>{delete sample(r).inspectionStandardSnapshot.items[0].criterion}],
  ['duplicate item identity',r=>{sample(r).inspectionStandardSnapshot.items[1].id=sample(r).inspectionStandardSnapshot.items[0].id}],
  ['foreign issue',r=>{sample(r).suggestionVersions[0].issues[0].itemId='FOREIGN'}],
  ['has problem no issue',r=>{delete sample(r).legacyHistory;sample(r).suggestionVersions[0].issues=[]}],
  ['invalid time',r=>{sample(r).sample.approverReceivedInstant='not-a-time'}],
  ['negative sequence',r=>{(r.find(row=>row.collection==='production-context:sample-meta')!.value as any).sequence=-1}],
  ['missing sequence',r=>{r.splice(r.findIndex(row=>row.collection==='production-context:sample-meta'),1)}],
  ['duplicate sample',r=>{r.push(structuredClone(r[0]))}],
  ['wrong sample row id',r=>{r[0].id='production-context:samples:FOREIGN'}],
  ['wrong metadata id',r=>{r.find(row=>row.collection==='production-context:sample-meta')!.id+='-FOREIGN'}],
  ['wrong command id',r=>{r.find(row=>row.collection==='production-context:sample-commands')!.id+='-FOREIGN'}],
  ['wrong command value',r=>{(r.find(row=>row.collection==='production-context:sample-commands')!.value as any).value.action=''}],
  ['unknown row field',r=>{(r[0] as any).unmanagedField={mustNotDisappear:true}}],
  ['unknown undefined row field',r=>{(r[0] as any).unmanagedField=undefined}],
  ['unknown command metadata',r=>{(r.find(row=>row.collection==='production-context:sample-commands')!.value as any).unmanagedField=1}],
  ['unknown sequence metadata',r=>{(r.find(row=>row.collection==='production-context:sample-meta')!.value as any).unmanagedField=1}],
 ]
 for(const [label,change] of cases){const input=structuredClone(original);change(input);assert.throws(()=>encodeProductionContextRecords(key,input),undefined,label)}
})

test('真实旧绣花身份触发原规范化路径，输入不变，旧数量/文件/重复节点身份保留；额外row元数据仍拒',()=>{
 const input=rows(),record=input.find(row=>row.collection==='production-context:samples')!.value as any
 record.legacyHistory.original={craftCode:'CRAFT_1048576',craftName:'曲牙绣',legacyValue:1048576,operationId:'OLD-OP',quantity:7,sourceId:'KEEP-SOURCE',
  route:[{id:'KEEP-NODE-A',craftCode:'CRAFT_3000003',craftName:'贝壳绣',quantity:3},{id:'KEEP-NODE-B',craftCode:'CRAFT_3000004',craftName:'一字贝绣花',quantity:4}],photo:{$productionFile:'production-context-file:'+'b'.repeat(64)}}
 const before=structuredClone(input),actual=encodeProductionContextRecords(key,input)!,normalized=normalizeSeamEmbroideryReferences(structuredClone(data()))
 normalized.records[0]=structuredClone(record);normalizeSeamEmbroideryReferences(normalized)
 assert.deepEqual(JSON.parse(actual),normalized);assert.deepEqual(input,before)
 const history=JSON.parse(actual).records[0].legacyHistory.original
 assert.equal(history.craftCode,'CRAFT_3000010');assert.equal(history.craftName,'缝边绣');assert.equal(history.quantity,7);assert.equal(history.sourceId,'KEEP-SOURCE')
 assert.deepEqual(history.route.map((r:any)=>r.id),['KEEP-NODE-A','KEEP-NODE-B']);assert.deepEqual(history.route.map((r:any)=>r.quantity),[3,4])
 assert.equal(history.photo.$productionFile,'production-context-file:'+'b'.repeat(64))
 const invalid=structuredClone(input);(invalid[0] as any).unmanagedField='must reject';assert.throws(()=>encodeProductionContextRecords(key,invalid),/身份或元数据/)
})

test('其他七类来源保持原编解码与元数据校验，不接入samples优化',()=>{
 const fact={id:'SEW-EXEC:ID-F021:OTHER-ORDER:OTHER-STYLE',factoryId:'ID-F021',taskId:'OTHER-TASK',productionOrderId:'OTHER-ORDER',styleCode:'OTHER-STYLE',taskAliases:['OTHER-TASK'],firstExecutedAt:'2026-10-22T01:00:00Z',confirmedAt:'2026-10-22T01:00:00Z',sourceId:'OTHER-SOURCE',actorName:'原执行人',source:'MANUAL_START',ordinal:1}
 const inputs:Array<[string,unknown]>=[
  [PRODUCTION_CONTEXT_KEYS.orders,{version:1,orders:[{productionOrderId:'OTHER-ORDER',demandSnapshot:{untouched:true},taskBreakdownSummary:{},techPackSnapshot:null}]}],
  [PRODUCTION_CONTEXT_KEYS.runtime,{version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:7}],
  [PRODUCTION_CONTEXT_KEYS.assignments,{version:2,assignments:[],current:[],auditLogs:[],assignmentSeq:7,auditSeq:8}],
  [PRODUCTION_CONTEXT_KEYS.sewingExecutions,{version:1,facts:[fact]}],
  [PRODUCTION_CONTEXT_KEYS.contracts,{contracts:[],auditLogs:[],contractSeq:3,scanSeq:4,auditSeq:5}],
  [PRODUCTION_CONTEXT_KEYS.effects,{version:1,entries:[['material-sequence:value',4]]}],
  [PRODUCTION_CONTEXT_KEYS.responsibility,{version:1,records:[],sequence:9}],
 ]
 for(const [source,value] of inputs){const saved=decodeProductionContextRecords(source,JSON.stringify(value)),encoded=encodeProductionContextRecords(source,saved)!;assert.deepEqual(decodeProductionContextRecords(source,encoded),saved,source);const invalid=structuredClone(saved);invalid[0].id+='-FOREIGN';assert.throws(()=>encodeProductionContextRecords(source,invalid),/身份或元数据/,source)}
})
