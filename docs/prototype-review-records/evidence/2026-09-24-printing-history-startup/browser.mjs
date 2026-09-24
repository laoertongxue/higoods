import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(process.cwd()+'/package.json');const {chromium}=require('@playwright/test');
const origin=process.env.FIX_ORIGIN||'http://127.0.0.1:4734';
const stored=JSON.parse(fs.readFileSync('/tmp/printing-startup-fix/historical-storage.json'));
const browser=await chromium.launch();
const report={browser:browser.version(),origin,viewport:{width:1366,height:768},routes:[]};
for(const mode of ['historical','fresh'])for(const route of ['/','/fcs/craft/printing/work-orders','/fcs/craft/printing/handover-documents']){
 const row={mode,route,cold:[],reload:[],errors:[]};report.routes.push(row);
 for(let n=0;n<5;n++){
  const c=await browser.newContext({viewport:report.viewport,storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(mode==='historical'?stored:{}).map(([name,value])=>({name,value}))}]}});
  await c.addInitScript(()=>{const probe=async()=>{const main=[...document.querySelectorAll('main')].at(-1);if(!main||main.innerText.length<50||main.innerText.includes('正在加载')){requestAnimationFrame(probe);return}try{await Promise.all([...main.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()))}catch(e){window.__imageFailure=String(e)}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.__ready=performance.now()};requestAnimationFrame(probe)});
  const p=await c.newPage();p.on('pageerror',e=>row.errors.push(e.message));
  try{
   await p.goto(origin+route,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__ready,{},{timeout:15000});row.cold.push(await p.evaluate(()=>window.__ready));
   assert.equal(await p.evaluate(()=>window.__imageFailure||null),null);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__ready);row.reload.push(await p.evaluate(()=>window.__ready));
   if(mode==='historical'){
    const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('higood.formal-merged-handout-actions.v1')));
    const before=JSON.parse(stored['higood.formal-merged-handout-actions.v1']);
    for(const key of Object.keys(before).filter(k=>Array.isArray(before[k]))) {const map=new Map(after[key]);for(const [id,record] of before[key])assert.deepEqual(map.get(id),record,`${key}/${id} preserved`)}
   }
   if(n===0){row.text=(await p.locator('main').last().innerText()).slice(0,500);await p.screenshot({path:`/tmp/printing-startup-fix/${mode}-${route.split('/').pop()||'home'}.png`})}
  }catch(e){row.errors.push(e.message)}finally{await c.close()}
 }
 console.log(mode,route,JSON.stringify(row));fs.writeFileSync('/tmp/printing-startup-fix/browser-results.json',JSON.stringify(report,null,2));
}
await browser.close();
assert.ok(report.routes.every(r=>!r.errors.length&&r.cold.length===5&&r.reload.length===5),'browser regressions');
