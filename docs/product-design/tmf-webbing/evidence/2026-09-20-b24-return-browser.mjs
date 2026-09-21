import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8')
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {projectTmfWorkOrders}=await load('/src/data/fcs/tmf-work-order-view.ts');const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code


const start=text.indexOf("test('B24实收1000退100")
const setup=text.slice(text.indexOf(' const p=',start),text.indexOf(' const input=',start)).replace(";prepare(p)",";p.materialImageUrl='/materials/tmf/webbing-reference-white.jpg';prepare(p)")
const evidence={checks:[],errors:[],scope:'B24原基础1000实收→实际退100→净900→采购及基础处置；未执行后续印染整链'}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/base-orders');await page.locator('[data-tmf-base-page="base-orders"]').waitFor()
 await page.evaluate(compile(setup))
 await page.goto('http://127.0.0.1:43188/wls/accessory-receipts');await page.locator('[data-wls-receipt-category="tmf-base"]').click()
 const query=async(mode)=>{const root=page.locator(`[data-tmf-base-page="${mode}"]`);await root.locator('[name="keyword"]').fill('B24-RETURN-PO');await root.locator(`[data-tmf-${mode}-action="query"]`).click();return root}
 let root=await query('base-receipts');await root.locator('[data-tmf-base-receipts-action="detail"]').click();await root.locator('[data-tmf-base-receipts-action="purchase-return"]').click()
 let dialog=root.locator('[data-tmf-dialog]');await dialog.locator('[name="returnId"]').fill('B24-RETURN-100');await dialog.locator('[name="scanBatch"]').fill('WRONG');await dialog.locator('[name="scanSku"]').fill('WB30-WHT');await dialog.locator('[name="quantity"]').fill('100');await dialog.locator('[name="returnReason"]').fill('采购减量，未用白料退100米')
 await root.locator('[data-tmf-base-receipts-action="confirm"]').click();assert.match(await dialog.innerText(),/正确.*批次/)
 await dialog.locator('[name="scanBatch"]').fill('B24-RETURN-PO:batch');await root.locator('[data-tmf-base-receipts-action="confirm"]').click();assert.match(await dialog.innerText(),/确认实际交出/)
 await dialog.locator('[name="returnConfirmed"]').check();await root.locator('[data-tmf-base-receipts-action="confirm"]').click();assert.match(await dialog.innerText(),/退货在途 100 米；采购净实收 1000 米/)
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/base-orders');root=await query('base-orders');await root.locator('[data-tmf-base-orders-action="detail"]').click();dialog=root.locator('[data-tmf-dialog]')
 for(const qty of [40,60]){
  await root.locator('[data-tmf-base-orders-action="purchase-return-receive"]').click();await dialog.locator('[name="returnId"]').fill('B24-RETURN-100');await dialog.locator('[name="scanSku"]').fill('WB30-WHT');await dialog.locator('[name="quantity"]').fill(String(qty));await dialog.locator('[name="returnConfirmed"]').check();await root.locator('[data-tmf-base-orders-action="confirm"]').click();assert.match(await dialog.innerText(),new RegExp(`采购净实收 ${qty===40?960:900} 米`))
 }
 await root.locator('[data-tmf-base-orders-action="purchase-resolve"]').click();await dialog.locator('[name="returnReason"]').fill('先核对');await dialog.locator('[name="returnConfirmed"]').check();await root.locator('[data-tmf-base-orders-action="confirm"]').click();assert.match(await dialog.innerText(),/先由采购修订/)
 await page.goto('http://127.0.0.1:43188/pms/material-purchase-orders');await page.locator('[data-pms-mpo-root]').waitFor();await page.locator('[data-pms-mpo-field="keyword"]').fill('B24-RETURN-PO');await page.locator('[data-pms-mpo-action="query"]').click();await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="B24-RETURN-PO"]').click();assert.match(await page.locator('[data-pms-mpo-detail-root]').innerText(),/原实收 1000 米.*TMF已收 100 米.*净实收 900 米/)
 await page.locator('[data-pms-mpo-action="open-tmf-revision"]').click();const form=page.locator('[data-tmf-purchase-revision]');await form.locator('[name="orderedQty"]').fill('900');await form.locator('[name="reason"]').fill('退货100米已收齐，保留采购900米');await form.locator('[name="confirmed"]').check();await page.locator('[data-pms-mpo-action="submit-tmf-revision"]').click();await page.locator('[data-pms-mpo-detail-root]').waitFor()
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/base-orders');root=await query('base-orders');await root.locator('[data-tmf-base-orders-action="detail"]').click();dialog=root.locator('[data-tmf-dialog]');await root.locator('[data-tmf-base-orders-action="purchase-resolve"]').click();await dialog.locator('[name="returnReason"]').fill('原产出1000保留，退回100已由TMF单独保留，采购计划900');await dialog.locator('[name="returnConfirmed"]').check();await root.locator('[data-tmf-base-orders-action="confirm"]').click()
 assert.match(await dialog.innerText(),/计划 900 米；已产出 1000 米/)
 await page.reload();root=await query('base-orders');await root.locator('[data-tmf-base-orders-action="detail"]').click();dialog=root.locator('[data-tmf-dialog]');assert.match(await dialog.innerText(),/原累计收货 1000 米.*TMF已收 100 米.*采购净实收 900 米/);assert.equal(await root.locator('[data-tmf-base-orders-action="purchase-resolve"]').count(),0)
 evidence.final=await page.evaluate(compile(`const data=getTmfPurchaseState(),order=data.orders.find(o=>o.purchaseOrderNo==='B24-RETURN-PO'),base=data.baseOrders.find(b=>b.purchaseOrderNo===order.purchaseOrderNo);return {balance:m.getTmfPurchaseReturnBalance(order.purchaseOrderNo),planned:base.plannedMeters,produced:base.producedMeters,pending:base.changePending,physical:data.lots.find(l=>l.sourcePurchaseOrderNo===order.purchaseOrderNo).onHandMeters,receipts:data.purchaseReturns.find(r=>r.id==='B24-RETURN-100').receipts.map(r=>r.meters)};`))
 assert.deepEqual(evidence.final,{balance:{grossReceivedMeters:1000,returnDispatchedMeters:100,returnReceivedMeters:100,returnTransitMeters:0,netReceivedMeters:900},planned:900,produced:1000,pending:false,physical:900,receipts:[40,60]})
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-tmf-dialog] img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/b24-return.png'})
 evidence.checks.push('仓库错误批次与未确认阻断；实际退货交出100只减仓库、不提前减采购净实收','TMF页面分次实收40/60，原1000收货保留，净实收960→900','采购未修订时结束处置阻断；PMS改900后主管核对处置，刷新后原产1000/净900/厂内退回100一致')
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/b24-return-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
