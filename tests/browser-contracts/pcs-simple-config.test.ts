import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const base=process.env.SIMPLE_TEST_URL||'http://127.0.0.1:43222',out='output/playwright/pcs-simple-config'
const a=(x:string)=>`[data-pcs-config-workspace-action="${x}"]`
test('R2-002/003/017/034: professional templates retained, simple kinds removed, supporting configuration five rounds',{timeout:180000},async()=>{
 const b=await chromium.launch(),samples:any[]=[],errors:string[]=[];await mkdir(out,{recursive:true})
 try{for(let round=0;round<5;round++){
 const c=await b.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}});await c.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v;for(const ev of ['pointerdown','input','change'])document.addEventListener(ev,()=>{(window as any).__s=performance.now()},true)})
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));const cd=await c.newCDPSession(p);await cd.send('Network.enable');await cd.send('Network.setCacheDisabled',{cacheDisabled:true})
 const ready=async()=>{await p.waitForSelector('#pcs-config-workspace-root');await p.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))})}
 const measure=async(name:string,nav=false)=>{await ready();const ms=await p.evaluate(nav=>nav?performance.now():performance.now()-(window as any).__s,nav);samples.push({round,name,ms});assert.ok(ms<=1000,`${name} ${ms}ms`)}
 await p.goto(base+'/pcs/settings/config-workspace');await measure('cold',true);await p.reload();await measure('reload',true)
 for(const section of ['templates','units','fixedConversions','packageTypes','encoding']){const button=p.locator(a('switch-dimension')+`[data-dimension-id="${section}"]`);if(!await button.count())throw Error('missing section '+section);await button.click();await measure(section);if(section==='templates'){assert.equal(await p.locator(a('kind')+'[data-kind="parts"],'+a('kind')+'[data-kind="consumable"]').count(),0);for(const kind of ['fabric','accessory','yarn']){await p.locator(a('kind')+`[data-kind="${kind}"]`).click();await measure('kind-'+kind);await p.locator(a('detail')).first().click();await measure('detail-'+kind);assert.match(await p.locator('[data-config-main]').innerText(),/主档与 SKU 属性/);await p.locator(a('back')).click();await measure('back-'+kind)}}if(section==='encoding')assert.match(await p.locator('[data-config-main]').innerText(),/MAT-CS|MAT-EP/)}
 if(round===0||round===4)await p.screenshot({path:out+`/config-${round}.png`});await c.close()
 }}finally{await writeFile(out+'/performance.json',JSON.stringify({samples,errors},null,2));await b.close()}assert.deepEqual(errors,[]);console.log('config samples',samples.length,'max',Math.max(...samples.map(x=>x.ms)))
})
