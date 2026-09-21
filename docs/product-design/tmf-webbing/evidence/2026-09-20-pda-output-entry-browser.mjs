import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
const browser=await chromium.launch({headless:true})
const result={scope:'入口与空数据PDA加载；不代表有数据全操作性能',viewport:{width:360,height:640},server:'Vite preview 43288；各冷加载使用新隔离浏览器上下文',cold:[],refresh:[],menu:[],errors:[]}
const url='http://127.0.0.1:43288/wls/raw/pda/tmf-output-receipts'
try {
 for(let i=0;i<5;i++){
  const context=await browser.newContext({viewport:result.viewport})
  const page=await context.newPage()
  page.on('pageerror',e=>result.errors.push(e.message))
  const ready=async()=>{
   await page.locator('[data-tmf-pda-receipt-root] [name="scan"]').waitFor()
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  }
  await page.goto(url);await ready();result.cold.push(await page.evaluate(()=>performance.now()))
  await page.reload();await ready();result.refresh.push(await page.evaluate(()=>performance.now()))
  assert.match(await page.locator('[data-tmf-pda-receipt-root]').innerText(),/暂无待收/)
  await page.locator('[data-tmf-pda-receipt-action="exit"]').click()
  const entry=page.locator('[data-wls-raw-pda-task="织带产出收货"]');await entry.waitFor()
  await page.evaluate(()=>{window.__tmfMenuStart=0;document.addEventListener('click',e=>{if(e.target.closest('[data-wls-raw-pda-task="织带产出收货"]'))window.__tmfMenuStart=performance.now()},true)})
  await entry.click();await ready()
  result.menu.push(await page.evaluate(()=>performance.now()-window.__tmfMenuStart))
  assert.equal(await page.locator('[data-pda-standalone-root]').count(),1)
  await page.locator('[data-tmf-pda-receipt-action="scan"]').click()
  assert.match(await page.locator('[role="alert"]').innerText(),/选择/)
  await context.close()
 }
 assert.deepEqual(result.errors,[])
 result.maxima=Object.fromEntries(['cold','refresh','menu'].map(k=>[k,Math.max(...result[k])]))
 result.under500=Object.values(result.maxima).every(n=>n<500)
 console.log(JSON.stringify(result,null,2))
}finally{writeFileSync('output/playwright/tmf-webbing/pda-output-entry-evidence.json',JSON.stringify(result,null,2));await browser.close()}
