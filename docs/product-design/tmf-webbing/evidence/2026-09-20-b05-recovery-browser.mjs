import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('B05实际410/590")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const fixture=text.slice(text.indexOf(' const printing=',start),text.indexOf(' const beforeFreeze=',start)).replace(" const m=await import('../../src/data/pms/tmf-material-purchases.ts')",'').replaceAll("await import('../../src/data/fcs/","await load('/src/data/fcs/")
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {projectTmfWorkOrders}=await load('/src/data/fcs/tmf-work-order-view.ts');const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const evidence={checks:[],errors:[],scope:'B05实际410/590截断、冻结与补做子链；印花630米交出为外部事实夹具，原生染色/印花和PCS采用UI未执行；不是完整B05验收'}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders');await page.locator('[data-tmf-work-orders]').waitFor()
 await page.evaluate(compile(`${fixture};persistCreatedProductionOrders([full.productionOrderId]);`))
 await page.goto('http://127.0.0.1:43188/wls/accessory-production-stock');await page.locator('[data-tmf-output-stock]').waitFor()
 const query=async()=>{await page.locator('[data-tmf-output-stock] [name="keyword"]').fill('B05-S-EXTRA');await page.locator('[data-tmf-output-stock-action="query"]').click()};await query()
 await page.locator('[data-tmf-output-stock-action="freeze"][data-id="B05-S-EXTRA"]').click()
 const dialog=page.locator('[data-tmf-stock-dialog]'),confirm=()=>page.locator('[data-tmf-output-stock-action="confirm"]').click()
 await confirm();assert.match(await dialog.innerText(),/扫描正确/)
 await dialog.locator('[name="package"]').fill('B05-S-EXTRA');await confirm();assert.match(await dialog.innerText(),/原因并再次确认/)
 await dialog.locator('[name="reason"]').fill('500mm多做10条，独立冻结待处置，不能抵700mm缺口');await dialog.locator('[name="confirmed"]').check();await confirm()
 await page.waitForFunction(()=>!document.querySelector('[data-tmf-stock-dialog] [name="package"]'))
 assert.match(await page.locator('[data-tmf-stock-table]').innerText(),/余量冻结待处置/);assert.equal(await page.locator('[data-tmf-output-stock-action="allocate"]').count(),0);assert.equal(await page.locator('[data-tmf-output-stock-action="split"]').count(),0)
 const recovery=text.slice(text.indexOf(' // 从同一印花连续回料批次',start),text.indexOf('\n})',start))
 evidence.final=await page.evaluate(compile(`const p=getTmfPurchaseState().orders.find(o=>o.purchaseOrderNo==='B05-ACTUAL-PO'),lot=getTmfPurchaseState().lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo).id,demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId==='B05-ACTUAL-PROD');${recovery};return {continuous:returns,production:demands.map(d=>getTmfProductionDemandFulfillment(d.id).receivedPieces),frozen:getTmfPurchaseState().packages.find(p=>p.id==='B05-S-EXTRA').surplusFreeze.pieces};`))
 assert.deepEqual(evidence.final,{continuous:2.5,production:[400,600],frozen:10})
 await page.reload();await page.locator('[data-tmf-output-stock]').waitFor();await query();assert.match(await page.locator('[data-tmf-stock-table]').innerText(),/余量冻结待处置/)
 await page.locator('[data-tmf-output-stock-action="detail"][data-id="B05-S-EXTRA"]').click();assert.match(await dialog.innerText(),/实存 10，占用 0，可分配 0/);assert.match(await dialog.innerText(),/500mm/);assert.match(await dialog.innerText(),/不能抵700mm缺口/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/b05-recovery.png'})
 evidence.checks.push('实际410/590截断，先领400/590，两需求分别缺0/10；仓库页面错包/未确认阻断，主管冻结10条短规格','同一连续退料批次再领8米，补10条700mm、退0.5米/损0.5米，最终实收400/600且连续余2.5米','刷新后500mm10条实存保留，可分配0，冻结原因及操作人时间可追溯；1024px无主体溢出')
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/b05-recovery-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
