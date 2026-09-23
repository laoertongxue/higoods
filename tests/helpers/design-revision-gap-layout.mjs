import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
import crypto from 'node:crypto'
const origin=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4732',dir='output/playwright/design-revision-gap/',values=JSON.parse(fs.readFileSync(dir+'fixtures/completed.json'))
delete values.fcs_pda_session
const receipt={distSha:crypto.createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),measuredAt:new Date().toISOString(),checks:[]}
const browser=await chromium.launch();receipt.browser=browser.version()
for(const craft of ['dyeing','printing'])for(const leaf of ['work-orders','pending-receipts','pending-handover','handover-documents','wait-process-warehouse','wait-handover-warehouse']){
 const path=`/fcs/craft/${craft}/${leaf}`,width=1280,context=await browser.newContext({viewport:{width,height:720},storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}}),page=await context.newPage()
 try{await page.goto(origin+path);await expect(page.locator('main').last().locator('table').first()).toBeVisible();await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()))});const actual=await page.evaluate(()=>document.documentElement.scrollWidth);expect(actual).toBeLessThanOrEqual(width);receipt.checks.push({path,width,height:720,documentWidth:actual,result:'通过'});if(leaf==='work-orders')await page.screenshot({path:dir+craft+'-minimum-width.png'})}catch(e){receipt.checks.push({path,width,error:e.message,result:'失败'})}finally{await context.close()}
}
await browser.close();fs.writeFileSync(dir+'minimum-layout.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));if(receipt.checks.some(c=>c.result==='失败'))process.exitCode=1
