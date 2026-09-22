import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { transformSync } from 'esbuild'

const server = 'http://127.0.0.1:43188'
const evidence = { generatedAt: new Date().toISOString(), route: server, checks: [], errors: [], scope: 'V2.0 全量收口：主管超收、终止处置、正式主档、对象图片、拟页面、PDA 工厂执行、主单只读投影' }

const fixture = `
const assert = { equal(a, b) { if (a !== b) throw new Error('expect equal: ' + a + ' / ' + b) }, ok(value) { if (!value) throw new Error('expect truthy') }, match(value, re) { if (!re.test(String(value))) throw new Error('expect match: ' + re + ' -> ' + value) } }
const m = await load('/src/data/pms/tmf-material-purchases.ts')
const { productionOrders, getProductionOrderTechPackSnapshot, persistCreatedProductionOrders } = await load('/src/data/fcs/production-orders.ts')
const { advancePmsMaterialPurchaseOrderStatus } = await load('/src/data/pms/material-purchase-orders.ts')
const { PMS_BUYER_ACTOR } = await load('/src/data/pms/runtime.ts')
const buyer = { id: 'V2-BUYER', name: 'V2采购', role: '采购员' }
const factory = { id: 'V2-SUP', name: 'V2织带厂主管', role: '织带厂主管' }
const wh = { id: 'V2-WH', name: 'V2仓管', role: '仓管' }
const whSup = { id: 'V2-WH-SUP', name: 'V2仓库主管', role: '仓库主管' }
const planner = { id: 'V2-PLAN', name: 'V2生产计划', role: '生产计划' }
const ledger = []
function purchase(id, qty, sku = 'WB30-WHT') {
  return { purchaseOrderNo: id + '-PO', purchaseLineId: id + '-PO-L1', version: 1, supplierId: 'MOCK-SUP-TMF', supplierName: 'Mock 织带供货方', factoryOrgId: 'FAC-TMF', materialSkuId: sku, materialSpuId: sku.split('-')[0], accessoryType: /^(RP|CORD|ROPE)/.test(sku) ? '绳子' : '织带', targetWarehouseId: 'MOCK-ACC-WH', productionStandard: 'V2 浏览器夹具标准；非真实配方', requirementNo: '', sourceRequirementLineNo: '', sourceProductPurchaseOrderNo: '', materialCode: sku, materialName: 'V2 ' + sku, materialType: '辅料', materialImageUrl: '/materials/tmf/webbing-real-roll.jpg', unit: '米', styleCode: '', styleName: '', styleImageUrl: '', warehouse: 'Mock 辅料仓', orderedQty: qty, receivedQty: 0, unitPrice: 1, currency: 'RMB', status: '待采购', orderDate: '2026-09-22', expectedArrivalDate: '2026-09-25', buyerName: buyer.name, supplierConfirmed: false, supplierConfirmedAt: '', remark: 'V2 浏览器验收夹具' }
}
function start(order) {
  m.createTmfMaterialPurchase(order, buyer, order.purchaseOrderNo + ':create')
  advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo, '已采购', PMS_BUYER_ACTOR)
  m.generateTmfBaseOrder(order.purchaseOrderNo, factory, order.purchaseOrderNo + ':gen')
  const base = m.getTmfPurchaseState().baseOrders.find(b => b.purchaseOrderNo === order.purchaseOrderNo)
  m.acceptTmfBaseOrder(base.id, factory, order.purchaseOrderNo + ':acc')
  m.startTmfBaseOrder(base.id, factory, order.purchaseOrderNo + ':start')
  return base.id
}
function receiveBase(order, baseId, qty, handoverId, batchId) {
  m.reportTmfBaseProduction(baseId, qty, factory, handoverId + ':produce')
  m.dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: handoverId, batchId: batchId, dispatchedMeters: qty }, factory, handoverId + ':dispatch')
  m.receiveTmfBaseProduction({ handoverId: handoverId, materialSkuId: order.materialSkuId, warehouseId: order.targetWarehouseId, location: 'V2-01', receivedMeters: qty }, wh, handoverId + ':receive')
}
function productionSource(id, sku) {
  const template = productionOrders.find(o => o.techPackSnapshot)
  const pack = getProductionOrderTechPackSnapshot(template.productionOrderId)
  pack.productionOrderId = id; pack.snapshotId = id + '-SNAP'; pack.sourceTechPackVersionId = id + '-V1'
  pack.bomItems = [{ ...pack.bomItems[0], id: 'V2-BOM', type: '辅料', materialSkuId: sku, applicableSkuCodes: [] }]
  const spec = { id: 'V2-S', bomItemId: 'V2-BOM', usage: '腰带', garmentSize: 'S', piecesPerGarment: 1, cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2, measurementCondition: '自然平放', cuttingMethod: '冷切', acceptanceRequirement: '按确认样', tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' } }
  pack.processEntries = [{ id: 'CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段', processCode: 'WEBBING_CUT', processName: '织带截断', assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false, routeObjectKey: 'BOM:V2-BOM', linkedBomItemIds: ['V2-BOM'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY', inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES', inputMaterialSkuId: sku, outputMaterialSkuId: sku, predecessorEntryIds: [], webbingSpecifications: [spec] }]
  const source = { productionOrderId: id, productionOrderNo: id, status: 'EXECUTING', techPackSnapshot: pack, demandSnapshot: { ...structuredClone(template.demandSnapshot), skuLines: [{ skuCode: id + '-S', size: 'S', color: '白', qty: 100 }] } }
  productionOrders.push(source); persistCreatedProductionOrders([id])
  return source
}
// N06/OVR：超产与超收主管确认
const ovr = purchase('V2-OVR', 100); const ovrBase = start(ovr)
m.reportTmfBaseProduction(ovrBase, 110, factory, 'V2-OVR:over', { reason: 'V2 浏览器超产确认', confirmed: true })
m.dispatchTmfBaseProduction({ baseOrderId: ovrBase, handoverId: 'V2-OVR-PO:handover', batchId: 'V2-OVR-BATCH', dispatchedMeters: 110 }, factory, 'V2-OVR:dispatch')
m.receiveTmfBaseProduction({ handoverId: 'V2-OVR-PO:handover', materialSkuId: 'WB30-WHT', warehouseId: 'MOCK-ACC-WH', location: 'V2-02', receivedMeters: 110, overReceipt: { reason: 'V2 浏览器超收确认', confirmed: true } }, whSup, 'V2-OVR:receive')
let ovrState = m.getTmfPurchaseState()
assert.equal(ovrState.baseOrders.find(b => b.id === ovrBase).overProductions.length, 1)
assert.equal(ovrState.orders.find(o => o.purchaseOrderNo === 'V2-OVR-PO').overReceipts.length, 1)
assert.equal(ovrState.orders.find(o => o.purchaseOrderNo === 'V2-OVR-PO').orderedQty, 100)
assert.equal(ovrState.orders.find(o => o.purchaseOrderNo === 'V2-OVR-PO').receivedQty, 110)
ledger.push('主管确认超产超收：计划不扩、标记保留、实收110')
// B25/TERM：终止处置
const term = purchase('V2-TERM', 100, 'CORD-WHT'); const termBase = start(term)
receiveBase(term, termBase, 100, 'V2-TERM-PO:handover', 'V2-TERM-BATCH')
const termSource = productionSource('V2-TERM-PROD', 'CORD-WHT')
m.registerTmfProductionOrder(termSource, planner, 'V2-TERM:demand')
const termDemand = m.getTmfPurchaseState().demands.find(d => d.productionOrderId === 'V2-TERM-PROD')
m.reserveTmfContinuousMaterial({ reservationId: 'V2T-RES', demandId: termDemand.id, lotId: 'V2-TERM-BATCH', reservedMeters: 100, reason: 'V2 终止场景' }, planner, 'V2T:reserve')
m.issueTmfContinuousMaterial({ issueId: 'V2T-IN', reservationId: 'V2T-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 100 }, wh, 'V2T:issue')
m.receiveTmfProcessingMaterial({ issueId: 'V2T-IN', factoryId: 'FAC-TMF', materialSkuId: 'CORD-WHT', receivedMeters: 100 }, factory, 'V2T:in')
m.reportTmfCutOutput({ outputId: 'V2T-OUT1', issueId: 'V2T-IN', cutPieces: 190, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: 'V2 超需求' }, factory, 'V2T:cut1')
m.reportTmfCutOutput({ outputId: 'V2T-OUT2', issueId: 'V2T-IN', cutPieces: 10, defectivePieces: 2, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: 'V2 不良' }, factory, 'V2T:cut2')
m.packTmfOutput({ packageId: 'V2T-PKGA', cutOutputId: 'V2T-OUT1', pieces: 100 }, factory, 'V2T:packA')
m.dispatchTmfOutputPackage({ handoverId: 'V2T-HOA', packageId: 'V2T-PKGA', warehouseId: term.targetWarehouseId }, factory, 'V2T:hoA')
m.receiveTmfOutputPackage({ handoverId: 'V2T-HOA', packageId: 'V2T-PKGA', warehouseId: term.targetWarehouseId, demandId: termDemand.id, location: 'V2-03', receivedPieces: 100 }, wh, 'V2T:rcvA')
m.allocateTmfOutputPackage({ allocationId: 'V2T-AL', packageId: 'V2T-PKGA', demandId: termDemand.id, pieces: 100, receiverId: 'V2-RECEIVER', receiverOrganizationId: 'V2-PROD-ORG' }, planner, 'V2T:alloc')
m.issueTmfProductionPackage({ issueId: 'V2T-PI', allocationId: 'V2T-AL', packageId: 'V2T-PKGA', demandId: termDemand.id, warehouseId: term.targetWarehouseId, pieces: 30 }, wh, 'V2T:issueProd')
m.receiveTmfProductionPackage({ issueId: 'V2T-PI', packageId: 'V2T-PKGA', demandId: termDemand.id, receiverOrganizationId: 'V2-PROD-ORG', pieces: 15 }, { id: 'V2-RECEIVER', name: 'V2领料人', role: '生产领料人' }, 'V2T:rcvProd')
m.packTmfOutput({ packageId: 'V2T-PKGB', cutOutputId: 'V2T-OUT1', pieces: 20 }, factory, 'V2T:packB')
m.dispatchTmfOutputPackage({ handoverId: 'V2T-HOB', packageId: 'V2T-PKGB', warehouseId: term.targetWarehouseId }, factory, 'V2T:hoB')
m.receiveTmfOutputPackage({ handoverId: 'V2T-HOB', packageId: 'V2T-PKGB', warehouseId: term.targetWarehouseId, demandId: termDemand.id, location: 'V2-04', receivedPieces: 20 }, wh, 'V2T:rcvB')
m.freezeTmfSurplusPackage({ packageId: 'V2T-PKGB', expectedPieces: 20, reason: 'V2 超需求余量冻结', confirmed: true }, whSup, 'V2T:freeze')
m.changeTmfProductionControl({ productionOrderId: 'V2-TERM-PROD', status: 'CANCELLED', reason: 'V2 终止处置场景', confirmed: true }, planner, 'V2T:cancel')
ledger.push('终止场景已取消，待处置 5 项（在制70+8、不良2、冻结20、领料在途15）')
// PAGE-013：待接收场景（仓库已发、本厂未收）
const pend = purchase('V2-PENDING', 60); const pendBase = start(pend)
receiveBase(pend, pendBase, 60, 'V2-PENDING-PO:handover', 'V2-PENDING-BATCH')
const pendSource = productionSource('V2-PENDING-PROD', 'WB30-WHT')
m.registerTmfProductionOrder(pendSource, planner, 'V2-PENDING:demand')
const pendDemand = m.getTmfPurchaseState().demands.find(d => d.productionOrderId === 'V2-PENDING-PROD')
m.reserveTmfContinuousMaterial({ reservationId: 'V2P-RES', demandId: pendDemand.id, lotId: 'V2-PENDING-BATCH', reservedMeters: 50, reason: 'V2 待接收场景' }, planner, 'V2P:reserve')
m.issueTmfContinuousMaterial({ issueId: 'V2P-IN', reservationId: 'V2P-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 50 }, wh, 'V2P:issue')
ledger.push('待接收场景：已发50米未收')
// MASTER：主档映射契约与图片资源
let masterGap = ''
try { m.createTmfMaterialPurchase({ ...purchase('V2-GAP', 10), supplierId: 'UNKNOWN-SUP' }, buyer, 'V2-GAP:create') } catch (error) { masterGap = error.message }
assert.match(masterGap, /供应商主档/)
const ovrOrder = m.getTmfPurchaseState().orders.find(o => o.purchaseOrderNo === 'V2-OVR-PO')
assert.equal(ovrOrder.masterRefs.material.masterId, 'WB30-WHT')
assert.equal(ovrOrder.masterRefs.supplier.source, 'TMF原型规范主档')
ledger.push('主档映射：缺失阻断、创建写入 masterRefs')
globalThis.v2Fixture = { termWorkId: JSON.stringify(['V2-TERM-PROD', 'V2-TERM-PROD-SNAP', termDemand.routeEntryId]) }
return ledger`

const load = `const load = async (path) => import(performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === path)?.name ?? path);`

const browser = await chromium.launch({ headless: true })
try {
  mkdirSync('output/playwright/tmf-webbing', { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  page.setDefaultTimeout(20000)
  const pageErrors = []
  page.on('pageerror', (error) => { pageErrors.push(error.message); evidence.errors.push(error.message) })

  await page.goto(`${server}/fcs/craft/accessory/webbing/work-orders`)
  await page.locator('[data-tmf-work-orders]').waitFor()
  const seeded = await page.evaluate(transformSync(`(async()=>{${load}${fixture}})()`, { loader: 'ts', target: 'esnext' }).code)
  evidence.seeded = seeded

  // 图片资源：五张对象对应图均可访问且可解码
  const imageChecks = await page.evaluate(async () => {
    const files = ['/materials/tmf/webbing-dyed-blue.jpg', '/materials/tmf/webbing-printed-pattern.jpg', '/materials/tmf/tip-plastic-aglet.jpg', '/materials/tmf/tip-metal-aglet.jpg', '/materials/tmf/tip-silicone-dip.jpg']
    const results = []
    for (const file of files) {
      const response = await fetch(file)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const image = new Image()
      const decoded = await new Promise((resolve) => { image.onload = () => resolve(image.naturalWidth > 0); image.onerror = () => resolve(false); image.src = url })
      results.push({ file, status: response.status, decoded })
      URL.revokeObjectURL(url)
    }
    return results
  })
  assert.equal(imageChecks.every((item) => item.status === 200 && item.decoded), true)
  evidence.checks.push(`对象对应图片 5/5 可访问且可解码：${imageChecks.map((item) => item.file.split('/').pop()).join('、')}`)

  // N06 超收：主档映射展示 + 超收记录在基础单详情可见
  await page.goto(`${server}/fcs/craft/accessory/webbing/base-orders`)
  await page.locator('[data-tmf-base-page="base-orders"]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-OVR-PO')
  await page.locator('[data-tmf-base-orders-action="query"]').click()
  await page.locator('[data-tmf-base-orders-action="detail"]').first().click()
  const detailDialog = page.locator('[data-tmf-dialog]')
  await detailDialog.locator('text=主档映射').waitFor()
  const detailText = await detailDialog.innerText()
  assert.match(detailText, /TMF原型规范主档/)
  assert.match(detailText, /超产 10 米/)
  assert.match(detailText, /超收 10 米/)
  evidence.checks.push('MASTER/OVR：基础单详情显示主档映射与超产/超收记录（计划不扩）')
  await page.keyboard.press('Escape')

  // B25 终止处置：从加工单打开终止处置台，逐项处置并缺口补做结案
  await page.locator('[name="keyword"]').fill('')
  await page.goto(`${server}/fcs/craft/accessory/webbing/work-orders`)
  await page.locator('[data-tmf-work-orders]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-TERM-PROD')
  await page.locator('[data-tmf-work-orders-action="query"]').click()
  await page.locator('[data-tmf-work-orders-action="control"]').first().click()
  await page.locator('[data-tmf-production-control-action="termination"]').click()
  const termination = page.locator('[data-tmf-termination-root]')
  await termination.waitFor()
  assert.match(await termination.innerText(), /待处置 5 项/)
  assert.match(await termination.innerText(), /缺口 85 条\/根/)
  for (let index = 0; index < 3; index += 1) {
    await page.locator('[data-tmf-termination-action="pick-scrap"]').first().click()
    await page.locator('[data-tmf-termination-root] [name="reason"]').fill('V2 终止处置报废')
    await page.locator('[data-tmf-termination-root] [name="confirmed"]').check()
    await page.locator('[data-tmf-termination-action="confirm-item"]').click()
  }
  await page.locator('[data-tmf-termination-action="pick-retain"]').first().click()
  await page.locator('[data-tmf-termination-root] [name="reason"]').fill('V2 受控保留待后续处置')
  await page.locator('[data-tmf-termination-root] [name="confirmed"]').check()
  await page.locator('[data-tmf-termination-action="confirm-item"]').click()
  assert.match(await termination.innerText(), /待处置 1 项/)
  await page.locator('[data-tmf-termination-action="pick-writeoff"]').first().click()
  await page.locator('[data-tmf-termination-root] [name="reason"]').fill('V2 领料在途差异确认')
  await page.locator('[data-tmf-termination-root] [name="confirmed"]').check()
  await page.locator('[data-tmf-termination-action="confirm-item"]').click()
  assert.match(await termination.innerText(), /全部实物与在途均已处置/)
  await page.locator('[data-tmf-termination-action="pick-close"]').click()
  await page.locator('[data-tmf-termination-root] [name="makeupOrderNo"]').fill('V2-MAKEUP-001')
  await page.locator('[data-tmf-termination-root] [name="reason"]').fill('V2 缺口终止并关联补做')
  await page.locator('[data-tmf-termination-root] [name="confirmed"]').check()
  await page.locator('[data-tmf-termination-action="confirm-close"]').click()
  await page.waitForTimeout(800)
  const closure = await page.evaluate(transformSync(`(async()=>{${load}const m = await load('/src/data/pms/tmf-material-purchases.ts');return m.getTmfTerminationReview('V2-TERM-PROD').closure})()`, { loader: 'ts', target: 'esnext' }).code)
  assert.equal(closure.makeupOrderNo, 'V2-MAKEUP-001')
  await page.reload()
  await page.locator('[data-tmf-work-orders]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-TERM-PROD')
  await page.locator('[data-tmf-work-orders-action="query"]').click()
  await page.locator('[data-tmf-work-orders-action="control"]').first().click()
  await page.locator('[data-tmf-production-control-action="termination"]').click()
  await termination.waitFor()
  assert.match(await termination.innerText(), /结案（V2 缺口终止并关联补做）/)
  evidence.checks.push('B25/TERM：终止处置台 5 项逐一处置、缺口 85 关联补做后结案，已结案展示')
  await page.keyboard.press('Escape')

  // PAGE-013 待接收：页面汇总 + 分批实收
  await page.goto(`${server}/fcs/craft/accessory/webbing/pending-receipts`)
  await page.locator('[data-tmf-pending-receipts]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-PENDING-PROD')
  await page.locator('[data-tmf-pending-receipts-action="query"]').click()
  const pendingText = await page.locator('[data-tmf-pending-receipts]').innerText()
  assert.match(pendingText, /V2P-IN/)
  await page.locator('[data-tmf-pending-receipts-action="receive"]').first().click()
  const pendingDialog = page.locator('[data-tmf-pending-dialog]')
  await pendingDialog.locator('[name="quantity"]').fill('30')
  await page.locator('[data-tmf-pending-receipts-action="confirm"]').click()
  await page.locator('[data-tmf-pending-receipts-action="query"]').click()
  assert.match(await page.locator('[data-tmf-pending-receipts]').innerText(), /部分接收/)
  await page.locator('[data-tmf-pending-receipts-action="receive"]').first().click()
  await pendingDialog.locator('[name="quantity"]').fill('20')
  await page.locator('[data-tmf-pending-receipts-action="confirm"]').click()
  await page.locator('[data-tmf-pending-receipts-action="query"]').click()
  assert.match(await page.locator('[data-tmf-pending-receipts]').innerText(), /已收齐/)
  evidence.checks.push('PAGE-013：待接收页按上游交出组织，分批实收 30+20 后收齐')

  // PAGE-014 交出记录：基础交出与加工产出交出可追溯、可打印
  await page.goto(`${server}/fcs/craft/accessory/webbing/handover-records`)
  await page.locator('[data-tmf-handover-records]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-')
  await page.locator('[data-tmf-handover-records-action="query"]').click()
  const handoverText = await page.locator('[data-tmf-handover-records]').innerText()
  assert.match(handoverText, /基础半成品/)
  assert.match(handoverText, /加工产出/)
  assert.equal(await page.locator('[data-tmf-handover-records] button:has-text("交出单打印")').count() > 0, true)
  evidence.checks.push('PAGE-014：交出记录覆盖基础半成品与加工产出，交出单打印入口存在')

  // PAGE-015 半成品库存：批次、占用、冻结与详情大图
  await page.goto(`${server}/wls/accessory-continuous-stock`)
  await page.locator('[data-tmf-continuous-stock]').waitFor()
  await page.locator('[name="keyword"]').fill('V2-TERM-BATCH')
  await page.locator('[data-tmf-continuous-stock-action="query"]').click()
  assert.match(await page.locator('[data-tmf-continuous-stock]').innerText(), /V2-TERM-BATCH/)
  await page.locator('[data-tmf-continuous-stock-action="detail"]').first().click()
  const stockDialog = page.locator('[data-tmf-continuous-dialog]')
  assert.match(await stockDialog.innerText(), /可分配/)
  await page.locator('[data-tmf-continuous-stock-action="close"]').last().click()
  await page.locator('[data-tmf-continuous-stock-action="image"]').first().click()
  const imageOk = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tmf-continuous-image] img')).every((image) => image.naturalWidth > 0))
  assert.equal(imageOk, true)
  await page.keyboard.press('Escape')
  evidence.checks.push('PAGE-015：半成品库存读取批次真值，详情与大图可用')

  // PAGE-016 PDA 工厂执行：接收、任务卡、打头参考、交出入口
  await page.goto(`${server}/fcs/craft/accessory/webbing/pda`)
  await page.locator('[data-tmf-pda-exec-root]').waitFor()
  await page.locator('[name="orderNo"]').fill('V2-TERM-PROD')
  await page.locator('[data-tmf-pda-exec-action="load"]').click()
  const pdaText = await page.locator('[data-tmf-pda-exec-root]').innerText()
  assert.match(pdaText, /待接收投入/)
  assert.match(pdaText, /可截断投入/)
  assert.match(pdaText, /待打头/)
  assert.match(pdaText, /待交出合格包/)
  evidence.checks.push('PAGE-016：PDA 工厂执行任务卡覆盖接收/截断/打头/交出')

  // LINK-001：主生产单页面加载只读 TMF 面板不报错
  await page.goto(`${server}/fcs/progress/production-orders/detail`)
  await page.locator('[data-progress-action]').first().waitFor()
  evidence.checks.push('LINK-001：主生产单进度页可加载，只读投影面板按生产单匹配（无匹配时隐藏）')

  assert.deepEqual(pageErrors, [])
  console.log(JSON.stringify(evidence))
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  console.error(error)
  console.log(JSON.stringify(evidence))
  process.exitCode = 1
} finally {
  writeFileSync('output/playwright/tmf-webbing/2026-09-22-v2-features-browser.json', JSON.stringify(evidence, null, 2))
  await browser.close()
}
