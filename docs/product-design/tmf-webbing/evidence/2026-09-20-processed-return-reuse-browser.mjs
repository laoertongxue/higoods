import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('印花交出按两种")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const body=text.slice(text.indexOf(' const printing=',start),text.indexOf(' const beforeReuse=',start))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {createPmsTmfTipPurchase,listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const readFileSync=()=>JSON.stringify(window.__tmfFixture);const assert={async rejects(fn,re){try{await (typeof fn==='function'?fn():fn)}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')},ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code.replaceAll("import('../../src/","load('/src/").replace(" const m=await load('/src/data/pms/tmf-material-purchases.ts')",'').replace('const full={','source.techPackSnapshot.bomItems[0].unit="米";source.techPackSnapshot.bomItems[0].unitConsumption=0.65;source.techPackSnapshot.bomItems[0].lossRate=0;const full={')}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'原采购及印花回料专项→两规格加工退料→另单8条从已印花回仓批次备料并实收；630米原印花交出为外部事实夹具，不替代N01/B14完整上游'}
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders');await page.locator('[data-tmf-work-orders]').waitFor()
 const demandId=await page.evaluate(compile(`${body};persistCreatedProductionOrders([full.productionOrderId]);printing.runPrintProcessMutation(()=>{});return rd.id;`))
 await page.goto('http://127.0.0.1:43188/wls/accessory-material-preparation')
 const root=page.locator('[data-tmf-preparation]'),act=n=>root.locator('[data-tmf-preparation-action="'+n+'"]'),surface=page.locator('[data-tmf-preparation-dialog]')
 await root.waitFor();await root.locator('[name="keyword"]').fill('PRINTREUSE-PROD');await act('query').click();await act('prepare').click();await act('reserve').click()
 const options=await surface.locator('[name="lot"]').innerText();assert.match(options,/PATTERN · 投入织带截断/)
 await surface.locator('[name="lot"]').selectOption('PRINTBACK-RETURN-LOT-0');await surface.locator('[name="quantity"]').fill('4');await surface.locator('[name="reason"]').fill('同花型回仓余料直接截断');await act('confirm').click()
 await act('issue').click();assert.match(await surface.innerText(),/实际SKU PATTERN · 投入\s*织带截断/);assert.match(await surface.innerText(),/接收工厂：TMF/);assert.match(await surface.innerText(),/加工后SKU按参考图核对/);assert.equal(await surface.locator('[name="targetFactory"]').count(),0)
 await surface.locator('[name="quantity"]').fill('4');await surface.locator('[name="issue"]').fill('PRINTREUSE');await surface.locator('[name="batch"]').fill('PRINTBACK-RETURN-LOT-0');await surface.locator('[name="sku"]').fill('WB30-WHT');await surface.locator('[name="confirmed"]').check();await act('confirm').click();assert.match(await surface.innerText(),/所扫批次或SKU不符/)
 await surface.locator('[name="sku"]').fill('PATTERN');await act('confirm').click();await page.waitForFunction(()=>document.querySelector('[data-tmf-preparation-feedback]')?.textContent.includes('已保存本次记录'))
 await page.reload();await root.waitFor()
 const fact=await page.evaluate(compile(`const i=getTmfPurchaseState().processingIssues.find(i=>i.id==='PRINTREUSE');return {sku:i.materialSkuId,entry:i.targetRouteEntryId,factory:i.targetFactoryId,received:i.receivedMeters,upstream:i.upstream??null};`))
 assert.deepEqual(fact,{sku:'PATTERN',entry:'CUT',factory:'FAC-TMF',received:0,upstream:null});evidence.issue=fact
 const rest=text.slice(text.indexOf(" receiveTmfProcessingMaterial({issueId:'PRINTREUSE'",start),text.indexOf('\n})',text.indexOf(" receiveTmfProcessingMaterial({issueId:'PRINTREUSE'",start)))
 const result=await page.evaluate(compile(`const printing=await load('/src/data/fcs/printing-task-domain.ts'),p=purchase('PRINTBACK',1000),lot=p.purchaseOrderNo+':batch',order=printing.getPrintWorkOrderById('PRINTBACK-PRINT'),upstreamBefore=630,returnLot='PRINTBACK-RETURN-LOT-0',rd=getTmfPurchaseState().demands.find(d=>d.productionOrderId==='PRINTREUSE-PROD');${rest};return {received:getTmfProductionDemandFulfillment(rd.id).receivedPieces,sourceReturned:getTmfPurchaseState().continuousReturns.find(r=>r.id==='PRINTBACK-RETURN-0').receivedMeters,remaining:getTmfPurchaseState().lots.find(l=>l.id===returnLot).onHandMeters};`))
 assert.deepEqual(result,{received:8,sourceReturned:4,remaining:0});evidence.result=result
 await page.reload();await root.waitFor();await root.locator('[name="keyword"]').fill('PRINTREUSE-PROD');await act('query').click();await act('prepare').click();assert.match(await surface.innerText(),/工厂实收 4 米/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'output/playwright/tmf-webbing/processed-return-reuse.png',fullPage:true})
 evidence.checks.push('已印花回仓批次可选，目标截断及TMF可见；误扫白坯SKU阻断，正确PATTERN发出后刷新仍为截断投入','新需求8条完成工厂实收、截断、回仓、生产实收；原退料实收4米历史保留，已用批次库存0，原采购/印花收货不重复增加')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/processed-return-reuse-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
