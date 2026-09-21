import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('B05实际410/590")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const unusedFixture=text.slice(text.indexOf(' const printing=',start),text.indexOf(' const beforeFreeze=',start)).replace(" const m=await import('../../src/data/pms/tmf-material-purchases.ts')",'').replaceAll("await import('../../src/data/fcs/","await load('/src/data/fcs/")
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;var receiving=await load('/src/data/fcs/factory-receiving.ts'),receivingLinks=await load('/src/data/fcs/factory-receiving-links.ts');const {projectTmfWorkOrders}=await load('/src/data/fcs/tmf-work-order-view.ts');const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={async rejects(fn,re){try{await fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('expected rejection')},ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code

const chainStart=text.indexOf("test('印花交出按两种长度分配")
const begin=text.indexOf(' const printing=',chainStart),release=text.indexOf(" releaseTmfContinuousReservation('PRINTBACK-OTHER-RES',50",begin)
const end=text.indexOf(' // 以下是独立的回料再用契约',release)
const convert=code=>code.replace(" const m=await import('../../src/data/pms/tmf-material-purchases.ts')",'').replaceAll("await import('../../src/data/fcs/","await load('/src/data/fcs/")
const initial=convert(text.slice(begin,release)).split('\n').filter(line=>!/^\s*const receiving(?:Links)?\s*=/.test(line)).join('\n')
const continuation=text.slice(text.indexOf('\n',release)+1,end).replaceAll("await import('../../src/data/fcs/","await load('/src/data/fcs/")
const evidence={checks:[],errors:[],scope:'B09释放占用UI及下游恢复；原生印染未执行，630米交出是明确外部夹具；不构成整链验收'}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/wls/accessory-material-preparation');await page.locator('[data-tmf-preparation]').waitFor()
 await page.evaluate(compile(`${initial};persistCreatedProductionOrders([full.productionOrderId]);globalThis.b09Fixture={p,lot,source,full,demands,otherDemand};`))
 await page.locator('[name="keyword"]').fill('PRINTBACK-OTHER');await page.locator('[data-tmf-preparation-action="query"]').click()
 await page.locator('[data-tmf-preparation-action="prepare"]').first().click()
 await page.locator('[data-tmf-preparation-action="release"][data-id="PRINTBACK-OTHER-RES"]').click()
 const dialog=page.locator('[data-tmf-preparation-dialog]');await dialog.locator('[name="quantity"]').fill('50');await dialog.locator('[name="reason"]').fill('其他需求确认释放50米，剩余350米继续保留占用')
 await page.locator('[data-tmf-preparation-action="confirm"]').click();assert.match(await dialog.innerText(),/确认/)
 await dialog.locator('[name="confirmed"]').check();await page.locator('[data-tmf-preparation-action="confirm"]').click();assert.match(await dialog.innerText(),/未发占用 350 米/)
 evidence.final=await page.evaluate(compile(`const p=getTmfPurchaseState().orders.find(o=>o.purchaseOrderNo==='PRINTBACK-PO'),lot=getTmfPurchaseState().lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo).id,full=productionOrders.find(o=>o.productionOrderId==='PRINTBACK-PROD'),source=full,demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId==='PRINTBACK-PROD'),otherDemand=getTmfPurchaseState().demands.find(d=>d.productionOrderId==='PRINTBACK-OTHER');const printing=await load('/src/data/fcs/printing-task-domain.ts'),handover=await load('/src/data/fcs/pda-handover-events.ts'),taskStore=await load('/src/data/fcs/pda-task-mock-factory.ts');${continuation};return b09Result;`))
 await page.reload();await page.locator('[data-tmf-preparation]').waitFor();await page.locator('[name="keyword"]').fill('PRINTBACK-OTHER');await page.locator('[data-tmf-preparation-action="query"]').click()
 await page.locator('[data-tmf-preparation-action="prepare"]').first().click();assert.match(await dialog.innerText(),/未发占用 350 米/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(evidence.errors,[])
 await page.screenshot({path:'output/playwright/tmf-webbing/b09-recovery.png'})
 evidence.checks.push('页面释放50米须原因及再次确认','恢复后生产实收400/600，基础仓350米全部属于其他需求占用，连续回料8米','刷新后仍保留其他需求350米占用，不能再次抢占1米；1024px无主体溢出')
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/b09-recovery-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
