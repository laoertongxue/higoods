import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFileSync, readFileSync } from 'node:fs'
const browser=await chromium.launch({headless:true})
const evidence={route:'/fcs/craft/accessory/webbing/purchase-demands',checks:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}})
 page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto(`http://127.0.0.1:43188${evidence.route}`)
 const root=page.locator('[data-tmf-base-page="purchase-demands"]')
 await root.waitFor()
 await root.locator('[data-tmf-purchase-demands-action="demo"]').click()
 await page.waitForFunction(()=>document.querySelector('[data-tmf-stats]')?.textContent.includes('36 单'))
 assert.match(await root.locator('[data-tmf-pagination]').innerText(),/36/)
 evidence.checks.push('载入36条采购，统计与分页总数一致')
 const downloadPromise=page.waitForEvent('download')
 await root.locator('[data-tmf-purchase-demands-action="export"]').click()
 const download=await downloadPromise
 const csv=readFileSync(await download.path(),'utf8')
 assert.equal(csv.trim().split('\n').length,37)
 assert.ok(!csv.split('\n')[0].includes('操作'))
 await root.locator('[data-tmf-purchase-demands-action="next-page"]').click()
 assert.ok(!(await root.locator('[data-tmf-table]').innerText()).includes('TMF-DEMO-PO-001'))
 await root.locator('[data-tmf-purchase-demands-action="reset"]').click()
 assert.ok((await root.locator('[data-tmf-table]').innerText()).includes('TMF-DEMO-PO-001'))
 evidence.checks.push('导出全部36条且不含操作列；分页及重置恢复首屏')

 await root.locator('[name="keyword"]').fill('TMF-DEMO-PO-001')
 await root.locator('[data-tmf-purchase-demands-action="query"]').click()
 assert.match(await root.locator('[data-tmf-stats]').innerText(),/1 单/)
 for(const action of ['generate','accept','start']){
  await root.locator(`[data-tmf-purchase-demands-action="${action}"]`).click()
  await root.locator('[data-tmf-purchase-demands-action="confirm"]').click()
 }
 await root.locator('[data-tmf-purchase-demands-action="report"]').click()
 await root.locator('[data-tmf-dialog] [name="quantity"]').fill('101')
 await root.locator('[data-tmf-dialog] [data-tmf-purchase-demands-action="image"]').click()
 await root.locator('[data-tmf-preview] img').waitFor()
 await page.keyboard.press('Escape')
 assert.equal(await root.locator('[data-tmf-dialog] [name="quantity"]').inputValue(),'101')
 assert.equal(await root.locator('[data-tmf-preview] img').count(),0)
 evidence.checks.push('填报期间预览实物图并Esc关闭，保留数量和原操作')
 await root.locator('[data-tmf-purchase-demands-action="confirm"]').click()
 assert.match(await root.locator('[data-tmf-dialog-error]').innerText(),/超过/)
 await root.locator('[data-tmf-dialog] [name="quantity"]').fill('100')
 await root.locator('[data-tmf-purchase-demands-action="confirm"]').click()
 await root.locator('[data-tmf-purchase-demands-action="dispatch"]').click()
 await root.locator('[name="quantity"]').fill('100')
 await root.locator('[name="batch"]').fill('BROWSER-TMF-BASE-001')
 await root.locator('[data-tmf-purchase-demands-action="confirm"]').click()
 assert.match(await root.locator('[data-tmf-table]').innerText(),/100 \/ 100 \/ 100 \/ 0 米/)
 evidence.checks.push('生成、接单、开始、超量阻断、实际产出100米、交出100米；仓库实收仍0')
 await page.goto('http://127.0.0.1:43188/fcs/craft/accessory/webbing/base-orders')
 const bases=page.locator('[data-tmf-base-page="base-orders"]');await bases.waitFor()
 await bases.locator('[name="keyword"]').fill('TMF-DEMO-PO-001')
 await bases.locator('[data-tmf-base-orders-action="query"]').click()
 assert.match(await bases.locator('[data-tmf-table]').innerText(),/交出待实收/)
 assert.match(await bases.locator('[data-tmf-table]').innerText(),/100 \/ 100 \/ 100 \/ 0 米/)
 await bases.locator('[data-tmf-base-orders-action="image"]').click()
 const image=bases.locator('[data-tmf-preview] img');await image.waitFor();assert.equal(await image.evaluate(i=>i.complete&&i.naturalWidth>0),true)
 await bases.locator('[data-tmf-preview] button[data-tmf-base-orders-action="close-image"]').last().click()
 evidence.checks.push('跨页面保留同一交出数量；实物大图可打开关闭')
 for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){
  await page.setViewportSize(viewport)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await bases.locator('[data-tmf-base-orders-action="image"]').click()
  const box=await bases.locator('[data-tmf-preview] img').boundingBox()
  assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height)
  await page.keyboard.press('Escape')
 }
 evidence.checks.push('1280×720和1024×768主体无横向溢出，大图完整显示及Esc关闭')
 await page.setViewportSize({width:1366,height:768})
 await page.goto('http://127.0.0.1:43188/wls/accessory-receipts')
 await page.locator('[data-wls-receipt-category="tmf-base"]').click()
 const receipt=page.locator('[data-tmf-base-page="base-receipts"]')
 await receipt.locator('[name="keyword"]').fill('BROWSER-TMF-BASE-001')
 await receipt.locator('[data-tmf-base-receipts-action="query"]').click()
 assert.match(await receipt.locator('[data-tmf-table]').innerText(),/100 \/ 0 \/ 100 米/)
 const readState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('higood-tmf-material-purchases-v1')))
 for(const qty of [90,10]){
  await receipt.locator('[data-tmf-base-receipts-action="receive"]').click()
  await receipt.locator('[name="scanBatch"]').fill('WRONG-BATCH')
  await receipt.locator('[name="scanSku"]').fill('WRONG-SKU')
  await receipt.locator('[name="quantity"]').fill(String(qty))
  await receipt.locator('[name="location"]').fill('TMF-A-01')
  await receipt.locator('[data-tmf-base-receipts-action="confirm"]').click()
  assert.match(await receipt.locator('[data-tmf-dialog-error]').innerText(),/实物批次不符/)
  await receipt.locator('[name="scanBatch"]').fill('BROWSER-TMF-BASE-001')
  await receipt.locator('[data-tmf-base-receipts-action="confirm"]').click()
  assert.match(await receipt.locator('[data-tmf-dialog-error]').innerText(),/扫码物料/)
  await receipt.locator('[name="scanSku"]').fill('TMF-WB-REF-WHT')
  await receipt.locator('[name="quantity"]').fill('101')
  await receipt.locator('[data-tmf-base-receipts-action="confirm"]').click()
  assert.match(await receipt.locator('[data-tmf-dialog-error]').innerText(),/超过/)
  await receipt.locator('[name="quantity"]').fill(String(qty))
  await receipt.locator('[data-tmf-base-receipts-action="confirm"]').click()
  await receipt.locator('[data-tmf-dialog] input').waitFor({state:'detached'})
  const saved=await readState()
  const expected=qty===90?90:100
  assert.equal(saved.orders.find(o=>o.purchaseOrderNo==='TMF-DEMO-PO-001').receivedQty,expected)
  const lots=saved.lots.filter(l=>l.id==='BROWSER-TMF-BASE-001')
  assert.equal(lots.length,1);assert.equal(lots[0].onHandMeters,expected)
  assert.equal(lots[0].receivedMeters,expected)
 }
 assert.equal(await receipt.locator('[data-tmf-base-receipts-action="receive"]').count(),0)
 assert.match(await receipt.locator('[data-tmf-table]').innerText(),/100 \/ 100 \/ 0 米/)
 await page.reload()
 await page.locator('[data-wls-receipt-category="tmf-base"]').click()
 await receipt.locator('[name="keyword"]').fill('BROWSER-TMF-BASE-001')
 await receipt.locator('[data-tmf-base-receipts-action="query"]').click()
 assert.match(await receipt.locator('[data-tmf-table]').innerText(),/已收齐/)
 await page.setViewportSize({width:1024,height:768})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await receipt.locator('[data-tmf-base-receipts-action="detail"]').click()
 assert.match(await receipt.locator('[data-tmf-dialog]').innerText(),/该批次累计实收 100 米；仓内实存 100 米/)
 assert.match(await receipt.locator('[data-tmf-dialog]').innerText(),/基础半成品实收/)
 await page.keyboard.press('Escape')
 await page.screenshot({path:'output/playwright/tmf-webbing/base-receipts.png'})
 await page.locator('[data-wls-receipt-category="existing"]').click()
 await page.locator('[data-wls-lace-receipts-table-surface]').waitFor()
 evidence.checks.push('WLS原入口分类接入；错SKU和超交出量阻断；90+10米分批实收；PMS实收100且只有一个100米库存批次；刷新保留并可回花边分类')

 await page.evaluate(async()=>{
  const m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/pms/tmf-material-purchases.ts')?.name??'/src/data/pms/tmf-material-purchases.ts')
  const {productionOrders,getProductionOrderTechPackSnapshot}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/production-orders.ts')?.name??'/src/data/fcs/production-orders.ts')
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

  const factory={id:'OUTPUT-TEST-SUP',name:'织带主管（浏览器测试）',role:'织带厂主管'}
  const warehouse={id:'OUTPUT-TEST-WH',name:'仓管（浏览器测试）',role:'仓管'}
  const order=productionSource('OUTPUT-BROWSER-PROD')
  const full={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)),...order,selectedTechPackVersionId:order.techPackSnapshot.sourceTechPackVersionId,auditLogs:[]}
  productionOrders.push(full)
  const {persistCreatedProductionOrders}=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/production-orders.ts')?.name??'/src/data/fcs/production-orders.ts')
  persistCreatedProductionOrders([full.productionOrderId])
  m.registerTmfProductionOrder(full,factory,'OUTPUT-register')
  const demands=m.getTmfPurchaseState().demands.filter(d=>d.productionOrderId===order.productionOrderId)
  for(const [index,demand] of demands.entries()){
   const meters=demand.theoreticalCutMeters
   m.reserveTmfContinuousMaterial({reservationId:`OUTPUT-RES-${index}`,demandId:demand.id,lotId:'BROWSER-TMF-BASE-001',reservedMeters:meters,reason:'按技术包两长度分别准备'},warehouse,`OUTPUT-res-${index}`)
   m.issueTmfContinuousMaterial({issueId:`OUTPUT-ISS-${index}`,reservationId:`OUTPUT-RES-${index}`,targetFactoryId:'FAC-TMF',dispatchedMeters:meters},warehouse,`OUTPUT-issue-${index}`)
   m.receiveTmfProcessingMaterial({issueId:`OUTPUT-ISS-${index}`,factoryId:'FAC-TMF',materialSkuId:demand.materialSkuId,receivedMeters:meters},factory,`OUTPUT-receive-${index}`)
   m.reportTmfCutOutput({outputId:`OUTPUT-CUT-${index}`,issueId:`OUTPUT-ISS-${index}`,cutPieces:demand.requiredPieces,defectivePieces:0,actualCutLengthMm:demand.specification.cutLengthMm,actualFinishedLengthMm:demand.specification.finishedLengthMm,lossMeters:0,reason:'浏览器收货场景：无损耗假设'},factory,`OUTPUT-cut-${index}`)
   m.packTmfOutput({packageId:`OUTPUT-PKG-${index}`,cutOutputId:`OUTPUT-CUT-${index}`,pieces:demand.requiredPieces},factory,`OUTPUT-pack-${index}`)
   m.dispatchTmfOutputPackage({handoverId:`OUTPUT-HO-${index}`,packageId:`OUTPUT-PKG-${index}`,warehouseId:'TMF-DEMO-ACCESSORY-WH'},factory,`OUTPUT-dispatch-${index}`)
  }
 })
 await page.locator('[data-wls-receipt-category="tmf-output"]').click()
 const output=page.locator('[data-tmf-output-receipts]')
 assert.match(await output.locator('[data-tmf-output-table]').innerText(),/500mm/)
 assert.match(await output.locator('[data-tmf-output-table]').innerText(),/700mm/)
 for(const [index,quantities] of [[0,[30,10]],[1,[60]]]){
  for(const qty of quantities){
   await output.locator(`[data-tmf-output-receipts-action="receive"][data-id="OUTPUT-HO-${index}"]`).click()
   await output.locator('[name="package"]').fill(`OUTPUT-PKG-${index===0?1:0}`)
   await output.locator('[name="production"]').fill('WRONG-PRODUCTION')
   await output.locator('[name="pieces"]').fill(String(qty))
   await output.locator('[name="location"]').fill(`OUTPUT-A-${index}`)
   await output.locator('[data-tmf-output-receipts-action="confirm"]').click()
   assert.match(await output.locator('[data-tmf-output-error]').innerText(),/生产单不符/)
   await output.locator('[name="production"]').fill('OUTPUT-BROWSER-PROD')
   await output.locator('[data-tmf-output-receipts-action="confirm"]').click()
   assert.match(await output.locator('[data-tmf-output-error]').innerText(),/请核对实物/)
   await output.locator('[name="checked"]').check()
   await output.locator('[data-tmf-output-receipts-action="confirm"]').click()
   assert.match(await output.locator('[data-tmf-output-error]').innerText(),/包号/)
   await output.locator('[name="package"]').fill(`OUTPUT-PKG-${index}`)
   await output.locator('[name="pieces"]').fill('101')
   await output.locator('[data-tmf-output-receipts-action="confirm"]').click()
   assert.match(await output.locator('[data-tmf-output-error]').innerText(),/超过/)
   await output.locator('[name="pieces"]').fill(String(qty))
   await output.locator('[data-tmf-output-receipts-action="confirm"]').click()
   await output.locator('[data-tmf-output-dialog] input').waitFor({state:'detached'})
   const saved=await readState()
   assert.equal(saved.orders.find(o=>o.purchaseOrderNo==='TMF-DEMO-PO-001').receivedQty,100)
   assert.equal(saved.lots.find(l=>l.id==='BROWSER-TMF-BASE-001').onHandMeters,38)
   assert.equal(saved.packages.find(p=>p.id===`OUTPUT-PKG-${index}`).receivedPieces,index===0?(qty===30?30:40):60)
  }
 }
 assert.equal(await output.locator('[data-tmf-output-receipts-action="receive"]').count(),0)
 await page.reload()
 await page.locator('[data-wls-receipt-category="tmf-output"]').click()
 assert.equal(await output.locator('[data-tmf-output-receipts-action="receive"]').count(),0)
 assert.match(await output.locator('[data-tmf-output-table]').innerText(),/OUTPUT-PKG-0/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/output-receipts.png'})
 evidence.checks.push('实际动作从100米基础实收→40条500mm和60条700mm装包交出→产出分批实收；错生产单/错包/未核实/超收均阻断；米料38米、采购实收100米不随条料回仓增加；刷新后两包收齐')


 await page.goto('http://127.0.0.1:43188/wls/accessory-production-stock')
 const stock=page.locator('[data-tmf-output-stock]');await stock.waitFor()
 const openStock=async(action,index)=>stock.locator(`[data-tmf-output-stock-action="${action}"][data-id="OUTPUT-PKG-${index}"]`).click()
 const confirmStock=()=>stock.locator('[data-tmf-output-stock-action="confirm"]').click()
 for(const [index,qty] of [[0,40],[1,60]]){
  await openStock('allocate',index)
  await stock.locator('[name="pieces"]').fill(String(qty+1))
  await stock.locator('[name="receiver"]').fill(index===1?'OUTPUT-PROD-RECEIVER-2':'OUTPUT-PROD-RECEIVER')
  await stock.locator('[name="organization"]').fill('OUTPUT-PROD-ORG')
  await confirmStock()
  assert.match(await stock.locator('[data-tmf-stock-error]').innerText(),/超过/)
  await stock.locator('[name="pieces"]').fill(String(qty));await confirmStock()
 }
 await openStock('release',0)
 await stock.locator('[name="pieces"]').fill('10')
 await stock.locator('[name="reason"]').fill('调整本批安排后重新分配')
 await confirmStock()
 assert.match(await stock.locator('[data-tmf-stock-error]').innerText(),/请核对/)
 await stock.locator('[name="confirmed"]').check();await confirmStock()
 await openStock('allocate',0)
 await stock.locator('[name="pieces"]').fill('10')
 await stock.locator('[name="receiver"]').fill('OUTPUT-PROD-RECEIVER')
 await stock.locator('[name="organization"]').fill('OUTPUT-PROD-ORG')
 await confirmStock()
 const allocations=(await readState()).outputAllocations
 for(const a of allocations){
  const qty=a.allocatedPieces-a.releasedPieces
  if(!qty)continue
  const index=a.packageId.endsWith('-0')?0:1
  await openStock('issue',index)
  await stock.locator('[name="allocation"]').selectOption(a.id)
  await stock.locator('[name="pieces"]').fill(String(qty))
  await stock.locator('[name="package"]').fill(`OUTPUT-PKG-${index===0?1:0}`)
  await stock.locator('[name="production"]').fill('OUTPUT-BROWSER-PROD')
  await stock.locator('[name="confirmed"]').check()
  await confirmStock()
  assert.match(await stock.locator('[data-tmf-stock-error]').innerText(),/包号/)
  await stock.locator('[name="package"]').fill(a.packageId)
  await stock.locator('[name="pieces"]').fill(String(qty+1));await confirmStock()
  assert.match(await stock.locator('[data-tmf-stock-error]').innerText(),/超过/)
  await stock.locator('[name="pieces"]').fill(String(qty));await confirmStock()
 }
 const beforeReceipt=await readState()
 assert.equal(beforeReceipt.productionIssues.reduce((n,i)=>n+i.dispatchedPieces,0),100)
 assert.equal(beforeReceipt.productionIssues.reduce((n,i)=>n+i.receivedPieces,0),0)
 await openStock('detail',0)
 assert.match(await stock.locator('[data-tmf-stock-dialog]').innerText(),/实存 0，占用 0，可分配 0 条/)
 assert.match(await stock.locator('[data-tmf-stock-dialog]').innerText(),/需求缺口 40 条/)
 await page.keyboard.press('Escape')
 await page.reload();await stock.waitFor()
 assert.match(await stock.locator('[data-tmf-stock-table]').innerText(),/生产领料在途/)
 await page.goto('http://127.0.0.1:43188/wls/accessory-production-receipts')
 const receiving=page.locator('[data-tmf-production-receipts]');await receiving.waitFor()
 const issues=(await readState()).productionIssues
 for(const [position,issue] of issues.entries()){
  await receiving.locator('[name="receiverIdentity"]').selectOption(JSON.stringify([issue.receiverOrganizationId,issue.receiverId]))
  const wrong=issues.find(i=>i.receiverId!==issue.receiverId)
  assert.equal(await receiving.locator(`[data-tmf-production-receipts-action="open"][data-id="${wrong.id}"]`).count(),0)
  await receiving.locator(`[data-tmf-production-receipts-action="open"][data-id="${issue.id}"]`).click()
  if(position===0)await page.screenshot({path:'output/playwright/tmf-webbing/production-receipt-form.png'})
  const quantities=position===0?[issue.dispatchedPieces-10,10]:[issue.dispatchedPieces]
  for(const qty of quantities){
   await receiving.locator('[name="package"]').fill('WRONG-PACKAGE')
   await receiving.locator('[name="pieces"]').fill(String(qty))
   await receiving.locator('[data-tmf-production-receipts-action="confirm"]').click()
   assert.match(await receiving.locator('[data-tmf-prod-error]').innerText(),/请核对长度/)
   await receiving.locator('[name="checked"]').check()
   await receiving.locator('[data-tmf-production-receipts-action="confirm"]').click()
   assert.match(await receiving.locator('[data-tmf-prod-error]').innerText(),/包号/)
   await receiving.locator('[name="package"]').fill(issue.packageId)
   await receiving.locator('[name="pieces"]').fill('101')
   await receiving.locator('[data-tmf-production-receipts-action="confirm"]').click()
   assert.match(await receiving.locator('[data-tmf-prod-error]').innerText(),/超过/)
   await receiving.locator('[name="pieces"]').fill(String(qty))
   await receiving.locator('[data-tmf-production-receipts-action="confirm"]').click()
   const saved=await readState()
   const actual=saved.productionIssues.find(i=>i.id===issue.id)
   const expected=position===0&&qty!==10?issue.dispatchedPieces-10:issue.dispatchedPieces
   assert.equal(actual.receivedPieces,expected)
   assert.equal(saved.orders.find(o=>o.purchaseOrderNo==='TMF-DEMO-PO-001').receivedQty,100)
   assert.equal(saved.lots.find(l=>l.id==='BROWSER-TMF-BASE-001').onHandMeters,38)
   if(position===0&&qty!==10)assert.match(await receiving.locator('[data-tmf-prod-feedback]').innerText(),/10 条 待收/)
  }
 }
 assert.equal((await readState()).productionIssues.reduce((n,i)=>n+i.receivedPieces,0),100)
 await page.reload();await receiving.waitFor()
 await receiving.locator('[name="receiverIdentity"]').selectOption(JSON.stringify(['OUTPUT-PROD-ORG','OUTPUT-PROD-RECEIVER']))
 assert.match(await receiving.locator('[data-tmf-prod-content]').innerText(),/待收 0 张/)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/production-receipts.png'})
 await page.goto('http://127.0.0.1:43188/wls/accessory-production-stock')
 await page.reload();await stock.waitFor()
 await openStock('detail',0)
 assert.match(await stock.locator('[data-tmf-stock-dialog]').innerText(),/需求缺口 0 条，已满足/)
 assert.match(await stock.locator('[data-tmf-stock-dialog]').innerText(),/已发 40；在途 0；生产实收 40 条/)
 await page.keyboard.press('Escape')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/output-stock.png'})
 evidence.checks.push('库存页两规格分配40/60条、释放10再分配、分配与发料超量及错包阻断；实际发100后仓内0且生产实收0/需求未满足；领料确认页面由两名指定领料人分别实收，短收10条保留待收后补齐，错包/未核实/超收阻断，库存详情回读满足')

 assert.deepEqual(evidence.errors,[])
 console.log(JSON.stringify(evidence,null,2))
}catch(error){evidence.failure=String(error);console.log(JSON.stringify(evidence,null,2));throw error}
finally{writeFileSync('output/playwright/tmf-webbing/production-receipt-evidence.json',JSON.stringify(evidence,null,2));await browser.close()}
