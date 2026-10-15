import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43159',runs=Number(process.env.WASH_DIRECT_RUNS||5),section=process.env.WASH_DIRECT_SECTION||'all'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Isolated local fixtures only')
const out='output/playwright/washing-gtg-v1.3',stamp=new Date().toISOString().replaceAll(':','-');mkdirSync(out,{recursive:true})
const report={at:new Date().toISOString(),base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeAssets:JSON.parse(readFileSync('output/washing-gtg-v1.3/runtime-assets.json')),environment:{node:process.version,timezone:'Asia/Shanghai',pdaViewport:'390x844',webViewport:'1366x768',fixtures:'Native IndexedDB records from successful domain actions; no app asset prewarming during setup'},fixtures:{},samples:[],checks:[],errors:[]}
const browser=await chromium.launch({headless:true});report.browser=browser.version()
async function init(c,backup){
 await c.addInitScript(()=>{
  window.directStart=0;for(const type of ['pointerdown','keydown','change','input'])document.addEventListener(type,()=>{if(!window.directStart)window.directStart=performance.now()},true)
  window.directRead=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('higood-pcs-records');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readonly'),q=tx.objectStore('records').getAll();let rows=[];q.onsuccess=()=>{rows=q.result};tx.oncomplete=()=>{db.close();resolve(rows)};tx.onabort=()=>reject(tx.error)}})
  window.directReady=async()=>{await document.fonts.ready;for(const i of document.querySelectorAll('img')){const r=i.getBoundingClientRect();if(r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0){if(!i.complete)await i.decode();assertImage(i)}}function assertImage(i){if(!i.naturalWidth)throw new Error('Visible image unavailable: '+i.alt)}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()}
 })
 c.on('page',p=>{p.setDefaultTimeout(6000);p.on('pageerror',e=>report.errors.push(e.message))})
 const p=await c.newPage();await c.route('**/__wash_direct_fixture__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated washing fixture</title>'}));await p.goto(base+'/__wash_direct_fixture__')
 assert.equal(backup.files.length,0)
 await p.evaluate(rows=>new Promise((resolve,reject)=>{const r=indexedDB.open('higood-pcs-records',2);r.onupgradeneeded=()=>{const db=r.result;for(const name of ['records','files','operations','meta'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});r.transaction.objectStore('operations').createIndex('createdAt','createdAt')};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readwrite');for(const row of rows)tx.objectStore('records').put(row);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)}}),backup.records)
 await c.unroute('**/__wash_direct_fixture__');return p
}
async function measure(p,family,run,action,complete,nav=false){await p.evaluate(()=>window.directStart=0);await action();await complete();const end=await p.evaluate(()=>window.directReady()),start=await p.evaluate(nav=>performance.timeOrigin+(nav?0:window.directStart),nav);assert.ok(nav||await p.evaluate(()=>window.directStart>0));const sample={family,run,ms:end-start,status:end-start<=1000?'PASS':'FAIL',start:nav?'navigationStart':'actual pointer/key/change',complete:'correct visible result, necessary images/fonts/two animation frames; native durable readback for saves'};report.samples.push(sample);appendFileSync(out+'/direct-samples-'+stamp+'.jsonl',JSON.stringify(sample)+'\n');console.log(sample.status,family,sample.ms.toFixed(2))}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'PASS',detail})}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});throw e}}
function fixture(name){const path='output/washing-gtg-v1.3/'+name+'.json',raw=readFileSync(path);report.fixtures[name]=createHash('sha256').update(raw).digest('hex');return JSON.parse(raw)}
const getOrder=async p=>(await p.evaluate(()=>window.directRead())).find(r=>r.collection==='fcs.fabric-washing.v1'&&r.value.kind==='orders')
async function login(p){await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号',exact:true}).fill('ID-F003_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.getByRole('button',{name:'打开账号信息',exact:true}).waitFor()}
try{
 if(section==='all'||section==='affected'||section==='warehouse')for(const kind of ['received','output'])for(let run=1;run<=runs;run++)await check('GTG warehouse '+kind+' '+run,async()=>{
  const backup=fixture('GTG-'+kind+'-backup'),saved=backup.records.find(r=>r.value.kind==='orders').value.data
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'}),p=await init(c,backup),path='/fcs/pda/washing/'+encodeURIComponent(saved.id)
  try{
   await login(p)
   await measure(p,'PDA-GTG-warehouse-'+kind+'-load-after-login',run,()=>p.goto(base+'/fcs/pda/warehouse/'+(kind==='received'?'wait-process':'wait-handover'),{waitUntil:'domcontentloaded'}),async()=>{await p.locator('[data-nav="'+path+'"]').first().waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)},true)
   if(run===1)await p.screenshot({path:out+'/GTG-warehouse-'+kind+'.png',fullPage:true})
   await measure(p,'PDA-GTG-warehouse-'+kind+'-open-exact-order',run,()=>p.locator('[data-nav="'+path+'"]').first().click(),async()=>{await p.locator('[data-washing-order="'+saved.id+'"]').waitFor();assert.equal((await getOrder(p)).value.data.id,saved.id);assert.match(await p.locator('[data-washing-order]').innerText(),kind==='received'?/染厂实收 50 Yard/:/加工产出 50 Yard/)})
   return {id:saved.id,factory:'ID-F003',qty:50}
  }finally{await c.close()}
 })
 if(section==='all'||section==='affected'||section==='printing')for(let run=1;run<=runs;run++)await check('fresh design revision printing confirmation '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await init(c,fixture('benchmark-36-orders'))
  try{
   const id='PWO-WASH-DEMO-DESIGN_REVISION-DONE'
   await measure(p,'direct-design-revision-print-confirmation',run,()=>p.goto(base+'/fcs/print/preview?documentType=PRINTING_CONFIRMATION&sourceType=PRINTING_WORK_ORDER&sourceId='+id,{waitUntil:'domcontentloaded'}),async()=>{await p.locator('[data-printing-confirmation="'+id+'"]').waitFor();const text=await p.locator('[data-printing-confirmation]').innerText();assert.match(text,/计划接收方/);assert.match(text,/GTG/);assert.equal((await p.evaluate(()=>window.directRead())).filter(r=>r.value.kind==='orders').length,36)},true)
   if(run===1)await p.screenshot({path:out+'/design-revision-confirmation-GTG.png',fullPage:true})
   return {currentDownstream:'GTG',unchangedOrderCount:36}
  }finally{await c.close()}
 })
 if(section==='all'||section==='affected'||section==='printing')for(let run=1;run<=runs;run++)await check('early unmatched print washing downstream '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await init(c,fixture('benchmark-36-orders')),id='PWO-WASH-DEMO-PRODUCTION_DEMAND-DONE'
  try{
   await measure(p,'printing-36-wash-orders-unmatched-downstream',run,()=>p.goto(base+'/fcs/craft/printing/work-orders?workOrderIds='+id,{waitUntil:'domcontentloaded'}),async()=>{await p.locator('[data-printing-row-actions="'+id+'"]').waitFor();assert.match(await p.locator('[data-printing-downstream]').innerText(),/GTG/);assert.equal((await p.evaluate(()=>window.directRead())).filter(r=>r.value.kind==='orders').length,36)},true)
   if(run===1)await p.screenshot({path:out+'/early-print-washing-GTG.png',fullPage:true})
   return {orders:36,unmatchedSource:true,currentDownstream:'GTG'}
  }finally{await c.close()}
 })
 if(section==='all'||section==='legacy')for(let run=1;run<=runs;run++)await check('legacy unassigned order explicit GTG transition '+run,async()=>{
  const backup=fixture('benchmark-36-orders'),old=backup.records.find(r=>r.value.kind==='orders').value.data
  backup.records=backup.records.filter(r=>r.collection!=='fcs.fabric-washing.v1'||r.value.kind==='orders'&&r.value.data.id===old.id||['judgments','actions'].includes(r.value.kind)&&r.value.data.orderId===old.id)
  // V1.2 legitimately stored UNASSIGNED before a separate assignment action.
  old.acceptance='UNASSIGNED';for(const key of ['assignedFactoryId','assignedFactoryName','assignedAt','acceptedAt'])delete old[key]
  for(const key of ['product','materialProperties','taskNo','salesType','creationMethod'])delete old.source[key]
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await init(c,backup),path='/fcs/craft/dyeing/washing/work-orders/'+encodeURIComponent(old.id)
  try{
   const before=JSON.stringify((await getOrder(p)).value.data)
   await measure(p,'legacy-unassigned-order-read',run,()=>p.goto(base+path,{waitUntil:'domcontentloaded'}),async()=>{await p.getByRole('button',{name:'交由 GTG 承接',exact:true}).waitFor();assert.equal(JSON.stringify((await getOrder(p)).value.data),before)},true)
   await measure(p,'legacy-explicit-GTG-assignment',run,()=>p.getByRole('button',{name:'交由 GTG 承接',exact:true}).click(),async()=>{await p.getByRole('button',{name:'接单',exact:true}).waitFor();const saved=(await getOrder(p)).value.data;assert.equal(saved.id,old.id);assert.equal(saved.assignedFactoryId,'ID-F003');assert.equal(saved.acceptance,'PENDING')})
   return {id:old.id,readDidNotRewrite:true,explicitAssignment:'ID-F003'}
  }finally{await c.close()}
 })
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1}
finally{
 report.families=Object.fromEntries(Object.entries(Object.groupBy(report.samples,s=>s.family)).map(([name,items])=>[name,{samples:items.length,maxMs:Math.max(...items.map(s=>s.ms))}]))
 report.summary={pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,samples:report.samples.length,maxMs:report.samples.length?Math.max(...report.samples.map(s=>s.ms)):null,slow:report.samples.filter(s=>s.ms>1000),pageErrors:report.errors.length}
 if(report.errors.length||report.samples.some(s=>s.ms>1000)||Object.values(report.families).some(f=>f.samples<5))process.exitCode=1
 writeFileSync(out+'/direct-report-'+stamp+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));await browser.close()
}
