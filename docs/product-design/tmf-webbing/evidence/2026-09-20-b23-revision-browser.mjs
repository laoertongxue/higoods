import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8')
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {projectTmfWorkOrders}=await load('/src/data/fcs/tmf-work-order-view.ts');const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code

const start=text.indexOf("test('B23未执行采购1000减900")
const setup=text.slice(text.indexOf(' const p=',start),text.indexOf(' const input=',start)).replace(" const p=purchase('B23-REDUCE',1000)"," const p=purchase('B23-REDUCE',1000);p.materialImageUrl='/materials/tmf/webbing-reference-white.jpg'")
const evidence={route:'/pms/material-purchase-orders',checks:[],errors:[],scope:'B23采购减量、版本留痕和基础900米实收；印染下游及完整性能未验证'}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188'+evidence.route);await page.locator('[data-pms-mpo-root]').waitFor()
 await page.evaluate(compile(setup))
 const query=async()=>{await page.locator('[data-pms-mpo-field="keyword"]').fill('B23-REDUCE-PO');await page.locator('[data-pms-mpo-action="query"]').click()}
 await query();await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="B23-REDUCE-PO"]').click();await page.locator('[data-pms-mpo-action="open-tmf-revision"]').click()
 const form=page.locator('[data-tmf-purchase-revision]'),submit=()=>page.locator('[data-pms-mpo-action="submit-tmf-revision"]').click()
 await submit();assert.match(await form.innerText(),/数量未变化/)
 await form.locator('[name="orderedQty"]').fill('900');await submit();assert.match(await form.innerText(),/确认/)
 await form.locator('[name="reason"]').fill('未开工基础备货减100米');await form.locator('[name="confirmed"]').check()
 await page.evaluate(()=>{globalThis.originalTmfSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='higood-tmf-material-purchases-v1')throw Error('B23保存失败');return globalThis.originalTmfSetItem.call(this,k,v)}})
 await submit();assert.match(await form.innerText(),/未保存|失败/);assert.equal(await form.locator('[name="orderedQty"]').inputValue(),'900')
 await page.evaluate(()=>{Storage.prototype.setItem=globalThis.originalTmfSetItem});await submit()
 const detail=page.locator('[data-pms-mpo-detail-root]');await detail.waitFor();assert.match(await detail.innerText(),/1000 → 900 米/);assert.match(await detail.innerText(),/V1 → V2/)
 await page.reload();await page.locator('[data-pms-mpo-root]').waitFor();await query();await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="B23-REDUCE-PO"]').click();assert.match(await detail.innerText(),/1000 → 900 米/)
 const finish=text.slice(text.indexOf(' assert.throws(()=>startTmfBaseOrder',start),text.indexOf('\n})',start))
 evidence.final=await page.evaluate(compile(`const p=getTmfPurchaseState().orders.find(o=>o.purchaseOrderNo==='B23-REDUCE-PO'),baseId=getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===p.purchaseOrderNo).id;${finish};return {purchase:getPmsMaterialPurchaseOrder(p.purchaseOrderNo).orderedQty,received:getPmsMaterialPurchaseOrder(p.purchaseOrderNo).receivedQty,physical:end.lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo).onHandMeters,history:end.baseOrders.find(b=>b.id===baseId).planRevisions};`))
 await page.reload();await page.locator('[data-pms-mpo-root]').waitFor();await query();await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="B23-REDUCE-PO"]').click();assert.match(await detail.innerText(),/900 米/);assert.match(await detail.innerText(),/1000 → 900 米/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.waitForFunction(()=>{const image=document.querySelector('[data-pms-mpo-detail-root] img');return image?.complete && image.naturalWidth>0})
 assert.match(await detail.innerText(),/基础备货/)
 await detail.locator('[data-pms-common-action="open-image"]').click()
 await page.waitForFunction(()=>{const image=document.querySelector('[data-pms-common-action="close-image"]')?.parentElement.querySelector('section img');return image?.complete && image.naturalWidth>0})
 await page.locator('[data-pms-common-action="close-image"]').last().click()
 await detail.waitFor()
 await page.waitForFunction(()=>{const image=document.querySelector('[data-pms-mpo-detail-root] img');return image?.complete && image.naturalWidth>0})
 await detail.locator('[data-pms-image-loading]').waitFor({state:'hidden'})
 evidence.image=await detail.locator('[data-pms-common-action="open-image"]').evaluate(el=>({html:el.outerHTML,display:getComputedStyle(el.querySelector('[data-pms-image-loading]')).display}));
 await page.screenshot({path:'output/playwright/tmf-webbing/b23-revision.png'})
 // 在隔离验收上下文注入资源失败，验证错误可见和原对象重试。
 await page.route('**/materials/tmf/webbing-reference-white.jpg*',route=>route.abort())
 await page.reload();await page.locator('[data-pms-mpo-root]').waitFor();await query();await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="B23-REDUCE-PO"]').click()
 await detail.locator('[data-pms-image-error]').waitFor({state:'visible'})
 await page.unroute('**/materials/tmf/webbing-reference-white.jpg*')
 await detail.locator('[data-pms-common-action="open-image"]').click()
 await detail.locator('[data-pms-image-error]').waitFor({state:'hidden'});await detail.locator('[data-pms-image-loading]').waitFor({state:'hidden'})
 assert.equal(await detail.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true)
 evidence.checks.push('缩略图和大图真实可见；注入图片失败后显示错误，点击重试恢复原对象图片')
 evidence.checks.push('无变化、缺原因确认阻断，存储失败保留输入原表重试成功','PMS详情和刷新可追溯1000→900、V1→V2及原因','原接单失效，重接单后实际生产和仓库实收900米，拒绝原1000米产出；采购、库存一致')
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/b23-revision-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
