import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePcsRecordSnapshot,encodePcsRecordSnapshot} from '../../src/data/pcs-record-codec.ts'
import {normalizeSampleCostOptionalProcessRows,calculateSampleCostReview} from '../../src/data/pcs-sample-cost-review-pricing.ts'
import * as inline from '../../src/data/pcs-project-inline-node-record-repository.ts'
import {spawnSync} from 'node:child_process'

const key='higood-pcs-project-inline-node-records-v2'
const removedLabel='历史未编码项'
const coded={craftCode:'CUSTOM-COST-01',processName:'自定义有编码项',costAmount:5,costCurrency:'RMB',id:'keep-line',proofFileId:'evidence-file'}
function fields(){return {sampleCostOptionalProcessRows:JSON.stringify([{processName:removedLabel,costAmount:25,costCurrency:'RMB'},coded]),optionalProcessLines:[removedLabel+' ¥25',coded.processName+' ¥5'],optionalProcessCostCny:30,costTotal:100,actualSampleCost:100,targetProductionCost:60,costVariance:40,costVariancePercentage:66.67,materialCostCny:30,dyeingCostCny:10,auxiliaryCostCny:10,fixedProcessCostCny:15,sewingCostCny:5,exchangeRate:2200,salesPrice:200,salesCurrency:'RMB',processSummary:'旧展示缓存',priceFormulaText:'旧金额缓存'}}
function record(){return {recordId:'cost-review-user-1',recordCode:'COST-1',projectId:'project-1',projectNodeId:'node-1',stepCode:'SAMPLE_COST_REVIEW',businessDate:'2026-01-01',updatedAt:'2026-01-01',payload:fields(),detailSnapshot:fields(),upstreamRefs:[],downstreamRefs:[],createdBy:'原操作人',logs:[{id:'log-1',description:removedLabel}]}}
function assertClean(value:any){
 const row=value.records[0];assert.equal(row.recordId,'cost-review-user-1');assert.equal(value.records.length,2)
 for(const field of [row.payload,row.detailSnapshot]){assert.deepEqual(JSON.parse(field.sampleCostOptionalProcessRows),[coded]);assert.equal(field.optionalProcessCostCny,5);assert.equal(field.costTotal,75);assert.equal(field.actualSampleCost,75);assert.equal(field.costVariance,15);assert.equal(field.costVariancePercentage,25);assert.equal(field.optionalProcessLines.some((line:any)=>JSON.stringify(line).includes(removedLabel)),false);assert.equal(field.materialCostCny,30);assert.equal(field.fixedProcessCostCny,15)}
 assert.deepEqual(row.logs,[{id:'log-1',description:removedLabel}]);assert.deepEqual(value.records[1],{recordId:'unrelated-cost',payload:{materialCost:88},fixedProcessLines:[{processName:'固定费用',costAmount:4}],logs:[{optionalProcessLines:[removedLabel],note:'日志事实'}]})
}
function snapshot(){return {version:2,records:[record(),{recordId:'unrelated-cost',payload:{materialCost:88},fixedProcessLines:[{processName:'固定费用',costAmount:4}],logs:[{optionalProcessLines:[removedLabel],note:'日志事实'}]}]}}

test('PCS读取清理真实JSON字符串中的无编码历史可选行，只调整可选金额与派生缓存',()=>{
 const input=snapshot(),raw=JSON.stringify(input),actual=normalizePcsRecordSnapshot(key,raw)
 assertClean(actual);assert.equal(JSON.stringify(input),raw)
 assertClean(normalizePcsRecordSnapshot(key,JSON.stringify(actual)))
})

test('已存在IDB记录encode也清理同结构快照，不让旧显示缓存复活',()=>{
 const old=snapshot(),stored=[{id:key+'/meta',collection:key,value:{array:false,groups:['records'],fields:{version:2}},version:1},...old.records.map((data,position)=>({id:key+'/records/'+data.recordId,collection:key+'/records',value:{position,data},version:1}))]
 assertClean(JSON.parse(encodePcsRecordSnapshot(key,stored)!))
})

test('新鲜公开计价仍接受名称输入，历史清理单独过滤，显式工艺和自定义code保留',()=>{
 const rows=normalizeSampleCostOptionalProcessRows([{processName:removedLabel,costAmount:8},coded,{code:'PRINT',processName:'印花',costAmount:2200,costCurrency:'IDR'}] as any)
 assert.equal(rows.length,3);assert.equal((rows[1] as any).craftCode,coded.craftCode);assert.equal((rows[2] as any).code,'PRINT')
 const pricing=calculateSampleCostReview({optionalProcessLines:rows,exchangeRate:2200})
 assert.equal(pricing.optionalProcessCostCny,6+Math.round(8/2200*100)/100)
})

test('cache-only有编码行的嵌套cost金额和币种原样保留，不能被默认0覆盖',()=>{
 const row={id:'nested-money-line',craftCode:'CUSTOM-CACHED-COST',processName:'自定义有编码缓存',cost:{amount:20,currency:'RMB'},proofFileId:'proof-file'}
 const actual=normalizePcsRecordSnapshot(key,JSON.stringify({optionalProcessLines:[row,{processName:removedLabel,cost:{amount:12,currency:'RMB'}}],optionalProcessCostCny:32,costTotal:100,materialCostCny:68})) as any
 assert.equal(actual.optionalProcessCostCny,20);assert.equal(actual.costTotal,88);assert.equal(actual.materialCostCny,68)
 const saved=JSON.parse(actual.sampleCostOptionalProcessRows)[0]
 assert.deepEqual(saved,row);assert.equal('costAmount' in saved,false);assert.deepEqual(actual.optionalProcessLines[0].cost,row.cost)
 const normalized=normalizeSampleCostOptionalProcessRows([row] as any)
 assert.equal(calculateSampleCostReview({optionalProcessLines:normalized}).optionalProcessCostCny,20)
})

test('有编码缓存行的已存costCny优先于当前默认汇率，零也保留',()=>{
 for(const frozen of [3,0]){
  const row={id:'frozen-conversion',code:'CUSTOM-COST',processName:'冻结换算工艺',cost:{amount:4400,currency:'IDR'},costCny:frozen}
  const input={optionalProcessLines:[row,{processName:removedLabel,cost:{amount:12,currency:'RMB'},costCny:12}],optionalProcessCostCny:frozen+12,costTotal:100,materialCostCny:88}
  const actual=normalizePcsRecordSnapshot(key,JSON.stringify(input)) as any
  assert.equal(actual.optionalProcessCostCny,frozen);assert.equal(actual.costTotal,88);assert.deepEqual(JSON.parse(actual.sampleCostOptionalProcessRows),[row]);assert.deepEqual(actual.optionalProcessLines[0].cost,row.cost);assert.equal(actual.optionalProcessLines[0].costCny,frozen)
 }
})

test('有旧数字编码的成本行保留原ID/金额/币种，只归一已识别的名称和编码',()=>{
 const oldLabel='历史编码标签',row={id:'exact-line-id',craftCode:'CRAFT_'+1048576,processName:oldLabel,costAmount:'7.50',costCurrency:'IDR',proofFileId:'original-file',lineText:oldLabel+' 金额显示'}
 const actual=normalizePcsRecordSnapshot(key,JSON.stringify({records:[{recordId:'coded-review',payload:{...fields(),sampleCostOptionalProcessRows:JSON.stringify([row])}}]})) as any
 const saved=JSON.parse(actual.records[0].payload.sampleCostOptionalProcessRows)[0]
 assert.deepEqual({...saved,craftCode:row.craftCode,processName:row.processName,lineText:row.lineText},row)
 assert.equal(saved.craftCode,'CRAFT_3000010');assert.equal(saved.processName,'缝边绣');assert.equal(saved.lineText,'缝边绣 金额显示')
})

test('显式旧源维护仅在有删除时写入、写后回读，普通投影不写源',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map([[key,JSON.stringify(snapshot())]]);let writes=0
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{writes++;values.set(k,v)},removeItem:(k:string)=>values.delete(k)}})
 try{
  const before=values.get(key)!,projection=normalizePcsRecordSnapshot(key,before);assertClean(projection);assert.equal(writes,0);assert.equal(values.get(key),before)
  const clean=(inline as any).cleanupLegacyUncodedSampleOptionalCosts;assert.equal(typeof clean,'function');assert.equal(clean().changed,true);assertClean(JSON.parse(values.get(key)!));const count=writes;assert.equal(clean().changed,false);assert.equal(writes,count)
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('旧源删除Quota失败保留原raw，读回第三方新值不能恢复旧raw覆盖',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),raw=JSON.stringify(snapshot())
 const concurrent=JSON.stringify({...snapshot(),newBusinessFact:{id:'other-tab-new-fact',qty:7}})
 for(const mode of ['quota','readback']){
  let value=raw,writes=0
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_k:string,next:string)=>{writes++;if(mode==='quota')throw new DOMException('full','QuotaExceededError');value=writes===1?concurrent:next},removeItem:()=>{}}})
  try{assert.throws(()=>(inline as any).cleanupLegacyUncodedSampleOptionalCosts(),/未完成|未清理/);assert.equal(value,mode==='quota'?raw:concurrent);assert.equal(writes,1)}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
 }
})

test('原始明细已空但显示缓存仍占金额时，启动清理实际写入且重放零写',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),value={payload:{sampleCostOptionalProcessRows:'[]',optionalProcessLines:[removedLabel+' ¥12'],optionalProcessCostCny:12,costTotal:100,materialCostCny:88}};let raw=JSON.stringify(value),writes=0
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:(_k:string,next:string)=>{writes++;raw=next},removeItem:()=>{}}})
 try{const clean=(inline as any).cleanupLegacyUncodedSampleOptionalCosts;assert.equal(clean().changed,true);const saved=JSON.parse(raw);assert.equal(saved.payload.costTotal,88);assert.equal(saved.payload.optionalProcessCostCny,0);assert.deepEqual(saved.payload.optionalProcessLines,[]);assert.equal(writes,1);assert.equal(clean().changed,false);assert.equal(writes,1)}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('仅JSON格式不同的已清理内容不引发启动维护写入',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),cleaned=normalizePcsRecordSnapshot(key,JSON.stringify(snapshot())) as any;for(const row of [cleaned.records[0].payload,cleaned.records[0].detailSnapshot])row.sampleCostOptionalProcessRows=JSON.stringify(JSON.parse(row.sampleCostOptionalProcessRows),null,2)
 const raw=JSON.stringify(cleaned,null,2);let writes=0
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:()=>writes++,removeItem:()=>{}}})
 try{assert.equal((inline as any).cleanupLegacyUncodedSampleOptionalCosts().changed,false);assert.equal(writes,0)}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('真实旧inline读取不写源，保存失败不发布memory，旧页面变更阻断覆盖',()=>{
 const script=`import assert from 'node:assert/strict';let raw=process.env.INLINE_COST_RAW,writes=0,fail=false;globalThis.localStorage={getItem:key=>key==='${key}'?raw:null,setItem:(key,value)=>{if(key==='${key}'){writes++;if(fail)throw new DOMException('full','QuotaExceededError');raw=value}},removeItem:()=>{}};const repo=await import('./src/data/pcs-project-inline-node-record-repository.ts');const original=raw;const rows=repo.listProjectInlineNodeRecords();const record=rows.find(row=>row.recordId==='cost-review-user-1');assert.equal(record.payload.costTotal,75);assert.equal(raw,original);assert.equal(writes,0);const before=JSON.stringify(repo.listProjectInlineNodeRecords());fail=true;assert.throws(()=>repo.replaceProjectInlineNodeRecordStore([{...record,recordStatus:'new-unsaved'}]));assert.equal(JSON.stringify(repo.listProjectInlineNodeRecords()),before);assert.equal(raw,original);fail=false;raw=original+' ';const changed=raw;assert.throws(()=>repo.replaceProjectInlineNodeRecordStore([record]),/旧版本页面/);assert.equal(raw,changed);`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,INLINE_COST_RAW:JSON.stringify({version:2,records:[record()]})}})
 assert.equal(result.status,0,result.stderr)
})

test('旧inline保存读回第三方变更时保留新事实，不回滚覆盖也不发布草稿',()=>{
 const script=`import assert from 'node:assert/strict';let raw=process.env.INLINE_COST_RAW,writes=0;const concurrent=JSON.stringify({...JSON.parse(raw),newBusinessFact:{id:'concurrent-fact',qty:9}});globalThis.localStorage={getItem:key=>key==='${key}'?raw:null,setItem:(key,value)=>{if(key==='${key}'){writes++;raw=writes===1?concurrent:value}},removeItem:()=>{}};const repo=await import('./src/data/pcs-project-inline-node-record-repository.ts');const rows=repo.listProjectInlineNodeRecords(),before=JSON.stringify(rows),record=rows.find(row=>row.recordId==='cost-review-user-1');assert.throws(()=>repo.replaceProjectInlineNodeRecordStore([{...record,recordStatus:'new-unsaved'}]),/读回|其他页面|冲突/);assert.equal(raw,concurrent);assert.equal(writes,1);assert.equal(JSON.stringify(repo.listProjectInlineNodeRecords()),before);`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,INLINE_COST_RAW:JSON.stringify({version:2,records:[record()]})}})
 assert.equal(result.status,0,result.stderr)
})

test('只有显示缓存的无编码历史行也删除，空明细不误报格式失败',()=>{
 const value={...fields()} as any;delete value.sampleCostOptionalProcessRows
 const result=normalizePcsRecordSnapshot(key,JSON.stringify({payload:value})) as any
 assert.deepEqual(result.payload.optionalProcessLines,[]);assert.equal(result.payload.optionalProcessCostCny,0);assert.equal(result.payload.costTotal,70)
 assert.doesNotThrow(()=>normalizePcsRecordSnapshot(key,JSON.stringify({sampleCostOptionalProcessRows:'',optionalProcessCostCny:0,costTotal:10})))
})

test('启动清理后旧version生成记录不重算其他历史成本，原日志与新bootstrap编码保留',()=>{
 const input={...record(),recordId:'inline_bootstrap_existing_cost',payload:{...fields(),materialCostCny:31.25,fixedProcessCostCny:16.75},detailSnapshot:{...fields(),materialCostCny:31.25,fixedProcessCostCny:16.75}}
 const script=`import assert from 'node:assert/strict';let raw=process.env.INLINE_COST_RAW;globalThis.localStorage={getItem:key=>key==='${key}'?raw:null,setItem:(key,value)=>{if(key==='${key}')raw=value},removeItem:()=>{}};const cleaner=await import('./src/data/pcs-sample-cost-optional-cleanup.ts');assert.equal(cleaner.cleanupLegacyUncodedSampleOptionalCosts().changed,true);const cleaned=raw;const repo=await import('./src/data/pcs-project-inline-node-record-repository.ts');const saved=repo.listProjectInlineNodeRecords().find(row=>row.recordId==='inline_bootstrap_existing_cost');assert.equal(saved.payload.materialCostCny,31.25);assert.equal(saved.payload.fixedProcessCostCny,16.75);assert.equal(saved.payload.costTotal,75);assert.equal(saved.payload.optionalProcessCostCny,5);assert.equal(raw,cleaned);const fresh=repo.listProjectInlineNodeRecords().find(row=>row.stepCode==='SAMPLE_COST_REVIEW'&&row.recordId!=='inline_bootstrap_existing_cost');assert.ok(JSON.parse(fresh.payload.sampleCostOptionalProcessRows).every(row=>row.code==='PRINT'));`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,INLINE_COST_RAW:JSON.stringify({version:1,records:[input]})}})
 assert.equal(result.status,0,result.stderr)
})

test('version1生成记录原始行已空而缓存占12时，启动清理标记阻止后续全额重算',()=>{
 const values={...fields(),sampleCostOptionalProcessRows:'[]',optionalProcessLines:[removedLabel+' ¥12'],optionalProcessCostCny:12,costTotal:100,materialCostCny:31.25,fixedProcessCostCny:16.75}
 const input={...record(),recordId:'inline_bootstrap_empty_raw_cost',payload:structuredClone(values),detailSnapshot:structuredClone(values)}
 const script=`import assert from 'node:assert/strict';let raw=process.env.INLINE_COST_RAW;globalThis.localStorage={getItem:key=>key==='${key}'?raw:null,setItem:(key,value)=>{if(key==='${key}')raw=value},removeItem:()=>{}};const cleaner=await import('./src/data/pcs-sample-cost-optional-cleanup.ts');const outcome=cleaner.cleanupLegacyUncodedSampleOptionalCosts();assert.equal(outcome.changed,true);assert.equal(outcome.deletedRows,0);const cleaned=raw;const source=JSON.parse(raw).records[0];assert.equal(source.payload.optionalCostCleanupVersion,1);const repo=await import('./src/data/pcs-project-inline-node-record-repository.ts');const saved=repo.listProjectInlineNodeRecords().find(row=>row.recordId==='inline_bootstrap_empty_raw_cost');for(const field of [saved.payload,saved.detailSnapshot]){assert.equal(field.materialCostCny,31.25);assert.equal(field.fixedProcessCostCny,16.75);assert.equal(field.costTotal,88);assert.equal(field.optionalProcessCostCny,0)}assert.equal(raw,cleaned);assert.equal(cleaner.cleanupLegacyUncodedSampleOptionalCosts().changed,false);`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,INLINE_COST_RAW:JSON.stringify({version:1,records:[input]})}})
 assert.equal(result.status,0,result.stderr)
})
