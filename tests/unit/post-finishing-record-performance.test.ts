import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'

// Unit boundary only: execute the owning source with a narrow record-reader /
// transaction stub. Actual native CAS, Blob and multi-domain rollback remain in
// post-quality-storage.test.ts; these counters are not browser performance.
const namespace='higood-fcs-post-finishing-records',revisionId=namespace+'/revision'
const nativeClone=structuredClone
let sequence=0
async function fixture(history=24){
 const key='__postRecordPerformanceContract'+(++sequence),base=buildInspectionSnapshotFromConfigurations({sourceKind:'PRODUCTION_RETURN'})
 base.items=Array.from({length:40},(_,index)=>({...nativeClone(base.items[index%base.items.length]),id:'fixed-item-'+index}))
 let state:any={schemaVersion:5,qcTasks:[]}
 const rows=new Map<string,any>()
 rows.set(revisionId,{id:revisionId,collection:'revision',value:{format:1},version:1})
 rows.set(namespace+'/flow/schemaVersion/value',{id:namespace+'/flow/schemaVersion/value',collection:'flow/schemaVersion',value:5,version:1})
 for(let index=0;index<history;index++){
  const id='QC-STORE-'+index,snapshot={...nativeClone(base),id:'fixed-snapshot-'+index}
  rows.set(namespace+'/flow/qcTasks/'+id,{id:namespace+'/flow/qcTasks/'+id,collection:'flow/qcTasks',value:{qcTaskId:id,status:'质检中',inspection:{snapshot,rounds:[]},independentChecks:[]},version:1})
 }
 const boundary:any={rows,fullReads:0,projections:[] as any[],commits:[] as any[],failRead:false,failProjection:false,failWrite:false,legacy:new Map<string,string>(),clone:nativeClone}
 boundary.read=async()=>{boundary.fullReads++;if(boundary.failRead)throw Error('isolated full read failure');const records=[...rows.values()].map(row=>nativeClone(row));return{records,files:[],migrations:[],referenceFreeValues:new WeakSet(records.filter(row=>row.value&&typeof row.value==='object').map(row=>row.value))}}
 boundary.project=async(selectors:any[],project:(row:any)=>unknown)=>{boundary.projections.push(nativeClone(selectors));if(boundary.failProjection)throw Error('isolated revision read failure');return selectors.flatMap(selector=>{const selected=selector.id?[rows.get(selector.id)].filter(Boolean):[...rows.values()].filter(row=>row.id.startsWith(selector.prefix));return selected.map(row=>project(nativeClone(row))).filter(value=>value!==null)})}
 boundary.commit=async(input:any)=>{
  boundary.commits.push(input)
  if(boundary.failWrite)throw Error('isolated transaction abort')
  for(const entry of [...(input.guards||[]),...input.puts,...input.deletes])if((rows.get(entry.id)?.version||0)!==entry.expectedVersion)throw Error('isolated version conflict')
  for(const row of input.puts){const {expectedVersion,...saved}=row;rows.set(row.id,{...nativeClone(saved),version:expectedVersion+1})}
  for(const row of input.deletes)rows.set(row.id,{id:row.id,collection:'deleted',deleted:true,value:null,version:row.expectedVersion+1})
 }
 ;(globalThis as any)[key]=boundary
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}})
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(name:string)=>boundary.legacy.get(name)??null}})
 const dbUrl=pathToFileURL(new URL('../../src/data/pcs-record-db.ts',import.meta.url).pathname).href
 const stub=`const f=globalThis[${JSON.stringify(key)}];export const readPcsRecords=(...args)=>f.read(...args);export const readPcsRecordProjection=(...args)=>f.project(...args);export const commitPcsRecords=(...args)=>f.commit(...args);export const commitPcsNewRecordGroups=()=>{throw Error('not part of this unit boundary')};export {pcsFileReferences} from ${JSON.stringify(dbUrl)};`
 const stubUrl='data:text/javascript;base64,'+Buffer.from(stub).toString('base64')
 const original=await readFile(new URL('../../src/data/fcs/post-finishing-records.ts',import.meta.url),'utf8')
 const code=ts.transpileModule(original.replace("'../pcs-record-db.ts'",JSON.stringify(stubUrl)),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
 let validations=0
 api.registerPostFinishingRepository('flow',()=>state,(next:any)=>{state=next})
 api.registerPostFinishingRecordValidator(()=>{validations++;assert.equal(state.schemaVersion,5)})
 return {api,boundary,get state(){return state},get validations(){return validations},restore(){if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');Reflect.deleteProperty(globalThis,key)}}
}

test('同revision重复准备仅读版本；外部版本变化才重读，旧演示键不再阻断当前记录保存',async()=>{
 const f=await fixture()
 try{
  await f.api.ensurePostFinishingRecordState();await f.api.ensurePostFinishingRecordState();await f.api.ensurePostFinishingRecordState()
  assert.equal(f.boundary.fullReads,1);assert.equal(f.validations,1);assert.deepEqual(f.boundary.projections,[[{id:revisionId}],[{id:revisionId}]])
  f.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.note='另一标签已保存';f.boundary.rows.get(revisionId).version++
  await f.api.ensurePostFinishingRecordState();assert.equal(f.boundary.fullReads,2);assert.equal(f.state.qcTasks[0].note,'另一标签已保存');assert.equal(f.validations,2)
  f.boundary.legacy.set('legacy-post-store-contract','{"old":"retained"}');await f.api.ensurePostFinishingRecordState()
  await f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='当前记录正常保存'})
  assert.equal(f.boundary.commits.length,1)
 }finally{f.restore()}
})

test('版本窄读失败保留原状态并阻断保存，恢复后完整重读而不返回空种子',async()=>{
 const f=await fixture()
 try{
  await f.api.ensurePostFinishingRecordState();const before=nativeClone(f.state)
  f.boundary.failProjection=true;await f.api.ensurePostFinishingRecordState()
  assert.match(f.api.getPostFinishingStorageFailure(),/revision read failure/);assert.deepEqual(f.state,before)
  f.boundary.failRead=true
  await assert.rejects(f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='不可假成功'}),/无法读取|revision read failure/)
  f.boundary.failProjection=false;f.boundary.failRead=false;await f.api.ensurePostFinishingRecordState();assert.equal(f.api.getPostFinishingStorageFailure(),'');assert.deepEqual(f.state,before)
 }finally{f.restore()}
})

test('只改一张QC时不克隆整仓或串行化历史标准，固定树共引用且返回结果隔离',async()=>{
 const f=await fixture(96),clone=globalThis.structuredClone,stringify=JSON.stringify
 let wholeHistoryClones=0,historicalRecordSerializations=0
 try{
  await f.api.ensurePostFinishingRecordState();const fixed=f.state.qcTasks[0].inspection.snapshot
  globalThis.structuredClone=((value:any,...rest:any[])=>{if(Array.isArray(value?.qcTasks))wholeHistoryClones++;return (clone as any)(value,...rest)}) as typeof structuredClone
  JSON.stringify=((value:any,...rest:any[])=>{if(value?.inspection?.snapshot)historicalRecordSerializations++;return (stringify as any)(value,...rest)}) as typeof JSON.stringify
  const result=await f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='本单保存';return f.state.qcTasks[0]})
  assert.equal(wholeHistoryClones,0);assert.equal(historicalRecordSerializations,0)
  assert.equal(f.state.qcTasks[0].inspection.snapshot,fixed);assert.equal(Object.isFrozen(fixed.items[0]),true)
  result.inspection.snapshot.items[0].criterion='仅调用方修改';assert.notEqual(fixed.items[0].criterion,'仅调用方修改')
  assert.deepEqual(f.boundary.commits[0].puts.map((row:any)=>row.id).sort(),[namespace+'/flow/qcTasks/QC-STORE-0',revisionId].sort())
  assert.equal(f.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-1').version,1)
 }finally{globalThis.structuredClone=clone;JSON.stringify=stringify;f.restore()}
})

test('固定标准深改或替换均明确拒绝，已做的可变字段和持久结果一起回滚',async()=>{
 const f=await fixture()
 try{
  await f.api.ensurePostFinishingRecordState();const before=nativeClone(f.state),persisted=nativeClone([...f.boundary.rows])
  await assert.rejects(f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='先改可变字段';f.state.qcTasks[0].inspection.snapshot.items[0].criterion='不能改固定标准'}),/固定|冻结|read only|readonly/)
  assert.deepEqual(f.state,before);assert.deepEqual([...f.boundary.rows],persisted)
  await assert.rejects(f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].inspection.snapshot=nativeClone(f.state.qcTasks[0].inspection.snapshot)}),/固定|冻结/)
  assert.deepEqual(f.state,before);assert.deepEqual([...f.boundary.rows],persisted)
 }finally{f.restore()}
})

test('固定标准允许共享检查项并深层保护，循环或非JSON资料拒绝读取且不改原记录',async()=>{
 const shared=await fixture(1)
 try{
  const snapshot=shared.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.inspection.snapshot
  snapshot.references.push({id:'shared-reference',value:snapshot.items[0]})
  snapshot.references.auditDescription={criterion:'数组附带的原资料同样固定'}
  await shared.api.ensurePostFinishingRecordState()
  assert.equal(shared.api.getPostFinishingStorageFailure(),'')
  const saved=shared.state.qcTasks[0].inspection.snapshot
  assert.equal(saved.references.at(-1).value,saved.items[0]);assert.equal(Object.isFrozen(saved.items[0]),true)
  assert.equal(Object.isFrozen(saved.references.auditDescription),true)
  await assert.rejects(shared.api.runPostFinishingCommand(()=>{saved.references.at(-1).value.criterion='不能从共享引用更改固定要求'}),/固定|冻结|read only|readonly/)
  await assert.rejects(shared.api.runPostFinishingCommand(()=>{saved.references.auditDescription.criterion='不能修改数组附带资料'}),/固定|冻结|read only|readonly/)
  assert.equal(shared.boundary.commits.length,0)
 }finally{shared.restore()}
 for(const invalid of ['cycle','date']){
  const f=await fixture(1)
  try{
   const snapshot=f.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.inspection.snapshot
   const value:any=invalid==='cycle'?{}:new Date('2026-10-22T00:00:00.000Z')
   if(invalid==='cycle')value.self=value
   snapshot.references.push({id:invalid,value})
   const before=nativeClone([...f.boundary.rows])
   await f.api.ensurePostFinishingRecordState()
   assert.match(f.api.getPostFinishingStorageFailure(),invalid==='cycle'?/循环/:/资料类型/)
   assert.deepEqual([...f.boundary.rows],before);assert.equal(f.boundary.commits.length,0)
   await assert.rejects(f.api.runPostFinishingCommand(()=>{throw Error('不得执行')}),/无法读取/)
  }finally{f.restore()}
 }
})

test('免固定树复制仍保留事务失败与revision CAS回滚，重读后可真实重试',async()=>{
 const f=await fixture()
 try{
  await f.api.ensurePostFinishingRecordState();const before=nativeClone(f.state),persisted=nativeClone([...f.boundary.rows])
  f.boundary.failWrite=true;await assert.rejects(f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='失败不能留下'}),/transaction abort/)
  assert.deepEqual(f.state,before);assert.deepEqual([...f.boundary.rows],persisted)
  f.boundary.failWrite=false;f.boundary.rows.get(revisionId).version++
  await assert.rejects(f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='陈旧标签不可覆盖'}),/version conflict/);assert.deepEqual(f.state,before)
  await f.api.ensurePostFinishingRecordState();await f.api.runPostFinishingCommand(()=>{f.state.qcTasks[0].note='重读后重试成功'})
  assert.equal(f.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.note,'重读后重试成功')
 }finally{f.restore()}
})

test('同时准备共用一次真实读取，后续仍独立核对revision',async()=>{
 const f=await fixture()
 try{
  await Promise.all([f.api.ensurePostFinishingRecordState(),f.api.ensurePostFinishingRecordState(),f.api.ensurePostFinishingRecordState()])
  assert.equal(f.boundary.fullReads,1);assert.equal(f.validations,1);assert.equal(f.boundary.projections.length,0)
  await Promise.all([f.api.ensurePostFinishingRecordState(),f.api.ensurePostFinishingRecordState()])
  assert.equal(f.boundary.fullReads,1);assert.equal(f.boundary.projections.length,1)
 }finally{f.restore()}
})

test('空数组仅在没有附加自有字段时作叶节点；附加对象仍深冻，循环和Date仍拒绝',async()=>{
 const valid=await fixture(1)
 try{
  const references:any=[];references.extra={note:'保留附加资料'}
  valid.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.inspection.snapshot.references=references
  await valid.api.ensurePostFinishingRecordState()
  assert.equal(valid.api.getPostFinishingStorageFailure(),'')
  const fixed=valid.state.qcTasks[0].inspection.snapshot.references
  assert.equal(fixed.length,0);assert.equal(Object.isFrozen(fixed),true);assert.equal(Object.isFrozen(fixed.extra),true)
  assert.throws(()=>{fixed.extra.note='不可深改'},TypeError)
 }finally{valid.restore()}
 for(const kind of ['cycle','date']){
  const invalid=await fixture(1)
  try{
   const references:any=[];references.extra=kind==='cycle'?references:new Date('2026-10-22T00:00:00Z')
   invalid.boundary.rows.get(namespace+'/flow/qcTasks/QC-STORE-0').value.inspection.snapshot.references=references
   await invalid.api.ensurePostFinishingRecordState()
   assert.match(invalid.api.getPostFinishingStorageFailure(),kind==='cycle'?/循环/:/资料类型/)
   assert.equal(invalid.boundary.commits.length,0)
  }finally{invalid.restore()}
 }
})
