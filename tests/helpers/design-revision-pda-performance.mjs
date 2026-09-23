const evidenceOrigin=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4732';
import {chromium} from '@playwright/test';import fs from 'node:fs';import crypto from 'node:crypto';
const runId=new Date().toISOString().replaceAll(':','-'),dir='output/playwright/design-revision-gap/';
const receipt={runId,distSha:crypto.createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),viewport:{width:390,height:844},routes:[],errors:[]};
const browser=await chromium.launch();receipt.browser=browser.version();
const save=()=>fs.writeFileSync(dir+'pda-performance-'+runId+'.json',JSON.stringify(receipt,null,2));
for(const [factory,id] of [['F090','DWO-AUTO-000001'],['FAC-FLOWER','PWO-PRINT-AUTO-000001'],['DYE-GOTO-GLOBAL','']])for(const path of ['/fcs/pda/task-receive','/fcs/pda/task-receive/'+id,'/fcs/pda/exec','/fcs/pda/exec/'+id,'/fcs/pda/handover','/fcs/pda/factory-receipts']){
 if(factory==='DYE-GOTO-GLOBAL'&&path!=='/fcs/pda/factory-receipts')continue;
 if(process.argv[2]&&!path.includes(process.argv[2]))continue;
 const row={factory,path,samples:{cold:[],reload:[]},errors:[]};receipt.routes.push(row);
 for(let n=0;n<5;n++){
  const state={cookies:[],origins:[{origin:evidenceOrigin,localStorage:Object.entries(JSON.parse(fs.readFileSync(dir+'fixtures/completed.json'))).map(([name,value])=>({name,value}))}]};const entry={name:'fcs_pda_session',value:''};state.origins[0].localStorage=state.origins[0].localStorage.filter(x=>x.name!==entry.name);state.origins[0].localStorage.push(entry);const session={userName:'验收操作员',roleId:'ROLE_OPERATOR',factoryName:factory,loggedAt:'2026-09-24 09:00:00'};Object.assign(session,{factoryId:factory,userId:factory+'_operator',loginId:factory+'_operator'});entry.value=JSON.stringify(session);
  const context=await browser.newContext({storageState:state,viewport:receipt.viewport});
  await context.addInitScript(()=>{const probe=async()=>{const root=document.querySelector('[data-pda-shell-action="open-account-modal"],[data-factory-receiving-root]');if(!root||document.body.innerText.includes('正在加载页面')){requestAnimationFrame(probe);return}const images=[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0});try{await Promise.all(images.map(i=>i.decode()))}catch{window.__imageFailure=images.filter(i=>!i.naturalWidth).map(i=>i.src)}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.__ready=performance.now()};requestAnimationFrame(probe)});
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(evidenceOrigin+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready,{}, {timeout:15000});row.samples.cold.push(await page.evaluate(()=>window.__ready));if(await page.evaluate(()=>Boolean(window.__imageFailure?.length)))throw Error('首屏图片解码失败');
   if(n===0){row.text=await page.locator('body').innerText();row.width=await page.evaluate(()=>document.documentElement.scrollWidth);row.imageFailures=await page.evaluate(()=>window.__imageFailure||[]);row.actions=await page.locator('button,a,input,select').evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().width).map(e=>({text:(e.textContent||e.getAttribute('placeholder')||'').trim(),disabled:e.disabled,attributes:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])})));await page.screenshot({path:dir+factory+'-'+path.split('/').slice(-2).join('-')+'-'+runId+'.png'});}
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready);row.samples.reload.push(await page.evaluate(()=>window.__ready));if(await page.evaluate(()=>Boolean(window.__imageFailure?.length)))throw Error('刷新图片解码失败');
  }catch(e){row.errors.push(e.message)}finally{await context.close();save()}
 }
 console.log(factory,path,JSON.stringify(Object.fromEntries(Object.entries(row.samples).map(([k,v])=>[k,Math.max(...v)]))));
}
await browser.close();save();

if(receipt.routes.some(r=>r.errors.length||Object.values(r.samples).some(v=>v.length!==5||v.some(ms=>ms>=500))))process.exitCode=1;
