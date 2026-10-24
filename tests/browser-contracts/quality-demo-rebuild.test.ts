import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from '@playwright/test'
const base=process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43640'
test('定向重建删除旧质检演示，保护其他模块和共用附件；重复执行保留新数据',{timeout:120000},async()=>{
 const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage()
 await context.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v})
 await page.route('**/__demo-reset',route=>route.fulfill({contentType:'text/html',body:'<html><body>isolated</body></html>'}))
 try{await page.goto(base+'/__demo-reset')
 const result=await page.evaluate(async()=>{
  const db=await import('/src/data/pcs-record-db.ts'),cut=await import('/src/data/fcs/cutting/cutting-record-repository.ts')
  const reset=await import('/src/data/fcs/quality-demo-rebuild.ts'),post='higood-fcs-post-finishing-records/'
  await db.commitPcsRecords({puts:[
   {id:post+'flow/qcTasks/OLD',collection:'flow/qcTasks',value:{qcTaskId:'OLD',file:'pcs-file:shared',own:'pcs-file:old-only',bare:'bare-shared'},expectedVersion:0},
   {id:post+'flow/materialStocks/MATERIAL',collection:'flow/materialStocks',value:{stockId:'MATERIAL',file:'pcs-file:shared'},expectedVersion:0},
   {id:'pcs-unrelated/record/KEEP',collection:'pcs-unrelated',value:{name:'PCS保留',file:{fileId:'shared'},bare:'bare-shared'},expectedVersion:0},
   {id:'higood-finished-inventory/lots/EXTERNAL',collection:'higood-finished-inventory/lots',value:{id:'EXTERNAL',sourceRef:'EXTERNAL:receipt',quantity:123},expectedVersion:0},
   {id:'higood-fcs-quality-management/config/OLD',collection:'quality/config',value:{id:'OLD'},expectedVersion:0},
  ],deletes:[],files:[{id:'bare-shared',blob:new Blob(['shared bare id'])},{id:'shared',blob:new Blob(['shared bytes'])},{id:'old-only',blob:new Blob(['old bytes'])}],operationId:'reset-fixture',intent:'test input'})
  const c=await cut.openCuttingRecordDatabase();await new Promise<void>((resolve,reject)=>{const t=c.transaction(['records','files'],'readwrite');t.objectStore('records').put({id:'production-context:samples:OLD',collection:'production-context:samples',value:{file:{$productionFile:'sample-only'}}});t.objectStore('records').put({id:'cutting-keep',collection:'cutting',value:{qty:321}});t.objectStore('files').put({id:'sample-only',blob:new Blob(['sample'])});t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error)})
  localStorage.setItem('higood-fcs-post-finishing-full-flow-v1',JSON.stringify({schemaVersion:3,qcTasks:[{id:'old'}],materialStocks:[{stockId:'keep'}],unknownOther:{preserve:true}}))
  localStorage.setItem('other-module','untouched');localStorage.setItem('higood:sewing-sample-approval:v3','old sample')
  const before=(await db.readPcsRecords()).records.filter(r=>r.id.includes('KEEP')||r.id.includes('MATERIAL')||r.id.endsWith('/EXTERNAL'))
  const first=await reset.rebuildQualityPostFinishingDemo(),after=await db.readPcsRecords(),cutAfter=await cut.readCuttingRecords()
  await db.commitPcsRecords({puts:[{id:post+'flow/qcTasks/NEW',collection:'flow/qcTasks',value:{qcTaskId:'NEW'},expectedVersion:0}],deletes:[],operationId:'new-after-reset',intent:'new'})
  const second=await reset.rebuildQualityPostFinishingDemo(),again=await db.readPcsRecords()
  return {first,second,before,kept:after.records.filter(r=>r.id.includes('KEEP')||r.id.includes('MATERIAL')||r.id.endsWith('/EXTERNAL')),ids:after.records.map(r=>r.id),files:after.files.map(r=>r.id),cut:cutAfter.records,mixed:JSON.parse(localStorage.getItem('higood-fcs-post-finishing-full-flow-v1')!),other:localStorage.getItem('other-module'),sample:localStorage.getItem('higood:sewing-sample-approval:v3'),newKept:again.records.some(r=>r.id===post+'flow/qcTasks/NEW')}
 })
 assert.deepEqual(result.kept,result.before);assert.equal(result.newKept,true)
 assert.equal(result.ids.some(id=>id.endsWith('/OLD')),false);assert.deepEqual(result.files,['bare-shared','shared'])
 assert.deepEqual(result.cut,[{id:'cutting-keep',collection:'cutting',value:{qty:321}}])
 assert.deepEqual(result.mixed,{materialStocks:[{stockId:'keep'}],unknownOther:{preserve:true}})
 assert.equal(result.other,'untouched');assert.equal(result.sample,null);assert.ok(result.second.every(r=>r.alreadyCompleted))
 }finally{await context.close();await browser.close()}
})
test('空库先登记重建版本，下一次运行不会清理首次保存的新配置',{timeout:120000},async()=>{
 const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage()
 await context.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v})
 await page.route('**/__empty-reset',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}))
 try{await page.goto(base+'/__empty-reset');const result=await page.evaluate(async()=>{
 const r=await import('/src/data/fcs/quality-demo-rebuild.ts'),q=await import('/src/data/fcs/quality-management-records.ts')
 await r.rebuildQualityPostFinishingDemo();await q.ensureQualityManagementRecords();const draft=q.buildQualityConfigurationDraft('BASIC');draft.name='重建后新标准';await q.saveQualityConfigurationDraft(draft)
 const second=await r.rebuildQualityPostFinishingDemo();await q.ensureQualityManagementRecords();return {second,name:q.getQualityConfiguration(draft.id)?.name}
 });assert.equal(result.name,'重建后新标准');assert.ok(result.second.every(r=>r.alreadyCompleted))
 }finally{await context.close();await browser.close()}
})

test('清理事务中止不删半套；另一库失败后重试保留首库新记录',{timeout:120000},async()=>{
 const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage()
 await context.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v})
 await page.route('**/__reset-failure',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}))
 try{await page.goto(base+'/__reset-failure');const result=await page.evaluate(async()=>{
  const db=await import('/src/data/pcs-record-db.ts'),cut=await import('/src/data/fcs/cutting/cutting-record-repository.ts'),reset=await import('/src/data/fcs/quality-demo-rebuild.ts')
  const id='higood-fcs-post-finishing-records/flow/qcTasks/RESET-FAIL'
  await db.commitPcsRecords({puts:[{id,collection:'flow/qcTasks',value:{qcTaskId:'RESET-FAIL',url:'pcs-file:reset-fail'},expectedVersion:0}],deletes:[],files:[{id:'reset-fail',blob:new Blob(['keep on failure'])}],operationId:'reset-fail',intent:'reset failure fixture'})
  await cut.readCuttingRecordRevision()
  const original=IDBObjectStore.prototype.delete
  IDBObjectStore.prototype.delete=function(...args:Parameters<typeof original>){const request=original.apply(this,args);if(this.name==='records'&&args[0]===id)this.transaction.abort();return request}
  let firstError='';try{await reset.rebuildQualityPostFinishingDemo()}catch(e){firstError=String(e)}finally{IDBObjectStore.prototype.delete=original}
  const preserved=await db.readPcsRecords()
  const transaction=IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction=function(...args:Parameters<typeof transaction>){if(this.name==='higood-cutting-records-v1'&&args[1]==='readwrite')throw Error('隔离第二库中止');return transaction.apply(this,args)}
  let secondError='';try{await reset.rebuildQualityPostFinishingDemo()}catch(e){secondError=String(e)}finally{IDBDatabase.prototype.transaction=transaction}
  const newId='higood-fcs-quality-management/config/AFTER-FIRST'
  await db.commitPcsRecords({puts:[{id:newId,collection:'quality/config',value:{name:'第一库清理完成后的新标准'},expectedVersion:0}],deletes:[],operationId:'after-first',intent:'new after first database completion'})
  const retried=await reset.rebuildQualityPostFinishingDemo(),after=await db.readPcsRecords()
  return{firstError,secondError,preservedIds:preserved.records.map(r=>r.id),preservedFiles:preserved.files.map(r=>r.id),newKept:after.records.some(r=>r.id===newId),oldGone:!after.records.some(r=>r.id===id),retried}
 });assert.ok(result.firstError);assert.match(result.secondError,/第二库/);assert.ok(result.preservedIds.some(id=>id.endsWith('/RESET-FAIL')));assert.deepEqual(result.preservedFiles,['reset-fail']);assert.equal(result.newKept,true);assert.equal(result.oldGone,true);assert.equal(result.retried[0].alreadyCompleted,true)
 }finally{await context.close();await browser.close()}
})

test('库存仅删除独立演示链，混入外部库存的返仓链及共同附件整体保留',{timeout:120000},async()=>{
 const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage()
 await context.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v})
 await page.route('**/__reset-stock',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}))
 try{await page.goto(base+'/__reset-stock');const result=await page.evaluate(async()=>{
  const db=await import('/src/data/pcs-record-db.ts'),seed=(await import('/src/data/wls/finished-inventory-quality-seed.ts')).createFinishedInventorySeed(),reset=await import('/src/data/fcs/quality-demo-rebuild.ts')
  const ns='higood-finished-inventory/',owned=seed.lots[0],shared=seed.lots[2]
  const row=(collection:string,value:any)=>({id:ns+collection+'/'+encodeURIComponent(value.id),collection:ns.slice(0,-1)+'/'+collection,value,expectedVersion:0})
  const app=(id:string,lotIds:string[])=>({id,warehouseId:owned.warehouseId,styleId:owned.styleId,lines:[{allocations:lotIds.map(lotId=>({lotId,quantity:1}))}]})
  const values=[row('lots',owned),row('lots',shared),row('lots',{id:'CHILD-SHARED',sourceRef:'TRANSFER-SHARED',url:'pcs-file:chain-shared'}),row('lots',{id:'EXTERNAL',sourceRef:'SALES-RECEIPT'}),row('applications',app('REMOVE',[owned.id])),row('applications',app('KEEP-CREATOR',[shared.id])),row('applications',app('KEEP-MIXED',['CHILD-SHARED','EXTERNAL'])),row('transfers',{id:'TRANSFER-SHARED',applicationId:'KEEP-CREATOR'}),row('transfers',{id:'TRANSFER-REMOVE',applicationId:'REMOVE'})]
  await db.commitPcsRecords({puts:values,deletes:[],files:[{id:'chain-shared',blob:new Blob(['shared chain'])}],operationId:'stock-reset-fixture',intent:'independent demo and connected external stock'})
  const first=await reset.rebuildQualityPostFinishingDemo(),after=await db.readPcsRecords()
  return {first,ids:after.records.map(r=>r.id),expected:values.filter(r=>!r.id.endsWith('/REMOVE')&&!r.id.endsWith('/TRANSFER-REMOVE')&&r.id!==ns+'lots/'+encodeURIComponent(owned.id)).map(({expectedVersion,...r})=>({...r,version:1})),actual:after.records.filter(r=>r.id.startsWith(ns)),files:after.files.map(r=>r.id)}
 });assert.deepEqual(result.actual.sort((a,b)=>a.id.localeCompare(b.id)),result.expected.sort((a,b)=>a.id.localeCompare(b.id)));assert.deepEqual(result.files,['chain-shared']);assert.equal(result.first[0].retainedInventoryApplications,2)
 }finally{await context.close();await browser.close()}
})
