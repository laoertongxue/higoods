import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='output/playwright/design-revision-gap/',origin=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4732',runId=new Date().toISOString().replaceAll(':','-');
const receipt={runId,distSha:crypto.createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),viewport:{width:1366,height:768},routes:[]};
const browser=await chromium.launch();receipt.browser=browser.version();
for(const craft of ['dyeing','printing'])for(const leaf of ['work-orders','pending-receipts','pending-handover','handover-documents','wait-process-warehouse','wait-handover-warehouse']){
 const path=`/fcs/craft/${craft}/${leaf}`;if(process.argv[2]&&!path.includes(process.argv[2]))continue;
 const row={path,samples:{cold:[],reload:[],switchAway:[],switchBack:[]},errors:[],images:[]};receipt.routes.push(row);
 for(let round=0;round<5;round++){
  const values=JSON.parse(fs.readFileSync(dir+'fixtures/completed.json'));delete values.fcs_pda_session;
  const c=await browser.newContext({viewport:receipt.viewport,storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}});
  await c.addInitScript(()=>{const probe=async()=>{const main=[...document.querySelectorAll('main')].at(-1);if(!main?.querySelector('table tbody')||main.innerText.includes('正在加载')){requestAnimationFrame(probe);return}try{await Promise.all([...main.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()))}catch(e){window.__imageFailure=String(e)}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.__ready=performance.now()};requestAnimationFrame(probe)});
  const page=await c.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  try{await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready);row.samples.cold.push(await page.evaluate(()=>window.__ready));if(round===0){row.text=(await page.locator('main').last().innerText()).slice(0,1200);row.width=await page.evaluate(()=>document.documentElement.scrollWidth)}row.images.push(await page.evaluate(()=>window.__imageFailure||null));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ready);row.samples.reload.push(await page.evaluate(()=>window.__ready));
   const currentMain=page.locator('main').last(),originalText=await currentMain.innerText();
   const sibling=`/fcs/craft/${craft}/${leaf==='work-orders'?'pending-receipts':'work-orders'}`;
   const navigate=async(target,key,before)=>{
    const button=page.locator(`[data-tab-href="${target}"]`).filter({visible:true}).first();
    await expect(button).toBeVisible();
    await page.evaluate(()=>document.addEventListener('click',e=>window.__routeStart=e.timeStamp,{capture:true,once:true}));
    await button.click();await expect(page).toHaveURL(new RegExp(target+'(?:\\?|$)'));
    await expect(page.locator('main').last().locator('table tbody').filter({visible:true}).first()).toBeVisible();
    await expect(page.locator('main').last()).not.toHaveText(before);
    const ms=await page.evaluate(async()=>{const root=[...document.querySelectorAll('main')].at(-1);await Promise.all([...root.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-window.__routeStart});row.samples[key].push(ms)
   };
   await navigate(sibling,'switchAway',originalText);
   const siblingText=await page.locator('main').last().innerText();await navigate(path,'switchBack',siblingText);
}catch(e){row.errors.push(`round ${round+1}: ${e.message}`)}finally{await c.close();fs.writeFileSync(dir+'factory-route-performance-'+runId+'.json',JSON.stringify(receipt,null,2))}
 }
 console.log(path,JSON.stringify(Object.fromEntries(Object.entries(row.samples).map(([k,v])=>[k,Math.max(...v)]))),row.errors)
}
await browser.close();

// Preserve all raw samples and fail the command when any measured gate fails.
if (receipt.routes.some(r => r.errors.length || r.images.some(Boolean) || Object.entries(r.samples).some(([k,v])=>v.length!==5||v.some(ms=>k==='cold'&&r.path.endsWith('/work-orders')?ms>1000:ms>=500)))) process.exitCode = 1;
