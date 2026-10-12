import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium, type Page } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const base=process.env.SIMPLE_PROD_URL||'http://127.0.0.1:43222'
const out='output/playwright/pcs-simple-materials/list-entry'
test('R2 list entry: actual list edit opens full dossier; BOM standard list retains plan navigation',async()=>{
 const browser=await chromium.launch(),samples:Array<{name:string;round:number;ms:number}>=[],errors:string[]=[]
 let failure=''
 await mkdir(out,{recursive:true})
 const finish=async(page:Page,name:string,round:number,nav=false)=>{
  await page.waitForSelector('main');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll<HTMLImageElement>('main img')].filter(i=>{const r=i.getBoundingClientRect();return i.checkVisibility()&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}).map(i=>i.decode()));await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))})
  const ms=await page.evaluate(nav=>nav?performance.now():performance.now()-(window as any).__clickStart,nav);samples.push({name,round,ms});assert.ok(ms<=1000,`${name} ${ms}ms`)
 }
 try{for(let round=0;round<5;round++){
  const context=await browser.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}});await context.addInitScript(()=>{(globalThis as any).__name=(v:unknown)=>v;document.addEventListener('pointerdown',()=>{(window as any).__clickStart=performance.now()},true)})
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));const cd=await context.newCDPSession(page);await cd.send('Network.enable');await cd.send('Network.setCacheDisabled',{cacheDisabled:true})
  for(const kind of ['consumable','parts']){
   await page.goto(base+`/pcs/materials/${kind}`);await page.waitForSelector('[data-pcs-material-archive-page]');await finish(page,kind+':list-cold',round,true)
   const edit=page.locator('main [data-nav$="/edit"]').filter({hasText:'编辑'}).first(),target=await edit.getAttribute('data-nav');assert.ok(target)
   await edit.click();await page.waitForSelector('[data-pcs-material-edit]');await finish(page,kind+':list-edit-click',round);assert.ok(page.url().endsWith(target!));assert.ok(await page.locator('[data-simple-row]').count()>=1);assert.equal(await page.locator('[data-pcs-material-archive-field="categoryName"]').count(),0);await page.getByText('保存主档与全部规格',{exact:true}).waitFor()
  }
  await page.goto(base+'/pcs/technical-data/bom-pricing');await page.waitForSelector('[data-bom-plan-list] [data-standard-list-page]');await finish(page,'bom-list:cold',round,true);assert.equal(await page.locator('[data-standard-list-table-section] th').count(),9)
  await page.reload();await page.waitForSelector('[data-bom-plan-list] [data-standard-list-page]');await finish(page,'bom-list:refresh',round,true)
  const plan=page.getByRole('link',{name:'查看整款方案'}).first();assert.ok(await plan.count());await plan.click();await page.waitForSelector('[data-bom-plan-detail]');await finish(page,'bom-list:plan-click',round,true)
  if(round===4)await page.screenshot({path:out+'/bom-plan-1280.png',fullPage:true});await context.close()
 }}catch(error){failure=String(error);throw error}finally{
  const html=await(await fetch(base)).text(),asset=html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]||'';const sha256=createHash('sha256').update(await readFile('dist'+asset)).digest('hex');const servedHash=createHash('sha256').update(Buffer.from(await(await fetch(base+asset)).arrayBuffer())).digest('hex');assert.equal(servedHash,sha256);await writeFile(out+'/report.json',JSON.stringify({passed:!failure&&!errors.length&&samples.length===35&&samples.every(s=>s.ms<=1000),functionalFailure:failure,errors,samples,servedBundle:{path:asset,sha256,matchesLocalDist:true},measurement:'Five rounds per entry/action, cache disabled, visible image/font/finite animation completion and double-frame; 1366x768 and 1280x720'},null,2));await browser.close()
 }
 assert.deepEqual(errors,[])
})
