import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const server='http://127.0.0.1:43288'
const routes=[
 ['/fcs/craft/accessory/webbing/purchase-demands','采购需求'],
 ['/fcs/craft/accessory/webbing/base-orders','基础生产单'],
 ['/fcs/craft/accessory/webbing/work-orders','加工单'],
 ['/wls/accessory-receipts','辅料收货'],
 ['/wls/accessory-material-preparation','备料'],
 ['/wls/accessory-production-stock','产出库存'],
 ['/wls/accessory-production-receipts','生产实收'],
 ['/pms/material-purchase-orders','PMS面辅料采购'],
 ['/fcs/craft/accessory/webbing/continuous-return-receipts','连续余料回仓']
]
const out={generatedAt:new Date().toISOString(),server,viewport:'1280x720',browser:'Chromium',samples:[],errors:[],notApplicableEntrypoints:[]}
const browser=await chromium.launch({headless:true})
async function open(page,path,kind,run){const t=performance.now();let error='';page.on('pageerror',e=>{error=e.message});try{await page.goto(server+path,{waitUntil:'domcontentloaded'});await page.locator('body').waitFor({state:'visible'});await page.locator('body').evaluate(el=>el.getBoundingClientRect());const ms=performance.now()-t;out.samples.push({path,kind,run,ms:Number(ms.toFixed(2)),pass:ms<500,error:error||undefined});if(error)out.errors.push(`${path}:${error}`)}catch(e){out.samples.push({path,kind,run,ms:null,pass:false,error:String(e)});out.errors.push(`${path}:${e}`)}}
try{
 for(const [path] of routes){for(let i=1;i<=5;i++){const c=await browser.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();await open(p,path,'cold-navigation',i);await c.close()}}
 for(const [path] of routes){const c=await browser.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();await open(p,path,'refresh',1);for(let i=2;i<=5;i++){const t=performance.now();await p.reload({waitUntil:'domcontentloaded'});await p.locator('body').evaluate(el=>el.getBoundingClientRect());const ms=performance.now()-t;out.samples.push({path,kind:'refresh',run:i,ms:Number(ms.toFixed(2)),pass:ms<500})}await c.close()}
 for(let i=1;i<=5;i++){const c=await browser.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();await open(p,routes[0][0],'route-switch',i);const t=performance.now();await p.goto(server+routes[2][0],{waitUntil:'domcontentloaded'});await p.locator('body').evaluate(el=>el.getBoundingClientRect());const ms=performance.now()-t;out.samples.push({from:routes[0][0],path:routes[2][0],kind:'route-switch',run:i,ms:Number(ms.toFixed(2)),pass:ms<500});await c.close()}
 const c=await browser.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();for(const [path] of routes){await p.goto(server+path,{waitUntil:'domcontentloaded'});for(const label of ['查询','重置','列设置']){const b=p.getByRole('button',{name:label}).first();if(await b.count()){for(let i=1;i<=5;i++){const t=performance.now();await b.click();await p.locator('body').evaluate(el=>el.getBoundingClientRect());const ms=performance.now()-t;out.samples.push({path,kind:`interaction:${label}`,run:i,ms:Number(ms.toFixed(2)),pass:ms<500})}}else out.notApplicableEntrypoints.push({path,kind:`interaction:${label}`,reason:'当前页面没有该业务入口，不计为适用交互'})}}await c.close()
}finally{await browser.close()}
out.summary={total:out.samples.length,failed:out.samples.filter(s=>!s.pass).length,maxMs:Math.max(...out.samples.filter(s=>s.ms!==null).map(s=>s.ms)),notApplicableEntrypoints:out.notApplicableEntrypoints.length,errors:out.errors.length}
writeFileSync('docs/product-design/tmf-webbing/evidence/2026-09-20-tmf-perf-full-preview-current.json',JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify(out.summary))
