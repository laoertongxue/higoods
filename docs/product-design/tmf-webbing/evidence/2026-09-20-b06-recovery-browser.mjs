import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('B06规范恢复：")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const body=text.slice(text.indexOf('  const fixture=',start),text.indexOf("\n})",start))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {createPmsTmfTipPurchase,listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const readFileSync=()=>JSON.stringify(window.__tmfFixture);const assert={async rejects(fn,re){try{await fn}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')},ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'B06规范数量动作链在隔离浏览器运行并刷新核对；原纱线及误用塑料头从仓库实收事实起点，补购生产不虚构配方；不是所有采购/加工页面验收'}
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders');await page.locator('[data-tmf-work-orders]').waitFor()
 await page.evaluate(f=>window.__tmfFixture=f,JSON.parse(readFileSync('docs/product-design/tmf-webbing/mock-full-flow.json','utf8')))
 const result=await page.evaluate(compile(`${body};return {key:JSON.stringify([source.productionOrderId,source.techPackSnapshot.snapshotId,'CUT']),continuous,productionReceived:end.productionReceivedPieces,scrapped:end.scrappedPieces,scrappedMeters:end.scrappedEquivalentMeters,loss};`))
 evidence.facts=result;assert.equal(result.continuous,9);assert.equal(result.productionReceived,1000);assert.equal(result.scrapped,100);assert.equal(result.scrappedMeters,120);assert.equal(result.loss,11)
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders/'+encodeURIComponent(result.key))
 const root=page.locator('[data-tmf-work-detail]');await root.waitFor();await root.locator('[data-tmf-work-detail-action="tab"]').filter({hasText:'加工产出'}).click()
 assert.match(await root.innerText(),/已报废 100，待处置 0/)
 assert.equal(await root.locator('[data-tmf-work-detail-action="scrap"]').count(),0)
 await page.reload();await root.waitFor();await root.locator('[data-tmf-work-detail-action="tab"]').filter({hasText:'加工产出'}).click();assert.match(await root.innerText(),/已报废 100，待处置 0/)
 const saved=await page.evaluate(compile(`const end=getTmfProductionDisposition('FULL-B06-PROD'),s=getTmfPurchaseState();return {received:end.productionReceivedPieces,scrapped:end.scrappedPieces,metal:s.tipMaterialLots.find(l=>l.id==='FULL-B06-METAL-LOT').onHandQty,plastic:s.tipMaterialLots.find(l=>l.id==='FULL-B06-PLASTIC-LOT').onHandQty};`))
 assert.deepEqual(saved,{received:1000,scrapped:100,metal:15,plastic:2});evidence.saved=saved
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/b06-recovery.png',fullPage:true})
 evidence.checks.push('规范1300+100米采购、100根误头报废、122米补发补做100根、全部1000根生产实收动作通过','刷新后实际报废及剩余金属15/塑料2保持，已报废不再出现报废入口，1024px无主体溢出')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/b06-recovery-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
