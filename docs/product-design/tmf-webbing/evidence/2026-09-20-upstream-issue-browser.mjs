import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(10000)
 page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/work-orders')
 const key=await page.evaluate(async()=>{
 const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts')
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

 await page.evaluate(async()=>{
 const loaded=(name)=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===`/src/data/fcs/${name}.ts`)?.name??`/src/data/fcs/${name}.ts`
 const dye=await import(loaded('dyeing-task-domain'))
 dye.assignDyeWorkOrderFactory('UPSTREAM-DYE',{factoryId:'F090',factoryName:'测试专用工厂',assignedAt:'2026-09-20 10:00',assignedBy:'测试计划'})
 const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts'),pms=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/material-purchase-orders.ts')?.name??'/src/data/pms/material-purchase-orders.ts'),runtime=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/runtime.ts')?.name??'/src/data/pms/runtime.ts')
 const buyer={id:runtime.PMS_BUYER_ACTOR.id,name:runtime.PMS_BUYER_ACTOR.name,role:'采购员'},factory={id:'TMF-SUP',name:'织带厂主管',role:'织带厂主管'},wh={id:'WH',name:'辅料仓主管',role:'仓库主管'}
 const purchase={purchaseOrderNo:'BRIDGE-PO',purchaseLineId:'BRIDGE-LINE',version:1,supplierId:'TMF-SUP',supplierName:'织带供货方',factoryOrgId:'FAC-TMF',materialSkuId:'tmf-webbing-reference-white',materialSpuId:'WB-REF',accessoryType:'织带',targetWarehouseId:'BRIDGE-WH',productionStandard:'白色织带测试标准；规格以确认样为准',requirementNo:'',sourceRequirementLineNo:'',sourceProductPurchaseOrderNo:'',materialCode:'tmf-webbing-reference-white',materialName:'白色织带',materialType:'辅料',materialImageUrl:'/materials/tmf/webbing-reference-white.jpg',unit:'米',styleCode:'',styleName:'',styleImageUrl:'',warehouse:'辅料仓',orderedQty:1000,receivedQty:0,unitPrice:1,currency:'RMB',status:'待采购',orderDate:'2026-09-20',expectedArrivalDate:'2026-09-25',buyerName:buyer.name,supplierConfirmed:false,supplierConfirmedAt:'',remark:'整链测试专用'}
 m.createTmfMaterialPurchase(purchase,buyer,'bridge-create');pms.advancePmsMaterialPurchaseOrderStatus('BRIDGE-PO','已采购',runtime.PMS_BUYER_ACTOR)
 m.generateTmfBaseOrder('BRIDGE-PO',factory,'bridge-base');const base=m.getTmfPurchaseState().baseOrders.find(o=>o.purchaseOrderNo==='BRIDGE-PO')
 m.acceptTmfBaseOrder(base.id,factory,'bridge-accept');m.startTmfBaseOrder(base.id,factory,'bridge-start');m.reportTmfBaseProduction(base.id,1000,factory,'bridge-produce')
 m.dispatchTmfBaseProduction({baseOrderId:base.id,handoverId:'BRIDGE-HAND',batchId:'BRIDGE-LOT',dispatchedMeters:1000},factory,'bridge-dispatch')
 m.receiveTmfBaseProduction({handoverId:'BRIDGE-HAND',materialSkuId:purchase.materialSkuId,warehouseId:purchase.targetWarehouseId,location:'A-01',receivedMeters:1000},wh,'bridge-receipt')
 const demand=m.getTmfPurchaseState().demands.find(d=>d.productionOrderId==='UPSTREAM-BROWSER-PROD')
 m.reserveTmfContinuousMaterial({reservationId:'BRIDGE-RES',demandId:demand.id,lotId:'BRIDGE-LOT',reservedMeters:650,reason:'测试印染下料'},wh,'bridge-reserve')
 })
 await page.goto('http://127.0.0.1:43188/wls/accessory-material-preparation')
 await page.locator('[data-tmf-preparation-action="prepare"]').first().click()
 await page.locator('[data-tmf-preparation-action="issue"][data-id="BRIDGE-RES"]').click()
 const dialog=page.locator('[data-tmf-preparation-dialog]'),fill=async(name,value)=>dialog.locator(`[name="${name}"]`).fill(String(value))
 await fill('quantity',650);await fill('issue','BRIDGE-ISSUE');await fill('batch','BRIDGE-LOT');await fill('sku','tmf-webbing-reference-white');await fill('targetFactory','FAC-TMF');await dialog.locator('[name="confirmed"]').check()
 await dialog.locator('[data-tmf-preparation-action="confirm"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-preparation-error]')?.textContent.includes('工厂'))
 await fill('targetFactory','F090')
 await page.waitForFunction(()=>document.querySelector('[data-tmf-expected-factory]')?.textContent.includes('UPSTREAM-DYE'))
 await page.evaluate(()=>{window.tmfOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='higood-tmf-material-purchases-v1')throw new Error('模拟存储失败');return window.tmfOriginalSet.call(this,k,v)}})
 await dialog.locator('[data-tmf-preparation-action="confirm"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-preparation-error]')?.textContent.includes('本次未保存'))
 const failed=await page.evaluate(async()=>{Storage.prototype.setItem=window.tmfOriginalSet;const path='/src/data/pms/tmf-material-purchases.ts',m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);return m.getTmfPurchaseState()})
 assert.equal(failed.lots.find(l=>l.id==='BRIDGE-LOT').onHandMeters,1000);assert.equal(failed.processingIssues.length,0)
 await dialog.locator('[data-tmf-preparation-action="confirm"]').click()
 await page.waitForFunction(()=>!document.querySelector('[data-tmf-preparation-dialog] [name="quantity"]'))
 const afterIssue=await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts');return m.getTmfPurchaseState()})
 assert.equal(afterIssue.lots.find(l=>l.id==='BRIDGE-LOT').onHandMeters,350)
 assert.equal(afterIssue.processingIssues.find(i=>i.id==='BRIDGE-ISSUE').receivedMeters,0)
 assert.equal(afterIssue.processingIssues.find(i=>i.id==='BRIDGE-ISSUE').upstream.orderId,'UPSTREAM-DYE')
 for(const qty of [648,2]){
 await page.goto('http://127.0.0.1:43188/fcs/craft/dyeing/pending-receipts?factory=F090&code=TMF-ISSUE%3ABRIDGE-ISSUE')
 await page.locator('[data-rinclude]').check();await page.locator('[data-rfield="businessQty"]').fill(String(qty))
 await page.locator('[data-factory-receiving-action="review"]').click();await page.locator('[data-factory-receiving-action="save"]').click()
 await page.getByText('接收已保存。正数明细已入本厂待加工仓，零接收已记录。',{exact:true}).waitFor()
 }
 await page.goto('http://127.0.0.1:43188/wls/accessory-material-preparation')
 await page.waitForFunction(()=>document.body.innerText.includes('工厂实际已收 650 米'))
 const facts=await page.evaluate(async()=>{
 const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts'),r=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/factory-receiving-warehouse.ts')?.name??'/src/data/fcs/factory-receiving-warehouse.ts'),view=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/tmf-work-order-view.ts')?.name??'/src/data/fcs/tmf-work-order-view.ts')
 const data=m.getTmfPurchaseState();return {lot:data.lots.find(l=>l.id==='BRIDGE-LOT'),issue:data.processingIssues.find(i=>i.id==='BRIDGE-ISSUE'),receipts:r.getDyeFactoryReceiptProjection('UPSTREAM-DYE','米'),tmfInputs:view.projectTmfWorkOrders(data).flatMap(o=>o.inputs)}
 })
 assert.equal(facts.lot.onHandMeters,350);assert.equal(facts.issue.receivedMeters,0);assert.equal(facts.receipts.reduce((n,r)=>n+r.qty,0),650);assert.equal(facts.tmfInputs.length,0)
 evidence.facts=facts;evidence.checks.push('实际采购1000→基础生产1000→辅料仓实收1000→占用650→仓库页面核对正式染色工厂发650→源仓350→染厂页面实收648+2；仓库读取同一650实收事实，TMF截断投入仍为0')
 await page.screenshot({path:'output/playwright/tmf-webbing/upstream-issue.png'})
 assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/upstream-issue-evidence.json',JSON.stringify(evidence,null,2));await browser.close()}
