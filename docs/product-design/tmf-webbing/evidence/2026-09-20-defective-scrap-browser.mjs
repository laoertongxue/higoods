import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8'),start=text.indexOf("test('待打头条料不计合格产出")
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const fixture=text.slice(text.indexOf('  const purchaseOrder =',start),text.indexOf('  const beforeScrap=',start))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality '+a+' / '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'从采购220米和原型动作形成错长度/错头不良；页面报废后以数据动作补做至实收400条，不冒充规范B06原始1000根及所有上游页面验收'}
try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders');await page.locator('[data-tmf-work-orders]').waitFor()
 const key=await page.evaluate(compile(`${fixture}window.__scrapFixture={purchaseOrder,source,demand,input,tipInput};return JSON.stringify([source.productionOrderId,source.techPackSnapshot.snapshotId,'CUT']);`))
 await page.goto(`http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(key)}`)
 const root=page.locator('[data-tmf-work-detail]'),act=n=>root.locator(`[data-tmf-work-detail-action="${n}"]`),form=page.locator('[data-tmf-detail-dialog]')
 await root.waitFor();await act('tab').filter({hasText:'加工产出'}).click()
 const open=async(cut,tip)=>{const id=JSON.stringify([cut,tip]);await act('scrap').and(root.locator(`[data-id='${id}']`)).click()}
 await open('TIP-OUT','WRONG-TIP-RESULT')
 await form.locator('[name="quantity"]').fill('11');await form.locator('[name="reason"]').fill('错误塑料头实物报废');await form.locator('[name="confirmed"]').check();await act('confirm').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-detail-error]')?.textContent.includes('超过'))
 await form.locator('[name="quantity"]').fill('10');await act('confirm').click();await page.waitForFunction(()=>!document.querySelector('[data-tmf-detail-dialog] input'))
 await open('TIP-BAD',null);await form.locator('[name="quantity"]').fill('10');await form.locator('[name="reason"]').fill('错误550mm长度报废');await form.locator('[name="confirmed"]').check();await act('confirm').click();await page.waitForFunction(()=>!document.querySelector('[data-tmf-detail-dialog] input'))
 assert.equal(await act('scrap').count(),0);assert.match(await root.innerText(),/已报废 10，待处置 0/)
 const facts=await page.evaluate(compile(`return {scraps:getTmfPurchaseState().defectiveScraps.map(s=>({pieces:s.pieces,meters:s.equivalentMeters})),plasticUsed:getTmfPurchaseState().tipMaterialIssues.find(i=>i.id==='PLASTIC-ISS').usedQty};`))
 assert.deepEqual(facts,{scraps:[{pieces:10,meters:5},{pieces:10,meters:5.5}],plasticUsed:20});evidence.facts=facts
 evidence.checks.push('实际页面超量报废阻断；错头10条和错长度10条确认报废，已耗20个塑料头不重复扣减')
 // 导航后测试临时变量在同一页面仍可用；补做执行原型动作并核对终点。
 const recovery=text.slice(text.indexOf('  // 补做20条：',start),text.indexOf("\n})",text.indexOf('  // 补做20条：',start)))
 // fixture variables are reconstructed from persisted records after route navigation.
 const result=await page.evaluate(compile(`const purchaseOrder=purchase('TIP-WIP',220),source=productionSource('TIP-PROD'),demand=getTmfPurchaseState().demands.find(d=>d.productionOrderId==='TIP-PROD'),spec=demand.specification,input={outputId:'TIP-OUT',issueId:'TIP-ISS',cutPieces:390,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:null,lossMeters:0,reason:''},tipInput={id:'TIP-RESULT',cutOutputId:'TIP-OUT',pieces:380,defectivePieces:0,actualFinishedLengthMm:500,endA:spec.endA,endB:spec.endB,materials:[],reason:''};${recovery}return {received:final.productionReceivedPieces,scrapped:final.scrappedPieces,meters:final.scrappedEquivalentMeters,pending:final.pendingDefectivePieces};`))
 assert.deepEqual(result,{received:400,scrapped:20,meters:10.5,pending:0});evidence.result=result
 await page.reload();await root.waitFor();await act('tab').filter({hasText:'加工产出'}).click();assert.equal(await act('scrap').count(),0)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/defective-scrap.png',fullPage:true})
 evidence.checks.push('补做20条并完成全部400条生产实收，剩连续料9.5米、金属头95个；刷新保持报废记录且无重复报废入口')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/defective-scrap-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
