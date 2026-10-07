import {chromium} from 'playwright'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const server=process.env.PF_CHECK_URL||'http://127.0.0.1:4179',route='/dds/supply-chain/production-fulfillment/tasks/DEM-202603-0001',out='output/playwright/dds-review-v1'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),samples=[],checks=[],errors=[]
let completedIterations=0,completed=false
const ready=[{selector:'.pf-task-identity',text:'SPU-2024-001'},{selector:'.pf-latest-followup',notText:'读取中'}]
async function settle(page,start,expectations){return page.evaluate(async({start,expectations})=>{
 const valid=()=>expectations.every(e=>{const el=document.querySelector(e.selector);if(e.absent)return !el;return el&&(!e.text||el.textContent.includes(e.text))&&(!e.notText||!el.textContent.includes(e.notText))&&(!e.attr||el.getAttribute(e.attr[0])===e.attr[1])&&(!e.value||el.value===e.value)})
 return await new Promise(resolve=>{const tick=()=>{if(performance.now()-start>10000){resolve({ms:performance.now()-start,ready:false});return}if(!valid()){requestAnimationFrame(tick);return}requestAnimationFrame(()=>{if(!valid()){requestAnimationFrame(tick);return}const imgs=[...document.querySelectorAll('#pf-content img,#pf-overlays img')].filter(i=>i.getClientRects().length);if(imgs.some(i=>!i.complete)){requestAnimationFrame(tick);return}resolve({ms:performance.now()-start,ready:true,images:imgs.map(i=>({src:i.src,loaded:i.naturalWidth>0}))})})};requestAnimationFrame(tick)})
 },{start,expectations})}
async function act(page,name,selector,{value,event='click',expectations=[]}={}){
 await page.evaluate(event=>{window.ddsEventStart=undefined;document.addEventListener(event,e=>{window.ddsEventStart=e.timeStamp>1e12?e.timeStamp-performance.timeOrigin:e.timeStamp},{once:true,capture:true})},event==='change'?'input':event)
 if(event==='input')await page.locator(selector).fill(value)
 else if(event==='change')await page.locator(selector).selectOption(value)
 else if(event==='keydown')await page.keyboard.press(value)
 else await page.locator(selector).click()
 const start=await page.evaluate(()=>window.ddsEventStart)
 assert.equal(typeof start,'number',name+' missing start')
 const result=await settle(page,start,expectations)
 if(!result.ready)result.feedback=await page.locator('#pf-overlays').innerText().catch(()=>'(overlay unavailable)')
 samples.push({case:name,...result});assert(result.ready,name+' not ready');assert(result.ms<=1000,name+' exceeded 1000ms: '+result.ms)
}
const tab=(value,action='detail-subtab')=>`[data-pf-action="${action}"][data-value="${value}"]`
async function open(page,value){await act(page,'subtab-'+value,tab(value),{expectations:[{selector:tab(value),attr:['aria-selected','true']}]})}
async function close(page,name='dialog-close'){await act(page,name,'#pf-overlays .pf-overlay-header [data-pf-action="close"]',{expectations:[{selector:'#pf-overlays [role=dialog]',absent:true}]})}
async function stored(page){return page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('higood-dds-followups');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});const tx=db.transaction(['followups','forecasts','forecast-events']);const read=name=>new Promise(r=>{const q=tx.objectStore(name).getAll();q.onsuccess=()=>r(q.result)});const result={followups:await read('followups'),forecasts:await read('forecasts'),events:await read('forecast-events')};db.close();return result})}
try{
 for(let iteration=1;iteration<=(process.env.DDS_CHECK_FAULT_ONLY?0:5);iteration++){
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page)
  page.on('pageerror',error=>errors.push({iteration,error:String(error)}));await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache')
  await page.goto(server+route,{waitUntil:'domcontentloaded'});samples.push({case:'cold',iteration,...await settle(page,0,ready)})
  assert.equal(await page.locator('.pf-business-stage').count(),9)
  assert((await page.locator('.pf-detail-summary').innerText()).includes('2026-04-15'))
  assert(!(await page.locator('.pf-detail-summary').innerText()).includes('应发'))
  assert.equal(await page.locator('.pf-business-status').count(),1)
  let state=await stored(page);assert.equal(state.followups.length,0);assert.equal(state.forecasts.length,0)
  checks.push({iteration,case:'initial-no-seed-write',pass:true})
  if(iteration===1)await page.screenshot({path:out+'/overview-1366.png'})
  await page.reload({waitUntil:'domcontentloaded'});samples.push({case:'refresh',iteration,...await settle(page,0,ready)})
  await act(page,'route-to-list','[data-pf-action=navigate][data-path$="/tasks"]',{expectations:[{selector:'[data-pf-table]'}]})
  await act(page,'route-to-detail','a[href="'+route+'"] >> nth=0',{expectations:ready})
  await act(page,'all-gaps','[data-pf-action=show-source-gaps]',{expectations:[{selector:'[data-source-gaps]',attr:['open','']}]})
  await act(page,'gaps-collapse','[data-source-gaps] summary',{expectations:[{selector:'[data-source-gaps]'}]})
  await open(page,'依赖与卡点');assert.equal(await page.locator('.pf-flow-node').count(),29);assert.equal(await page.locator('.pf-flow-waiting').count(),0)
  assert((await page.locator('.pf-flow-node-doc').allTextContents()).some(s=>s.includes('分支 2')))
  for(const zoom of ['0.75','1','1.25'])await act(page,'zoom-'+zoom,`[data-pf-action=dependency-zoom][data-zoom="${zoom}"]`,{expectations:[{selector:`[data-pf-action=dependency-zoom][data-zoom="${zoom}"]`,attr:['aria-pressed','true']}]})
  for(const scope of ['卡点与影响','全部工作'])await act(page,'scope-'+scope,`[data-pf-action=dependency-scope][data-value="${scope}"]`,{expectations:[{selector:scope==='全部工作'?'.pf-flow-node':'.pf-source-empty'}]})
  await act(page,'work-summary','.pf-flow-node:has(.pf-flow-node-head b:text-is("染色")) >> nth=0',{expectations:[{selector:'.pf-document-summary'}]})
  for(const work of ['时效与数量','前后依赖','来源证据','单据简要信息'])await act(page,'work-tab-'+work,tab(work,'work-tab'),{expectations:[{selector:tab(work,'work-tab'),attr:['aria-selected','true']}]})
  await close(page)
  for(const value of ['生产准备','工艺路线','全程甘特'])await open(page,value)
  for(const action of ['expand-all','collapse-all','toggle-dependencies','toggle-children','fit-timeline'])await act(page,'gantt-'+action,`[data-pf-action=${action}]`,{expectations:[{selector:'.pf-gantt'}]})
  for(const [field,values] of [['timeline-mode',['风险工作','关键路径','全部工作']],['timeline-team',['跟单团队','全部']],['timeline-basis',['原始基线','当前标准']],['timeline-scale',['小时','日']]])for(const value of values)await act(page,field+'-'+value,`[data-pf-field=${field}]`,{event:'change',value,expectations:[{selector:`[data-pf-field=${field}]`,value}]})
  for(const value of ['工作明细','数量批次','实际发货与订单','计算与版本','跟进记录','全程时效'])await act(page,'main-tab-'+value,tab(value,'detail-tab'),{expectations:[{selector:tab(value,'detail-tab'),attr:['aria-selected','true']}]})
  await open(page,'业务概览')
  await act(page,'overview-stage','[data-pf-action=overview-stage][data-stage=S03]',{expectations:[{selector:'.pf-gantt'}]});await open(page,'业务概览')
  await act(page,'missing-stage','[data-pf-action=overview-stage][data-stage=S08]',{expectations:[{selector:'#pf-notice',text:'尚未读取'}]});await open(page,'业务概览')
  await act(page,'refresh-source','[data-pf-action=refresh-task]',{expectations:ready})
  await act(page,'followup-open','.pf-detail-utilities [data-pf-action=followup]',{expectations:[{selector:'#pf-overlays form'}]})
  await act(page,'followup-validation','[data-pf-action=save-followup]',{expectations:[{selector:'.pf-form-error',text:'请填写原因'}]})
  for(const [field,value] of [['reason','核实加工实际进度'],['action','联系责任团队确认来源记录 '+iteration]])await act(page,'followup-input-'+field,`[name=${field}]`,{event:'input',value,expectations:[{selector:`[name=${field}]`,value}]})
  await act(page,'followup-save','[data-pf-action=save-followup]',{expectations:[{selector:'#pf-overlays form',absent:true},{selector:'.pf-latest-followup',text:'联系责任团队'}]})
  state=await stored(page);assert.equal(state.followups.length,1)
  assert.equal(await page.evaluate(()=>localStorage.getItem('dds-pf-followups-v1')),null)
  await page.reload({waitUntil:'domcontentloaded'});samples.push({case:'saved-refresh',iteration,...await settle(page,0,[...ready,{selector:'.pf-latest-followup',text:'联系责任团队'}])})
  await act(page,'print-preview','[data-pf-action=print-task]',{expectations:[{selector:'.pf-print-summary',text:'2026-04-15'}]});assert((await page.locator('.pf-print-summary').innerText()).includes('需求 1,500'))
  if(iteration===1)await page.locator('.pf-print-summary').screenshot({path:out+'/print-summary.png'});await close(page,'print-close')
  await act(page,'full-screen','[data-pf-action=fullscreen]',{expectations:[{selector:'.pf-fullscreen'}]});await act(page,'full-screen-exit','[data-pf-action=fullscreen]',{expectations:[{selector:'.pf-fullscreen',absent:true}]})
  await open(page,'工艺路线');await act(page,'work-for-estimate','.pf-flow-node:has(.pf-flow-node-head b:text-is("染色")) >> nth=0',{expectations:[{selector:'.pf-document-summary'}]})
  await act(page,'estimate-open','#pf-overlays [data-pf-action=estimate]',{expectations:[{selector:'[name=expectedAt]'}]})
  for(const [field,value] of [['reason','负责人提供预计'],['action','预计来源已登记'],['expectedAt','2026-12-01T12:00']])await act(page,'estimate-input-'+field,`[name=${field}]`,{event:'input',value,expectations:[{selector:`[name=${field}]`,value}]})
  await act(page,'estimate-save','[data-pf-action=save-followup]',{expectations:[{selector:'#pf-overlays form',absent:true}]});state=await stored(page);assert.equal(state.followups.length,2);assert.equal(state.forecasts.length,1);assert.equal(state.events.length,1)
  await page.reload({waitUntil:'domcontentloaded'});samples.push({case:'forecast-refresh',iteration,...await settle(page,0,ready)})
  await open(page,'工艺路线');await act(page,'forecast-restored-work','.pf-flow-node:has(.pf-flow-node-head b:text-is("染色")) >> nth=0',{expectations:[{selector:'.pf-document-summary'}]})
  await act(page,'forecast-restored-time',tab('时效与数量','work-tab'),{expectations:[{selector:'.pf-work-content',text:'2026-12-01'}]});await close(page)
  checks.push({iteration,case:'atomic-followup-forecast-and-refresh-restoration',pass:true})
  if(iteration===1){
   await page.setViewportSize({width:1280,height:720});await open(page,'业务概览');await page.screenshot({path:out+'/overview-1280.png'})
   const width=await page.locator('#pf-content').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(width.scroll<=width.client+1)
   await page.setViewportSize({width:1366,height:768});await open(page,'依赖与卡点');await page.screenshot({path:out+'/dependencies-1366.png'})
  }
  await context.close();completedIterations++
 }
 // Storage fault checks in a separate context; no user browser data touched.
 for(let faultIteration=1;faultIteration<=5;faultIteration++){
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();await page.goto(server+route);await settle(page,0,ready)
 await act(page,'failure-form-open','.pf-detail-utilities [data-pf-action=followup]',{expectations:[{selector:'#pf-overlays form'}]});await page.locator('[name=reason]').fill('故障保留');await page.locator('[name=action]').fill('输入必须保留')
 await page.evaluate(()=>{window.originalDdsTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const tx=window.originalDdsTransaction.call(this,stores,mode,...rest);if(this.name==='higood-dds-followups'&&mode==='readwrite')queueMicrotask(()=>tx.abort());return tx}})
 await act(page,'transaction-abort','[data-pf-action=save-followup]',{expectations:[{selector:'.pf-form-error',text:'中止'}]});assert.equal(await page.locator('[name=action]').inputValue(),'输入必须保留');assert.equal((await stored(page)).followups.length,0)
 await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.originalDdsTransaction})
 await act(page,'save-retry','[data-pf-action=save-followup]',{expectations:[{selector:'#pf-overlays form',absent:true}]});assert.equal((await stored(page)).followups.length,1)
 checks.push({case:'abort-retains-input-no-false-success-retry',pass:true})
 await page.evaluate(()=>{const log={id:'legacy-review-1',taskId:'DEM-202603-0001',nodeId:'',author:'验收',at:'2026-10-01T00:00:00+08:00',reason:'旧记录',action:'保留旧记录',expectedAt:'',kind:'跟进记录'};localStorage.setItem('dds-pf-followups-v1',JSON.stringify([log]));localStorage.setItem('dds-pf-forecasts-v1',JSON.stringify([{taskId:'legacy-task',nodeId:'a',endAt:'2099-01-01T12:00:00+08:00'},{taskId:'legacy-task',nodeId:'b',endAt:'2099-01-02T12:00:00+08:00'},{taskId:'legacy-task',nodeId:'a',endAt:'2099-01-03T12:00:00+08:00'}]));localStorage.setItem('unrelated-review-key','keep')})
 await page.reload();await settle(page,0,[{selector:'[data-pf-action=migrate-followups]'}]);assert.equal((await stored(page)).followups.length,1)
 await act(page,'migration-open','[data-pf-action=migrate-followups]',{expectations:[{selector:'[name=closed]'}]})
 await act(page,'migration-guard','[data-pf-action=migrate-followups-confirm]',{expectations:[{selector:'.pf-form-error',text:'关闭其他'}]})
 await page.locator('[name=closed]').check();
 await page.evaluate(()=>{window.originalDdsTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const tx=window.originalDdsTransaction.call(this,stores,mode,...rest);if(this.name==='higood-dds-followups'&&mode==='readwrite')queueMicrotask(()=>tx.abort());return tx}})
 await act(page,'migration-interrupted','[data-pf-action=migrate-followups-confirm]',{expectations:[{selector:'.pf-form-error',text:'中止'}]});assert.notEqual(await page.evaluate(()=>localStorage.getItem('dds-pf-followups-v1')),null);assert.equal((await stored(page)).followups.length,1)
 await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.originalDdsTransaction});await act(page,'migration-commit','[data-pf-action=migrate-followups-confirm]',{expectations:[{selector:'#pf-overlays form',absent:true}]})
 assert.equal((await stored(page)).followups.length,2);assert.equal(await page.evaluate(()=>localStorage.getItem('dds-pf-followups-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-review-key')),'keep')
 assert.deepEqual((await stored(page)).events.map(row=>row.nodeId),['a','b','a'])
 // Forecast optimistic conflict: a second tab writes while this form retains its original reviewed version.
 await open(page,'工艺路线');await act(page,'conflict-work','.pf-flow-node:has(.pf-flow-node-head b:text-is("染色")) >> nth=0',{expectations:[{selector:'.pf-document-summary'}]})
 await act(page,'conflict-estimate','#pf-overlays [data-pf-action=estimate]',{expectations:[{selector:'[name=nodeId]'}]})
 const nodeId=await page.locator('[name=nodeId]').inputValue()
 await page.locator('[name=reason]').fill('冲突检查');await page.locator('[name=action]').fill('不覆盖另一页');await page.locator('[name=expectedAt]').fill('2026-12-02T12:00')
 const other=await context.newPage();await other.goto(server+route);await settle(other,0,ready)
 await other.evaluate(async nodeId=>{const db=await new Promise(r=>{const q=indexedDB.open('higood-dds-followups');q.onsuccess=()=>r(q.result)});const tx=db.transaction('forecasts','readwrite');tx.objectStore('forecasts').put({id:'DEM-202603-0001/'+nodeId,taskId:'DEM-202603-0001',nodeId,endAt:'2026-12-03T12:00:00+08:00',version:1});await new Promise(r=>tx.oncomplete=r);db.close()},nodeId)
 await act(page,'forecast-conflict','[data-pf-action=save-followup]',{expectations:[{selector:'.pf-form-error',text:'其他页面'}]});assert.equal((await stored(page)).followups.length,2);assert.equal((await stored(page)).forecasts.find(row=>row.nodeId===nodeId).endAt,'2026-12-03T12:00:00+08:00');await close(page);await other.close()
 checks.push({case:'forecast-conflict-no-half-followup',pass:true})
 // Storage disabled: existing source facts remain usable, no blank-success message.
 const disabled=await browser.newContext();await disabled.addInitScript(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...rest){if(name==='higood-dds-followups')throw new DOMException('DDS storage disabled','SecurityError');return open.call(this,name,...rest)}});const unavailable=await disabled.newPage();await unavailable.goto(server+route);await settle(unavailable,0,[{selector:'.pf-storage-notice',text:'无法读取或保存'}]);assert((await unavailable.locator('.pf-task-identity').innerText()).includes('SPU-2024-001'));await disabled.close()
 checks.push({case:'dds-database-unavailable-explicit-source-facts-retained',pass:true})
 // UI preference storage is optional; business follow-up saves remain in IndexedDB.
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}})
 await act(page,'quota-followup-open','.pf-detail-utilities [data-pf-action=followup]',{expectations:[{selector:'#pf-overlays form'}]});await page.locator('[name=reason]').fill('偏好空间满');await page.locator('[name=action]').fill('业务仍可保存')
 await act(page,'quota-followup-save','[data-pf-action=save-followup]',{expectations:[{selector:'#pf-overlays form',absent:true}]});assert.equal((await stored(page)).followups.length,3)
 await page.evaluate(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('disabled','SecurityError')}})})
 await act(page,'disabled-preference-followup-tab',tab('跟进记录','detail-tab'),{expectations:[{selector:'[data-pf-table^="followups-"]'}]})
 await act(page,'disabled-preference-followup-open','.pf-detail-utilities [data-pf-action=followup]',{expectations:[{selector:'#pf-overlays form'}]});await page.locator('[name=reason]').fill('偏好禁用');await page.locator('[name=action]').fill('不依赖偏好保存')
 await act(page,'disabled-preference-followup-save','[data-pf-action=save-followup]',{expectations:[{selector:'#pf-overlays form',absent:true}]});assert.equal((await stored(page)).followups.length,4)
 checks.push({case:'localstorage-quota-and-disabled-preferences-fall-back-business-save-retained',pass:true})

 checks.push({case:'explicit-migration-readback-only-owned-key-cleanup',pass:true});await context.close()
 }
 completed=true
}catch(error){errors.push({case:'script',error:String(error)});throw error}finally{
 await browser.close()
 const bad=samples.filter(s=>!s.ready||s.ms>1000)
 const sourceHashes={}
 for(const name of await readdir('src/pages/production-fulfillment'))if(/\.(ts|css)$/.test(name)){const path='src/pages/production-fulfillment/'+name;sourceHashes[path]=createHash('sha256').update(await readFile(path)).digest('hex')}
 sourceHashes['scripts/check-dds-task-business-review.mjs']=createHash('sha256').update(await readFile('scripts/check-dds-task-business-review.mjs')).digest('hex')
 const report={server,route,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),worktree:process.cwd(),browser:browser.version(),sizes:['1366x768','1280x720'],sourceHashes,timing:'Navigation start or event.timeStamp through expected usable content and two animation-frame readiness checks; cold browser cache cleared; source image gap separately recorded.',limitMs:1000,samples,checks,errors,completedIterations,completed,pass:completed&&completedIterations===5&&bad.length===0&&errors.length===0,imageGate:'blocked: SPU-2024-001 source has no corresponding image'}
 await writeFile(out+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({samples:samples.length,checks:checks.length,maxMs:Math.max(...samples.map(s=>s.ms)),bad,errors}))
 if(bad.length||errors.length)process.exitCode=1
}
