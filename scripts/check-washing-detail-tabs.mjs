import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43159'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Only isolated local prototype contexts may be written')
const runs=Number(process.env.WASH_TAB_RUNS||5),formal=process.env.WASH_TAB_FORMAL==='1'
const out=process.env.WASH_TAB_OUT||'output/washing-detail-tabs',stamp=new Date().toISOString().replaceAll(':','-')
mkdirSync(out,{recursive:true})
const sources=['src/data/fcs/fabric-washing-model.ts','src/data/fcs/fabric-washing-views.ts','src/data/fcs/fabric-washing-maintenance.ts','src/pages/process-factory/dyeing/washing/order-presentation.ts','tests/unit/fabric-washing.test.ts','tests/unit/fabric-washing-maintenance.test.ts','tests/unit/fabric-washing-views.test.ts','scripts/check-washing-gtg-direct-consumers.mjs','scripts/check-post-print-fabric-washing.mjs','scripts/check-post-print-fabric-washing-edges.mjs','src/pages/process-factory/dyeing/washing/work-orders.ts','src/pages/process-factory/dyeing/washing/detail-views.ts','scripts/check-washing-detail-tabs.mjs','scripts/check-washing-gtg-ui.mjs']
const report={at:new Date().toISOString(),base,formal,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{timezone:'Asia/Shanghai',webViewports:['1366x768','1280x720','1024x768'],pdaViewport:'390x844',scale:'6 actual 50 Yard rolls in one order, created through the real print initiation UI',cold:'Fresh isolated contexts seeded through native IndexedDB before loading any app assets; no user browser data is read or cleared'},checks:[],samples:[],errors:[]}
report.runtimeAssets=JSON.parse(readFileSync(process.env.WASH_RUNTIME_ASSETS||'output/washing-detail-tabs/runtime-assets.json','utf8'))
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const printPath='/fcs/craft/printing/work-orders',washPath='/fcs/craft/dyeing/washing/work-orders'
const root=p=>p.locator('[data-washing-order]'),tab=(p,name)=>p.getByRole('tab',{name,exact:true})
async function init(c){
 await c.addInitScript(()=>{
  window.washTabStart=0
  for(const type of ['pointerdown','keydown','input','change'])document.addEventListener(type,()=>{if(!window.washTabStart)window.washTabStart=performance.now()},true)
  window.washTabReady=async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}).map(async img=>{if(!img.complete)await img.decode();if(!img.naturalWidth)throw new Error('Missing visible image '+img.alt)}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()}
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
async function selectFirst(p){await p.locator('[data-washing-exec-roll]').first().check()}
async function scan(p,code){await p.locator('[data-washing-scan]').fill(code);await root(p).getByRole('button',{name:'核对卷码',exact:true}).click();await p.locator('[data-washing-scans]').filter({hasText:code}).waitFor()}
async function clickSave(p,label,predicate,run){
 const names={'接单':'染厂接单','印花交给染厂':'印花方交出','登记逐卷实收':'染厂实际接收','投入洗水':'投入洗水','登记实际产出':'登记实际产出','交回原接收方':'交回原接收方','登记下游实收':'下游实际接收'}
 const action=()=>root(p).getByRole('button',{name:label,exact:true}).click()
 const complete=async()=>{await p.locator('[data-washing-result]').filter({hasText:'已保存：'+names[label]}).waitFor();assert.ok(predicate((await orders(p))[0]),'Durable result after '+label)}
 if(run)await measure(p,'save-'+label,run,action,complete);else {await action();await complete()}
}
let fixture,href,orderId,completedFixture,sentFixture
try{
 await check('native valid six-roll fixture created through print UI',async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await c.newPage()
  await p.goto(base+printPath);await p.locator('[data-printing-work-orders-root]').waitFor();await p.getByRole('textbox',{name:'综合查询',exact:true}).fill('PH-WASH');await p.getByRole('button',{name:'查询',exact:true}).click()
  await p.locator('[data-printing-row-actions="PWO-WASH-DEMO-PRODUCTION-DONE"]').getByRole('button',{name:'发起洗水',exact:true}).click()
  const dialog=p.getByRole('dialog',{name:'发起洗水',exact:true});await dialog.locator('[data-washing-feel]').selectOption('增厚蓬松棉手感');await dialog.getByRole('button',{name:'创建洗水加工单',exact:true}).click();const result=dialog.getByRole('link',{name:'查看洗水加工单',exact:true});await result.waitFor();href=await result.getAttribute('href');orderId=href.split('/').at(-1)
  fixture=await p.evaluate(()=>window.washTabRecords());const o=(await orders(p))[0];assert.equal(o.rolls.length,6);assert.equal(o.assignedFactoryId,'ID-F003');assert.equal(o.source.target.id,'F090');assert.equal(o.acceptance,'NOT_REQUIRED');assert.equal(o.acceptedAt,undefined);writeFileSync(out+'/six-roll-native-fixture.json',JSON.stringify(fixture,null,2));await c.close();return {href,rolls:6,input:300}
 })
 for(let run=1;run<=runs;run++)await check('tabs, draft retention and save '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,fixture)
  try{
   await measure(p,'cold-six-roll-detail',run,()=>p.goto(base+href,{waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)
   assert.equal(await tab(p,'加工执行').getAttribute('aria-selected'),'true');assert.equal(await p.getByRole('tabpanel').count(),1);assert.equal(await p.locator('[data-washing-tab-panel]').count(),5)
   await measure(p,'refresh-six-roll-detail',run,()=>p.reload({waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)
   for(const name of ['接单','作废本单','拒单','登记异常'])assert.equal(await root(p).getByRole('button',{name,exact:true}).count(),0)
   assert.equal((await orders(p))[0].acceptedAt,undefined)
   const mainButton=await root(p).getByRole('button',{name:'印花交给染厂',exact:true}).boundingBox();assert.ok(mainButton.y+mainButton.height<768,'Primary action must be on first screen')
   await selectFirst(p);await p.locator('[data-washing-qty]').first().fill('47.5');await scan(p,'WS-1-R1');await p.locator('[data-washing-difference]').check()
   const before=await p.evaluate(()=>{window.washTabExecNode=document.querySelector('[data-washing-exec-roll]');return document.querySelector('[data-washing-position] option[value]:not([value=""])')?.value})
   if(before)await p.locator('[data-washing-position]').selectOption(before)
   const initialActions=(await p.evaluate(()=>window.washTabRecords())).filter(r=>r.value.kind==='actions').length
   for(const label of ['基本信息','交接记录','操作日志','打印','加工执行'])await measure(p,'tab-'+label,run,()=>tab(p,label).click(),async()=>{await tab(p,label).and(p.locator('[aria-selected="true"]')).waitFor();assert.equal(await tab(p,label).getAttribute('aria-selected'),'true');assert.equal(await p.getByRole('tabpanel').count(),1);assert.equal(await p.getByRole('tabpanel').getAttribute('aria-labelledby'),await tab(p,label).getAttribute('id'))})
   assert.equal((await p.evaluate(()=>window.washTabRecords())).filter(r=>r.value.kind==='actions').length,initialActions,'View changes must not write actions')
   assert.equal(await p.evaluate(()=>window.washTabExecNode===document.querySelector('[data-washing-exec-roll]')),true,'Tab changes must retain the actual execution DOM')
   assert.equal(await p.locator('[data-washing-exec-roll]').first().isChecked(),true);assert.equal(await p.locator('[data-washing-qty]').first().inputValue(),'47.5');assert.equal(await p.locator('[data-washing-difference]').isChecked(),true);assert.match(await p.locator('[data-washing-scans]').innerText(),/WS-1-R1/);if(before)assert.equal(await p.locator('[data-washing-position]').inputValue(),before)
   await measure(p,'tab-keyboard-roving-focus',run,()=>tab(p,'加工执行').press('End'),async()=>{await tab(p,'打印').and(p.locator('[aria-selected="true"]')).waitFor();assert.equal(await tab(p,'打印').getAttribute('aria-selected'),'true');assert.equal(await tab(p,'打印').evaluate(el=>el===document.activeElement),true)})
   await tab(p,'打印').press('Home');await tab(p,'加工执行').and(p.locator('[aria-selected="true"]')).waitFor();await tab(p,'加工执行').press('ArrowRight');await tab(p,'基本信息').and(p.locator('[aria-selected="true"]')).waitFor();assert.equal(await tab(p,'基本信息').getAttribute('aria-selected'),'true');await tab(p,'基本信息').press('ArrowLeft');await tab(p,'加工执行').and(p.locator('[aria-selected="true"]')).waitFor()
   await tab(p,'打印').click()
   for(const [label,family] of [['洗水加工单预览','print-order-with-retained-draft'],['交接与卷标预览','print-transfer-with-retained-draft']])await measure(p,family,run,()=>root(p).getByRole('button',{name:label,exact:true}).click(),async()=>{await p.locator('[data-washing-print-document]').waitFor();assert.match(await p.locator('[data-washing-print-document]').innerText(),/GTG/);assert.equal(await tab(p,'打印').getAttribute('aria-selected'),'true');assert.ok((await orders(p))[0].printedRevision);if(label==='交接与卷标预览')assert.equal(await p.locator('[data-real-barcode]').count(),6)})
   await switchTab(p,'操作日志');assert.match(await p.getByRole('tabpanel').innerText(),/打印预览/);assert.match(await p.getByRole('tabpanel').innerText(),/Web 端操作员/)
   await switchTab(p,'加工执行');assert.equal(await p.locator('[data-washing-qty]').first().inputValue(),'47.5');assert.equal(await p.locator('[data-washing-exec-roll]').first().isChecked(),true)
   await p.locator('[data-washing-exec-roll]').first().uncheck()
   await measure(p,'invalid-send-retains-draft',run,()=>root(p).getByRole('button',{name:'印花交给染厂',exact:true}).click(),async()=>{await p.locator('[data-washing-error]').filter({hasText:'请选择'}).waitFor();assert.equal((await orders(p))[0].rolls[0].sentAt,undefined);assert.equal(await p.locator('[data-washing-qty]').first().inputValue(),'47.5')})
   await selectFirst(p);await clickSave(p,'印花交给染厂',o=>!!o.rolls[0].sentAt,run);if(run===1)sentFixture=await p.evaluate(()=>window.washTabRecords())
   const pos=await p.locator('[data-washing-position] option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));await selectFirst(p);await p.locator('[data-washing-position]').selectOption(pos.find(o=>o.value&&o.label.includes('GTG')&&o.label.includes('A-01-01')).value);await p.locator('[data-washing-qty]').first().fill('50');await clickSave(p,'登记逐卷实收',o=>o.rolls[0].receivedQty===50,run)
   await selectFirst(p);await clickSave(p,'投入洗水',o=>!!o.rolls[0].startedAt,run)
   await selectFirst(p);await p.locator('[data-washing-qty]').first().fill('49');await p.locator('[data-washing-output-code]').first().fill('TAB-REPACK-'+run);await p.locator('[data-washing-difference]').check();await switchTab(p,'交接记录');await switchTab(p,'加工执行');assert.equal(await p.locator('[data-washing-output-code]').first().inputValue(),'TAB-REPACK-'+run);await clickSave(p,'登记实际产出',o=>o.rolls[0].outputQty===49&&o.rolls[0].outputBarcode==='TAB-REPACK-'+run,run)
   await selectFirst(p);await scan(p,'TAB-REPACK-'+run);await clickSave(p,'交回原接收方',o=>!!o.rolls[0].handedOutAt,run)
   await selectFirst(p);await p.locator('[data-washing-qty]').first().fill('49');const targetPos=pos.find(o=>o.value&&o.label.includes('全能力测试工厂')&&o.label.includes('A-01-01'));await p.locator('[data-washing-position]').selectOption(targetPos.value);await clickSave(p,'登记下游实收',o=>o.rolls[0].downstreamQty===49,run)
   await switchTab(p,'交接记录');assert.match(await p.getByRole('tabpanel').innerText(),/TAB-REPACK/);assert.match(await p.getByRole('tabpanel').innerText(),/49 Yard/);assert.match(await p.getByRole('tabpanel').innerText(),/尚未交出/)
   await p.reload();await root(p).waitFor();assert.equal((await orders(p))[0].rolls[0].downstreamQty,49);assert.match(await root(p).innerText(),/下游已实收/)
   if(run===1){completedFixture=await p.evaluate(()=>window.washTabRecords());for(const label of ['加工执行','基本信息','交接记录','操作日志','打印']){await switchTab(p,label);await p.screenshot({path:out+'/'+label+'-1366.png',fullPage:true})}}
   return {rolls:6,partialOutput:49,repacked:true,draftNodeRetained:true,allViewsReadOnly:true}
  }finally{await c.close()}
 })
 for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768}])await check('responsive views and real image '+viewport.width,async()=>{
  const c=await browser.newContext({viewport,timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,completedFixture)
  try{await p.goto(base+href);await root(p).waitFor();for(const label of ['加工执行','基本信息','交接记录','操作日志','打印']){await switchTab(p,label);await p.evaluate(()=>window.washTabReady());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await p.getByRole('tabpanel').isVisible(),true);await p.screenshot({path:out+'/'+label+'-'+viewport.width+'.png',fullPage:true})}
   await root(p).getByRole('button',{name:'查看蓝白碎花棉府绸大图',exact:true}).click();await p.locator('[data-washing-image-overlay]').waitFor();await p.locator('[data-washing-image-overlay]').press('Escape');await p.locator('[data-washing-image-overlay]').waitFor({state:'detached'});return viewport
  }finally{await c.close()}
 })
 if(process.env.WASH_LEGACY_FIXTURE){
  const raw=readFileSync(process.env.WASH_LEGACY_FIXTURE),legacy=JSON.parse(raw)
  report.legacyFixture={path:process.env.WASH_LEGACY_FIXTURE,sha256:createHash('sha256').update(raw).digest('hex'),orders:legacy.records.filter(r=>r.value.kind==='orders').length}
  assert.equal(report.legacyFixture.orders,36)
  // This isolated compatibility fixture must remain genuinely legacy even when
  // the domain checker regenerated its source using the current create rule.
  for(const record of legacy.records)if(record.value.kind==='orders'){record.value.data.acceptance='PENDING';delete record.value.data.acceptedAt}
  report.legacyFixture.transform='36 isolated orders set to historical PENDING; no fixture file or user data is modified'
  for(let run=1;run<=runs;run++)await check('36 legacy pending orders list without acceptance tasks '+run,async()=>{
   const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,legacy.records)
   try{
    const before=await p.evaluate(()=>window.washTabRecords())
    await measure(p,'cold-36-legacy-pending-list',run,()=>p.goto(base+washPath,{waitUntil:'domcontentloaded'}),async()=>{await p.getByRole('heading',{name:'洗水加工单 · 36 条',exact:true}).waitFor();assert.match(await p.locator('[data-washing-list-root]').innerText(),/待印花交出\s*36/);assert.doesNotMatch(await p.locator('[data-washing-list-root]').innerText(),/待接单/);assert.equal(await p.locator('table tbody tr').count(),10)},true)
    assert.deepEqual(await p.evaluate(()=>window.washTabRecords()),before,'List reading must not migrate saved legacy orders')
    if(run===1)await p.screenshot({path:out+'/legacy-list-36.png',fullPage:true});return {orders:36,notRewritten:true}
   }finally{await c.close()}
  })
 }
 await check('historical states remain read-only without the four actions',async()=>{
  for(const status of ['UNASSIGNED','PENDING','REJECTED','EXCEPTION','CANCELLED','COMPLETED']){
   const rows=structuredClone(fixture),record=rows.find(r=>r.value.kind==='orders'),o=record.value.data
   if(status==='UNASSIGNED'){delete o.assignedFactoryId;delete o.assignedFactoryName;o.acceptance='UNASSIGNED'}
   else if(status==='PENDING'){o.acceptance='PENDING'}
   else if(status==='REJECTED'){o.acceptance='REJECTED';o.rejectionReason='历史拒单事实'}
   else if(status==='EXCEPTION'){o.exception='历史异常事实'}
   else if(status==='CANCELLED'){o.cancelledAt=o.createdAt}
   else{o.acceptance='ACCEPTED';o.acceptedAt=o.createdAt;o.completedAt=o.createdAt;for(const r of o.rolls)Object.assign(r,{sentAt:o.createdAt,receivedAt:o.createdAt,receivedQty:50,startedAt:o.createdAt,completedAt:o.createdAt,outputQty:49,handedOutAt:o.createdAt,downstreamReceivedAt:o.createdAt,downstreamQty:49})}
   const c=await browser.newContext({viewport:{width:1280,height:720},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,rows)
   try{await p.goto(base+href);await root(p).waitFor();for(const name of ['接单','作废本单','拒单','登记异常'])assert.equal(await root(p).getByRole('button',{name,exact:true}).count(),0)
    assert.deepEqual((await orders(p))[0],o,'Opening historical orders must not rewrite them')
    if(status==='UNASSIGNED')assert.equal(await root(p).getByRole('button',{name:'交由 GTG 承接',exact:true}).isVisible(),true)
    if(status==='PENDING')assert.equal(await root(p).getByRole('button',{name:'印花交给染厂',exact:true}).isVisible(),true)
    if(status==='COMPLETED'){await switchTab(p,'交接记录');assert.doesNotMatch(await p.getByRole('tabpanel').innerText(),/尚未/)}
    await p.screenshot({path:out+'/'+status+'-1280.png',fullPage:true})
   }finally{await c.close()}
  }return {legacyPreserved:true,completedReadOnly:true,unsupportedActionsAbsent:true}
 })
 for(let run=1;run<=runs;run++)await check('PDA executes without acceptance '+run,async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});await init(c);const p=await nativeSeed(c,sentFixture)
  try{
   await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号',exact:true}).fill('ID-F003_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.getByRole('button',{name:'打开账号信息',exact:true}).waitFor()
   await measure(p,'PDA-six-roll-detail-after-login',run,()=>p.goto(base+'/fcs/pda/washing/'+orderId,{waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)
   assert.equal(await p.getByRole('tab',{name:'加工执行',exact:true}).count(),0)
   for(const name of ['接单','作废本单','拒单','登记异常'])assert.equal(await root(p).getByRole('button',{name,exact:true}).count(),0)
   await selectFirst(p);await p.locator('[data-washing-qty]').first().fill('50');const positions=await p.locator('[data-washing-position] option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));await p.locator('[data-washing-position]').selectOption(positions.find(o=>o.value&&o.label.includes('GTG')&&o.label.includes('A-01-01')).value)
   await measure(p,'PDA-receive-without-acceptance',run,()=>clickSave(p,'登记逐卷实收',o=>o.rolls[0].receivedQty===50),async()=>{assert.equal((await orders(p))[0].acceptedAt,undefined)})
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(run===1)await p.screenshot({path:out+'/PDA-390.png',fullPage:true});return {width:390,noAcceptanceEvent:true,received:50}
  }finally{await c.close()}
 })
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1}
finally{
 report.families=Object.fromEntries(Object.entries(Object.groupBy(report.samples,s=>s.family)).map(([k,v])=>[k,{count:v.length,maxMs:Math.max(...v.map(s=>s.ms))}]))
 report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.result==='PASS').length,samples:report.samples.length,maxMs:report.samples.length?Math.max(...report.samples.map(s=>s.ms)):null,slow:report.samples.filter(s=>s.ms>1000),pageErrors:report.errors.length}
 if(formal&&(Object.values(report.families).some(f=>f.count<5)||report.summary.slow.length||report.errors.length))process.exitCode=1
 writeFileSync(out+'/report-'+stamp+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));await browser.close()
}
