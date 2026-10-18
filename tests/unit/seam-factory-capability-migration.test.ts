import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {getFactoryMasterRecordById, upsertFactoryMasterRecord} from '../../src/data/fcs/factory-master-store.ts'
import {getProcessCraftByCode, getProcessDefinitionByCode} from '../../src/data/fcs/process-craft-dict.ts'
import type {Factory, FactoryProcessAbility} from '../../src/data/fcs/factory-types.ts'

const retiredCode='CRAFT_'+1048576
const retiredLabel='历史标签'+1048576
const seam=getProcessCraftByCode('CRAFT_3000010')!
const seamProcess=getProcessDefinitionByCode(seam.processCode)!
const ordinary=getProcessCraftByCode('CRAFT_000002')!
function factory(id:string,abilities:FactoryProcessAbility[]):Factory{
  return {...getFactoryMasterRecordById('FAC-APF')!,id,code:id,name:id,processAbilities:abilities}
}

test('混合工厂能力只迁出缝边绣，普通绣花与能力属性保留，输入不变',()=>{
 const properties={abilityId:'historical-ability',abilityScope:'PROCESS' as const,canReceiveTask:false,capacityManaged:true,status:'PAUSED' as const,capacityNodeCodes:['BUTTONHOLE'] as const}
 const ability:FactoryProcessAbility={...properties,capacityNodeCodes:[...properties.capacityNodeCodes],processCode:ordinary.processCode,processName:'原父工序展示',parentProcessCode:'original-parent',craftCodes:[retiredCode,ordinary.craftCode],craftNames:[retiredLabel,ordinary.craftName]}
 const input=factory('MIGRATION-MIXED-CAPABILITY',[ability]),before=structuredClone(input)
 upsertFactoryMasterRecord(input)
 const actual=getFactoryMasterRecordById(input.id)!,old=actual.processAbilities.find(row=>row.processCode===ordinary.processCode)!,moved=actual.processAbilities.find(row=>row.processCode===seam.processCode)!
 assert.ok(moved,'seam capability must move to its current parent process')
 assert.deepEqual(old.craftCodes,[ordinary.craftCode]);assert.deepEqual(old.craftNames,[ordinary.craftName])
 assert.equal(old.processName,ability.processName);assert.equal(old.parentProcessCode,ability.parentProcessCode)
 assert.deepEqual(moved.craftCodes,[seam.craftCode]);assert.deepEqual(moved.craftNames,[seam.craftName])
 assert.equal(moved.processName,seamProcess.processName);assert.equal(moved.parentProcessCode,seamProcess.parentProcessCode)
 for(const key of ['abilityId','abilityScope','canReceiveTask','capacityManaged','status','capacityNodeCodes'] as const){assert.deepEqual(old[key],ability[key]);assert.deepEqual(moved[key],ability[key])}
 assert.deepEqual(input,before)
})

test('已有同父工序能力兼容合并去重，保留各自已配置属性和容量节点',()=>{
 const input=factory('MIGRATION-MERGED-CAPABILITY',[
  {processCode:ordinary.processCode,processName:'原父工序展示',craftCodes:[retiredCode],craftNames:[retiredLabel],canReceiveTask:false,capacityNodeCodes:['BUTTONHOLE']},
  {processCode:seam.processCode,processName:seamProcess.processName,craftCodes:[seam.craftCode,seam.craftCode],craftNames:[seam.craftName,seam.craftName],capacityManaged:true,status:'PAUSED',capacityNodeCodes:['BUTTON_ATTACH']},
 ])
 upsertFactoryMasterRecord(input)
 const rows=getFactoryMasterRecordById(input.id)!.processAbilities
 assert.equal(rows.length,1)
 assert.equal(rows[0].processCode,seam.processCode);assert.deepEqual(rows[0].craftCodes,[seam.craftCode]);assert.deepEqual(rows[0].craftNames,[seam.craftName])
 assert.equal(rows[0].canReceiveTask,false);assert.equal(rows[0].capacityManaged,true);assert.equal(rows[0].status,'PAUSED')
 assert.deepEqual(new Set(rows[0].capacityNodeCodes),new Set(['BUTTONHOLE','BUTTON_ATTACH']))
})

test('多个旧码归一后不串位其他工艺名称，系统父工序字段使用当前字典',()=>{
 const otherCode='PRESERVED-CRAFT',otherName='保留工艺名称'
 const ability={processCode:ordinary.processCode,processName:'原工序名称',systemProcessCode:'original-system',craftCodes:[retiredCode,'CRAFT_'+3000004,otherCode],craftNames:[retiredLabel,'历史标签'+3000004,otherName]}
 const input=factory('MIGRATION-NAME-PAIRING',[ability])
 upsertFactoryMasterRecord(input)
 const rows=getFactoryMasterRecordById(input.id)!.processAbilities,moved=rows.find(row=>row.processCode===seam.processCode)! as FactoryProcessAbility&{systemProcessCode?:string},remaining=rows.find(row=>row.processCode===ordinary.processCode)!
 assert.deepEqual(remaining.craftCodes,[otherCode]);assert.deepEqual(remaining.craftNames,[otherName])
 assert.deepEqual(moved.craftCodes,[seam.craftCode]);assert.deepEqual(moved.craftNames,[seam.craftName]);assert.equal(moved.systemProcessCode,seamProcess.systemProcessCode)
})

test('能力权限、产能或状态冲突明确阻断，不替换原工厂记录或输入',()=>{
 for(const field of ['canReceiveTask','capacityManaged','status'] as const){
  const id='MIGRATION-CONFLICT-'+field,previous=factory(id,[{processCode:ordinary.processCode,craftCodes:[ordinary.craftCode],craftNames:[ordinary.craftName]}]);upsertFactoryMasterRecord(previous)
  const first={processCode:ordinary.processCode,craftCodes:[retiredCode],craftNames:[retiredLabel],[field]:field==='status'?'PAUSED':false}
  const second={processCode:seam.processCode,craftCodes:[seam.craftCode],craftNames:[seam.craftName],[field]:field==='status'?'ACTIVE':true}
  const input=factory(id,[first,second] as FactoryProcessAbility[]),before=structuredClone(input),saved=getFactoryMasterRecordById(id)
  assert.throws(()=>upsertFactoryMasterRecord(input),/缝边绣.*能力.*冲突/)
  assert.deepEqual(input,before);assert.deepEqual(getFactoryMasterRecordById(id),saved)
 }
})

test('存量读取冲突不能被catch吞掉后回退为演示档案，旧源逐字保留',()=>{
 const input=factory('MIGRATION-READ-CONFLICT',[
  {processCode:ordinary.processCode,craftCodes:[retiredCode],craftNames:[retiredLabel],canReceiveTask:false},
  {processCode:seam.processCode,craftCodes:[seam.craftCode],craftNames:[seam.craftName],canReceiveTask:true},
 ])
 const script=`import assert from 'node:assert/strict';const raw=process.env.FACTORY_CONFLICT_RAW;let writes=0;globalThis.localStorage={getItem:key=>key==='fcs_factory_master_store_v1'?raw:null,setItem:()=>writes++};globalThis.window={localStorage:globalThis.localStorage};await assert.rejects(import('./src/data/fcs/factory-master-store.ts'),/缝边绣.*能力.*冲突/);assert.equal(writes,0);assert.equal(globalThis.localStorage.getItem('fcs_factory_master_store_v1'),raw);`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,FACTORY_CONFLICT_RAW:JSON.stringify([input])}})
 assert.equal(result.status,0,result.stderr)
})

function savedParentAbilities(): FactoryProcessAbility[] {
 const other=getProcessCraftByCode('CRAFT_3000006')!
 return [
  {processCode:ordinary.processCode,processName:'原父工序展示',abilityId:`ABILITY_${ordinary.processCode}`,abilityName:'原工序能力',abilityScope:'PROCESS',craftCodes:[retiredCode,ordinary.craftCode],craftNames:[retiredLabel,ordinary.craftName],canReceiveTask:true,capacityManaged:true,status:'ACTIVE'},
  {processCode:seam.processCode,processName:seamProcess.processName,abilityId:`ABILITY_${seam.processCode}`,abilityName:`${seamProcess.processName} - ${other.craftName}`,abilityScope:'CRAFT',craftCodes:[other.craftCode],craftNames:[other.craftName],canReceiveTask:true,capacityManaged:true,status:'ACTIVE'},
 ]
}

test('旧父工序与现父工序的派生编号、名称和范围不同不阻断，目标组编号与排列顺序无关',()=>{
 for(const reverse of [false,true]){
  const abilities=savedParentAbilities();if(reverse)abilities.reverse()
  const input=factory('SAVED-PARENT-METADATA-'+reverse,abilities),before=structuredClone(input)
  upsertFactoryMasterRecord(input)
  const rows=getFactoryMasterRecordById(input.id)!.processAbilities,target=rows.find(row=>row.processCode===seam.processCode)!,remaining=rows.find(row=>row.processCode===ordinary.processCode)!
  assert.equal(rows.filter(row=>row.processCode===seam.processCode).length,1)
  assert.equal(target.abilityId,`ABILITY_${seam.processCode}`)
  assert.equal(target.abilityName,seamProcess.processName);assert.equal(target.abilityScope,'PROCESS')
  assert.deepEqual(new Set(target.craftCodes),new Set([seam.craftCode,'CRAFT_3000006']))
  assert.equal(target.canReceiveTask,true);assert.equal(target.capacityManaged,true);assert.equal(target.status,'ACTIVE')
  assert.equal(remaining.abilityId,`ABILITY_${ordinary.processCode}`);assert.deepEqual(remaining.craftCodes,[ordinary.craftCode])
  assert.deepEqual(input,before)
 }
})

test('有完整旧父工序元数据的存量可首次导入、零写回读取，明确保存后重新导入仍保持工厂事实',()=>{
 const input=factory('SAVED-STARTUP-METADATA',savedParentAbilities())
 const script=`import assert from 'node:assert/strict';const key='fcs_factory_master_store_v1',raw=process.env.FACTORY_SAVED_RAW;const values=new Map([[key,raw]]);let writes=0;globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes++;values.set(k,v)}};globalThis.window={localStorage:globalThis.localStorage};const store=await import('./src/data/fcs/factory-master-store.ts');const actual=store.getFactoryMasterRecordById('SAVED-STARTUP-METADATA');assert.ok(actual);const target=actual.processAbilities.find(row=>row.processCode==='SPECIAL_CRAFT');assert.equal(target.abilityId,'ABILITY_SPECIAL_CRAFT');assert.deepEqual(new Set(target.craftCodes),new Set(['CRAFT_3000010','CRAFT_3000006']));assert.equal(store.listFactoryMasterRecords().filter(row=>row.id===actual.id).length,1);assert.deepEqual(store.getFactoryMasterRecordById(actual.id),actual);assert.equal(writes,0);assert.equal(values.get(key),raw);store.upsertFactoryMasterRecord(actual);assert.equal(writes,1);const saved=values.get(key);const again=await import('./src/data/fcs/factory-master-store.ts?after-explicit-save');assert.deepEqual(again.getFactoryMasterRecordById(actual.id),actual);assert.equal(values.get(key),saved);assert.equal(writes,1);`
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,FACTORY_SAVED_RAW:JSON.stringify([input])}})
 assert.equal(result.status,0,result.stderr)
})

test('合并优先保留目标组自定义编号，目标编号空缺时生成父工序编号',()=>{
 for(const targetId of ['ONBOARDING-existing-target','',undefined]){
  for(const reverse of [false,true]){
   const abilities=savedParentAbilities();abilities[1].abilityId=targetId;if(reverse)abilities.reverse()
   const input=factory('TARGET-IDENTITY-'+String(targetId)+'-'+reverse,abilities)
   upsertFactoryMasterRecord(input)
   const target=getFactoryMasterRecordById(input.id)!.processAbilities.find(row=>row.processCode===seam.processCode)!
   assert.equal(target.abilityId,targetId || `ABILITY_${seam.processCode}`)
   assert.equal(target.abilityScope,'PROCESS');assert.equal(target.abilityName,seamProcess.processName)
  }
 }
})

test('没有原目标组时多个迁出组按当前父工序归一，普通工艺组不受影响',()=>{
 const input=factory('NO-EXISTING-TARGET',[
  {processCode:ordinary.processCode,abilityId:'original-group-a',abilityName:'原分组甲',abilityScope:'PROCESS',craftCodes:[retiredCode],craftNames:[retiredLabel],canReceiveTask:false},
  {processCode:'HISTORICAL-PARENT',abilityId:'original-group-b',abilityName:'原分组乙',abilityScope:'PROCESS',craftCodes:['CRAFT_'+3000004],craftNames:['历史标签'+3000004],canReceiveTask:false},
 ])
 upsertFactoryMasterRecord(input)
 const rows=getFactoryMasterRecordById(input.id)!.processAbilities
 assert.equal(rows.length,1);assert.equal(rows[0].abilityId,`ABILITY_${seam.processCode}`)
 assert.equal(rows[0].abilityScope,'CRAFT');assert.equal(rows[0].abilityName,`${seamProcess.processName} - ${seam.craftName}`)
 assert.deepEqual(rows[0].craftCodes,[seam.craftCode]);assert.equal(rows[0].canReceiveTask,false)
 const untouched=factory('NO-SEAM-CAPABILITY',[{processCode:ordinary.processCode,abilityId:'custom-ordinary',abilityName:'普通工艺能力',abilityScope:'CRAFT',craftCodes:[ordinary.craftCode],craftNames:[ordinary.craftName],canReceiveTask:false,status:'PAUSED'}])
 upsertFactoryMasterRecord(untouched)
 assert.deepEqual(getFactoryMasterRecordById(untouched.id)!.processAbilities,untouched.processAbilities)
})
