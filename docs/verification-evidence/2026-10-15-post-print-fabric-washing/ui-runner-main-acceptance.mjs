import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

// Production preview only. The product is operated by real pointer/keyboard events.
// IndexedDB is independently read after each saved action; it is never seeded here.
const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43158', runs=Number(process.env.WASH_UI_RUNS||5)
const out='docs/verification-evidence/2026-10-15-post-print-fabric-washing',stamp=new Date().toISOString().replaceAll(':','-')
mkdirSync(out,{recursive:true});mkdirSync('output/playwright/washing',{recursive:true})
mkdirSync('output/pdf',{recursive:true})
const session=JSON.parse(readFileSync('/tmp/washing-pda-session.json','utf8'))
const report={at:new Date().toISOString(),base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:{node:process.version,timezone:'Asia/Shanghai',cache:'new isolated browser context per lifecycle; no preload; subsequent actions warm',scale:'lifecycle: 1 order × 6 rolls × 50 Yard; boundary: 3 orders; list: 18 actual saved orders from six sources, three handfeels, 18 wash rolls and 12 no-wash judgments; 12 six-source print scenarios plus existing static domain'},samples:[],checks:[],errors:[]}
const browser=await chromium.launch({headless:true});report.browser=browser.version()
const route='/fcs/craft/dyeing/washing/work-orders'
async function initPage(p){
 p.on('pageerror',e=>report.errors.push(e.message))
 await p.addInitScript(()=>{
  window.washEventStart=0
  for(const type of ['pointerdown','change','input','keydown'])document.addEventListener(type,event=>{if(event.target instanceof Element&&event.target.closest('[data-washing-list-root],[data-washing-detail-root],[data-washing-judgment-root],[data-washing-image-overlay]'))window.washEventStart=performance.now()},true)
  window.washDurable=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('higood-pcs-records');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readonly'),get=tx.objectStore('records').getAll();get.onsuccess=()=>{const rows=get.result.filter(r=>r.collection==='fcs.fabric-washing.v1');tx.oncomplete=()=>{db.close();resolve(rows)}};get.onerror=()=>reject(get.error)}})
  window.washReady=async(selector)=>{const root=document.querySelector(selector);if(!root)throw new Error('result missing '+selector);for(const image of root.querySelectorAll('img'))if(image.offsetWidth>0){if(!image.complete)await new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error('image failed')),{once:true})});if(!image.naturalWidth)throw new Error('image unavailable')}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()}
 })
}
async function sample(p,family,branch,mode,fn,done,nav=false,selector='[data-washing-list-root],[data-washing-detail-root],[data-washing-judgment-root]'){
 try{
  await fn();await done()
  const end=await p.evaluate(async selector=>window.washReady(selector),selector)
  const start=nav?0:await p.evaluate(()=>window.washEventStart)
  assert.ok(nav||start>0,'missing real event start')
  const row={family,branch,mode,ms:end-start,status:end-start<=1000?'PASS':'FAIL',start:nav?'navigationStart':'captured pointerdown/change/input',complete:'correct DOM + decoded visible images + two animation frames; saved branches additionally native IndexedDB readback'}
  report.samples.push(row);appendFileSync(out+'/ui-samples-'+stamp+'.jsonl',JSON.stringify(row)+'\n');console.log(row.status,family,branch,mode,row.ms.toFixed(2))
 }catch(e){const timing=await p.evaluate(()=>({now:performance.now(),start:window.washEventStart})).catch(()=>null);const row={family,branch,mode,status:timing&&(nav||timing.start>0)?'FAIL':'INVALID',ms:timing?timing.now-(nav?0:timing.start):undefined,completed:false,error:e.message};report.samples.push(row);appendFileSync(out+'/ui-samples-'+stamp+'.jsonl',JSON.stringify(row)+'\n');throw e}
}
async function nav(p,url,selector,mode,branch='direct-entry-with-existing-cache'){await sample(p,'PF-01',branch,mode,()=>p.goto(base+url),()=>p.locator(selector).waitFor(),true)}
async function saved(p,action,before){await p.waitForFunction(async({action,before})=>(await window.washDurable()).filter(r=>r.value?.kind==='actions'&&r.value.data.action===action).length>before,{action,before});await p.waitForFunction(()=>![...document.querySelectorAll('[data-washing-order] button,[data-washing-source] button')].some(b=>b.disabled))}
async function act(p,name,type,mode,family='PF-03',branch=name){const before=await p.evaluate(async action=>(await window.washDurable()).filter(r=>r.value?.kind==='actions'&&r.value.data.action===action).length,type);await sample(p,family,branch,mode,()=>p.getByRole('button',{name,exact:true}).click(),()=>saved(p,type,before))}
async function role(p,name){const mode=p.viewportSize().width===390?'PDA':'Web';await sample(p,'PF-02','role-'+name,mode,()=>p.locator('[data-washing-context-role]').selectOption(name),()=>p.waitForFunction(value=>document.querySelector('[data-washing-context-role]')?.value===value,name))}
async function selectAll(p){for(const check of await p.locator('[data-washing-exec-roll]').all())await check.check()}
async function fillQty(p){for(const input of await p.locator('[data-washing-qty]').all())await input.fill('50')}
async function position(p){const select=p.locator('[data-washing-position]'),value=await select.locator('option').evaluateAll(options=>options.find(o=>o.value&&!/异常|待确认/.test(o.textContent))?.value);assert.ok(value);await select.selectOption(value)}
async function scans(p,mode){const codes=await p.locator('[data-washing-exec-roll]').evaluateAll(nodes=>nodes.map(n=>n.parentElement.querySelector('strong').textContent));for(const code of codes){await p.locator('[data-washing-scan]').fill(code);await sample(p,'PF-04','scan-valid',mode,()=>p.locator('[data-washing-scan]').press('Enter'),()=>p.locator('[data-washing-scans]').filter({hasText:code}).waitFor())}}
async function warehouseRead(c,mode,kind,branch){
 if(mode!=='PDA')return
 const state=await c.storageState({indexedDB:true}),cold=await browser.newContext({storageState:state,viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'}),p=await cold.newPage();await initPage(p)
 try{await sample(p,'PF-07',branch,mode,()=>p.goto(base+'/fcs/pda/warehouse/'+(kind==='WAIT_PROCESS'?'wait-process':'wait-handover')),()=>p.locator('[data-washing-factory-stock="'+kind+'"]').waitFor(),true,'[data-washing-factory-stock]');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}finally{await cold.close()}
}
async function check(name,fn){if(process.env.WASH_UI_FILTER&&!name.includes(process.env.WASH_UI_FILTER))return;try{const result=await fn();report.checks.push({name,status:'PASS',result});console.log('CHECK PASS',name)}catch(e){report.checks.push({name,status:'FAIL',error:e.message});console.log('CHECK FAIL',name,e.message)}}

for(const mode of ['Web','PDA'])for(let n=0;n<runs;n++)await check(`${mode} lifecycle ${n+1}`,async()=>{
 const c=await browser.newContext({viewport:mode==='PDA'?{width:390,height:844}:{width:1366,height:768},timezoneId:'Asia/Shanghai',acceptDownloads:true}),p=await c.newPage();await initPage(p)
 if(mode==='PDA')await p.addInitScript(value=>{localStorage.setItem('fcs_pda_session',JSON.stringify(value))},session)
 const printId='PWO-WASH-DEMO-PRODUCTION-DONE',judge=mode==='PDA'?'/fcs/pda/exec/TASK-'+printId:'/fcs/craft/printing/work-orders/'+printId
 try{
  await nav(p,judge,'[data-washing-judgment-root]',mode,'cold-print-detail')
  await sample(p,'PF-01','refresh-print-detail',mode,()=>p.reload(),()=>p.locator('[data-washing-judgment-root]').waitFor(),true)
  assert.equal(await p.locator('[data-washing-judge-roll]:checked').count(),6)
  assert.equal(await p.locator('[data-washing-feel]').inputValue(),'')
  await sample(p,'PF-02','create-failure-missing-feel',mode,()=>p.getByRole('button',{name:'创建水洗加工单',exact:true}).click(),()=>p.locator('[data-washing-error]').filter({hasText:'手感'}).waitFor())
  await role(p,'现场判断人员');await p.locator('[data-washing-feel]').selectOption(['柔软手感','增厚蓬松棉手感','硬挺手感'][n%3])
  await p.evaluate(()=>{window.washPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='records')throw new DOMException('quota fixture','QuotaExceededError');return window.washPut.apply(this,args)}})
  await sample(p,'PF-02','create-failure-quota',mode,()=>p.getByRole('button',{name:'创建水洗加工单',exact:true}).click(),()=>p.locator('[data-washing-error]').filter({hasText:'空间不足'}).waitFor())
  assert.equal((await p.evaluate(()=>window.washDurable())).length,0);await p.evaluate(()=>{IDBObjectStore.prototype.put=window.washPut})
  await act(p,'创建水洗加工单','JUDGE',mode,'PF-02','create-six-rolls')
  const order=(await p.evaluate(async()=>(await window.washDurable()).find(r=>r.value?.kind==='orders').value.data)),id=order.id
  await nav(p,(mode==='PDA'?'/fcs/pda/washing':route)+'/'+encodeURIComponent(id),'[data-washing-order]',mode,'direct-washing-detail-with-existing-cache')
  await role(p,'计划跟单');await p.locator('[data-washing-assign-factory]').selectOption('F090');await act(p,'派给染厂','ASSIGN',mode)
  await role(p,'染厂人员');await act(p,'接单','ACCEPT',mode)
  await role(p,'现场判断人员');await selectAll(p);await p.locator('[data-washing-scan]').fill('WRONG-ROLL');await sample(p,'PF-04','scan-wrong',mode,()=>p.locator('[data-washing-scan]').press('Enter'),()=>p.locator('[data-washing-error]').filter({hasText:'卷码不属于本单'}).waitFor());await scans(p,mode);const duplicateCode=await p.locator('[data-washing-exec-roll]').first().evaluate(n=>n.parentElement.querySelector('strong').textContent);await p.locator('[data-washing-scan]').fill(duplicateCode);await sample(p,'PF-04','scan-duplicate',mode,()=>p.locator('[data-washing-scan]').press('Enter'),()=>p.locator('[data-washing-error]').filter({hasText:'不能重复扫描'}).waitFor());await act(p,'印花交给染厂','SEND',mode,'PF-04')
  await role(p,'染厂人员');await selectAll(p);await fillQty(p);await position(p);await act(p,'登记逐卷实收','RECEIVE',mode,'PF-04')
  await warehouseRead(c,mode,'WAIT_PROCESS','warehouse-input-cold-existing-data')
  await selectAll(p);await act(p,'投入水洗','START',mode,'PF-05')
  await selectAll(p);await fillQty(p);await act(p,'登记实际产出','OUTPUT',mode,'PF-05')
  await warehouseRead(c,mode,'WAIT_HANDOVER','warehouse-output-cold-existing-data')
  await selectAll(p);await scans(p,mode);await act(p,'交回原接收方','HANDOUT',mode,'PF-05')
  await role(p,'接收人员');await selectAll(p);await fillQty(p);await position(p);await act(p,'登记下游实收','DOWNSTREAM_RECEIVE',mode,'PF-05')
  await warehouseRead(c,mode,'WAIT_PROCESS','warehouse-downstream-cold-existing-data')
  await role(p,'染厂人员');await act(p,'人工完单','COMPLETE',mode,'PF-05')
  await p.evaluate(()=>{
   window.washPaper=''
   new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLIFrameElement&&node.dataset.washingPrintFrame)node.addEventListener('load',()=>{node.contentWindow.print=()=>{window.washPaper=node.contentDocument.documentElement.outerHTML;queueMicrotask(()=>node.contentWindow?.dispatchEvent(new Event('afterprint')))}},{capture:true})}).observe(document.body,{childList:true})
  })
  await act(p,'水洗加工单预览','PRINT',mode,'PF-06','order-preview')
  await p.locator('[data-washing-print-document]').waitFor();assert.match(await p.locator('[data-washing-print-document]').innerText(),/300|50 Yard/)
  await sample(p,'PF-06','print-ready-order-paper',mode,()=>p.getByRole('button',{name:'打印本预览',exact:true}).click(),()=>p.waitForFunction(()=>window.washPaper.includes('水洗加工单')))
  if(n===0){const html=await p.evaluate(()=>window.washPaper),paper=await c.newPage();await paper.setContent(html.replace('<head>','<head><base href="'+base+'/">'));await paper.locator('img').evaluateAll(async images=>{for(const img of images)await img.decode()});await paper.pdf({path:`output/pdf/washing-${mode.toLowerCase()}-order.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});await paper.close();writeFileSync(out+`/${mode.toLowerCase()}-order-paper.html`,html)}
  await p.evaluate(()=>window.washPaper='')
  await act(p,'交接与卷标预览','PRINT',mode,'PF-06','transfer-label-preview')
  assert.equal(await p.locator('[data-washing-print-document] [data-real-barcode]').count(),6)
  await sample(p,'PF-06','print-ready-paper',mode,()=>p.getByRole('button',{name:'打印本预览',exact:true}).click(),()=>p.waitForFunction(()=>window.washPaper.includes('水洗交接与卷标')))
  if(n===0){
   const html=await p.evaluate(()=>window.washPaper),paper=await c.newPage();await paper.setContent(html.replace('<head>','<head><base href="'+base+'/">'));await paper.locator('img').evaluateAll(async images=>{for(const img of images)await img.decode()});await paper.pdf({path:`output/pdf/washing-${mode.toLowerCase()}-transfer.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});await paper.close();writeFileSync(out+`/${mode.toLowerCase()}-paper.html`,html)
  }
  await sample(p,'PF-02','image-open',mode,()=>p.locator('[data-fabric-washing-action="image"]').first().click(),async()=>{await p.locator('[data-washing-image-overlay] img').waitFor();await p.locator('[data-washing-image-overlay] img').evaluate(img=>img.decode())})
  assert.equal(await p.locator('[data-washing-image-overlay] img').evaluate(img=>getComputedStyle(img).objectFit),'contain');await sample(p,'PF-02','image-close-esc',mode,()=>p.keyboard.press('Escape'),()=>p.locator('[data-washing-image-overlay]').waitFor({state:'detached'}));await p.locator('[data-fabric-washing-action="image"]').first().click();await sample(p,'PF-02','image-close-button',mode,()=>p.getByRole('button',{name:'关闭大图',exact:true}).click(),()=>p.locator('[data-washing-image-overlay]').waitFor({state:'detached'}));await p.locator('[data-fabric-washing-action="image"]').first().click();await sample(p,'PF-02','image-close-mask',mode,()=>p.locator('[data-washing-image-overlay]').click({position:{x:1,y:1}}),()=>p.locator('[data-washing-image-overlay]').waitFor({state:'detached'}))
  const broken=await c.newPage();await initPage(broken);await broken.route('**/materials/fei-ticket/blue-white-print-cotton.png',r=>r.abort('failed'))
  await sample(broken,'PF-02','image-failure-feedback',mode,()=>broken.goto(base+(mode==='PDA'?'/fcs/pda/washing':route)+'/'+encodeURIComponent(id)),()=>broken.locator('[data-washing-image-status]').filter({hasText:'图片加载失败'}).first().waitFor({timeout:5000}).catch(async e=>{throw new Error(e.message+' BODY '+(await broken.locator('body').innerText()).slice(-1600)+' IMAGES '+JSON.stringify(await broken.locator('img').evaluateAll(ns=>ns.map(n=>({src:n.src,complete:n.complete,width:n.naturalWidth})))))}),true,'[data-washing-image-status]');await broken.close()
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false)
  if(n===0){await p.screenshot({path:`output/playwright/washing/${mode.toLowerCase()}-full-lifecycle.png`,fullPage:true});const html=await p.locator('[data-washing-print-document]').evaluate(el=>el.outerHTML);writeFileSync(out+`/${mode.toLowerCase()}-print.html`,html)}
  await nav(p,mode==='PDA'?'/fcs/pda/washing':route,'[data-washing-list-root]',mode,'direct-list-with-existing-cache')
  await sample(p,'PF-01','refresh-list',mode,()=>p.reload(),()=>p.locator('[data-washing-list-root]').waitFor(),true)
  await sample(p,'PF-01','in-app-detail',mode,()=>p.locator('[data-washing-list-root] a').filter({hasText:order.no}).first().click(),()=>p.locator('[data-washing-order]').waitFor())
  if(mode==='Web'){
   await sample(p,'PF-07','production-actual-relation',mode,()=>p.getByRole('link',{name:'PO-202603-0003',exact:true}).click(),async()=>{await p.getByRole('heading',{name:'印花后实际追加水洗',exact:true}).waitFor();await p.getByRole('link',{name:order.no,exact:true}).waitFor()},false,'main')
   await nav(p,route+'/'+encodeURIComponent(id),'[data-washing-order]',mode,'return-production-relation')
  }
  await role(p,'计划跟单')
  // Each branch is measured separately; no aggregation of save/cancel or success/failure.
  for(const viewport of mode==='Web'?[{width:1280,height:720},{width:1024,height:768}]:[{width:390,height:844}]){await p.setViewportSize(viewport);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(n===0)await p.screenshot({path:`output/playwright/washing/${mode.toLowerCase()}-${viewport.width}.png`,fullPage:true})}
  await p.setViewportSize(mode==='PDA'?{width:390,height:844}:{width:1366,height:768})
  if(mode==='Web'){
   await nav(p,route,'[data-washing-list-root]',mode,'warm-list-maintenance')
   await sample(p,'PF-08','storage-open-stats',mode,()=>p.getByRole('button',{name:'本地资料',exact:true}).click(),()=>p.locator('[data-washing-storage]').waitFor())
   await sample(p,'PF-08','storage-stats',mode,()=>p.getByRole('button',{name:'重新估算',exact:true}).click(),()=>p.getByText('浏览器容量估值：',{exact:false}).waitFor())
   let download;await sample(p,'PF-08','storage-export',mode,async()=>{const waiting=p.waitForEvent('download');await p.getByRole('button',{name:'导出完整备份',exact:true}).click();download=await waiting},()=>p.locator('[data-washing-result]').filter({hasText:'完整备份已生成'}).waitFor())
   const file=out+`/backup-ui-${n+1}.json`;await download.saveAs(file);await p.locator('[data-washing-backup-input]').setInputFiles(file)
   await sample(p,'PF-08','storage-restore-identical',mode,()=>p.getByRole('button',{name:'核验并恢复备份',exact:true}).click(),async()=>{await p.locator('[data-washing-result]').filter({hasText:'恢复及回读完成'}).waitFor();const rows=await p.evaluate(()=>window.washDurable());assert.ok(rows.some(r=>r.value?.kind==='orders'&&r.value.data.completedAt))})
   await sample(p,'PF-08','storage-cleanup',mode,()=>p.getByRole('button',{name:'清理无引用水洗附件',exact:true}).click(),()=>p.locator('[data-washing-result]').filter({hasText:'已清理'}).waitFor())
   const restored=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),rp=await restored.newPage();await initPage(rp);await nav(rp,route,'[data-washing-list-root]',mode,'cold-list-restore');await rp.getByRole('button',{name:'本地资料',exact:true}).click();await rp.locator('[data-washing-backup-input]').setInputFiles(file)
   await sample(rp,'PF-08','storage-restore-new',mode,()=>rp.getByRole('button',{name:'核验并恢复备份',exact:true}).click(),async()=>{await rp.locator('[data-washing-result]').filter({hasText:'恢复及回读完成'}).waitFor();assert.ok((await rp.evaluate(()=>window.washDurable())).some(r=>r.value?.kind==='orders'&&r.value.data.completedAt))})
   await rp.locator('[data-washing-backup-input]').setInputFiles({name:'bad-backup.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')})
   await sample(rp,'PF-08','storage-restore-invalid',mode,()=>rp.getByRole('button',{name:'核验并恢复备份',exact:true}).click(),()=>rp.locator('[data-washing-error]').filter({hasText:'格式'}).waitFor());await restored.close()
   await sample(p,'PF-07','historical-native-detail',mode,()=>p.goto(base+route+'/'+encodeURIComponent('PO-202610-0089/wo-F01-wash')),()=>p.getByText('演示WO-F01-WASH-89',{exact:false}).first().waitFor(),true,'main')
  }
  return {orderId:id,rolls:6,complete:true}
 }finally{await c.close()}
})

for(const mode of ['Web','PDA'])for(let n=0;n<runs;n++)await check(`${mode} correction and recovery ${n+1}`,async()=>{
 const c=await browser.newContext({viewport:mode==='PDA'?{width:390,height:844}:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();await initPage(p)
 if(mode==='PDA')await p.addInitScript(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),session)
 const printId='PWO-WASH-DEMO-SUPPLEMENT-DONE',judge=mode==='PDA'?'/fcs/pda/exec/TASK-'+printId:'/fcs/craft/printing/work-orders/'+printId
 const selectRoll=async index=>{for(const node of await p.locator('[data-washing-judge-roll]').all())if(await node.isChecked())await node.uncheck();await p.locator('[data-washing-judge-roll]').nth(index).check()}
 try{
  await nav(p,judge,'[data-washing-judgment-root]',mode,'cold-supplement-print-detail');await role(p,'现场判断人员');await selectRoll(0);await p.locator('[data-washing-feel]').selectOption('柔软手感');await act(p,'创建水洗加工单','JUDGE',mode,'PF-02','create-partial-one-roll')
  await selectRoll(0);await p.locator('[data-washing-feel]').selectOption('硬挺手感');await act(p,'纠正为所选手感','JUDGE',mode,'PF-03','own-correction')
  let id=decodeURIComponent((await p.getByRole('link',{name:'查看水洗加工单',exact:true}).getAttribute('href')).split('/').at(-1))
  await nav(p,(mode==='PDA'?'/fcs/pda/washing':route)+'/'+encodeURIComponent(id),'[data-washing-order]',mode,'correction-detail')
  await role(p,'计划跟单');await sample(p,'PF-03','cancel-confirm-open',mode,()=>p.getByRole('button',{name:'作废本单',exact:true}).click(),()=>p.locator('[data-washing-reason]').waitFor());await sample(p,'PF-03','dismiss-confirm',mode,()=>p.getByRole('button',{name:'返回填写',exact:true}).click(),()=>p.locator('[data-washing-reason]').waitFor({state:'detached'}));await p.getByRole('button',{name:'作废本单',exact:true}).click();await p.locator('[data-washing-reason]').fill('核对原实物后作废');await act(p,'确认作废','CANCEL',mode,'PF-03','cancel-before-physical')
  await nav(p,judge,'[data-washing-judgment-root]',mode,'return-source');await role(p,'现场判断人员');await selectRoll(1);await p.locator('[data-washing-feel]').selectOption('增厚蓬松棉手感');await act(p,'创建水洗加工单','JUDGE',mode,'PF-02','create-partial-one-roll')
  id=decodeURIComponent((await p.getByRole('link',{name:'查看水洗加工单',exact:true}).getAttribute('href')).split('/').at(-1));await nav(p,(mode==='PDA'?'/fcs/pda/washing':route)+'/'+encodeURIComponent(id),'[data-washing-order]',mode,'rejection-detail')
  await role(p,'计划跟单');await p.locator('[data-washing-assign-factory]').selectOption('F090');await act(p,'派给染厂','ASSIGN',mode,'PF-03','initial-assignment')
  await role(p,'染厂人员');await sample(p,'PF-03','reject-confirm-open',mode,()=>p.getByRole('button',{name:'拒单',exact:true}).click(),()=>p.locator('[data-washing-reason]').waitFor());await p.locator('[data-washing-reason]').fill('本次产能不足');await act(p,'确认拒单','REJECT',mode,'PF-03','reject')
  await role(p,'计划跟单');await p.locator('[data-washing-assign-factory]').selectOption('F090');await act(p,'派给染厂','ASSIGN',mode,'PF-03','reassign-after-reject')
  await role(p,'染厂人员');await act(p,'接单','ACCEPT',mode,'PF-03','accept-after-reassign')
  await role(p,'现场负责人');await sample(p,'PF-03','exception-confirm-open',mode,()=>p.getByRole('button',{name:'登记异常',exact:true}).click(),()=>p.locator('[data-washing-reason]').waitFor());await p.locator('[data-washing-reason]').fill('触摸结果需要现场协调');await act(p,'确认登记异常','EXCEPTION',mode,'PF-03','exception-freeze')
  await sample(p,'PF-03','resolve-exception-confirm-open',mode,()=>p.getByRole('button',{name:'核对实物并恢复',exact:true}).click(),()=>p.locator('[data-washing-reason]').waitFor());await p.locator('[data-washing-reason]').fill('实物已核对，同意按原范围恢复');await p.locator('[data-washing-resolved-feel]').selectOption('柔软手感');await act(p,'确认恢复流转','RESOLVE_EXCEPTION',mode,'PF-03','supervisor-resolution')
  await nav(p,judge,'[data-washing-judgment-root]',mode,'return-source-no-wash');await role(p,'现场判断人员');await selectRoll(2);await act(p,'不需要水洗','JUDGE',mode,'PF-02','no-wash')
  await p.goto(base+(mode==='PDA'?'/fcs/pda/washing':route));await p.locator('[data-washing-list-root]').waitFor()
  await p.locator('[data-washing-filter="handFeel"]').selectOption('柔软手感');await sample(p,'PF-02','query',mode,()=>p.getByRole('button',{name:'查询',exact:true}).click(),()=>p.locator('[data-washing-list-root]').filter({hasText:'柔软手感'}).waitFor());await sample(p,'PF-02','reset',mode,()=>p.getByRole('button',{name:'重置',exact:true}).click(),()=>p.waitForFunction(()=>document.querySelector('[data-washing-filter="handFeel"]').value===''))
  if(mode==='Web'){
   await sample(p,'PF-02','column-settings',mode,()=>p.getByRole('button',{name:'列设置',exact:true}).click(),()=>p.getByText('水洗列表列设置',{exact:true}).waitFor())
  }
  return {partial:true,corrected:true,cancelled:true,rejected:true,reassigned:true,exceptionResolved:true,noWash:true}
 }finally{await c.close()}
})


const benchmarkFile='/tmp/washing-benchmark-18-orders.json'
for(const mode of ['Web','PDA'])for(let n=0;n<runs;n++)await check(`${mode} list population 18 orders ${n+1}`,async()=>{
 const setup=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),seed=await setup.newPage();await initPage(seed);await seed.goto(base+route);await seed.locator('[data-washing-list-root]').waitFor();await seed.getByRole('button',{name:'本地资料',exact:true}).click();await seed.locator('[data-washing-backup-input]').setInputFiles(benchmarkFile);await seed.getByRole('button',{name:'核验并恢复备份',exact:true}).click();await seed.locator('[data-washing-result]').filter({hasText:'恢复及回读完成'}).waitFor()
 const state=await setup.storageState({indexedDB:true});await setup.close();const c=await browser.newContext({storageState:state,viewport:mode==='PDA'?{width:390,height:844}:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();await initPage(p)
 if(mode==='PDA')await p.addInitScript(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),session)
 try{
  await nav(p,mode==='PDA'?'/fcs/pda/washing':route,'[data-washing-list-root]',mode,'cold-list-18-orders')
  const rows=await p.evaluate(()=>window.washDurable());assert.equal(rows.filter(r=>r.value.kind==='orders').length,18)
  await sample(p,'PF-02','filter-18-orders',mode,()=>p.locator('[data-washing-filter="handFeel"]').selectOption('柔软手感'),async()=>{})
  await sample(p,'PF-02','query-18-orders',mode,()=>p.getByRole('button',{name:'查询',exact:true}).click(),()=>p.waitForFunction(()=>document.querySelectorAll('[data-washing-list-root] tbody tr').length===6||document.querySelectorAll('[data-washing-list-root] article').length===6))
  await sample(p,'PF-02','reset-18-orders',mode,()=>p.getByRole('button',{name:'重置',exact:true}).click(),()=>p.waitForFunction(()=>document.querySelector('[data-washing-filter="handFeel"]').value===''))
  if(mode==='Web'){
   const sorting=p.locator('[data-fabric-washing-action="sort-column"][data-column-key="qty"]')
   for(const [branch,direction] of [['sort-asc','asc'],['sort-desc','desc'],['sort-default','none']])await sample(p,'PF-02',branch,mode,()=>sorting.click(),()=>sorting.locator('[data-standard-list-sort-icon="'+direction+'"]').waitFor())
   await sample(p,'PF-02','columns-open-18',mode,()=>p.getByRole('button',{name:'列设置',exact:true}).click(),()=>p.getByText('水洗列表列设置',{exact:true}).waitFor())
   const visible=p.locator('[data-fabric-washing-action="toggle-column-visibility"][data-fabric-washing-column-key="source"]'),frozen=p.locator('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="material"]')
   await sample(p,'PF-02','column-hide',mode,()=>visible.click(),()=>p.waitForFunction(()=>!document.querySelector('[data-fabric-washing-action="toggle-column-visibility"][data-fabric-washing-column-key="source"]').checked))
   await sample(p,'PF-02','column-show',mode,()=>visible.click(),()=>p.waitForFunction(()=>document.querySelector('[data-fabric-washing-action="toggle-column-visibility"][data-fabric-washing-column-key="source"]').checked))
   await sample(p,'PF-02','column-freeze',mode,()=>frozen.click(),()=>p.waitForFunction(()=>document.querySelector('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="material"]').checked))
   const from=p.locator('[draggable="true"][data-fabric-washing-column-key="qty"]'),to=p.locator('[draggable="true"][data-fabric-washing-column-key="source"]')
   await sample(p,'PF-02','column-reorder',mode,()=>from.dragTo(to),()=>p.waitForFunction(()=>{const rows=[...document.querySelectorAll('[draggable="true"][data-fabric-washing-column-key]')].map(n=>n.dataset.fabricWashingColumnKey);return rows.indexOf('qty')<rows.indexOf('source')}))
   await sample(p,'PF-02','columns-restore-defaults',mode,()=>p.getByRole('button',{name:'恢复默认',exact:true}).click(),()=>p.waitForFunction(()=>!document.querySelector('[data-fabric-washing-action="toggle-column-freeze"][data-fabric-washing-column-key="material"]').checked))
   await sample(p,'PF-02','columns-close',mode,()=>p.getByRole('button',{name:'关闭',exact:true}).click(),()=>p.getByText('水洗列表列设置',{exact:true}).waitFor({state:'detached'}))
  }
  const next=p.locator('[data-fabric-washing-action="next-page"]');await sample(p,'PF-02','next-page-18-orders',mode,()=>next.click(),()=>p.waitForFunction(()=>document.querySelector('[data-washing-list-root]').innerText.includes('2 / 2')))
  await sample(p,'PF-02','previous-page-18-orders',mode,()=>p.locator('[data-fabric-washing-action="prev-page"]').click(),()=>p.waitForFunction(()=>document.querySelector('[data-washing-list-root]').innerText.includes('1 / 2')))
  const size=p.locator('[data-fabric-washing-field="pageSize"],[data-fabric-washing-page-size]').first();await sample(p,'PF-02','page-size-20',mode,()=>size.selectOption('20'),()=>p.waitForFunction(()=>document.querySelector('[data-washing-list-root]').innerText.includes('1 / 1')))
  await sample(p,'PF-01','refresh-list-18-orders',mode,()=>p.reload(),()=>p.locator('[data-washing-list-root]').waitFor(),true)
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(n===0)await p.screenshot({path:`output/playwright/washing/${mode.toLowerCase()}-18-orders-list.png`,fullPage:true})
  if(mode==='Web'){
   await sample(p,'PF-01','candidate-list-20-first',mode,()=>p.getByRole('button',{name:'查看印花产出',exact:true}).click(),()=>p.getByRole('heading',{name:'印花实际产出',exact:true}).waitFor())
   await sample(p,'PF-02','candidate-next-page',mode,()=>p.getByRole('button',{name:'下一页',exact:true}).click(),()=>p.getByText('第 2 /',{exact:false}).waitFor())
   await sample(p,'PF-02','candidate-previous-page',mode,()=>p.getByRole('button',{name:'上一页',exact:true}).click(),()=>p.getByText('第 1 /',{exact:false}).waitFor())
   await sample(p,'PF-01','candidate-return-list',mode,()=>p.getByRole('button',{name:'返回水洗列表',exact:true}).click(),()=>p.getByRole('heading',{name:'水洗加工单',exact:true}).waitFor())
  }
  return {orders:18,query:6,pageSize:20,pagination:true}
 }finally{await c.close()}
})
for(const mode of ['Web','PDA'])for(let n=0;n<runs;n++)await check(`${mode} committed early-match detail ${n+1}`,async()=>{
 const fixture=JSON.parse(readFileSync('/tmp/washing-early-matched-backup.json','utf8')),order=fixture.records.find(r=>r.value.kind==='orders').value.data,setup=await browser.newContext(),seed=await setup.newPage();await initPage(seed);await seed.goto(base+route);await seed.locator('[data-washing-list-root]').waitFor();await seed.getByRole('button',{name:'本地资料',exact:true}).click();await seed.locator('[data-washing-backup-input]').setInputFiles('/tmp/washing-early-matched-backup.json');await seed.getByRole('button',{name:'核验并恢复备份',exact:true}).click();await seed.locator('[data-washing-result]').filter({hasText:'恢复及回读完成'}).waitFor();const state=await setup.storageState({indexedDB:true});await setup.close()
 const c=await browser.newContext({storageState:state,viewport:mode==='PDA'?{width:390,height:844}:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();await initPage(p);if(mode==='PDA')await p.addInitScript(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),session)
 try{
  const target=(mode==='PDA'?'/fcs/pda/washing':route)+'/'+encodeURIComponent(order.id),done=()=>p.getByRole('link',{name:'PO-WASH-EARLY-EDGE',exact:true}).waitFor()
  await sample(p,'PF-07','early-match-detail-cold-existing-data',mode,()=>p.goto(base+target),done,true)
  await sample(p,'PF-07','early-match-detail-refresh',mode,()=>p.reload(),done,true)
  assert.match(await p.locator('[data-washing-detail-root]').innerText(),/重印/)
  return{orderId:order.id,productionOrderId:'PO-WASH-EARLY-EDGE',noDuplicate:true}
 }finally{await c.close()}
})
report.assets=Object.fromEntries(readdirSync('dist/assets').filter(p=>/\.(?:js|css)$/.test(p)).map(p=>[p,createHash('sha256').update(readFileSync('dist/assets/'+p)).digest('hex')]))
const files=execFileSync('git',['ls-files','-m','-o','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(p=>/^(src|scripts|tests)\//.test(p));report.sourceHashes=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
report.summary={valid:report.samples.filter(r=>r.status!=='INVALID').length,slow:report.samples.filter(r=>r.status==='FAIL').length,invalid:report.samples.filter(r=>r.status==='INVALID').length,failedChecks:report.checks.filter(r=>r.status==='FAIL').length,pageErrors:report.errors.length}
writeFileSync(out+'/production-ui-'+stamp+'.json',JSON.stringify(report,null,2));await browser.close();console.log(report.summary);if(Object.entries(report.summary).some(([k,v])=>k!=='valid'&&v))process.exitCode=1
