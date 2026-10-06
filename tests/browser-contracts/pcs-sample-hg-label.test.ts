import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.env.SAMPLE_TEST_URL || 'http://127.0.0.1:4206', out = 'output/playwright/sample-hg-label'

test('HG-001–008: Mock receipt, SKU identity, HG scans, print, refresh, transaction failures and concurrency', { timeout: 180000 }, async () => {
 const browser=await chromium.launch(),c=await browser.newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),checks:string[]=[],errors:string[]=[]
 await c.addInitScript(()=>{(globalThis as any).__name=(v:unknown)=>v;const original=window.print;window.print=()=>{};(globalThis as any).__originalPrint=original})
 p.on('pageerror',e=>errors.push(e.message));const check=(value:unknown,name:string)=>{assert.ok(value,name);checks.push(name)}
 try{
 await p.goto(base+'/pcs/samples/label/smp-001');await p.waitForSelector('[data-hg-sample-label]')
 check(await p.locator('[data-real-barcode]').getAttribute('data-barcode-value')==='HG2000002','seed HG rendered in barcode')
 const source=await p.evaluate(async()=>JSON.stringify((await(await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records))
 check(source==='[]','first label route does not persist seeds')
 await p.locator('[data-pcs-sample-field="label-width"]').fill('55');await p.locator('[data-pcs-sample-field="label-height"]').fill('35');await p.locator('[data-pcs-sample-field="label-copies"]').fill('3')
 await p.evaluate(()=>{const old=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow')!;Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{configurable:true,get(){const w=old.get!.call(this);if(w)w.print=()=>{(globalThis as any).__hgPrinted=this.srcdoc};return w}})})
 await p.locator('[data-pcs-sample-action="print-label"]').click();await p.waitForFunction(()=>(globalThis as any).__hgPrinted)
 const html=await p.evaluate(()=>(globalThis as any).__hgPrinted as string)
 check((html.match(/data-hg-sample-label/g)||[]).length===3&&html.includes('size:55mm 35mm'),'three labels printed at selected dimensions')
 const pdf=await c.newPage();await pdf.setContent(html);await pdf.pdf({path:out+'/sample-label-55x35.pdf',preferCSSPageSize:true});await pdf.locator('[data-hg-sample-label]').first().screenshot({path:out+'/sample-label.png'});await pdf.close();await writeFile(out+'/sample-label.html',html)
 check(source===await p.evaluate(async()=>JSON.stringify((await(await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records)),'print has no business side effect')
 await p.locator('[data-pcs-sample-field="label-width"]').fill('0');await p.locator('[data-pcs-sample-action="print-label"]').click();check((await p.locator('[data-hg-label-feedback]').innerText()).includes('30–120'),'invalid width blocks printing')
 await p.locator('[data-pcs-sample-action="reset-label-size"]').click();check(await p.locator('[data-pcs-sample-field="label-width"]').inputValue()==='60','reset dimensions')
 const data=await p.evaluate(async()=>{
  const rt=await import('/src/data/pcs-record-runtime.ts'),d=await import('/src/data/pcs-record-db.ts'),t=await import('/src/data/pcs-testing-order-repository.ts'),s=await import('/src/data/pcs-sample-management.ts'),styles=await import('/src/data/pcs-style-archive-repository.ts'),skus=await import('/src/data/pcs-sku-archive-repository.ts')
  await rt.ensurePcsRecordState();const active=new Set(t.listTestingOrders().filter(o=>o.status==='进行中').map(o=>o.styleId));const style=styles.listStyleArchives().find(row=>!active.has(row.styleId)&&skus.listSkuArchives().filter(k=>k.styleId===row.styleId).length>=2)!;const codes=skus.listSkuArchives().filter(k=>k.styleId===style.styleId).slice(0,2).map(row=>row.skuCode)
  const created=await rt.runPcsRecordCommand(()=>t.createTestingOrder({styleId:style.styleId,skuCodes:codes}));const id=created.order!.testingOrderId
  await rt.runPcsRecordCommand(()=>{t.advanceTestingOrder(id,'logistics');t.updateTestingOrder(id,{logisticsCarrier:'Mock',logisticsTrackingNo:'HG-TEST'});t.advanceTestingOrder(id,'sample-inbound')})
  const before=JSON.stringify((await d.readPcsRecords()).records),put=IDBObjectStore.prototype.put;let writes=0,failed=false
  IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='records'&&++writes===3)throw new DOMException('fault','AbortError');return put.apply(this,args as any)}
  try{await rt.runPcsRecordCommand(()=>t.completeSampleInbound(id,'Mock'))}catch{failed=true}finally{IDBObjectStore.prototype.put=put}
  const rollback=failed&&before===JSON.stringify((await d.readPcsRecords()).records)
  await rt.runPcsRecordCommand(()=>t.completeSampleInbound(id,'Mock'))
  const identities=codes.map(code=>s.getPcsSampleLabelIdentity(code)!)
  const count=(await d.readPcsRecords()).records.filter(row=>row.collection==='higood-pcs-sample-management-v1/identities').length
  return {id,codes,identities,rollback,count}
 })
 check(data.rollback,'receipt failure rolls back numbering, counter, sample, ledger and order')
 check(data.identities.length===2&&data.identities[0].hgCode!==data.identities[1].hgCode,'each new SKU assigned unique HG')
 await p.goto(base+'/pcs/testing/orders/'+data.id);await p.waitForSelector('[data-pcs-testing-field="label-sku"]')
 check(await p.locator('[data-pcs-testing-field="label-sku"]').inputValue()===data.identities[0].hgCode,'⑤ defaults to HG')
 await p.locator('[data-pcs-testing-field="label-sku"]').fill('HG2000002');await p.locator('[data-pcs-testing-action="complete-label"]').click();check((await p.locator('[data-testing-action-feedback]').innerText()).includes('本单 SKU'),'other SKU HG rejected')
 await p.locator('[data-pcs-testing-field="label-sku"]').fill(data.codes[0]);await p.locator('[data-pcs-testing-action="complete-label"]').click();check((await p.locator('[data-testing-action-feedback]').innerText()).includes('本单 SKU'),'raw internal SKU rejected as HG')
 for(const identity of data.identities){await p.locator('[data-pcs-testing-field="label-sku"]').fill(identity.hgCode);await p.locator('[data-pcs-testing-action="complete-label"]').click();await p.waitForFunction(code=>!document.querySelector('[data-pcs-testing-field="label-sku"]')||document.querySelector('[data-pcs-testing-field="label-sku"]')!.getAttribute('value')!==code,identity.hgCode)}
 check(!!await p.locator('[data-pcs-testing-action="buyer-kill"]').count(),'both HG tags required before buyer confirmation')
 const sampleId=`testing-${data.id}-${data.codes[0]}`
 await p.goto(base+'/pcs/samples/label/'+encodeURIComponent(sampleId));await p.waitForSelector('[data-hg-sample-label]');await p.reload();await p.waitForSelector('[data-hg-sample-label]')
 check(await p.locator('.hg-number').innerText()===data.identities[0].hgCode,'direct label reload reads persisted HG')
 check(await p.locator('.hg-date').innerText()===data.identities[0].registeredAt.slice(0,10),'date is first receipt, not print time')
 const result=await p.evaluate(async({sampleId,identity,orderId})=>{
  const rt=await import('/src/data/pcs-record-runtime.ts'),s=await import('/src/data/pcs-sample-management.ts'),t=await import('/src/data/pcs-testing-order-repository.ts')
  await rt.runPcsRecordCommand(()=>s.convertPcsSampleType(sampleId,'production','管理员','跟版'))
  await rt.runPcsRecordCommand(()=>s.receiveTestingOrderSamples({...t.getTestingOrderById(orderId)!,testingOrderId:'hg-repeat',skuCodes:[identity.skuCode],sampleInboundAt:'2026-11-01 09:00:00'},'仓管'))
  return s.getPcsSampleLabelIdentity(identity.skuCode)
 },{sampleId,identity:data.identities[0],orderId:data.id})
 check(JSON.stringify(result)===JSON.stringify(data.identities[0]),'type conversion and repeat receipt preserve HG/date')
 const other=await c.newPage();await other.goto(base+'/pcs/samples/label/smp-001');await other.waitForSelector('[data-hg-sample-label]')
 const race=async(page:typeof p,sku:string)=>page.evaluate(async sku=>{const rt=await import('/src/data/pcs-record-runtime.ts'),s=await import('/src/data/pcs-sample-management.ts'),t=await import('/src/data/pcs-testing-order-repository.ts');try{await rt.runPcsRecordCommand(()=>s.receiveTestingOrderSamples({...t.listTestingOrders()[0],testingOrderId:'race-'+sku,skuCodes:[sku],sampleInboundAt:'2026-10-06 10:00:00'},'仓管'));return true}catch{return false}},sku)
 const outcomes=await Promise.all([race(p,'HG-RACE-A'),race(other,'HG-RACE-B')]);check(outcomes.some(Boolean),'at least one concurrent allocator commits')
 const uniqueness=await p.evaluate(async()=>{const rt=await import('/src/data/pcs-record-runtime.ts');await rt.ensurePcsRecordState();const d=await import('/src/data/pcs-record-db.ts');const rows=(await d.readPcsRecords()).records.filter(row=>row.collection==='higood-pcs-sample-management-v1/identities').map(row=>(row.value as any).data.hgCode);return rows.length===new Set(rows).size});check(uniqueness,'concurrent allocations cannot duplicate HG')
 await p.setViewportSize({width:1280,height:720});await p.goto(base+'/pcs/samples/label/smp-001');await p.waitForSelector('[data-hg-sample-label]');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'label at 1280 has no document overflow');await p.screenshot({path:out+'/preview-1280.png'});check(!errors.length,'no uncaught browser errors')
 }finally{await writeFile(out+'/browser.json',JSON.stringify({checks,errors},null,2));await browser.close()}
})

test('HG-002/003/007/009: legacy receipt explicit registration, quota recovery and missing-date block, five samples', {timeout:90000},async()=>{
 const b=await chromium.launch(),c=await b.newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),samples:Array<{name:string;ms:number}>=[]
 await c.addInitScript(()=>{(globalThis as any).__name=(v:unknown)=>v;document.addEventListener('pointerdown',()=>{(globalThis as any).__hgLegacyStart=performance.now()},true)})
 const measure=async(name:string)=>{await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const ms=await p.evaluate(()=>performance.now()-(globalThis as any).__hgLegacyStart);samples.push({name,ms});assert.ok(ms<=1000,`${name}: ${ms}ms >1s`)}
 try{
  await p.goto(base+'/pcs/samples/inventory');await p.waitForSelector('[data-pcs-sample-page-root]')
  for(let i=0;i<5;i++){
   const sampleId=await p.evaluate(async i=>{
    const rt=await import('/src/data/pcs-record-runtime.ts'),s=await import('/src/data/pcs-sample-management.ts'),t=await import('/src/data/pcs-testing-order-repository.ts');const sku='LEGACY-UI-'+i,id='legacy-ui-'+i
    await rt.runPcsRecordCommand(()=>{s.receiveTestingOrderSamples({...t.listTestingOrders()[0],testingOrderId:id,skuCodes:[sku],sampleInboundAt:'2026-08-01 09:00:00',labeledAt:''},'仓管');const data=JSON.parse(rt.pcsRecordStore.getItem(s.PCS_SAMPLE_STORAGE_KEY)!);data.identities=data.identities.filter((row:any)=>row.skuCode!==sku);data.records.filter((row:any)=>row.skuCode===sku).forEach((row:any)=>delete row.registeredAt);rt.pcsRecordStore.setItem(s.PCS_SAMPLE_STORAGE_KEY,JSON.stringify(data))});return `testing-${id}-${sku}`
   },i)
   await p.goto(base+'/pcs/samples/label/'+sampleId);await p.waitForSelector('[data-pcs-sample-action="register-label"]')
   await p.evaluate(()=>{(globalThis as any).__oldHgPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='records')throw new DOMException('full','QuotaExceededError');return (globalThis as any).__oldHgPut.apply(this,args)}})
   await p.locator('[data-pcs-sample-action="register-label"]').click();await p.waitForFunction(()=>document.querySelector('[data-hg-label-feedback]')?.textContent?.includes('未保存'));await measure('legacy:failed-save')
   assert.equal(await p.locator('[data-pcs-sample-action="register-label"]').count(),1)
   await p.evaluate(()=>{IDBObjectStore.prototype.put=(globalThis as any).__oldHgPut})
   await p.locator('[data-pcs-sample-action="register-label"]').click();await p.waitForSelector('[data-hg-sample-label]');await measure('legacy:register-retry')
   assert.equal(await p.locator('.hg-date').innerText(),'2026-08-01')
   const hg=await p.locator('.hg-number').innerText();await p.reload();await p.waitForSelector('[data-hg-sample-label]');assert.equal(await p.locator('.hg-number').innerText(),hg)
   // Remove only this isolated fixture's receipt date to verify no fallback to update/print time.
   const missingId=await p.evaluate(async i=>{const rt=await import('/src/data/pcs-record-runtime.ts'),s=await import('/src/data/pcs-sample-management.ts');const sample=s.getPcsSampleById(`testing-legacy-ui-${i}-LEGACY-UI-${i}`)!;const row={...sample,sampleId:'missing-date-'+i,skuCode:'MISSING-DATE-'+i,sampleCode:'MISSING-DATE-'+i,registeredAt:undefined};await rt.runPcsRecordCommand(()=>{const data=JSON.parse(rt.pcsRecordStore.getItem(s.PCS_SAMPLE_STORAGE_KEY)!);data.records.push(row);rt.pcsRecordStore.setItem(s.PCS_SAMPLE_STORAGE_KEY,JSON.stringify(data))});return row.sampleId},i)
   await p.goto(base+'/pcs/samples/label/'+missingId);await p.waitForSelector('[data-pcs-sample-action="register-label"]');await p.locator('[data-pcs-sample-action="register-label"]').click();await p.waitForFunction(()=>document.querySelector('[data-hg-label-feedback]')?.textContent?.includes('缺少首次登记日期'));await measure('legacy:missing-date-block')
  }
 }finally{await writeFile(out+'/legacy-registration.json',JSON.stringify({samples},null,2));await b.close()}
})
