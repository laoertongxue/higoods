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

await page.setViewportSize({width:1366,height:768})
const demands=after.demands.filter(d=>d.productionOrderId.startsWith('MERGE-PROD'))
const route=d=>'/fcs/craft/accessory/webbing/work-orders/'+encodeURIComponent(JSON.stringify([d.productionOrderId,d.techPackSnapshotId,d.routeEntryId]))
await page.goto('http://127.0.0.1:43188'+route(demands[0]))
const detail=page.locator('[data-tmf-work-detail]');await detail.waitFor()
const act=n=>detail.locator('[data-tmf-work-detail-action="'+n+'"]')
await act('tab').filter({hasText:'合并加工批'}).click()
assert.match(await detail.locator('[data-tmf-detail-content]').innerText(),/MERGE-PROD1/)
await act('merged-receive').click()
const form=detail.locator('[data-tmf-detail-dialog]')
await form.locator('[name="batchScan"]').fill('MERGE-UI-BATCH')
await form.locator('[name="sku"]').fill('tmf-webbing-reference-white')
await form.locator('[name="confirmed"]').check()
const inputs=form.locator('[data-merged-input]');assert.equal(await inputs.count(),2)
for(let i=0;i<2;i++){await inputs.nth(i).locator('[name="selectedLine"]').check();await inputs.nth(i).locator('[name="lineQuantity"]').fill(i?'51':'52')}
await act('confirm').click();assert.match(await form.locator('[data-tmf-detail-error]').innerText(),/超过/);assert.deepEqual(await read(),after)
await inputs.nth(1).locator('[name="lineQuantity"]').fill('50');await act('confirm').click()
const received=await read();assert.equal(received.processingIssues.reduce((n,i)=>n+i.receivedMeters,0),102)
await act('merged-cut').click()
await form.locator('[name="batchScan"]').fill('MERGE-UI-BATCH')
await form.locator('[name="confirmed"]').check()
await form.locator('[name="length"]').fill('500');await form.locator('[name="finished"]').fill('500');await form.locator('[name="reason"]').fill('同规格两生产单各100条；首行损耗1米')
for(let i=0;i<2;i++){await inputs.nth(i).locator('[name="selectedLine"]').check();await inputs.nth(i).locator('[name="lineQuantity"]').fill(i?'101':'100');await inputs.nth(i).locator('[name="lineLoss"]').fill(i?'0':'1')}
await act('confirm').click();assert.match(await form.locator('[data-tmf-detail-error]').innerText(),/超过本批实际接收量/);assert.deepEqual(await read(),received)
await inputs.nth(1).locator('[name="lineQuantity"]').fill('100');await act('confirm').click()
const cut=await read();assert.equal(cut.cutOutputs.reduce((n,o)=>n+o.goodPieces,0),200);assert.equal(new Set(cut.cutOutputs.map(o=>o.demandId)).size,2)
assert.equal(cut.lots.find(l=>l.id==='MERGE-LOT').onHandMeters,18)
await act('tab').filter({hasText:'操作记录'}).click();assert.match(await detail.locator('[data-tmf-detail-content]').innerText(),/整批，含其他生产单/)
await page.goto('http://127.0.0.1:43188'+route(demands[1]));await detail.waitFor();await act('tab').filter({hasText:'加工产出'}).click()
assert.match(await detail.locator('[data-tmf-detail-content]').innerText(),/合格 100/)
assert.doesNotMatch(await detail.locator('[data-tmf-detail-content]').innerText(),/合格 200/)
await page.reload();await detail.waitFor();assert.deepEqual(await read(),cut)
evidence.checks.push('工厂整批实收/截断第二行超量时整批回滚，修正后实收102米、两生产单各产100条；跨单页面及刷新归属不漂移，整批履历明确标识')

const terminal=await page.evaluate(async()=>{
 const path='/src/data/pms/tmf-material-purchases.ts',m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path)
 const factory={id:'TEST-SUP',name:'测试主管',role:'织带厂主管'},warehouse={id:'TEST-WH',name:'测试仓管',role:'仓管'},planner={id:'TEST-PLAN',name:'测试计划',role:'生产计划'},receiver={id:'TEST-REC',name:'测试生产领料',role:'生产领料人'}
 const data=m.getTmfPurchaseState(),issues=data.processingIssues.filter(i=>i.mergedBatchId==='MERGE-UI-BATCH'),first=issues.find(i=>i.dispatchedMeters===52),wh='TMF-DEMO-ACCESSORY-WH'
 m.dispatchTmfContinuousReturn({returnId:'MERGE-RETURN',issueId:first.id,batchId:'MERGE-RETURN-LOT',returnedMeters:1,reason:'合并批未截断余料'},factory,'merge-return')
 m.receiveTmfContinuousReturn({returnId:'MERGE-RETURN',warehouseId:wh,materialSkuId:first.materialSkuId,location:'RETURN',receivedMeters:1},warehouse,'merge-return-receive')
 const result=[]
 for(const [index,issue] of issues.entries()){
  const out=data.cutOutputs.find(o=>o.sourceIssueId===issue.id),pkg='MERGE-PKG'+index,hand=pkg+'-HAND',allocation=pkg+'-ALLOC',final=pkg+'-FINAL'
  m.packTmfOutput({packageId:pkg,cutOutputId:out.id,pieces:100},factory,pkg+'pack')
  m.dispatchTmfOutputPackage({handoverId:hand,packageId:pkg,warehouseId:wh},factory,pkg+'dispatch')
  m.receiveTmfOutputPackage({handoverId:hand,packageId:pkg,warehouseId:wh,demandId:issue.demandId,location:'FINISHED',receivedPieces:100},warehouse,pkg+'receive')
  m.allocateTmfOutputPackage({allocationId:allocation,packageId:pkg,demandId:issue.demandId,pieces:100,receiverId:receiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,pkg+'allocate')
  m.issueTmfProductionPackage({issueId:final,allocationId:allocation,packageId:pkg,demandId:issue.demandId,warehouseId:wh,pieces:100},warehouse,pkg+'issue')
  m.receiveTmfProductionPackage({issueId:final,packageId:pkg,demandId:issue.demandId,receiverOrganizationId:'PRODUCTION-01',pieces:100},receiver,pkg+'finalreceive')
  result.push({productionReceived:m.getTmfProductionDemandFulfillment(issue.demandId).receivedPieces,onHand:m.getTmfOutputPackageBalance(pkg).onHandPieces})
 }
 const end=m.getTmfPurchaseState()
 return {result,continuous:end.lots.filter(l=>l.sourcePurchaseOrderNo==='TMF-DEMO-PO-003').reduce((n,l)=>n+l.onHandMeters,0),loss:end.cutOutputs.reduce((n,o)=>n+o.lossMeters,0)}
})
assert.deepEqual(terminal,{result:[{productionReceived:100,onHand:0},{productionReceived:100,onHand:0}],continuous:19,loss:1})
evidence.terminal=terminal
evidence.checks.push('沿页面生成的真实记录调用既有余料退仓、装包/交接/分配/生产实收动作到终点：连续19米、两单各实收100、定长库存0；该后段不声称逐页验收')
assert.deepEqual(evidence.errors,[]);evidence.result='PASS'
}finally{await browser.close();writeFileSync('output/playwright/tmf-webbing/merged-factory-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2))}
