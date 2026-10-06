import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { chromium, type Page } from '@playwright/test'
const base = process.env.SAMPLE_PERF_URL || 'http://127.0.0.1:4207', out = 'output/playwright/sample-hg-label'
test('HG-009: affected label entries, preview, generation and all controls <=1000ms, five samples', {timeout:180000}, async()=>{
 const browser=await chromium.launch(),samples:Array<{name:string;ms:number}>=[],errors:string[]=[]
 const init=()=>{(globalThis as any).__name=(v:unknown)=>v;for(const event of ['pointerdown','input','change'])document.addEventListener(event,()=>{(globalThis as any).__hgStart=performance.now()},true);const old=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow')!;Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{configurable:true,get(){const w=old.get!.call(this);if(w)w.print=()=>{(globalThis as any).__hgPrintReady=true};return w}})}
 const ready=async(p:Page)=>{await p.waitForSelector('[data-hg-label-page], [data-pcs-sample-page-root]');await p.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('main img')].every(i=>i.complete&&i.naturalWidth>0));await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));assert.ok(!/资料暂时无法读取/.test(await p.locator('main').innerText()))}
 const save=async(p:Page,name:string,nav=false)=>{await ready(p);const ms=await p.evaluate(nav=>nav?performance.now():performance.now()-(globalThis as any).__hgStart,nav);samples.push({name,ms});assert.ok(ms<=1000,`${name}: ${ms}ms >1s`)}
 const act=async(p:Page,name:string,action:()=>Promise<unknown>,done?:()=>Promise<unknown>)=>{await action();if(done)await done();await save(p,name)}
 try{
  for(let repeat=0;repeat<5;repeat++){
   const c=await browser.newContext({viewport:{width:1366,height:768}});await c.addInitScript(init);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));const cd=await c.newCDPSession(p);await cd.send('Network.enable');await cd.send('Network.setCacheDisabled',{cacheDisabled:true})
   await p.goto(base+'/pcs/samples/label/smp-001');await save(p,'label:cold',true)
   await p.reload();await save(p,'label:reload',true)
   for(const route of ['inventory','view','detail/smp-001']){
    await p.goto(base+'/pcs/samples/'+route);await ready(p)
    await act(p,route+':print-entry-SPA',()=>p.locator('[data-nav^="/pcs/samples/label/"]').first().click(),()=>p.waitForSelector('[data-hg-label-page]'))
    await act(p,'label:return-detail',()=>p.locator('[data-nav^="/pcs/samples/detail/"]').click(),()=>p.waitForSelector('[data-pcs-sample-page-root]'))
   }
   await p.locator('[data-nav^="/pcs/samples/label/"]').click();await ready(p)
   for(const [field,values] of [['width',['55','0','120','60']],['height',['35','NaN','100','40']],['copies',['3','0','1.5','101','100','1']]] as const){
    for(const value of values){await act(p,`label:${field}-${value}`,()=>p.locator(`[data-pcs-sample-field="label-${field}"]`).fill(value==='NaN'?'':value));if(value==='0'||value==='NaN'||value==='1.5'||value==='101')await act(p,`label:blocked-print-${field}-${value}`,()=>p.locator('[data-pcs-sample-action="print-label"]').click())}
   }
   await act(p,'label:reset',()=>p.locator('[data-pcs-sample-action="reset-label-size"]').click())
   for(const copies of ['1','100']){
    await act(p,'label:copies-before-print-'+copies,()=>p.locator('[data-pcs-sample-field="label-copies"]').fill(copies));await p.evaluate(()=>{(globalThis as any).__hgPrintReady=false})
    await act(p,'label:print-generation-'+copies,()=>p.locator('[data-pcs-sample-action="print-label"]').click(),()=>p.waitForFunction(()=>(globalThis as any).__hgPrintReady))
    await act(p,'label:print-cancel',()=>p.evaluate(()=>{(globalThis as any).__hgStart=performance.now();document.querySelector<HTMLIFrameElement>('[data-hg-print-frame]')?.contentWindow?.dispatchEvent(new Event('afterprint'))}),()=>p.waitForSelector('[data-hg-print-frame]',{state:'detached'}))
   }
   await c.close()
  }
  console.log('PASS',samples.length,'samples, max',Math.max(...samples.map(s=>s.ms)))
 }finally{await writeFile(out+'/performance.json',JSON.stringify({base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),viewport:'1366x768',browser:browser.version(),cache:'disabled in isolated contexts',samples,errors},null,2));await browser.close()}
 assert.deepEqual(errors,[])
})
