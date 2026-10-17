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

test('能力权限、状态或稳定身份冲突明确阻断，不替换原工厂记录或输入',()=>{
 for(const field of ['canReceiveTask','status','abilityId'] as const){
  const id='MIGRATION-CONFLICT-'+field,previous=factory(id,[{processCode:ordinary.processCode,craftCodes:[ordinary.craftCode],craftNames:[ordinary.craftName]}]);upsertFactoryMasterRecord(previous)
  const first={processCode:ordinary.processCode,craftCodes:[retiredCode],craftNames:[retiredLabel],[field]:field==='canReceiveTask'?false:field==='status'?'PAUSED':'old-id'}
  const second={processCode:seam.processCode,craftCodes:[seam.craftCode],craftNames:[seam.craftName],[field]:field==='canReceiveTask'?true:field==='status'?'ACTIVE':'current-id'}
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
