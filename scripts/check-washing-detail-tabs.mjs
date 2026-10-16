import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpus, loadavg, totalmem, freemem } from 'node:os'

const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43159'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Only isolated local prototype contexts may be written')
const runs=Number(process.env.WASH_TAB_RUNS||5),formal=process.env.WASH_TAB_FORMAL==='1'
const listOnly=process.env.WASH_TAB_SECTION==='list'
const out=process.env.WASH_TAB_OUT||'output/washing-detail-tabs',stamp=new Date().toISOString().replaceAll(':','-')
mkdirSync(out,{recursive:true})
const sources=['src/data/fcs/fabric-washing-model.ts','src/data/fcs/fabric-washing-views.ts','src/data/fcs/fabric-washing-maintenance.ts','src/pages/process-factory/dyeing/washing/order-presentation.ts','tests/unit/fabric-washing.test.ts','tests/unit/fabric-washing-maintenance.test.ts','tests/unit/fabric-washing-views.test.ts','scripts/check-washing-gtg-direct-consumers.mjs','scripts/check-post-print-fabric-washing.mjs','scripts/check-post-print-fabric-washing-edges.mjs','src/pages/process-factory/dyeing/washing/work-orders.ts','src/pages/process-factory/dyeing/washing/detail-views.ts','scripts/check-washing-detail-tabs.mjs','scripts/check-washing-gtg-ui.mjs','src/pages/process-factory/dyeing/washing/execution-dialog.ts','tests/unit/washing-execution-dialog.test.ts']
const report={at:new Date().toISOString(),base,formal,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{timezone:'Asia/Shanghai',webViewports:['1366x768','1280x720','1024x768'],pdaViewport:'390x844',scale:'6 actual 50 Yard rolls in one order, created through the real print initiation UI',scope:'WASH-291-WASH-302 operation dialogs; existing domain/storage/printing rules unchanged',cold:'Fresh isolated contexts seeded through native IndexedDB before loading any app assets; no user browser data is read or cleared'},checks:[],samples:[],errors:[]}
report.environment.resources={node:process.version,cores:cpus().length,loadAverage:loadavg(),totalMemory:totalmem(),freeMemory:freemem()}
report.runtimeAssets=JSON.parse(readFileSync(process.env.WASH_RUNTIME_ASSETS||'output/washing-detail-tabs/runtime-assets.json','utf8'))
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const printPath='/fcs/craft/printing/work-orders',washPath='/fcs/craft/dyeing/washing/work-orders'
const root=p=>p.locator('[data-washing-order]'),tab=(p,name)=>p.getByRole('tab',{name,exact:true})
const listRoot=p=>p.locator('[data-washing-list-root]')
const listActions=(p,id=orderId)=>p.locator('[data-washing-list-order="'+id+'"]')
async function init(c){
 await c.addInitScript(()=>{
  window.washTabStart=0
  for(const type of ['pointerdown','keydown','input','change'])document.addEventListener(type,()=>{if(!window.washTabStart)window.washTabStart=performance.now()},true)
  window.washTabReady=async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}).map(async img=>{if(!img.complete)await img.decode();if(!img.naturalWidth)throw new Error('Missing visible image '+img.alt)}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()}
  const transaction=IDBDatabase.prototype.transaction
  IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name==='higood-pcs-records'&&args[1]==='readwrite'&&window.washDialogAbortNext){window.washDialogAbortNext=false;queueMicrotask(()=>tx.abort())}return tx}
  document.addEventListener('click',event=>{
   const d=event.target.closest?.('[data-washing-operation-action="submit"]')?.closest('[data-washing-operation]');if(!d)return
   const observer=new MutationObserver(()=>{
    if(d.getAttribute('aria-busy')==='true'){
     window.washDialogBusyWitness={fieldsDisabled:d.querySelector('fieldset').disabled,buttonsDisabled:[...d.querySelectorAll('button')].every(b=>b.disabled)}
     observer.disconnect()
    }
   })
   observer.observe(d,{attributes:true,attributeFilter:['aria-busy']});setTimeout(()=>observer.disconnect(),1000)
  },true)
  window.washTabRecords=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('higood-pcs-records');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readonly'),q=tx.objectStore('records').getAll();let rows=[];q.onsuccess=()=>rows=q.result;tx.oncomplete=()=>{db.close();resolve(rows)};tx.onabort=()=>reject(tx.error)}})
 })
 c.on('page',p=>{p.setDefaultTimeout(6000);p.on('pageerror',e=>report.errors.push(e.message))})
}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,result:'PASS',detail});console.log('PASS',name)}catch(error){report.checks.push({name,result:'FAIL',error:error.stack});throw error}}
async function measure(p,family,run,action,complete,nav=false){
 await p.evaluate(()=>window.washTabStart=0)
 await action();await complete()
 const end=await p.evaluate(()=>window.washTabReady()),start=await p.evaluate(nav=>performance.timeOrigin+(nav?0:window.washTabStart),nav)
 assert.ok(nav||await p.evaluate(()=>window.washTabStart>0),'Missing actual input event start')
 const sample={family,run,ms:end-start,result:end-start<=1000?'PASS':'FAIL',start:nav?'navigationStart':'captured native pointer/key/input/change',end:'correct visible result, required images, fonts and two frames; writes include durable native readback'}
 report.samples.push(sample);appendFileSync(out+'/samples-'+stamp+'.jsonl',JSON.stringify(sample)+'\n');console.log(sample.result,family,sample.ms.toFixed(2))
}
async function nativeSeed(c,records){
 const p=await c.newPage();await c.route('**/__wash_tab_fixture__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated tab fixture</title>'}));await p.goto(base+'/__wash_tab_fixture__')
 await p.evaluate(rows=>new Promise((resolve,reject)=>{const r=indexedDB.open('higood-pcs-records',2);r.onupgradeneeded=()=>{for(const name of ['records','files','operations','meta'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});const ops=r.transaction.objectStore('operations');if(!ops.indexNames.contains('createdAt'))ops.createIndex('createdAt','createdAt')};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readwrite');for(const row of rows)tx.objectStore('records').put(row);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)}}),records)
 await c.unroute('**/__wash_tab_fixture__');return p
}
const orders=async p=>(await p.evaluate(()=>window.washTabRecords())).filter(r=>r.collection==='fcs.fabric-washing.v1'&&r.value.kind==='orders').map(r=>r.value.data)
async function switchTab(p,name){await tab(p,name).click();await tab(p,name).and(p.locator('[aria-selected="true"]')).waitFor()}
const dialog=p=>p.locator('[data-washing-operation][open]')
const labels={send:'印花交给染厂',receive:'登记逐卷实收',start:'投入洗水',output:'登记实际产出',handout:'交回原接收方','downstream-receive':'登记下游实收'}
const saved={send:'印花方交出',receive:'染厂实际接收',start:'投入洗水',output:'登记实际产出',handout:'交回原接收方','downstream-receive':'下游实际接收'}
const screen=p=>new URL(p.url()).pathname.includes('/pda/')?'PDA':'Web'
function contract(action){return {qty:['receive','output','downstream-receive'].includes(action)?6:0,position:['receive','downstream-receive'].includes(action)?1:0,scan:['send','handout'].includes(action)?1:0,repack:action==='output'?6:0}}
async function fields(p,action,count=6,central=false){
 const d=dialog(p),expected=contract(action)
 assert.equal(await d.locator('[data-washing-exec-roll]').count(),count)
 for(const [name,n] of [['qty',expected.qty?count:0],['position',central?0:expected.position],['scan',expected.scan],['output-code',expected.repack?count:0]])assert.equal(await d.locator('[data-washing-'+name+']').count(),n,action+': '+name)
 assert.equal(await d.locator('[data-washing-central-location]').count(),central?1:0)
}
async function noInline(p){assert.equal(await root(p).locator('input, select, textarea').count(),0,'Execution page must not mount persistent input fields')}
async function open(p,action,run,count=6,central=false){
 const go=()=>root(p).getByRole('button',{name:labels[action],exact:true}).click()
 const ready=async()=>{await dialog(p).waitFor();await fields(p,action,count,central)}
 if(run)await measure(p,screen(p)+'-open-'+action,run,go,ready);else{await go();await ready()}
}
async function selectAll(p){for(const input of await dialog(p).locator('[data-washing-exec-roll]').all())await input.check()}
async function position(p,factory){const select=dialog(p).locator('[data-washing-position]'),opts=await select.locator('option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));const v=opts.find(x=>x.value&&x.label.includes(factory)&&x.label.includes('A-01-01'));assert.ok(v,'Missing actual '+factory+' position');await select.selectOption(v.value);assert.ok(opts.filter(x=>x.value).every(x=>x.label.includes(factory)),'Other factory locations must not be offered')}
async function scan(p,code,enter=true){const d=dialog(p);await d.locator('[data-washing-scan]').fill(code);if(enter)await d.locator('[data-washing-scan]').press('Enter');else await d.getByRole('button',{name:'核对卷码',exact:true}).click();await d.locator('[data-washing-scans]').filter({hasText:code}).waitFor()}
async function fillQuantities(p,value){for(const input of await dialog(p).locator('[data-washing-qty]').all())await input.fill(String(value))}
async function submit(p,action,run,predicate){
 const go=()=>dialog(p).getByRole('button',{name:'确认'+labels[action],exact:true}).click()
 const ready=async()=>{await dialog(p).waitFor({state:'detached'});await p.locator('[data-washing-result]').filter({hasText:'已保存：'+saved[action]}).waitFor();assert.ok(predicate((await orders(p))[0]),'Durable incorrect '+action);await noInline(p);assert.deepEqual(await p.evaluate(()=>window.washDialogBusyWitness),{fieldsDisabled:true,buttonsDisabled:true})}
 if(run)await measure(p,screen(p)+'-save-'+action,run,go,ready);else{await go();await ready()}
}
async function reject(p,action,family,run,pattern){
 const before=await p.evaluate(()=>window.washTabRecords())
 await measure(p,family,run,()=>dialog(p).getByRole('button',{name:'确认'+labels[action],exact:true}).click(),async()=>{await dialog(p).locator('[data-washing-operation-error]').filter({hasText:pattern}).waitFor();assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),before);assert.equal(await dialog(p).getByRole('button',{name:'确认'+labels[action],exact:true}).isEnabled(),true)})
}
async function closeClean(p){await dialog(p).locator('footer').getByRole('button',{name:'取消',exact:true}).click();await dialog(p).waitFor({state:'detached'})}
async function discard(p){await dialog(p).locator('footer').getByRole('button',{name:'取消',exact:true}).click();await dialog(p).getByRole('button',{name:'放弃填写并关闭',exact:true}).click();await dialog(p).waitFor({state:'detached'})}
async function login(p){await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号',exact:true}).fill('ID-F003_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.getByRole('button',{name:'打开账号信息',exact:true}).waitFor()}
async function openList(p,action,run,count=6){
 const ready=async()=>{await dialog(p).waitFor();await fields(p,action,count);assert.equal(new URL(p.url()).pathname,washPath)}
 if(run)await measure(p,'list-open-'+action,run,()=>listActions(p).getByRole('button',{name:labels[action],exact:true}).click(),ready)
 else{await listActions(p).getByRole('button',{name:labels[action],exact:true}).click();await ready()}
}
async function saveList(p,action,run,predicate,family='list-save-'+action){
 const ready=async()=>{await dialog(p).waitFor({state:'detached'});await p.locator('[data-washing-result]').filter({hasText:'已保存：'+saved[action]}).waitFor();assert.ok(predicate((await orders(p)).find(o=>o.id===orderId)));assert.equal(new URL(p.url()).pathname,washPath);assert.equal(await p.locator('[data-washing-operation-slot] input').count(),0);assert.deepEqual(await p.evaluate(()=>window.washDialogBusyWitness),{fieldsDisabled:true,buttonsDisabled:true})}
 if(run)await measure(p,family,run,()=>dialog(p).getByRole('button',{name:'确认'+labels[action],exact:true}).click(),ready)
 else{await dialog(p).getByRole('button',{name:'确认'+labels[action],exact:true}).click();await ready()}
}
function listFixture(records,count=20,allSent=false){
 const rows=structuredClone(records),original=rows.find(r=>r.value.kind==='orders')
 const at='2026-10-16T11:00:00+08:00'
 const stage=(r,n)=>{
  if(n>=2){r.receivedAt=at;r.receivedQty=50}
  if(n>=3)r.startedAt=at
  if(n>=4){r.completedAt=at;r.outputQty=49}
  if(n>=5)r.handedOutAt=at
  if(n>=6){r.downstreamReceivedAt=at;r.downstreamQty=49}
 }
 for(let i=1;i<count;i++){
  const record=structuredClone(original),o=record.value.data
  o.id='WASH-zz-LIST-READONLY-'+i;o.no='WS-LIST-READONLY-'+String(i).padStart(2,'0');record.id=record.id.slice(0,record.id.lastIndexOf('/')+1)+o.id
  o.source.printOrderId='PRINT-LIST-READONLY-'+i;o.source.printOrderNo='PH-LIST-READONLY-'+i;o.source.sourceNo='只读状态规模夹具 '+i
  o.rolls.forEach((r,j)=>{r.id=o.id+'-R'+j;r.sourceRollId=r.id;r.barcode=o.no+'-R'+j;stage(r,allSent?1:i===8?j+1:Math.min(i+1,6))})
  if(!allSent){if(i===5)o.completedAt=at;if(i===6)o.cancelledAt=at;if(i===7)o.exception='只读异常夹具';if(i===9){o.acceptance='UNASSIGNED';delete o.assignedFactoryId}}
  rows.push(record)
 }
 return rows
}
async function runListChecks(){
 report.environment.scope='WASH-303-WASH-310 Web list operations; same dialogs/domain and atomic transactions'
 report.environment.scale='20 washing orders / 120 rolls, 10 rows per page; one native six-roll business chain plus 19 explicit read-only state/scale fixtures'
 await check('native sent fixture for list operations',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,fixture)
  try{await p.goto(base+href);await root(p).waitFor();await open(p,'send');for(let i=1;i<=6;i++)await scan(p,'WS-1-R'+i);await submit(p,'send',0,o=>o.rolls.every(r=>r.sentAt));sentFixture=await p.evaluate(()=>window.washTabRecords());return {rolls:6,sent:300}}finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('list four-dialog flow and state controls '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,listFixture(sentFixture))
  try{
   const ready=async()=>{await listActions(p).waitFor();assert.equal(await listRoot(p).locator('tbody tr').count(),10)}
   await measure(p,'list-cold-20-orders',run,()=>p.goto(base+washPath,{waitUntil:'domcontentloaded'}),ready,true)
   await measure(p,'list-refresh-20-orders',run,()=>p.reload({waitUntil:'domcontentloaded'}),ready,true)
   await p.goto(base+href);await root(p).waitFor();await measure(p,'list-SPA-entry-20-orders',run,()=>root(p).getByRole('link',{name:'返回列表',exact:true}).click(),ready)
   assert.deepEqual(await listActions(p).getByRole('button').allTextContents(),[labels.receive])
   await measure(p,'list-page-size-20',run,()=>listRoot(p).locator('[data-fabric-washing-field="pageSize"]').selectOption('20'),async()=>{await listActions(p,'WASH-zz-LIST-READONLY-8').waitFor();assert.equal(await listRoot(p).locator('tbody tr').count(),20)})
   assert.deepEqual(await listActions(p,'WASH-zz-LIST-READONLY-8').getByRole('button').allTextContents(),[labels.receive,labels.start,labels.output,labels.handout])
   for(const i of [5,6,7,9])assert.equal(await listActions(p,'WASH-zz-LIST-READONLY-'+i).getByRole('button').count(),0)
   await measure(p,'list-page-size-10',run,()=>listRoot(p).locator('[data-fabric-washing-field="pageSize"]').selectOption('10'),ready)
   await p.locator('[data-washing-filter="query"]').fill('FAB-P200-BLUE-FLORAL')
   await measure(p,'list-query-20-orders',run,()=>listRoot(p).getByRole('button',{name:'查询',exact:true}).click(),ready)
   await measure(p,'list-reset-20-orders',run,()=>listRoot(p).getByRole('button',{name:'重置',exact:true}).click(),ready)
   await measure(p,'list-next-page',run,()=>listRoot(p).getByRole('button',{name:'下一页',exact:true}).click(),()=>listRoot(p).getByText('2 / 2',{exact:true}).waitFor())
   await measure(p,'list-previous-page',run,()=>listRoot(p).getByRole('button',{name:'上一页',exact:true}).click(),ready)
   await measure(p,'list-sort-20-orders',run,()=>listRoot(p).getByRole('button',{name:'按数量升序排列',exact:true}).click(),ready)
   await p.evaluate(()=>{window.washListNodes={root:document.querySelector('[data-washing-list-root]'),filters:document.querySelector('[data-standard-list-filters]'),head:document.querySelector('thead'),scroll:document.querySelector('[data-standard-list-scroll]')};window.washListNodes.scroll.scrollLeft=300});assert.equal(await p.evaluate(()=>window.washListNodes.scroll.scrollLeft),300)
   await openList(p,'receive',run)
   const beforeCancel=await p.evaluate(()=>window.washTabRecords())
   await measure(p,'list-cancel-and-restore-row-focus',run,()=>dialog(p).getByRole('button',{name:'取消',exact:true}).click(),async()=>{await dialog(p).waitFor({state:'detached'});assert.equal(await listActions(p).getByRole('button',{name:labels.receive,exact:true}).evaluate(e=>e===document.activeElement),true);assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),beforeCancel)})
   await openList(p,'receive');await fillQuantities(p,50);await position(p,'GTG')
   const disabledBefore=await listRoot(p).locator('[data-washing-list-pagination] button').evaluateAll(es=>es.map(e=>e.disabled))
   await p.evaluate(()=>{window.washDialogAbortNext=true})
   await reject(p,'receive','list-abort-retains-form-and-pagination',run,/未保存/)
   assert.equal(await dialog(p).locator('[data-washing-qty]').first().inputValue(),'50');assert.deepEqual(await listRoot(p).locator('[data-washing-list-pagination] button').evaluateAll(es=>es.map(e=>e.disabled)),disabledBefore)
   await saveList(p,'receive',run,o=>o.rolls.every(r=>r.receivedQty===50),'list-retry-receive-after-abort')
   assert.deepEqual(await listActions(p).getByRole('button').allTextContents(),[labels.start])
   await openList(p,'start',run);await selectAll(p);await saveList(p,'start',run,o=>o.rolls.every(r=>r.startedAt))
   assert.deepEqual(await listActions(p).getByRole('button').allTextContents(),[labels.output])
   await openList(p,'output',run);await fillQuantities(p,49);for(const [i,input]of(await dialog(p).locator('[data-washing-output-code]').all()).entries())await input.fill('LIST-'+run+'-'+i);await dialog(p).locator('[data-washing-difference]').check();await saveList(p,'output',run,o=>o.rolls.every(r=>r.outputQty===49))
   assert.deepEqual(await listActions(p).getByRole('button').allTextContents(),[labels.handout])
   await openList(p,'handout',run);for(let i=0;i<6;i++)await scan(p,'LIST-'+run+'-'+i);await saveList(p,'handout',run,o=>o.rolls.every(r=>r.handedOutAt))
   assert.equal(await listActions(p).getByRole('button').count(),0)
   assert.equal(await p.evaluate(()=>window.washListNodes.root===document.querySelector('[data-washing-list-root]')&&window.washListNodes.filters===document.querySelector('[data-standard-list-filters]')&&window.washListNodes.head===document.querySelector('thead')&&window.washListNodes.scroll===document.querySelector('[data-standard-list-scroll]')),true)
   assert.equal(await p.evaluate(()=>window.washListNodes.scroll.scrollLeft),300)
   await p.reload();await listActions(p).waitFor();assert.equal(await listActions(p).getByRole('button').count(),0)
   await p.goto(base+href);await root(p).waitFor();assert.match(await root(p).innerText(),/加工产出 294 Yard/);await switchTab(p,'交接记录');assert.match(await p.getByRole('tabpanel').innerText(),new RegExp('LIST-'+run+'-0'));await switchTab(p,'操作日志');const log=await p.getByRole('tabpanel').innerText();for(const text of ['染厂实际接收','投入洗水','登记实际产出','交回原接收方'])assert.ok(log.includes(text));assert.doesNotMatch(log,/染厂接单/)
   const current=await p.evaluate(()=>window.washTabRecords());assert.equal(current.filter(r=>r.value.kind==='actions'&&r.value.data.orderId===orderId&&r.value.data.action==='RECEIVE').length,1)
   return {orders:20,rolls:6,received:300,output:294,handedOut:294,noNavigation:true,localRefresh:true,abortRetryOnce:true}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('list stale form and stale button do not overwrite peer '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture),peer=await c.newPage()
  try{
   await p.goto(base+washPath);await listActions(p).waitFor();await openList(p,'receive');await fillQuantities(p,50);await position(p,'GTG')
   await peer.goto(base+href);await root(peer).waitFor();await open(peer,'receive');await fillQuantities(peer,50);await position(peer,'GTG');await submit(peer,'receive',0,o=>o.rolls.every(r=>r.receivedQty===50))
   await reject(p,'receive','list-stale-form-preserved',run,/单据已更新/);await discard(p)
   const before=await p.evaluate(()=>window.washTabRecords())
   await measure(p,'list-stale-button-refreshes-current-state',run,()=>listActions(p).getByRole('button',{name:labels.receive,exact:true}).click(),async()=>{await listRoot(p).locator('[data-washing-error]').filter({hasText:'单据已更新'}).waitFor();assert.equal(await dialog(p).count(),0);assert.deepEqual(await listActions(p).getByRole('button').allTextContents(),[labels.start]);assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),before)})
   return {staleNotSaved:true,latestActionVisible:true,peerKept:true}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('state filter removes last-page row without clearing query or preferences '+run,async()=>{
  const rows=listFixture(sentFixture,11,true),record=rows.find(r=>r.value.kind==='orders'&&r.value.data.id===orderId);rows.splice(rows.indexOf(record),1);rows.push(record)
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c)
  await c.addInitScript(path=>{if(location.protocol==='http:')localStorage.setItem(path+':columns',JSON.stringify({order:['order','requirements','progress','qty','input','output','time','action'],visibleKeys:['order','requirements','progress','qty','action'],frozenKeys:['order'],pageSize:10}))},washPath)
  const p=await nativeSeed(c,rows)
  try{
   await p.goto(base+washPath);await listRoot(p).waitFor();await p.locator('[data-washing-filter="query"]').fill('FAB-P200-BLUE-FLORAL');await p.locator('[data-washing-filter="status"]').selectOption('印花已交出待实收');await listRoot(p).getByRole('button',{name:'查询',exact:true}).click();const sort=listRoot(p).locator('[data-fabric-washing-action="sort-column"][data-column-key="order"]');await sort.click();await sort.click();await listRoot(p).getByRole('button',{name:'下一页',exact:true}).click();await listActions(p).waitFor()
   const pref=await p.evaluate(path=>localStorage.getItem(path+':columns'),washPath),headers=await p.locator('thead').innerHTML()
   await openList(p,'receive');await fillQuantities(p,50);await position(p,'GTG');await saveList(p,'receive',run,o=>o.rolls.every(r=>r.receivedQty===50),'list-save-exits-filter-and-clamps-page')
   assert.equal(await listActions(p).count(),0);assert.equal(await listRoot(p).locator('tbody tr').count(),10);assert.equal(await listRoot(p).getByRole('button',{name:'上一页',exact:true}).isEnabled(),false)
   assert.equal(await p.locator('[data-washing-filter="query"]').inputValue(),'FAB-P200-BLUE-FLORAL');assert.equal(await p.locator('[data-washing-filter="status"]').inputValue(),'印花已交出待实收');assert.equal(await p.evaluate(path=>localStorage.getItem(path+':columns'),washPath),pref);assert.equal(await p.locator('thead').innerHTML(),headers);assert.equal(await p.locator('[data-washing-result]').evaluate(e=>e===document.activeElement),true)
   return {matching:10,page:1,queryKept:true,statusKept:true,columnsAndFrozenKept:true,feedbackFocused:true}
  }finally{await c.close()}
 })
 for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768}])await check('list operations layout and image '+viewport.width,async()=>{
  const c=await browser.newContext({viewport,timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,listFixture(sentFixture))
  try{
   await p.goto(base+washPath);await listActions(p).waitFor();await p.evaluate(()=>window.washTabReady());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   const operation=await listActions(p).getByRole('button',{name:labels.receive,exact:true}).boundingBox();assert.ok(operation.width>=80&&operation.height>=40&&operation.x>=0&&operation.x+operation.width<=viewport.width)
   await p.screenshot({path:out+'/list-'+viewport.width+'.png',fullPage:false});await openList(p,'receive');await p.evaluate(()=>window.washTabReady());const footer=await dialog(p).locator('footer button').last().boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=viewport.height);await p.screenshot({path:out+'/list-receive-'+viewport.width+'.png',fullPage:false})
   await dialog(p).getByRole('button',{name:'查看蓝白碎花棉府绸大图',exact:true}).click();await p.locator('[data-washing-image-overlay]').waitFor();await p.locator('[data-washing-image-overlay]').press('Escape');await p.locator('[data-washing-image-overlay]').waitFor({state:'detached'});assert.equal(await dialog(p).isVisible(),true);await dialog(p).press('Escape');await dialog(p).waitFor({state:'detached'});assert.equal(await listActions(p).getByRole('button',{name:labels.receive,exact:true}).evaluate(e=>e===document.activeElement),true)
   return {viewport,image:true,keyboard:true,fixedOperationColumn:true}
  }finally{await c.close()}
 })
 await check('PDA and detail retain their physical receipt entry',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture)
  try{await login(p);await p.goto(base+'/fcs/pda/washing/'+orderId);await root(p).waitFor();await open(p,'receive');await fillQuantities(p,50);await position(p,'GTG');await submit(p,'receive',0,o=>o.rolls.every(r=>r.receivedQty===50));await p.reload();await root(p).waitFor();assert.match(await root(p).innerText(),/染厂实收 300 Yard/);return {receipt:300,refresh:true}}finally{await c.close()}
 })
}
let fixture,href,orderId,sentFixture,completedFixture
try{
 await check('native six-roll fixture through printing initiation',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await c.newPage()
  try{await p.goto(base+printPath);await p.locator('[data-printing-work-orders-root]').waitFor();await p.getByRole('textbox',{name:'综合查询',exact:true}).fill('PH-WASH');await p.getByRole('button',{name:'查询',exact:true}).click();await p.locator('[data-printing-row-actions="PWO-WASH-DEMO-PRODUCTION-DONE"]').getByRole('button',{name:'发起洗水',exact:true}).click();const d=p.getByRole('dialog',{name:'发起洗水',exact:true});await d.locator('[data-washing-feel]').selectOption('增厚蓬松棉手感');await d.getByRole('button',{name:'创建洗水加工单',exact:true}).click();const result=d.getByRole('link',{name:'查看洗水加工单',exact:true});await result.waitFor();href=await result.getAttribute('href');orderId=href.split('/').at(-1);fixture=await p.evaluate(()=>window.washTabRecords());assert.equal((await orders(p))[0].rolls.length,6);writeFileSync(out+'/six-roll-native-fixture.json',JSON.stringify(fixture));return {orderId,rolls:6,qty:300}}finally{await c.close()}
 })
 if(listOnly)await runListChecks()
 else{
 for(let run=1;run<=runs;run++)await check('Web six-dialog flow, cancellation and validation '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,fixture)
  try{
   await measure(p,'Web-cold-six-roll-detail',run,()=>p.goto(base+href,{waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)
   await noInline(p);await measure(p,'Web-refresh-six-roll-detail',run,()=>p.reload({waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)
   const original=await p.evaluate(()=>{window.washExecNode=document.querySelector('[data-washing-tab-panel="execution"]');return window.washTabRecords()})
   await open(p,'send',run)
   await closeClean(p);assert.equal(await root(p).getByRole('button',{name:labels.send,exact:true}).evaluate(el=>el===document.activeElement),true);assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),original)
   assert.equal(await p.evaluate(()=>window.washExecNode===document.querySelector('[data-washing-tab-panel="execution"]')),true)
   await open(p,'send');await reject(p,'send','missing-selection-retains-dialog',run,/请选择/)
   for(let i=1;i<=6;i++)await scan(p,'WS-1-R'+i)
   const codesBefore=await dialog(p).locator('[data-washing-scans]').innerText()
   await dialog(p).locator('[data-washing-scan]').fill('WRONG-ROLL')
   await measure(p,'invalid-scan-preserves-checked-rolls',run,()=>dialog(p).getByRole('button',{name:'核对卷码',exact:true}).click(),async()=>{await dialog(p).locator('[data-washing-operation-error]').filter({hasText:'不在本次可交出范围'}).waitFor();assert.equal(await dialog(p).locator('[data-washing-scans]').innerText(),codesBefore)})
   await dialog(p).locator('[data-washing-scan]').fill('WS-1-R1');await dialog(p).getByRole('button',{name:'核对卷码',exact:true}).click();assert.match(await dialog(p).locator('[data-washing-operation-error]').innerText(),/重复/)
   await submit(p,'send',run,o=>o.rolls.every(r=>r.sentAt)&&!o.acceptedAt);if(run===1)sentFixture=await p.evaluate(()=>window.washTabRecords())
   await open(p,'receive',run);assert.equal(await dialog(p).locator('[data-washing-difference-row]').isVisible(),false)
   const beforeCleanClose=await p.evaluate(()=>window.washTabRecords())
   await measure(p,'cancel-clean-dialog',run,()=>dialog(p).locator('footer').getByRole('button',{name:'取消',exact:true}).click(),async()=>{await dialog(p).waitFor({state:'detached'});assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),beforeCleanClose)})
   await open(p,'receive')
   await dialog(p).locator('[data-washing-qty]').first().fill('49')
   await measure(p,'close-dirty-dialog-asks-discard',run,()=>dialog(p).locator('footer').getByRole('button',{name:'取消',exact:true}).click(),()=>dialog(p).getByRole('button',{name:'继续填写',exact:true}).waitFor())
   await measure(p,'continue-draft-after-close',run,()=>dialog(p).getByRole('button',{name:'继续填写',exact:true}).click(),async()=>{assert.equal(await dialog(p).locator('[data-washing-discard-confirm]').isVisible(),false);assert.equal(await dialog(p).locator('[data-washing-qty]').first().inputValue(),'49')})
   await dialog(p).locator('footer').getByRole('button',{name:'取消',exact:true}).click();const sentBefore=await p.evaluate(()=>window.washTabRecords())
   await measure(p,'discard-without-persistent-write',run,()=>dialog(p).getByRole('button',{name:'放弃填写并关闭',exact:true}).click(),async()=>{await dialog(p).waitFor({state:'detached'});assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),sentBefore)})
   await open(p,'receive');await fillQuantities(p,50);await position(p,'GTG');await submit(p,'receive',run,o=>o.rolls.every(r=>r.receivedQty===50))
   await open(p,'start',run);await selectAll(p);await submit(p,'start',run,o=>o.rolls.every(r=>r.startedAt))
   await open(p,'output',run)
   const qtyInputs=await dialog(p).locator('[data-washing-qty]').all();for(const input of qtyInputs.slice(0,-1))await input.fill('49')
   await measure(p,'quantity-input-updates-selected-scope-and-difference',run,()=>qtyInputs.at(-1).fill('49'),async()=>{await dialog(p).locator('[data-washing-operation-count]').filter({hasText:'已选 6 / 6 卷'}).waitFor();assert.equal(await dialog(p).locator('[data-washing-difference-row]').isVisible(),true)})
   for(const [i,input] of (await dialog(p).locator('[data-washing-output-code]').all()).entries())await input.fill('DLG-'+run+'-'+i)
   await reject(p,'output','domain-rejection-preserves-output-draft',run,/数量有变化/);assert.equal(await qtyInputs[0].inputValue(),'49')
   await dialog(p).locator('[data-washing-difference]').check()
   if(run===1){const all=await dialog(p).locator('[data-washing-output-code]').all();await all[1].fill('DLG-1-0');await dialog(p).getByRole('button',{name:'确认'+labels.output,exact:true}).click();await dialog(p).locator('[data-washing-operation-error]').filter({hasText:'卷码'}).waitFor();await all[1].fill('DLG-1-1')}
   await submit(p,'output',run,o=>o.rolls.every(r=>r.outputQty===49)&&o.rolls[0].outputBarcode==='DLG-'+run+'-0')
   await open(p,'handout',run);for(let i=0;i<5;i++)await scan(p,'DLG-'+run+'-'+i)
   await dialog(p).locator('[data-washing-scan]').fill('DLG-'+run+'-5')
   await measure(p,'scan-updates-six-selected-output-rolls',run,()=>dialog(p).getByRole('button',{name:'核对卷码',exact:true}).click(),()=>dialog(p).locator('[data-washing-operation-count]').filter({hasText:'已选 6 / 6 卷'}).waitFor())
   await submit(p,'handout',run,o=>o.rolls.every(r=>r.handedOutAt))
   await open(p,'downstream-receive',run);await fillQuantities(p,49);await position(p,'全能力测试工厂');await submit(p,'downstream-receive',run,o=>o.rolls.every(r=>r.downstreamQty===49))
   await p.reload();await root(p).waitFor();assert.ok((await orders(p))[0].rolls.every(r=>r.downstreamQty===49));await noInline(p)
   if(run===1){
    completedFixture=await p.evaluate(()=>window.washTabRecords());writeFileSync(out+'/completed-native-fixture.json',JSON.stringify(completedFixture))
    for(const name of ['基本信息','交接记录','操作日志','打印','加工执行']){await switchTab(p,name);assert.equal(await p.getByRole('tabpanel').count(),1)}
    await tab(p,'加工执行').press('End');assert.equal(await tab(p,'打印').getAttribute('aria-selected'),'true')
    for(const label of ['洗水加工单预览','交接与卷标预览']){await root(p).getByRole('button',{name:label,exact:true}).click();await p.locator('[data-washing-print-document]').waitFor();if(label==='交接与卷标预览')await p.locator('[data-real-barcode]').first().waitFor();assert.match(await p.locator('[data-washing-print-document]').innerText(),/GTG/)}
    assert.equal(await p.locator('[data-real-barcode]').count(),6);await switchTab(p,'操作日志');assert.match(await p.getByRole('tabpanel').innerText(),/登记实际产出/);assert.doesNotMatch(await p.getByRole('tabpanel').innerText(),/染厂接单/)
   }
   return {rolls:6,input:300,received:300,output:294,downstream:294,allDialogsPassed:true}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('PDA four operations use their own dialogs '+run,async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture)
  try{
   await login(p);await measure(p,'PDA-detail-after-login',run,()=>p.goto(base+'/fcs/pda/washing/'+orderId,{waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true);await noInline(p)
   for(const action of ['receive','start','output','handout']){
    await open(p,action,run)
    if(action==='receive'){await fillQuantities(p,50);await position(p,'GTG')}
    if(action==='start')await selectAll(p)
    if(action==='output'){await fillQuantities(p,49);await dialog(p).locator('[data-washing-difference]').check()}
    if(action==='handout')for(let i=1;i<=6;i++)await scan(p,'WS-1-R'+i)
    if(run===1){await p.evaluate(()=>window.washTabReady());await p.screenshot({path:out+'/PDA-'+action+'-390.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const box=await dialog(p).locator('footer button').last().boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844,'PDA confirm must remain visible')}
    await submit(p,action,run,o=>action==='receive'?o.rolls.every(r=>r.receivedQty===50):action==='start'?o.rolls.every(r=>r.startedAt):action==='output'?o.rolls.every(r=>r.outputQty===49):o.rolls.every(r=>r.handedOutAt))
   }
   return {viewport:'390x844',operations:4}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('aborted save retains quantities, positions and retry '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture)
  try{
   await p.goto(base+href);await root(p).waitFor();await open(p,'receive');await dialog(p).locator('[data-washing-qty]').first().fill('49');await position(p,'GTG');await dialog(p).locator('[data-washing-difference]').check()
   const location=await dialog(p).locator('[data-washing-position]').inputValue();await p.evaluate(()=>{window.washDialogAbortNext=true})
   await reject(p,'receive','aborted-save-preserves-form',run,/未保存/)
   assert.equal(await dialog(p).locator('[data-washing-qty]').first().inputValue(),'49');assert.equal(await dialog(p).locator('[data-washing-position]').inputValue(),location);assert.equal(await dialog(p).locator('[data-washing-difference]').isChecked(),true)
   if(run===1)await p.screenshot({path:out+'/aborted-save-retained.png',fullPage:true})
   await measure(p,'retry-after-aborted-save',run,()=>submit(p,'receive',0,o=>o.rolls[0].receivedQty===49&&o.rolls.slice(1).every(r=>!r.receivedAt)),async()=>{})
   const rows=await p.evaluate(()=>window.washTabRecords());assert.equal(rows.filter(r=>r.value.kind==='actions'&&r.value.data.action==='RECEIVE').length,1)
   return {abortAtomic:true,retained:true,retryOnce:true}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('concurrent update preserves stale form without overwriting '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture),peer=await c.newPage()
  try{
   await p.goto(base+href);await root(p).waitFor();await open(p,'receive');await dialog(p).locator('[data-washing-qty]').first().fill('50');await position(p,'GTG')
   await peer.goto(base+href);await root(peer).waitFor();await open(peer,'receive');await dialog(peer).locator('[data-washing-qty]').nth(1).fill('50');await position(peer,'GTG');await submit(peer,'receive',0,o=>o.rolls[1].receivedQty===50)
   const before=await p.evaluate(()=>window.washTabRecords())
   await measure(p,'stale-save-retains-input',run,()=>dialog(p).getByRole('button',{name:'确认'+labels.receive,exact:true}).click(),async()=>{await dialog(p).locator('[data-washing-operation-error]').filter({hasText:'单据已更新'}).waitFor();assert.equal(await dialog(p).locator('[data-washing-qty]').first().inputValue(),'50');assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),before)})
   await discard(p);await open(p,'receive',0,5);assert.equal(await dialog(p).locator('[data-washing-exec-roll="PWO-WASH-DEMO-PRODUCTION-DONE-R2"]').count(),0)
   return {staleNotSaved:true,peerKept:true,latestEligible:5}
  }finally{await c.close()}
 })
 for(let run=1;run<=runs;run++)await check('original central-warehouse receipt has no GTG location or scan input '+run,async()=>{
  const rows=structuredClone(completedFixture),record=rows.find(r=>r.value.kind==='orders'),o=record.value.data
  o.source.target={id:'WH-FABRIC-001',warehouseId:'WH-FABRIC-001',name:'面料中央仓(GKP)'};for(const r of o.rolls){delete r.downstreamReceivedAt;delete r.downstreamQty;delete r.downstreamWarehouseId;delete r.downstreamLocationId}
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,rows)
  try{await p.goto(base+href);await root(p).waitFor();await measure(p,'Web-open-original-central-receipt',run,()=>open(p,'downstream-receive',0,6,true),async()=>{});await fillQuantities(p,49);await dialog(p).locator('[data-washing-central-location]').fill('A-01-01');await measure(p,'Web-save-original-central-receipt',run,()=>submit(p,'downstream-receive',0,o=>o.rolls.every(r=>r.downstreamQty===49&&r.downstreamWarehouseId==='WH-FABRIC-001')),async()=>{});return {warehouse:'WH-FABRIC-001',noScan:true,noForeignPositions:true}}finally{await c.close()}
 })
 for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768}])await check('responsive dialog, keyboard and object image '+viewport.width,async()=>{
  const c=await browser.newContext({viewport,timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture)
  try{await p.goto(base+href);await root(p).waitFor();await noInline(p);await p.evaluate(()=>window.washTabReady());await p.screenshot({path:out+'/execution-'+viewport.width+'.png',fullPage:true});await open(p,'receive');await p.evaluate(()=>window.washTabReady());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const box=await dialog(p).locator('footer button').last().boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height);await p.screenshot({path:out+'/receive-'+viewport.width+'.png',fullPage:true});await dialog(p).getByRole('button',{name:'查看蓝白碎花棉府绸大图',exact:true}).click();await p.locator('[data-washing-image-overlay]').waitFor();await p.locator('[data-washing-image-overlay]').press('Escape');await p.locator('[data-washing-image-overlay]').waitFor({state:'detached'});assert.equal(await dialog(p).isVisible(),true);await dialog(p).press('Escape');await dialog(p).waitFor({state:'detached'});assert.equal(await root(p).getByRole('button',{name:labels.receive,exact:true}).evaluate(el=>el===document.activeElement),true);return viewport}finally{await c.close()}
 })
 }
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1}
finally{
 report.families=Object.fromEntries(Object.entries(Object.groupBy(report.samples,s=>s.family)).map(([k,v])=>[k,{count:v.length,maxMs:Math.max(...v.map(s=>s.ms))}]))
 report.coverage=listOnly?{functional:'four list dialogs, mixed stages and blocked orders, 20 orders, six-roll commands, no navigation, local refresh, query/pagination/columns/focus, abort/retry and peer conflicts, detail/PDA direct readback',performance:'20-order cold/refresh/SPA/query/reset/sort/pagination, four six-roll list opens/saves, cancellation, abort/retry, stale form/action, status-filter removal and page clamp; each family five samples in formal mode',reused:'d689e384 field/quantity/scan/domain/atomic storage/print mapping and complete PDA dialog evidence, unchanged execution-dialog.ts; shared save button restoration additionally exercised on PDA'}:{functional:'six operations Web, four GTG PDA, six physical rolls per order, original factory and central warehouse, cancellation, wrong/duplicate scans, output difference/duplicate label, abort/retry and stale concurrency',performance:'Web and PDA opens/saves kept separate; maximum six-roll operation per family; the quantity-change handler represented by six-roll output; no repetition of unchanged list, backup, migration or print-renderer performance',reused:'previous published domain/storage/printing mapping contracts retained in 2026-10-16-washing-remove-optional-actions; current visible consumers are reread above'}
 report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.result==='PASS').length,samples:report.samples.length,maxMs:report.samples.length?Math.max(...report.samples.map(s=>s.ms)):null,slow:report.samples.filter(s=>s.ms>1000),pageErrors:report.errors.length}
 if(formal&&(Object.values(report.families).some(f=>f.count<5)||report.summary.slow.length||report.errors.length))process.exitCode=1
 writeFileSync(out+'/report-'+stamp+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));await browser.close()
}
