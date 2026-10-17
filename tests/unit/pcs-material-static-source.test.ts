import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import {execFileSync}from'node:child_process'
import {MATERIAL_ARCHIVE_STORAGE_KEY}from'../../src/data/pcs-material-archive-repository.ts'
const path='src/data/generated/pcs-record-baseline.json',current=JSON.parse(readFileSync(path,'utf8')),before=JSON.parse(execFileSync('git',['show','c89009bb6c7189acb6370b1902347004c1052693:'+path],{encoding:'utf8',maxBuffer:20*1024*1024})),now=JSON.parse(current[MATERIAL_ARCHIVE_STORAGE_KEY]),old=JSON.parse(before[MATERIAL_ARCHIVE_STORAGE_KEY])
// The later formal craft rename changes exactly one option label and its three label mentions.
// All other fields remain byte-equivalent to the material change's frozen source.
function currentCraftLabel(raw:string):string {
  const value=JSON.parse(raw), option=value.options.find((row:any)=>row.dimensionId==='specialCrafts'&&row.id==='specialCrafts-4')
  assert.ok(option)
  const prior=option.name_zh
  option.name_zh='缝边绣'
  for(const log of option.logs)log.detail=log.detail.replaceAll(prior,'缝边绣')
  return JSON.stringify(value)
}
test('KEEP/PROC: material facts and adopted SKU codes stay exact; later formal craft label changes only its named option fields',()=>{
  assert.deepEqual(Object.keys(current),Object.keys(before))
  for(const key of Object.keys(current))if(key!==MATERIAL_ARCHIVE_STORAGE_KEY)assert.equal(current[key],key==='higood-pcs-config-workspace-store-v1'?currentCraftLabel(before[key]):before[key],key)
  for(const s of old.skuRecords){const found=now.skuRecords.find((x:any)=>x.materialSkuId===s.materialSkuId);assert.equal(found.materialSkuCode,s.materialSkuCode);assert.equal(found.materialId,s.materialId)}
  assert.deepEqual(now.records,old.records)
})
test('DYE/PRINT: active generated static input contains all six modes and exactly two additional specimen outputs with their independent fees',()=>{assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-dye').dyeMethod,'MJS');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-dye-gtg').dyeMethod,'GTG');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-double').printSide,'AA');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-penetration').printSide,'CT');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-double-different').printSide,'AB');assert.equal(now.skuRecords.length,old.skuRecords.length+2);assert.equal(now.costVersions.length,old.costVersions.length+2);assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='dr_cotton_dyed').dyeMethod,undefined)})
test('round-two: explicit A/CT/AA static definitions have one pattern and no independent backside fields',()=>{for(const p of now.processDefinitions.filter((p:any)=>p.outputSkuId.startsWith('material-r1-')&&p.processType==='PRINTING'&&p.printSide!=='AB'))for(const key of ['backPatternId','backPatternCode','backPatternVersionId','backDeliveryRevisionSegment'])assert.equal(p[key],undefined,p.outputSkuId+'/'+key)})
test('round-two: newly added AB specimen with unadopted pattern references stays draft, never an approved execution source',()=>{const s=now.skuRecords.find((s:any)=>s.materialSkuId==='material-r1-process-double-different'),p=now.processDefinitions.find((p:any)=>p.outputSkuId===s.materialSkuId);assert.equal(s.approvalStatus,'DRAFT');assert.equal(s.status,'NOT_ENABLED');assert.deepEqual(p.executionAssetIds,[])})
