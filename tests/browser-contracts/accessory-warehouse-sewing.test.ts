import { seedAccessorySewingFixture as seed } from './helpers/accessory-sewing-fixture.ts'
import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
let server: ViteDevServer, browser: Browser, base = ''
const output = resolve('output/verification/accessory-warehouse-sewing')
before(async () => {
 await mkdir(output,{recursive:true})
 server=await createServer({root:process.cwd(),server:{port:0,watch:{ignored:['**/*']}}});await server.listen();const address=server.httpServer!.address() as {port:number};base=`http://127.0.0.1:${address.port}`
 browser=await chromium.launch({headless:true})
})
after(async()=>{await browser?.close();await server?.close()})
async function dumpPerfFixture(page: Page, filename: string, scenario: string): Promise<void> {
 const fixture=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('higood-cutting-records-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  const stores=await new Promise<Record<string,any[]>>((resolve,reject)=>{const names=Array.from(db.objectStoreNames),tx=db.transaction(names,'readonly'),rows:Record<string,any[]>={};for(const name of names){const request=tx.objectStore(name).getAll();request.onsuccess=()=>{rows[name]=request.result}}tx.oncomplete=()=>resolve(rows);tx.onabort=()=>reject(tx.error)})
  stores.files=await Promise.all((stores.files||[]).map(async row=>{const {blob,...metadata}=row;return {...metadata,type:blob.type,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))}}))
  const localStorageEntries:Record<string,string>={};for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index)!;localStorageEntries[key]=localStorage.getItem(key)!}
  const result={databases:[{name:db.name,version:db.version,stores}],localStorage:localStorageEntries};db.close();return result
 })
 await writeFile(resolve(output,filename),JSON.stringify({format:'higoods-browser-fixture-v1',scenario,stage:'已收货；尚未建立领料、后道清单或打印/实交',generatedAt:new Date().toISOString(),...fixture},null,2))
}
async function readFacts(page: Page) {
 return page.evaluate(async()=>{
  const api=await import('/src/data/wls/accessory-warehouse-sewing.ts');const rec=await import('/src/data/wls/accessory-warehouse-records.ts');const hand=await import('/src/data/fcs/sewing-material-handover.ts')
  await api.prepareAccessorySewing()
  return { snapshot:rec.currentAccessorySnapshot(),pickups:api.listAccessorySewingPickups(),a:hand.getSewingMaterialHandoverProjection('AW-TEST-ASG-0'),b:hand.getSewingMaterialHandoverProjection('AW-TEST-ASG-1'),legacy:localStorage.getItem('higood:ppic:sewing-pickup-slips:v1') }
 })
}
async function printA(page: Page, kind = 'ACCESSORY') {
 await page.goto(base+'/fcs/sewing-outsourcing/tasks');await page.locator('[data-ppic-task-page]').waitFor()
 await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A');await page.locator('[data-ppic-task-action="query"]').click()
 const row=page.locator('[data-ppic-task-page] tbody tr').filter({hasText:'AW-SEW-A'})
 await expect(row).toHaveCount(1);await row.locator('[data-ppic-task-action="print-pickup"]').click()
 await expect(page).toHaveURL(/print.*PICKUP_SLIP|print.*pickup|print-preview/)
 if(kind==='FABRIC_ACCESSORY'){await expect(page.locator('.print-card-title')).toHaveText('面辅料领料单');await expect(page.locator('.print-table tbody tr')).toHaveCount(7);await expect(page.locator('.print-preview-root img')).toHaveCount(8);await expect.poll(()=>page.locator('.print-preview-root img').evaluateAll((nodes:HTMLImageElement[])=>nodes.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)}
 return page.evaluate(async(kind)=>{const slips=await import('/src/data/fcs/sewing-pickup-slips.ts');return slips.getCurrentSewingPickupSlip('AW-TEST-ASG-0',kind)!},kind)
}
async function openPickup(page: Page, pickupId: string, versionId: string) {
 await page.goto(base+`/wls/accessory-warehouses/hilon/pickups?pickupId=${encodeURIComponent(pickupId)}&versionId=${encodeURIComponent(versionId)}`)
 await page.getByRole('dialog',{name:'登记车缝领料实交'}).waitFor()
}

test('P30/P31 真实UI建任务范围、PPIC打印、分次实交与同源刷新，旧码与PPIC阻断，保存失败保留输入', {timeout:120000}, async()=>{
 const context=await browser.newContext({viewport:{width:1024,height:768}});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 try {
  await page.goto(base+'/wls/accessory-warehouses/gtp/preparation');await page.locator('[data-accessory-preparation-root]').waitFor();const fixture=await seed(page);await dumpPerfFixture(page,'perf-fixture.json','SEWING')
  await page.goto(base+'/wls/accessory-warehouses/hilon/pickups');await page.locator('[data-accessory-pickup-root]').waitFor();await page.locator('[data-accessory-pickup-action="create"]').filter({hasText:'建立任务领料清单'}).click()
  await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
  let facts=await readFacts(page);assert.equal(facts.pickups.length,2)
  const a=facts.pickups.find((row:any)=>row.assignmentId==='AW-TEST-ASG-0')!,b=facts.pickups.find((row:any)=>row.assignmentId==='AW-TEST-ASG-1')!
  assert.deepEqual(a.lines.map((row:any)=>row.requiredQty),[40,40,40,0.4]);assert.deepEqual(b.lines.map((row:any)=>row.requiredQty),[60,60,60,0.6])
  const posts=facts.snapshot.records.filter((row:any)=>row.collection==='accessory-warehouse:transfer'&&row.value.kind==='SITE_TO_POST').map((row:any)=>row.value)
  assert.equal(posts.length,2);assert.ok(posts.every((row:any)=>row.lines.every((line:any)=>line.purpose==='其他')))
  assert.deepEqual(posts.map((row:any)=>row.lines.map((line:any)=>line.qty)),[[40,80],[60,120]])
  const first=await printA(page);assert.equal(first.versionLabel,'V1');assert.equal(first.lines.length,4)
  await page.evaluate(async()=>{const pda=await import('/src/data/fcs/store-domain-pda.ts');const user=pda.listFactoryPdaUsers('ID-F004').find(row=>row.roleId==='ROLE_ADMIN')!;pda.setPdaSession(pda.createPdaSessionFromUser(user))})
  await page.goto(base+`/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(first.versionId)}`)
  await expect(page.getByRole('link',{name:/办理车缝领料/})).toBeVisible();await page.getByRole('link',{name:/办理车缝领料/}).click()
  await page.getByRole('dialog',{name:'登记车缝领料实交'}).waitFor()
  await page.getByLabel('价格吊牌本次实交',{exact:true}).fill('7');await page.getByRole('button',{name:'确认本次实交',exact:true}).click();await expect(page.getByRole('status')).toContainText('本次车缝领料已保存')
  facts=await readFacts(page);assert.equal(facts.a.handoverEvents.length,1);assert.equal(facts.b.handoverEvents.length,0);assert.equal(facts.a.lines.find((row:any)=>row.materialCode==='AW-DEMO-PRICE-TAG')?.cumulativeHandedOverQty,7);assert.equal(facts.legacy,null)
  const stock=facts.snapshot.records.find((row:any)=>row.collection==='accessory-warehouse:stock'&&row.value.materialSku==='AW-DEMO-PRICE-TAG')!.value as any;assert.equal(stock.onHandQty,93)
  await page.goto(base+'/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0');await page.locator('[data-sewing-material-page]').waitFor()
  await expect(page.locator('[data-sewing-material-page]')).toContainText('7 张')
  await page.reload();await expect(page.locator('[data-sewing-material-page]')).toContainText('7 张')
  const second=await printA(page);assert.equal(second.versionLabel,'V2')
  await page.goto(base+`/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(first.versionId)}`);await expect(page.getByText('该凭证已失效或领料清单已变更，请扫描 PPIC 当前版本。')).toBeVisible();await expect(page.locator('[data-pda-handover-action="confirm-sewing-pickup"]')).toHaveCount(0)
  await openPickup(page,a.id,first.versionId);await expect(page.getByRole('dialog')).toContainText('扫码版本已失效');await page.getByLabel('价格吊牌本次实交',{exact:true}).fill('3');await page.getByRole('button',{name:'确认本次实交',exact:true}).click();await expect(page.locator('[data-aw-pickup-error]')).toContainText('版本已失效');await expect(page.getByLabel('价格吊牌本次实交',{exact:true})).toHaveValue('3')
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click()
  await page.locator('[data-accessory-pickup-field="role"]').selectOption('PPIC');await expect(page.locator('[data-accessory-pickup-action="handover"]').first()).toBeDisabled();await page.locator('[data-accessory-pickup-field="role"]').selectOption('仓管')
  await openPickup(page,a.id,second.versionId);await page.getByLabel('价格吊牌本次实交',{exact:true}).fill('5')
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;(globalThis as any).__awOriginalTransaction=original;IDBDatabase.prototype.transaction=function(...args:Parameters<typeof original>){const tx=original.apply(this,args);if(tx.mode==='readwrite')queueMicrotask(()=>tx.abort());return tx}})
  await page.getByRole('button',{name:'确认本次实交',exact:true}).click();await expect(page.locator('[data-aw-pickup-error]')).not.toBeEmpty();await expect(page.getByLabel('价格吊牌本次实交',{exact:true})).toHaveValue('5')
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=(globalThis as any).__awOriginalTransaction})
  facts=await readFacts(page);assert.equal(facts.a.handoverEvents.length,1);assert.equal(facts.snapshot.records.find((row:any)=>row.collection==='accessory-warehouse:stock'&&row.value.materialSku==='AW-DEMO-PRICE-TAG')!.value.onHandQty,93)
  await page.screenshot({path:resolve(output,'failed-input-retained.png'),fullPage:true})
  await page.getByRole('button',{name:'确认本次实交',exact:true}).click();await expect(page.getByRole('status')).toContainText('本次车缝领料已保存')
  await page.reload();await page.locator('[data-accessory-pickup-root]').waitFor();facts=await readFacts(page);assert.equal(facts.a.handoverEvents.length,2);assert.equal(facts.b.handoverEvents.length,0);assert.equal(facts.a.lines.find((row:any)=>row.materialCode==='AW-DEMO-PRICE-TAG')?.cumulativeHandedOverQty,12)
  await page.route('**/materials/accessory-flow/price-tag.jpg',route=>route.fulfill({status:404,headers:{'cache-control':'no-store'},body:'image fault injection'}))
  await page.getByRole('dialog').getByLabel('查看价格吊牌大图').click();await expect(page.getByRole('dialog',{name:'价格吊牌'})).toContainText('图片加载失败，关闭后点击缩略图重试。');await page.screenshot({path:resolve(output,'pickup-image-failure.png'),fullPage:true});await page.keyboard.press('Escape')
  await page.unroute('**/materials/accessory-flow/price-tag.jpg')
  await page.getByRole('dialog').getByLabel('查看价格吊牌大图').click();await expect(page.getByRole('dialog',{name:'价格吊牌'})).toBeVisible();await expect.poll(()=>page.getByRole('dialog',{name:'价格吊牌'}).locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);await page.keyboard.press('Escape')
  const layout=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(layout.document<=layout.width)
  await page.screenshot({path:resolve(output,'task-a-pickup-1024.png'),fullPage:true})
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'sewing-ui.json'),JSON.stringify({at:new Date().toISOString(),base,fixture,first,second,pickups:facts.pickups,handovers:{a:facts.a,b:facts.b},layout,pageErrors:errors},null,2))
 } catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error} finally{await context.close()}
})

test('P31 合并任务同张凭证保留面料与辅料，原入口仅办面料，同原账回读且不假扣辅料库存', {timeout:120000}, async()=>{
 const context=await browser.newContext();const page=await context.newPage();await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 try {
  await page.goto(base+'/wls/accessory-warehouses/gtp/preparation');await page.locator('[data-accessory-preparation-root]').waitFor();await seed(page,true);await dumpPerfFixture(page,'perf-fixture-mixed.json','CUTTING_SEWING_IRONING_PACKING')
  await page.goto(base+'/wls/accessory-warehouses/hilon/pickups');await page.locator('[data-accessory-pickup-action="create"]').click();await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
  const version=await printA(page,'FABRIC_ACCESSORY');assert.equal(version.lines.length,7);assert.equal(version.lines.filter((row:any)=>row.objectType==='面料').length,1);assert.equal(version.lines.filter((row:any)=>row.objectType==='辅料').length,6)
  const beforeFabric=await page.evaluate(async()=>{const rec=await import('/src/data/wls/accessory-warehouse-records.ts');return rec.currentAccessorySnapshot()})
  await page.evaluate(async()=>{const pda=await import('/src/data/fcs/store-domain-pda.ts');pda.setPdaSession(pda.createPdaSessionFromUser(pda.listFactoryPdaUsers('ID-F004').find(row=>row.roleId==='ROLE_ADMIN')!))})
  await page.goto(base+`/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(version.versionId)}`);await page.locator('[data-sewing-pickup-scan-page]').waitFor();await expect(page.locator('[data-sewing-pickup-line-id]')).toHaveCount(1);await page.locator('[data-sewing-pickup-line-id]').fill('10')
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;(globalThis as any).__mixedTransaction=original;IDBDatabase.prototype.transaction=function(...args:Parameters<typeof original>){const tx=original.apply(this,args);if(tx.mode==='readwrite')queueMicrotask(()=>tx.abort());return tx}})
  let abortMessage='';const failed=new Promise<void>(resolve=>page.once('dialog',async dialog=>{abortMessage=dialog.message();await dialog.accept();resolve()}));await page.locator('[data-pda-handover-action="confirm-sewing-pickup"]').click();await failed;assert.ok(abortMessage);await expect(page.locator('[data-sewing-pickup-line-id]')).toHaveValue('10')
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=(globalThis as any).__mixedTransaction});await page.locator('[data-pda-handover-action="confirm-sewing-pickup"]').click();await expect(page.locator('[data-sewing-pickup-scan-page]')).toContainText('此前已领 10 米');await expect(page.locator('[data-sewing-pickup-line-id]')).toHaveValue('0')
  const facts=await page.evaluate(async()=>{
   const slips=await import('/src/data/fcs/sewing-pickup-slips.ts');const records=await import('/src/data/wls/accessory-warehouse-records.ts');const hand=await import('/src/data/fcs/sewing-material-handover.ts');const v=slips.getCurrentSewingPickupSlip('AW-TEST-ASG-0','FABRIC_ACCESSORY')!;const fabric=v.lines.find(row=>row.objectType==='面料')!,aux=v.lines.find(row=>row.objectType==='辅料')!
   const before=records.currentAccessorySnapshot();const input={commandId:'FABRIC-A',versionId:v.versionId,recordedAt:'2026-10-19T13:00:00Z',recordedBy:'原面料仓管',actorFactoryId:'FABRIC-WAREHOUSE',recordedByRole:'MATERIAL_WAREHOUSE' as const,quantities:[{lineId:fabric.lineId,actualQty:10}]};let rejected='';try{await slips.recordSewingPickupHandoverPersisted({...input,commandId:'INVALID-AUX',quantities:[{lineId:aux.lineId,actualQty:1}]})}catch(e){rejected=String(e)}
   const first=slips.listSewingPickupHandoverResults(v.versionId)[0],replay=await slips.recordSewingPickupHandoverPersisted(first);return {before,after:records.currentAccessorySnapshot(),first,replay,rejected,projection:hand.getSewingMaterialHandoverProjection(v.assignmentId),legacy:localStorage.getItem('higood:ppic:sewing-pickup-slips:v1')}
  })
  assert.match(facts.rejected,/辅料须到对应辅料仓/);assert.equal(facts.projection.handoverEvents.length,1);assert.equal(facts.projection.lines.find((row:any)=>row.materialType==='面料')?.cumulativeHandedOverQty,10);assert.equal(facts.projection.lines.filter((row:any)=>row.materialType==='辅料').reduce((sum:number,row:any)=>sum+row.cumulativeHandedOverQty,0),0);assert.deepEqual(facts.first,facts.replay);assert.equal(facts.legacy,null)
  assert.deepEqual(beforeFabric.records.filter((row:any)=>row.collection.endsWith(':stock')),facts.after.records.filter((row:any)=>row.collection.endsWith(':stock')))
  await page.goto(base+'/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0');await expect(page.locator('[data-sewing-material-page]')).toContainText('10 米');await page.screenshot({path:resolve(output,'mixed-material-ledger.png'),fullPage:true})
  await writeFile(resolve(output,'mixed-scope.json'),JSON.stringify({at:new Date().toISOString(),version,facts},null,2))
 } finally {await context.close()}
})

test('STORE04 旧slip显式迁移保留共享条目与实交，marker无整键快照，晚到旧写明确阻断且不合并canonical', {timeout:120000}, async()=>{
 const context=await browser.newContext();const page=await context.newPage();await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 try {
  await page.goto(base+'/wls/accessory-warehouses/gtp/preparation');await page.locator('[data-accessory-preparation-root]').waitFor();await seed(page)
  const original=await page.evaluate(async()=>{
   const records=await import('/src/data/wls/accessory-warehouse-records.ts');const effective=await import('/src/data/fcs/effective-task-assignments.ts');const hand=await import('/src/data/fcs/sewing-material-handover.ts');const assignment=effective.getEffectiveTaskAssignment('AW-TEST-ASG-0')!;const context=hand.initializeSewingMaterialHandoverForAssignment({...assignment,ppicId:assignment.ppicId!,ppicName:assignment.ppicName!})!
   const version={slipId:'PPIC-PICKUP-AW-TEST-ASG-0-ACCESSORY',slipNo:'LL-OLD-A',versionId:'PPIC-PICKUP-AW-TEST-ASG-0-ACCESSORY-V1',versionNo:1,versionLabel:'V1',status:'CURRENT',assignmentId:assignment.assignmentId,runtimeTaskId:assignment.runtimeTaskId,taskNo:assignment.taskNo,productionOrderId:assignment.productionOrderId,productionOrderNo:assignment.productionOrderNo,taskKindLabel:'独立车缝',factoryId:assignment.factoryId,factoryName:assignment.factoryName,ppicId:assignment.ppicId,ppicName:assignment.ppicName,warehouseName:'旧辅料仓',objectKind:'ACCESSORY',styleCode:'STYLE-OLD',styleName:'原款式',styleImageUrl:'/shirt-sample.jpg',lines:context.requirementLines.map(line=>({lineId:`PICKUP-LINE-${line.requirementLineId}`,sourceLineId:line.requirementLineId,objectType:line.materialType,objectCode:line.materialCode,objectName:line.materialName,color:line.materialSpec,size:'不适用',part:line.materialType,unit:line.unit,requiredQty:line.requiredQty,previouslyHandedOverQty:0,availableQty:line.requiredQty,imageUrl:line.imageUrl})),printedAt:'2026-10-18',printedByPpicId:assignment.ppicId,printedByPpicName:assignment.ppicName}
   const unrelated={...version,slipId:'UNRELATED-SLIP',versionId:'UNRELATED-V1',assignmentId:'UNRELATED-ASG',productionOrderId:'PO-UNRELATED',styleName:'无关用户款式'}
   const result={commandId:'OLD-HAND',versionId:version.versionId,sourceRecordId:'OLD-SOURCE',sourceRecordNo:'OLD-SOURCE',recordedAt:'2026-10-18T12:00:00Z',recordedBy:'旧仓管',actorFactoryId:'OLD-WH',objectKind:'ACCESSORY',recordedByRole:'MATERIAL_WAREHOUSE',quantities:[{lineId:version.lines[0].lineId,actualQty:7}]}
   localStorage.setItem('higood:ppic:sewing-pickup-slips:v1',JSON.stringify({version:1,versions:[version,unrelated],handoverResults:[result],userMetadata:{preserved:true}}));return {version,result,unrelated,before:records.currentAccessorySnapshot()}
  })
  await page.goto(base+'/wls/accessory-warehouses/hilon/pickups');await expect(page.locator('[data-accessory-pickup-root]')).toContainText('待迁移')
  await page.evaluate(()=>{const set=Storage.prototype.setItem;(globalThis as any).__restoreSlipSet=set;Storage.prototype.setItem=function(key:string,value:string){if(key==='higood:ppic:sewing-pickup-slips:v1')throw new DOMException('旧键清理拒写','QuotaExceededError');return set.call(this,key,value)}})
  await page.getByRole('button',{name:'迁移原领料凭证和实交历史'}).click();await expect(page.getByRole('status')).toContainText('旧键清理拒写')
  const copied=await page.evaluate(async()=>{const rec=await import('/src/data/wls/accessory-warehouse-records.ts');return {marker:rec.findAccessoryRecord<any>('migration','sewing-pickup-v1'),legacy:JSON.parse(localStorage.getItem('higood:ppic:sewing-pickup-slips:v1')!),count:rec.listAccessoryRecords('sewing-handover').length}})
  assert.equal(copied.marker.phase,'COPIED');assert.equal(copied.legacy.versions.length,2);assert.equal(copied.legacy.handoverResults.length,1);assert.equal(copied.count,1);assert.ok(!('sourceRaw' in copied.marker))
  await page.evaluate(()=>{Storage.prototype.setItem=(globalThis as any).__restoreSlipSet})
  await page.getByRole('button',{name:'迁移原领料凭证和实交历史'}).click();await expect(page.getByRole('status')).toContainText('迁移完成')
  const migrated=await page.evaluate(async()=>{
   const rec=await import('/src/data/wls/accessory-warehouse-records.ts');const api=await import('/src/data/wls/accessory-warehouse-sewing.ts');const hand=await import('/src/data/fcs/sewing-material-handover.ts');return {snapshot:rec.currentAccessorySnapshot(),status:api.inspectLegacySewingPickupMigration(),projection:hand.getSewingMaterialHandoverProjection('AW-TEST-ASG-0'),legacy:JSON.parse(localStorage.getItem('higood:ppic:sewing-pickup-slips:v1')!)}
  })
  assert.equal(migrated.status.state,'已完成');assert.deepEqual(migrated.legacy.versions,[original.unrelated]);assert.deepEqual(migrated.legacy.handoverResults,[]);assert.deepEqual(migrated.legacy.userMetadata,{preserved:true});assert.equal(migrated.projection.handoverEvents.length,1);assert.equal(migrated.projection.handoverEvents[0].lines[0].actualQty,7)
  const marker=migrated.snapshot.records.find((row:any)=>row.collection.endsWith(':migration')&&row.value.id==='sewing-pickup-v1')!.value;assert.ok(!('sourceRaw' in marker));assert.ok(!JSON.stringify(marker).includes('无关用户款式'))
  const denied=await context.newPage();await denied.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value;const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key:string){if(key==='higood:ppic:sewing-pickup-slips:v1')throw new DOMException('Denied','SecurityError');return get.call(this,key)}})
  await denied.goto(base+'/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0');await expect(denied.locator('[data-sewing-material-page]')).toContainText('7 条')
  const deniedRead=await denied.evaluate(async()=>{const api=await import('/src/data/wls/accessory-warehouse-sewing.ts');const slips=await import('/src/data/fcs/sewing-pickup-slips.ts');await api.prepareAccessorySewing();return {status:api.inspectLegacySewingPickupMigration(),current:slips.getCurrentSewingPickupSlip('AW-TEST-ASG-0','ACCESSORY')}});assert.equal(deniedRead.status.state,'已完成');assert.equal(deniedRead.current?.versionId,original.version.versionId);await denied.close()
  await page.locator('[data-accessory-pickup-action="create"]').click();await expect(page.getByRole('status')).toContainText('原领料凭证已有辅料实交')
  await page.evaluate(({version,result})=>{const old=JSON.parse(localStorage.getItem('higood:ppic:sewing-pickup-slips:v1')!);old.versions.push({...version,versionId:'LATE-OLD-V2',versionNo:2});old.handoverResults.push({...result,versionId:'LATE-OLD-V2',commandId:'LATE-OLD-HAND',quantities:[{...result.quantities[0],actualQty:3}]});localStorage.setItem('higood:ppic:sewing-pickup-slips:v1',JSON.stringify(old))},original)
  await page.reload();await expect(page.locator('[data-accessory-pickup-root]')).toContainText('旧页面再次写入')
  const conflict=await page.evaluate(async()=>{const api=await import('/src/data/wls/accessory-warehouse-sewing.ts');const rec=await import('/src/data/wls/accessory-warehouse-records.ts');return {status:api.inspectLegacySewingPickupMigration(),snapshot:rec.currentAccessorySnapshot(),legacy:JSON.parse(localStorage.getItem('higood:ppic:sewing-pickup-slips:v1')!),conflictExport:await api.exportAccessorySewingLegacyConflict()}})
  assert.equal(conflict.status.state,'已阻塞');assert.deepEqual(conflict.snapshot.records,migrated.snapshot.records);assert.ok(conflict.legacy.handoverResults.some((row:any)=>row.commandId==='LATE-OLD-HAND'));assert.equal(conflict.conflictExport?.versions.length,1);assert.equal(conflict.conflictExport?.handoverResults[0].commandId,'LATE-OLD-HAND');assert.ok(!JSON.stringify(conflict.conflictExport).includes('无关用户款式'))
  const backup=await page.evaluate(async()=>{const api=await import('/src/data/wls/accessory-warehouse-migration.ts');return api.exportAccessoryWarehouseBackup()})
  assert.equal(backup.sewingConflicts?.length,1);assert.equal(backup.sewingConflicts?.[0].handoverResults[0].commandId,'LATE-OLD-HAND')
  const restoreContext=await browser.newContext();const restorePage=await restoreContext.newPage();await restorePage.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value});await restorePage.goto(base+'/wls/accessory-warehouses/gtp/preparation');await restorePage.locator('[data-accessory-preparation-root]').waitFor()
  const refused=await restorePage.evaluate(async(backup)=>{const api=await import('/src/data/wls/accessory-warehouse-migration.ts');const rec=await import('/src/data/wls/accessory-warehouse-records.ts');const before=await rec.readAccessoryRecordSnapshot();let message='';try{await api.restoreAccessoryWarehouseBackup(backup)}catch(error){message=String(error)}return {before,after:await rec.readAccessoryRecordSnapshot(),message}},backup)
  assert.match(refused.message,/冲突/);assert.deepEqual(refused.before,refused.after);await restoreContext.close()
  await page.screenshot({path:resolve(output,'late-old-slip-conflict.png'),fullPage:true});await writeFile(resolve(output,'legacy-slips-migration.json'),JSON.stringify({at:new Date().toISOString(),migrated,conflict,refused},null,2))
 }finally{await context.close()}
})

test('P1 改厂作废所有当前凭证后，同assignment新仓打印延续V2，原V1身份明细及VOIDED历史保留', {timeout:120000}, async()=>{
 const context=await browser.newContext();const page=await context.newPage();await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 try {
  await page.goto(base+'/wls/accessory-warehouses/gtp/preparation');await page.locator('[data-accessory-preparation-root]').waitFor();await seed(page)
  await page.goto(base+'/wls/accessory-warehouses/hilon/pickups');await page.locator('[data-accessory-pickup-action="create"]').click();await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立');const first=await printA(page)
  const changed=await page.evaluate(async()=>{
   const api=await import('/src/data/wls/accessory-warehouse-sewing.ts');const rec=await import('/src/data/wls/accessory-warehouse-records.ts');const link=await import('/src/data/wls/accessory-warehouse-factory-link.ts');const source=await import('/src/data/fcs/production-context-records.ts');const repo=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const runtime=await import('/src/data/fcs/runtime-task-read-bridge.ts');const effective=await import('/src/data/fcs/effective-task-assignments.ts');const commands=await import('/src/data/wls/accessory-warehouse-commands.ts');const stock=await import('/src/data/wls/accessory-warehouse-stock.ts');const master=await import('/src/data/wls/accessory-warehouse-master.ts')
   const before=rec.currentAccessorySnapshot(),orderId='PO-AW-SEW-CONTRACT',at='2026-10-19T14:00:00Z';const tasks=runtime.readRuntimeTasks<any>().filter(row=>row.productionOrderId===orderId).map(row=>row.processBusinessCode==='CUT_PANEL'?{...row,assignedFactoryId:'SEA-CUTTING-002',assignedFactoryName:'sea cutting2',auditLogs:[...row.auditLogs,{id:'CUT-CHANGE',action:'CUTTING_REASSIGN',detail:'改至sea cutting2',at,by:'测试分配员'}]}:row)
   const old=effective.listEffectiveTaskAssignments().filter(row=>row.productionOrderId===orderId),cut=old.find(row=>row.processCodes.includes('CUT_PANEL'))!;const assignments=[...old.map(row=>row.assignmentId===cut.assignmentId?{...row,status:'SUPERSEDED' as const,supersededByAssignmentId:'CUT-ASG-V2'}:row),{...cut,assignmentId:'CUT-ASG-V2',factoryId:'SEA-CUTTING-002',factoryName:'sea cutting2',source:'REASSIGNMENT' as const,operatedAt:at}]
   const change=link.buildAccessoryFactoryLinkChange({records:before.records,tasks,assignments,factories:[{id:'SEA-CUTTING-001',name:'sea cutting'},{id:'SEA-CUTTING-002',name:'sea cutting2'}],commandId:'CHANGE-CUT',at,by:'测试分配员'})
   const runtimeRecords=source.decodeProductionContextRecords(source.PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify({version:1,auditSeq:0,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:tasks.map(row=>[row.taskId,row])}))
   const assignmentRecords=source.decodeProductionContextRecords(source.PRODUCTION_CONTEXT_KEYS.assignments,JSON.stringify({version:2,auditSeq:0,assignmentSeq:3,assignments:assignments.map(row=>[row.assignmentId,row]),current:assignments.filter(row=>row.status==='EFFECTIVE').map(row=>[row.runtimeTaskId,[row.assignmentId]]),auditLogs:[]}))
   await repo.commitCuttingRecords({revision:before.revision,command:{id:'CHANGE-CUT-ATOMIC',intent:'change-cut-fixture-contract',result:true,at},change:{puts:[...runtimeRecords,...assignmentRecords,...change.puts]}});await api.prepareAccessorySewing()
   const onward=rec.listAccessoryRecords<any>('transfer').find(row=>row.kind==='SITE_REASSIGN')!;if(!onward)return {diagnostic:{tasks,assignments,before,change,after:rec.currentAccessorySnapshot()}};const receipt=rec.listAccessoryRecords<any>('receipt').find(row=>row.transferId===onward.id)!,stocks=rec.listAccessoryRecords<any>('stock')
   const dispatched=commands.buildAccessoryDispatchChange({transfer:onward,stocks,actor:{role:'仓管',warehouseCode:onward.fromWarehouse,name:'原仓管'},commandId:'ONWARD-DISPATCH',at});await rec.saveAccessoryWarehouseAction({commandId:'ONWARD-DISPATCH',intent:'onward-dispatch',result:dispatched.transfer,change:dispatched.change})
   const location=master.listEnabledAccessoryWarehouseLocations(onward.toWarehouse)[0];const received=commands.buildAccessoryReceiveChange({transfer:dispatched.transfer,receipt,stocks:rec.listAccessoryRecords<any>('stock'),actor:{role:'仓管',warehouseCode:onward.toWarehouse,name:'新仓管'},commandId:'ONWARD-RECEIVE',at,locations:master.listEnabledAccessoryWarehouseLocations(onward.toWarehouse),lines:onward.lines.map(line=>({lineId:line.id,qty:line.qty,locationId:location.id}))});await rec.saveAccessoryWarehouseAction({commandId:'ONWARD-RECEIVE',intent:'onward-receive',result:received.transfer,change:received.change});await api.prepareAccessorySewing()
   const created=await api.createAccessorySewingPickups({preparationId:onward.preparationId,commandId:'CREATE-NEW-WAREHOUSE',at,actor:{role:'仓管',warehouseCode:onward.toWarehouse,name:'新仓管'}})
   return {created,oldPickups:rec.listAccessoryRecords<any>('pickup').filter(row=>row.sourceTransferId==='AW-RECEIVED'),history:rec.listAccessoryRecords<any>('sewing-slip')}
  })
  if ('diagnostic' in changed) {await writeFile(resolve(output,'reassignment-diagnostic.json'),JSON.stringify(changed,null,2));assert.fail('改厂未生成仓间调拨，已保存诊断')};assert.ok(changed.oldPickups.every((row:any)=>row.status==='已失效'));assert.ok(changed.created.pickups.every((row:any)=>row.warehouseCode==='WH-FITTING-MAHAMERU'));assert.equal(changed.history.find((row:any)=>row.versionId===first.versionId)?.status,'VOIDED')
  const second=await printA(page);assert.equal(second.versionLabel,'V2');assert.equal(second.slipId,first.slipId);assert.notEqual(second.versionId,first.versionId);assert.equal(second.warehouseName,'Mahameru辅料仓')
  const persisted=await page.evaluate(async()=>{const slips=await import('/src/data/fcs/sewing-pickup-slips.ts');const rec=await import('/src/data/wls/accessory-warehouse-records.ts');return {first:slips.getSewingPickupSlipVersion('PPIC-PICKUP-AW-TEST-ASG-0-ACCESSORY-V1'),all:rec.listAccessoryRecords<any>('sewing-slip'),pickups:rec.listAccessoryRecords<any>('pickup')}})
  assert.equal(persisted.first?.status,'VOIDED');assert.deepEqual(persisted.first?.lines,first.lines);assert.ok(persisted.first?.voidedAt);assert.equal(persisted.all.filter((row:any)=>row.assignmentId==='AW-TEST-ASG-0').length,2)
  await writeFile(resolve(output,'reassignment-slip-version.json'),JSON.stringify({at:new Date().toISOString(),first,second,changed,persisted},null,2))
 }finally{await context.close()}
})
