import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('已加工换版：旧200条冻结")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const fixture=text.slice(text.indexOf(" const p=purchase('FROZEN-REPLAN'",start),text.indexOf('  const review=',start)).replace(' try{','').replace('const main={...source,','const main={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)),...source,processWorkOrderDefinitions:[],auditLogs:[],')
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {productionOrderRuntimeStore}=await load('/src/data/fcs/production-order-runtime-store.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'已加工版本变更的白色直接截断专项；原型采购/加工/仓收动作、保存采用版本、页面冻结重算及新版实收；不替代B14印染补购链及PCS采用UI'}
try{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 const url='http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders'
 await page.goto(url);await page.locator('[data-tmf-work-orders]').waitFor()
 await page.evaluate(compile(`${fixture}persistCreatedProductionOrders([main.productionOrderId]);`))
 await page.reload();await page.locator('[data-tmf-work-orders]').waitFor()
 const open=()=>page.locator('[data-tmf-work-orders-action="version"][data-id="FROZEN-REPLAN-PROD"]').first().click(),surface=page.locator('[data-tmf-work-control]')
 await open();assert.match(await surface.innerText(),/500mm × 200 条/);assert.match(await surface.innerText(),/下料 550mm/);assert.match(await surface.innerText(),/未截断 100 米/);assert.match(await surface.innerText(),/在途 100 条/);assert.match(await surface.innerText(),/释放未发分配 50/)
 await surface.locator('[data-tmf-version-action="confirm"]').click();assert.match(await surface.innerText(),/填写变更处理原因/)
 await surface.locator('[name="reason"]').fill('旧规格原位冻结，新要求重新准备');await surface.locator('[name="confirmed"]').check()
 const other=await context.newPage();await other.goto(url);await other.locator('[data-tmf-work-orders]').waitFor()
 await other.evaluate(compile(`const d=getTmfPurchaseState().demands.find(d=>d.productionOrderId==='FROZEN-REPLAN-PROD'&&d.garmentSize==='S');receiveTmfOutputPackage({handoverId:'FR-OLD',packageId:'FR-OLD',warehouseId:'MOCK-ACC-WH',demandId:d.id,location:'OLD-01',receivedPieces:100},warehouse,'FR-BROWSER:last-receipt');`))
 await surface.locator('[data-tmf-version-action="confirm"]').click();assert.match(await surface.innerText(),/旧实物发生收发/)
 await surface.getByRole('button',{name:'关闭',exact:true}).click();await open();assert.match(await surface.innerText(),/在途 0 条/)
 await surface.locator('[name="reason"]').fill('重新核对旧仓200条与旧未截断100米');await surface.locator('[name="confirmed"]').check();await surface.locator('[data-tmf-version-action="confirm"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-work-feedback]')?.textContent.includes('旧占用已释放'))
 await other.close();await page.reload();await page.locator('[data-tmf-work-orders]').waitFor()
 const saved=await page.evaluate(compile(`const s=getTmfPurchaseState();return {oldStock:getTmfOutputPackageBalance('FR-OLD').onHandPieces,oldAvailable:getTmfOutputPackageBalance('FR-OLD').availablePieces,oldLength:s.packages.find(p=>p.id==='FR-OLD').actualCutLengthMm,released:s.outputAllocations.find(a=>a.id==='FR-OLD').releasedPieces,newCount:s.demands.filter(d=>d.techPackSnapshotId==='FR-SNAP-2').length};`))
 assert.deepEqual(saved,{oldStock:200,oldAvailable:0,oldLength:500,released:50,newCount:2});evidence.frozen=saved
 evidence.checks.push('变更弹窗核对旧200条、未截断100米及在途/分配；缺少确认阻断，其他标签页收货使旧预览失效；重开后冻结重算并刷新')
 const recovery=text.slice(text.indexOf('  // 原厂内100米',start),text.indexOf(' }finally',text.indexOf('  // 原厂内100米',start)))
 const result=await page.evaluate(compile(`const p=purchase('FROZEN-REPLAN',1000),lotId=p.purchaseOrderNo+':batch',source=productionOrders.find(o=>o.productionOrderId==='FROZEN-REPLAN-PROD'),next=getTmfPurchaseState().demands.filter(d=>d.techPackSnapshotId==='FR-SNAP-2');${recovery};return {continuous:balance,productionReceived:getTmfProductionDisposition(source.productionOrderId).productionReceivedPieces,oldStock:getTmfOutputPackageBalance('FR-OLD').onHandPieces,oldAvailable:getTmfOutputPackageBalance('FR-OLD').availablePieces};`))
 assert.deepEqual(result,{continuous:260,productionReceived:1000,oldStock:200,oldAvailable:0});evidence.result=result
 evidence.checks.push('旧100米按原来源退仓，新550/700mm各400/600条加工至生产实收；旧200条仍500mm冻结，连续库存260米，总账1000=640+100+260')
 await page.evaluate(compile(`const o=productionOrders.find(o=>o.productionOrderId==='FROZEN-REPLAN-PROD');o.techPackSnapshot=structuredClone(o.techPackSnapshot);o.techPackSnapshot.snapshotId='FR-SNAP-3';o.techPackSnapshot.sourceTechPackVersionId='FR-TECH-3';o.selectedTechPackVersionId='FR-TECH-3';persistCreatedProductionOrders([o.productionOrderId]);`))
 await page.reload();await page.locator('[data-tmf-work-orders]').waitFor();await open();assert.match(await surface.innerText(),/已有生产发料或实收/);assert.equal(await surface.locator('[data-tmf-version-action="confirm"]').count(),0)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/frozen-replan.png',fullPage:true})
 evidence.checks.push('下一版已有生产实收，完整重做入口被阻断，1024px无主体横向溢出')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/frozen-replan-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
