import test from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTION_CONTEXT_KEYS, decodeProductionContextRecords, encodeProductionContextRecords, validateProductionContextRecords } from '../../src/data/fcs/production-context-records.ts'
import { diffCuttingRecords } from '../../src/data/fcs/cutting/cutting-record-repository.ts'

test('生产单按单记录；变更一单不重写其他单和任务', () => {
  const raw = JSON.stringify({version:1,orders:[{productionOrderId:'p1',status:'WAIT_ASSIGNMENT'},{productionOrderId:'p2',status:'EXECUTING'}]})
  const before=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,raw)
  assert.equal(before.length,2)
  assert.deepEqual(JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,before)!),JSON.parse(raw))
  const after=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:[{productionOrderId:'p1',status:'EXECUTING'},{productionOrderId:'p2',status:'EXECUTING'}]}))
  assert.deepEqual(diffCuttingRecords(before,after).puts.map(r=>r.value),[{productionOrderId:'p1',status:'EXECUTING'}])
})
test('运行任务独立保存覆盖、拆分、合并、改派及序号，往返保留身份',()=>{
 const state={version:1,taskOverrides:[['t1',{assignedFactoryId:'cut1'}]],splitPlans:[['t2',{sourceTaskId:'t2',results:[{taskId:'t3'}]}]],mergedPlans:[],reassignedTasks:[['t4',{taskId:'t4'}]],auditSeq:8}
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify(state))
 assert.equal(records.length,4)
 assert.deepEqual(JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,records)!),state)
})
test('有效分配索引、独立记录、审计及序号完整往返，拒绝重复身份和损坏格式',()=>{
 const state={version:2,assignments:[['a1',{assignmentId:'a1',runtimeTaskId:'t1',factoryId:'f1',status:'EFFECTIVE'}]],current:[['t1',['a1']]],auditLogs:[{auditId:'log1',assignmentId:'a1',runtimeTaskId:'t1',action:'CREATED'}],assignmentSeq:1,auditSeq:1}
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.assignments,JSON.stringify(state))
 assert.equal(records.length,4)
 assert.deepEqual(JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.assignments,records)!),state)
 assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,'{"version":1,"orders":[{"productionOrderId":"p1"},{"productionOrderId":"p1"}]}'),/重复/)
 assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,'{}'),/格式/)
 assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.assignments,'{"version":2}'),/格式/)
})

const runtime = {version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:0}
const assignments = {version:2,assignments:[['a1',{assignmentId:'a1',runtimeTaskId:'t1',factoryId:'f1',status:'EFFECTIVE'}]],current:[['t1',['a1']]],auditLogs:[{auditId:'l1',assignmentId:'a1',runtimeTaskId:'t1',action:'CREATED'}],auditSeq:1,assignmentSeq:1}
for (const [label, key, value] of [
 ['空字符串',PRODUCTION_CONTEXT_KEYS.orders,''],
 ['数组根',PRODUCTION_CONTEXT_KEYS.orders,'[]'],
 ['生产单数组实体',PRODUCTION_CONTEXT_KEYS.orders,{version:1,orders:[[]]}],
 ['生产单空编号',PRODUCTION_CONTEXT_KEYS.orders,{version:1,orders:[{productionOrderId:' '}]}],
 ['生产单损坏快照',PRODUCTION_CONTEXT_KEYS.orders,{version:1,orders:[{productionOrderId:'p',techPackSnapshot:[]}]}],
 ['任务覆盖数组',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,taskOverrides:[['t',[]]]}],
 ['任务覆盖身份',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,taskOverrides:[['t',{taskId:'other'}]]}],
 ['拆分来源身份',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,splitPlans:[['t',{sourceTaskId:'other',results:[]}]]}],
 ['拆分子项损坏',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,splitPlans:[['t',{sourceTaskId:'t',results:[{}]}]]}],
 ['合并明细损坏',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,mergedPlans:[['t',{mergedTaskId:'t',taskIds:[null]}]]}],
 ['改派任务身份',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,reassignedTasks:[['t',{taskId:'other'}]]}],
 ['不安全序号',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,auditSeq:Number.MAX_SAFE_INTEGER+1}],
 ['重复Map键',PRODUCTION_CONTEXT_KEYS.runtime,{...runtime,taskOverrides:[['t',{}],['t',{}]]}],
 ['current非数组',PRODUCTION_CONTEXT_KEYS.assignments,{...assignments,current:[['t1',{}]]}],
 ['current孤儿',PRODUCTION_CONTEXT_KEYS.assignments,{...assignments,current:[['t1',['missing']]]}],
 ['current跨任务',PRODUCTION_CONTEXT_KEYS.assignments,{...assignments,current:[['t2',['a1']]]}],
 ['current重复引用',PRODUCTION_CONTEXT_KEYS.assignments,{...assignments,current:[['t1',['a1','a1']]]}],
 ['审计孤儿',PRODUCTION_CONTEXT_KEYS.assignments,{...assignments,auditLogs:[{auditId:'l',assignmentId:'missing',runtimeTaskId:'t1',action:'CREATED'}]}],
] as const) test(`拒绝${label}，不吞掉损坏记录`,()=>assert.throws(()=>decodeProductionContextRecords(key,typeof value==='string'?value:JSON.stringify(value))))
test('已保存实体损坏编号、缺少meta或重复meta不能伪造正常空源',()=>{
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify({...runtime,taskOverrides:[['t',{}]]}))
 assert.throws(()=>encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,records.filter(r=>!r.collection.endsWith('runtime-meta'))))
 assert.throws(()=>encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,[...records,{...records[1],id:'other'}]))
 assert.throws(()=>encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,records.map((r,i)=>i? r:{...r,id:'forged'})))
})
test('未登记key及空白JSON拒绝；null明确代表没有覆盖',()=>{
 assert.throws(()=>decodeProductionContextRecords('unknown',null))
 assert.throws(()=>encodeProductionContextRecords('unknown',[]))
 assert.deepEqual(decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,null),[])
})

test('备份校验拒绝未知来源集合、伪造迁移身份及丢失检查点实体',()=>{
 const orders=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:[{productionOrderId:'p'}]}))
 assert.doesNotThrow(()=>validateProductionContextRecords(orders))
 assert.throws(()=>validateProductionContextRecords([{id:'production-context:unknown:x',collection:'production-context:unknown',value:{}}]))
 const value={key:PRODUCTION_CONTEXT_KEYS.orders,fingerprint:'a'.repeat(64),targetFingerprint:'b'.repeat(64),phase:'COMPLETE',count:1,copied:1,ids:[orders[0].id]}
 const checkpoint={id:'source-migration:'+PRODUCTION_CONTEXT_KEYS.orders,collection:'production-context-migrations',value}
 assert.doesNotThrow(()=>validateProductionContextRecords([...orders,checkpoint]))
 // COMPLETE 是迁移历史；之后业务可合法删除实体，不能把历史 ids 当成当前索引。
 assert.doesNotThrow(()=>validateProductionContextRecords([checkpoint]))
 assert.throws(()=>validateProductionContextRecords([{...checkpoint,value:{...value,phase:'VERIFIED'}}]))
 assert.throws(()=>validateProductionContextRecords([{...checkpoint,value:{...value,phase:'COPYING'}}]))
 assert.throws(()=>validateProductionContextRecords([...orders,{...checkpoint,id:'source-migration:forged'}]))
 assert.throws(()=>validateProductionContextRecords([...orders,{...checkpoint,value:{...value,copied:0}}]))
 assert.throws(()=>validateProductionContextRecords([...orders,{...checkpoint,value:{...value,targetFingerprint:'invalid'}}]))
 assert.throws(()=>validateProductionContextRecords([...orders,{...checkpoint,value:{...value,ids:['production-context:assignments:foreign']}}]))
})

test('四类静态运行任务的删除标记完整往返，拒绝混入业务字段或假删除',()=>{
 const value={...runtime,...Object.fromEntries(['taskOverrides','splitPlans','mergedPlans','reassignedTasks'].map(field=>[field,[[field,{__removedStaticRuntimeEntry:true}]]]))}
 const rows=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify(value))
 assert.deepEqual(JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,rows)!),value)
 for(const bad of [{__removedStaticRuntimeEntry:false},{__removedStaticRuntimeEntry:true,taskId:'x'}]) assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify({...runtime,splitPlans:[['x',bad]]})))
})

test('分配副产物按实体保存；合同、样衣及PPIC责任保留独立序号',()=>{
 const fixtures:[string,unknown][]=[
  [PRODUCTION_CONTEXT_KEYS.samples,{version:3,records:[{assignmentId:'A',sample:{sampleId:'S',assignmentId:'A'},suggestionVersions:[]}],commands:[['C',{assignmentId:'A',action:'RECEIVE'}]],sequence:2}],
  [PRODUCTION_CONTEXT_KEYS.contracts,{contracts:[{contractId:'C',assignmentId:'A',scans:[],skuLines:[],processNames:[],returnRuleSnapshot:{fulfillmentRuleCode:'SEWING_TO_IRON_PACK'},status:'EFFECTIVE'}],auditLogs:[],contractSeq:1,scanSeq:0,auditSeq:0}],
  [PRODUCTION_CONTEXT_KEYS.effects,{version:1,entries:[['material-context:A',{assignmentId:'A'}],['sla-current:T','S'],['return-sequence:value',1],['tender:TD',{tenderId:'TD'}]]}],
  [PRODUCTION_CONTEXT_KEYS.responsibility,{version:1,sequence:1,records:[{responsibilityVersionId:'R',runtimeTaskId:'T',assignmentId:'A',commandId:'C',ppicId:'P',effectiveAt:'2026-09-25',remainingItems:[]}]}],
 ]
 for(const [key,value] of fixtures){const rows=decodeProductionContextRecords(key,JSON.stringify(value));assert.deepEqual(JSON.parse(encodeProductionContextRecords(key,rows)!),value);assert.doesNotThrow(()=>validateProductionContextRecords(rows))}
})
test('拒绝缺失渲染必需快照的合同，防止迁移清源后才暴露损坏',()=>{
 assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.contracts,JSON.stringify({contracts:[{contractId:'C',assignmentId:'A',status:'EFFECTIVE',scans:[]}],auditLogs:[],contractSeq:1,scanSeq:0,auditSeq:0})))
})
for(const entry of [['unknown:X',{}],['material-context:A',{assignmentId:'B'}],['return-sequence:value',-1],['sla-current:T',{}]]) test(`关联实体损坏拒绝 ${entry[0]}`,()=>assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,JSON.stringify({version:1,entries:[entry]}))))

test('生产创建匹配来源按生产单身份校验并完整恢复',()=>{
 const source={processCode:'DYE',workOrderId:'DYE-ONE',decision:{productionOrderId:'P1',matchStatus:'WAIT_TECH_PACK',checkedAt:'2026-09-25',operatorName:'计划员'}}
 const raw=JSON.stringify({version:1,orders:[{productionOrderId:'P1',productionCreatedProcessSources:[source]}]})
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,raw)
 validateProductionContextRecords(records)
 assert.deepEqual(JSON.parse(encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,records)!),JSON.parse(raw))
 assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.orders,raw.replace('"productionOrderId":"P1","matchStatus"','"productionOrderId":"P2","matchStatus"')),/身份/)
})

test('工厂结束事实只允许明确任务、操作人和时间',()=>{
 const root={version:1,entries:[['factory-completion:H1',{handoverId:'H1',taskId:'T1',completedAt:'2026-09-25 11:00:00',completedBy:'主管'}]]}
 assert.equal(decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,JSON.stringify(root)).length,1)
 for(const patch of [{handoverId:'H2'},{taskId:''},{completedAt:'bad'},{completedBy:''},{submittedQty:100}]){
  const invalid=structuredClone(root);Object.assign(invalid.entries[0][1],patch)
  assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,JSON.stringify(invalid)),/记录/)
 }
})

test('既有招标定标记录保留真实来源编号并校验价格与操作人',()=>{
 const value={tenderId:'TENDER-OLD',taskId:'TASK-OLD',productionOrderId:'PO-OLD',awardedFactoryId:'F1',awardedFactory:'工厂',awardedPrice:1000,awardReason:'',awardedAt:'2026-09-25 11:00:00',awardedBy:'定标员'}
 const encode=(patch={})=>JSON.stringify({version:1,entries:[['legacy-tender-award:TENDER-OLD',{...value,...patch}]]})
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,encode())
 assert.equal(records[0].collection,'production-context:assignment-effects')
 for(const patch of [{tenderId:'OTHER'},{awardedPrice:0},{awardedBy:''},{taskId:''}])assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,encode(patch)))
})


test('开工交出单头只包含首次零交出事实，拒绝伪造数量和身份',()=>{
 const value={handoverId:'H1',handoverOrderId:'H1',handoverOrderNo:'HO-1',headType:'HANDOUT',taskId:'T1',runtimeTaskId:'T1',factoryId:'F1',completionStatus:'OPEN',factoryMarkedComplete:false,recordCount:0,submittedQtyTotal:0,writtenBackQtyTotal:0,qtyActualTotal:0,plannedQty:180,qtyExpectedTotal:180}
 const encode=(patch={})=>JSON.stringify({version:1,entries:[['started-handover-head:H1',{...value,...patch}]]})
 const records=decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,encode());validateProductionContextRecords(records)
 for(const patch of [{taskId:'T2'},{factoryId:''},{submittedQtyTotal:10},{recordCount:1},{plannedQty:0},{completionStatus:'COMPLETED'}])assert.throws(()=>decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.effects,encode(patch)))
})
