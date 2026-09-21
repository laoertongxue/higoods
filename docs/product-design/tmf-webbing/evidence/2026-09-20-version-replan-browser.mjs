import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('未发料换版释放旧占用")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const fixture=text.slice(text.indexOf(" const p=purchase('REPLAN'",start),text.indexOf('  const input=',start)).replace(' try{','').replace('const main={...source,','const main={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)),...source,processWorkOrderDefinitions:[],auditLogs:[],')
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {productionOrderRuntimeStore}=await load('/src/data/fcs/production-order-runtime-store.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'主单新版本以原保存动作准备；采购、占用与新版收发走真实原型动作，不代表PCS采用页面已验'}
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(12000);page.on('pageerror',e=>evidence.errors.push(e.message))
 const url='http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders'
 await page.goto(url);await page.locator('[data-tmf-work-orders]').waitFor()
 await page.evaluate(compile(`${fixture}persistCreatedProductionOrders([main.productionOrderId]);`))
 await page.reload();await page.locator('[data-tmf-work-orders]').waitFor()
 const open=()=>page.locator('[data-tmf-work-orders-action="version"][data-id="REPLAN-PROD"]').first().click()
 await open();const surface=page.locator('[data-tmf-work-control]')
 assert.match(await surface.innerText(),/下料 500mm/);assert.match(await surface.innerText(),/下料 550mm/);assert.match(await surface.innerText(),/20 米/)
 await surface.locator('[data-tmf-version-action="confirm"]').click();assert.match(await surface.innerText(),/填写变更处理原因/)
 await surface.locator('[name="reason"]').fill('采用新长度，旧单未发料');await surface.locator('[name="confirmed"]').check()
 await page.evaluate(compile(`releaseTmfContinuousReservation('RP-OLD',1,'预览期间部分释放',planner,'BROWSER-RELEASE');`))
 await surface.locator('[data-tmf-version-action="confirm"]').click();assert.match(await surface.innerText(),/占用已变化/)
 await surface.getByRole('button',{name:'关闭',exact:true}).click();await open()
 await surface.locator('[name="reason"]').fill('重新核对19米占用');await surface.locator('[name="confirmed"]').check();await surface.locator('[data-tmf-version-action="confirm"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-work-feedback]')?.textContent.includes('旧占用已释放'))
 evidence.checks.push('新旧500/700→550/750规格核对，缺确认和旧占用预览阻断；重新核对19米后确认并生成新版')
 await page.reload();await page.locator('[data-tmf-work-orders]').waitFor()
 const loop=text.slice(text.indexOf('  for(const [i,d] of next.entries())',start),text.indexOf("  assert.equal(getTmfPurchaseState().lots.find",text.indexOf('  for(const [i,d] of next.entries())',start)))
 const result=await page.evaluate(compile(`const p=purchase('REPLAN',100),lotId='REPLAN-PO:batch';const next=getTmfPurchaseState().demands.filter(d=>d.techPackSnapshotId==='RP-SNAP-2');${loop}return {count:next.length,status:next.map(d=>getTmfProductionDemandFulfillment(d.id).status),remaining:getTmfPurchaseState().lots.find(l=>l.id===lotId).onHandMeters,old:getTmfPurchaseState().demands.find(d=>d.productionOrderId==='REPLAN-PROD'&&d.techPackSnapshotId!=='RP-SNAP-2').specification.cutLengthMm};`))
 assert.deepEqual(result,{count:2,status:['已满足','已满足'],remaining:33,old:500});evidence.result=result
 evidence.checks.push('刷新后新版只有两条需求；按新版动作加工、回仓、发料、生产实收100条，余料33米；旧500mm需求保留')
 await page.evaluate(compile(`const o=productionOrders.find(o=>o.productionOrderId==='REPLAN-PROD');o.techPackSnapshot=structuredClone(o.techPackSnapshot);o.techPackSnapshot.snapshotId='RP-SNAP-3';o.techPackSnapshot.sourceTechPackVersionId='RP-TECH-3';o.selectedTechPackVersionId='RP-TECH-3';persistCreatedProductionOrders();`))
 await page.reload();await page.locator('[data-tmf-work-orders]').waitFor();await open()
 assert.match(await surface.innerText(),/旧实物核对|旧需求已有发料或加工实物/);assert.equal(await surface.locator('[data-tmf-version-action="confirm"]').count(),0)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/version-replan.png',fullPage:true})
 evidence.checks.push('下一次换版已存在加工实物，弹窗显示阻断且不提供未发料重算确认')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/version-replan-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
