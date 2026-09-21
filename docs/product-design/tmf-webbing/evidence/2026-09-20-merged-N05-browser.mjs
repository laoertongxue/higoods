import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true})
const evidence={route:'/wls/accessory-material-preparation',checks:[],errors:[]}
try{
const page=await browser.newPage({viewport:{width:1366,height:768}})
page.on('pageerror',e=>evidence.errors.push(e.message))
await page.goto('http://127.0.0.1:43188'+evidence.route)
await page.locator('[data-tmf-preparation]').waitFor()
await page.evaluate(async()=>{
 const load=async path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path)
 const m=await load('/src/data/pms/tmf-material-purchases.ts')
 const {productionOrders,getProductionOrderTechPackSnapshot}=await load('/src/data/fcs/production-orders.ts')
function productionSource(id) {
  const template = productionOrders.find((order) => order.techPackSnapshot)
  const pack = getProductionOrderTechPackSnapshot(template.productionOrderId)
  pack.productionOrderId = id
  pack.snapshotId = `${id}-SNAPSHOT-V1`
  pack.sourceTechPackVersionId = `${id}-TECH-V1`
  pack.bomItems = [{ ...pack.bomItems[0], id: 'BOM-WB', type: '辅料', materialSkuId: 'tmf-webbing-reference-white', applicableSkuCodes: [] }]
  const specification = {
    id: 'S-50', bomItemId: 'BOM-WB', usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
    cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '冷切', acceptanceRequirement: '按确认样',
    tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
  }
  pack.processEntries = [{
    id: 'CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段', processCode: 'WEBBING_CUT', processName: '织带截断',
    assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    routeObjectKey: 'BOM:BOM-WB', linkedBomItemIds: ['BOM-WB'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES', inputMaterialSkuId: 'tmf-webbing-reference-white', outputMaterialSkuId: 'tmf-webbing-reference-white',
    predecessorEntryIds: [], webbingSpecifications: [specification, { ...structuredClone(specification), id: 'M-70', garmentSize: 'M', cutLengthMm: 700, finishedLengthMm: 700 }],
  }]
  return { productionOrderId: id, productionOrderNo: id, status: 'EXECUTING', techPackSnapshot: pack, demandSnapshot: {
    ...structuredClone(template.demandSnapshot), skuLines: [{ skuCode: `${id}-S`, size: 'S', color: '白', qty: 40 }, { skuCode: `${id}-M`, size: 'M', color: '白', qty: 60 }],
  } }
}


 const factory={id:'TEST-SUP',name:'测试主管',role:'织带厂主管'},warehouse={id:'TEST-WH',name:'测试仓管',role:'仓管'},planner={id:'TEST-PLAN',name:'测试计划',role:'生产计划'}
 const demo=await load('/src/data/fcs/tmf-base-demo.ts');demo.loadTmfBaseDemoPurchases()
 const no='TMF-DEMO-PO-003',base=m.getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===no)
 m.reportTmfBaseProduction(base.id,60,factory,'merge-produce')
 m.dispatchTmfBaseProduction({baseOrderId:base.id,handoverId:'MERGE-HANDOVER',batchId:'MERGE-LOT',dispatchedMeters:120},factory,'merge-dispatch')
 m.receiveTmfBaseProduction({handoverId:'MERGE-HANDOVER',materialSkuId:'tmf-webbing-reference-white',warehouseId:'TMF-DEMO-ACCESSORY-WH',location:'A-01',receivedMeters:120},warehouse,'merge-base-receive')
 for(let i=0;i<2;i++){
  const source=productionSource('MERGE-PROD'+i)
  source.demandSnapshot.skuLines=[{skuCode:source.productionOrderId+'-S',size:'S',color:'白',qty:100}]
  source.techPackSnapshot.processEntries[0].webbingSpecifications=source.techPackSnapshot.processEntries[0].webbingSpecifications.slice(0,1)
  m.registerTmfProductionOrder(source,planner,'merge-demand'+i)
  const demand=m.getTmfPurchaseState().demands.find(d=>d.productionOrderId===source.productionOrderId)
  m.reserveTmfContinuousMaterial({reservationId:'MERGE-RES'+i,demandId:demand.id,lotId:'MERGE-LOT',reservedMeters:i?50:52,reason:'合并批损耗预留'},planner,'merge-reserve'+i)
 }
})
await page.reload();await page.locator('[data-tmf-preparation]').waitFor()
const action=n=>page.locator('[data-tmf-preparation-action="'+n+'"]')
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('higood-tmf-material-purchases-v1')))
await action('merge').first().click()
const dialog=page.locator('[data-tmf-preparation-dialog]')
await dialog.locator('[name="mergedBatch"]').fill('MERGE-UI-BATCH')
await dialog.locator('[data-tmf-preparation-action="image"]').click()
await page.locator('[data-tmf-preparation-image] img').waitFor()
assert.equal(await page.locator('[data-tmf-preparation-image] img').evaluate(i=>i.complete&&i.naturalWidth>0),true)
await page.keyboard.press('Escape')
assert.equal(await dialog.locator('[name="mergedBatch"]').inputValue(),'MERGE-UI-BATCH')
evidence.checks.push('合并表单对应半成品图片可打开大图，Esc关闭保留输入')
await dialog.locator('[name="reason"]').fill('同规格两生产单合并实际交接')
await dialog.locator('[name="sku"]').fill('tmf-webbing-reference-white')
await dialog.locator('[name="confirmed"]').check()
const lines=dialog.locator('[data-merge-line]');assert.equal(await lines.count(),2)
for(let i=0;i<2;i++){await lines.nth(i).locator('[name="mergeSelected"]').check();await lines.nth(i).locator('[name="mergeLot"]').fill('MERGE-LOT');await lines.nth(i).locator('[name="mergeMeters"]').fill(i?'51':'52')}
const before=await read()
await action('confirm').click();assert.match(await dialog.locator('[data-tmf-preparation-error]').innerText(),/超过/)
assert.deepEqual(await read(),before);evidence.checks.push('第二行超占用时整批未扣库、无发料')
await lines.nth(1).locator('[name="mergeMeters"]').fill('50')
await lines.nth(1).locator('[name="mergeLot"]').fill('WRONG')
await action('confirm').click();assert.match(await dialog.locator('[data-tmf-preparation-error]').innerText(),/批次不符/);assert.deepEqual(await read(),before)
await lines.nth(1).locator('[name="mergeLot"]').fill('MERGE-LOT')
await action('confirm').click()
const after=await read(),issues=after.processingIssues.filter(i=>i.mergedBatchId==='MERGE-UI-BATCH')
assert.equal(issues.length,2);assert.equal(issues.reduce((n,i)=>n+i.dispatchedMeters,0),102)
assert.equal(issues.reduce((n,i)=>n+i.receivedMeters,0),0)
assert.equal(after.lots.find(l=>l.id==='MERGE-LOT').onHandMeters,18)
assert.equal(new Set(issues.map(i=>i.demandId)).size,2)
assert.match(await dialog.innerText(),/MERGE-UI-BATCH/)
await page.reload();await page.locator('[data-tmf-preparation]').waitFor();assert.deepEqual(await read(),after)
for(const size of [{width:1280,height:720},{width:1024,height:768}]){await page.setViewportSize(size);await action('merge').first().click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.keyboard.press('Escape')}
evidence.checks.push('恢复后一次102米扣库，保留两需求归属、未自动实收；刷新保留；低分辨率无主体溢出')
assert.deepEqual(evidence.errors,[]);evidence.result='PASS'
}finally{await browser.close();writeFileSync('output/playwright/tmf-webbing/merged-issue-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2))}
