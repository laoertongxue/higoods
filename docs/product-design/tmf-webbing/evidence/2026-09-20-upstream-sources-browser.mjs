import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(10000)
 page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders')
 const key=await page.evaluate(async()=>{
 const m=await import('/src/data/pms/tmf-material-purchases.ts')
 const {productionOrders,getProductionOrderTechPackSnapshot,persistCreatedProductionOrders}=await import('/src/data/fcs/production-orders.ts')
function productionSource(id) {
  const template = productionOrders.find((order) => order.techPackSnapshot)
  const pack = getProductionOrderTechPackSnapshot(template.productionOrderId)
  pack.productionOrderId = id
  pack.snapshotId = `${id}-SNAPSHOT-V1`
  pack.sourceTechPackVersionId = `${id}-TECH-V1`
  pack.bomItems = [{ ...pack.bomItems[0], id: 'BOM-WB', type: '辅料', materialSkuId: 'tmf-webbing-reference-white', materialCode:'tmf-webbing-reference-white', unit:'米', unitConsumption:6.5, lossRate:0, applicableSkuCodes: [] }]
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

 const source=productionSource('UPSTREAM-BROWSER-PROD'),cut=source.techPackSnapshot.processEntries[0]
 cut.inputMaterialSkuId=cut.outputMaterialSkuId='PATTERN';cut.predecessorEntryIds=['PRINT']
 const dye={...structuredClone(cut),id:'DYE',processCode:'DYE',processName:'染色',inputMaterialSkuId:'tmf-webbing-reference-white',outputMaterialSkuId:'BLUE',inputInventoryForm:'CONTINUOUS',outputInventoryForm:'CONTINUOUS',predecessorEntryIds:[],webbingSpecifications:undefined}
 const print={...structuredClone(dye),id:'PRINT',processCode:'PRINT',processName:'印花',inputMaterialSkuId:'BLUE',outputMaterialSkuId:'PATTERN',predecessorEntryIds:['DYE']}
 for(const entry of [dye,print]){entry.outputMaterialSkuMode='CHANGED';entry.inputMaterialSkuCode=entry.inputMaterialSkuId;entry.outputMaterialSkuCode=entry.outputMaterialSkuId}
 source.techPackSnapshot.processEntries=[cut,print,dye]
 const full={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)),...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId,processWorkOrderDefinitions:[],auditLogs:[]}
 productionOrders.push(full);persistCreatedProductionOrders([full.productionOrderId])
 m.registerTmfProductionOrder(full,{id:'TEST',name:'测试计划',role:'生产计划'},'upstream-demand')
 return JSON.stringify([full.productionOrderId,full.techPackSnapshot.snapshotId,'CUT'])
 })
 await page.goto(`http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(key)}`)
 const root=page.locator('[data-tmf-work-detail]')
 await root.waitFor()
 assert.match(await root.innerText(),/路线 染色 → 印花 → 织带截断/)
 await root.locator('[data-tmf-work-detail-action="tab"][data-id="upstream"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-upstream-content]')?.textContent.includes('缺少对应加工单'))
 assert.equal(await root.locator('[data-tmf-upstream-content] article').count(),2)
 evidence.checks.push('采用快照生成两规格需求，按染色→印花→截断显示；未生成印染单时逐节点提示缺来源，无伪造上游数量')
 await page.evaluate(async()=>{
 const loaded=(name)=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===`/src/data/fcs/${name}.ts`)?.name??`/src/data/fcs/${name}.ts`
 const dye=await import(loaded('dyeing-task-domain')), print=await import(loaded('printing-task-domain'))
 const {productionOrders,persistCreatedProductionOrders}=await import(loaded('production-orders'))
 const order=productionOrders.find(o=>o.productionOrderId==='UPSTREAM-BROWSER-PROD')
 for(const code of ['DYE','PRINT']){
 const entry=order.techPackSnapshot.processEntries.find(e=>e.id===code)
 const input={workOrderId:`UPSTREAM-${code}`,workOrderNo:`UPSTREAM-${code}`,sourceKey:`UPSTREAM:${code}`,processName:entry.processName,sourceSnapshot:{sourceType:'PRODUCTION_ORDER',productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,techPackVersionId:order.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:code,routeObjectKey:'BOM:BOM-WB',bomItemId:'BOM-WB'},productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,techPackVersionId:order.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:code,routeObjectKey:'BOM:BOM-WB',orderedAt:'2026-09-20T08:00:00+08:00',materialId:entry.inputMaterialSkuId,materialName:'织带测试来源',materialItems:[{sourceBomItemId:'BOM-WB',materialId:entry.inputMaterialSkuId,materialName:'织带测试来源',materialType:'辅料'}],inputMaterialSkuId:entry.inputMaterialSkuId,inputMaterialSkuCode:entry.inputMaterialSkuId,outputMaterialSkuId:entry.outputMaterialSkuId,outputMaterialSkuCode:entry.outputMaterialSkuId,targetColor:'测试蓝',plannedQty:650,qtyUnit:'米',processCodes:[code],spuCode:'TEST-SPU',spuName:'测试款式',requiredDeliveryDate:'2026-09-25'}
 if(code==='DYE')dye.runDyeProcessMutation(()=>dye.registerFormalProductionOrderDyeWorkOrder(input))
 else print.runPrintProcessMutation(()=>print.registerFormalProductionOrderPrintWorkOrder(input))
 }
 persistCreatedProductionOrders([order.productionOrderId])
 })
 await root.locator('[data-tmf-work-detail-action="tab"][data-id="requirements"]').click()
 await root.locator('[data-tmf-work-detail-action="tab"][data-id="upstream"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-upstream-content]')?.textContent.includes('UPSTREAM-DYE'))
 assert.match(await root.locator('[data-tmf-upstream-content]').innerText(),/尚未分配加工厂/)
 assert.equal(await root.locator('[data-tmf-upstream-content] [data-nav]').count(),2)
 assert.match(await root.locator('[data-tmf-upstream-content]').innerText(),/计划 650 米/)
 await page.reload();await root.waitFor()
 await root.locator('[data-tmf-work-detail-action="tab"][data-id="upstream"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-upstream-content]')?.textContent.includes('UPSTREAM-PRINT'))
 await page.setViewportSize({width:1024,height:768})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/upstream-sources.png'})
 await root.locator('[data-nav="/fcs/craft/dyeing/work-orders/UPSTREAM-DYE"]').click()
 await page.waitForURL('**/dyeing/work-orders/UPSTREAM-DYE')
 await page.waitForFunction(()=>document.body.innerText.includes('UPSTREAM-DYE'))
 evidence.checks.push('调用现有染色/印花注册动作建立源单；详情读取真实源单计划量及未分厂阻断，刷新保留，1024px无主体溢出，链接进入现有染色加工单')
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/upstream-sources-evidence.json',JSON.stringify(evidence,null,2));await browser.close()}
