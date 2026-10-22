import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function entry(){
 const text=readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8'),file=ts.createSourceFile('main.ts',text,ts.ScriptTarget.Latest,true)
 const names=['isQualityInventoryEntry','preparePageRouteEntry']
 const code=names.map(name=>file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)!.getText(file)).join('\n').replaceAll('import(','loadModule(')
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 return new Function('dependencies','pathname',`with(dependencies){${js};return preparePageRouteEntry(pathname)}`)
}
test('WLS原库存直达只准备商品身份和本仓库存，查看不加载后道历史或工厂桥；保存另准备共同事务',async()=>{
 const calls:string[]=[],scopes:string[][]=[]
 const deps={previousRenderedPagePathname:'',loadModule:async(path:string)=>{
  calls.push(path)
  if(path.endsWith('/pcs-record-runtime.ts'))return{ensurePcsRecordState:async(keys:string[]=[])=>{scopes.push(keys)}}
  if(path.endsWith('/wls/finished-inventory-records.ts'))return{ensureFinishedInventoryRecords:async()=>{calls.push('inventory-ready')}}
  if(path.endsWith('/post-finishing-inventory-bridge.ts'))return{preparePostFinishingInventoryBridge:async()=>{calls.push('factory-bridge')}}
  throw Error('unexpected scope '+path)
 }}
 await entry()(deps,'/wls/finished/stock/realtime')
 assert.ok(scopes[0].length>0,'不能用无范围初始化加载所有PCS/FCS')
 assert.ok(scopes[0].includes('higood-pcs-sku-archive-store-v1'))
 assert.ok(calls.includes('inventory-ready'))
 assert.ok(!calls.some(x=>x.includes('post-finishing')),'查看库存不应读取后道历史')
 assert.equal(deps.previousRenderedPagePathname,'/wls/finished/stock/realtime')
})
function printEntry(dependencies:unknown){
 const text=readFileSync(new URL('../../src/router/route-renderers.ts',import.meta.url),'utf8'),file=ts.createSourceFile('routes.ts',text,ts.ScriptTarget.Latest,true)
 const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createAsyncRenderer')!
 const js=ts.transpileModule(fn.getText(file).replaceAll('import(','loadModule('),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 return new Function('dependencies',`with(dependencies){${js};return createAsyncRenderer(async()=>({renderPrintPreviewPage:()=>'<main>actual QC output</main>'}),'renderPrintPreviewPage')}`)(dependencies)
}
test('两类QC通用打印仅读取原质检和正式生产来源，不准备辅料工序；其他单据沿用原准备',async()=>{
 for(const type of ['PRODUCTION_QC_MASTER','POST_FINISHING_QC_ORDER','PICKUP_SLIP']){
  const calls:string[]=[]
  const run=printEntry({location:{pathname:'/fcs/print/preview',search:'?documentType='+type},URLSearchParams,loadModule:async(path:string)=>{
   calls.push(path)
   if(path.endsWith('/post-finishing-records.ts'))return{ensurePreparedPostFinishingRecordState:async()=>{calls.push('post-read')},getPostFinishingStorageFailure:()=>''}
   if(path.endsWith('/storage-notice.ts'))return{renderPostFinishingStorageNotice:()=>''}
   if(path.endsWith('/accessory-warehouse-sewing.ts'))return{prepareAccessorySewing:async()=>{calls.push('accessory-sewing')}}
   if(path.endsWith('/accessory-warehouse-post-finishing.ts'))return{prepareAccessoryPostFinishing:async()=>{calls.push('accessory-post')}}
   return{}
  }})
  assert.equal(await run(),'<main>actual QC output</main>')
  if(type==='PICKUP_SLIP'){assert.ok(calls.includes('accessory-sewing'));assert.ok(calls.includes('accessory-post'))}
  else {assert.ok(calls.includes('post-read'));assert.ok(!calls.some(x=>x.includes('accessory-warehouse')))}
 }
})


test('后道QC清单和执行不读取无关辅料；查看工作台不计算无关回货分摊，真实后道加工保留原准备',async()=>{
 const source=readFileSync(new URL('../../src/router/route-renderers-fcs.ts',import.meta.url),'utf8'),file=ts.createSourceFile('fcs.ts',source,ts.ScriptTarget.Latest,true)
 const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createAsyncRenderer')!
 const js=ts.transpileModule(fn.getText(file).replaceAll('import(','loadModule('),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 for(const exportName of ['renderPostFinishingQcOrdersPage','renderPostFinishingQcWorkbenchPage','renderPostFinishingWorkOrdersPage']){
  const calls:string[]=[]
  const run=new Function('dependencies','exportName',`with(dependencies){${js};return createAsyncRenderer(async()=>({[exportName]:()=>'<main>原页面</main>'}),exportName)}`)({loadModule:async(path:string)=>{
   calls.push(path)
   if(path.endsWith('/post-finishing-qc-entry.ts'))return{isPreparedQcRoute:()=>false,isPreparedInventoryQcRoute:()=>false}
   if(path.endsWith('/store.ts'))return{appStore:{getState:()=>({pathname:'/fcs/craft/post-finishing/qc-workbench'})}}
   if(path.endsWith('/accessory-warehouse-post-finishing.ts'))return{prepareAccessoryPostFinishing:async()=>calls.push('accessory-ready')}
   if(path.endsWith('/storage-notice.ts'))return{renderPostFinishingStorageNotice:()=>''}
   return{}
  }},exportName)
  assert.equal(await run(),'<main>原页面</main>')
  assert.equal(calls.some(path=>path.endsWith('/ppic-daily-return-records.ts')),exportName!=='renderPostFinishingQcWorkbenchPage','QC查看不修改回货数量；原加工/回货入口继续注册分摊消费者')
  assert.equal(calls.includes('accessory-ready'),exportName==='renderPostFinishingWorkOrdersPage')
 }
})

test('已确认库存QC只准备成衣资料；未识别生产QC仍经过完整生产来源准备',async()=>{
 const code=entry()
 for(const inventory of [true,false]){
  const scopes:string[][]=[],calls:string[]=[]
  const deps={previousRenderedPagePathname:'',productionEntryHydration:undefined,appStore:{getState:()=>({pathname:'/fcs/craft/post-finishing/qc-workbench?taskNo=REAL-QC'})},loadModule:async(path:string)=>{
   calls.push(path)
   if(path.endsWith('/pcs-record-runtime.ts'))return{ensurePcsRecordState:async(keys:string[]=[])=>{scopes.push(keys)}}
   if(path.endsWith('/post-finishing-records.ts'))return{ensurePostFinishingExecutionRecordState:async()=>{}}
   if(path.endsWith('/post-finishing-inventory-bridge.ts'))return{preparePostFinishingInventoryBridge:async()=>{calls.push('inventory-ready')}}
   if(path.endsWith('/post-finishing-qc-entry.ts'))return{isPreparedQcRoute:()=>inventory,isPreparedInventoryQcRoute:()=>inventory}
   if(path.endsWith('/quality-management-records.ts'))return{ensureQualityManagementRecords:async()=>{}}
   if(path.endsWith('/production-context-records.ts'))throw Error('original production source requested')
   return{}
  }}
  if(inventory)await code(deps,'/fcs/craft/post-finishing/qc-workbench')
  else await assert.rejects(code(deps,'/fcs/craft/post-finishing/qc-workbench'),/original production source requested/)
  assert.ok(scopes[0].includes('higood-pcs-material-archive-store-v2'))
  assert.ok(scopes[0].includes('higood-pcs-technical-data-version-store-v5'))
  assert.equal(scopes.some(keys=>keys.length===0),!inventory)
  assert.equal(calls.includes('inventory-ready'),false,'查看既有库存QC不重新读取原仓全部库存；实际完成由原共同事务另准备')
 }
})

test('后道范围准备不能被后续普通生产页面复用为完整来源',async()=>{
 let fullReads=0,fullHydrates=0
 const deps={previousRenderedPagePathname:'',productionEntryHydration:Promise.resolve(),loadModule:async(path:string)=>{
  if(path.endsWith('/production-context-records.ts'))return{isProductionContextReady:()=>false,hydrateProductionContextRecords:async()=>{fullHydrates++;throw Error('stop after required full preparation')}}
  if(path.endsWith('/cutting-record-repository.ts'))return{readCuttingRecords:async()=>{fullReads++;return{revision:9,records:[]}}}
  throw Error('unexpected '+path)
 }}
 await assert.rejects(entry()(deps,'/fcs/production/orders'),/required full preparation/)
 assert.equal(fullReads,1);assert.equal(fullHydrates,1)
})

test('原产前版页面直接处理输入、弹窗和原保存事件及Esc，不初始化无关FCS/裁床处理器',async()=>{
 const source=readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8'),file=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true)
 const calls:any[]=[],page={handleSampleApprovalSuggestionsEvent:async(target:any,event:any)=>{calls.push(['event',target,event]);return true},closeSampleApprovalSuggestionDialog:()=>{calls.push(['escape']);return true}}
 const dependencies={appStore:{getState:()=>({pathname:'/fcs/sewing-outsourcing/sample-approval-suggestions?tab=x'})},loadModule:async(path:string)=>{assert.equal(path,'./pages/sewing-outsourcing/sample-approval-suggestions.ts');return page},getFcsHandlersModule:()=>{throw Error('不应初始化通用FCS处理器')}}
 function actual(name:string){const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)!;const js=ts.transpileModule(fn.getText(file).replaceAll('import(','loadModule('),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('dependencies',`with(dependencies){${js};return ${name}}`)(dependencies)}
 const target={closest:()=>null,dataset:{}}
 for(const type of ['input','click','change']){const event={type};assert.equal(await actual('dispatchPageEvent')(target,event),true);assert.equal(calls.at(-1)[1],target);assert.equal(calls.at(-1)[2],event)}
 assert.equal(await actual('closeDialogsOnEscape')(),true);assert.deepEqual(calls.at(-1),['escape'])
})
