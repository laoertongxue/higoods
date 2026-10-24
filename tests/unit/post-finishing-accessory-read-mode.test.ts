import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function actual(name:string,path:string){
 const text=readFileSync(new URL(path,import.meta.url),'utf8'),file=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true)
 const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)!
 const js=ts.transpileModule(fn.getText(file).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 return new Function('dependencies',`with(dependencies){${js};return ${name}}`)
}
test('现有后道辅料只读准备核对七类生产来源，实际操作仍恢复完整来源；读取错误保留并阻断',async()=>{
 for(const readOnly of [false,true])for(const failure of [false,true]){
  const calls:string[]=[],reason='原生产来源不可读取'
  const dependencies={ensureDispatchTaskSheetAssignments:()=>{calls.push('assignments')},preparationReadFailure:'',hydrateProductionContextRecords:async()=>{calls.push('full');if(failure)throw Error(reason)},hydratePostFinishingProductionContextRecords:async()=>{calls.push('seven');if(failure)throw Error(reason)},ensureAccessoryWarehouseRecords:async()=>{calls.push('accessories')},checkedLegacyStorage:()=>{calls.push('legacy-check')}}
  const prepare=actual('prepareAccessoryWarehouseSources','../../src/data/wls/accessory-warehouse-sources.ts')(dependencies)
  if(failure){await assert.rejects(prepare(readOnly?{postFinishingReadOnly:true}:undefined),new RegExp(reason));assert.equal(dependencies.preparationReadFailure,reason)}
  else await prepare(readOnly?{postFinishingReadOnly:true}:undefined)
  assert.deepEqual(calls,[readOnly?'seven':'full',...(!failure?['accessories','assignments','legacy-check']:[])])
 }
})

test('原车缝辅料桥仅在只读调用时转交七类来源；普通准备仍完整且原桥回调均保留',async()=>{
 for(const readOnly of [false,true]){
  const options:unknown[]=[],bridges:unknown[]=[]
  const prepare=actual('prepareAccessorySewing','../../src/data/wls/accessory-warehouse-sewing.ts')({prepareAccessoryWarehouseSources:async value=>options.push(value),installSewingMaterialHandoverBridge:value=>bridges.push(value),installSewingPickupWarehouseBridge:value=>bridges.push(value),contexts:()=>[],events:()=>[],owned:()=>false,versions:()=>[],results:()=>[],issueAccessorySewingPickupSlip:()=>{},recordManagedLegacyFabricHandover:()=>{},getAccessorySewingPickupPath:()=>{}})
  await prepare(readOnly?{readOnly:true}:undefined)
  assert.deepEqual(options,[{postFinishingReadOnly:readOnly?true:undefined}]);assert.equal(bridges.length,2);assert.equal(typeof (bridges[0]as any).ownsLines,'function');assert.equal(typeof (bridges[1]as any).issue,'function')
 }
})
