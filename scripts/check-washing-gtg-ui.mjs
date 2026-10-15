import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,appendFileSync,readFileSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43159'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'This checker only writes isolated local prototype fixtures')
const runs=Number(process.env.WASH_UI_RUNS||5),formal=process.env.WASH_UI_MODE==='formal',section=process.env.WASH_UI_SECTION||'all'
const out='output/playwright/washing-gtg-v1.3',stamp=new Date().toISOString().replaceAll(':','-')
mkdirSync(out,{recursive:true})
const changed=[...new Set([...execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')])].filter(p=>/^(src|scripts|tests)\//.test(p))
const report={at:new Date().toISOString(),base,mode:formal?'fixed-build acceptance':'diagnostic calibration',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(changed.sort().map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),environment:{node:process.version,timezone:'Asia/Shanghai',nativePrintingOrders:77,heavyWashingOrders:36,webViewport:'1366x768 and 1024x768 for heavy list',pdaViewport:'390x844',cold:'New isolated browser context; no application assets loaded during native fixture setup; no prewarming'},checks:[],samples:[],errors:[]}
report.section=section
report.runtimeAssets=existsSync('output/washing-gtg-v1.3/runtime-assets.json')?JSON.parse(readFileSync('output/washing-gtg-v1.3/runtime-assets.json','utf8')):null
if(formal)assert.ok(report.runtimeAssets&&report.runtimeAssets.files['index.html'],'Fixed production asset identity is required')
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const printPath='/fcs/craft/printing/work-orders',washPath='/fcs/craft/dyeing/washing/work-orders'
const prod='PWO-WASH-DEMO-PRODUCTION-DONE',purchase='PWO-WASH-DEMO-PURCHASE-DONE'
async function init(c){
 await c.addInitScript(()=>{
  window.washingStart=0
  for(const type of ['pointerdown','keydown','change','input'])document.addEventListener(type,()=>{if(!window.washingStart)window.washingStart=performance.now()},true)
  window.washingRecords=()=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('higood-pcs-records')
   request.onerror=()=>reject(request.error)
   request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('records','readonly'),query=tx.objectStore('records').getAll()
    let rows=[]
    query.onsuccess=()=>{rows=query.result.filter(row=>row.collection==='fcs.fabric-washing.v1')}
    tx.oncomplete=()=>{db.close();resolve(rows)}
    tx.onabort=()=>reject(tx.error)
   }
  })
  window.washingReady=async()=>{await document.fonts.ready;for(const i of document.querySelectorAll('img')){const r=i.getBoundingClientRect();if(r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0){if(!i.complete)await i.decode();if(!i.naturalWidth)throw new Error('Visible object image unavailable: '+i.alt)}}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()}
 })
 c.on('page',p=>{p.setDefaultTimeout(6000);p.on('pageerror',e=>report.errors.push(e.message))})
}
async function measure(p,family,run,action,complete,nav=false){
 await p.evaluate(()=>window.washingStart=0)
 await action();await complete()
 const end=await p.evaluate(()=>window.washingReady()),start=await p.evaluate(nav=>performance.timeOrigin+(nav?0:window.washingStart),nav)
 assert.ok(nav||await p.evaluate(()=>window.washingStart>0),'No real input event start')
 const sample={family,run,ms:end-start,status:end-start<=1000?'PASS':'FAIL',start:nav?'navigationStart':'captured pointer/key/input/change',complete:'correct result, visible necessary images, fonts and two animation frames; save includes native durable readback'}
 report.samples.push(sample);appendFileSync(out+'/samples-'+stamp+'.jsonl',JSON.stringify(sample)+'\n');console.log(sample.status,family,sample.ms.toFixed(2))
}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'PASS',detail});console.log('PASS',name)}catch(error){report.checks.push({name,status:'FAIL',error:error.stack});throw error}}
const root=p=>p.locator('[data-washing-order]')
const row=(p,id)=>p.locator('[data-printing-row-actions="'+id+'"]')
const orders=async p=>(await p.evaluate(()=>window.washingRecords())).filter(r=>r.value.kind==='orders').map(r=>r.value.data)
async function filter(p,text='PH-WASH'){await p.getByRole('textbox',{name:'综合查询',exact:true}).fill(text);await p.getByRole('button',{name:'查询',exact:true}).click();await p.getByRole('checkbox',{name:'选择 PH-WASH-1-A',exact:true}).waitFor()}
async function create(p,id,index,feel,run,family){
 await row(p,id).getByRole('button',{name:'发起洗水',exact:true}).click()
 const dialog=p.getByRole('dialog',{name:'发起洗水',exact:true});await dialog.waitFor()
 assert.equal(await dialog.locator('[data-washing-context],[data-washing-context-role],[data-washing-context-factory]').count(),0)
 for(const box of await dialog.locator('[data-washing-judge-roll]:not(:disabled)').all())await box.uncheck()
 await dialog.locator('[data-washing-judge-roll="'+id+'-R'+index+'"]').check()
 await dialog.locator('[data-washing-feel]').selectOption(feel)
 let href
 await measure(p,family,run,()=>dialog.getByRole('button',{name:'创建洗水加工单',exact:true}).click(),async()=>{const result=dialog.getByRole('link',{name:'查看洗水加工单',exact:true});await result.waitFor();href=await result.getAttribute('href');const record=(await orders(p)).find(o=>href.endsWith('/'+o.id));assert.ok(record);assert.equal(record.assignedFactoryId,'ID-F003');assert.equal(record.acceptance,'PENDING');assert.equal(record.handFeel,feel)})
 await measure(p,'close-and-local-row-update',run,()=>dialog.locator('footer').getByRole('button',{name:'关闭',exact:true}).click(),async()=>{await dialog.waitFor({state:'detached'});await row(p,id).locator('[data-printing-washing-status]').waitFor();assert.match(await row(p,id).locator('xpath=ancestor::tr').locator('[data-printing-downstream]').innerText(),/GTG/);assert.equal(await row(p,id).getByRole('link',{name:/查看洗水加工单/}).first().getAttribute('target'),'_blank')})
 return href
}
async function scan(p,code){await p.locator('[data-washing-scan]').fill(code);await root(p).getByRole('button',{name:'核对卷码',exact:true}).click();await p.locator('[data-washing-scans]').filter({hasText:code}).waitFor()}
async function select(p,qty){await p.locator('[data-washing-exec-roll]').check();if(qty!==undefined)await p.locator('[data-washing-qty]').fill(String(qty))}
async function position(p,factory){const opts=await p.locator('[data-washing-position] option').evaluateAll(es=>es.map(e=>({value:e.value,text:e.textContent})));const selected=opts.find(o=>o.value&&o.text.includes(factory)&&o.text.includes('A-01-01'));assert.ok(selected,'Missing real '+factory+' position');await p.locator('[data-washing-position]').selectOption(selected.value)}
async function action(p,label,family,run,expected){
 const saved={'接单':'染厂接单','印花交给染厂':'印花方交出','登记逐卷实收':'染厂实际接收','投入洗水':'投入洗水','登记实际产出':'登记实际产出','交回原接收方':'交回原接收方','登记下游实收':'下游实际接收','人工完单':'人工完单'}[label]
 await measure(p,family,run,()=>root(p).getByRole('button',{name:label,exact:true}).click(),async()=>{await p.locator('[data-washing-result]').filter({hasText:'已保存：'+saved}).waitFor();assert.match(await root(p).innerText(),expected);const all=await orders(p);assert.ok(all.length>0)})
}
async function load(p,url,family,run){await measure(p,family,run,()=>p.goto(base+url,{waitUntil:'domcontentloaded'}),()=>root(p).waitFor(),true)}
async function login(p){await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号',exact:true}).fill('ID-F003_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.getByRole('button',{name:'打开账号信息',exact:true}).waitFor()}

try{
 if(section!=='list')for(let run=1;run<=runs;run++)await check('GTG flow, routes and original downstream '+run,async()=>{
  const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'});await init(c);const p=await c.newPage()
  try{
   await p.goto(base+printPath,{waitUntil:'domcontentloaded'});await p.locator('[data-printing-work-orders-root]').waitFor();await filter(p)
   const first=await create(p,prod,1,'增厚蓬松棉手感',run,'create-first-GTG-order')
   const second=await create(p,prod,2,'硬挺手感',run,'create-split-handfeel-order')
   assert.equal(await row(p,prod).getByRole('link',{name:/查看洗水加工单/}).count(),2)
   assert.equal(await p.locator('[data-printing-work-orders-field="receiver"] option[value="GTG"]').count(),1)
   await p.locator('[data-process-filter-toggle]').click()
   await p.locator('[data-printing-work-orders-field="receiver"]').selectOption('GTG')
   await measure(p,'printing-filter-current-GTG-downstream',run,()=>p.getByRole('button',{name:'查询',exact:true}).click(),async()=>{await row(p,purchase).waitFor({state:'detached'});assert.equal(await p.locator('[data-printing-row-actions]').count(),1)})
   await measure(p,'printing-export-current-GTG-downstream',run,async()=>{const download=p.waitForEvent('download');await p.getByRole('button',{name:'导出',exact:true}).click();const file=await download;const stream=await file.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;assert.match(csv,/GTG/);assert.match(csv,/PH-WASH-1-A/);assert.doesNotMatch(csv,/PH-WASH-2-A/)},async()=>{})
   await p.getByRole('button',{name:'重置',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-printing-work-orders-field="keyword"]').value===''&&document.querySelector('[data-printing-work-orders-field="receiver"]').value==='');await filter(p)
   await row(p,prod).getByRole('button',{name:'日志',exact:true}).click();const log=p.getByRole('dialog',{name:'印花操作日志',exact:true});await log.waitFor();const logText=await log.innerText();assert.match(logText,/发起洗水/);assert.match(logText,/Web 端操作员/);assert.match(logText,/增厚蓬松棉手感/);assert.match(logText,/硬挺手感/);assert.doesNotMatch(logText,/\d{2}:\d{2}:\d{2}\.\d{3}Z/)
   if(run===1)await p.screenshot({path:out+'/printing-initiation-log.png'})
   await log.locator('footer').getByRole('button',{name:'取消',exact:true}).click()
   await p.evaluate(()=>window.washingStart=0)
   const popupPromise=p.waitForEvent('popup')
   await row(p,prod).locator('[href="'+first+'"]').click()
   const detail=await popupPromise;await root(detail).waitFor()
   const popupStart=await p.evaluate(()=>performance.timeOrigin+window.washingStart),popupEnd=await detail.evaluate(()=>window.washingReady())
   const popupSample={family:'new-window-order-detail',run,ms:popupEnd-popupStart,status:popupEnd-popupStart<=1000?'PASS':'FAIL'};report.samples.push(popupSample);appendFileSync(out+'/samples-'+stamp+'.jsonl',JSON.stringify(popupSample)+'\n')
   assert.equal(new URL(detail.url()).pathname,first);assert.equal(new URL(p.url()).pathname,printPath);assert.equal(await detail.locator('[data-washing-context]').count(),0)
   for(const title of ['加工单/商品','加工投入/上游','加工要求','处理进度','加工产出/下游','时间','数量'])assert.ok(await root(detail).getByRole('heading',{name:title,exact:true}).count())
   assert.match(await root(detail).locator('[data-washing-info="output"]').innerText(),/全能力测试工厂/)
   assert.equal(await detail.locator('[data-washing-assign-factory]').count(),0)
   const tech=await c.newPage()
   await measure(tech,'direct-technical-package-load',run,()=>tech.goto(base+'/pcs/products/styles/style_demand_SPU_2024_009/technical-data/tdv_demand_SPU_2024_009',{waitUntil:'domcontentloaded'}),()=>tech.getByRole('button',{name:'工艺路线',exact:true}).waitFor(),true)
   await measure(tech,'technical-package-actual-route',run,()=>tech.getByRole('button',{name:'工艺路线',exact:true}).click(),async()=>{await tech.locator('[data-actual-washing-route]').waitFor();assert.equal(await tech.locator('[data-actual-washing-order]').count(),2);assert.match(await tech.locator('[data-actual-washing-route]').innerText(),/洗水 · GTG/);assert.ok((await orders(tech)).length===2)})
   await measure(tech,'production-snapshot-actual-route',run,()=>tech.goto(base+'/fcs/production/orders/PO-202603-0003/tech-pack?tab=process',{waitUntil:'domcontentloaded'}),async()=>{await tech.locator('[data-actual-washing-route]').waitFor();assert.equal(await tech.locator('[data-actual-washing-order]').count(),2)},true)
   await tech.goto(base+'/pcs/products/styles/style_demand_SPU_2024_010/technical-data/tdv_demand_SPU_2024_010');await tech.getByRole('button',{name:'工艺路线',exact:true}).click();await tech.locator('[data-testid="tech-pack-three-stage-route"]').waitFor();assert.equal(await tech.locator('[data-actual-washing-order]').count(),0)
   await tech.close()
   await load(detail,second,'GTG-rejection-order-load',run)
   await measure(detail,'GTG-rejection-confirm-open',run,()=>detail.getByRole('button',{name:'拒单',exact:true}).click(),()=>detail.locator('[data-washing-reason]').waitFor())
   await detail.locator('[data-washing-reason]').fill('与现场核对后重新安排 GTG 接单')
   await measure(detail,'GTG-rejection-save',run,()=>detail.getByRole('button',{name:'确认拒单',exact:true}).click(),async()=>{await detail.getByRole('button',{name:'重新交由 GTG 承接',exact:true}).waitFor();assert.equal((await orders(detail)).find(o=>second.endsWith('/'+o.id)).acceptance,'REJECTED')})
   await measure(detail,'GTG-rejection-resubmit',run,()=>detail.getByRole('button',{name:'重新交由 GTG 承接',exact:true}).click(),async()=>{await detail.getByRole('button',{name:'接单',exact:true}).waitFor();const record=(await orders(detail)).find(o=>second.endsWith('/'+o.id));assert.equal(record.acceptance,'PENDING');assert.equal(record.assignedFactoryId,'ID-F003')})
   const pda=await c.newPage();await pda.setViewportSize({width:390,height:844});await login(pda)
   async function lifecycle(href,code,central){
    const id=href.split('/').at(-1),pdaPath='/fcs/pda/washing/'+id,variant=central?'-warehouse':'-factory'
    await load(pda,pdaPath,'PDA-washing-detail-load'+variant,run);assert.equal(await pda.locator('[data-washing-context]').count(),0)
    await action(pda,'接单','PDA-GTG-accept'+variant,run,/已接单待来货/)
    await load(detail,href,'web-detail-refresh'+variant,run);await select(detail);await scan(detail,code);await action(detail,'印花交给染厂','web-print-site-send'+variant,run,/印花已交出/)
    await pda.reload();await root(pda).waitFor();await select(pda,50);await position(pda,'GTG');await scan(pda,code);await action(pda,'登记逐卷实收','PDA-GTG-physical-receive'+variant,run,/染厂实收 50 Yard/)
    await select(pda);await action(pda,'投入洗水','PDA-GTG-start'+variant,run,/洗水加工中/)
    await select(pda,49);await pda.locator('[data-washing-difference]').check();await action(pda,'登记实际产出','PDA-GTG-output'+variant,run,/加工产出 49 Yard/)
    await select(pda);await scan(pda,code);await action(pda,'交回原接收方','PDA-GTG-handout'+variant,run,/已交回待实收/)
    await detail.reload();await root(detail).waitFor();await select(detail,49);await scan(detail,code)
    if(central)await detail.locator('[data-washing-central-location]').fill('A-01-01');else await position(detail,'全能力测试工厂')
    await action(detail,'登记下游实收',central?'original-warehouse-receive':'original-factory-receive',run,/下游实收[： ]49 Yard/)
    await pda.reload();await root(pda).waitFor();await action(pda,'人工完单','PDA-GTG-manual-complete'+variant,run,/已人工完成/)
    await measure(detail,'washing-print-order'+variant,run,()=>detail.getByRole('button',{name:'洗水加工单预览',exact:true}).click(),()=>detail.locator('[data-washing-print-document]').waitFor())
    assert.match(await detail.locator('[data-washing-print-document]').innerText(),/GTG/);assert.match(await detail.locator('[data-washing-print-document]').innerText(),central?/面料中央仓/:/全能力测试工厂/)
    await measure(detail,'washing-print-transfer'+variant,run,()=>detail.getByRole('button',{name:'交接与卷标预览',exact:true}).click(),()=>detail.locator('[data-real-barcode]').waitFor());assert.equal(await detail.locator('[data-real-barcode]').count(),1)
    const record=(await orders(detail)).find(o=>o.id===id);assert.equal(record.rolls[0].downstreamQty,49);assert.equal(record.assignedFactoryId,'ID-F003');assert.equal(record.source.target.id,central?'WH-FABRIC-001':'F090')
    if(run===1&&!central){await detail.screenshot({path:out+'/washing-print-transfer.png',fullPage:true});await pda.screenshot({path:out+'/PDA-completed.png',fullPage:true})}
   }
   await lifecycle(first,'WS-1-R1',false)
   const third=await create(p,purchase,1,'柔软手感',run,'create-original-warehouse-order')
   await lifecycle(third,'WS-3-R1',true)
   const none='PWO-WASH-DEMO-SUPPLEMENT-DONE'
   await row(p,none).getByRole('button',{name:'发起洗水',exact:true}).click();await p.getByRole('button',{name:'不需要洗水',exact:true}).click();await p.locator('[data-washing-result]').filter({hasText:'不需要洗水'}).waitFor();await p.locator('[data-printing-dialog-panel] footer').getByRole('button',{name:'关闭',exact:true}).click();assert.equal(await row(p,none).locator('[data-printing-washing-status],[data-printing-washing-link]').count(),0)
   await p.reload();await p.locator('[data-printing-work-orders-root]').waitFor();await filter(p);assert.equal(await row(p,prod).getByRole('link',{name:/查看洗水加工单/}).count(),2);assert.equal((await orders(p)).length,3)
   await pda.close();await detail.close()
   return {orders:3,splitLinks:2,GTG:'ID-F003',factoryDownstream:'F090',warehouseDownstream:'WH-FABRIC-001',savedQuantities:[50,49,49],secondPending:second}
  }finally{await c.close()}
 })
 const backup=JSON.parse(readFileSync('output/washing-gtg-v1.3/benchmark-36-orders.json','utf8'))
 assert.equal(backup.records.filter(r=>r.value.kind==='orders').length,36);assert.equal(backup.files.length,0)
 if(section!=='main')for(const viewport of [{width:1366,height:768},{width:1024,height:768}])for(let run=1;run<=runs;run++)await check('36 valid washing orders '+viewport.width+' / '+run,async()=>{
  const c=await browser.newContext({viewport,timezoneId:'Asia/Shanghai'});await init(c);const p=await c.newPage()
  try{
   await c.route('**/__wash_fixture_setup__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated washing fixture</title>'}))
   await p.goto(base+'/__wash_fixture_setup__')
   await p.evaluate(async rows=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('higood-pcs-records',2);r.onupgradeneeded=()=>{const db=r.result;for(const name of ['records','files','operations','meta'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});const ops=r.transaction.objectStore('operations');if(!ops.indexNames.contains('createdAt'))ops.createIndex('createdAt','createdAt')};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readwrite');for(const row of rows)tx.objectStore('records').put(row);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)}})},backup.records)
   await c.unroute('**/__wash_fixture_setup__')
   await measure(p,'cold-36-order-list-'+viewport.width,run,()=>p.goto(base+washPath,{waitUntil:'domcontentloaded'}),()=>p.getByRole('heading',{name:'洗水加工单 · 36 条',exact:true}).waitFor(),true)
   assert.equal(await p.locator('[data-washing-context]').count(),0);assert.equal(await p.locator('table tbody tr').count(),10)
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   for(const label of ['加工单/商品','加工投入/上游','加工要求','处理进度','加工产出/下游','时间','数量'])assert.ok((await p.locator('thead').innerText()).includes(label))
   await measure(p,'washing-pagination-'+viewport.width,run,()=>p.getByRole('button',{name:'下一页',exact:true}).click(),async()=>{await p.locator('[data-washing-list-root] footer p').filter({hasText:'当前 11-20'}).waitFor();assert.equal(await p.locator('table tbody tr').count(),10)})
   await p.getByRole('button',{name:'重置',exact:true}).click();await p.locator('[data-washing-list-root] footer p').filter({hasText:'当前 1-10'}).waitFor()
   await p.locator('[data-washing-filter="handFeel"]').selectOption('柔软手感')
   await measure(p,'washing-filter-'+viewport.width,run,()=>p.getByRole('button',{name:'查询',exact:true}).click(),async()=>{await p.getByRole('heading',{name:'洗水加工单 · 24 条',exact:true}).waitFor();assert.equal((await orders(p)).length,36)})
   await p.getByRole('button',{name:'重置',exact:true}).click();await p.getByRole('heading',{name:'洗水加工单 · 36 条',exact:true}).waitFor()
   const sort=p.locator('[data-fabric-washing-action="sort-column"][data-column-key="order"]')
   for(const direction of ['asc','desc','none'])await measure(p,'washing-sort-'+viewport.width,run,()=>sort.click(),()=>sort.locator('[data-standard-list-sort-icon="'+direction+'"]').waitFor())
   await measure(p,'washing-columns-open-'+viewport.width,run,()=>p.getByRole('button',{name:'列设置',exact:true}).click(),()=>p.getByText('洗水列表列设置',{exact:true}).waitFor())
   const visible=p.locator('[data-fabric-washing-action="toggle-column-visibility"][data-fabric-washing-column-key="progress"]')
   for(const checked of [false,true])await measure(p,'washing-column-visibility-'+viewport.width,run,()=>visible.click(),()=>p.waitForFunction(checked=>document.querySelector('[data-fabric-washing-action="toggle-column-visibility"][data-fabric-washing-column-key="progress"]').checked===checked,checked))
   const frozen=p.locator('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="input"]')
   await measure(p,'washing-column-freeze-'+viewport.width,run,()=>frozen.click(),()=>p.waitForFunction(()=>document.querySelector('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="input"]').checked))
   await measure(p,'washing-column-reorder-'+viewport.width,run,()=>p.locator('[draggable="true"][data-fabric-washing-column-key="qty"]').dragTo(p.locator('[draggable="true"][data-fabric-washing-column-key="input"]')),()=>p.waitForFunction(()=>{const rows=[...document.querySelectorAll('[draggable="true"][data-fabric-washing-column-key]')].map(el=>el.dataset.fabricWashingColumnKey);return rows.indexOf('qty')<rows.indexOf('input')}))
   await measure(p,'washing-column-restore-'+viewport.width,run,()=>p.locator('[data-fabric-washing-action="restore-column-settings"]').click(),()=>p.waitForFunction(()=>!document.querySelector('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="input"]').checked))
   await measure(p,'washing-columns-close-'+viewport.width,run,()=>p.getByRole('button',{name:'关闭',exact:true}).click(),()=>p.getByText('洗水列表列设置',{exact:true}).waitFor({state:'detached'}))
   await measure(p,'washing-page-size-36-'+viewport.width,run,()=>p.locator('[data-fabric-washing-field="pageSize"]').selectOption('50'),()=>p.waitForFunction(()=>document.querySelectorAll('[data-washing-list-root] tbody tr').length===36))
   if(run===1)await p.screenshot({path:out+'/washing-list-'+viewport.width+'.png',fullPage:true})
   await p.evaluate(()=>localStorage.setItem('/fcs/craft/dyeing/washing/work-orders:columns',JSON.stringify({order:['material','source','handFeel','factory','qty','status','action'],visibleKeys:['material','source','handFeel','factory','qty','status','action'],frozenKeys:[],pageSize:20})))
   await measure(p,'legacy-column-preference-load-'+viewport.width,run,()=>p.reload({waitUntil:'domcontentloaded'}),async()=>{await p.getByRole('heading',{name:'洗水加工单 · 36 条',exact:true}).waitFor();assert.equal(await p.locator('table tbody tr').count(),20);for(const label of ['加工单/商品','加工投入/上游','加工要求','处理进度','加工产出/下游','时间','数量'])assert.ok((await p.locator('thead').innerText()).includes(label))},true)
   return {rows:36,pageSize:10,filtered:24,viewport,nativeFixture:true}
  }finally{await c.close()}
 })
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1}
finally{
 report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length,samples:report.samples.length,maxMs:report.samples.length?Math.max(...report.samples.map(s=>s.ms)):null,slow:report.samples.filter(s=>s.ms>1000),pageErrors:report.errors.length}
 const groups=Object.groupBy(report.samples,s=>s.family);report.families=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{samples:v.length,maxMs:Math.max(...v.map(s=>s.ms))}]))
 if(formal&&(report.samples.some(s=>s.ms>1000)||Object.values(report.families).some(f=>f.samples<5)))process.exitCode=1
 if(report.errors.length)process.exitCode=1
 writeFileSync(out+'/report-'+stamp+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));await browser.close()
}

