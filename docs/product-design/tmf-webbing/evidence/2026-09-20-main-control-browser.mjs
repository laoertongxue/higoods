import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const test=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8')
const names=test.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=test.slice(test.indexOf('const buyer:'),test.indexOf("test('N01～N05"))
const fixture=test.slice(test.indexOf(" const printing=",test.indexOf("test('印花交出按两种")),test.indexOf(' const allocation={orderId:order.printOrderId'))
const setup=`(async()=>{const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);
const {${names}}=await load('/src/data/pms/tmf-material-purchases.ts');
const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');
const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');
const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');
const assert={ok(v){if(!v)throw Error('fixture assertion')},equal(a,b){if(a!==b)throw Error('fixture unequal')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('fixture expected rejection')},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture deep mismatch')}};
${helpers}
${fixture.replaceAll("import('../../src/","load('/src/").replace('const full={','source.techPackSnapshot.bomItems[0].unit="米";source.techPackSnapshot.bomItems[0].unitConsumption=0.65;source.techPackSnapshot.bomItems[0].lossRate=0;const full={')}
persistCreatedProductionOrders([full.productionOrderId]);printing.runPrintProcessMutation(()=>{});
return JSON.stringify([full.productionOrderId,full.techPackSnapshot.snapshotId,'CUT']);})()`
const js=transformSync(setup.replaceAll('import.meta.url', 'location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'采购至基础实收经动作；630米印花交出为外部事实夹具，不替代N01印花生产验收'}
try{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();page.setDefaultTimeout(12000)
 page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders')
 await page.locator('[data-tmf-work-orders]').waitFor()
 const key=await page.evaluate(js)
 await page.goto(`http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(key)}`)
 const root=page.locator('[data-tmf-work-detail]'),action=n=>root.locator(`[data-tmf-work-detail-action="${n}"]`)
 await root.waitFor();await action('tab').filter({hasText:'印染来源'}).click()
 await page.waitForFunction(()=>!document.querySelector('[data-tmf-upstream-content]')?.textContent.includes('正在核对'));await action('allocate-print').click()
 const form=page.locator('[data-tmf-detail-dialog]')
 for(let i=0;i<2;i++){await form.locator(`[name="meters-${i}"]`).fill(String(i?426:206));await form.locator(`[name="origin-${i}"]`).selectOption('PRINTBACK-FIRST')}
 await action('confirm').click();await page.waitForFunction(()=>document.querySelector('[data-tmf-detail-error]')?.textContent.includes('超过印花'))
 for(let i=0;i<2;i++)await form.locator(`[name="meters-${i}"]`).fill(String(i?425:205))
 await action('confirm').click();await page.waitForFunction(()=>!document.querySelector('[data-tmf-detail-dialog] input'))
 evidence.checks.push('页面超分配阻断；修正205+425后保存')
 await action('tab').filter({hasText:'投入／接收／截断'}).click()
 const ids=await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts');return m.getTmfPurchaseState().processingIssues.filter(i=>i.printHandover).map(i=>i.id)})
 assert.equal(ids.length,2)
 for(const [index,qty] of [[0,203],[0,2],[1,425]]){
  await action('receive').filter({hasText:'实收'}).and(root.locator(`[data-id="${ids[index]}"]`)).click()
  await form.locator('[name="sku"]').fill('PATTERN');await form.locator('[name="quantity"]').fill(String(qty));await action('confirm').click()
  await page.waitForFunction(()=>!document.querySelector('[data-tmf-detail-dialog] input'))
 }
 await page.reload();await root.waitFor()
 const facts=await page.evaluate(async()=>{
  const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts'),h=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/pda-handover-events.ts')?.name??'/src/data/fcs/pda-handover-events.ts'),p=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/printing-task-domain.ts')?.name??'/src/data/fcs/printing-task-domain.ts');
  return {received:m.getTmfPurchaseState().processingIssues.filter(i=>i.printHandover).map(i=>i.receivedMeters),raw:JSON.parse(localStorage.getItem('higood-tmf-material-purchases-v1')).processingIssues.filter(i=>i.printHandover).map(i=>i.receivedMeters),native:h.readCurrentPreparationHandoverRecord('PRINTBACK-RECORD').receiverWrittenQty,print:p.getPrintingWorkOrderById('PRINTBACK-PRINT').handover.receivedQty}
 })
 assert.deepEqual(facts,{received:[205,425],raw:[0,0],native:630,print:630});evidence.facts=facts
 evidence.checks.push('页面分三次实收，刷新后TMF与原印花交出同为630米；TMF未重复存储实收量')
 const other=await context.newPage();await other.goto(page.url());await other.locator('[data-tmf-work-detail]').waitFor()
 const setMain=async(status)=>other.evaluate(async(status)=>{const path='/src/data/fcs/production-orders.ts',m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);m.productionOrders.find(o=>o.productionOrderId==='PRINTBACK-PROD').status=status;m.persistCreatedProductionOrders()},status)
 await setMain('ON_HOLD')
 await action('tab').filter({hasText:'投入／接收／截断'}).click()
 await action('cut').and(root.locator(`[data-id="${ids[0]}"]`)).click()
 for(const [name,value] of Object.entries({quantity:400,length:500,finished:500,loss:1,reason:'暂停边界测试'}))await form.locator(`[name="${name}"]`).fill(String(value))
 const beforeBlocked=await page.evaluate(()=>localStorage.getItem('higood-tmf-material-purchases-v1'))
 await action('confirm').click();await page.waitForFunction(()=>document.querySelector('[data-tmf-detail-error]')?.textContent.includes('已暂停'))
 assert.equal(await page.evaluate(()=>localStorage.getItem('higood-tmf-material-purchases-v1')),beforeBlocked)
 await action('close').filter({hasText:'关闭'}).click();await setMain('EXECUTING')
 evidence.checks.push('另一标签页保存主单暂停，旧加工页提交被阻断且整账不变；源页恢复后继续原流程')
 await action('tab').filter({hasText:'投入／接收／截断'}).click()
 for(let i=0;i<2;i++){
  await action('cut').and(root.locator(`[data-id="${ids[i]}"]`)).click()
  for(const [name,value] of Object.entries({quantity:i?600:400,length:i?700:500,finished:i?700:500,loss:1,reason:'验收切割损耗'}))await form.locator(`[name="${name}"]`).fill(String(value))
  await action('confirm').click();await page.waitForFunction(()=>!document.querySelector('[data-tmf-detail-dialog] input'))
 }
 const terminal=await page.evaluate(async()=>{
  const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts'),factory={id:'TMF-SUP',name:'织带厂主管',role:'织带厂主管'},warehouse={id:'ACC-WH',name:'辅料仓仓管',role:'仓管'},planner={id:'PLAN',name:'生产计划',role:'生产计划'},receiver={id:'PROD-RECEIVER',name:'生产领料员',role:'生产领料人'}
  const outputs=m.getTmfPurchaseState().cutOutputs.filter(o=>m.getTmfPurchaseState().processingIssues.find(i=>i.id===o.sourceIssueId)?.printHandover)
  for(const [index,o] of outputs.entries()){
   const id=`BROWSER-END-${index}`,qty=index?600:400,pkg=id+'-PKG',demandId=o.demandId
   m.dispatchTmfContinuousReturn({returnId:id,issueId:o.sourceIssueId,batchId:id+'-LOT',returnedMeters:4,reason:'余料退仓'},factory,id+'-return')
   m.receiveTmfContinuousReturn({returnId:id,warehouseId:'MOCK-ACC-WH',materialSkuId:'PATTERN',location:'R-01',receivedMeters:4},warehouse,id+'-returnreceive')
   m.packTmfOutput({packageId:pkg,cutOutputId:o.id,pieces:qty},factory,id+'-pack')
   m.dispatchTmfOutputPackage({handoverId:id+'-H',packageId:pkg,warehouseId:'MOCK-ACC-WH'},factory,id+'-dispatch')
   m.receiveTmfOutputPackage({handoverId:id+'-H',packageId:pkg,warehouseId:'MOCK-ACC-WH',demandId,location:'P-01',receivedPieces:qty},warehouse,id+'-receive')
   m.allocateTmfOutputPackage({allocationId:id+'-A',packageId:pkg,demandId,pieces:qty,receiverId:receiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,id+'-allocate')
   m.issueTmfProductionPackage({issueId:id+'-ISS',allocationId:id+'-A',packageId:pkg,demandId,warehouseId:'MOCK-ACC-WH',pieces:qty},warehouse,id+'-issue')
   m.receiveTmfProductionPackage({issueId:id+'-ISS',packageId:pkg,demandId,receiverOrganizationId:'PRODUCTION-01',pieces:qty},receiver,id+'-final')
  }
  return outputs.map(o=>({fulfilled:m.getTmfProductionDemandFulfillment(o.demandId).status,remaining:m.getTmfProcessingInputBalance(o.sourceIssueId).remainingMeters}))
 })
 assert.deepEqual(terminal,[{fulfilled:'已满足',remaining:0},{fulfilled:'已满足',remaining:0}]);evidence.terminal=terminal
 evidence.checks.push('页面截断400条50cm及600条70cm；随后经数据动作退连续余料8米、回仓、分配、发料、生产实收1000条。下游动作未冒充页面验收')
 await setMain('CANCELLED')
 await page.reload();await root.waitFor()
 const cancellation=await page.evaluate(()=>JSON.parse(localStorage.getItem('higood.formal-created-production-orders.v1')).orders.find(o=>o.productionOrderId==='PRINTBACK-PROD').status)
 assert.equal(cancellation,'CANCELLED')
 evidence.checks.push('另一页取消后旧页刷新触发离页保存，已保存取消状态保持，不恢复执行中')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/main-control.png',fullPage:true})
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/main-control-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
