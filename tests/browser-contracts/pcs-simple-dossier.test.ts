import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const base=process.env.SIMPLE_TEST_URL||'http://127.0.0.1:43222',out='output/playwright/pcs-simple-dossier'
const a=(x:string)=>`[data-pcs-material-archive-action="${x}"]`,f=(x:string)=>`[data-pcs-material-archive-field="${x}"]`
test('R2 full dossier: multiple specifications, copied Blob survival, failure/retry, refresh and complete editor',{timeout:180000},async()=>{
 const b=await chromium.launch(),samples:any[]=[],errors:string[]=[];await mkdir(out,{recursive:true})
 try{for(let round=0;round<5;round++)for(const kind of ['parts','consumable']){
 const c=await b.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}});await c.addInitScript(()=>{(globalThis as any).__name=(v:any)=>v;for(const ev of ['pointerdown','input','change'])document.addEventListener(ev,()=>{(window as any).__s=performance.now()},true)})
 const p=await c.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('BROKENIMG'))console.log(m.text())});const cd=await c.newCDPSession(p);await cd.send('Network.enable');await cd.send('Network.setCacheDisabled',{cacheDisabled:true});
 const measure=async(name:string,nav=false)=>{await p.waitForSelector('[data-pcs-material-edit], [data-pcs-material-detail], [data-pcs-material-archive-page]');await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await p.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('main img')].filter(i=>{const r=i.getBoundingClientRect();return i.checkVisibility()&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth}).every(i=>i.complete&&i.naturalWidth>0));await p.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));await Promise.all([...document.querySelectorAll<HTMLImageElement>('main img')].filter(i=>i.checkVisibility()&&i.getBoundingClientRect().width>0&&i.getBoundingClientRect().height>0&&i.getBoundingClientRect().bottom>0&&i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().right>0&&i.getBoundingClientRect().left<innerWidth).map(async i=>{try{await i.decode()}catch(e){console.log('BROKENIMG',i.src,i.outerHTML,'loaded',i.complete,i.naturalWidth,'connected',i.isConnected,'bytes',await fetch(i.src).then(r=>r.blob()).then(b=>b.size).catch(String));throw e}}));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))) });const ms=await p.evaluate(nav=>nav?performance.now():performance.now()-(window as any).__s,nav);samples.push({round,name:kind+':'+name,ms});console.log(round,kind,name,ms);assert.ok(ms<=1000,`${kind}:${name} ${ms}ms`)}
 const action=async(name:string,fn:()=>Promise<unknown>)=>{await fn();await measure(name)}
 await p.goto(base+`/pcs/materials/${kind}/new`);await measure('new-direct',true)
 assert.equal(await p.locator(f('categoryName')).count(),0)
 await action('name',()=>p.locator(f('materialName')).fill(`同页-${kind}-${round}`))
 await p.getByText('图片与补充',{exact:true}).first().click();await p.locator('input[type=file][data-image-target="simple.0.skuImageUrl"]').setInputFiles('public/materials/pcs-reviewed/knife.jpg');await measure('row-upload')
 await action('copy-row',()=>p.locator(a('simple-row-copy')).first().click());await p.getByText('图片与补充',{exact:true}).first().click();await p.locator('input[type=file][data-image-target="simple.0.skuImageUrl"]').setInputFiles('public/materials/pcs-reviewed/knife.jpg');await measure('replace-original-image');await action('remove-original',()=>p.locator(a('simple-row-remove')).first().click());await action('spec-one',()=>p.locator(f('simple.0.specName')).fill('1.3mm 120×60cm'))
 await action('add-row',()=>p.locator(a('simple-row-add')).click());await action('spec-two',()=>p.locator(f('simple.1.specName')).fill('1.3mm 120×60cm'))
 await p.locator(a('save-form')).click();await p.getByRole('status').filter({hasText:'重复'}).waitFor();await measure('duplicate-block');assert.equal(await p.locator('[data-pcs-material-edit]').count(),1)
 await action('spec-two-distinct',()=>p.locator(f('simple.1.specName')).fill('1.5mm 120×60cm'));await action('purchase-zero',()=>p.locator(f('simple.1.purchase')).fill('0'));await action('transport-zero',()=>p.locator(f('simple.1.transport')).fill('0'))
 await p.getByText('维护通用图片',{exact:true}).click();await p.locator('input[type=file][data-image-target="mainImageUrl"]').setInputFiles('public/materials/pcs-reviewed/knife.jpg');await measure('root-upload')
 // Force the durable write transaction to abort once. Input and original records must survive.
 await p.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).__put=original;IDBObjectStore.prototype.put=function(...args:any[]){IDBObjectStore.prototype.put=original;this.transaction.abort();return original.apply(this,args as any)}})
 await p.locator(a('save-form')).click();await p.getByRole('status').filter({hasText:/保存|事务|中止/}).waitFor();await measure('abort-no-success');assert.equal(await p.locator(f('materialName')).inputValue(),`同页-${kind}-${round}`);assert.equal(await p.locator('[data-simple-row]').count(),2)
 await p.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__put})
 await p.locator(a('save-form')).dblclick();await p.waitForSelector('[data-pcs-material-detail]');await measure('retry-save');const root=p.url()
 await p.locator(a('root-tab')+'[data-value="skus"]').click();await measure('saved-specs');assert.equal(await p.locator('[data-nav*="/skus/"]').filter({hasText:'详情'}).count(),2)
 await p.reload();await measure('refresh',true);await p.locator(a('root-tab')+'[data-value="skus"]').click();await measure('specs-after-refresh');assert.equal(await p.locator('[data-nav*="/skus/"]').filter({hasText:'详情'}).count(),2)
 await p.goto(root+'/edit');await measure('all-specs-edit',true);assert.equal(await p.locator('[data-simple-row]').count(),2);assert.equal(await p.locator('[data-simple-row] '+a('simple-row-remove')).count(),0)
 await action('append-third',()=>p.locator(a('simple-row-add')).click());await action('third-model',()=>p.locator(f('simple.2.specName')).fill('2mm 120×60cm'));if(round===0||round===4)await p.screenshot({path:out+`/${kind}-editor-${round}.png`,fullPage:true});await p.locator(a('save-form')).click();await p.waitForSelector('[data-pcs-material-detail]');await measure('save-three');await p.locator(a('root-tab')+'[data-value="skus"]').click();await measure('specs-after-third-save');assert.equal(await p.locator('[data-nav*="/skus/"]').filter({hasText:'详情'}).count(),3);await measure('three-specs-read')
 await c.close()
 }}finally{await writeFile(out+'/performance.json',JSON.stringify({samples,errors},null,2));await b.close()}assert.deepEqual(errors,[]);console.log('dossier samples',samples.length,'max',Math.max(...samples.map(x=>x.ms)))
})

test('R2-010: actual editor keeps one row, accepts 100 rows and rejects row 101 in both kinds',{timeout:240000},async()=>{
 const browser=await chromium.launch(),samples:Array<{name:string;round:number;ms:number}>=[]
 try{for(let round=0;round<5;round++)for(const kind of ['parts','consumable']){
 const context=await browser.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}}),page=await context.newPage();await page.goto(base+`/pcs/materials/${kind}/new`);await page.waitForSelector('[data-pcs-material-edit]')
 const action=async(name:string,run:()=>Promise<unknown>)=>{await page.evaluate(()=>{(window as any).__limitStart=performance.now()});await run();await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const ms=await page.evaluate(()=>performance.now()-(window as any).__limitStart);samples.push({name:kind+':'+name,round,ms});assert.ok(ms<=1000,`${name} ${ms}ms`)}
 await action('minimum-one-block',()=>page.locator(a('simple-row-remove')).click());await page.getByRole('status').filter({hasText:'至少保留一行'}).waitFor();assert.equal(await page.locator('[data-simple-row]').count(),1)
 for(let count=2;count<=100;count++){await action(`add-row-${count}`,()=>page.locator(a('simple-row-add')).click());assert.equal(await page.locator('[data-simple-row]').count(),count)}
 await action('maximum-100-block',()=>page.locator(a('simple-row-add')).click());await page.getByRole('status').filter({hasText:'最多100行'}).waitFor();assert.equal(await page.locator('[data-simple-row]').count(),100)
 await action('copy-at-100-block',()=>page.locator(a('simple-row-copy')).first().click());assert.equal(await page.locator('[data-simple-row]').count(),100)
 await context.close()
 }}finally{await writeFile(out+'/row-limits-performance.json',JSON.stringify({base,samples},null,2));await browser.close()}
})
