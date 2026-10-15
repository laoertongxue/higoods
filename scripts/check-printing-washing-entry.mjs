import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

// Isolated browser contexts only. Never connects to the user's daily browser.
const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43158'
const runs=Number(process.env.WASH_ENTRY_RUNS||5)
const out='docs/verification-evidence/2026-10-15-washing-entry-v1.2'
const stamp=new Date().toISOString().replaceAll(':','-')
mkdirSync(out,{recursive:true})
const report={at:new Date().toISOString(),base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:{node:process.version,timezone:'Asia/Shanghai',scale:'77 native printing orders; 50 rows per page; six eligible fabric source scenarios × six 50 Yard rolls; new isolated context each run, no prewarming'},checks:[],samples:[],errors:[]}
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const path='/fcs/craft/printing/work-orders',id='PWO-WASH-DEMO-PRODUCTION-DONE'
const row=p=>p.locator(`[data-printing-row-actions="${id}"]`)
async function init(p){
 p.setDefaultTimeout(5000)
 p.on('pageerror',e=>report.errors.push(e.message))
 await p.addInitScript(()=>{
  window.entryStart=0
  for(const kind of ['pointerdown','keydown','change','input'])document.addEventListener(kind,()=>{if(!window.entryStart)window.entryStart=performance.now()},true)
  window.entryRecords=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('higood-pcs-records');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readonly'),get=tx.objectStore('records').getAll();get.onsuccess=()=>{tx.oncomplete=()=>{db.close();resolve(get.result.filter(r=>['fcs.fabric-washing.v1','fcs.fabric-washing.process-records.v1'].includes(r.collection)))}};tx.onabort=()=>reject(tx.error)}})
  window.entryReady=async()=>{for(const image of document.querySelectorAll('[data-printing-work-orders-root] img,[data-washing-detail-root] img')){if(image.getBoundingClientRect().width&&image.getBoundingClientRect().top<innerHeight&&image.getBoundingClientRect().bottom>0){if(!image.complete)await image.decode();if(!image.naturalWidth)throw new Error('Visible image unavailable')}}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()}
 })
}
async function sample(p,family,run,action,complete,nav=false){
 await p.evaluate(()=>window.entryStart=0)
 try{
  await action();await complete()
  const end=await p.evaluate(()=>window.entryReady()),start=nav?0:await p.evaluate(()=>window.entryStart)
  assert.ok(nav||start>0,'Missing actual event start')
  const entry={family,run,ms:end-start,status:end-start<=1000?'PASS':'FAIL',start:nav?'navigationStart':'captured real pointer/key/change',completion:'correct visible result, ready visible images, two animation frames; save includes native transaction readback'}
  report.samples.push(entry);appendFileSync(out+'/samples-'+stamp+'.jsonl',JSON.stringify(entry)+'\n')
  console.log(entry.status,family,entry.ms.toFixed(1))
 }catch(error){const entry={family,run,status:'FAIL',error:error.message};report.samples.push(entry);appendFileSync(out+'/samples-'+stamp+'.jsonl',JSON.stringify(entry)+'\n');throw error}
}
async function check(name,fn){try{const result=await fn();report.checks.push({name,status:'PASS',result});console.log('PASS',name)}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message)}}
async function filter(p){await p.getByRole('textbox',{name:'综合查询'}).fill('PH-WASH');await p.getByRole('button',{name:'查询',exact:true}).click();await row(p).waitFor()}
async function open(p,run){await sample(p,'row-open',run,()=>row(p).getByRole('button',{name:'发起洗水',exact:true}).click(),()=>p.getByRole('dialog',{name:'发起洗水',exact:true}).waitFor())}
async function durable(p){return p.evaluate(()=>window.entryRecords())}

for(let run=1;run<=runs;run++)await check('entry-lifecycle-'+run,async()=>{
 const viewport=[{width:1366,height:768},{width:1280,height:720},{width:1024,height:768},{width:1366,height:768},{width:1366,height:768}][run-1]
 const c=await browser.newContext({viewport,timezoneId:'Asia/Shanghai'}),p=await c.newPage();await init(p)
 try{
  await sample(p,'cold-list',run,()=>p.goto(base+path,{waitUntil:'domcontentloaded'}),()=>p.locator('[data-printing-work-orders-root]').waitFor(),true)
  await p.locator('[data-printing-work-orders-field="pageSize"]').selectOption('50')
  await p.waitForFunction(()=>document.querySelectorAll('[data-printing-row-actions]').length===50)
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await sample(p,'refresh-50-row-list',run,()=>p.reload({waitUntil:'domcontentloaded'}),()=>p.waitForFunction(()=>document.querySelectorAll('[data-printing-row-actions]').length===50),true)
  await filter(p)
  assert.equal(await p.locator('[data-printing-action="initiate-washing"]').count(),6)
  assert.equal(await p.locator('[data-printing-row-actions$="-PAPER"] [data-printing-action="initiate-washing"]').count(),0)
  const before=await durable(p);assert.equal(before.length,0)
  await p.evaluate(()=>{window.entryQuery=document.querySelector('[data-printing-work-orders-field="keyword"]');window.entryTable=document.querySelector('[data-printing-work-orders-table-surface]')})
  await open(p,run)
  assert.equal(await p.locator('[data-washing-judge-roll]:checked').count(),6)
  assert.equal(await p.locator('[data-washing-feel]').evaluate(el=>el===document.activeElement),true)
  await sample(p,'close-without-save',run,()=>p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'关闭',exact:true}).click(),()=>p.getByRole('dialog',{name:'发起洗水',exact:true}).waitFor({state:'detached'}))
  assert.equal(await row(p).getByRole('button',{name:'发起洗水',exact:true}).evaluate(el=>el===document.activeElement),true)
  assert.equal((await durable(p)).length,0)
  await open(p,run)
  await sample(p,'escape-without-save',run,()=>p.locator('[data-washing-feel]').press('Escape'),()=>p.getByRole('dialog',{name:'发起洗水',exact:true}).waitFor({state:'detached'}))
  assert.equal((await durable(p)).length,0)
  await open(p,run)
  await sample(p,'reject-missing-handfeel',run,()=>p.getByRole('button',{name:'创建洗水加工单',exact:true}).click(),()=>p.locator('[data-washing-error]').filter({hasText:'手感'}).waitFor())
  assert.equal((await durable(p)).length,0)
  await p.getByRole('combobox',{name:'当前职责',exact:true}).selectOption('计划跟单')
  await p.getByRole('button',{name:'创建洗水加工单',exact:true}).click();await p.locator('[data-washing-error]').filter({hasText:'当前人员不能执行此动作'}).waitFor()
  await p.getByRole('combobox',{name:'当前职责',exact:true}).selectOption('现场判断人员')
  const feel=['柔软手感','增厚蓬松棉手感','硬挺手感'][run%3]
  await p.locator('[data-washing-feel]').selectOption(feel)
  await p.evaluate(()=>{window.entryPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='records')throw new DOMException('entry quota fixture','QuotaExceededError');return window.entryPut.apply(this,args)}})
  await sample(p,'save-quota-failure',run,()=>p.getByRole('button',{name:'创建洗水加工单',exact:true}).click(),()=>p.locator('[data-washing-error]').filter({hasText:'空间不足'}).waitFor())
  assert.equal((await durable(p)).length,0);assert.equal(await p.locator('[data-washing-feel]').inputValue(),feel)
  await p.evaluate(()=>{IDBObjectStore.prototype.put=window.entryPut})
  await sample(p,'create-and-durable-read',run,()=>p.getByRole('button',{name:'创建洗水加工单',exact:true}).click(),async()=>{await p.getByRole('link',{name:'查看洗水加工单',exact:true}).waitFor();const records=await durable(p);assert.equal(records.filter(r=>r.value.kind==='orders').length,1);assert.equal(records.filter(r=>r.value.kind==='judgments').length,6)})
  const href=await p.getByRole('link',{name:'查看洗水加工单',exact:true}).getAttribute('href')
  if(run===1)await p.screenshot({path:out+'/created-from-row.png'})
  await sample(p,'view-created-order',run,()=>p.getByRole('link',{name:'查看洗水加工单',exact:true}).click(),async()=>{await p.locator('[data-washing-order]').waitFor();assert.equal(new URL(p.url()).pathname,href);assert.equal(await p.locator('[data-printing-dialog-panel]').count(),0)})
  assert.match(await p.locator('[data-washing-order]').innerText(),new RegExp(feel))
  await p.getByRole('button',{name:'洗水加工单预览',exact:true}).click();await p.locator('[data-washing-print-document]').waitFor();assert.match(await p.locator('[data-washing-print-document]').innerText(),/洗水加工单/)
  await p.goto(base+path);await p.locator('[data-printing-work-orders-root]').waitFor();await filter(p)
  assert.equal(await row(p).getByRole('button',{name:'发起洗水',exact:true}).count(),0)
  await p.reload();await p.locator('[data-printing-work-orders-root]').waitFor();await filter(p);assert.equal(await row(p).getByRole('button',{name:'发起洗水',exact:true}).count(),0)
  const other=p.locator('[data-printing-row-actions="PWO-WASH-DEMO-PURCHASE-DONE"]')
  await other.getByRole('button',{name:'发起洗水',exact:true}).click()
  await sample(p,'no-wash-and-durable-read',run,()=>p.getByRole('button',{name:'不需要洗水',exact:true}).click(),async()=>{await p.locator('[data-washing-result]').filter({hasText:'不需要洗水'}).waitFor();assert.equal((await durable(p)).filter(r=>r.value.kind==='orders').length,1)})
  await p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'关闭',exact:true}).click()
  await p.getByRole('dialog',{name:'发起洗水',exact:true}).waitFor({state:'detached'})
  assert.equal(await other.getByRole('button',{name:'发起洗水',exact:true}).count(),0)
  // Adjacent pre-existing dialog remains usable after the new flow.
  await row(p).locator('[data-printing-action="remarks"]').click();await p.getByRole('dialog',{name:'加工单备注',exact:true}).waitFor();await p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'取消',exact:true}).click()
  return {viewport,orders:1,judgments:12,href}
 }finally{await c.close()}
})

await check('pending-save-close-guard-local-refresh-and-image',async()=>{
 const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();await init(p)
 try{
  await p.goto(base+path);await p.locator('[data-printing-work-orders-root]').waitFor();await filter(p);await open(p,0)
  await p.getByRole('button',{name:/查看.*大图/}).last().click();await p.locator('[data-washing-image-overlay]').waitFor();await p.locator('[data-washing-image-overlay]').press('Escape');await p.locator('[data-washing-image-overlay]').waitFor({state:'detached'});assert.equal(await p.getByRole('dialog',{name:'发起洗水',exact:true}).count(),1)
  await p.locator('[data-washing-feel]').selectOption('柔软手感')
  await p.evaluate(()=>{window.entryQuery=document.querySelector('[data-printing-work-orders-field="keyword"]');window.entryTable=document.querySelector('[data-printing-work-orders-table-surface]');window.entryHold=false;window.entryRelease=false;const commit=IDBTransaction.prototype.commit;IDBTransaction.prototype.commit=function(){if(this.mode==='readwrite'&&window.entryHold&&!window.entryRelease)return;return commit.call(this)};const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='records'&&!window.entryHold){window.entryHold=true;const store=this;const keep=()=>{const request=store.get('__entry-test-hold__');request.onsuccess=()=>{if(!window.entryRelease)keep()}};keep()}return put.apply(this,args)}})
  await p.getByRole('button',{name:'创建洗水加工单',exact:true}).click();await p.waitForFunction(()=>window.entryHold)
  for(let attempt=1;attempt<=5;attempt++){
   const stillSaving=async()=>{assert.equal(await p.getByRole('dialog',{name:'发起洗水',exact:true}).count(),1);assert.equal(await p.getByRole('button',{name:'创建洗水加工单',exact:true}).isDisabled(),true)}
   await sample(p,'close-blocked-during-save',attempt,()=>p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'关闭',exact:true}).click(),stillSaving)
   await sample(p,'escape-blocked-during-save',attempt,()=>p.locator('[data-washing-feel]').press('Escape'),stillSaving)
  }
  await p.evaluate(()=>{window.entryRelease=true});await p.getByRole('link',{name:'查看洗水加工单',exact:true}).waitFor()
  await p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'关闭',exact:true}).click()
  await p.getByRole('dialog',{name:'发起洗水',exact:true}).waitFor({state:'detached'})
  assert.equal(await p.evaluate(()=>window.entryQuery===document.querySelector('[data-printing-work-orders-field="keyword"]')&&window.entryTable===document.querySelector('[data-printing-work-orders-table-surface]')),true)
  assert.equal(await row(p).getByRole('button',{name:'发起洗水',exact:true}).count(),0)
  assert.equal(await row(p).getByRole('link',{name:'查看',exact:true}).evaluate(el=>el===document.activeElement),true)
  return {heldNativeTransaction:true,closeBlocked:true,localNodesPreserved:true}
 }finally{await c.close()}
})

report.hashes=Object.fromEntries(execFileSync('git',['ls-files','-m','-o','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(p=>/^(src|scripts|tests)\//.test(p)).map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
report.summary={pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,pageErrors:report.errors.length,samples:report.samples.length,slow:report.samples.filter(s=>s.ms>1000).length}
writeFileSync(out+'/entry-'+stamp+'.json',JSON.stringify(report,null,2));await browser.close();console.log(report.summary)
if(report.summary.fail||report.summary.pageErrors||report.summary.slow)process.exitCode=1
