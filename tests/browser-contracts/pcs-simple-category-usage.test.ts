import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {chromium,type Page} from '@playwright/test'

const dev=process.env.CATEGORY_USAGE_DEV_URL||'http://127.0.0.1:43221'
const production=process.env.CATEGORY_USAGE_PROD_URL||'http://127.0.0.1:43220'
const rounds=Number(process.env.CATEGORY_USAGE_ROUNDS||5),gate=process.env.CATEGORY_USAGE_FUNCTION_ONLY!=='true'
const out='output/playwright/pcs-simple-materials/category-usage'
const ca=(name:string)=>`[data-pcs-config-workspace-action="${name}"]`,cf=(name:string)=>`[data-pcs-config-workspace-field="${name}"]`
const ma=(name:string)=>`[data-pcs-material-archive-action="${name}"]`,mf=(name:string)=>`[data-pcs-material-archive-field="${name}"]`
type Created={kind:string;categoryId:string;categoryName:string;materialName:string;rootPath:string;skuPath:string;skuCode:string}
type Fixture={created:Created[];records:any[];files:Array<{id:string;bytes:number[];type:string}>;origin:string}
const config=(p:Page)=>p.locator('#pcs-config-workspace-root')
async function settled(p:Page){
 await p.waitForSelector('#pcs-config-workspace-root,[data-pcs-material-detail],[data-pcs-material-sku-detail],[data-pcs-material-edit],[data-pcs-material-sku-edit]')
 await p.waitForFunction(()=>![...document.querySelectorAll('[data-pcs-config-workspace-field]')].some(field=>field.hasAttribute('disabled')))
 await p.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('main img')].filter(image=>{const b=image.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0&&b.left<innerWidth&&b.right>0}).every(image=>image.complete&&image.naturalWidth>0))
 await p.evaluate(async()=>{await document.fonts.ready;const frames=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));await frames();await Promise.all(document.getAnimations().filter(animation=>animation.playState!=='finished'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>animation.finished.catch(()=>undefined)));await frames()})
}
const init=()=>{(globalThis as any).__name=(value:unknown)=>value;for(const event of ['pointerdown','input','change'])document.addEventListener(event,()=>{(globalThis as any).__usageStart=performance.now()},true)}

/** Only isolated Mock contexts. Every dossier/classification/package is created through its real form. */
async function prepare(browser:Awaited<ReturnType<typeof chromium.launch>>):Promise<Fixture>{
 const context=await browser.newContext({viewport:{width:1366,height:768}});await context.addInitScript(init)
 const p=await context.newPage();p.setDefaultTimeout(10000);p.on('dialog',dialog=>dialog.accept());const created:Created[]=[]
 try{for(const kind of ['consumable','parts']){
  await p.goto(dev+'/pcs/settings/config-workspace');await settled(p)
  await config(p).locator(ca('switch-dimension')+'[data-dimension-id="templates"]').click();await config(p).locator(ca('kind')+`[data-kind="${kind}"]`).click()
  await config(p).locator(ca('create')).click();const categoryName=`真实引用验收${kind}`
  await config(p).locator(cf('nameZh')).fill(categoryName);await config(p).locator(cf('sortOrder')).fill('80');await config(p).locator(ca('save')).click();await config(p).locator(ca('edit')).waitFor();await config(p).locator(ca('back')).click()
  const row=config(p).locator('tr').filter({has: p.getByText(categoryName,{exact:true})});const categoryId=await row.locator(ca('detail')).getAttribute('data-id');assert.ok(categoryId)
  await p.goto(dev+`/pcs/materials/${kind}/new`);await settled(p)
  const materialName=kind==='parts'?'实测分类引用刀片':'实测分类引用包装袋'
  await p.locator(mf('materialName')).fill(materialName);await p.locator(mf('categoryName')).selectOption(categoryName)
  await p.locator(mf('firstSpec')).fill(kind==='parts'?'10英寸':'30×25cm');await p.locator(mf('firstMainUnit')).selectOption('PCS')
  await p.locator('input[type=file][data-image-target="mainImageUrl"]').setInputFiles(kind==='parts'?'public/materials/pcs-reviewed/knife.jpg':'public/materials/packing-bag.jpg')
  await p.locator(ma('save-form')).click();await p.waitForSelector('[data-pcs-material-detail]');await settled(p);const rootPath=new URL(p.url()).pathname
  assert.ok((await p.locator('main').innerText()).includes(categoryName));await p.locator(ma('root-tab')+'[data-value="skus"]').click()
  const skuLink=p.locator('[data-nav*="/skus/"]').filter({hasText:'详情'}).first(),skuPath=await skuLink.getAttribute('data-nav');assert.ok(skuPath)
  await skuLink.click();await p.waitForSelector('[data-pcs-material-sku-detail]');await settled(p)
  const skuCode=(await p.locator('main h1').first().innerText()).trim()
  await p.locator(ma('sku-tab')+'[data-value="units"]').click();await p.locator(ma('edit-section')+'[data-package-id="new"]').click();await p.waitForSelector('[data-pcs-material-sku-edit]')
  await p.locator(mf('packageType')).selectOption('箱');await p.locator(mf('packageContent')).fill('10');await p.locator(mf('packageContentUnit')).selectOption('PCS');await p.locator(mf('packageBasis')).fill('实物确认每箱10个')
  await p.locator(ma('save-form')).click();await p.locator('[data-dialog-confirm]').click();await p.waitForSelector('[data-pcs-material-sku-detail]');await settled(p)
  await p.locator(ma('sku-tab')+'[data-value="units"]').click();assert.ok((await p.locator('main').innerText()).includes('10 PCS'))
  created.push({kind,categoryId:categoryId!,categoryName,materialName,rootPath,skuPath:skuPath!,skuCode})
 }
 const saved=await p.evaluate(async()=>{
  const db=await import('/src/data/pcs-record-db.ts'),value=await db.readPcsRecords()
  return {records:value.records,files:await Promise.all(value.files.map(async file=>({id:file.id,bytes:Array.from(new Uint8Array(await file.blob.arrayBuffer())),type:file.blob.type})))}
 });return {created,...saved,origin:dev}
 }finally{await context.close()}
}
async function install(p:Page,fixture:Fixture){
 // This copies only the isolated form-created Mock fixture into a separate test origin/context.
 await p.evaluate(async fixture=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('higood-pcs-records',2);request.onupgradeneeded=()=>{for(const store of ['records','files','operations','meta'])if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['records','files'],'readwrite');fixture.records.forEach(record=>tx.objectStore('records').put(record));fixture.files.forEach(file=>tx.objectStore('files').put({id:file.id,blob:new Blob([new Uint8Array(file.bytes)],{type:file.type})}));tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});db.close()
 },fixture)
}

test('SIMPLE-024/025: real created classifications and box packaging resolve persistent owners and direct links',{timeout:360000},async()=>{
 await mkdir(out,{recursive:true});const browser=await chromium.launch(),samples:Array<{name:string;ms:number;round:number}>=[],errors:string[]=[],results:any[]=[];let round=0
 const finish=async(p:Page,name:string,cold=false)=>{await settled(p);const ms=await p.evaluate(cold=>performance.now()-(cold?0:(globalThis as any).__usageStart),cold);samples.push({name,ms,round});if(gate)assert.ok(ms<=1000,`${name}: ${ms.toFixed(1)}ms >1000ms`)}
 const action=async(p:Page,name:string,operation:()=>Promise<unknown>,done?:()=>Promise<unknown>)=>{await operation();if(done)await done();await finish(p,name)}
 try{
  const fixture=process.env.CATEGORY_USAGE_USE_PREPARED==='true'?JSON.parse(await readFile(out+'/fixture.json','utf8')) as Fixture:await prepare(browser)
  await writeFile(out+'/fixture.json',JSON.stringify(fixture));if(process.env.CATEGORY_USAGE_PREPARE_ONLY==='true')return
  for(round=0;round<rounds;round++){
   const context=await browser.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}});await context.addInitScript(init)
   const bootstrap=await context.newPage();await bootstrap.goto(production+'/pcs/settings/config-workspace');await settled(bootstrap);await install(bootstrap,fixture);await bootstrap.close()
   const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept());const cdp=await context.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true})
   for(const created of fixture.created){
    await p.goto(production+'/pcs/settings/config-workspace');await finish(p,created.kind+':cold-config',true)
    await action(p,created.kind+':classification-section',()=>config(p).locator(ca('switch-dimension')+'[data-dimension-id="templates"]').click())
    await action(p,created.kind+':classification-kind',()=>config(p).locator(ca('kind')+`[data-kind="${created.kind}"]`).click())
    await action(p,created.kind+':classification-search',()=>config(p).locator(cf('search')).fill(created.categoryName));await action(p,created.kind+':classification-query',()=>config(p).locator(ca('query')).click())
    const row=config(p).locator('tr').filter({has:p.getByText(created.categoryName,{exact:true})});assert.equal((await row.locator('td').nth(4).innerText()).trim(),'1')
    await action(p,created.kind+':classification-detail',()=>row.locator(ca('detail')).click());await action(p,created.kind+':classification-usage',()=>config(p).locator(ca('simple-usage')).click(),()=>p.getByRole('dialog',{name:'分类使用情况'}).waitFor())
    const dialog=p.getByRole('dialog',{name:'分类使用情况'});assert.match(await dialog.innerText(),/当前引用 1 条/);const link=dialog.locator('[data-nav]').filter({hasText:created.materialName});assert.equal(await link.getAttribute('data-nav'),created.rootPath)
    if(round===0||round===4)await p.screenshot({path:out+`/${created.kind}-classification-${round===0?'1366':'1280'}.png`})
    await action(p,created.kind+':classification-owner-direct',()=>link.click(),()=>p.waitForSelector('[data-pcs-material-detail]'));assert.equal(new URL(p.url()).pathname,created.rootPath);assert.ok((await p.locator('main').innerText()).includes(created.materialName))
   }
   await p.goto(production+'/pcs/settings/config-workspace');await finish(p,'package:cold-config',true)
   await action(p,'package:section',()=>config(p).locator(ca('switch-dimension')+'[data-dimension-id="packageTypes"]').click())
   await action(p,'package:search',()=>config(p).locator(cf('search')).fill('箱'));await action(p,'package:query',()=>config(p).locator(ca('query')).click())
   const boxRow=config(p).locator('tr').filter({has:p.getByText('箱',{exact:true})});assert.equal(await boxRow.locator(ca('detail')).getAttribute('data-id'),'packageTypes-2')
   await action(p,'package:detail',()=>boxRow.locator(ca('detail')).click());await action(p,'package:usage-tab',()=>config(p).locator(ca('tab')+'[data-tab="usage"]').click())
   for(const created of fixture.created){const link=config(p).locator('[data-nav]').filter({hasText:created.skuCode});assert.equal(await link.getAttribute('data-nav'),created.skuPath);assert.match(await link.innerText(),/10 PCS/)}
   if(round===0||round===4)await p.screenshot({path:out+`/package-usage-${round===0?'1366':'1280'}.png`})
   const first=fixture.created[0]
   await action(p,'package:owner-SKU-direct',()=>config(p).locator(`[data-nav="${first.skuPath}"]`).click(),()=>p.waitForSelector('[data-pcs-material-sku-detail]'));assert.equal(new URL(p.url()).pathname,first.skuPath)
   await action(p,'package:owner-units',()=>p.locator(ma('sku-tab')+'[data-value="units"]').click());assert.ok((await p.locator('main').innerText()).includes('10 PCS'))
   // Dictionary rename/disable cannot erase packaging that already adopted the old label.
   await p.goto(production+'/pcs/settings/config-workspace');await settled(p);await config(p).locator(ca('switch-dimension')+'[data-dimension-id="packageTypes"]').click();await config(p).locator(ca('detail')+'[data-id="packageTypes-2"]').click()
   await action(p,'package:edit-dictionary',()=>config(p).locator(ca('edit')).click());await action(p,'package:rename-dictionary',()=>config(p).locator(cf('nameZh')).fill('纸箱引用验收'))
   await action(p,'package:disable-dictionary',()=>config(p).locator(cf('status')).selectOption('DISABLED'));await action(p,'package:save-dictionary',()=>config(p).locator(ca('save')).click(),()=>config(p).locator(ca('edit')).waitFor())
   await action(p,'package:disabled-history-usage',()=>config(p).locator(ca('tab')+'[data-tab="usage"]').click())
   for(const created of fixture.created)assert.equal(await config(p).locator('[data-nav]').filter({hasText:created.skuCode}).getAttribute('data-nav'),created.skuPath)
   await p.reload();await finish(p,'package:history-refresh',true);await config(p).locator(ca('switch-dimension')+'[data-dimension-id="packageTypes"]').click();await config(p).locator(ca('detail')+'[data-id="packageTypes-2"]').click();await action(p,'package:history-reopened',()=>config(p).locator(ca('tab')+'[data-tab="usage"]').click())
   for(const created of fixture.created)assert.equal(await config(p).locator('[data-nav]').filter({hasText:created.skuCode}).getAttribute('data-nav'),created.skuPath)
   results.push({round,categoryReferences:fixture.created.map(created=>({categoryId:created.categoryId,root:created.rootPath,count:1})),packageOwnerPaths:fixture.created.map(created=>created.skuPath),boxCountPerOwner:10,disabledDictionaryRetainsHistory:true})
   await context.close()
  }
 }finally{
  await writeFile(out+'/performance.json',JSON.stringify({dev,production,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDiffSha256:createHash('sha256').update(execFileSync('git',['diff','--binary','--','src'],{maxBuffer:20*1024*1024})).digest('hex'),bundle:readFileSync('dist/index.html','utf8').match(/src="([^" ]*\/assets\/[^" ]+\.js)"/)?.[1],browser:browser.version(),cache:'disabled',mode:process.env.CATEGORY_USAGE_PREPARE_ONLY==='true'?'isolated-form-fixture-only':'production-five-round-usage',rounds,samples,errors,results,gate},null,2));await browser.close()
 }
 assert.deepEqual(errors,[]);if(gate){const groups=new Map<string,Set<number>>();for(const sample of samples){const seen=groups.get(sample.name)||new Set<number>();seen.add(sample.round);groups.set(sample.name,seen)}assert.ok(groups.size>0,'must measure semantic action groups');for(const [name,seen] of groups)assert.ok(seen.size>=5,`${name}: requires five independent round samples`)};console.log('category usage',samples.length,'max',Math.max(...samples.map(sample=>sample.ms)))
})
