import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-purchase-base-flow.test.ts','utf8')
const names=text.match(/import \{\n  receiveTmfSupplyPurchase,[\s\S]*?\} from '..\/..\/src\/data\/pms\/tmf-material-purchases.ts'/)[0].split('} from')[0].replace('import {','').replace(/type \w+,?\s*/g,'')
const helpers=text.slice(text.indexOf('const buyer:'),text.indexOf("test('N01～N05"))
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const m=await load('/src/data/pms/tmf-material-purchases.ts');const {${names}}=m;const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await load('/src/data/fcs/production-orders.ts');const {listPmsMaterialPurchaseOrders,getPmsMaterialPurchaseOrder,advancePmsMaterialPurchaseOrderStatus}=await load('/src/data/pms/material-purchase-orders.ts');const {PMS_BUYER_ACTOR}=await load('/src/data/pms/runtime.ts');const assert={ok(v){if(!v)throw Error('fixture missing')},equal(a,b){if(a!==b)throw Error('fixture inequality')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${helpers}${code}})()`.replaceAll('import.meta.url','location.href'),{loader:'ts',target:'esnext'}).code
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],scope:'加工单计划时间及实际事件读取；未实现独立开完工登记，不设置SLA，无全入口5次性能证明'}
try{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders');await page.locator('[data-tmf-work-orders]').waitFor()
 const key=await page.evaluate(compile(`const p=purchase('TIME-BROWSER',500);prepare(p);receiveTmfBaseProduction(receipt(p,500),warehouse,'TIME:receipt');const source=productionSource('TIME-BROWSER-PROD');source.demandSnapshot.requiredDeliveryDate='2026-09-25';const full={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)),...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId,processWorkOrderDefinitions:[],auditLogs:[]};productionOrders.push(full);persistCreatedProductionOrders([full.productionOrderId]);registerTmfProductionOrder(full,planner,'TIME:generate');const d=getTmfPurchaseState().demands.find(d=>d.productionOrderId===full.productionOrderId),lot=p.purchaseOrderNo+':batch';reserveTmfContinuousMaterial({reservationId:'TIME-RES',demandId:d.id,lotId:lot,reservedMeters:200,reason:'S规格400条下料'},warehouse,'TIME:reserve');issueTmfContinuousMaterial({issueId:'TIME-IN',reservationId:'TIME-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:200},warehouse,'TIME:issue');receiveTmfProcessingMaterial({issueId:'TIME-IN',factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:200},factory,'TIME:factory-receive');reportTmfCutOutput({outputId:'TIME-OUT',issueId:'TIME-IN',cutPieces:400,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''},factory,'TIME:cut');return JSON.stringify([full.productionOrderId,full.techPackSnapshot.snapshotId,'CUT']);`))
 const url='http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders/'+encodeURIComponent(key)
 await page.goto(url);await page.locator('[data-tmf-work-detail]').waitFor();const tab=()=>page.locator('[data-tmf-work-detail-action="tab"][data-id="times"]').click();await tab()
 const panel=page.locator('[data-tmf-work-times]'),edit=()=>panel.locator('[data-tmf-work-time-action="edit"]').click(),save=()=>panel.locator('[data-tmf-work-time-action="save"]').click(),form=page.locator('[data-tmf-plan-form]'),fill=(k,v)=>form.locator(`[name="${k}"]`).fill(v)
 assert.match(await panel.innerText(),/实际开工／加工完成：未单独登记/);assert.match(await panel.innerText(),/管理最长时效：未设定/)
 await edit();await save();assert.match(await form.innerText(),/负责人和本次计划/)
 await fill('responsible','织带一组主管');await fill('reason','按当前生产需求排期');await fill('start','2026-09-20T09:00');await fill('finish','2026-09-20T08:00');await save();assert.match(await form.innerText(),/完成必须晚于/)
 await fill('finish','2026-09-20T17:00');await fill('waiting','M规格原料待到')
 await page.evaluate(()=>{window.__originalTmfStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='higood-tmf-material-purchases-v1')throw Error('模拟保存失败');return window.__originalTmfStorageSet.call(this,k,v)}})
 await save();assert.match(await form.innerText(),/本次未保存/)
 await page.evaluate(()=>Storage.prototype.setItem=window.__originalTmfStorageSet);await save();await page.waitForFunction(()=>!document.querySelector('[data-tmf-plan-form]'));assert.match(await panel.innerText(),/计划版本 1/);assert.match(await panel.innerText(),/09:00:00/)
 await edit()
 const other=await context.newPage();await other.goto(url);await other.locator('[data-tmf-work-detail]').waitFor()
 await other.evaluate(compile(`m.saveTmfWorkPlan({workOrderId:${JSON.stringify(key)},responsibleName:'计划主管',plannedStartAt:'2026-09-20T09:00:00+07:00',plannedFinishAt:'2026-09-20T18:00:00+07:00',waitingReason:'确认M原料到仓后开后批',reason:'另一页延后一小时',expectedRevision:1},planner,'TIME:other-plan');`))
 await fill('reason','旧页面编辑');await save();assert.match(await form.innerText(),/计划已由其他操作更新/)
 await page.keyboard.press('Escape');assert.equal(await form.count(),0);await other.close();await page.reload();await page.locator('[data-tmf-work-detail]').waitFor();await tab()
 assert.match(await panel.innerText(),/计划版本 2/);assert.match(await panel.innerText(),/18:00:00/);assert.match(await panel.innerText(),/9.000 小时/)
 const facts=await page.evaluate(compile(`const s=getTmfPurchaseState();return {plan:s.workPlans.find(p=>p.workOrderId===${JSON.stringify(key)}),warehouse:s.lots.find(l=>l.sourcePurchaseOrderNo==='TIME-BROWSER-PO').onHandMeters,output:s.cutOutputs.find(o=>o.id==='TIME-OUT').goodPieces};`));assert.equal(facts.warehouse,300);assert.equal(facts.output,400);assert.equal(facts.plan.revision,2);assert.equal(facts.plan.plannedFinishAt,'2026-09-20T11:00:00.000Z');evidence.facts=facts
 await panel.locator('summary').click();assert.match(await panel.innerText(),/织带厂加工投入实收/);assert.match(await panel.innerText(),/截断产出填报/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'output/playwright/tmf-webbing/work-times.png',fullPage:true})
 evidence.checks.push('实际采购500/仓发收200/截断400条后，计划字段不冒充实际开完工；既有收料和产出填报可追溯','空表/倒置计划阻断，模拟保存失败后原表重试；另一页修改使旧版本保存被阻断','Esc关闭，刷新显示最新18点计划与9小时时长，UTC存储与雅加达展示一致；仓余300及合格400条未变，1024px无主体溢出')
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/work-times-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
