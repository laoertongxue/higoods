import { buildTmfPackageLabelsPrintDocument, buildTmfHandoverPrintDocument } from '../../src/pages/print/templates/tmf-package-print-template.ts'
import { buildTmfProcessSheetPrintDocument, renderTmfProcessSheetTemplate, tmfPrintFactsSignature } from '../../src/pages/print/templates/tmf-process-sheet-template.ts'
import assert from 'node:assert/strict'
import { readTmfOutputReceiptScan } from '../../src/data/fcs/tmf-pda-output-receipts.ts'
import test from 'node:test'
import { projectTmfWorkOrders } from '../../src/data/fcs/tmf-work-order-view.ts'
import { readFileSync } from 'node:fs'
import {
  receiveTmfSupplyPurchase, scrapTmfDefectiveOutput, getTmfDefectiveBalance, receiveTmfBaseMaterialStock, dispatchTmfBaseMaterial, receiveTmfBaseMaterial, consumeTmfBaseMaterial, dispatchTmfBaseMaterialReturn, receiveTmfBaseMaterialReturn, getTmfBaseMaterialBalance,
  TMF_PURCHASE_STORAGE_KEY, getTmfPurchaseState, createTmfMaterialPurchase, generateTmfBaseOrder,
  acceptTmfBaseOrder, reportTmfBaseProduction, dispatchTmfBaseProduction, receiveTmfBaseProduction,
  reviseTmfMaterialPurchase, resolveTmfBasePurchaseChange, reloadTmfPurchaseRuntime, type TmfMaterialPurchaseOrder, type TmfPurchaseActor,
  registerTmfProductionOrder, reserveTmfContinuousMaterial, releaseTmfContinuousReservation,
  issueTmfContinuousMaterial, receiveTmfProcessingMaterial,
  issueTmfMergedContinuousMaterial, receiveTmfMergedProcessingMaterial, reportTmfMergedCutOutput,
  reportTmfCutOutput, getTmfProcessingInputBalance, dispatchTmfContinuousReturn, receiveTmfContinuousReturn,
  dispatchTmfTipMaterial, receiveTmfTipMaterial, reportTmfTipping, receiveTmfTipMaterialStock, dispatchTmfTipMaterialReturn, receiveTmfTipMaterialReturn, getTmfTipMaterialBalance,
  packTmfOutput, splitTmfOutputPackage, moveTmfOutputPackage, dispatchTmfOutputPackage, receiveTmfOutputPackage, freezeTmfSurplusPackage,
  allocateTmfOutputPackage, releaseTmfOutputAllocation, issueTmfProductionPackage, receiveTmfProductionPackage,
  getTmfOutputPackageBalance, getTmfProductionDemandFulfillment,
  changeTmfProductionControl, getTmfProductionDisposition, cancelTmfMaterialPurchaseAfterDisposition,
  getTmfTerminationReview, closeTmfTermination, scrapTmfContinuousRemaining, scrapTmfFactoryCutPieces, scrapTmfFrozenPackage, retainTmfFrozenPackage, writeOffTmfUpstreamTransit, writeOffTmfProductionTransit,
  saveTmfWorkCost, getTmfWorkCost, getTmfWorkCostReview,
} from '../../src/data/pms/tmf-material-purchases.ts'
import { productionOrders, getProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-orders.ts'
import { deriveTmfProductionDemands } from '../../src/data/fcs/webbing-production-demands.ts'
import { getWebbingPhysicalSpecificationKey, type WebbingSpecification } from '../../src/data/fcs/webbing-specifications.ts'
import {
  listPmsMaterialPurchaseOrders, getPmsMaterialPurchaseOrder, advancePmsMaterialPurchaseOrderStatus,
  registerPmsMaterialPurchaseArrival,
} from '../../src/data/pms/material-purchase-orders.ts'
import { createPmsTmfTipPurchase } from '../../src/data/pms/material-purchase-orders.ts'
import { assertTmfTipMaterialMaster } from '../../src/data/pms/tmf-master-registry.ts'
import { PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'

const buyer: TmfPurchaseActor = { id: PMS_BUYER_ACTOR.id, name: PMS_BUYER_ACTOR.name, role: '采购员' }
const factory: TmfPurchaseActor = { id: 'TMF-SUP', name: '织带厂主管', role: '织带厂主管' }
const warehouse: TmfPurchaseActor = { id: 'ACC-WH', name: '辅料仓仓管', role: '仓管' }
const planner: TmfPurchaseActor = { id: 'PLAN', name: '生产计划', role: '生产计划' }
const productionReceiver: TmfPurchaseActor = { id: 'PROD-RECEIVER', name: '生产领料员', role: '生产领料人' }

function productionSource(id: string) {
  const template = productionOrders.find((order) => order.techPackSnapshot)!
  const pack = getProductionOrderTechPackSnapshot(template.productionOrderId)!
  pack.productionOrderId = id
  pack.snapshotId = `${id}-SNAPSHOT-V1`
  pack.sourceTechPackVersionId = `${id}-TECH-V1`
  pack.bomItems = [{ ...pack.bomItems[0], id: 'BOM-WB', type: '辅料', materialSkuId: 'WB30-WHT', applicableSkuCodes: [] }]
  const specification: WebbingSpecification = {
    id: 'S-50', bomItemId: 'BOM-WB', usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
    cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '冷切', acceptanceRequirement: '按确认样',
    tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
  }
  pack.processEntries = [{
    id: 'CUT', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段', processCode: 'WEBBING_CUT', processName: '织带截断',
    assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    routeObjectKey: 'BOM:BOM-WB', linkedBomItemIds: ['BOM-WB'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES', inputMaterialSkuId: 'WB30-WHT', outputMaterialSkuId: 'WB30-WHT',
    predecessorEntryIds: [], webbingSpecifications: [specification, { ...structuredClone(specification), id: 'M-70', garmentSize: 'M', cutLengthMm: 700, finishedLengthMm: 700 }],
  }]
  return { productionOrderId: id, productionOrderNo: id, status: 'EXECUTING' as const, techPackSnapshot: pack, demandSnapshot: {
    ...structuredClone(template.demandSnapshot), skuLines: [{ skuCode: `${id}-S`, size: 'S', color: '白', qty: 400 }, { skuCode: `${id}-M`, size: 'M', color: '白', qty: 600 }],
  } }
}

function purchase(id: string, qty: number, sku = 'WB30-WHT'): TmfMaterialPurchaseOrder {
  return {
    purchaseOrderNo: `${id}-PO`, purchaseLineId: `${id}-PO-L1`, version: 1, supplierId: 'MOCK-SUP-TMF',
    supplierName: 'Mock 织带供货方', factoryOrgId: 'FAC-TMF', materialSkuId: sku, materialSpuId: sku.split('-')[0],
    accessoryType: /^(RP|CORD|ROPE)/.test(sku) ? '绳子' : '织带', targetWarehouseId: 'MOCK-ACC-WH', productionStandard: 'Mock 基础生产标准 V1；材料配方待确认',
    requirementNo: '', sourceRequirementLineNo: '', sourceProductPurchaseOrderNo: '', materialCode: sku, materialName: `Mock ${sku}`,
    materialType: '辅料', materialImageUrl: '', unit: '米', styleCode: '', styleName: '', styleImageUrl: '', warehouse: 'Mock 辅料仓',
    orderedQty: qty, receivedQty: 0, unitPrice: 1, currency: 'RMB', status: '待采购', orderDate: '2026-09-20', expectedArrivalDate: '2026-09-25',
    buyerName: buyer.name, supplierConfirmed: false, supplierConfirmedAt: '', remark: '整链测试专用，不代表真实采购',
  }
}

function startScenarioBase(order: TmfMaterialPurchaseOrder): string {
  createTmfMaterialPurchase(order, buyer, `${order.purchaseOrderNo}:create`)
  assert.ok(listPmsMaterialPurchaseOrders().some((item) => item.purchaseOrderNo === order.purchaseOrderNo))
  assert.throws(() => generateTmfBaseOrder(order.purchaseOrderNo, factory, `${order.purchaseOrderNo}:early`), /尚未下达/)
  advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo, '已采购', PMS_BUYER_ACTOR)
  generateTmfBaseOrder(order.purchaseOrderNo, factory, `${order.purchaseOrderNo}:generate`)
  const base = getTmfPurchaseState().baseOrders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!
  assert.equal(base.purchaseLineId, order.purchaseLineId, '基础单必须保留 PMS 原采购行身份，合行后仍可回溯原行')
  acceptTmfBaseOrder(base.id, factory, `${order.purchaseOrderNo}:accept`)
  return base.id
}

function finishScenarioBase(order: TmfMaterialPurchaseOrder, baseId: string): string {
  reportTmfBaseProduction(baseId, order.orderedQty, factory, `${order.purchaseOrderNo}:produce`)
  dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: `${order.purchaseOrderNo}:handover`, batchId: `${order.purchaseOrderNo}:batch`, dispatchedMeters: order.orderedQty }, factory, `${order.purchaseOrderNo}:dispatch`)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 0)
  assert.equal(getTmfPurchaseState().lots.filter((lot) => lot.sourcePurchaseOrderNo === order.purchaseOrderNo).length, 0)
  return baseId
}

function prepare(order: TmfMaterialPurchaseOrder): string {
  return finishScenarioBase(order, startScenarioBase(order))
}

/**
 * 规范主链的原料前段：现有演示 PMS 棉纱采购下达后由仓库通过投入料采购实收动作形成
 * 来源批次，再与基础单个别发出/实收/耗用/退仓。物料 SKU 取真实采购物料，不按规范
 * Mock 的演示别名另造库存；D03 配方与单耗仍待确认，数量只代表本场景实际称量。
 */
const SCENARIO_RAW_PURCHASE_NO = 'CGF-2026-0007'
async function prepareWithRawMaterial(order: TmfMaterialPurchaseOrder, rawContract?: { materialSku: string; received: number; consumed: number; returned: number; remaining: number }): Promise<string> {
  const fixture = JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json', import.meta.url), 'utf8'))
  const scenario = fixture.normalScenarios.find((value: { id: string }) => order.purchaseOrderNo === `FULL-${value.id}-PO`)
  if (!scenario && !rawContract) throw new Error('规范主链缺原料合同')
  const raw = rawContract ?? scenario.baseProductionInput
  const source = getPmsMaterialPurchaseOrder(SCENARIO_RAW_PURCHASE_NO)
  if (!source) throw new Error('演示原料采购不存在，不能伪造原料前段')
  const baseId = startScenarioBase(order)
  if (source.status === '待采购') advancePmsMaterialPurchaseOrderStatus(SCENARIO_RAW_PURCHASE_NO, '已采购', PMS_BUYER_ACTOR)
  const prefix = order.purchaseOrderNo, lotId = `${prefix}-RAW-LOT`, issueId = `${prefix}-RAW-ISS`, returnId = `${prefix}-RAW-RETURN`, receiptId = `${prefix}-RAW-SOURCE`
  const receivedBefore = getPmsMaterialPurchaseOrder(SCENARIO_RAW_PURCHASE_NO)!.receivedQty
  const supplyReceipt = { receiptId, purchaseOrderNo: SCENARIO_RAW_PURCHASE_NO, purpose: 'BASE_MATERIAL' as const, lotId, scannedMaterialCode: source.materialCode, warehouse: source.warehouse, location: 'Y-01', quantity: raw.received }
  await receiveTmfSupplyPurchase(supplyReceipt, warehouse, `${prefix}:raw-stock`)
  const stocked = getTmfPurchaseState()
  await receiveTmfSupplyPurchase(supplyReceipt, warehouse, `${prefix}:raw-stock`)
  assert.deepEqual(getTmfPurchaseState(), stocked, '同一投入料采购实收动作重试不重复生成原料批次')
  assert.equal(stocked.supplyPurchaseReceipts.find((item) => item.id === receiptId)!.purchaseOrderNo, SCENARIO_RAW_PURCHASE_NO)
  assert.equal(stocked.supplyPurchaseReceipts.find((item) => item.id === receiptId)!.purpose, 'BASE_MATERIAL')
  assert.equal(stocked.baseMaterialLots.find((item) => item.id === lotId)!.materialSkuId, source.materialCode)
  assert.equal(getPmsMaterialPurchaseOrder(SCENARIO_RAW_PURCHASE_NO)!.receivedQty, receivedBefore + raw.received)
  dispatchTmfBaseMaterial({ id: issueId, baseOrderId: baseId, lotId, quantity: raw.received }, warehouse, `${prefix}:raw-issue`)
  receiveTmfBaseMaterial({ issueId, materialSkuId: source.materialCode, unit: 'kg', quantity: raw.received }, factory, `${prefix}:raw-receive`)
  consumeTmfBaseMaterial({ issueId, consumedQty: raw.consumed, scrapQty: 0, reason: '规范Mock的实际耗用；不作为配方或单耗' }, factory, `${prefix}:raw-consume`)
  dispatchTmfBaseMaterialReturn({ id: returnId, issueId, quantity: raw.returned, reason: '未用原料退原仓' }, factory, `${prefix}:raw-return`)
  receiveTmfBaseMaterialReturn({ returnId, warehouseId: source.warehouse, materialSkuId: source.materialCode, unit: 'kg', quantity: raw.returned }, warehouse, `${prefix}:raw-return-receive`)
  assert.equal(getTmfBaseMaterialBalance(issueId).availableQty, raw.remaining)
  assert.equal(stocked.baseMaterialLots.find((item) => item.id === lotId)!.unit, 'kg')
  assert.equal(raw.received, raw.consumed + raw.returned + raw.remaining)
  return finishScenarioBase(order, baseId)
}

function receipt(order: TmfMaterialPurchaseOrder, qty: number) {
  return { handoverId: `${order.purchaseOrderNo}:handover`, materialSkuId: order.materialSkuId, warehouseId: order.targetWarehouseId, location: 'A-01', receivedMeters: qty }
}

test('N01～N05：通过现有 PMS 入口下达，每条采购链从零执行到仓库实收；交出不提前增加库存', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json', import.meta.url), 'utf8'))
  for (const scenario of fixture.normalScenarios) {
    const order = purchase(scenario.id, scenario.purchaseQuantityM, scenario.baseSku)
    prepare(order)
    receiveTmfBaseProduction(receipt(order, order.orderedQty), warehouse, `${order.purchaseOrderNo}:receipt`)
    const state = getTmfPurchaseState()
    const pms = getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!
    assert.equal(pms.receivedQty, scenario.purchaseQuantityM)
    assert.equal(pms.status, '已入库')
    assert.equal(pms.styleCode, '', '基础备货不虚构生产单款式')
    assert.equal(state.lots.find((lot) => lot.sourcePurchaseOrderNo === pms.purchaseOrderNo)!.onHandMeters, scenario.purchaseQuantityM)
    assert.equal(state.handovers.find((item) => item.purchaseOrderNo === pms.purchaseOrderNo)!.receivedMeters, scenario.purchaseQuantityM)
    assert.throws(() => registerPmsMaterialPurchaseArrival(pms.purchaseOrderNo, 10, PMS_BUYER_ACTOR), /不能手改/)
  }
})

test('MOCK-007：规范场景使用同一采购行、基础单和生产需求身份，不复制孤立页面 Mock', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json', import.meta.url), 'utf8'))
  const scenarios = [...fixture.normalScenarios, ...fixture.boundaryScenarios]
  for (const scenario of scenarios) {
    const references = scenario.references ?? {}
    const values = Object.values(references).filter(Boolean)
    assert.equal(new Set(values).size, values.length, `${scenario.id} 的共享业务对象引用不能重复占位`)
    if (references.purchase && references.purchaseLine) {
      assert.match(references.purchaseLine, new RegExp(`^${references.purchase}-L`), `${scenario.id} 的采购行必须属于同一采购单`)
    }
    assert.ok(references.productionOrder || references.purchase || scenario.base || scenario.replayFrom, `${scenario.id} 必须能回到采购或生产来源对象`)
  }
  const order = purchase('MOCK-SHARED', 10)
  const baseId = startScenarioBase(order)
  const state = getTmfPurchaseState()
  assert.equal(state.orders.filter((item) => item.purchaseOrderNo === order.purchaseOrderNo).length, 1)
  assert.equal(state.baseOrders.filter((item) => item.id === baseId).length, 1)
  assert.equal(state.baseOrders.find((item) => item.id === baseId)!.purchaseLineId, order.purchaseLineId)
})

test('MOCK-009：重置只重载隔离的运行态，不清除用户浏览器数据', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>([['user-preference', 'keep-me']])
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
  } } })
  try {
    reloadTmfPurchaseRuntime()
    const order = purchase('MOCK-ISOLATED', 1)
    createTmfMaterialPurchase(order, buyer, 'MOCK-ISOLATED:create')
    assert.equal(storage.get('user-preference'), 'keep-me')
    assert.ok(storage.has(TMF_PURCHASE_STORAGE_KEY))
    reloadTmfPurchaseRuntime()
    assert.equal(getTmfPurchaseState().orders[0]!.purchaseOrderNo, order.purchaseOrderNo)
    assert.equal(storage.get('user-preference'), 'keep-me')
    assert.ok(storage.has(TMF_PURCHASE_STORAGE_KEY), '重载不能删除隔离场景已保存的运行记录')
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
    reloadTmfPurchaseRuntime()
  }
})

test('B01/B03：短收保留在途和采购缺口；重复扫描、生成和刷新不双记', () => {
  const order = purchase('B01', 1000)
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 990), warehouse, 'B01:first')
  receiveTmfBaseProduction(receipt(order, 990), warehouse, 'B01:first')
  generateTmfBaseOrder(order.purchaseOrderNo, factory, 'B01:generate-again')
  let state = getTmfPurchaseState()
  assert.equal(state.orders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!.receivedQty, 990)
  assert.equal(state.baseOrders.filter((item) => item.purchaseOrderNo === order.purchaseOrderNo).length, 1)
  assert.equal(state.handovers.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!.dispatchedMeters, 1000)
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 10), warehouse, 'B01:first'), /其他内容/)
  receiveTmfBaseProduction(receipt(order, 10), warehouse, 'B01:remainder')
  state = getTmfPurchaseState()
  assert.equal(state.lots.find((item) => item.sourcePurchaseOrderNo === order.purchaseOrderNo)!.onHandMeters, 1000)
})

test('B02/B04：多收、错 SKU、错仓和无权限动作不改变任意下游数量；恢复后正常收齐', () => {
  const order = purchase('B02', 1000)
  prepare(order)
  const before = getTmfPurchaseState()
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 1005), warehouse, 'B02:over'), /超过上游/)
  assert.throws(() => receiveTmfBaseProduction({ ...receipt(order, 1000), materialSkuId: 'WB20-WHT' }, warehouse, 'B02:sku'), /物料或目标仓/)
  assert.throws(() => receiveTmfBaseProduction({ ...receipt(order, 1000), warehouseId: 'WRONG' }, warehouse, 'B02:wh'), /物料或目标仓/)
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 1000), buyer, 'B02:role'), /当前角色/)
  assert.deepEqual(getTmfPurchaseState(), before)
  receiveTmfBaseProduction(receipt(order, 1000), warehouse, 'B02:correct')
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1000)

})

test('OVR-001～003：超产与超收须主管二次确认，计划不扩、幂等且下游一致', () => {
  const order = purchase('OVR', 1000)
  const baseId = startScenarioBase(order)
  reportTmfBaseProduction(baseId, 500, factory, 'OVR:in-plan')
  const worker: TmfPurchaseActor = { id: 'TMF-WORKER', name: '织带厂员工', role: '织带厂员工' }
  const supervisor: TmfPurchaseActor = { id: 'ACC-WH-SUP', name: '辅料仓主管', role: '仓库主管' }
  assert.throws(() => reportTmfBaseProduction(baseId, 600, worker, 'OVR:over-role'), /织带厂主管/)
  assert.throws(() => reportTmfBaseProduction(baseId, 600, factory, 'OVR:over-unconfirmed'), /二次确认/)
  assert.throws(() => reportTmfBaseProduction(baseId, 600, factory, 'OVR:over-noreason', { reason: '  ', confirmed: true }), /原因/)
  assert.equal(getTmfPurchaseState().baseOrders.find((item) => item.id === baseId)!.producedMeters, 500)
  reportTmfBaseProduction(baseId, 600, factory, 'OVR:over-confirmed', { reason: '试机多产出100米，主管确认', confirmed: true })
  reportTmfBaseProduction(baseId, 600, factory, 'OVR:over-confirmed', { reason: '试机多产出100米，主管确认', confirmed: true })
  let state = getTmfPurchaseState()
  let base = state.baseOrders.find((item) => item.id === baseId)!
  assert.equal(base.producedMeters, 1100)
  assert.equal(base.plannedMeters, 1000)
  assert.deepEqual(base.overProductions!.map((item) => item.meters), [100])
  dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: `${order.purchaseOrderNo}:handover`, batchId: `${order.purchaseOrderNo}:batch`, dispatchedMeters: 1100 }, factory, 'OVR:dispatch')
  const beforeReceive = getTmfPurchaseState()
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 1100), warehouse, 'OVR:recv-clerk'), /仓库主管/)
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 1100), supervisor, 'OVR:recv-unconfirmed'), /二次确认/)
  assert.deepEqual(getTmfPurchaseState(), beforeReceive)
  receiveTmfBaseProduction({ ...receipt(order, 1100), overReceipt: { reason: '工厂超产10%，仓库主管确认来源', confirmed: true } }, supervisor, 'OVR:recv-sup')
  receiveTmfBaseProduction({ ...receipt(order, 1100), overReceipt: { reason: '工厂超产10%，仓库主管确认来源', confirmed: true } }, supervisor, 'OVR:recv-sup')
  state = getTmfPurchaseState()
  const saved = state.orders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!
  assert.equal(saved.receivedQty, 1100)
  assert.equal(saved.orderedQty, 1000)
  assert.deepEqual(saved.overReceipts!.map((item) => item.meters), [100])
  assert.equal(state.lots.find((lot) => lot.sourcePurchaseOrderNo === order.purchaseOrderNo)!.onHandMeters, 1100)
  assert.throws(() => receiveTmfBaseProduction(receipt(order, 1), supervisor, 'OVR:recv-beyond'), /超过上游实际交出/)
})

test('MASTER-001～003/005：采购与端头采购映射原型内建主档，缺失阻断且身份稳定', () => {
  const before = getTmfPurchaseState()
  assert.throws(() => createTmfMaterialPurchase({ ...purchase('MASTER-GAP-SUP', 100), supplierId: 'UNKNOWN-SUP' }, buyer, 'MASTER-GAP:sup'), /供应商主档/)
  assert.throws(() => createTmfMaterialPurchase({ ...purchase('MASTER-GAP-SKU', 100), materialSkuId: 'NO-SUCH-SKU' }, buyer, 'MASTER-GAP:sku'), /物料档案/)
  assert.throws(() => createTmfMaterialPurchase({ ...purchase('MASTER-GAP-WH', 100), targetWarehouseId: 'NO-SUCH-WH' }, buyer, 'MASTER-GAP:wh'), /仓库主档/)
  assert.deepEqual(getTmfPurchaseState(), before)
  // MASTER-005：更正为已登记主档后同一操作号继续，不产生重复采购
  const retry = purchase('MASTER-RETRY', 50)
  assert.throws(() => createTmfMaterialPurchase({ ...retry, supplierId: 'UNKNOWN-SUP' }, buyer, 'MASTER-RETRY:op'), /供应商主档/)
  createTmfMaterialPurchase({ ...retry, supplierId: 'TMF-DEMO-SUPPLIER' }, buyer, 'MASTER-RETRY:op')
  assert.equal(getTmfPurchaseState().orders.filter((item) => item.purchaseOrderNo === retry.purchaseOrderNo).length, 1)
  // MASTER-001：创建即写入供应方/物料/目标仓主档映射
  const order = purchase('MASTER-OK', 100)
  const baseId = startScenarioBase(order)
  let state = getTmfPurchaseState()
  const stored = state.orders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!
  assert.equal(stored.masterRefs!.supplier.masterId, 'MOCK-SUP-TMF')
  assert.equal(stored.masterRefs!.supplier.source, 'TMF原型规范主档')
  assert.equal(stored.masterRefs!.material.masterId, 'WB30-WHT')
  assert.equal(stored.masterRefs!.material.category, '织带')
  assert.equal(stored.masterRefs!.warehouse.masterId, 'MOCK-ACC-WH')
  // MASTER-003：批次沿用同一主档身份；物料档案显示名变化不改变 masterId
  reportTmfBaseProduction(baseId, 100, factory, 'MASTER-OK:produce')
  dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: `${order.purchaseOrderNo}:handover`, batchId: 'MASTER-OK-B', dispatchedMeters: 100 }, factory, 'MASTER-OK:dispatch')
  receiveTmfBaseProduction(receipt(order, 100), warehouse, 'MASTER-OK:receive')
  state = getTmfPurchaseState()
  assert.equal(state.lots.find((item) => item.id === 'MASTER-OK-B')!.materialSkuId, stored.masterRefs!.material.masterId)
  const archiveBase = { ...purchase('MASTER-ARCHIVE', 20), materialSkuId: 'tmf-webbing-reference-white', materialCode: 'TMF-WB-REF-WHT', materialSpuId: 'tmf-webbing-reference', materialName: '白色织带半成品（幅宽待确认）' }
  createTmfMaterialPurchase(archiveBase, buyer, 'MASTER-ARCHIVE:create')
  createTmfMaterialPurchase({ ...archiveBase, purchaseOrderNo: 'MASTER-RENAME-PO', purchaseLineId: 'MASTER-RENAME-PO-L1', materialName: '改名后的显示名称' }, buyer, 'MASTER-RENAME:create')
  state = getTmfPurchaseState()
  const archived = state.orders.find((item) => item.purchaseOrderNo === 'MASTER-ARCHIVE-PO')!
  const renamed = state.orders.find((item) => item.purchaseOrderNo === 'MASTER-RENAME-PO')!
  assert.equal(archived.masterRefs!.material.source, '物料档案')
  assert.equal(archived.masterRefs!.material.masterId, renamed.masterRefs!.material.masterId)
  // MASTER-002：端头辅材映射独立端头主档，单位一致且不得引用织带／绳子 SKU
  assert.throws(() => assertTmfTipMaterialMaster('NO-SUCH-TIP', '个'), /端头辅材主档/)
  assert.throws(() => assertTmfTipMaterialMaster('WB30-WHT', '个'), /织带／绳子半成品主档/)
  assert.throws(() => assertTmfTipMaterialMaster('HEAD-M01', '米'), /单位/)
  assert.equal(assertTmfTipMaterialMaster('HEAD-M01', '个').source, 'TMF原型规范主档')
  assert.equal(assertTmfTipMaterialMaster('SILICONE-M01', 'kg').category, '端头辅材')
})

test('MASTER-004：映射前历史记录保留原快照与未映射标记，不批量改写', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value) } } } })
  try {
    reloadTmfPurchaseRuntime()
    const order = purchase('MASTER-LEGACY', 30)
    createTmfMaterialPurchase(order, buyer, 'MASTER-LEGACY:create')
    const saved = JSON.parse(storage.get(TMF_PURCHASE_STORAGE_KEY)!) as { orders: Array<Record<string, unknown>> }
    assert.ok(saved.orders[0].masterRefs, '新采购必须写入主档映射')
    delete saved.orders[0].masterRefs
    saved.orders[0].supplierName = '历史显示名（未迁移）'
    storage.set(TMF_PURCHASE_STORAGE_KEY, JSON.stringify(saved))
    reloadTmfPurchaseRuntime()
    const loaded = getTmfPurchaseState().orders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!
    assert.equal(loaded.masterRefs, undefined)
    assert.equal(loaded.supplierName, '历史显示名（未迁移）')
    assert.equal(loaded.materialSkuId, order.materialSkuId)
    assert.equal(getTmfPurchaseState().orders.filter((item) => item.purchaseOrderNo === order.purchaseOrderNo).length, 1)
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
    reloadTmfPurchaseRuntime()
  }
})

test('TERM-001～005：取消后终止处置台逐项决定，未处置不得结案且数量对账守恒', () => {
  const order = purchase('TERM', 700, 'CORD-WHT')
  const baseId = startScenarioBase(order)
  reportTmfBaseProduction(baseId, 700, factory, 'TERM:produce')
  dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: `${order.purchaseOrderNo}:handover`, batchId: 'TERM-BATCH', dispatchedMeters: 700 }, factory, 'TERM:dispatch')
  receiveTmfBaseProduction(receipt(order, 700), warehouse, 'TERM:receive')
  const source = productionSource('TERM-PROD')
  const cut = source.techPackSnapshot.processEntries[0]
  cut.webbingSpecifications = [cut.webbingSpecifications![0]]
  source.demandSnapshot.skuLines = [{ skuCode: 'TERM-S', size: 'S', color: '白', qty: 1000 }]
  source.techPackSnapshot.bomItems[0].materialSkuId = 'CORD-WHT'
  cut.inputMaterialSkuId = cut.outputMaterialSkuId = 'CORD-WHT'
  registerTmfProductionOrder(source, planner, 'TERM:demand')
  const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === source.productionOrderId)!
  reserveTmfContinuousMaterial({ reservationId: 'TERM-RES', demandId: demand.id, lotId: 'TERM-BATCH', reservedMeters: 700, reason: '含损耗与不良余量' }, planner, 'TERM:reserve')
  issueTmfContinuousMaterial({ issueId: 'TERM-IN', reservationId: 'TERM-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 700 }, warehouse, 'TERM:issue')
  receiveTmfProcessingMaterial({ issueId: 'TERM-IN', factoryId: 'FAC-TMF', materialSkuId: order.materialSkuId, receivedMeters: 700 }, factory, 'TERM:input-receive')
  reportTmfCutOutput({ outputId: 'TERM-OUT1', issueId: 'TERM-IN', cutPieces: 1300, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '超需求加工含余量' }, factory, 'TERM:cut1')
  reportTmfCutOutput({ outputId: 'TERM-OUT2', issueId: 'TERM-IN', cutPieces: 100, defectivePieces: 20, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '试机不良20根' }, factory, 'TERM:cut2')
  assert.equal(getTmfProcessingInputBalance('TERM-IN').remainingMeters, 0)
  packTmfOutput({ packageId: 'TERM-PKGA', cutOutputId: 'TERM-OUT1', pieces: 1000 }, factory, 'TERM:packA')
  dispatchTmfOutputPackage({ handoverId: 'TERM-HOA', packageId: 'TERM-PKGA', warehouseId: order.targetWarehouseId }, factory, 'TERM:dispatchA')
  receiveTmfOutputPackage({ handoverId: 'TERM-HOA', packageId: 'TERM-PKGA', warehouseId: order.targetWarehouseId, demandId: demand.id, location: 'T-01', receivedPieces: 1000 }, warehouse, 'TERM:receiveA')
  allocateTmfOutputPackage({ allocationId: 'TERM-AL', packageId: 'TERM-PKGA', demandId: demand.id, pieces: 1000, receiverId: productionReceiver.id, receiverOrganizationId: 'TERM-PROD-ORG' }, planner, 'TERM:allocate')
  issueTmfProductionPackage({ issueId: 'TERM-PI', allocationId: 'TERM-AL', packageId: 'TERM-PKGA', demandId: demand.id, warehouseId: order.targetWarehouseId, pieces: 300 }, warehouse, 'TERM:issue-prod')
  receiveTmfProductionPackage({ issueId: 'TERM-PI', packageId: 'TERM-PKGA', demandId: demand.id, receiverOrganizationId: 'TERM-PROD-ORG', pieces: 150 }, productionReceiver, 'TERM:receive-prod')
  packTmfOutput({ packageId: 'TERM-PKGB', cutOutputId: 'TERM-OUT1', pieces: 200 }, factory, 'TERM:packB')
  dispatchTmfOutputPackage({ handoverId: 'TERM-HOB', packageId: 'TERM-PKGB', warehouseId: order.targetWarehouseId }, factory, 'TERM:dispatchB')
  receiveTmfOutputPackage({ handoverId: 'TERM-HOB', packageId: 'TERM-PKGB', warehouseId: order.targetWarehouseId, demandId: demand.id, location: 'T-02', receivedPieces: 200 }, warehouse, 'TERM:receiveB')
  const whSupervisor: TmfPurchaseActor = { id: 'ACC-WH-SUP', name: '辅料仓主管', role: '仓库主管' }
  freezeTmfSurplusPackage({ packageId: 'TERM-PKGB', expectedPieces: 200, reason: '超需求余量冻结', confirmed: true }, whSupervisor, 'TERM:freeze')
  changeTmfProductionControl({ productionOrderId: source.productionOrderId, status: 'CANCELLED', reason: '终止处置测试', confirmed: true }, planner, 'TERM:cancel')
  const signature = (review: ReturnType<typeof getTmfTerminationReview>) => JSON.stringify({ productionOrderId: review.productionOrderId, controlStatus: review.controlStatus, closure: review.closure, items: review.items, outstandingCount: review.outstandingCount, shortagePieces: review.shortagePieces, disposals: review.disposals })
  let review = getTmfTerminationReview(source.productionOrderId)
  assert.deepEqual(review.items.map((item) => [item.category, item.quantity, item.unit]).sort(), [
    ['DEFECTIVE', 20, '根'], ['FACTORY_CUT', 80, '根'], ['FACTORY_CUT', 100, '根'], ['FROZEN_PACKAGE', 200, '根'], ['PRODUCTION_TRANSIT', 150, '根'],
  ].sort())
  assert.throws(() => closeTmfTermination({ id: 'TERM-CLOSE-EARLY', productionOrderId: source.productionOrderId, reason: '提前结案', confirmed: true, expectedReview: signature(review) }, planner, 'TERM:close-early'), /仍有 5 项/)
  assert.equal(getTmfTerminationReview(source.productionOrderId).closure, null)
  scrapTmfFactoryCutPieces({ id: 'TERM-FS1', cutOutputId: 'TERM-OUT1', pieces: 100, reason: '停单后在制报废', confirmed: true }, factory, 'TERM:scrap1')
  scrapTmfFactoryCutPieces({ id: 'TERM-FS2', cutOutputId: 'TERM-OUT2', pieces: 80, reason: '停单后在制报废', confirmed: true }, factory, 'TERM:scrap2')
  scrapTmfDefectiveOutput({ id: 'TERM-DS', cutOutputId: 'TERM-OUT2', pieces: 20, expectedAvailablePieces: 20, reason: '试机不良报废', confirmed: true }, factory, 'TERM:scrap-defect')
  retainTmfFrozenPackage({ id: 'TERM-RT', packageId: 'TERM-PKGB', reason: '受控保留待后续处置', confirmed: true }, whSupervisor, 'TERM:retain')
  writeOffTmfProductionTransit({ id: 'TERM-WO', issueId: 'TERM-PI', reason: '领料方确认少收150根，终止差异', confirmed: true }, planner, 'TERM:writeoff')
  review = getTmfTerminationReview(source.productionOrderId)
  assert.equal(review.outstandingCount, 0)
  assert.equal(review.shortagePieces, 850)
  assert.throws(() => closeTmfTermination({ id: 'TERM-CLOSE-GAP', productionOrderId: source.productionOrderId, reason: '全部实物与在途已处置', confirmed: true, expectedReview: signature(review) }, planner, 'TERM:close-gap'), /缺口 850/)
  closeTmfTermination({ id: 'TERM-CLOSE', productionOrderId: source.productionOrderId, reason: '全部实物与在途已处置', confirmed: true, expectedReview: signature(review), makeupOrderNo: 'TERM-MAKEUP-001' }, planner, 'TERM:close')
  review = getTmfTerminationReview(source.productionOrderId)
  assert.ok(review.closure)
  assert.equal(review.closure!.makeupOrderNo, 'TERM-MAKEUP-001')
  assert.equal(getTmfProductionDisposition(source.productionOrderId).terminationClosedAt, review.closure!.occurredAt)
  assert.throws(() => retainTmfFrozenPackage({ id: 'TERM-RT2', packageId: 'TERM-PKGB', reason: '重复', confirmed: true }, whSupervisor, 'TERM:retain-after'), /已结案/)
})

test('终止连续余料：实物余量只扣一次报废，拒绝超量且剩余数量可继续处置', () => {
  const order = purchase('TERM-LEFT', 100, 'CORD-WHT')
  const baseId = startScenarioBase(order)
  reportTmfBaseProduction(baseId, 100, factory, 'TERM-LEFT:produce')
  dispatchTmfBaseProduction({ baseOrderId: baseId, handoverId: `${order.purchaseOrderNo}:handover`, batchId: 'TERM-LEFT-BATCH', dispatchedMeters: 100 }, factory, 'TERM-LEFT:dispatch')
  receiveTmfBaseProduction(receipt(order, 100), warehouse, 'TERM-LEFT:receive')
  const source = productionSource('TERM-LEFT-PROD')
  source.techPackSnapshot.bomItems[0].materialSkuId = 'CORD-WHT'
  source.techPackSnapshot.processEntries[0].inputMaterialSkuId = source.techPackSnapshot.processEntries[0].outputMaterialSkuId = 'CORD-WHT'
  registerTmfProductionOrder(source, planner, 'TERM-LEFT:demand')
  const demand = getTmfPurchaseState().demands.find(item => item.productionOrderId === source.productionOrderId)!
  reserveTmfContinuousMaterial({ reservationId: 'TERM-LEFT-RES', demandId: demand.id, lotId: 'TERM-LEFT-BATCH', reservedMeters: 100, reason: '余料处置回归' }, planner, 'TERM-LEFT:reserve')
  issueTmfContinuousMaterial({ issueId: 'TERM-LEFT-IN', reservationId: 'TERM-LEFT-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 100 }, warehouse, 'TERM-LEFT:issue')
  receiveTmfProcessingMaterial({ issueId: 'TERM-LEFT-IN', factoryId: 'FAC-TMF', materialSkuId: order.materialSkuId, receivedMeters: 100 }, factory, 'TERM-LEFT:received')
  changeTmfProductionControl({ productionOrderId: source.productionOrderId, status: 'CANCELLED', reason: '终止', confirmed: true }, planner, 'TERM-LEFT:cancel')
  const remaining = () => getTmfTerminationReview(source.productionOrderId).items.find(item => item.category === 'CONTINUOUS_REMAINING')?.quantity
  assert.equal(remaining(), 100)
  const scrap = { id: 'TERM-LEFT-SCRAP', issueId: 'TERM-LEFT-IN', meters: 30, reason: '主管确认报废', confirmed: true }
  assert.throws(() => scrapTmfContinuousRemaining({ ...scrap, meters: 101 }, factory, 'TERM-LEFT:over'), /超过/)
  scrapTmfContinuousRemaining(scrap, factory, 'TERM-LEFT:scrap')
  assert.equal(remaining(), 70)
  assert.equal(getTmfProcessingInputBalance('TERM-LEFT-IN').remainingMeters, 70)
  assert.throws(() => scrapTmfContinuousRemaining({ ...scrap, id: 'TERM-LEFT-OVER', meters: 71 }, factory, 'TERM-LEFT:over2'), /超过/)
  scrapTmfContinuousRemaining({ ...scrap, id: 'TERM-LEFT-FINAL', meters: 70 }, factory, 'TERM-LEFT:final')
  assert.equal(remaining(), undefined)
  assert.equal(getTmfProcessingInputBalance('TERM-LEFT-IN').remainingMeters, 0)
})

test('GAP-TERM-004：上游未收与生产在途分别确认去向，不可重复登记', () => {
  const plannerActor: TmfPurchaseActor = { id: 'PLAN', name: '生产计划', role: '生产计划' }
  const whSupervisor: TmfPurchaseActor = { id: 'ACC-WH-SUP2', name: '辅料仓主管', role: '仓库主管' }
  assert.throws(() => writeOffTmfUpstreamTransit({ id: 'GAP-UP', issueId: 'NO-SUCH', reason: 'x', confirmed: true }, whSupervisor, 'GAP:up'), /印染上游/)
  assert.throws(() => writeOffTmfProductionTransit({ id: 'GAP-PI', issueId: 'NO-SUCH', reason: 'x', confirmed: true }, plannerActor, 'GAP:pi'), /不存在/)
  assert.throws(() => scrapTmfContinuousRemaining({ id: 'GAP-CS', issueId: 'NO-SUCH', meters: 1, reason: 'x', confirmed: true }, factory, 'GAP:cs'), /本厂已接收/)
})

test('DYE-001～003：染色直交织带厂按实际交出分配实收，追溯原染色单且不重复扣料', async () => {
  const dyeing = await import('../../src/data/fcs/dyeing-task-domain.ts')
  const handover = await import('../../src/data/fcs/pda-handover-events.ts')
  const { assertTmfDyeCutContinuation } = await import('../../src/data/fcs/tmf-process-continuation.ts')
  const m = await import('../../src/data/pms/tmf-material-purchases.ts')
  const p = purchase('DYE-DIRECT', 100); p.materialImageUrl = '/materials/tmf/webbing-real-roll.jpg'
  prepare(p); receiveTmfBaseProduction(receipt(p, 100), warehouse, 'DYE:base')
  const lot = getTmfPurchaseState().lots.find((item) => item.sourcePurchaseOrderNo === p.purchaseOrderNo)!.id
  const source = productionSource('DYE-PROD'), cut = source.techPackSnapshot.processEntries[0]
  cut.webbingSpecifications = [cut.webbingSpecifications![0]]
  source.demandSnapshot.skuLines = [{ skuCode: 'DYE-S', size: 'S', color: '白', qty: 100 }]
  const dyeEntry = { ...structuredClone(cut), id: 'DYE', processCode: 'DYE', processName: '染色', inputMaterialSkuId: 'WB30-WHT', inputMaterialSkuCode: 'WB30-WHT', outputMaterialSkuId: 'WB30-CBL01', outputMaterialSkuCode: 'WB30-CBL01', outputMaterialName: '蓝色织带', inputInventoryForm: 'CONTINUOUS' as const, outputInventoryForm: 'CONTINUOUS' as const, outputMaterialSkuMode: 'CHANGED' as const, predecessorEntryIds: [] as string[], webbingSpecifications: undefined }
  cut.inputMaterialSkuId = cut.outputMaterialSkuId = 'WB30-CBL01'; cut.predecessorEntryIds = ['DYE']
  source.techPackSnapshot.processEntries = [dyeEntry, cut]
  const full = { ...structuredClone(productionOrders.find((o) => o.techPackSnapshot)!), ...source, selectedTechPackVersionId: source.techPackSnapshot.sourceTechPackVersionId, processWorkOrderDefinitions: [], auditLogs: [] }
  productionOrders.push(full)
  registerTmfProductionOrder(full, planner, 'DYE:demands')
  const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === source.productionOrderId)!
  // 接续校验契约：必须唯一直接前后工序、连续辅料、同版本同SKU，且不得已有印花下游
  const pack = full.techPackSnapshot
  const validDye = { sourceSnapshot: { sourceType: 'PRODUCTION_ORDER' as const, productionOrderId: full.productionOrderId, techPackVersionId: pack.sourceTechPackVersionId, processEntryId: 'DYE', bomItemId: 'BOM-WB' }, status: 'FULL_HANDOVER' as const, qtyUnit: '米', dyeFactoryId: 'F-DYE', outputMaterial: { sku: 'WB30-CBL01' }, changeImpact: [] }
  assertTmfDyeCutContinuation(validDye as never, 'CUT', pack)
  assert.throws(() => assertTmfDyeCutContinuation({ ...validDye, sourceSnapshot: { ...validDye.sourceSnapshot, downstreamWorkOrderId: 'PRINT-X' } } as never, 'CUT', pack), /下游印花单/)
  assert.throws(() => assertTmfDyeCutContinuation({ ...validDye, outputMaterial: { sku: 'WRONG' } } as never, 'CUT', pack), /SKU不一致/)
  assert.throws(() => assertTmfDyeCutContinuation({ ...validDye, qtyUnit: 'kg' } as never, 'CUT', pack), /计量单位/)
  // 正式登记一张直接截断路线的染色单（工厂 F090），再以运行态夹具补齐接续字段
  const original = dyeing.captureDyeProcessMutationState()
  const registered = dyeing.registerFormalProductionOrderDyeWorkOrder({
    workOrderId: 'DYE-DIRECT-ORDER', workOrderNo: 'DYE-DIRECT-ORDER', sourceKey: 'DYE-DIRECT-ORDER', processName: '染色',
    sourceSnapshot: { sourceType: 'PRODUCTION_ORDER', productionOrderId: full.productionOrderId, productionOrderNo: full.productionOrderNo, techPackVersionId: pack.sourceTechPackVersionId, techPackVersionLabel: 'V1', processEntryId: 'DYE', routeObjectKey: 'BOM:BOM-WB', bomItemId: 'BOM-WB' },
    productionOrderId: full.productionOrderId, productionOrderNo: full.productionOrderNo, techPackVersionId: pack.sourceTechPackVersionId, techPackVersionLabel: 'V1', processEntryId: 'DYE', routeObjectKey: 'BOM:BOM-WB',
    orderedAt: '2026-09-20 08:00:00', materialId: 'WB30-WHT', materialName: '测试织带',
    materialItems: [{ sourceBomItemId: 'BOM-WB', materialId: 'WB30-WHT', materialName: '测试织带', materialType: '辅料' }],
    inputMaterialSkuId: 'WB30-WHT', inputMaterialSkuCode: 'WB30-WHT', outputMaterialSkuId: 'WB30-CBL01', outputMaterialSkuCode: 'WB30-CBL01',
    plannedQty: 100, qtyUnit: '米', processCodes: ['DYE'], spuCode: 'TEST', spuName: '测试款式', requiredDeliveryDate: '2026-09-25',
    factoryId: 'F090', factoryName: '测试染色厂',
  } as never)
  const dyeOrderId = registered.dyeOrderId
  const seeded = dyeing.captureDyeProcessMutationState()
  const seed = seeded.workOrders.find(([id]) => id === dyeOrderId)![1]
  seed.status = 'FULL_HANDOVER'
  seed.rawMaterialSku = 'WB30-WHT'
  seed.qtyUnit = '米'
  seed.outputMaterial = { sku: 'WB30-CBL01', name: '蓝色织带' } as never
  seed.changeImpact = []
  seed.downstreamWorkOrderId = undefined
  seed.productionPrintContinuation = undefined
  seed.productionTmfContinuation = { cutEntryId: 'CUT', factoryId: 'FAC-TMF', factoryName: 'TMF - 辅料厂' }
  seed.handoverOrderId = 'DYE-DIRECT-HEAD'
  dyeing.restoreDyeProcessMutationState(seeded)
  try {
    const taskId = registered.taskId
    const dyeFactoryId = dyeing.getDyeWorkOrderById(dyeOrderId)!.dyeFactoryId
    handover.upsertPdaHandoverHeadMock({ handoverId: 'DYE-DIRECT-HEAD', handoverOrderId: 'DYE-DIRECT-HEAD', handoverOrderNo: 'DYE-DIRECT-HEAD', headType: 'HANDOUT', qrCodeValue: 'DYE-DIRECT-HEAD', taskId, taskNo: 'DYE-DIRECT', sourceType: 'PRODUCTION_ORDER', sourceSnapshot: seed.sourceSnapshot, productionOrderId: full.productionOrderId, productionOrderNo: full.productionOrderNo, processName: '染色', processBusinessCode: 'DYE', sourceFactoryName: '测试染色厂', sourceFactoryId: 'F-DYE', targetName: 'TMF - 辅料厂', targetKind: 'FACTORY', receiverKind: 'FACTORY', receiverId: 'FAC-TMF', receiverName: 'TMF - 辅料厂', qtyUnit: '米', factoryId: 'F-DYE', taskStatus: 'IN_PROGRESS', summaryStatus: 'WAIT_RECEIVE', recordCount: 1, pendingWritebackCount: 1, writtenBackQtyTotal: 0, sourceBusinessType: 'DYE_WORK_ORDER', sourceDocId: dyeOrderId, sourceDocNo: dyeOrderId } as never)
    handover.upsertPdaHandoutRecordMock({ recordId: 'DYE-DIRECT-REC', handoverRecordId: 'DYE-DIRECT-REC', handoverId: 'DYE-DIRECT-HEAD', handoverOrderId: 'DYE-DIRECT-HEAD', taskId, sequenceNo: 1, submittedQty: 100, qtyUnit: '米', factorySubmittedAt: '2026-09-20 09:30:00', factorySubmittedBy: '测试染色员', skuCode: 'WB30-CBL01', materialCode: 'WB30-CBL01', materialName: '蓝色织带', sourceType: 'PRODUCTION_ORDER', sourceSnapshot: seed.sourceSnapshot, productionOrderNo: full.productionOrderNo, productionOrderId: full.productionOrderId, handoverRecordStatus: 'WAIT_RECEIVE' } as never)
    // 仓库按路线发给染色厂，形成首次印染发料来源
    reserveTmfContinuousMaterial({ reservationId: 'DYE-RES', demandId: demand.id, lotId: lot, reservedMeters: 100, reason: '染色投入' }, planner, 'DYE:reserve')
    await m.issueTmfUpstreamMaterial({ issueId: 'DYE-FIRST', reservationId: 'DYE-RES', targetFactoryId: dyeFactoryId, dispatchedMeters: 100 }, warehouse, 'DYE:issue')
    const first = getTmfPurchaseState().processingIssues.find((item) => item.id === 'DYE-FIRST')!
    assert.equal(first.upstream!.orderId, dyeOrderId)
    // 染色实际交出100米按需求分配；合计不得超交出量
    await assert.rejects(m.allocateTmfDyeHandover({ orderId: dyeOrderId, recordId: 'DYE-DIRECT-REC', lines: [{ issueId: 'DYE-IN', demandId: demand.id, sourceIssueId: 'DYE-FIRST', meters: 101 }] }, planner, 'DYE:allocate-over'), /超过染色实际交出量/)
    await m.allocateTmfDyeHandover({ orderId: dyeOrderId, recordId: 'DYE-DIRECT-REC', lines: [{ issueId: 'DYE-IN', demandId: demand.id, sourceIssueId: 'DYE-FIRST', meters: 100 }] }, planner, 'DYE:allocate')
    await assert.rejects(m.allocateTmfDyeHandover({ orderId: dyeOrderId, recordId: 'DYE-DIRECT-REC', lines: [{ issueId: 'DYE-IN-2', demandId: demand.id, sourceIssueId: 'DYE-FIRST', meters: 1 }] }, planner, 'DYE:allocate-again'), /超过染色实际交出量/)
    const allocation = getTmfPurchaseState().processingIssues.find((item) => item.id === 'DYE-IN')!
    assert.equal(allocation.dyeHandover!.sourceIssueId, 'DYE-FIRST')
    assert.equal(allocation.targetRouteEntryId, 'CUT')
    assert.equal(getTmfProcessingInputBalance('DYE-IN').receivedMeters, 0)
    await m.receiveTmfDyeMaterial({ issueId: 'DYE-IN', materialSkuId: 'WB30-CBL01', receivedMeters: 60 }, factory, 'DYE:receive')
    await m.receiveTmfDyeMaterial({ issueId: 'DYE-IN', materialSkuId: 'WB30-CBL01', receivedMeters: 60 }, factory, 'DYE:receive')
    assert.equal(getTmfProcessingInputBalance('DYE-IN').receivedMeters, 60)
    await assert.rejects(m.receiveTmfDyeMaterial({ issueId: 'DYE-IN', materialSkuId: 'WB30-CBL01', receivedMeters: 41 }, factory, 'DYE:receive-over'), /超过/)
    // 截断、余料退回、回仓、领料实收均基于染色实际交出分配，不重复扣料
    reportTmfCutOutput({ outputId: 'DYE-OUT', issueId: 'DYE-IN', cutPieces: 100, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '' }, factory, 'DYE:cut')
    assert.equal(getTmfProcessingInputBalance('DYE-IN').remainingMeters, 10)
    dispatchTmfContinuousReturn({ returnId: 'DYE-RET', issueId: 'DYE-IN', batchId: 'DYE-RET-BATCH', returnedMeters: 10, reason: '未用连续料退回' }, factory, 'DYE:return')
    receiveTmfContinuousReturn({ returnId: 'DYE-RET', warehouseId: p.targetWarehouseId, materialSkuId: 'WB30-CBL01', location: 'D-01', receivedMeters: 10 }, warehouse, 'DYE:return-receive')
    packTmfOutput({ packageId: 'DYE-PKG', cutOutputId: 'DYE-OUT', pieces: 100 }, factory, 'DYE:pack')
    dispatchTmfOutputPackage({ handoverId: 'DYE-HANDOVER', packageId: 'DYE-PKG', warehouseId: p.targetWarehouseId }, factory, 'DYE:handover')
    receiveTmfOutputPackage({ handoverId: 'DYE-HANDOVER', packageId: 'DYE-PKG', warehouseId: p.targetWarehouseId, demandId: demand.id, location: 'D-02', receivedPieces: 100 }, warehouse, 'DYE:wh-receive')
    allocateTmfOutputPackage({ allocationId: 'DYE-ALLOC', packageId: 'DYE-PKG', demandId: demand.id, pieces: 100, receiverId: productionReceiver.id, receiverOrganizationId: 'DYE-PROD-ORG' }, planner, 'DYE:alloc-out')
    issueTmfProductionPackage({ issueId: 'DYE-PI', allocationId: 'DYE-ALLOC', packageId: 'DYE-PKG', demandId: demand.id, warehouseId: p.targetWarehouseId, pieces: 100 }, warehouse, 'DYE:issue-prod')
    receiveTmfProductionPackage({ issueId: 'DYE-PI', packageId: 'DYE-PKG', demandId: demand.id, receiverOrganizationId: 'DYE-PROD-ORG', pieces: 100 }, productionReceiver, 'DYE:receive-prod')
    assert.equal(getTmfProductionDemandFulfillment(demand.id).status, '已满足')
  } finally {
    dyeing.restoreDyeProcessMutationState(original)
  }
})

test('采购追加：未开始同步计划，已执行保留原计划和实物并处理变更', () => {
  const order = purchase('B23', 1000)
  createTmfMaterialPurchase(order, buyer, 'B23:create')
  advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo, '已采购', PMS_BUYER_ACTOR)
  generateTmfBaseOrder(order.purchaseOrderNo, factory, 'B23:base')
  reviseTmfMaterialPurchase(order.purchaseOrderNo, { orderedQty: 1100, reason: '追加基础备货', confirmed: true }, buyer, 'B23:change')
  let base = getTmfPurchaseState().baseOrders.find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!
  assert.equal(base.plannedMeters, 1100)
  assert.equal(base.purchaseVersion, 2)
  acceptTmfBaseOrder(base.id, factory, 'B23:accept')
  reportTmfBaseProduction(base.id, 400, factory, 'B23:produce')
  reviseTmfMaterialPurchase(order.purchaseOrderNo, { orderedQty: 1200, reason: '生产后追加，需主管处理', confirmed: true }, buyer, 'B24:change')
  base = getTmfPurchaseState().baseOrders.find((item) => item.id === base.id)!
  assert.equal(base.plannedMeters, 1100)
  assert.equal(base.producedMeters, 400)
  assert.equal(base.purchaseVersion, 2)
  assert.equal(base.changePending, true)
  assert.throws(() => reportTmfBaseProduction(base.id, 100, factory, 'B24:blocked'), /采购变更/)
  assert.throws(() => resolveTmfBasePurchaseChange(base.id, { reason: '追加', confirmed: true }, warehouse, 'B24:wrong-role'), /当前角色/)
  resolveTmfBasePurchaseChange(base.id, { reason: '原400米保留，确认追加生产至1200米', confirmed: true }, factory, 'B24:resolve')
  reportTmfBaseProduction(base.id, 800, factory, 'B24:remainder')
  dispatchTmfBaseProduction({ baseOrderId: base.id, handoverId: `${order.purchaseOrderNo}:handover`, batchId: `${order.purchaseOrderNo}:batch`, dispatchedMeters: 1200 }, factory, 'B24:dispatch')
  receiveTmfBaseProduction(receipt(order, 1200), warehouse, 'B24:receipt')
  base = getTmfPurchaseState().baseOrders.find((item) => item.id === base.id)!
  assert.equal(base.planRevisions!.at(-1)!.beforeMeters, 1100)
  assert.equal(base.planRevisions!.at(-1)!.producedMetersAtChange, 400)
  assert.equal(base.producedMeters, 1200)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1200)
})

test('B21：保存失败不报成功、不留部分库存；成功后刷新读取同一采购和收货事实', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>()
  let failWrite = false
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { if (failWrite) throw new Error('quota'); storage.set(key, value) },
  } } })
  try {
    reloadTmfPurchaseRuntime()
    const order = purchase('B21', 1.001)
    prepare(order)
    const before = getTmfPurchaseState()
    failWrite = true
    assert.throws(() => receiveTmfBaseProduction(receipt(order, 1.001), warehouse, 'B21:receipt'), /本次未保存/)
    assert.deepEqual(getTmfPurchaseState(), before)
    failWrite = false
    receiveTmfBaseProduction(receipt(order, 1.001), warehouse, 'B21:receipt')
    reloadTmfPurchaseRuntime()
    receiveTmfBaseProduction(receipt(order, 1.001), warehouse, 'B21:receipt')
    assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1.001)
    assert.equal(getTmfPurchaseState().lots[0].onHandMeters, 1.001)
    assert.ok(storage.has(TMF_PURCHASE_STORAGE_KEY))
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
    reloadTmfPurchaseRuntime()
  }
})

test('采购→两种规格截断→拆包回仓→分配发料→生产实收：短收保留缺口，库存及采购不双记', () => {
  const order = purchase('ISSUE-FLOW', 1000)
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 1000), warehouse, 'ISSUE-FLOW:receipt')
  const source = productionSource('PROD-ISSUE')
  registerTmfProductionOrder(source, planner, 'PROD-ISSUE:generate')
  registerTmfProductionOrder(source, planner, 'PROD-ISSUE:generate-again')
  const demands = getTmfPurchaseState().demands.filter((item) => item.productionOrderId === source.productionOrderId)
  assert.deepEqual(demands.map((item) => item.theoreticalCutMeters), [200, 420])
  source.techPackSnapshot.processEntries[0].webbingSpecifications![0].cutLengthMm = 550
  assert.equal(demands[0].specification.cutLengthMm, 500)
  assert.throws(() => registerTmfProductionOrder(source, planner, 'PROD-ISSUE:changed'), /不同版本或数量/)
  const lotId = `${order.purchaseOrderNo}:batch`
  for (const [i, demand] of demands.entries()) {
    const qty = i === 0 ? 200 : 450
    reserveTmfContinuousMaterial({ reservationId: `RES-${i}`, demandId: demand.id, lotId, reservedMeters: qty, reason: '确认下料及本批试切余量，未使用部分退回' }, planner, `reserve-${i}`)
  }
  let lot = getTmfPurchaseState().lots.find((item) => item.id === lotId)!
  assert.equal(lot.onHandMeters, 1000)
  assert.equal(lot.reservedMeters, 650)
  for (const [i, qty] of [200, 450].entries()) {
    issueTmfContinuousMaterial({ issueId: `ISS-${i}`, reservationId: `RES-${i}`, targetFactoryId: 'FAC-TMF', dispatchedMeters: qty }, warehouse, `issue-${i}`)
  }
  lot = getTmfPurchaseState().lots.find((item) => item.id === lotId)!
  assert.equal(lot.onHandMeters, 350)
  assert.equal(lot.reservedMeters, 0)
  assert.equal(getTmfPurchaseState().processingIssues.reduce((sum, item) => sum + item.receivedMeters, 0), 0)
  receiveTmfProcessingMaterial({ issueId: 'ISS-0', factoryId: 'FAC-TMF', materialSkuId: 'WB30-WHT', receivedMeters: 200 }, factory, 'factory-receipt-0')
  receiveTmfProcessingMaterial({ issueId: 'ISS-1', factoryId: 'FAC-TMF', materialSkuId: 'WB30-WHT', receivedMeters: 448 }, factory, 'factory-receipt-1')
  assert.equal(getTmfPurchaseState().processingIssues.find((item) => item.id === 'ISS-1')!.dispatchedMeters, 450)
  const complete = { issueId: 'ISS-1', factoryId: 'FAC-TMF', materialSkuId: 'WB30-WHT', receivedMeters: 2 }
  receiveTmfProcessingMaterial(complete, factory, 'factory-receipt-rest')
  receiveTmfProcessingMaterial(complete, factory, 'factory-receipt-rest')
  assert.equal(getTmfPurchaseState().processingIssues.find((item) => item.id === 'ISS-1')!.receivedMeters, 450)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1000)
  const firstCut = { outputId: 'OUT-S', issueId: 'ISS-0', cutPieces: 400, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '' }
  reportTmfCutOutput(firstCut, factory, 'cut-S')
  reportTmfCutOutput(firstCut, factory, 'cut-S')
  reportTmfCutOutput({ outputId: 'OUT-M', issueId: 'ISS-1', cutPieces: 600, defectivePieces: 0, actualCutLengthMm: 700, actualFinishedLengthMm: 700, lossMeters: 2, reason: '本批试切及切口损耗2米' }, factory, 'cut-M')
  assert.deepEqual(getTmfProcessingInputBalance('ISS-1'), { receivedMeters: 450, cutEquivalentMeters: 420, lossMeters: 2, returnedMeters: 0, returnReceivedMeters: 0, returnTransitMeters: 0, remainingMeters: 28 })
  assert.equal(getTmfPurchaseState().cutOutputs.filter((output) => ['OUT-S', 'OUT-M'].includes(output.id)).reduce((sum, output) => sum + output.goodPieces, 0), 1000)
  assert.equal(getTmfPurchaseState().cutOutputs.find((output) => output.id === 'OUT-M')!.materialSkuId, 'WB30-WHT')
  const grouped = projectTmfWorkOrders(getTmfPurchaseState()).filter(item => item.productionOrderId === 'PROD-ISSUE')
  assert.equal(grouped.length, 1, '同一生产快照及工艺节点的两规格归一张加工单')
  assert.equal(grouped[0].demands.length, 2)
  assert.equal(grouped[0].processingStatus, '合格产出达量')
  const mismatched = getTmfPurchaseState()
  mismatched.cutOutputs.find(item => item.id === 'OUT-S')!.goodPieces = 410
  mismatched.cutOutputs.find(item => item.id === 'OUT-M')!.goodPieces = 590
  const mismatchView = projectTmfWorkOrders(mismatched).find(item => item.id === grouped[0].id)!
  assert.equal(mismatchView.processingStatus, '加工中', '合计1000不能用短规格多10抵长规格少10')
  assert.equal(mismatchView.id, grouped[0].id, '数量变化不改变加工单身份')
  const after = getTmfPurchaseState()
  assert.throws(() => reportTmfCutOutput({ ...firstCut, outputId: 'OUT-EXTRA', cutPieces: 1 }, factory, 'cut-over'), /超过本批实际接收量/)
  assert.deepEqual(getTmfPurchaseState(), after)
  const returned = { returnId: 'RET-M', issueId: 'ISS-1', batchId: 'RET-BATCH-M', returnedMeters: 28, reason: '本批未截断连续余料回仓' }
  assert.throws(() => dispatchTmfContinuousReturn({ ...returned, issueId: 'OUT-M' }, factory, 'return-output'), /条料产出不能/)
  assert.throws(() => dispatchTmfContinuousReturn({ ...returned, returnedMeters: 29 }, factory, 'return-over'), /超过工厂剩余/)
  dispatchTmfContinuousReturn(returned, factory, 'return-dispatch')
  dispatchTmfContinuousReturn(returned, factory, 'return-dispatch')
  assert.equal(getTmfProcessingInputBalance('ISS-1').remainingMeters, 0)
  assert.equal(getTmfProcessingInputBalance('ISS-1').returnTransitMeters, 28)
  assert.equal(getTmfPurchaseState().lots.find((item) => item.id === lotId)!.onHandMeters, 350)
  assert.throws(() => reportTmfCutOutput({ ...firstCut, issueId: 'ISS-1', outputId: 'AFTER-RETURN', cutPieces: 1 }, factory, 'cut-after-return'), /已退物料不能加工/)
  const receiveReturn = { returnId: 'RET-M', warehouseId: order.targetWarehouseId, materialSkuId: order.materialSkuId, location: 'A-02', receivedMeters: 27 }
  receiveTmfContinuousReturn(receiveReturn, warehouse, 'return-receive-27')
  assert.equal(getTmfProcessingInputBalance('ISS-1').returnTransitMeters, 1)
  const beforeInvalid = getTmfPurchaseState()
  assert.throws(() => receiveTmfContinuousReturn({ ...receiveReturn, receivedMeters: 2 }, warehouse, 'return-receive-over'), /超过工厂/)
  assert.deepEqual(getTmfPurchaseState(), beforeInvalid)
  receiveTmfContinuousReturn({ ...receiveReturn, receivedMeters: 1 }, warehouse, 'return-receive-1')
  receiveTmfContinuousReturn({ ...receiveReturn, receivedMeters: 1 }, warehouse, 'return-receive-1')
  assert.equal(getTmfPurchaseState().lots.find((item) => item.id === 'RET-BATCH-M')!.onHandMeters, 28)
  assert.equal(getTmfPurchaseState().lots.find((item) => item.id === 'RET-BATCH-M')!.receiptKind, 'PROCESS_RETURN')
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1000)
  assert.deepEqual(getTmfProcessingInputBalance('ISS-1'), { receivedMeters: 450, cutEquivalentMeters: 420, lossMeters: 2, returnedMeters: 28, returnReceivedMeters: 28, returnTransitMeters: 0, remainingMeters: 0 })
  packTmfOutput({ packageId: 'PKG-S', cutOutputId: 'OUT-S', pieces: 400 }, factory, 'pack-S')
  packTmfOutput({ packageId: 'PKG-M', cutOutputId: 'OUT-M', pieces: 600 }, factory, 'pack-M')
  assert.throws(() => packTmfOutput({ packageId: 'PKG-EXTRA', cutOutputId: 'OUT-S', pieces: 1 }, factory, 'pack-extra'), /超过/)
  assert.throws(() => splitTmfOutputPackage('PKG-S', [{ id: 'P1', pieces: 200 }, { id: 'P2', pieces: 201 }], factory, 'split-over'), /之和/)
  const labelInput={documentType:'TMF_PACKAGE_LABEL' as const,sourceType:'TMF_OUTPUT_PACKAGE' as const,sourceId:JSON.stringify(['PKG-S','PKG-M'])}
  const beforeLabels=JSON.stringify(getTmfPurchaseState())
  const labels=buildTmfPackageLabelsPrintDocument(labelInput)
  assert.equal(labels.totalCopies,2)
  assert.equal(labels.labelItems![0].labelTitle,'成品 500mm · 400 条')
  assert.equal(labels.labelItems![1].labelTitle,'成品 700mm · 600 条')
  assert.equal(labels.barcodes[0].value,'PKG-S')
  for(const invalid of ['[]','["PKG-S","PKG-S"]','["PKG-S","missing"]','PKG-S']) assert.throws(()=>buildTmfPackageLabelsPrintDocument({...labelInput,sourceId:invalid}))
  assert.equal(JSON.stringify(getTmfPurchaseState()),beforeLabels)
  splitTmfOutputPackage('PKG-S', [{ id: 'PKG-S1', pieces: 100 }, { id: 'PKG-S2', pieces: 300 }], factory, 'split-S')
  assert.throws(()=>buildTmfPackageLabelsPrintDocument(labelInput),/已拆分/)
  const childLabels=buildTmfPackageLabelsPrintDocument({...labelInput,sourceId:JSON.stringify(['PKG-S1','PKG-S2'])})
  assert.equal(childLabels.totalCopies,2)
  assert.equal(childLabels.labelItems![0].labelTitle,'成品 500mm · 100 条')
  assert.throws(() => dispatchTmfOutputPackage({ handoverId: 'H-S', packageId: 'PKG-S', warehouseId: order.targetWarehouseId }, factory, 'old-package'), /已拆分/)
  for (const packageId of ['PKG-S1', 'PKG-S2', 'PKG-M']) {
    const dispatch = { handoverId: `H-${packageId}`, packageId, warehouseId: order.targetWarehouseId }
    dispatchTmfOutputPackage(dispatch, factory, `dispatch-${packageId}`)
    dispatchTmfOutputPackage(dispatch, factory, `dispatch-${packageId}`)
    assert.throws(() => dispatchTmfOutputPackage(dispatch, factory, `duplicate-${packageId}`), /已经交出/)
  }
  const receiveOutput = { handoverId: 'H-PKG-S1', packageId: 'PKG-S1', warehouseId: order.targetWarehouseId, demandId: demands[0].id, location: 'OUTPUT-01', receivedPieces: 90 }
  const scan = readTmfOutputReceiptScan('PKG-S1', order.targetWarehouseId)
  assert.equal(scan.remaining, 100)
  assert.equal(readTmfOutputReceiptScan(childLabels.labelItems![0].qrCode!.value, order.targetWarehouseId).pkg.id, 'PKG-S1')
  assert.throws(() => readTmfOutputReceiptScan('PKG-S', order.targetWarehouseId), /已拆分/)
  assert.throws(() => readTmfOutputReceiptScan('PKG-S1', 'WRONG'), /不属于/)
  assert.throws(() => readTmfOutputReceiptScan(JSON.stringify({ sourceType: 'MATERIAL', sourceId: 'PKG-S1' }), order.targetWarehouseId), /不是织带/)
  assert.throws(() => readTmfOutputReceiptScan(JSON.stringify({ sourceType: 'TMF_OUTPUT_PACKAGE', sourceId: 'PKG-S1', packageId: 'PKG-M' }), order.targetWarehouseId), /不符/)
  const beforeWrong = getTmfPurchaseState()
  assert.throws(() => receiveTmfOutputPackage({ ...receiveOutput, demandId: demands[1].id }, warehouse, 'wrong-spec-receipt'), /生产需求/)
  assert.deepEqual(getTmfPurchaseState(), beforeWrong)
  receiveTmfOutputPackage(receiveOutput, warehouse, 'output-receive-90')
  receiveTmfOutputPackage(receiveOutput, warehouse, 'output-receive-90')
  assert.equal(getTmfPurchaseState().outputHandovers.find((item) => item.id === receiveOutput.handoverId)!.receivedPieces, 90)
  assert.throws(() => moveTmfOutputPackage({packageId:'PKG-S1',warehouseId:order.targetWarehouseId,fromLocation:'OUTPUT-01',toLocation:'OUTPUT-02',reason:'整理'},warehouse,'move-partial'), /部分实收/)
  assert.throws(() => splitTmfOutputPackage('PKG-S1', [{ id: 'P1', pieces: 40 }, { id: 'P2', pieces: 60 }], { ...warehouse, role: '仓库主管' }, 'split-transit'), /在途/)
  assert.throws(() => receiveTmfOutputPackage({ ...receiveOutput, receivedPieces: 11 }, warehouse, 'over-output-receipt'), /超过/)
  const beforeStaleReceipt = getTmfPurchaseState()
  assert.throws(() => receiveTmfOutputPackage({ ...receiveOutput, receivedPieces: 5, expectedReceivedPieces: scan.handover.receivedPieces }, warehouse, 'output-stale-scan'), /重新扫描/)
  assert.deepEqual(getTmfPurchaseState(), beforeStaleReceipt)
  const rescanned = readTmfOutputReceiptScan(JSON.stringify({ sourceType: 'TMF_OUTPUT_HANDOVER', sourceId: 'H-PKG-S1' }), order.targetWarehouseId)
  assert.equal(rescanned.remaining, 10)
  const remainder = { ...receiveOutput, receivedPieces: 10, expectedReceivedPieces: rescanned.handover.receivedPieces }
  receiveTmfOutputPackage(remainder, warehouse, 'output-receive-rest')
  receiveTmfOutputPackage(remainder, warehouse, 'output-receive-rest')
  assert.throws(() => readTmfOutputReceiptScan('PKG-S1', order.targetWarehouseId), /已收齐/)
  splitTmfOutputPackage('PKG-S1', [{ id: 'PKG-40', pieces: 40 }, { id: 'PKG-60', pieces: 60 }], { ...warehouse, role: '仓库主管' }, 'split-warehouse')
  const historicalPrint=buildTmfHandoverPrintDocument({documentType:'TMF_HANDOVER_SHEET',sourceType:'TMF_OUTPUT_HANDOVER',sourceId:'H-PKG-S1'})
  assert.deepEqual(historicalPrint.tables[0].rows,[['PKG-S1','100 条','100 条','0 条']])
  const splitWork=projectTmfWorkOrders(getTmfPurchaseState()).find(w=>w.productionOrderId===source.productionOrderId)!
  assert.equal(splitWork.handovers.reduce((n,h)=>n+h.dispatchedPieces,0),1000)
  assert.equal(splitWork.handoverStatus,'合格产出已交出')
  assert.ok(historicalPrint.sections[0].fields.some(f=>f.value.includes('已拆分失效')))
  assert.throws(()=>buildTmfPackageLabelsPrintDocument({...labelInput,sourceId:JSON.stringify(['PKG-S1'])}),/已拆分/)
  assert.throws(() => receiveTmfOutputPackage({ ...receiveOutput, receivedPieces: 1 }, warehouse, 'receive-invalid-parent'), /包号/)
  const activePackages = getTmfPurchaseState().packages.filter((item) => !item.splitAt)
  assert.equal(activePackages.reduce((sum, item) => sum + item.pieces, 0), 1000)
  assert.equal(activePackages.reduce((sum, item) => sum + (item.receivedPieces ?? 0), 0), 100)
  assert.deepEqual(activePackages.filter((item) => item.receivedPieces).map((item) => item.actualFinishedLengthMm), [500, 500])
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1000)
  assert.equal(getTmfPurchaseState().lots.reduce((sum, item) => sum + item.onHandMeters, 0), 378)
  for (const [packageId, pieces, demandId] of [['PKG-S2', 300, demands[0].id], ['PKG-M', 600, demands[1].id]] as const) {
    receiveTmfOutputPackage({ ...receiveOutput, handoverId: `H-${packageId}`, packageId, demandId, receivedPieces: pieces }, warehouse, `receive-${packageId}`)
  }
  const allocate = { allocationId: 'ALLOC-WRONG', packageId: 'PKG-M', demandId: demands[0].id, pieces: 1,
    receiverId: productionReceiver.id, receiverOrganizationId: 'PRODUCTION-01' }
  const beforeWrongAllocation = getTmfPurchaseState()
  assert.throws(() => allocateTmfOutputPackage(allocate, planner, 'allocate-wrong-size'), /不能混用/)
  assert.deepEqual(getTmfPurchaseState(), beforeWrongAllocation)
  for (const pkg of getTmfPurchaseState().packages.filter((item) => !item.splitAt)) {
    allocateTmfOutputPackage({ ...allocate, allocationId: `ALLOC-${pkg.id}`, packageId: pkg.id, demandId: pkg.demandId, pieces: pkg.pieces }, planner, `allocate-${pkg.id}`)
    assert.equal(getTmfOutputPackageBalance(pkg.id).onHandPieces, pkg.pieces)
    assert.equal(getTmfOutputPackageBalance(pkg.id).availablePieces, 0)
  }
  assert.throws(() => allocateTmfOutputPackage({ ...allocate, demandId: demands[1].id }, planner, 'allocate-over'), /可分配 0/)
  assert.throws(() => splitTmfOutputPackage('PKG-40', [{ id: 'COPY1', pieces: 20 }, { id: 'COPY2', pieces: 20 }], { ...warehouse, role: '仓库主管' }, 'split-reserved'), /已分配/)
  const move = {packageId:'PKG-40',warehouseId:order.targetWarehouseId,fromLocation:'OUTPUT-01',toLocation:'OUTPUT-02',reason:'同规格集中存放'}
  const balanceBeforeMove = getTmfOutputPackageBalance('PKG-40')
  const beforeInvalidMove = getTmfPurchaseState()
  assert.throws(() => moveTmfOutputPackage({...move,warehouseId:'WRONG'},warehouse,'move-wrong-warehouse'), /仓库/)
  assert.throws(() => moveTmfOutputPackage({...move,fromLocation:'OLD'},warehouse,'move-stale-location'), /原库位/)
  assert.throws(() => moveTmfOutputPackage({...move,toLocation:'OUTPUT-01'},warehouse,'move-same'), /不同/)
  assert.deepEqual(getTmfPurchaseState(),beforeInvalidMove)
  moveTmfOutputPackage(move,warehouse,'move-output')
  moveTmfOutputPackage(move,warehouse,'move-output')
  assert.equal(getTmfPurchaseState().packages.find(p=>p.id==='PKG-40')!.location,'OUTPUT-02')
  assert.deepEqual(getTmfOutputPackageBalance('PKG-40'),balanceBeforeMove)
  releaseTmfOutputAllocation('ALLOC-PKG-40', 10, '调整领料批次', planner, 'release-output-10')
  assert.equal(getTmfOutputPackageBalance('PKG-40').availablePieces, 10)
  allocateTmfOutputPackage({ ...allocate, allocationId: 'ALLOC-REST', packageId: 'PKG-40', demandId: demands[0].id, pieces: 10 }, planner, 'allocate-rest')
  changeTmfProductionControl({ productionOrderId: source.productionOrderId, status: 'ON_HOLD', reason: '生产暂缓领料', confirmed: true }, planner, 'hold-production')
  assert.equal(getTmfProductionDemandFulfillment(demands[0].id).status, '已暂停')
  assert.equal(getTmfOutputPackageBalance('PKG-40').onHandPieces, 40)
  assert.equal(getTmfOutputPackageBalance('PKG-40').availablePieces, 0)
  assert.throws(() => issueTmfProductionPackage({ issueId: 'HOLD-ISS', allocationId: 'ALLOC-REST', packageId: 'PKG-40', demandId: demands[0].id, warehouseId: order.targetWarehouseId, pieces: 10 }, warehouse, 'blocked-hold-issue'), /已暂停/)
  changeTmfProductionControl({ productionOrderId: source.productionOrderId, status: 'ACTIVE', reason: '生产恢复，沿用原分配', confirmed: true }, planner, 'resume-production')
  for (const allocation of getTmfPurchaseState().outputAllocations) {
    const input = { issueId: `FINAL-${allocation.id}`, allocationId: allocation.id, packageId: allocation.packageId,
      demandId: allocation.demandId, warehouseId: order.targetWarehouseId, pieces: allocation.allocatedPieces - allocation.releasedPieces }
    assert.throws(() => issueTmfProductionPackage({ ...input, packageId: 'WB30-WHT' }, warehouse, `sku-${allocation.id}`), /包号/)
    issueTmfProductionPackage(input, warehouse, `issue-${allocation.id}`)
    issueTmfProductionPackage(input, warehouse, `issue-${allocation.id}`)
    assert.throws(() => issueTmfProductionPackage({ ...input, issueId: `OVER-${allocation.id}`, pieces: 1 }, warehouse, `issue-over-${allocation.id}`), /超过剩余/)
  }
  assert.equal(getTmfProductionDemandFulfillment(demands[0].id).receivedPieces, 0)
  assert.equal(getTmfProductionDemandFulfillment(demands[1].id).shortagePieces, 600)
  assert.throws(() => releaseTmfOutputAllocation('ALLOC-PKG-40', 1, '不能释放已发实物', planner, 'release-issued'), /尚未发出/)
  for (const issue of getTmfPurchaseState().productionIssues) {
    const receipt = { issueId: issue.id, packageId: issue.packageId, demandId: issue.demandId,
      receiverOrganizationId: issue.receiverOrganizationId, pieces: issue.dispatchedPieces - (issue.packageId === 'PKG-M' ? 10 : 0) }
    const beforeWrongReceiver = getTmfPurchaseState()
    assert.throws(() => receiveTmfProductionPackage(receipt, { ...productionReceiver, id: 'OTHER' }, `wrong-person-${issue.id}`), /接收人/)
    assert.deepEqual(getTmfPurchaseState(), beforeWrongReceiver)
    receiveTmfProductionPackage(receipt, productionReceiver, `receive-${issue.id}`)
    receiveTmfProductionPackage(receipt, productionReceiver, `receive-${issue.id}`)
  }
  assert.equal(getTmfProductionDemandFulfillment(demands[0].id).status, '已满足')
  assert.deepEqual(getTmfProductionDemandFulfillment(demands[1].id), { requiredPieces: 600, dispatchedPieces: 600, receivedPieces: 590, transitPieces: 10, shortagePieces: 10, status: '部分满足' })
  assert.equal(getTmfOutputPackageBalance('PKG-M').onHandPieces, 0)
  const finalReceipt = { issueId: 'FINAL-ALLOC-PKG-M', packageId: 'PKG-M', demandId: demands[1].id, receiverOrganizationId: 'PRODUCTION-01', pieces: 10 }
  assert.throws(() => receiveTmfProductionPackage({ ...finalReceipt, pieces: 11 }, productionReceiver, 'final-over'), /超过此发料单/)
  receiveTmfProductionPackage(finalReceipt, productionReceiver, 'final-rest')
  assert.equal(getTmfProductionDemandFulfillment(demands[1].id).status, '已满足')
  for (const pkg of getTmfPurchaseState().packages.filter((item) => !item.splitAt)) {
    const balance = getTmfOutputPackageBalance(pkg.id)
    assert.equal(balance.onHandPieces, 0)
    assert.equal(balance.reservedPieces, 0)
    assert.equal(balance.productionTransitPieces, 0)
    assert.equal(balance.productionReceivedPieces, pkg.pieces)
  }
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1000)
  assert.equal(getTmfPurchaseState().lots.reduce((sum, item) => sum + item.onHandMeters, 0), 378)
})

test('B09：其他需求占用400米时不能再占650；释放50后恢复，错误发料不改变库存', () => {
  const order = purchase('B09-ALLOC', 1000)
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 1000), warehouse, 'B09-ALLOC:receipt')
  const main = productionSource('B09-MAIN')
  const other = productionSource('B09-OTHER')
  registerTmfProductionOrder(main, planner, 'B09:main')
  registerTmfProductionOrder(other, planner, 'B09:other')
  const demands = getTmfPurchaseState().demands
  const lotId = `${order.purchaseOrderNo}:batch`
  const otherDemand = demands.find((item) => item.productionOrderId === 'B09-OTHER')!
  const mainDemand = demands.find((item) => item.productionOrderId === 'B09-MAIN')!
  reserveTmfContinuousMaterial({ reservationId: 'B09:other-res', demandId: otherDemand.id, lotId, reservedMeters: 400, reason: '已确认安排量' }, planner, 'B09:reserve-other')
  const input = { reservationId: 'B09:main-res', demandId: mainDemand.id, lotId, reservedMeters: 650, reason: '确认加工安排量' }
  const before = getTmfPurchaseState()
  assert.throws(() => reserveTmfContinuousMaterial(input, planner, 'B09:attempt'), /缺 50 米/)
  assert.deepEqual(getTmfPurchaseState(), before)
  releaseTmfContinuousReservation('B09:other-res', 50, '原需求确认释放50米', planner, 'B09:release')
  reserveTmfContinuousMaterial(input, planner, 'B09:attempt')
  const reserved = getTmfPurchaseState()
  assert.equal(reserved.lots.find((item) => item.id === lotId)!.reservedMeters, 1000)
  assert.throws(() => issueTmfContinuousMaterial({ issueId: 'B09:issue', reservationId: 'B09:main-res', targetFactoryId: 'FAC-SPF', dispatchedMeters: 650 }, warehouse, 'B09:wrong-factory'), /正确加工厂/)
  assert.deepEqual(getTmfPurchaseState(), reserved)
})

test('需求来源：同尺码不同成衣SKU分别保留，BOM适用范围生效，错误快照和重复工序阻断', () => {
  const source = productionSource('PROJ')
  assert.throws(() => deriveTmfProductionDemands({ ...source, status: 'CANCELLED' }), /状态不能生成/)
  const wrongBom = structuredClone(source)
  wrongBom.techPackSnapshot.bomItems[0].materialSkuId = 'WRONG-SKU'
  assert.throws(() => deriveTmfProductionDemands(wrongBom), /首道投入 SKU 不一致/)
  source.demandSnapshot.skuLines.push({ skuCode: 'PROJ-S-BLUE', size: 'S', color: '蓝', qty: 20 })
  assert.deepEqual(deriveTmfProductionDemands(source).map((item) => item.requiredPieces), [400, 20, 600])
  source.techPackSnapshot.bomItems[0].applicableSkuCodes = ['PROJ-S', 'PROJ-M']
  assert.equal(deriveTmfProductionDemands(source).length, 2)
  const duplicate = structuredClone(source.techPackSnapshot.processEntries[0])
  duplicate.id = 'CUT-OTHER'
  source.techPackSnapshot.processEntries.push(duplicate)
  assert.throws(() => deriveTmfProductionDemands(source), /重复截断/)
  source.techPackSnapshot.productionOrderId = 'WRONG'
  assert.throws(() => deriveTmfProductionDemands(source), /有效的已发布/)
})

test('待打头条料不计合格产出；超公差实物记不良且照实扣下料当量，未实收不可截断', () => {
  const purchaseOrder = purchase('TIP-WIP', 220)
  prepare(purchaseOrder)
  receiveTmfBaseProduction(receipt(purchaseOrder, 220), warehouse, 'TIP-WIP:receipt')
  const source = productionSource('TIP-PROD')
  const cut = source.techPackSnapshot.processEntries[0]
  cut.webbingSpecifications = [cut.webbingSpecifications![0]]
  const spec = cut.webbingSpecifications[0]
  spec.tippingRequired = true
  spec.endA = { method: 'METAL', specification: '银色M4，20mm', materialBomItemId: 'BOM-METAL', materialUnit: '个' }
  spec.endB = structuredClone(spec.endA)
  cut.outputInventoryForm = 'CUT_PIECES'
  source.techPackSnapshot.processEntries.push({ ...structuredClone(cut), id: 'TIP', processCode: 'WEBBING_TIP', processName: '打头', inputInventoryForm: 'CUT_PIECES', outputInventoryForm: 'FINISHED_PIECES', predecessorEntryIds: ['CUT'] })
  registerTmfProductionOrder(source, planner, 'TIP-PROD:generate')
  const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === source.productionOrderId)!
  reserveTmfContinuousMaterial({ reservationId: 'TIP-RES', demandId: demand.id, lotId: `${purchaseOrder.purchaseOrderNo}:batch`, reservedMeters: 210, reason: '确认试切余量' }, planner, 'TIP:reserve')
  issueTmfContinuousMaterial({ issueId: 'TIP-ISS', reservationId: 'TIP-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 210 }, warehouse, 'TIP:issue')
  const input = { outputId: 'TIP-OUT', issueId: 'TIP-ISS', cutPieces: 390, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: null, lossMeters: 0, reason: '' }
  assert.throws(() => reportTmfCutOutput(input, factory, 'TIP:cut'), /实际接收量/)
  receiveTmfProcessingMaterial({ issueId: 'TIP-ISS', factoryId: 'FAC-TMF', materialSkuId: 'WB30-WHT', receivedMeters: 210 }, factory, 'TIP:receive')
  assert.throws(() => reportTmfCutOutput({ ...input, actualFinishedLengthMm: 520 }, factory, 'TIP:premature-finish'), /尚未打头/)
  reportTmfCutOutput(input, factory, 'TIP:cut')
  reportTmfCutOutput({ ...input, outputId: 'TIP-BAD', cutPieces: 10, actualCutLengthMm: 550, reason: '截断长度做错，隔离待处理' }, factory, 'TIP:bad-cut')
  const outputs = getTmfPurchaseState().cutOutputs.filter((item) => item.sourceIssueId === 'TIP-ISS')
  assert.deepEqual(outputs.map((item) => [item.goodPieces, item.pendingTipPieces, item.defectivePieces]), [[0, 390, 0], [0, 0, 10]])
  assert.equal(outputs[1].actualCutLengthMm, 550)
  assert.equal(outputs[1].specification.cutLengthMm, 500)
  assert.deepEqual(getTmfProcessingInputBalance('TIP-ISS'), { receivedMeters: 210, cutEquivalentMeters: 200.5, lossMeters: 0, returnedMeters: 0, returnReceivedMeters: 0, returnTransitMeters: 0, remainingMeters: 9.5 })
  assert.equal(getPmsMaterialPurchaseOrder(purchaseOrder.purchaseOrderNo)!.receivedQty, 220)
  const beforeTipping = getTmfProcessingInputBalance('TIP-ISS')
  receiveTmfTipMaterialStock({id:'METAL-ISS-LOT',materialSkuId:'METAL-M4',warehouseId:'WH-ACCESSORY',location:'HEAD-A01',sourceReceiptNo:'METAL-ISS-RECEIPT',sourceReceiptLineId:'1',unit:'个',receivedQty:900},warehouse,'METAL-ISS:warehouse-receipt')
  dispatchTmfTipMaterial({ stockLotId:'METAL-ISS-LOT', id: 'METAL-ISS', demandId: demand.id, materialBomItemId: 'BOM-METAL', materialSkuId: 'METAL-M4', sourceDocumentNo: 'Mock-头件仓发料-001', unit: '个', dispatchedQty: 800 }, warehouse, 'METAL:dispatch')
  const issued = getTmfPurchaseState()
  assert.equal(issued.tipMaterialLots.find(l=>l.id==='METAL-ISS-LOT')!.onHandQty,100)
  const dispatch = {stockLotId:'METAL-ISS-LOT',id:'METAL-EXTRA',demandId:demand.id,materialBomItemId:'BOM-METAL',materialSkuId:'METAL-M4',sourceDocumentNo:'HEAD-EXTRA',unit:'个' as const,dispatchedQty:101}
  assert.throws(()=>dispatchTmfTipMaterial(dispatch,warehouse,'HEAD:overstock'),/库存不足/)
  assert.throws(()=>dispatchTmfTipMaterial({...dispatch,stockLotId:'MISSING'},warehouse,'HEAD:missing'),/批次不存在/)
  assert.throws(()=>dispatchTmfTipMaterial({...dispatch,materialSkuId:'WRONG'},warehouse,'HEAD:wrong-sku'),/SKU/)
  assert.throws(()=>dispatchTmfTipMaterial({...dispatch,unit:'kg'},warehouse,'HEAD:wrong-unit'),/单位/)
  assert.throws(()=>receiveTmfTipMaterialStock({id:'DUPLICATE',materialSkuId:'METAL-M4',warehouseId:'WH-ACCESSORY',location:'HEAD-A01',sourceReceiptNo:'METAL-ISS-RECEIPT',sourceReceiptLineId:'1',unit:'个',receivedQty:900},warehouse,'HEAD:duplicate-receipt'),/已入账/)
  assert.deepEqual(getTmfPurchaseState(),issued)
  dispatchTmfTipMaterial({stockLotId:'METAL-ISS-LOT',id:'METAL-ISS',demandId:demand.id,materialBomItemId:'BOM-METAL',materialSkuId:'METAL-M4',sourceDocumentNo:'Mock-头件仓发料-001',unit:'个',dispatchedQty:800},warehouse,'METAL:dispatch')
  assert.deepEqual(getTmfPurchaseState(),issued)
  const tipInput = { id: 'TIP-RESULT', cutOutputId: 'TIP-OUT', pieces: 380, defectivePieces: 0, actualFinishedLengthMm: 500,
    endA: structuredClone(spec.endA), endB: structuredClone(spec.endB), materials: [{ issueId: 'METAL-ISS', usedQty: 760, scrapQty: 5 }], reason: '装头合格，另有5个损坏头件' }
  assert.throws(() => reportTmfTipping(tipInput, factory, 'METAL:report'), /超过本厂实收余额/)
  receiveTmfTipMaterial('METAL-ISS', 795, factory, 'METAL:receive')
  const beforeInvalidTipping = getTmfPurchaseState()
  assert.throws(() => reportTmfTipping({ ...tipInput, materials: [{ issueId: 'METAL-ISS', usedQty: 759, scrapQty: 5 }] }, factory, 'METAL:wrong-count'), /耗用应等于/)
  assert.deepEqual(getTmfPurchaseState(), beforeInvalidTipping)
  reportTmfTipping(tipInput, factory, 'METAL:report')
  reportTmfTipping(tipInput, factory, 'METAL:report')
  const wrongEnd = { method: 'PLASTIC_WRAP' as const, specification: '透明P4，20mm', materialBomItemId: 'BOM-PLASTIC', materialUnit: '个' as const }
  receiveTmfTipMaterialStock({id:'PLASTIC-ISS-LOT',materialSkuId:'PLASTIC-P4',warehouseId:'WH-ACCESSORY',location:'HEAD-A01',sourceReceiptNo:'PLASTIC-ISS-RECEIPT',sourceReceiptLineId:'1',unit:'个',receivedQty:20},warehouse,'PLASTIC-ISS:warehouse-receipt')
  dispatchTmfTipMaterial({ stockLotId:'PLASTIC-ISS-LOT', id: 'PLASTIC-ISS', demandId: demand.id, materialBomItemId: 'BOM-PLASTIC', materialSkuId: 'PLASTIC-P4', sourceDocumentNo: 'Mock-头件仓发料-002', unit: '个', dispatchedQty: 20 }, warehouse, 'PLASTIC:dispatch')
  receiveTmfTipMaterial('PLASTIC-ISS', 20, factory, 'PLASTIC:receive')
  reportTmfTipping({ ...tipInput, id: 'WRONG-TIP-RESULT', pieces: 10, endA: wrongEnd, endB: wrongEnd, materials: [{ issueId: 'PLASTIC-ISS', usedQty: 20, scrapQty: 0 }], reason: '误装塑料头，隔离不良' }, factory, 'PLASTIC:report')
  const finished = getTmfPurchaseState().cutOutputs.find((item) => item.id === 'TIP-OUT')!
  assert.equal(finished.goodPieces, 380)
  assert.equal(finished.pendingTipPieces, 0)
  assert.equal(finished.defectivePieces, 10)
  assert.equal(finished.cutPieces, finished.goodPieces + finished.pendingTipPieces + finished.defectivePieces)
  assert.equal(getTmfPurchaseState().tipResults.find((item) => item.id === 'WRONG-TIP-RESULT')!.goodPieces, 0)
  assert.equal(getTmfPurchaseState().tipMaterialIssues.find((item) => item.id === 'METAL-ISS')!.usedQty, 760)
  assert.equal(getTmfPurchaseState().tipMaterialIssues.find((item) => item.id === 'METAL-ISS')!.scrapQty, 5)
  assert.deepEqual(getTmfProcessingInputBalance('TIP-ISS'), beforeTipping)
  assert.throws(() => reportTmfTipping({ ...tipInput, id: 'DOUBLE-TIP', pieces: 1 }, factory, 'METAL:again'), /超过可用的待打头/)
  assert.throws(() => packTmfOutput({ packageId: 'METAL-PACK', cutOutputId: 'TIP-OUT', pieces: 380 }, factory, 'pack-missing-tip'), /具体打头批次/)
  assert.throws(() => packTmfOutput({ packageId: 'BAD-PACK', cutOutputId: 'TIP-OUT', tipResultId: 'WRONG-TIP-RESULT', pieces: 1 }, factory, 'pack-bad-tip'), /超过/)
  packTmfOutput({ packageId: 'METAL-PACK', cutOutputId: 'TIP-OUT', tipResultId: 'TIP-RESULT', pieces: 380 }, factory, 'pack-metal')
  const metalPackage = getTmfPurchaseState().packages.find((item) => item.id === 'METAL-PACK')!
  assert.equal(metalPackage.endA.method, 'METAL')
  assert.equal(metalPackage.endB.method, 'METAL')
  assert.equal(metalPackage.actualFinishedLengthMm, 500)
  assert.equal(metalPackage.materialSkuId, finished.materialSkuId)
  assert.throws(() => packTmfOutput({ packageId: 'EMPTY-TIP', cutOutputId: 'TIP-OUT', tipResultId: '', pieces: 1 }, factory, 'pack-empty-tip'), /不能为空/)
  const metalReturn={id:'METAL-UNUSED-RETURN',sourceIssueId:'METAL-ISS',quantity:30,reason:'未用金属头回来源仓'}
  assert.throws(()=>dispatchTmfTipMaterialReturn({...metalReturn,quantity:30.5},factory,'METAL:return-fraction'),/整数/)
  assert.throws(()=>dispatchTmfTipMaterialReturn({...metalReturn,quantity:31},factory,'METAL:return-over'),/超过本厂未使用/)
  dispatchTmfTipMaterialReturn(metalReturn,factory,'METAL:return')
  assert.equal(getTmfTipMaterialBalance('METAL-ISS').availableQty,0)
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='METAL-ISS-LOT')!.onHandQty,100)
  receiveTmfTipMaterialReturn({returnId:metalReturn.id,warehouseId:'WH-ACCESSORY',materialSkuId:'METAL-M4',unit:'个',quantity:30},warehouse,'METAL:return-receive')
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='METAL-ISS-LOT')!.onHandQty,130)
  // 900件原始入库 = 源仓130 + 工厂未收5 + 已装760 + 已损5。
  const metalState=getTmfPurchaseState(),metalLot=metalState.tipMaterialLots.find(l=>l.id==='METAL-ISS-LOT')!,metalIssue=metalState.tipMaterialIssues.find(i=>i.id==='METAL-ISS')!
  assert.equal(metalLot.onHandQty+(metalIssue.dispatchedQty-metalIssue.receivedQty)+metalIssue.usedQty+metalIssue.scrapQty+getTmfTipMaterialBalance(metalIssue.id).availableQty,metalLot.receivedQty)
  const beforeScrap=getTmfProcessingInputBalance('TIP-ISS'),beforeHeads=getTmfPurchaseState().tipMaterialIssues
  const badTip={id:'SCRAP-TIP',cutOutputId:'TIP-OUT',tipResultId:'WRONG-TIP-RESULT',pieces:10,expectedAvailablePieces:10,reason:'错装塑料头，实物报废',confirmed:true}
  assert.throws(()=>scrapTmfDefectiveOutput(badTip,warehouse,'SCRAP:role'),/当前角色/)
  assert.throws(()=>scrapTmfDefectiveOutput({...badTip,pieces:11},factory,'SCRAP:over'),/超过/)
  scrapTmfDefectiveOutput(badTip,factory,'SCRAP:tip');scrapTmfDefectiveOutput(badTip,factory,'SCRAP:tip')
  const badCut={id:'SCRAP-CUT-1',cutOutputId:'TIP-BAD',pieces:4,expectedAvailablePieces:10,reason:'错长度实物报废',confirmed:true}
  scrapTmfDefectiveOutput(badCut,factory,'SCRAP:cut1')
  assert.throws(()=>scrapTmfDefectiveOutput({...badCut,id:'SCRAP-CUT-2',pieces:6},factory,'SCRAP:stale'),/数量已变化/)
  scrapTmfDefectiveOutput({...badCut,id:'SCRAP-CUT-2',pieces:6,expectedAvailablePieces:6},factory,'SCRAP:cut2')
  assert.equal(getTmfDefectiveBalance('TIP-OUT','WRONG-TIP-RESULT').availablePieces,0)
  assert.equal(getTmfDefectiveBalance('TIP-BAD').availablePieces,0)
  assert.deepEqual(getTmfProcessingInputBalance('TIP-ISS'),beforeScrap)
  assert.deepEqual(getTmfPurchaseState().tipMaterialIssues,beforeHeads)
  // 补做20条：原厂内余料9.5米做19条，原仓另发0.5米做1条。
  reserveTmfContinuousMaterial({reservationId:'REMAKE-RES',demandId:demand.id,lotId:`${purchaseOrder.purchaseOrderNo}:batch`,reservedMeters:0.5,reason:'报废后补做'},planner,'REMAKE:reserve')
  issueTmfContinuousMaterial({issueId:'REMAKE-ISS',reservationId:'REMAKE-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:0.5},warehouse,'REMAKE:issue')
  receiveTmfProcessingMaterial({issueId:'REMAKE-ISS',factoryId:'FAC-TMF',materialSkuId:'WB30-WHT',receivedMeters:0.5},factory,'REMAKE:receive')
  dispatchTmfTipMaterial({stockLotId:'METAL-ISS-LOT',id:'REMAKE-HEAD',demandId:demand.id,materialBomItemId:'BOM-METAL',materialSkuId:'METAL-M4',sourceDocumentNo:'补做领头',unit:'个',dispatchedQty:40},warehouse,'REMAKE:headissue')
  receiveTmfTipMaterial('REMAKE-HEAD',40,factory,'REMAKE:headreceive')
  const packs=[{id:'METAL-PACK',qty:380}]
  for(const [i,qty] of [19,1].entries()){
   const id=`REMAKE-${i}`
   reportTmfCutOutput({...input,outputId:id,issueId:i?'REMAKE-ISS':'TIP-ISS',cutPieces:qty,reason:'报废后补做20条'},factory,id+':cut')
   reportTmfTipping({...tipInput,id,cutOutputId:id,pieces:qty,materials:[{issueId:'REMAKE-HEAD',usedQty:qty*2,scrapQty:0}],reason:'按正确金属头补做'},factory,id+':tip')
   packTmfOutput({packageId:id,cutOutputId:id,tipResultId:id,pieces:qty},factory,id+':pack');packs.push({id,qty})
  }
  receiveTmfTipMaterial('METAL-ISS',5,factory,'REMAKE:last-head-receive')
  dispatchTmfTipMaterialReturn({id:'LAST-HEAD-RETURN',sourceIssueId:'METAL-ISS',quantity:5,reason:'最后收到未用头件回仓'},factory,'REMAKE:last-head-return')
  receiveTmfTipMaterialReturn({returnId:'LAST-HEAD-RETURN',warehouseId:'WH-ACCESSORY',materialSkuId:'METAL-M4',unit:'个',quantity:5},warehouse,'REMAKE:last-head-wh')
  for(const {id,qty} of packs){
   dispatchTmfOutputPackage({handoverId:id,packageId:id,warehouseId:purchaseOrder.targetWarehouseId},factory,id+':dispatch')
   receiveTmfOutputPackage({handoverId:id,packageId:id,warehouseId:purchaseOrder.targetWarehouseId,demandId:demand.id,location:'FINAL-01',receivedPieces:qty},warehouse,id+':receive')
   allocateTmfOutputPackage({allocationId:id,packageId:id,demandId:demand.id,pieces:qty,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,id+':allocate')
   issueTmfProductionPackage({issueId:id,allocationId:id,packageId:id,demandId:demand.id,warehouseId:purchaseOrder.targetWarehouseId,pieces:qty},warehouse,id+':issue')
   receiveTmfProductionPackage({issueId:id,packageId:id,demandId:demand.id,receiverOrganizationId:'PRODUCTION-01',pieces:qty},productionReceiver,id+':prod-receive')
  }
  assert.equal(getTmfProductionDemandFulfillment(demand.id).status,'已满足')
  const final=getTmfProductionDisposition(source.productionOrderId)
  assert.equal(final.productionReceivedPieces,400);assert.equal(final.scrappedPieces,20);assert.equal(final.scrappedEquivalentMeters,10.5);assert.equal(final.pendingDefectivePieces,0);assert.equal(final.factoryPieces,0)
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===`${purchaseOrder.purchaseOrderNo}:batch`)!.onHandMeters,9.5)
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='METAL-ISS-LOT')!.onHandQty,95)


})

test('N04：采购100米→单端硅胶按kg实耗→回仓发料→生产实收50根，连续料剩34米', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json', import.meta.url), 'utf8'))
  const scenario = fixture.normalScenarios.find((item: { id: string }) => item.id === 'N04')
  const order = purchase('SILICONE', scenario.purchaseQuantityM, scenario.baseSku)
  order.accessoryType = '绳子'
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 100), warehouse, 'SILICONE:base-receipt')
  const source = productionSource('SILICONE-PROD')
  source.techPackSnapshot.bomItems[0].materialSkuId = order.materialSkuId
  source.demandSnapshot.skuLines = [{ skuCode: 'SILICONE-S', size: 'S', color: '黑', qty: 50 }]
  const cut = source.techPackSnapshot.processEntries[0]
  const spec = cut.webbingSpecifications![0]
  spec.cutLengthMm = 1300
  spec.finishedLengthMm = 1300
  spec.tippingRequired = true
  spec.endA = { method: 'SILICONE_DIP', specification: '黑色硅胶均匀浸头', materialBomItemId: 'SIL-BOM', materialUnit: 'kg', coverageMm: 20 }
  cut.webbingSpecifications = [spec]
  cut.inputMaterialSkuId = order.materialSkuId
  cut.outputMaterialSkuId = order.materialSkuId
  cut.outputInventoryForm = 'CUT_PIECES'
  source.techPackSnapshot.processEntries.push({ ...structuredClone(cut), id: 'SIL-TIP', processCode: 'WEBBING_TIP', processName: '硅胶浸头', inputInventoryForm: 'CUT_PIECES', outputInventoryForm: 'FINISHED_PIECES', predecessorEntryIds: ['CUT'] })
  registerTmfProductionOrder(source, planner, 'SILICONE:demand')
  const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === source.productionOrderId)!
  reserveTmfContinuousMaterial({ reservationId: 'SIL-RES', demandId: demand.id, lotId: `${order.purchaseOrderNo}:batch`, reservedMeters: 67, reason: '包含本批确认损耗与余量' }, planner, 'SILICONE:reserve')
  issueTmfContinuousMaterial({ issueId: 'SIL-ISS', reservationId: 'SIL-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 67 }, warehouse, 'SILICONE:issue')
  receiveTmfProcessingMaterial({ issueId: 'SIL-ISS', factoryId: 'FAC-TMF', materialSkuId: order.materialSkuId, receivedMeters: 67 }, factory, 'SILICONE:receive')
  reportTmfCutOutput({ outputId: 'SIL-OUT', issueId: 'SIL-ISS', cutPieces: 50, defectivePieces: 0, actualCutLengthMm: 1300, actualFinishedLengthMm: null, lossMeters: 1, reason: '实际切口损耗1米' }, factory, 'SILICONE:cut')
  receiveTmfTipMaterialStock({id:'SIL-MAT-LOT',materialSkuId:'SIL-BLACK',warehouseId:'WH-ACCESSORY',location:'HEAD-A01',sourceReceiptNo:'SIL-MAT-RECEIPT',sourceReceiptLineId:'1',unit:'kg',receivedQty:0.3},warehouse,'SIL-MAT:warehouse-receipt')
  dispatchTmfTipMaterial({ stockLotId:'SIL-MAT-LOT', id: 'SIL-MAT', demandId: demand.id, materialBomItemId: 'SIL-BOM', materialSkuId: 'SIL-BLACK', sourceDocumentNo: 'Mock-硅胶发料001', unit: 'kg', dispatchedQty: 0.2 }, warehouse, 'SILICONE:material-dispatch')
  receiveTmfTipMaterial('SIL-MAT', 0.2, factory, 'SILICONE:material-receipt')
  const tip = { id: 'SIL-RESULT', cutOutputId: 'SIL-OUT', pieces: 50, defectivePieces: 0, actualFinishedLengthMm: 1300,
    endA: spec.endA, endB: spec.endB, materials: [{ issueId: 'SIL-MAT', usedQty: 0.15, scrapQty: 0.01 }], reason: '实耗0.15kg，工艺损耗0.01kg' }
  const before = getTmfPurchaseState()
  assert.throws(() => reportTmfTipping({ ...tip, endA: { ...spec.endA, materialUnit: '个' } }, factory, 'SILICONE:bad-unit'), /重量单位/)
  assert.deepEqual(getTmfPurchaseState(), before)
  const headReturn={id:'SIL-HEAD-RETURN',sourceIssueId:'SIL-MAT',quantity:0.04,reason:'本批未用硅胶材料退回来源仓'}
  dispatchTmfTipMaterialReturn(headReturn,factory,'SILICONE:head-return')
  dispatchTmfTipMaterialReturn(headReturn,factory,'SILICONE:head-return')
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='SIL-MAT-LOT')!.onHandQty,0.1)
  assert.deepEqual(getTmfTipMaterialBalance('SIL-MAT'),{returnedQty:0.04,returnReceivedQty:0,returnTransitQty:0.04,availableQty:0.16})
  const afterReturn=getTmfPurchaseState()
  assert.throws(()=>reportTmfTipping({...tip,materials:[{issueId:'SIL-MAT',usedQty:0.151,scrapQty:0.01}]},factory,'SILICONE:spend-in-transit'),/超过本厂实收余额/)
  assert.deepEqual(getTmfPurchaseState(),afterReturn)
  reportTmfTipping(tip, factory, 'SILICONE:tip')
  dispatchTmfContinuousReturn({ returnId: 'SIL-RET', issueId: 'SIL-ISS', batchId: 'SIL-RET-BATCH', returnedMeters: 1, reason: '未截断绳子余料回仓' }, factory, 'SILICONE:return')
  receiveTmfContinuousReturn({ returnId: 'SIL-RET', warehouseId: order.targetWarehouseId, materialSkuId: order.materialSkuId, location: 'A-03', receivedMeters: 1 }, warehouse, 'SILICONE:return-receive')
  const state = getTmfPurchaseState()
  const output = state.cutOutputs.find((item) => item.id === 'SIL-OUT')!
  assert.equal(output.goodPieces, 50)
  assert.equal(output.unit, '根')
  assert.equal(output.pendingTipPieces, 0)
  assert.equal(state.tipMaterialLots.find(l=>l.id==='SIL-MAT-LOT')!.onHandQty,0.1)
  assert.deepEqual(state.tipMaterialIssues.find((item) => item.id === 'SIL-MAT'), { stockLotId:'SIL-MAT-LOT', id: 'SIL-MAT', demandId: demand.id, materialBomItemId: 'SIL-BOM', materialSkuId: 'SIL-BLACK', sourceDocumentNo: 'Mock-硅胶发料001', unit: 'kg', dispatchedQty: 0.2, receivedQty: 0.2, usedQty: 0.15, scrapQty: 0.01 })
  assert.equal(state.lots.filter((item) => item.sourcePurchaseOrderNo === order.purchaseOrderNo).reduce((sum, item) => sum + item.onHandMeters, 0), 34)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 100)
  assert.equal(getTmfProcessingInputBalance('SIL-ISS').remainingMeters, 0)
  packTmfOutput({ packageId: 'SIL-PKG', cutOutputId: 'SIL-OUT', tipResultId: 'SIL-RESULT', pieces: 50 }, factory, 'SILICONE:pack')
  dispatchTmfOutputPackage({ handoverId: 'SIL-HANDOVER', packageId: 'SIL-PKG', warehouseId: order.targetWarehouseId }, factory, 'SILICONE:handover')
  const allocation = { allocationId: 'SIL-ALLOCATION', packageId: 'SIL-PKG', demandId: demand.id, pieces: 50,
    receiverId: productionReceiver.id, receiverOrganizationId: 'PRODUCTION-01' }
  assert.throws(() => allocateTmfOutputPackage(allocation, planner, 'SILICONE:premature-allocation'), /尚未回仓/)
  receiveTmfOutputPackage({ handoverId: 'SIL-HANDOVER', packageId: 'SIL-PKG', warehouseId: order.targetWarehouseId, demandId: demand.id, location: 'OUTPUT-02', receivedPieces: 50 }, warehouse, 'SILICONE:stock-receipt')
  allocateTmfOutputPackage(allocation, planner, 'SILICONE:allocation')
  issueTmfProductionPackage({ issueId: 'SIL-FINAL', allocationId: allocation.allocationId, packageId: allocation.packageId, demandId: demand.id, warehouseId: order.targetWarehouseId, pieces: 50 }, warehouse, 'SILICONE:final-dispatch')
  assert.equal(getTmfProductionDemandFulfillment(demand.id).shortagePieces, 50)
  receiveTmfProductionPackage({ issueId: 'SIL-FINAL', packageId: 'SIL-PKG', demandId: demand.id, receiverOrganizationId: 'PRODUCTION-01', pieces: 50 }, productionReceiver, 'SILICONE:final-receipt')
  assert.deepEqual(getTmfProductionDemandFulfillment(demand.id), { requiredPieces: 50, dispatchedPieces: 50, receivedPieces: 50, transitPieces: 0, shortagePieces: 0, status: '已满足' })
  assert.deepEqual(getTmfOutputPackageBalance('SIL-PKG'), { receivedPieces: 50, onHandPieces: 0, reservedPieces: 0, availablePieces: 0, issuedPieces: 50, productionReceivedPieces: 50, productionTransitPieces: 0 })
  const end = getTmfPurchaseState()
  assert.equal(end.lots.filter((item) => item.sourcePurchaseOrderNo === order.purchaseOrderNo).reduce((sum, item) => sum + item.onHandMeters, 0), 34)
  assert.equal(end.packages.find((item) => item.id === 'SIL-PKG')!.materialSkuId, scenario.baseSku)
  assert.deepEqual(end.tipMaterialIssues, state.tipMaterialIssues)
  const receiveHead={returnId:'SIL-HEAD-RETURN',warehouseId:'WH-ACCESSORY',materialSkuId:'SIL-BLACK',unit:'kg' as const,quantity:0.01}
  const beforeHeadReceive=getTmfPurchaseState()
  assert.throws(()=>dispatchTmfTipMaterialReturn({...headReturn,id:'SIL-HEAD-EXTRA',quantity:0.001},factory,'SILICONE:extra-return'),/超过本厂未使用/)
  assert.throws(()=>receiveTmfTipMaterialReturn({...receiveHead,warehouseId:'WRONG'},warehouse,'SILICONE:wrong-head-wh'),/目标仓/)
  assert.throws(()=>receiveTmfTipMaterialReturn({...receiveHead,materialSkuId:'WRONG'},warehouse,'SILICONE:wrong-head-sku'),/SKU/)
  assert.throws(()=>receiveTmfTipMaterialReturn({...receiveHead,unit:'个'},warehouse,'SILICONE:wrong-head-unit'),/单位/)
  assert.throws(()=>receiveTmfTipMaterialReturn({...receiveHead,quantity:0.041},warehouse,'SILICONE:over-head-receipt'),/超过/)
  assert.deepEqual(getTmfPurchaseState(),beforeHeadReceive)
  receiveTmfTipMaterialReturn(receiveHead,warehouse,'SILICONE:head-receive-1')
  receiveTmfTipMaterialReturn(receiveHead,warehouse,'SILICONE:head-receive-1')
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='SIL-MAT-LOT')!.onHandQty,0.11)
  assert.equal(getTmfTipMaterialBalance('SIL-MAT').returnTransitQty,0.03)
  receiveTmfTipMaterialReturn({...receiveHead,quantity:0.03},warehouse,'SILICONE:head-receive-2')
  assert.deepEqual(getTmfTipMaterialBalance('SIL-MAT'),{returnedQty:0.04,returnReceivedQty:0.04,returnTransitQty:0,availableQty:0})
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='SIL-MAT-LOT')!.onHandQty,0.14)
  assert.equal(getTmfPurchaseState().tipMaterialLots.find(l=>l.id==='SIL-MAT-LOT')!.receivedQty,0.3)

  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 100)
})

test('B15：截断后取消保留1000根在制和1260米当量，释放未发占用并只退连续余料', () => {
  const order = purchase('B15-CANCEL', 1300, 'CORD-WHT')
  order.accessoryType = '绳子'
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 1300), warehouse, 'B15:base-receive')
  const source = productionSource('B15-PRODUCTION')
  source.techPackSnapshot.bomItems[0].materialSkuId = order.materialSkuId
  const cut = source.techPackSnapshot.processEntries[0]
  cut.inputMaterialSkuId = cut.outputMaterialSkuId = order.materialSkuId
  cut.outputInventoryForm = 'CUT_PIECES'
  for (const [index, spec] of cut.webbingSpecifications!.entries()) {
    spec.cutLengthMm = spec.finishedLengthMm = index === 0 ? 1200 : 1300
    spec.tippingRequired = true
    spec.endA = { method: 'METAL', specification: 'M4金属头', materialBomItemId: 'B15-HEAD', materialUnit: '个' }
    spec.endB = structuredClone(spec.endA)
  }
  source.techPackSnapshot.processEntries.push({ ...structuredClone(cut), id: 'B15-TIP', processCode: 'WEBBING_TIP', processName: '打头', inputInventoryForm: 'CUT_PIECES', outputInventoryForm: 'FINISHED_PIECES', predecessorEntryIds: ['CUT'] })
  registerTmfProductionOrder(source, planner, 'B15:demand')
  const demands = getTmfPurchaseState().demands.filter((item) => item.productionOrderId === source.productionOrderId)
  const lotId = `${order.purchaseOrderNo}:batch`
  for (const [i, demand] of demands.entries()) {
    const inputMeters = i === 0 ? 500 : 780
    reserveTmfContinuousMaterial({ reservationId: `B15-RES-${i}`, demandId: demand.id, lotId, reservedMeters: inputMeters, reason: '确认加工余量' }, planner, `B15:reserve-${i}`)
    issueTmfContinuousMaterial({ issueId: `B15-ISS-${i}`, reservationId: `B15-RES-${i}`, targetFactoryId: 'FAC-TMF', dispatchedMeters: inputMeters }, warehouse, `B15:issue-${i}`)
    receiveTmfProcessingMaterial({ issueId: `B15-ISS-${i}`, factoryId: 'FAC-TMF', materialSkuId: order.materialSkuId, receivedMeters: inputMeters }, factory, `B15:receive-${i}`)
    reportTmfCutOutput({ outputId: `B15-OUT-${i}`, issueId: `B15-ISS-${i}`, cutPieces: demand.requiredPieces, defectivePieces: 0, actualCutLengthMm: demand.specification.cutLengthMm, actualFinishedLengthMm: null, lossMeters: i === 0 ? 10 : 0, reason: '本批实际切割损耗' }, factory, `B15:cut-${i}`)
  }
  const b15Outputs = getTmfPurchaseState().cutOutputs.filter((item) => item.sourceIssueId.startsWith('B15-ISS-'))
  assert.equal(new Set(b15Outputs.map((item) => item.materialSkuId)).size, 1)
  assert.deepEqual(b15Outputs.map((item) => item.actualCutLengthMm), [1200, 1300])
  assert.notEqual(getWebbingPhysicalSpecificationKey(b15Outputs[0].specification), getWebbingPhysicalSpecificationKey(b15Outputs[1].specification))
  assert.equal(b15Outputs[0].specification.endA.method, 'METAL')
  assert.equal(b15Outputs[1].specification.endA.method, 'METAL')
  reserveTmfContinuousMaterial({ reservationId: 'B15-UNISSUED', demandId: demands[0].id, lotId, reservedMeters: 20, reason: '尚未领取的备选补料' }, planner, 'B15:reserve-unissued')
  receiveTmfTipMaterialStock({id:'B15-MATERIAL-LOT',materialSkuId:'METAL-M4',warehouseId:'WH-ACCESSORY',location:'HEAD-A01',sourceReceiptNo:'B15-MATERIAL-RECEIPT',sourceReceiptLineId:'1',unit:'个',receivedQty:2020},warehouse,'B15-MATERIAL:warehouse-receipt')
  dispatchTmfTipMaterial({ stockLotId:'B15-MATERIAL-LOT', id: 'B15-MATERIAL', demandId: demands[0].id, materialBomItemId: 'B15-HEAD', materialSkuId: 'METAL-M4', sourceDocumentNo: 'B15-HEAD-ISSUE', unit: '个', dispatchedQty: 2020 }, warehouse, 'B15:heads-dispatch')
  receiveTmfTipMaterial('B15-MATERIAL', 2020, factory, 'B15:heads-receive')
  const cancellation = { productionOrderId: source.productionOrderId, status: 'CANCELLED' as const, reason: '客户取消，截断绳子冻结待处置，未截断余料退回', confirmed: true }
  const before = getTmfPurchaseState()
  assert.throws(() => changeTmfProductionControl({ ...cancellation, confirmed: false }, planner, 'B15:unconfirmed'), /请确认/)
  assert.deepEqual(getTmfPurchaseState(), before)
  assert.throws(()=>changeTmfProductionControl({...cancellation,expectedDispositionSignature:'stale'},planner,'B15:stale'),/数量已变化/)
  assert.deepEqual(getTmfPurchaseState(),before)
  const checkedCancellation={...cancellation,expectedDispositionSignature:JSON.stringify(getTmfProductionDisposition(source.productionOrderId))}
  changeTmfProductionControl(checkedCancellation,planner,'B15:checked-cancel')
  changeTmfProductionControl(checkedCancellation,planner,'B15:checked-cancel')
  assert.equal(getTmfPurchaseState().lots.find((item) => item.id === lotId)!.reservedMeters, 0)
  assert.deepEqual(getTmfPurchaseState().cutOutputs, before.cutOutputs)
  assert.deepEqual(getTmfPurchaseState().tipMaterialIssues, before.tipMaterialIssues)
  assert.throws(() => registerTmfProductionOrder(source, planner, 'B15:regenerate'), /已取消/)
  assert.throws(() => changeTmfProductionControl({ ...cancellation, status: 'ACTIVE' }, planner, 'B15:resume'), /不能恢复/)
  assert.throws(() => reserveTmfContinuousMaterial({ reservationId: 'B15-NEW', demandId: demands[0].id, lotId, reservedMeters: 1, reason: '' }, planner, 'B15:new-reserve'), /已取消/)
  assert.throws(() => reportTmfCutOutput({ outputId: 'B15-NEW-OUT', issueId: 'B15-ISS-0', cutPieces: 1, defectivePieces: 0, actualCutLengthMm: 1200, actualFinishedLengthMm: null, lossMeters: 0, reason: '' }, factory, 'B15:new-cut'), /已取消/)
  assert.throws(() => reportTmfTipping({ id: 'B15-RESULT', cutOutputId: 'B15-OUT-0', pieces: 1, defectivePieces: 0, actualFinishedLengthMm: 1200, endA: demands[0].specification.endA, endB: demands[0].specification.endB, materials: [{ issueId: 'B15-MATERIAL', usedQty: 2, scrapQty: 0 }], reason: '' }, factory, 'B15:new-tip'), /已取消/)
  const returnInput = { returnId: 'B15-RETURN', issueId: 'B15-ISS-0', batchId: 'B15-RETURN-BATCH', returnedMeters: 10, reason: '取消后退回未截断连续绳子' }
  dispatchTmfContinuousReturn(returnInput, factory, 'B15:return')
  receiveTmfContinuousReturn({ returnId: returnInput.returnId, warehouseId: order.targetWarehouseId, materialSkuId: order.materialSkuId, location: 'A-RETURN', receivedMeters: 10 }, warehouse, 'B15:return-receive')
  const disposition = getTmfProductionDisposition(source.productionOrderId)
  assert.equal(disposition.status, 'CANCELLED')
  assert.equal(disposition.cutPieces, 1000)
  assert.equal(disposition.factoryPieces, 1000)
  assert.equal(disposition.pendingTipPieces, 1000)
  assert.equal(disposition.cutEquivalentMeters, 1260)
  assert.equal(disposition.remainingContinuousMeters, 0)
  assert.equal(disposition.productionReceivedPieces, 0)
  assert.equal(getTmfProductionDemandFulfillment(demands[0].id).status, '已取消')
  assert.equal(getTmfPurchaseState().lots.filter((item) => item.sourcePurchaseOrderNo === order.purchaseOrderNo).reduce((sum, item) => sum + item.onHandMeters, 0), 30)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 1300)
})

test('已回仓部分发料后取消：释放未发分配，冻结实存，已发在途保留且实收不恢复需求', () => {
  const order = purchase('CANCEL-STOCK', 60)
  prepare(order)
  receiveTmfBaseProduction(receipt(order, 60), warehouse, 'CANCEL-STOCK:receive')
  const source = productionSource('CANCEL-STOCK-PRODUCTION')
  source.demandSnapshot.skuLines = [{ ...source.demandSnapshot.skuLines[0], qty: 100 }]
  source.techPackSnapshot.processEntries[0].webbingSpecifications!.splice(1)
  registerTmfProductionOrder(source, planner, 'CANCEL-STOCK:demand')
  const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === source.productionOrderId)!
  reserveTmfContinuousMaterial({ reservationId: 'CS-RES', demandId: demand.id, lotId: `${order.purchaseOrderNo}:batch`, reservedMeters: 50, reason: '' }, planner, 'CS:reserve')
  issueTmfContinuousMaterial({ issueId: 'CS-INPUT', reservationId: 'CS-RES', targetFactoryId: 'FAC-TMF', dispatchedMeters: 50 }, warehouse, 'CS:input')
  receiveTmfProcessingMaterial({ issueId: 'CS-INPUT', factoryId: 'FAC-TMF', materialSkuId: order.materialSkuId, receivedMeters: 50 }, factory, 'CS:input-receive')
  reportTmfCutOutput({ outputId: 'CS-OUTPUT', issueId: 'CS-INPUT', cutPieces: 100, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '' }, factory, 'CS:cut')
  packTmfOutput({ packageId: 'CS-PKG', cutOutputId: 'CS-OUTPUT', pieces: 100 }, factory, 'CS:pack')
  dispatchTmfOutputPackage({ handoverId: 'CS-HANDOVER', packageId: 'CS-PKG', warehouseId: order.targetWarehouseId }, factory, 'CS:handover')
  receiveTmfOutputPackage({ handoverId: 'CS-HANDOVER', packageId: 'CS-PKG', warehouseId: order.targetWarehouseId, demandId: demand.id, location: 'CANCEL-01', receivedPieces: 100 }, warehouse, 'CS:warehouse-receive')
  allocateTmfOutputPackage({ allocationId: 'CS-ALLOCATION', packageId: 'CS-PKG', demandId: demand.id, pieces: 100, receiverId: productionReceiver.id, receiverOrganizationId: 'PRODUCTION-01' }, planner, 'CS:allocate')
  const issue = { issueId: 'CS-FINAL', allocationId: 'CS-ALLOCATION', packageId: 'CS-PKG', demandId: demand.id, warehouseId: order.targetWarehouseId, pieces: 20 }
  issueTmfProductionPackage(issue, warehouse, 'CS:issue20')
  changeTmfProductionControl({ productionOrderId: source.productionOrderId, status: 'CANCELLED', reason: '停单，保留在途交接事实，未发产出冻结', confirmed: true }, planner, 'CS:cancel')
  assert.equal(getTmfPurchaseState().outputAllocations.find((item) => item.id === 'CS-ALLOCATION')!.releasedPieces, 80)
  assert.deepEqual(getTmfOutputPackageBalance('CS-PKG'), { receivedPieces: 100, onHandPieces: 80, reservedPieces: 0, availablePieces: 0, issuedPieces: 20, productionReceivedPieces: 0, productionTransitPieces: 20 })
  assert.throws(() => issueTmfProductionPackage({ ...issue, issueId: 'CS-AFTER' }, warehouse, 'CS:issue-after'), /已取消/)
  receiveTmfProductionPackage({ issueId: 'CS-FINAL', packageId: 'CS-PKG', demandId: demand.id, receiverOrganizationId: 'PRODUCTION-01', pieces: 20 }, productionReceiver, 'CS:receive-existing-transit')
  const disposition = getTmfProductionDisposition(source.productionOrderId)
  assert.equal(disposition.warehousePieces, 80)
  assert.equal(disposition.productionReceivedPieces, 20)
  assert.equal(disposition.productionTransitPieces, 0)
  assert.equal(disposition.cutPieces, disposition.factoryPieces + disposition.warehousePieces + disposition.warehouseTransitPieces + disposition.productionTransitPieces + disposition.productionReceivedPieces)
  assert.equal(getTmfProductionDemandFulfillment(demand.id).status, '已取消')
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty, 60)
})

for (const scenarioId of ['N02','N03','N04']) test(`${scenarioId}规范数值：采购→实际加工→生产实收及米料/辅材退仓整链`,async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json',import.meta.url),'utf8'))
  const s=fixture.normalScenarios.find((r:{id:string})=>r.id===scenarioId)
  const id=`FULL-${scenarioId}`,order=purchase(id,s.purchaseQuantityM,s.baseSku)
  order.accessoryType=s.details[0].unit==='根'?'绳子':'织带'
  await prepareWithRawMaterial(order,s.baseProductionInput);receiveTmfBaseProduction(receipt(order,s.purchaseQuantityM),warehouse,`${id}:base-receipt`)
  const source=productionSource(`${id}-PROD`),cut=source.techPackSnapshot.processEntries[0],baseSpec=cut.webbingSpecifications![0]
  const method=({'N02':'METAL','N03':'PLASTIC_WRAP','N04':'SILICONE_DIP'} as const)[scenarioId as 'N02'|'N03'|'N04']
  const head=s.headMaterials,headBom=`${id}-HEAD-BOM`,headLot=`${id}-HEAD-LOT`
  source.techPackSnapshot.bomItems[0].materialSkuId=s.baseSku
  source.techPackSnapshot.bomItems.push({...source.techPackSnapshot.bomItems[0],id:headBom,name:`Mock ${method} ${head.sku}`,materialSkuId:head.sku,unit:head.unit})
  source.demandSnapshot.skuLines=s.details.map((d:{garmentSize:string;productionGarmentQty:number})=>({skuCode:`${id}-${d.garmentSize}`,size:d.garmentSize,color:scenarioId==='N04'?'黑':'白',qty:d.productionGarmentQty}))
  cut.inputMaterialSkuId=cut.outputMaterialSkuId=s.baseSku;cut.outputInventoryForm='CUT_PIECES'
  cut.webbingSpecifications=s.details.map((d:{id:string;garmentSize:string;cutLengthMm:number;finishedLengthMm:number;toleranceMm:number;measurementCondition:string;endCount:number;tipSpecification:string})=>({
    ...structuredClone(baseSpec),id:d.id,garmentSize:d.garmentSize,cutLengthMm:d.cutLengthMm,finishedLengthMm:d.finishedLengthMm,toleranceMm:d.toleranceMm,measurementCondition:d.measurementCondition,tippingRequired:true,
    endA:{method,specification:d.tipSpecification,materialBomItemId:headBom,materialUnit:head.unit,...(method==='SILICONE_DIP'?{coverageMm:20}:{})},
    endB:d.endCount===2?{method,specification:d.tipSpecification,materialBomItemId:headBom,materialUnit:head.unit}:{method:'NONE',specification:''},
  }))
  source.techPackSnapshot.processEntries.push({...structuredClone(cut),id:`${id}-TIP`,processCode:'WEBBING_TIP',processName:'打头',inputInventoryForm:'CUT_PIECES',outputInventoryForm:'FINISHED_PIECES',predecessorEntryIds:['CUT']})
  // B07：同一 N03 副本先注入缺打头方式的技术包规格，阻断派单；补齐后继续原副本至终点。
  if(scenarioId==='N03'){
    const validSpecs=cut.webbingSpecifications!
    cut.webbingSpecifications=[{...structuredClone(validSpecs[0]),tippingRequired:true,endA:{method:'NONE',specification:''},endB:{method:'NONE',specification:''}},...structuredClone(validSpecs.slice(1))]
    assert.throws(()=>registerTmfProductionOrder(source,planner,`${id}:missing-tip-method`),/打头方式/)
    assert.equal(getTmfPurchaseState().demands.filter(item=>item.productionOrderId===source.productionOrderId).length,0)
    cut.webbingSpecifications=validSpecs
  }
  registerTmfProductionOrder(source,planner,`${id}:demand`)
  const demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId)
  assert.equal(demands.length,s.details.length)
  const tipPurchaseInput={demandId:demands[0].id,materialBomItemId:headBom,quantity:head.received,supplierName:'Mock端头材料供应方',warehouse:order.targetWarehouseId,unitPrice:1,expectedArrivalDate:'2026-10-01',reason:'规范场景按技术包采购，含实际损耗及未用退回'}
  const beforePurchases=listPmsMaterialPurchaseOrders()
  assert.throws(()=>createPmsTmfTipPurchase({...tipPurchaseInput,materialBomItemId:'WRONG'},PMS_BUYER_ACTOR,`${id}:wrong-bom`),/辅材SKU/)
  assert.throws(()=>createPmsTmfTipPurchase({...tipPurchaseInput,quantity:0.0001},PMS_BUYER_ACTOR,`${id}:wrong-quantity`),/数量/)
  assert.deepEqual(listPmsMaterialPurchaseOrders(),beforePurchases)
  const headPurchase=createPmsTmfTipPurchase(tipPurchaseInput,PMS_BUYER_ACTOR,`${id}:head-purchase`)
  assert.equal(createPmsTmfTipPurchase(tipPurchaseInput,PMS_BUYER_ACTOR,`${id}:head-purchase`).purchaseOrderNo,headPurchase.purchaseOrderNo)
  assert.throws(()=>createPmsTmfTipPurchase({...tipPurchaseInput,quantity:1},PMS_BUYER_ACTOR,`${id}:head-purchase`),/其他采购内容/)
  const headReceipt={receiptId:`${id}-HEAD-RECEIPT`,purchaseOrderNo:headPurchase.purchaseOrderNo,purpose:'TIP_MATERIAL' as const,lotId:headLot,scannedMaterialCode:head.sku,warehouse:order.targetWarehouseId,location:'HEAD-01',quantity:head.received}
  await assert.rejects(receiveTmfSupplyPurchase(headReceipt,warehouse,`${id}:head-stock`),/已下达/)
  advancePmsMaterialPurchaseOrderStatus(headPurchase.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR)
  assert.throws(()=>registerPmsMaterialPurchaseArrival(headPurchase.purchaseOrderNo,head.received,PMS_BUYER_ACTOR),/不能手改/)
  assert.throws(()=>advancePmsMaterialPurchaseOrderStatus(headPurchase.purchaseOrderNo,'已到货',PMS_BUYER_ACTOR),/仓库实收/)
  await assert.rejects(receiveTmfSupplyPurchase({...headReceipt,purpose:'BASE_MATERIAL'},warehouse,`${id}:wrong-inventory`),/打头辅材库存/)
  await receiveTmfSupplyPurchase(headReceipt,warehouse,`${id}:head-stock`)
  await receiveTmfSupplyPurchase(headReceipt,warehouse,`${id}:head-stock`)
  assert.equal(getPmsMaterialPurchaseOrder(headPurchase.purchaseOrderNo)!.receivedQty,head.received)
  // 总余料/损耗分配到首规格，余下规格按净下料；不改变JSON的整单总账。
  let totalNet=0,totalLoss=0
  const replay=(name:string,run:(op:string)=>void)=>{run(`${id}:${name}`);const saved=getTmfPurchaseState();run(`${id}:${name}`);assert.deepEqual(getTmfPurchaseState(),saved)}
  for(const [index,demand] of demands.entries()){
    const d=s.details.find((r:{id:string})=>r.id===demand.specification.id),first=index===0
    const net=d.quantity*d.cutLengthMm/1000,loss=first?s.cutLossM:0,returned=first?s.continuousReturnM:0,meters=net+loss+returned
    const reserved=`${d.id}-RES`,issue=`${d.id}-ISS`,out=`${id}-${d.outputId}`,tipResult=`${d.id}-TIP`,pkg=`${id}-${d.packageId}`,headIssue=`${d.id}-HEAD`
    totalNet+=net;totalLoss+=loss
    reserveTmfContinuousMaterial({reservationId:reserved,demandId:demand.id,lotId:`${order.purchaseOrderNo}:batch`,reservedMeters:meters,reason:'规范场景分摊实际下料、损耗和未截断余量'},planner,`${id}:${d.id}:reserve`)
    issueTmfContinuousMaterial({issueId:issue,reservationId:reserved,targetFactoryId:'FAC-TMF',dispatchedMeters:meters},warehouse,`${id}:${d.id}:issue`)
    receiveTmfProcessingMaterial({issueId:issue,factoryId:'FAC-TMF',materialSkuId:s.baseSku,receivedMeters:meters},factory,`${id}:${d.id}:receive`)
    const cutInput={outputId:out,issueId:issue,cutPieces:d.quantity,defectivePieces:0,actualCutLengthMm:d.cutLengthMm,actualFinishedLengthMm:null,lossMeters:loss,reason:'规范场景实际截断'}
    replay(`${d.id}:cut`,op=>reportTmfCutOutput(cutInput,factory,op))
    assert.equal(getTmfPurchaseState().cutOutputs.find(o=>o.id===out)!.goodPieces,0)
    const used=head.unit==='个'?d.quantity*d.endCount:head.consumed,scrap=first?head.scrapped:0,remaining=first?head.remaining:0
    // B08：同一 N04 副本按个数误领硅胶必须阻断且不改账，纠正为实际重量后继续原副本至终点。
    if(scenarioId==='N04'){
      const beforeWrongUnit=getTmfPurchaseState()
      assert.throws(()=>dispatchTmfTipMaterial({stockLotId:headLot,id:`${d.id}-HEAD-WRONG-UNIT`,demandId:demand.id,materialBomItemId:headBom,materialSkuId:head.sku,sourceDocumentNo:`${d.id}-HEAD-DOC-U`,unit:'个',dispatchedQty:1},warehouse,`${id}:${d.id}:wrong-unit`),/单位不一致/)
      assert.deepEqual(getTmfPurchaseState(),beforeWrongUnit)
    }
    dispatchTmfTipMaterial({stockLotId:headLot,id:headIssue,demandId:demand.id,materialBomItemId:headBom,materialSkuId:head.sku,sourceDocumentNo:`${d.id}-HEAD-DOC`,unit:head.unit,dispatchedQty:used+scrap+remaining},warehouse,`${id}:${d.id}:head-dispatch`)
    const beforeHeadReceipt=getTmfPurchaseState()
    assert.throws(()=>reportTmfTipping({id:tipResult,cutOutputId:out,pieces:d.quantity,defectivePieces:0,actualFinishedLengthMm:d.finishedLengthMm,endA:demand.specification.endA,endB:demand.specification.endB,materials:[{issueId:headIssue,usedQty:used,scrapQty:scrap}],reason:'未实收试做'},factory,`${id}:${d.id}:premature-tip`),/超过本厂实收余额/)
    assert.deepEqual(getTmfPurchaseState(),beforeHeadReceipt)
    receiveTmfTipMaterial(headIssue,used+scrap+remaining,factory,`${id}:${d.id}:head-receive`)
    replay(`${d.id}:tip`,op=>reportTmfTipping({id:tipResult,cutOutputId:out,pieces:d.quantity,defectivePieces:0,actualFinishedLengthMm:d.finishedLengthMm,endA:demand.specification.endA,endB:demand.specification.endB,materials:[{issueId:headIssue,usedQty:used,scrapQty:scrap}],reason:'规范场景打头及辅材实耗'},factory,op))
    // B18：同一 N03 副本对已打完批次的新打头动作必须阻断，辅材不重复耗用。
    if(scenarioId==='N03'&&index===0){
      const beforeRetip=getTmfPurchaseState()
      assert.throws(()=>reportTmfTipping({id:`${d.id}-TIP-AGAIN`,cutOutputId:out,pieces:d.quantity,defectivePieces:0,actualFinishedLengthMm:d.finishedLengthMm,endA:demand.specification.endA,endB:demand.specification.endB,materials:[{issueId:headIssue,usedQty:used,scrapQty:0}],reason:'重复加工验证'},factory,`${id}:${d.id}:retip`),/不能重复加工/)
      assert.deepEqual(getTmfPurchaseState(),beforeRetip)
      assert.equal(getTmfPurchaseState().tipMaterialIssues.find(item=>item.id===headIssue)!.usedQty,used)
    }
    assert.equal(getTmfProcessingInputBalance(issue).cutEquivalentMeters,net)
    if(returned){dispatchTmfContinuousReturn({returnId:`${d.id}-RETURN`,issueId:issue,batchId:`${d.id}-RETURN-LOT`,returnedMeters:returned,reason:'规范未截断余料回仓'},factory,`${id}:${d.id}:return`);receiveTmfContinuousReturn({returnId:`${d.id}-RETURN`,warehouseId:order.targetWarehouseId,materialSkuId:s.baseSku,location:'RETURN-01',receivedMeters:returned},warehouse,`${id}:${d.id}:return-receive`)}
    if(remaining){dispatchTmfTipMaterialReturn({id:`${d.id}-HEAD-RETURN`,sourceIssueId:headIssue,quantity:remaining,reason:'本单未使用辅材回原仓'},factory,`${id}:${d.id}:head-return`);replay(`${d.id}:head-return-receive`,op=>receiveTmfTipMaterialReturn({returnId:`${d.id}-HEAD-RETURN`,warehouseId:order.targetWarehouseId,materialSkuId:head.sku,unit:head.unit,quantity:remaining},warehouse,op))}
    assert.equal(getTmfProcessingInputBalance(issue).remainingMeters,0)
    packTmfOutput({packageId:pkg,cutOutputId:out,tipResultId:tipResult,pieces:d.quantity},factory,`${id}:${d.id}:pack`)
    const packageDoc=buildTmfPackageLabelsPrintDocument({documentType:'TMF_PACKAGE_LABEL',sourceType:'TMF_OUTPUT_PACKAGE',sourceId:JSON.stringify([pkg])})
    assert.equal(packageDoc.labelItems![0].labelTitle,`成品 ${d.finishedLengthMm}mm · ${d.quantity} ${d.unit}`)
    assert.equal(packageDoc.barcodes[0].value,pkg)
    dispatchTmfOutputPackage({handoverId:`${d.id}-HAND`,packageId:pkg,warehouseId:order.targetWarehouseId},factory,`${id}:${d.id}:hand`)
    receiveTmfOutputPackage({handoverId:`${d.id}-HAND`,packageId:pkg,warehouseId:order.targetWarehouseId,demandId:demand.id,location:'FINISHED-01',receivedPieces:d.quantity},warehouse,`${id}:${d.id}:stock-receive`)
    if(demands.length>1){
      const other=demands.find(o=>o.id!==demand.id)!,beforeWrong=getTmfPurchaseState()
      assert.throws(()=>allocateTmfOutputPackage({allocationId:`${d.id}-WRONG`,packageId:pkg,demandId:other.id,pieces:1,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,`${id}:${d.id}:wrong-length`),/不能混用/)
      assert.deepEqual(getTmfPurchaseState(),beforeWrong)
    }
    allocateTmfOutputPackage({allocationId:`${d.id}-ALLOC`,packageId:pkg,demandId:demand.id,pieces:d.quantity,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,`${id}:${d.id}:allocate`)
    issueTmfProductionPackage({issueId:`${d.id}-FINAL`,allocationId:`${d.id}-ALLOC`,packageId:pkg,demandId:demand.id,warehouseId:order.targetWarehouseId,pieces:d.quantity},warehouse,`${id}:${d.id}:final-dispatch`)
    assert.equal(getTmfProductionDemandFulfillment(demand.id).shortagePieces,d.quantity)
    replay(`${d.id}:final-receive`,op=>receiveTmfProductionPackage({issueId:`${d.id}-FINAL`,packageId:pkg,demandId:demand.id,receiverOrganizationId:'PRODUCTION-01',pieces:d.quantity},productionReceiver,op))
    assert.equal(getTmfProductionDemandFulfillment(demand.id).status,'已满足')
    assert.equal(getTmfOutputPackageBalance(pkg).onHandPieces,0)
    assert.equal(getTmfOutputPackageBalance(pkg).productionTransitPieces,0)
    assert.throws(()=>buildTmfPackageLabelsPrintDocument({documentType:'TMF_PACKAGE_LABEL',sourceType:'TMF_OUTPUT_PACKAGE',sourceId:JSON.stringify([pkg])}),/已发生生产发料/)
  }
  const end=getTmfPurchaseState(),lots=end.lots.filter(l=>l.sourcePurchaseOrderNo===order.purchaseOrderNo),warehouseM=lots.reduce((n,l)=>n+l.onHandMeters,0)
  assert.equal(warehouseM,s.expectedFinal.baseContinuousM+s.expectedFinal.processedContinuousReturnM)
  assert.equal(warehouseM+totalNet+totalLoss,s.purchaseQuantityM)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty,s.expectedFinal.purchaseReceivedM)
  assert.equal(getPmsMaterialPurchaseOrder(headPurchase.purchaseOrderNo)!.receivedQty,head.received)
  assert.equal(getPmsMaterialPurchaseOrder(headPurchase.purchaseOrderNo)!.tmfTipSource!.snapshotId,demands[0].techPackSnapshotId)
  assert.equal(end.supplyPurchaseReceipts.find(r=>r.lotId===headLot)!.purchaseOrderNo,headPurchase.purchaseOrderNo)
  assert.equal(end.tipMaterialLots.find(l=>l.id===headLot)!.receivedQty,head.received)
  assert.equal(end.tipMaterialLots.find(l=>l.id===headLot)!.onHandQty,head.remaining)
  const inputIds=new Set(demands.map(d=>d.id)),heads=end.tipMaterialIssues.filter(i=>inputIds.has(i.demandId))
  assert.equal(Math.round(heads.reduce((n,h)=>n+h.usedQty+h.scrapQty,head.remaining)*1000)/1000,head.received)
  assert.ok(end.packages.filter(p=>inputIds.has(p.demandId)).every(p=>p.materialSkuId===s.baseSku&&p.unit===s.details[0].unit))
  assert.equal(demands.reduce((n,d)=>n+getTmfProductionDemandFulfillment(d.id).receivedPieces,0),s.expectedFinal.productionReceivedPieces)
  assert.equal(getTmfBaseMaterialBalance(`${order.purchaseOrderNo}-RAW-ISS`).availableQty,s.baseProductionInput.remaining)
  const work=projectTmfWorkOrders(end).find(w=>w.productionOrderId===demands[0].productionOrderId)!
  const printInput={documentType:'TMF_PROCESS_SHEET' as const,sourceType:'TMF_WORK_ORDER' as const,sourceId:work.id}
  const beforePrint=JSON.stringify(getTmfPurchaseState())
  const printed=buildTmfProcessSheetPrintDocument(printInput)
  assert.equal(printed.sections.length,demands.length)
  for(const d of demands){
    const fields=Object.fromEntries(printed.sections.find(section=>section.sectionId===d.id)!.fields.map(f=>[f.label,f.value]))
    assert.equal(fields['下料长度'],`${d.specification.cutLengthMm}mm`)
    assert.equal(fields['半成品 SKU'],d.materialSkuId)
    assert.equal(fields['需求量'],`${d.requiredPieces} ${s.details[0].unit}`)
    assert.ok(fields['A端'].includes(d.specification.endA.specification))
  }
  assert.equal(printed.tables.find(t=>t.tableId==='handovers')!.rows.reduce((n,row)=>n+Number(row[3]),0),s.expectedFinal.productionReceivedPieces)
  assert.equal(JSON.stringify(getTmfPurchaseState()),beforePrint)
  const tipRows=printed.tables.find(t=>t.tableId==='tipping')!.rows
  assert.equal(tipRows.length,demands.length)
  for(const result of end.tipResults.filter(t=>work.outputs.some(o=>o.id===t.cutOutputId))) assert.equal(tipRows.find(row=>row[0].startsWith(result.id+' / '))![1],`${result.actualFinishedLengthMm}mm`)
  const html=renderTmfProcessSheetTemplate(printed)
  assert.match(html,/data-print-image-missing/)
  assert.match(html,/data-real-qr/)
  assert.ok(JSON.parse(printed.qrCodes[0].value).targetRoute.endsWith(encodeURIComponent(work.id)))
  const changed=structuredClone(end);changed.productionControls.push({productionOrderId:work.productionOrderId,status:'ON_HOLD',reason:'测试暂停',changedAt:'2026-09-20'})
  assert.notEqual(tmfPrintFactsSignature(printed),tmfPrintFactsSignature(buildTmfProcessSheetPrintDocument(printInput,changed)))
  assert.throws(()=>buildTmfProcessSheetPrintDocument({...printInput,sourceId:'missing'}),/不存在/)
  console.log(JSON.stringify({scenario:scenarioId,scope:'业务动作主链含纱线重量账；含端头辅材采购实收；不含PCS发布采用页面、纱线采购上游',purchaseReceived:s.purchaseQuantityM,productionReceived:s.expectedFinal.productionReceivedPieces,warehouseContinuousM:warehouseM,netCutM:totalNet,lossM:totalLoss,headUnit:head.unit,headReceived:head.received,headRemaining:head.remaining}))
})

test('B06规范恢复：误装100根报废→补购100米并补做→生产实收1000根，三套实物账守恒', async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json',import.meta.url),'utf8'))
  const s=fixture.normalScenarios.find((r:{id:string})=>r.id==='N02'),oracle=fixture.recoveryOracles.B06,id='FULL-B06'
  const order=purchase(id,s.purchaseQuantityM,s.baseSku);order.accessoryType='绳子'
  await prepareWithRawMaterial(order,s.baseProductionInput);receiveTmfBaseProduction(receipt(order,s.purchaseQuantityM),warehouse,id+':base-receive')
  const source=productionSource(id+'-PROD'),cut=source.techPackSnapshot.processEntries[0],baseSpec=cut.webbingSpecifications![0]
  const headBom=id+'-METAL-BOM',headLot=id+'-METAL-LOT',plasticLot=id+'-PLASTIC-LOT'
  source.techPackSnapshot.bomItems[0].materialSkuId=s.baseSku
  source.techPackSnapshot.bomItems.push({...source.techPackSnapshot.bomItems[0],id:headBom,name:'Mock金属头',materialSkuId:s.headMaterials.sku,unit:'个'})
  cut.inputMaterialSkuId=cut.outputMaterialSkuId=s.baseSku;cut.outputInventoryForm='CUT_PIECES'
  cut.webbingSpecifications=s.details.map((d:typeof baseSpec)=>({...structuredClone(baseSpec),...d,id:id+'-'+d.id,bomItemId:baseSpec.bomItemId,tippingRequired:true,
    endA:{method:'METAL',specification:s.headMaterials.specification,materialBomItemId:headBom,materialUnit:'个'},
    endB:{method:'METAL',specification:s.headMaterials.specification,materialBomItemId:headBom,materialUnit:'个'}}))
  source.techPackSnapshot.processEntries.push({...structuredClone(cut),id:id+'-TIP',processCode:'WEBBING_TIP',processName:'打头',inputInventoryForm:'CUT_PIECES',outputInventoryForm:'FINISHED_PIECES',predecessorEntryIds:['CUT']})
  registerTmfProductionOrder(source,planner,id+':demand')
  const demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId),first=demands[0]
  const headPurchase=createPmsTmfTipPurchase({demandId:first.id,materialBomItemId:headBom,quantity:oracle.metalHeads.received,supplierName:'Mock端头供应方',warehouse:order.targetWarehouseId,unitPrice:1,expectedArrivalDate:'2026-10-01',reason:'规范B06金属头采购'},PMS_BUYER_ACTOR,id+':head-purchase')
  advancePmsMaterialPurchaseOrderStatus(headPurchase.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR)
  await receiveTmfSupplyPurchase({receiptId:id+'-METAL-RECEIPT',purchaseOrderNo:headPurchase.purchaseOrderNo,purpose:'TIP_MATERIAL',lotId:headLot,scannedMaterialCode:s.headMaterials.sku,warehouse:order.targetWarehouseId,location:'HEAD-01',quantity:oracle.metalHeads.received},warehouse,id+':head-receive')
  // 错用塑料头是现场已发生的物料事实，不改写技术包要求为塑料头。
  receiveTmfTipMaterialStock({id:plasticLot,materialSkuId:'MOCK-PLASTIC-B06',warehouseId:order.targetWarehouseId,location:'HEAD-02',sourceReceiptNo:id+'-PLASTIC-RECEIPT',sourceReceiptLineId:'1',unit:'个',receivedQty:oracle.plasticHeads.received},warehouse,id+':plastic-stock')
  const wrongEnd={method:'PLASTIC_WRAP' as const,specification:'Mock误用塑料头',materialBomItemId:id+'-PLASTIC-BOM',materialUnit:'个' as const}
  const packages:{id:string;demandId:string;pieces:number}[]=[]
  const input=(key:string,demandId:string,lotId:string,meters:number)=>{
    reserveTmfContinuousMaterial({reservationId:key,demandId,lotId,reservedMeters:meters,reason:'B06实际截断及补做'},planner,key+':reserve')
    issueTmfContinuousMaterial({issueId:key,reservationId:key,targetFactoryId:'FAC-TMF',dispatchedMeters:meters},warehouse,key+':issue')
    receiveTmfProcessingMaterial({issueId:key,factoryId:'FAC-TMF',materialSkuId:s.baseSku,receivedMeters:meters},factory,key+':receive')
  }
  const tip=(key:string,out:string,demand:typeof first,pieces:number,wrong=false,scrap=0)=>{
    const end=wrong?wrongEnd:demand.specification.endA,lot=wrong?plasticLot:headLot,sku=wrong?'MOCK-PLASTIC-B06':s.headMaterials.sku
    dispatchTmfTipMaterial({stockLotId:lot,id:key,demandId:demand.id,materialBomItemId:end.materialBomItemId!,materialSkuId:sku,sourceDocumentNo:key,unit:'个',dispatchedQty:pieces*2+scrap},warehouse,key+':dispatch')
    receiveTmfTipMaterial(key,pieces*2+scrap,factory,key+':receive')
    reportTmfTipping({id:key,cutOutputId:out,pieces,defectivePieces:0,actualFinishedLengthMm:demand.specification.finishedLengthMm,endA:end,endB:wrong?wrongEnd:demand.specification.endB,materials:[{issueId:key,usedQty:pieces*2,scrapQty:scrap}],reason:wrong?'误装塑料头，按实际不良隔离':'正确金属头，按实耗登记'},factory,key+':tip')
    if(!wrong){packTmfOutput({packageId:key,cutOutputId:out,tipResultId:key,pieces},factory,key+':pack');packages.push({id:key,demandId:demand.id,pieces})}
  }
  const returnMeters=(key:string,issueId:string,meters:number)=>{
    dispatchTmfContinuousReturn({returnId:key,issueId,batchId:key+'-LOT',returnedMeters:meters,reason:'未截断余料回仓'},factory,key+':return')
    receiveTmfContinuousReturn({returnId:key,warehouseId:order.targetWarehouseId,materialSkuId:s.baseSku,location:'RETURN-01',receivedMeters:meters},warehouse,key+':return-receive')
  }
  for(const [index,demand] of demands.entries()){
    const d=s.details[index],key=id+'-ORIGINAL-'+index,meters=d.quantity*d.cutLengthMm/1000+(index===0?s.cutLossM+s.continuousReturnM:0)
    input(key,demand.id,order.purchaseOrderNo+':batch',meters)
    reportTmfCutOutput({outputId:key,issueId:key,cutPieces:d.quantity,defectivePieces:0,actualCutLengthMm:d.cutLengthMm,actualFinishedLengthMm:null,lossMeters:index===0?s.cutLossM:0,reason:'规范原批截断'},factory,key+':cut')
    if(index===0){
      tip(id+'-WRONG',key,demand,oracle.scrappedPieces,true)
      const before=getTmfPurchaseState()
      assert.throws(()=>packTmfOutput({packageId:id+'-WRONG-PACK',cutOutputId:key,tipResultId:id+'-WRONG',pieces:1},factory,id+':wrong-pack'),/超过/)
      assert.deepEqual(getTmfPurchaseState(),before)
      const scrap={id:id+'-SCRAP',cutOutputId:key,tipResultId:id+'-WRONG',pieces:oracle.scrappedPieces,expectedAvailablePieces:oracle.scrappedPieces,reason:'B06误用塑料头实物报废',confirmed:true}
      scrapTmfDefectiveOutput(scrap,factory,id+':scrap');scrapTmfDefectiveOutput(scrap,factory,id+':scrap')
      assert.deepEqual(getTmfPurchaseState().tipMaterialIssues,before.tipMaterialIssues)
      tip(key+'-GOOD',key,demand,d.quantity-oracle.scrappedPieces,false,oracle.metalHeads.scrapped)
      returnMeters(id+'-ORIGINAL-RETURN',key,s.continuousReturnM)
    }else tip(key+'-GOOD',key,demand,d.quantity)
  }
  assert.equal(getTmfProductionDisposition(source.productionOrderId).pendingDefectivePieces,0)
  // 旧仓剩20米 + 回仓10米 + 新购100米，另发122米：20 + 10 + 92。
  const extra=purchase(id+'-SUPPLEMENT',oracle.supplementPurchaseReceivedM,s.baseSku);extra.accessoryType='绳子'
  prepare(extra);receiveTmfBaseProduction(receipt(extra,extra.orderedQty),warehouse,id+':supplement-receive')
  const parts=[{lot:order.purchaseOrderNo+':batch',meters:20,pieces:16,loss:0.8,returned:0},
    {lot:id+'-ORIGINAL-RETURN-LOT',meters:10,pieces:8,loss:0.2,returned:0.2},
    {lot:extra.purchaseOrderNo+':batch',meters:92,pieces:76,loss:0,returned:0.8}]
  for(const [index,part] of parts.entries()){
    const key=id+'-REMAKE-'+index
    input(key,first.id,part.lot,part.meters)
    reportTmfCutOutput({outputId:key,issueId:key,cutPieces:part.pieces,defectivePieces:0,actualCutLengthMm:oracle.supplementCutLengthMm,actualFinishedLengthMm:null,lossMeters:part.loss,reason:'报废100根后补做'},factory,key+':cut')
    tip(key+'-GOOD',key,first,part.pieces)
    if(part.returned)returnMeters(key+'-RETURN',key,part.returned)
    assert.equal(getTmfProcessingInputBalance(key).remainingMeters,0)
  }
  for(const pkg of packages){
    const key=pkg.id
    dispatchTmfOutputPackage({handoverId:key,packageId:key,warehouseId:order.targetWarehouseId},factory,key+':handover')
    receiveTmfOutputPackage({handoverId:key,packageId:key,warehouseId:order.targetWarehouseId,demandId:pkg.demandId,location:'FINAL-01',receivedPieces:pkg.pieces},warehouse,key+':stock-receive')
    allocateTmfOutputPackage({allocationId:key,packageId:key,demandId:pkg.demandId,pieces:pkg.pieces,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,key+':allocate')
    issueTmfProductionPackage({issueId:key,allocationId:key,packageId:key,demandId:pkg.demandId,warehouseId:order.targetWarehouseId,pieces:pkg.pieces},warehouse,key+':production-issue')
    receiveTmfProductionPackage({issueId:key,packageId:key,demandId:pkg.demandId,receiverOrganizationId:'PRODUCTION-01',pieces:pkg.pieces},productionReceiver,key+':production-receive')
  }
  const state=getTmfPurchaseState(),end=getTmfProductionDisposition(source.productionOrderId),demandIds=new Set(demands.map(d=>d.id))
  const continuous=state.lots.filter(l=>[order.purchaseOrderNo,extra.purchaseOrderNo].includes(l.sourcePurchaseOrderNo)).reduce((n,l)=>n+l.onHandMeters,0)
  const loss=state.cutOutputs.filter(o=>demandIds.has(o.demandId)).reduce((n,o)=>n+o.lossMeters,0)
  assert.equal(continuous,oracle.finalContinuousM);assert.equal(loss,oracle.totalCutLossM)
  assert.equal(end.productionReceivedPieces,oracle.productionReceivedPieces);assert.equal(end.scrappedPieces,oracle.scrappedPieces);assert.equal(end.scrappedEquivalentMeters,oracle.scrappedEquivalentM)
  assert.equal(end.pendingDefectivePieces,0);assert.equal(end.factoryPieces,oracle.frozenPieces)
  assert.ok(demands.every(d=>getTmfProductionDemandFulfillment(d.id).status==='已满足'))
  const metal=state.tipMaterialIssues.filter(i=>demandIds.has(i.demandId)&&i.materialSkuId===s.headMaterials.sku)
  assert.equal(metal.reduce((n,i)=>n+i.usedQty,0),oracle.metalHeads.installedInFinalGood)
  assert.equal(state.tipMaterialLots.find(l=>l.id===headLot)!.onHandQty,oracle.metalHeads.remaining)
  assert.equal(state.tipMaterialLots.find(l=>l.id===plasticLot)!.onHandQty,oracle.plasticHeads.remaining)
  assert.equal(state.tipMaterialIssues.find(i=>i.id===id+'-WRONG')!.usedQty,oracle.plasticHeads.installedInScrapped)
  assert.equal(continuous+oracle.productionEquivalentM+end.scrappedEquivalentMeters+loss,oracle.purchaseTotalM)
  assert.equal(parts.reduce((n,p)=>n+p.meters,0),oracle.supplementIssuedM)
  console.log(JSON.stringify({scenario:'B06',scope:'规范数量动作链；塑料头从仓库实收事实开始，补购基础生产未虚构纱线配方；不代表全部页面验收',continuous,productionReceived:end.productionReceivedPieces,scrapped:end.scrappedPieces,scrappedMeters:end.scrappedEquivalentMeters,loss,metalRemaining:oracle.metalHeads.remaining,plasticRemaining:oracle.plasticHeads.remaining}))
})

for (const scenarioId of ['N05', 'B17'] as const) test(`${scenarioId}合并批：120米采购→102米合并投入→两生产单各实收100，B17独立副本拆100为40+60`,async()=>{
  const fixture=JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json',import.meta.url),'utf8'))
  const s=fixture.normalScenarios.find((r:{id:string})=>r.id==='N05'),id=`FULL-${scenarioId}`,order=purchase(id,s.purchaseQuantityM,s.baseSku)
  await prepareWithRawMaterial(order,s.baseProductionInput);receiveTmfBaseProduction(receipt(order,s.purchaseQuantityM),warehouse,`${id}:base-receipt`)
  const sources=[productionSource(`${id}-PROD1`),productionSource(`${id}-PROD2`)]
  for(const source of sources){
    source.techPackSnapshot.bomItems[0].materialSkuId=s.baseSku
    source.demandSnapshot.skuLines=[{skuCode:`${source.productionOrderId}-S`,size:'S',color:'白',qty:100}]
    const cut=source.techPackSnapshot.processEntries[0]
    cut.inputMaterialSkuId=cut.outputMaterialSkuId=s.baseSku;cut.webbingSpecifications=[cut.webbingSpecifications![0]]
    registerTmfProductionOrder(source,planner,`${source.productionOrderId}:demand`)
  }
  const demands=sources.map(s=>getTmfPurchaseState().demands.find(d=>d.productionOrderId===s.productionOrderId)!)
  const lines=demands.map((d,i)=>({issueId:`${id}-ISS${i}`,reservationId:`${id}-RES${i}`,targetFactoryId:'FAC-TMF',dispatchedMeters:i===0?52:50}))
  for(const [i,demand] of demands.entries())reserveTmfContinuousMaterial({reservationId:lines[i].reservationId,demandId:demand.id,lotId:`${order.purchaseOrderNo}:batch`,reservedMeters:lines[i].dispatchedMeters,reason:'合并批102米，首行分摊损耗与退料'},planner,`${id}:reserve${i}`)
  const input={batchId:`${id}-MERGED`,lines,reason:'同SKU同加工规格的两生产单合并实际发料'}
  const before=getTmfPurchaseState()
  assert.throws(()=>issueTmfMergedContinuousMaterial({...input,lines:[lines[0],{...lines[1],dispatchedMeters:51}]},warehouse,`${id}:over`),/超过/)
  assert.deepEqual(getTmfPurchaseState(),before)
  assert.throws(()=>issueTmfMergedContinuousMaterial({...input,lines:[lines[0],lines[0]]},warehouse,`${id}:duplicate-line`),/不同占用/)
  issueTmfMergedContinuousMaterial(input,warehouse,`${id}:issue`)
  const issued=getTmfPurchaseState();issueTmfMergedContinuousMaterial(input,warehouse,`${id}:issue`);assert.deepEqual(getTmfPurchaseState(),issued)
  assert.equal(issued.lots.find(l=>l.id===`${order.purchaseOrderNo}:batch`)!.onHandMeters,18)
  assert.equal(issued.processingIssues.filter(i=>i.mergedBatchId===input.batchId).reduce((n,i)=>n+i.dispatchedMeters,0),s.issuedM)
  assert.equal(issued.operations.filter(o=>o.id===`${id}:issue`)[0].quantity,102)
  const mergedReceipt={batchId:input.batchId,materialSkuId:s.baseSku,lines:lines.map(l=>({issueId:l.issueId,receivedMeters:l.dispatchedMeters}))}
  assert.throws(()=>receiveTmfMergedProcessingMaterial({...mergedReceipt,lines:[mergedReceipt.lines[0],{...mergedReceipt.lines[1],receivedMeters:51}]},factory,`${id}:over-receive`),/超过/)
  assert.deepEqual(getTmfPurchaseState(),issued)
  receiveTmfMergedProcessingMaterial(mergedReceipt,factory,`${id}:receive`)
  const cut={batchId:input.batchId,actualCutLengthMm:500,actualFinishedLengthMm:500,reason:'总200条分两来源各100；第一行损耗1米',lines:lines.map((l,i)=>({issueId:l.issueId,outputId:`${id}-OUT${i}`,cutPieces:100,defectivePieces:0,lossMeters:i===0?1:0}))}
  const received=getTmfPurchaseState()
  assert.throws(()=>reportTmfMergedCutOutput({...cut,lines:[cut.lines[0],{...cut.lines[1],cutPieces:101}]},factory,`${id}:over-cut`),/超过本批实际接收量/)
  assert.deepEqual(getTmfPurchaseState(),received)
  reportTmfMergedCutOutput(cut,factory,`${id}:cut`)
  const produced=getTmfPurchaseState();reportTmfMergedCutOutput(cut,factory,`${id}:cut`);assert.deepEqual(getTmfPurchaseState(),produced)
  assert.equal(produced.cutOutputs.filter(o=>lines.some(l=>l.issueId===o.sourceIssueId)).reduce((n,o)=>n+o.goodPieces,0),200)
  assert.equal(produced.operations.find(o=>o.id===`${id}:cut`)!.quantity,200)
  dispatchTmfContinuousReturn({returnId:`${id}-RETURN`,issueId:lines[0].issueId,batchId:`${id}-RETURN-LOT`,returnedMeters:1,reason:'本批未截断余料'},factory,`${id}:return`)
  receiveTmfContinuousReturn({returnId:`${id}-RETURN`,warehouseId:order.targetWarehouseId,materialSkuId:s.baseSku,location:'RETURN-01',receivedMeters:1},warehouse,`${id}:return-receive`)
  for(const [i,demand] of demands.entries()){
    const pkg=`${id}-PKG${i}`,handoverId=`${pkg}-HAND`,allocationId=`${pkg}-ALLOC`,issueId=`${pkg}-FINAL`
    packTmfOutput({packageId:pkg,cutOutputId:cut.lines[i].outputId,pieces:100},factory,`${pkg}:pack`)
    dispatchTmfOutputPackage({handoverId,packageId:pkg,warehouseId:order.targetWarehouseId},factory,`${pkg}:handover`)
    receiveTmfOutputPackage({handoverId,packageId:pkg,warehouseId:order.targetWarehouseId,demandId:demand.id,location:'FINISHED-01',receivedPieces:100},warehouse,`${pkg}:receive`)
    if (scenarioId === 'B17' && i === 0) {
      const children = [{ id: `${pkg}-40`, pieces: 40 }, { id: `${pkg}-60`, pieces: 60 }]
      const supervisor: TmfPurchaseActor = { ...warehouse, role: '仓库主管' }
      const beforeSplit = getTmfPurchaseState()
      assert.throws(() => splitTmfOutputPackage(pkg, [{ ...children[0], pieces: 41 }, children[1]], supervisor, `${pkg}:bad-split`), /之和/)
      assert.deepEqual(getTmfPurchaseState(), beforeSplit)
      splitTmfOutputPackage(pkg, children, supervisor, `${pkg}:split`)
      const split = getTmfPurchaseState()
      splitTmfOutputPackage(pkg, children, supervisor, `${pkg}:split`)
      assert.deepEqual(getTmfPurchaseState(), split, '重复拆包不能复制子包库存')
      assert.throws(() => getTmfOutputPackageBalance(pkg), /已拆分/, '旧包不再作为可用库存返回')
      assert.throws(() => allocateTmfOutputPackage({ allocationId, packageId: pkg, demandId: demand.id, pieces: 100, receiverId: productionReceiver.id, receiverOrganizationId: 'PRODUCTION-01' }, planner, `${pkg}:old-scan`), /包号不属于/)
      assert.deepEqual(getTmfPurchaseState(), split, '原包再扫码/分配不改变任何账')
      for (const child of children) {
        const childRecord = getTmfPurchaseState().packages.find(item => item.id === child.id)!
        assert.equal(childRecord.parentPackageId, pkg)
        assert.equal(childRecord.cutOutputId, cut.lines[i].outputId)
        assert.equal(childRecord.demandId, demand.id)
        assert.equal(childRecord.materialSkuId, s.baseSku)
        allocateTmfOutputPackage({ allocationId: child.id, packageId: child.id, demandId: demand.id, pieces: child.pieces, receiverId: productionReceiver.id, receiverOrganizationId: 'PRODUCTION-01' }, planner, `${child.id}:allocate`)
        issueTmfProductionPackage({ issueId: child.id, allocationId: child.id, packageId: child.id, demandId: demand.id, warehouseId: order.targetWarehouseId, pieces: child.pieces }, warehouse, `${child.id}:issue`)
        assert.equal(getTmfOutputPackageBalance(child.id).productionTransitPieces, child.pieces)
        receiveTmfProductionPackage({ issueId: child.id, packageId: child.id, demandId: demand.id, receiverOrganizationId: 'PRODUCTION-01', pieces: child.pieces }, productionReceiver, `${child.id}:receive`)
        assert.equal(getTmfOutputPackageBalance(child.id).onHandPieces, 0)
        assert.equal(getTmfOutputPackageBalance(child.id).productionTransitPieces, 0)
      }
      assert.equal(getTmfProductionDemandFulfillment(demand.id).receivedPieces, 100)
      continue
    }
    const allocation={allocationId,packageId:pkg,demandId:demand.id,pieces:100,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'}
    const beforeWrong=getTmfPurchaseState()
    assert.throws(()=>allocateTmfOutputPackage({...allocation,demandId:demands[1-i].id},planner,`${pkg}:cross-order`),/不能混用/)
    assert.deepEqual(getTmfPurchaseState(),beforeWrong)
    allocateTmfOutputPackage(allocation,planner,`${pkg}:allocate`)
    assert.throws(()=>allocateTmfOutputPackage({...allocation,allocationId:`${pkg}-EXTRA`,pieces:1},planner,`${pkg}:double-allocate`),/可分配 0/)
    issueTmfProductionPackage({issueId,allocationId,packageId:pkg,demandId:demand.id,warehouseId:order.targetWarehouseId,pieces:100},warehouse,`${pkg}:issue`)
    receiveTmfProductionPackage({issueId,packageId:pkg,demandId:demand.id,receiverOrganizationId:'PRODUCTION-01',pieces:100},productionReceiver,`${pkg}:final-receive`)
    assert.equal(getTmfProductionDemandFulfillment(demand.id).receivedPieces,100)
    assert.equal(getTmfOutputPackageBalance(pkg).onHandPieces,0)
  }
  const end=getTmfPurchaseState(),remaining=end.lots.filter(l=>l.sourcePurchaseOrderNo===order.purchaseOrderNo).reduce((n,l)=>n+l.onHandMeters,0)
  assert.equal(remaining,19);assert.equal(remaining+100+1,120)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty,120)
  assert.ok(end.packages.filter(p=>demands.some(d=>d.id===p.demandId)).every(p=>p.materialSkuId===s.baseSku))
  assert.equal(getTmfBaseMaterialBalance(`${order.purchaseOrderNo}-RAW-ISS`).availableQty,s.baseProductionInput.remaining)
  console.log(JSON.stringify({scenario:scenarioId,mergedBatch:input.batchId,purchaseReceivedM:120,mergedIssuedM:102,mergedProducedPieces:200,productionReceivedByOrder:[100,100],warehouseContinuousM:remaining,lossM:1,returnedM:1}))
})


test('N01～N05基础原料重量账：源仓实收→发出→工厂实收→耗用/余料→原仓实收，与米制产出独立',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json',import.meta.url),'utf8'))
 for(const scenario of fixture.normalScenarios){
  const raw=scenario.baseProductionInput,id=`RAW-${scenario.id}`,order=purchase(id,scenario.purchaseQuantityM,scenario.baseSku)
  createTmfMaterialPurchase(order,buyer,`${id}:create`)
  advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR)
  generateTmfBaseOrder(order.purchaseOrderNo,factory,`${id}:generate`)
  const base=getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===order.purchaseOrderNo)!
  acceptTmfBaseOrder(base.id,factory,`${id}:accept`)
  const lot={id:`${id}-LOT`,materialSkuId:raw.materialSku,warehouseId:'YARN-WH',location:'Y-01',sourceReceiptNo:`${id}-SOURCE-RECEIPT`,sourceReceiptLineId:'L1',unit:'kg' as const,receivedQty:raw.received}
  receiveTmfBaseMaterialStock(lot,warehouse,`${id}:raw-stock`)
  const stocked=getTmfPurchaseState()
  assert.throws(()=>receiveTmfBaseMaterialStock({...lot,id:`${id}-DUP`},warehouse,`${id}:dup-source`),/已登记/)
  assert.deepEqual(getTmfPurchaseState(),stocked)
  dispatchTmfBaseMaterial({id:`${id}-ISS`,baseOrderId:base.id,lotId:lot.id,quantity:raw.received},warehouse,`${id}:raw-issue`)
  const issued=getTmfPurchaseState()
  assert.equal(issued.baseMaterialLots.find(l=>l.id===lot.id)!.onHandQty,0)
  assert.equal(getTmfBaseMaterialBalance(`${id}-ISS`).availableQty,0)
  const started=getTmfPurchaseState()
  assert.throws(()=>consumeTmfBaseMaterial({issueId:`${id}-ISS`,consumedQty:raw.consumed,scrapQty:0,reason:'实际称量'},factory,`${id}:early-use`),/不能超过/)
  assert.deepEqual(getTmfPurchaseState(),started)
  const receive={issueId:`${id}-ISS`,materialSkuId:raw.materialSku,unit:'kg' as const,quantity:raw.received}
  assert.throws(()=>receiveTmfBaseMaterial({...receive,unit:'g'},factory,`${id}:wrong-unit`),/单位不符/)
  receiveTmfBaseMaterial(receive,factory,`${id}:raw-receive`)
  const received=getTmfPurchaseState();receiveTmfBaseMaterial(receive,factory,`${id}:raw-receive`);assert.deepEqual(getTmfPurchaseState(),received)
  consumeTmfBaseMaterial({issueId:receive.issueId,consumedQty:raw.consumed,scrapQty:0,reason:'Mock实际耗用，非产米单耗'},factory,`${id}:consume`)
  reportTmfBaseProduction(base.id,scenario.purchaseQuantityM,factory,`${id}:produce`)
  assert.equal(getTmfBaseMaterialBalance(receive.issueId).availableQty,raw.returned+raw.remaining)
  dispatchTmfBaseMaterialReturn({id:`${id}-RETURN`,issueId:receive.issueId,quantity:raw.returned,reason:'未用原料回原仓'},factory,`${id}:return`)
  assert.equal(getTmfPurchaseState().baseMaterialLots.find(l=>l.id===lot.id)!.onHandQty,0)
  assert.equal(getTmfBaseMaterialBalance(receive.issueId).availableQty,raw.remaining)
  const returnInput={returnId:`${id}-RETURN`,warehouseId:lot.warehouseId,materialSkuId:raw.materialSku,unit:'kg' as const,quantity:raw.returned}
  const before=getTmfPurchaseState()
  assert.throws(()=>receiveTmfBaseMaterialReturn({...returnInput,quantity:raw.returned+1},warehouse,`${id}:over-return`),/超过/)
  assert.deepEqual(getTmfPurchaseState(),before)
  receiveTmfBaseMaterialReturn(returnInput,warehouse,`${id}:return-receive`)
  const returned=getTmfPurchaseState();receiveTmfBaseMaterialReturn(returnInput,warehouse,`${id}:return-receive`);assert.deepEqual(getTmfPurchaseState(),returned)
  assert.equal(returned.baseMaterialLots.find(l=>l.id===lot.id)!.receivedQty,raw.received)
  assert.equal(returned.baseMaterialLots.find(l=>l.id===lot.id)!.onHandQty,raw.returned)
  assert.equal(raw.received,raw.consumed+raw.returned+getTmfBaseMaterialBalance(receive.issueId).availableQty)
  dispatchTmfBaseProduction({baseOrderId:base.id,handoverId:`${order.purchaseOrderNo}:handover`,batchId:`${order.purchaseOrderNo}:batch`,dispatchedMeters:order.orderedQty},factory,`${id}:dispatch`)
  receiveTmfBaseProduction(receipt(order,order.orderedQty),warehouse,`${id}:base-receive`)
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.receivedQty,order.orderedQty)
  console.log(JSON.stringify({scenario:scenario.id,rawReceivedKg:raw.received,consumedKg:raw.consumed,returnedKg:raw.returned,factoryRemainingKg:raw.remaining,semiFinishedReceivedM:order.orderedQty}))
 }
})

test('主生产单暂停/取消直接限制织带执行，已发实收保留且取消处置释放未发占用',async()=>{
 const {productionOrderRuntimeStore}=await import('../../src/data/fcs/production-order-runtime-store.ts')
 const order=purchase('MAIN-CONTROL',100),source=productionSource('MAIN-CONTROL-PROD')
 prepare(order);receiveTmfBaseProduction(receipt(order,100),warehouse,'MAIN:base-receive')
 registerTmfProductionOrder(source,planner,'MAIN:demands')
 const demand=getTmfPurchaseState().demands.find(d=>d.productionOrderId===source.productionOrderId)!,lotId=`${order.purchaseOrderNo}:batch`
 const main={productionOrderId:source.productionOrderId,status:'EXECUTING' as import('../../src/data/fcs/production-order-runtime-store.ts').ProductionOrderRuntimeStatus,demandSnapshot:{spuCode:'MAIN-CONTROL'}}
 productionOrderRuntimeStore.push(main)
 try{
  reserveTmfContinuousMaterial({reservationId:'MAIN-RES',demandId:demand.id,lotId,reservedMeters:20,reason:''},planner,'MAIN:reserve')
  issueTmfContinuousMaterial({issueId:'MAIN-ISS',reservationId:'MAIN-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:10},warehouse,'MAIN:issue')
  main.status='ON_HOLD'
  assert.equal(getTmfPurchaseState().productionControls.find(c=>c.productionOrderId===main.productionOrderId)!.status,'ON_HOLD')
  const held=getTmfPurchaseState()
  assert.throws(()=>issueTmfContinuousMaterial({issueId:'MAIN-STOP',reservationId:'MAIN-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:1},warehouse,'MAIN:held-issue'),/已暂停/)
  assert.deepEqual(getTmfPurchaseState(),held)
  receiveTmfProcessingMaterial({issueId:'MAIN-ISS',factoryId:'FAC-TMF',materialSkuId:order.materialSkuId,receivedMeters:10},factory,'MAIN:transit-receive')
  const cut={outputId:'MAIN-OUT',issueId:'MAIN-ISS',cutPieces:20,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''}
  assert.throws(()=>reportTmfCutOutput(cut,factory,'MAIN:held-cut'),/已暂停/)
  changeTmfProductionControl({productionOrderId:main.productionOrderId,status:'ON_HOLD',reason:'主管复核',confirmed:true},planner,'MAIN:local-hold')
  assert.throws(()=>changeTmfProductionControl({productionOrderId:main.productionOrderId,status:'ACTIVE',reason:'尝试绕过主单',confirmed:true},planner,'MAIN:bad-resume'),/主生产单仍受限/)
  main.status='EXECUTING'
  assert.throws(()=>reportTmfCutOutput(cut,factory,'MAIN:local-held-cut'),/已暂停/)
  changeTmfProductionControl({productionOrderId:main.productionOrderId,status:'ACTIVE',reason:'主单恢复且主管已核对',confirmed:true},planner,'MAIN:resume')
  reportTmfCutOutput(cut,factory,'MAIN:cut')
  packTmfOutput({packageId:'MAIN-PACK',cutOutputId:'MAIN-OUT',pieces:20},factory,'MAIN:pack')
  dispatchTmfOutputPackage({handoverId:'MAIN-HAND',packageId:'MAIN-PACK',warehouseId:order.targetWarehouseId},factory,'MAIN:hand')
  receiveTmfOutputPackage({handoverId:'MAIN-HAND',packageId:'MAIN-PACK',warehouseId:order.targetWarehouseId,demandId:demand.id,location:'A',receivedPieces:20},warehouse,'MAIN:warehouse-receive')
  allocateTmfOutputPackage({allocationId:'MAIN-ALLOC',packageId:'MAIN-PACK',demandId:demand.id,pieces:20,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'MAIN:allocate')
  issueTmfProductionPackage({issueId:'MAIN-FINAL',allocationId:'MAIN-ALLOC',packageId:'MAIN-PACK',demandId:demand.id,warehouseId:order.targetWarehouseId,pieces:10},warehouse,'MAIN:final-issue')
  main.status='CANCELLED'
  assert.equal(getTmfProductionDisposition(main.productionOrderId).status,'CANCELLED')
  const cancelled=getTmfPurchaseState()
  assert.throws(()=>issueTmfProductionPackage({issueId:'MAIN-FINAL-BAD',allocationId:'MAIN-ALLOC',packageId:'MAIN-PACK',demandId:demand.id,warehouseId:order.targetWarehouseId,pieces:1},warehouse,'MAIN:cancelled-issue'),/已取消/)
  assert.deepEqual(getTmfPurchaseState(),cancelled)
  receiveTmfProductionPackage({issueId:'MAIN-FINAL',packageId:'MAIN-PACK',demandId:demand.id,receiverOrganizationId:'PRODUCTION-01',pieces:10},productionReceiver,'MAIN:received-in-transit')
  changeTmfProductionControl({productionOrderId:main.productionOrderId,status:'CANCELLED',reason:'主单取消，核对并释放未发占用',confirmed:true},planner,'MAIN:cancel-disposition')
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.reservedMeters,0)
  assert.equal(getTmfPurchaseState().outputAllocations.find(a=>a.id==='MAIN-ALLOC')!.releasedPieces,10)
  assert.equal(getTmfOutputPackageBalance('MAIN-PACK').onHandPieces,10)
  assert.equal(getTmfProductionDisposition(main.productionOrderId).productionReceivedPieces,10)
  assert.equal(getTmfPurchaseState().cutOutputs.find(o=>o.id==='MAIN-OUT')!.cutEquivalentMeters,10)
 }finally{productionOrderRuntimeStore.splice(productionOrderRuntimeStore.indexOf(main),1)}
})

test('冷启动及旧标签页均读取已保存主单限制，损坏来源不默许执行',async()=>{
 const {readProductionOrderRuntimeFact,CREATED_PRODUCTION_ORDERS_STORAGE_KEY,productionOrderRuntimeStore}=await import('../../src/data/fcs/production-order-runtime-store.ts')
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');let raw=JSON.stringify({version:1,orders:[{productionOrderId:'COLD-MAIN',status:'CANCELLED',demandSnapshot:{spuCode:'COLD'}}]})
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(key:string)=>key===CREATED_PRODUCTION_ORDERS_STORAGE_KEY?raw:null}}})
 try{
  assert.equal(readProductionOrderRuntimeFact('COLD-MAIN')!.status,'CANCELLED')
  assert.equal(readProductionOrderRuntimeFact('NO-MAIN'),undefined)
  const stale={productionOrderId:'COLD-MAIN',status:'EXECUTING' as const,demandSnapshot:{spuCode:'COLD'}}
  productionOrderRuntimeStore.push(stale)
  try {
   assert.equal(readProductionOrderRuntimeFact('COLD-MAIN')!.status,'CANCELLED','旧内存不能遮住另一页已保存的取消')
   for(const status of ['ON_HOLD','EXECUTING']){
    raw=JSON.stringify({version:1,orders:[{...stale,status}]})
    assert.equal(readProductionOrderRuntimeFact('COLD-MAIN')!.status,status)
   }
   raw='broken';assert.throws(()=>readProductionOrderRuntimeFact('COLD-MAIN'),/无法核对主生产单/)
  } finally {productionOrderRuntimeStore.splice(productionOrderRuntimeStore.indexOf(stale),1)}
  raw='broken';assert.throws(()=>readProductionOrderRuntimeFact('COLD-MAIN'),/无法核对主生产单/)
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window')}
})

test('印花交出按两种长度分配，原单分次实收唯一记账，随后截断/回仓/领料守恒',async()=>{
 const printing=await import('../../src/data/fcs/printing-task-domain.ts')
 const handover=await import('../../src/data/fcs/pda-handover-events.ts')
 const taskStore=await import('../../src/data/fcs/pda-task-mock-factory.ts')
 const receiving=await import('../../src/data/fcs/factory-receiving.ts')
 const receivingLinks=await import('../../src/data/fcs/factory-receiving-links.ts')
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const p=purchase('PRINTBACK',1000);p.materialImageUrl='/materials/tmf/webbing-real-roll.jpg'
 prepare(p);receiveTmfBaseProduction(receipt(p,1000),warehouse,'PRINTBACK:base-receipt')
 const lot=getTmfPurchaseState().lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo)!.id,source=productionSource('PRINTBACK-PROD'),cut=source.techPackSnapshot.processEntries[0]
 const printEntry={...structuredClone(cut),id:'PRINT',processCode:'PRINT',processName:'印花',inputMaterialSkuId:'WB30-WHT',inputMaterialSkuCode:'WB30-WHT',outputMaterialSkuId:'PATTERN',outputMaterialSkuCode:'PATTERN',inputInventoryForm:'CONTINUOUS' as const,outputInventoryForm:'CONTINUOUS' as const,outputMaterialSkuMode:'CHANGED' as const,predecessorEntryIds:[],webbingSpecifications:undefined}
 cut.inputMaterialSkuId=cut.outputMaterialSkuId='PATTERN';cut.predecessorEntryIds=['PRINT'];source.techPackSnapshot.processEntries=[printEntry,cut]
 const full={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)!),...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId,processWorkOrderDefinitions:[],auditLogs:[]}
 productionOrders.push(full)
 registerTmfProductionOrder(full,planner,'PRINTBACK:demands')
 const demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId)
 printing.registerFormalProductionOrderPrintWorkOrder({workOrderId:'PRINTBACK-PRINT',workOrderNo:'PRINTBACK-PRINT',sourceKey:'PRINTBACK-PRINT',processName:'印花',sourceSnapshot:{sourceType:'PRODUCTION_ORDER',productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,techPackVersionId:full.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:'PRINT',routeObjectKey:'BOM:BOM-WB',bomItemId:'BOM-WB'},productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,techPackVersionId:full.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:'PRINT',routeObjectKey:'BOM:BOM-WB',orderedAt:'2026-09-20 08:00:00',materialId:'WB30-WHT',materialName:'测试织带',materialItems:[{sourceBomItemId:'BOM-WB',materialId:'WB30-WHT',materialName:'测试织带',materialType:'辅料'}],inputMaterialSkuId:'WB30-WHT',inputMaterialSkuCode:'WB30-WHT',outputMaterialSkuId:'PATTERN',outputMaterialSkuCode:'PATTERN',plannedQty:650,qtyUnit:'米',processCodes:['PRINT'],spuCode:'TEST',spuName:'测试款式',requiredDeliveryDate:'2026-09-25'})
 printing.assignPrintingWorkOrder('PRINTBACK-PRINT',{factoryId:'F090',operatorName:'测试计划'})
 printing.linkTmfPrintCutContinuation('PRINTBACK-PRINT','CUT')
 // B09 在同一库存副本恢复到生产实收；印花交出仍是下方明确声明的外部夹具。
 const otherSource=productionSource('PRINTBACK-OTHER')
 registerTmfProductionOrder(otherSource,planner,'PRINTBACK:other-demand')
 const otherDemand=getTmfPurchaseState().demands.find(d=>d.productionOrderId===otherSource.productionOrderId)!
 reserveTmfContinuousMaterial({reservationId:'PRINTBACK-OTHER-RES',demandId:otherDemand.id,lotId:lot,reservedMeters:400,reason:'其他生产需求已占用'},planner,'PRINTBACK:other-reserve')
 const blockedReserve=getTmfPurchaseState()
 assert.throws(()=>reserveTmfContinuousMaterial({reservationId:'PRINTBACK-RES',demandId:demands[0].id,lotId:lot,reservedMeters:650,reason:'印花投入'},warehouse,'PRINTBACK:reserve'),/缺 50 米/)
 assert.deepEqual(getTmfPurchaseState(),blockedReserve)
 releaseTmfContinuousReservation('PRINTBACK-OTHER-RES',50,'其他需求确认释放50米',planner,'PRINTBACK:other-release')
 reserveTmfContinuousMaterial({reservationId:'PRINTBACK-RES',demandId:demands[0].id,lotId:lot,reservedMeters:650,reason:'印花投入'},warehouse,'PRINTBACK:reserve')
 await m.issueTmfUpstreamMaterial({issueId:'PRINTBACK-FIRST',reservationId:'PRINTBACK-RES',targetFactoryId:'F090',dispatchedMeters:650},warehouse,'PRINTBACK:issue')
 // 下游专项边界的外部事实夹具：印花已交出630米；原生印花生产链在下方先独立重放，不能把缺图产出冒充已正式交出。
 const order=printing.getPrintWorkOrderById('PRINTBACK-PRINT')!
 const headId='PRINTBACK-HEAD',recordId='PRINTBACK-RECORD'
 const task=taskStore.getPdaGenericProcessTaskById(order.taskId)!
 taskStore.registerPdaGenericProcessTask({...task,status:'IN_PROGRESS',startedAt:'2026-09-19 08:00:00'})
 handover.upsertPdaHandoverHeadMock({handoverId:headId,handoverOrderId:headId,handoverOrderNo:headId,headType:'HANDOUT',qrCodeValue:headId,taskId:order.taskId,taskNo:order.taskNo,sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,processName:'印花',processBusinessCode:'PRINT',sourceFactoryName:order.printFactoryName,sourceFactoryId:'F090',targetName:'TMF - 辅料厂',targetKind:'FACTORY',receiverKind:'FACTORY',receiverId:'FAC-TMF',receiverName:'TMF - 辅料厂',qtyUnit:'米',factoryId:'F090',taskStatus:'IN_PROGRESS',summaryStatus:'WAIT_RECEIVE',recordCount:1,pendingWritebackCount:1,writtenBackQtyTotal:0,sourceBusinessType:'PRINT_WORK_ORDER',sourceDocId:order.printOrderId,sourceDocNo:order.printOrderNo} as unknown as Parameters<typeof handover.upsertPdaHandoverHeadMock>[0])
 handover.upsertPdaHandoutRecordMock({recordId,handoverRecordId:recordId,handoverId:headId,handoverOrderId:headId,taskId:order.taskId,sequenceNo:1,submittedQty:630,qtyUnit:'米',factorySubmittedAt:'2026-09-19 10:00:00',factorySubmittedBy:'测试印花员',skuCode:'PATTERN',materialCode:'PATTERN',materialName:'测试印花织带',sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderNo:full.productionOrderNo,productionOrderId:full.productionOrderId,handoverRecordStatus:'WAIT_RECEIVE'} as unknown as Parameters<typeof handover.upsertPdaHandoutRecordMock>[0])
 const nativeHeadId='PRINTBACK-NATIVE-HEAD',nativeRecordId='PRINTBACK-NATIVE-RECORD'
 handover.upsertPdaHandoverHeadMock({handoverId:nativeHeadId,handoverOrderId:nativeHeadId,handoverOrderNo:nativeHeadId,headType:'HANDOUT',qrCodeValue:nativeHeadId,taskId:order.taskId,taskNo:order.taskNo,sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,processName:'印花',processBusinessCode:'PRINT',sourceFactoryName:order.printFactoryName,sourceFactoryId:'F090',targetName:'TMF - 辅料厂',targetKind:'FACTORY',receiverKind:'FACTORY',receiverId:'FAC-TMF',receiverName:'TMF - 辅料厂',qtyUnit:'米',factoryId:'F090',taskStatus:'IN_PROGRESS',summaryStatus:'WAIT_RECEIVE',recordCount:1,pendingWritebackCount:1,writtenBackQtyTotal:0,sourceBusinessType:'PRINT_WORK_ORDER',sourceDocId:order.printOrderId,sourceDocNo:order.printOrderNo} as unknown as Parameters<typeof handover.upsertPdaHandoverHeadMock>[0])
 handover.upsertPdaHandoutRecordMock({recordId:nativeRecordId,handoverRecordId:nativeRecordId,handoverId:nativeHeadId,handoverOrderId:nativeHeadId,taskId:order.taskId,sequenceNo:1,submittedQty:650,qtyUnit:'米',factorySubmittedAt:'2026-09-19 09:35:00',factorySubmittedBy:'辅料仓管',skuCode:'WB30-WHT',materialCode:'WB30-WHT',materialName:'测试织带',sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderNo:full.productionOrderNo,productionOrderId:full.productionOrderId,handoverRecordStatus:'WAIT_RECEIVE'} as unknown as Parameters<typeof handover.upsertPdaHandoutRecordMock>[0])
 // 先用同一正式生产单执行一次原生印花：仓库发料→F090实收→开工→印制→产出卷。
 // 产出仍故意不配置蓝色/花型实物图，后续交给TMF时由图片门禁阻断。
 const nativeSnapshot=printing.capturePrintProcessMutationState()
 const nativeSeed=nativeSnapshot.workOrders.find(([id])=>id===order.printOrderId)![1]
 nativeSeed.businessView!.requirement.frontPattern={patternNo:'B05-PATTERN',patternVersion:'V1',patternName:'B05已确认花型（缺少成品实物图）',imageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',imageAlt:'B05花型确认图'}
 printing.restorePrintProcessMutationState(nativeSnapshot)
 const sourceId='B05-ACTUAL-FIRST-SOURCE'
 receiving.registerFactoryReceivingSource({
  id:sourceId,documentNo:'B05-ACTUAL-FIRST-SOURCE',type:'HANDOUT',origin:{kind:'WAREHOUSE',id:p.targetWarehouseId,name:p.warehouse,warehouseAttribute:'辅料仓'},
  targetFactoryId:'F090',targetFactoryName:order.printFactoryName,createdAt:'2026-09-19 09:30:00',createdBy:'辅料仓管',handedOutAt:'2026-09-19 09:35:00',
  originalRecordId:nativeRecordId,workOrderNo:order.printOrderNo,processCode:'PRINT',lines:[{id:`${sourceId}-L1`,material:{sku:'WB30-WHT',name:'测试织带',kind:'ACCESSORY',imageUrl:'/materials/tmf/webbing-real-roll.jpg',color:'白色',composition:'涤纶',specification:'30mm',batchNo:'B05-ACTUAL-FIRST'},plannedQty:650,sentQty:650,unit:'米',rolls:[],label:'B05原生印花白坯织带 / WB30-WHT',printingOrderId:order.printOrderId,productionOrderNo:full.productionOrderNo,taskNo:order.taskNo,measurementBasis:'CONTINUOUS_LENGTH'}],
 })
 receiving.confirmFactorySourceHandout(sourceId,'辅料仓管','2026-09-19 09:35:00')
 const position=receiving.getDefaultFactoryReceiptPosition('F090')
 receivingLinks.confirmFactoryMaterialReceipt({id:'B05-ACTUAL-FIRST-RECEIPT',factoryId:'F090',operatorId:'F090-WAREHOUSE',operatorName:'F090仓管',receivedAt:'2026-09-19 10:00:00',remark:'B05原生印花投入按650米实收',lines:[{sourceId,sourceLineId:`${sourceId}-L1`,...position,businessQty:650,businessUnit:'米'}]})
 let nativeBusiness=printing.getPrintingWorkOrderById(order.printOrderId)!
 assert.equal(nativeBusiness.actualInput.receivedQty,650,'原生印花必须读取F090实际收料650米')
 printing.recordPrintingProductionStage(order.printOrderId,{id:'B05-NATIVE-ARTWORK',stage:'ARTWORK',action:'FINISH',operatorName:'测试印花员'})
 printing.recordPrintingProductionStage(order.printOrderId,{id:'B05-NATIVE-SAMPLE',stage:'SAMPLE',action:'FINISH',operatorName:'测试印花员'})
 printing.startPrintingProduction(order.printOrderId,{id:'B05-NATIVE-START',qty:650,operatorName:'测试印花员'})
 printing.recordPrintingProductionStage(order.printOrderId,{id:'B05-NATIVE-PRINT-START',stage:'PRINT',action:'START',operatorName:'测试印花员'})
 printing.recordPrintingProductionStage(order.printOrderId,{id:'B05-NATIVE-PRINT-FINISH',stage:'PRINT',action:'FINISH',qty:650,operatorName:'测试印花员'})
 printing.completePrintingWorkOrder(order.printOrderId,{usedQty:650,usedRollCount:0,completedQty:630,completedRollCount:1,printerNo:'B05-PRINT-01',operatorName:'测试印花员',batchId:'B05-NATIVE-BATCH',lossQty:20,finishOrder:true})
 nativeBusiness=printing.getPrintingWorkOrderById(order.printOrderId)!
 const nativeBarcode=nativeBusiness.barcodes.find(item=>item.batchId==='B05-NATIVE-BATCH')!
 printing.updatePrintingRollBarcode(order.printOrderId,nativeBarcode.id,{lengthY:630,gsm:180,widthCm:3,vatNo:'B05-NATIVE-ROLL',warehouseName:`${order.printFactoryName}待交出区`,remark:'B05原生印花产出卷'})
 printing.markPrintingRollBarcodesPrinted(order.printOrderId,[nativeBarcode.id],'测试印花员')
 nativeBusiness=printing.getPrintingWorkOrderById(order.printOrderId)!
 assert.equal(nativeBusiness.actualInput.usedQty,650)
 assert.equal(nativeBusiness.output.completedQty,630)
 assert.equal(nativeBusiness.productionBatches?.find(item=>item.id==='B05-NATIVE-BATCH')?.lossQty,20)
 assert.equal(nativeBusiness.barcodes.find(item=>item.id===nativeBarcode.id)?.status,'已打印')
 const nativeBeforeImageGate=printing.capturePrintProcessMutationState()
 assert.throws(()=>printing.handoverPrintingOutput(order.printOrderId,{qty:630,barcodeIds:[nativeBarcode.id],operatorName:'测试印花员',receiverName:'TMF - 辅料厂'}),/缺少印花后辅料 PATTERN 的对应实物图/)
 assert.deepEqual(printing.capturePrintProcessMutationState(),nativeBeforeImageGate,'缺图交出不能改变原生印花产出、条码或数量')
 printing.restorePrintProcessMutationState(nativeSnapshot)
 const snapshot=printing.capturePrintProcessMutationState(),stored=snapshot.workOrders.find(([id])=>id===order.printOrderId)![1]
 stored.handoverOrderId=headId;stored.businessView!.output.completedQty=630;stored.businessView!.output.sku='PATTERN';stored.businessView!.handover.handedOverQty=630
 stored.businessView!.barcodes=[{...stored.businessView!.barcodes[0],id:'PRINTBACK-ROLL',barcode:'PRINTBACK-ROLL',sku:'PATTERN',lengthY:630,meters:630,status:'已交出',handoverRecordId:recordId}]
 printing.restorePrintProcessMutationState(snapshot)
 const allocation={orderId:order.printOrderId,recordId,lines:demands.map((d,i)=>({issueId:`PRINTBACK-IN-${i}`,demandId:d.id,sourceIssueId:'PRINTBACK-FIRST',meters:i?425:205}))}
 const before=getTmfPurchaseState()
 await assert.rejects(()=>m.allocateTmfPrintHandover({...allocation,lines:allocation.lines.map(l=>({...l,meters:l.meters+1}))},factory,'PRINTBACK:over'),/超过印花/)
 assert.deepEqual(getTmfPurchaseState(),before)
 await m.allocateTmfPrintHandover(allocation,factory,'PRINTBACK:allocate');await m.allocateTmfPrintHandover(allocation,factory,'PRINTBACK:allocate')
 assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lot)!.onHandMeters,350)
 assert.equal(getTmfProcessingInputBalance('PRINTBACK-IN-0').receivedMeters,0)
 await assert.rejects(()=>m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'OTHER',receivedMeters:1},factory,'PRINTBACK:badsku'),/SKU/)
 await assert.rejects(()=>m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'PATTERN',receivedMeters:206},factory,'PRINTBACK:overreceive'),/超过/)
 await m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'PATTERN',receivedMeters:202.999},factory,'PRINTBACK:r203')
 await m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'PATTERN',receivedMeters:202.999},factory,'PRINTBACK:r203')
 await m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'PATTERN',receivedMeters:0.001},factory,'PRINTBACK:r001')
 assert.equal(getTmfProcessingInputBalance('PRINTBACK-IN-0').receivedMeters,203)
 await m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-0',materialSkuId:'PATTERN',receivedMeters:2},factory,'PRINTBACK:r2')
 await m.receiveTmfPrintMaterial({issueId:'PRINTBACK-IN-1',materialSkuId:'PATTERN',receivedMeters:425},factory,'PRINTBACK:r425')
 assert.equal(handover.findPdaHandoverRecord(recordId)!.receiverWrittenQty,630)
 assert.equal(printing.getPrintingWorkOrderById(order.printOrderId)!.handover.receivedQty,630)
 assert.throws(()=>receiveTmfProcessingMaterial({issueId:'PRINTBACK-IN-0',factoryId:'FAC-TMF',materialSkuId:'PATTERN',receivedMeters:1},factory,'PRINTBACK:local'),/原交出/)
 for(const [i,d] of demands.entries()){
  const issueId=`PRINTBACK-IN-${i}`,qty=i?600:400,len=i?700:500,out=`PRINTBACK-OUT-${i}`,pkg=`PRINTBACK-PKG-${i}`
  reportTmfCutOutput({outputId:out,issueId,cutPieces:qty,defectivePieces:0,actualCutLengthMm:len,actualFinishedLengthMm:len,lossMeters:1,reason:'测试损耗'},factory,`PRINTBACK:cut${i}`)
  dispatchTmfContinuousReturn({returnId:`PRINTBACK-RETURN-${i}`,issueId,batchId:`PRINTBACK-RETURN-LOT-${i}`,returnedMeters:4,reason:'剩余连续印花料'},factory,`PRINTBACK:return${i}`)
  receiveTmfContinuousReturn({returnId:`PRINTBACK-RETURN-${i}`,warehouseId:p.targetWarehouseId,materialSkuId:'PATTERN',location:'R-01',receivedMeters:4},warehouse,`PRINTBACK:returnrecv${i}`)
  packTmfOutput({packageId:pkg,cutOutputId:out,pieces:qty},factory,`PRINTBACK:pack${i}`)
  dispatchTmfOutputPackage({handoverId:`PRINTBACK-H-${i}`,packageId:pkg,warehouseId:p.targetWarehouseId},factory,`PRINTBACK:dispatch${i}`)
  receiveTmfOutputPackage({handoverId:`PRINTBACK-H-${i}`,packageId:pkg,warehouseId:p.targetWarehouseId,demandId:d.id,location:'P-01',receivedPieces:qty},warehouse,`PRINTBACK:receive${i}`)
  allocateTmfOutputPackage({allocationId:`PRINTBACK-A-${i}`,packageId:pkg,demandId:d.id,pieces:qty,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,`PRINTBACK:allocate-final${i}`)
  issueTmfProductionPackage({issueId:`PRINTBACK-FINAL-${i}`,allocationId:`PRINTBACK-A-${i}`,packageId:pkg,demandId:d.id,warehouseId:p.targetWarehouseId,pieces:qty},warehouse,`PRINTBACK:issue-final${i}`)
  receiveTmfProductionPackage({issueId:`PRINTBACK-FINAL-${i}`,packageId:pkg,demandId:d.id,receiverOrganizationId:'PRODUCTION-01',pieces:qty},productionReceiver,`PRINTBACK:receive-final${i}`)
  assert.equal(getTmfProductionDemandFulfillment(d.id).status,'已满足')
  assert.equal(getTmfOutputPackageBalance(pkg).onHandPieces,0)
  assert.equal(getTmfProcessingInputBalance(issueId).remainingMeters,0)
 }
 console.log(JSON.stringify({scenario:'PRINTBACK-source-fixture',nativePrint:{inputM:650,outputM:630,lossM:20,outputImage:'MISSING_BLOCKED'},sourceDispatched:630,actualReceived:630,cutMeters:620,lossMeters:2,returnedMeters:8,baseLeftMeters:350,scope:'原生印花650→630已独立重放；下游630米交出仍为专项夹具，不替代缺图正式交出或N01完整上游'}))
 const b09State=getTmfPurchaseState(),b09Base=b09State.lots.find(l=>l.id===lot)!
 const b09Result={basePhysicalM:b09Base.onHandMeters,otherReservedM:b09Base.reservedMeters,baseAvailableM:b09Base.onHandMeters-b09Base.reservedMeters-b09Base.frozenMeters,processedReturnM:b09State.lots.filter(l=>l.id.startsWith('PRINTBACK-RETURN-LOT-')).reduce((n,l)=>n+l.onHandMeters,0),productionPieces:demands.map(d=>getTmfProductionDemandFulfillment(d.id).receivedPieces)}
 assert.deepEqual(b09Result,{basePhysicalM:350,otherReservedM:350,baseAvailableM:0,processedReturnM:8,productionPieces:[400,600]})
 assert.equal(b09State.reservations.find(r=>r.id==='PRINTBACK-OTHER-RES')!.reservedMeters,350)
 assert.equal(getTmfProductionDemandFulfillment(otherDemand.id).receivedPieces,0)
 assert.throws(()=>reserveTmfContinuousMaterial({reservationId:'PRINTBACK-STEAL',demandId:demands[0].id,lotId:lot,reservedMeters:1,reason:'不能挪用其他需求'},planner,'PRINTBACK:steal'),/缺 1 米/)
 assert.deepEqual(getTmfPurchaseState(),b09State)
 console.log(JSON.stringify({scenario:'B09-downstream-recovery',...b09Result,scope:'含实际占用失败、释放、发料及印花回料后全链；原生印染20米损耗未执行，不是完整B09通过'}))
 // 以下是独立的回料再用契约；B09终点已在上述断言冻结，显式释放其它占用以开展后续路线防错。
 releaseTmfContinuousReservation('PRINTBACK-OTHER-RES',350,'独立回料再用测试清理占用',planner,'PRINTBACK:other-cleanup')
 // 同印花SKU的回仓连续余料接续新需求截断，不能因路线仍有印花而再次印花。
 const reuse=structuredClone(full);reuse.productionOrderId=reuse.productionOrderNo='PRINTREUSE-PROD'
 reuse.techPackSnapshot.productionOrderId=reuse.productionOrderId;reuse.techPackSnapshot.snapshotId='PRINTREUSE-SNAPSHOT';reuse.techPackSnapshot.sourceTechPackVersionId='PRINTREUSE-V1';reuse.selectedTechPackVersionId='PRINTREUSE-V1'
 reuse.demandSnapshot.skuLines[0].qty=8;reuse.demandSnapshot.skuLines[1].qty=0
 registerTmfProductionOrder(reuse,planner,'PRINTREUSE:demand')
 const rd=getTmfPurchaseState().demands.find(d=>d.productionOrderId===reuse.productionOrderId)!,returnLot='PRINTBACK-RETURN-LOT-0'
 assert.equal(m.getTmfContinuousLotEntry(rd.id,returnLot)!.id,'CUT')
 assert.equal(m.getTmfContinuousLotEntry(rd.id,lot)!.id,'PRINT')
 const beforeReuse=getTmfPurchaseState(),upstreamBefore=printing.getPrintingWorkOrderById(order.printOrderId)!.handover.receivedQty
 assert.throws(()=>reserveTmfContinuousMaterial({reservationId:'PRINTREUSE-OVER',demandId:rd.id,lotId:returnLot,reservedMeters:5,reason:'试超量'},planner,'PRINTREUSE:over'),/缺/)
 assert.deepEqual(getTmfPurchaseState(),beforeReuse)
 const reserve={reservationId:'PRINTREUSE',demandId:rd.id,lotId:returnLot,reservedMeters:4,reason:'使用同花型回仓余料直接截断'}
 reserveTmfContinuousMaterial(reserve,planner,'PRINTREUSE:reserve');reserveTmfContinuousMaterial(reserve,planner,'PRINTREUSE:reserve')
 assert.equal(getTmfPurchaseState().reservations.find(r=>r.id==='PRINTREUSE')!.targetRouteEntryId,'CUT')
 assert.throws(()=>issueTmfContinuousMaterial({issueId:'PRINTREUSE',reservationId:'PRINTREUSE',targetFactoryId:'F090',dispatchedMeters:4},warehouse,'PRINTREUSE:wrong-factory'),/正确加工厂/)
 issueTmfContinuousMaterial({issueId:'PRINTREUSE',reservationId:'PRINTREUSE',targetFactoryId:'FAC-TMF',dispatchedMeters:4},warehouse,'PRINTREUSE:issue')
 const newIssue=getTmfPurchaseState().processingIssues.find(i=>i.id==='PRINTREUSE')!
 assert.equal(newIssue.materialSkuId,'PATTERN');assert.equal(newIssue.targetRouteEntryId,'CUT');assert.equal(newIssue.upstream,undefined);assert.equal(newIssue.receivedMeters,0)
 receiveTmfProcessingMaterial({issueId:'PRINTREUSE',factoryId:'FAC-TMF',materialSkuId:'PATTERN',receivedMeters:4},factory,'PRINTREUSE:receive')
 reportTmfCutOutput({outputId:'PRINTREUSE',issueId:'PRINTREUSE',cutPieces:8,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''},factory,'PRINTREUSE:cut')
 packTmfOutput({packageId:'PRINTREUSE',cutOutputId:'PRINTREUSE',pieces:8},factory,'PRINTREUSE:pack')
 dispatchTmfOutputPackage({handoverId:'PRINTREUSE',packageId:'PRINTREUSE',warehouseId:p.targetWarehouseId},factory,'PRINTREUSE:hand')
 receiveTmfOutputPackage({handoverId:'PRINTREUSE',packageId:'PRINTREUSE',warehouseId:p.targetWarehouseId,demandId:rd.id,location:'R-02',receivedPieces:8},warehouse,'PRINTREUSE:stock')
 allocateTmfOutputPackage({allocationId:'PRINTREUSE',packageId:'PRINTREUSE',demandId:rd.id,pieces:8,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'PRINTREUSE:allocate')
 issueTmfProductionPackage({issueId:'PRINTREUSE',allocationId:'PRINTREUSE',packageId:'PRINTREUSE',demandId:rd.id,warehouseId:p.targetWarehouseId,pieces:8},warehouse,'PRINTREUSE:prod')
 receiveTmfProductionPackage({issueId:'PRINTREUSE',packageId:'PRINTREUSE',demandId:rd.id,receiverOrganizationId:'PRODUCTION-01',pieces:8},productionReceiver,'PRINTREUSE:end')
 assert.equal(getTmfProductionDemandFulfillment(rd.id).status,'已满足')
 assert.equal(getTmfPurchaseState().lots.find(l=>l.id===returnLot)!.onHandMeters,0)
 assert.equal(getTmfPurchaseState().lots.find(l=>l.id==='PRINTBACK-RETURN-LOT-1')!.onHandMeters,4)
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.receivedQty,1000)
 assert.equal(printing.getPrintingWorkOrderById(order.printOrderId)!.handover.receivedQty,upstreamBefore)
 assert.equal(getTmfPurchaseState().continuousReturns.find(r=>r.id==='PRINTBACK-RETURN-0')!.receivedMeters,4)
 // 首道白料依然必须走印花，不能利用新接续能力绕过路线。
 reserveTmfContinuousMaterial({reservationId:'PRINTREUSE-RAW',demandId:rd.id,lotId:lot,reservedMeters:1,reason:'验证首道料的路线防错'},planner,'PRINTREUSE:raw-reserve')
 const rawReserved=getTmfPurchaseState()
 assert.throws(()=>issueTmfContinuousMaterial({issueId:'PRINTREUSE-RAW',reservationId:'PRINTREUSE-RAW',targetFactoryId:'FAC-TMF',dispatchedMeters:1},warehouse,'PRINTREUSE:raw-bypass'),/首道为印染/)
 assert.deepEqual(getTmfPurchaseState(),rawReserved)
 releaseTmfContinuousReservation('PRINTREUSE-RAW',1,'路线防错验证后释放',planner,'PRINTREUSE:raw-release')
})

test('主单离页保存保留其他页取消及新增单，同单并发编辑和存储失败不覆盖',async()=>{
 const {persistCreatedProductionOrders,CREATED_PRODUCTION_ORDERS_STORAGE_KEY}=await import('../../src/data/fcs/production-orders.ts')
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
 let raw:string|null=null,fail=false
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:(_key:string,value:string)=>{if(fail)throw new Error('测试保存失败');raw=value}}})
 const main={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)!),productionOrderId:'CROSS-SAVE-MAIN',productionOrderNo:'CROSS-SAVE-MAIN',status:'EXECUTING' as const}
 productionOrders.push(main)
 try{
  persistCreatedProductionOrders([main.productionOrderId])
  const saved=JSON.parse(raw!),remote=saved.orders.find((o:{productionOrderId:string})=>o.productionOrderId===main.productionOrderId)
  remote.status='CANCELLED';saved.orders.push({...structuredClone(remote),productionOrderId:'OTHER-TAB-NEW'})
  raw=JSON.stringify(saved)
  persistCreatedProductionOrders()
  assert.equal(main.status,'CANCELLED','旧页未修改时接收最新取消状态')
  assert.equal(JSON.parse(raw!).orders.length,2,'保留其他页新增主单')
  main.status='EXECUTING'
  const newer=JSON.parse(raw!);newer.orders[0].status='ON_HOLD';raw=JSON.stringify(newer)
  const beforeConflict=raw
  assert.throws(()=>persistCreatedProductionOrders(),/其他页面修改/)
  assert.equal(raw,beforeConflict)
  main.status='CANCELLED' as typeof main.status
  fail=true;assert.throws(()=>persistCreatedProductionOrders(),/测试保存失败/)
  assert.equal(main.status,'CANCELLED','保存失败不提前覆盖本页内存')
  assert.equal(raw,beforeConflict)
  fail=false;persistCreatedProductionOrders()
  assert.equal(main.status,'ON_HOLD')
 }finally{
  productionOrders.splice(productionOrders.indexOf(main),1)
  if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')
 }
})

test('技术包换版后旧规格冻结，已交出的仓库及生产在途可实收且不改旧长度',async()=>{
 const {productionOrderRuntimeStore}=await import('../../src/data/fcs/production-order-runtime-store.ts')
 const p=purchase('VERSION-HOLD',100),source=productionSource('VERSION-HOLD-PROD')
 prepare(p);receiveTmfBaseProduction(receipt(p,100),warehouse,'VH:base')
 registerTmfProductionOrder(source,planner,'VH:demands')
 const d=getTmfPurchaseState().demands.find(d=>d.productionOrderId===source.productionOrderId)!,lotId=`${p.purchaseOrderNo}:batch`
 const main={...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId}
 productionOrderRuntimeStore.push(main)
 try{
  reserveTmfContinuousMaterial({reservationId:'VH-RES',demandId:d.id,lotId,reservedMeters:30,reason:''},planner,'VH:reserve')
  issueTmfContinuousMaterial({issueId:'VH-IN',reservationId:'VH-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:20},warehouse,'VH:issue')
  receiveTmfProcessingMaterial({issueId:'VH-IN',factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:20},factory,'VH:receive')
  reportTmfCutOutput({outputId:'VH-OUT',issueId:'VH-IN',cutPieces:20,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''},factory,'VH:cut')
  packTmfOutput({packageId:'VH-PKG',cutOutputId:'VH-OUT',pieces:20},factory,'VH:pack')
  dispatchTmfOutputPackage({handoverId:'VH-H',packageId:'VH-PKG',warehouseId:p.targetWarehouseId},factory,'VH:dispatch')
  receiveTmfOutputPackage({handoverId:'VH-H',packageId:'VH-PKG',warehouseId:p.targetWarehouseId,demandId:d.id,location:'P-01',receivedPieces:10},warehouse,'VH:partial')
  allocateTmfOutputPackage({allocationId:'VH-A',packageId:'VH-PKG',demandId:d.id,pieces:10,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'VH:allocate')
  issueTmfProductionPackage({issueId:'VH-PROD',allocationId:'VH-A',packageId:'VH-PKG',demandId:d.id,warehouseId:p.targetWarehouseId,pieces:5},warehouse,'VH:prodissue')
  main.techPackSnapshot=structuredClone(main.techPackSnapshot)
  main.techPackSnapshot.snapshotId='VH-SNAPSHOT-V2';main.techPackSnapshot.sourceTechPackVersionId='VH-TECH-V2';main.selectedTechPackVersionId='VH-TECH-V2'
  main.techPackSnapshot.processEntries[0].webbingSpecifications![0].cutLengthMm=550
  main.techPackSnapshot.processEntries[0].webbingSpecifications![0].finishedLengthMm=550
  const held=getTmfPurchaseState()
  assert.equal(getTmfProductionDemandFulfillment(d.id).status,'变更待处理')
  assert.equal(getTmfOutputPackageBalance('VH-PKG').availablePieces,0)
  assert.throws(()=>issueTmfContinuousMaterial({issueId:'VH-OLD-IN',reservationId:'VH-RES',targetFactoryId:'FAC-TMF',dispatchedMeters:1},warehouse,'VH:oldissue'),/技术包采用版本已变化/)
  assert.throws(()=>reportTmfCutOutput({outputId:'VH-OLD-OUT',issueId:'VH-IN',cutPieces:1,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''},factory,'VH:oldcut'),/技术包采用版本已变化/)
  assert.throws(()=>issueTmfProductionPackage({issueId:'VH-OLD-PROD',allocationId:'VH-A',packageId:'VH-PKG',demandId:d.id,warehouseId:p.targetWarehouseId,pieces:1},warehouse,'VH:oldprod'),/技术包采用版本已变化/)
  assert.deepEqual(getTmfPurchaseState(),held)
  assert.equal(readTmfOutputReceiptScan('VH-PKG',p.targetWarehouseId).restricted,true)
  receiveTmfOutputPackage({handoverId:'VH-H',packageId:'VH-PKG',warehouseId:p.targetWarehouseId,demandId:d.id,location:'P-01',receivedPieces:10},warehouse,'VH:receive-rest')
  receiveTmfProductionPackage({issueId:'VH-PROD',packageId:'VH-PKG',demandId:d.id,receiverOrganizationId:'PRODUCTION-01',pieces:5},productionReceiver,'VH:prod-receive')
  const balance=getTmfOutputPackageBalance('VH-PKG')
  assert.equal(balance.onHandPieces,15);assert.equal(balance.productionReceivedPieces,5);assert.equal(balance.availablePieces,0)
  assert.equal(getTmfPurchaseState().packages.find(p=>p.id==='VH-PKG')!.actualCutLengthMm,500)
  assert.throws(()=>readTmfOutputReceiptScan('VH-PKG',p.targetWarehouseId),/已收齐/)
 }finally{productionOrderRuntimeStore.splice(productionOrderRuntimeStore.indexOf(main),1)}
})

test('未发料换版释放旧占用，新需求从备料至生产实收，旧预览和已执行重算阻断',async()=>{
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const {productionOrderRuntimeStore}=await import('../../src/data/fcs/production-order-runtime-store.ts')
 const p=purchase('REPLAN',100),source=productionSource('REPLAN-PROD')
 source.demandSnapshot.skuLines[0].qty=40;source.demandSnapshot.skuLines[1].qty=60
 prepare(p);receiveTmfBaseProduction(receipt(p,100),warehouse,'RP:base')
 registerTmfProductionOrder(source,planner,'RP:demand')
 const old=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId),lotId=`${p.purchaseOrderNo}:batch`
 reserveTmfContinuousMaterial({reservationId:'RP-OLD',demandId:old[0].id,lotId,reservedMeters:20,reason:''},planner,'RP:reserve-old')
 const main={...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId}
 productionOrderRuntimeStore.push(main)
 try{
  main.techPackSnapshot=structuredClone(main.techPackSnapshot);main.techPackSnapshot.snapshotId='RP-SNAP-2';main.techPackSnapshot.sourceTechPackVersionId='RP-TECH-2';main.selectedTechPackVersionId='RP-TECH-2'
  main.techPackSnapshot.processEntries[0].webbingSpecifications!.forEach(s=>{s.cutLengthMm+=50;s.finishedLengthMm+=50})
  main.selectedTechPackVersionId='RP-WRONG';assert.throws(()=>m.getTmfVersionReplanReview(main.productionOrderId),/选择版本与采用快照不一致/);main.selectedTechPackVersionId='RP-TECH-2'
  const input={productionOrderId:main.productionOrderId,expectedReview:JSON.stringify(m.getTmfVersionReplanReview(main.productionOrderId)),reason:'采用新长度，旧单尚未发料',confirmed:true}
  releaseTmfContinuousReservation('RP-OLD',1,'部分释放',planner,'RP:release-one')
  assert.throws(()=>m.replanTmfUnstartedVersion(input,planner,'RP:stale'),/占用已变化/)
  input.expectedReview=JSON.stringify(m.getTmfVersionReplanReview(main.productionOrderId))
  assert.throws(()=>m.replanTmfUnstartedVersion(input,factory,'RP:role'),/当前角色/)
  m.replanTmfUnstartedVersion(input,planner,'RP:replan');m.replanTmfUnstartedVersion(input,planner,'RP:replan')
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.reservedMeters,0)
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.onHandMeters,100)
  const next=getTmfPurchaseState().demands.filter(d=>d.techPackSnapshotId==='RP-SNAP-2')
  assert.equal(next.length,2);assert.equal(getTmfPurchaseState().demands.find(d=>d.id===old[0].id)!.specification.cutLengthMm,500)
  assert.equal(getTmfProductionDemandFulfillment(old[0].id).status,'已换版保留')
  registerTmfProductionOrder(main,planner,'RP:generate-again')
  for(const [i,d] of next.entries()){
   const id=`RP-NEW-${i}`,meters=d.theoreticalCutMeters,pieces=d.requiredPieces
   reserveTmfContinuousMaterial({reservationId:id,demandId:d.id,lotId,reservedMeters:meters,reason:''},planner,id+'-reserve')
   issueTmfContinuousMaterial({issueId:id,reservationId:id,targetFactoryId:'FAC-TMF',dispatchedMeters:meters},warehouse,id+'-issue')
   receiveTmfProcessingMaterial({issueId:id,factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:meters},factory,id+'-receive')
   reportTmfCutOutput({outputId:id,issueId:id,cutPieces:pieces,defectivePieces:0,actualCutLengthMm:d.specification.cutLengthMm,actualFinishedLengthMm:d.specification.finishedLengthMm,lossMeters:0,reason:''},factory,id+'-cut')
   packTmfOutput({packageId:id,cutOutputId:id,pieces},factory,id+'-pack')
   dispatchTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId},factory,id+'-dispatch')
   receiveTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId,demandId:d.id,location:'RP-01',receivedPieces:pieces},warehouse,id+'-wh')
   allocateTmfOutputPackage({allocationId:id,packageId:id,demandId:d.id,pieces,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,id+'-allocate')
   issueTmfProductionPackage({issueId:id,allocationId:id,packageId:id,demandId:d.id,warehouseId:p.targetWarehouseId,pieces},warehouse,id+'-prod')
   receiveTmfProductionPackage({issueId:id,packageId:id,demandId:d.id,receiverOrganizationId:'PRODUCTION-01',pieces},productionReceiver,id+'-end')
   assert.equal(getTmfProductionDemandFulfillment(d.id).status,'已满足')
  }
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.onHandMeters,33)
  main.techPackSnapshot=structuredClone(main.techPackSnapshot);main.techPackSnapshot.snapshotId='RP-SNAP-3';main.techPackSnapshot.sourceTechPackVersionId='RP-TECH-3';main.selectedTechPackVersionId='RP-TECH-3'
  input.expectedReview=JSON.stringify(m.getTmfVersionReplanReview(main.productionOrderId))
  const before=getTmfPurchaseState();assert.throws(()=>m.replanTmfUnstartedVersion(input,planner,'RP:executed'),/已有发料或加工/)
  assert.throws(()=>m.replanTmfVersionWithFrozenOutputs(input,planner,'RP:already-used'),/已有生产发料或实收/);assert.deepEqual(getTmfPurchaseState(),before)
 }finally{productionOrderRuntimeStore.splice(productionOrderRuntimeStore.indexOf(main),1)}
})

test('已加工换版：旧200条冻结并释放未发分配，新550/700mm需求实收1000条，旧预览失效且库存守恒',async()=>{
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const {productionOrderRuntimeStore}=await import('../../src/data/fcs/production-order-runtime-store.ts')
 const p=purchase('FROZEN-REPLAN',1000),source=productionSource('FROZEN-REPLAN-PROD'),lotId=p.purchaseOrderNo+':batch'
 prepare(p);receiveTmfBaseProduction(receipt(p,1000),warehouse,'FR:base')
 registerTmfProductionOrder(source,planner,'FR:demand')
 const old=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId)
 reserveTmfContinuousMaterial({reservationId:'FR-INPUT',demandId:old[0].id,lotId,reservedMeters:200,reason:''},planner,'FR:reserve')
 issueTmfContinuousMaterial({issueId:'FR-INPUT',reservationId:'FR-INPUT',targetFactoryId:'FAC-TMF',dispatchedMeters:200},warehouse,'FR:issue')
 receiveTmfProcessingMaterial({issueId:'FR-INPUT',factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:200},factory,'FR:receive')
 reportTmfCutOutput({outputId:'FR-OLD',issueId:'FR-INPUT',cutPieces:200,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:''},factory,'FR:cut')
 packTmfOutput({packageId:'FR-OLD',cutOutputId:'FR-OLD',pieces:200},factory,'FR:pack')
 dispatchTmfOutputPackage({handoverId:'FR-OLD',packageId:'FR-OLD',warehouseId:p.targetWarehouseId},factory,'FR:hand')
 const receiveOld={handoverId:'FR-OLD',packageId:'FR-OLD',warehouseId:p.targetWarehouseId,demandId:old[0].id,location:'OLD-01',receivedPieces:100}
 receiveTmfOutputPackage(receiveOld,warehouse,'FR:first-receipt')
 allocateTmfOutputPackage({allocationId:'FR-OLD',packageId:'FR-OLD',demandId:old[0].id,pieces:50,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'FR:allocate-old')
 reserveTmfContinuousMaterial({reservationId:'FR-UNISSUED',demandId:old[1].id,lotId,reservedMeters:50,reason:''},planner,'FR:unissued')
 const main={...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId}
 productionOrderRuntimeStore.push(main)
 try{
  main.techPackSnapshot=structuredClone(main.techPackSnapshot);main.techPackSnapshot.snapshotId='FR-SNAP-2';main.techPackSnapshot.sourceTechPackVersionId='FR-TECH-2';main.selectedTechPackVersionId='FR-TECH-2'
  main.techPackSnapshot.processEntries[0].webbingSpecifications![0].cutLengthMm=550;main.techPackSnapshot.processEntries[0].webbingSpecifications![0].finishedLengthMm=550
  const review=m.getTmfVersionReplanReview(main.productionOrderId),input={productionOrderId:main.productionOrderId,expectedReview:JSON.stringify(review),reason:'旧200条按500mm冻结，新版按550/700mm重新加工',confirmed:true}
  assert.equal(review.executed,true);assert.equal(review.blockedByProductionIssue,false)
  assert.equal(review.physical.outputs[0].cutPieces,200);assert.equal(review.physical.issues[0].balance.remainingMeters,100)
  // 版本未变，但另一仓管收完旧在途；旧预览也必须失效。
  receiveTmfOutputPackage(receiveOld,warehouse,'FR:last-receipt')
  const afterReceive=getTmfPurchaseState()
  assert.throws(()=>m.replanTmfVersionWithFrozenOutputs(input,planner,'FR:stale'),/旧实物发生收发/)
  assert.deepEqual(getTmfPurchaseState(),afterReceive)
  input.expectedReview=JSON.stringify(m.getTmfVersionReplanReview(main.productionOrderId))
  assert.throws(()=>m.replanTmfVersionWithFrozenOutputs({...input,confirmed:false},planner,'FR:confirm'),/确认/)
  assert.throws(()=>m.replanTmfVersionWithFrozenOutputs(input,factory,'FR:role'),/当前角色/)
  m.replanTmfVersionWithFrozenOutputs(input,planner,'FR:replan');m.replanTmfVersionWithFrozenOutputs(input,planner,'FR:replan')
  assert.deepEqual(getTmfPurchaseState().cutOutputs,afterReceive.cutOutputs)
  assert.equal(getTmfPurchaseState().packages.find(p=>p.id==='FR-OLD')!.versionFreeze!.pieces,200); assert.equal(getTmfOutputPackageBalance('FR-OLD').availablePieces,0)
  assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.reservedMeters,0)
  assert.equal(getTmfPurchaseState().outputAllocations.find(a=>a.id==='FR-OLD')!.releasedPieces,50)
  assert.equal(getTmfOutputPackageBalance('FR-OLD').onHandPieces,200)
  assert.equal(getTmfOutputPackageBalance('FR-OLD').availablePieces,0)
  const next=getTmfPurchaseState().demands.filter(d=>d.techPackSnapshotId==='FR-SNAP-2')
  assert.equal(next.length,2)
  const fixture=JSON.parse(readFileSync(new URL('../../docs/product-design/tmf-webbing/mock-full-flow.json',import.meta.url),'utf8'))
  const oracle=fixture.recoveryOracles.B14
  assert.equal(p.orderedQty,oracle.originalPurchaseReceivedM,'B14原采购实收保持1000米，不因换版重算改写')
  assert.equal(next.reduce((meters,n)=>meters+n.theoreticalCutMeters,0),oracle.productionEquivalentM,'B14新版550/700mm需求保持640米理论下料')
  assert.equal(getTmfOutputPackageBalance('FR-OLD').onHandPieces,oracle.oldFrozen50Pieces,'B14旧500mm产出冻结200条')
  assert.throws(()=>allocateTmfOutputPackage({allocationId:'FR-WRONG',packageId:'FR-OLD',demandId:next[0].id,pieces:1,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'FR:mix-old'),/不能混用/)
  assert.throws(()=>issueTmfProductionPackage({issueId:'FR-WRONG',allocationId:'FR-OLD',packageId:'FR-OLD',demandId:old[0].id,warehouseId:p.targetWarehouseId,pieces:1},warehouse,'FR:old-issue'),/已暂停/)
  // 原厂内100米仍独立退回；换版本身没有把它变成新版本投入。
  dispatchTmfContinuousReturn({returnId:'FR-RETURN',issueId:'FR-INPUT',batchId:'FR-RETURN-LOT',returnedMeters:100,reason:'换版后旧连续余料回仓'},factory,'FR:return')
  receiveTmfContinuousReturn({returnId:'FR-RETURN',warehouseId:p.targetWarehouseId,materialSkuId:p.materialSkuId,location:'RETURN-01',receivedMeters:100},warehouse,'FR:return-receive')
  for(const [i,d] of next.entries()){
   const id=`FR-NEW-${i}`,meters=d.theoreticalCutMeters,pieces=d.requiredPieces
   reserveTmfContinuousMaterial({reservationId:id,demandId:d.id,lotId,reservedMeters:meters,reason:''},planner,id+':reserve')
   issueTmfContinuousMaterial({issueId:id,reservationId:id,targetFactoryId:'FAC-TMF',dispatchedMeters:meters},warehouse,id+':issue')
   receiveTmfProcessingMaterial({issueId:id,factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:meters},factory,id+':receive')
   reportTmfCutOutput({outputId:id,issueId:id,cutPieces:pieces,defectivePieces:0,actualCutLengthMm:d.specification.cutLengthMm,actualFinishedLengthMm:d.specification.finishedLengthMm,lossMeters:0,reason:''},factory,id+':cut')
   packTmfOutput({packageId:id,cutOutputId:id,pieces},factory,id+':pack')
   dispatchTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId},factory,id+':hand')
   receiveTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId,demandId:d.id,location:'NEW-01',receivedPieces:pieces},warehouse,id+':stock')
   allocateTmfOutputPackage({allocationId:id,packageId:id,demandId:d.id,pieces,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,id+':allocate')
   issueTmfProductionPackage({issueId:id,allocationId:id,packageId:id,demandId:d.id,warehouseId:p.targetWarehouseId,pieces},warehouse,id+':prod')
   receiveTmfProductionPackage({issueId:id,packageId:id,demandId:d.id,receiverOrganizationId:'PRODUCTION-01',pieces},productionReceiver,id+':end')
  }
  assert.ok(next.every(d=>getTmfProductionDemandFulfillment(d.id).status==='已满足'))
  assert.equal(getTmfProductionDisposition(source.productionOrderId).productionReceivedPieces,1000)
  assert.equal(getTmfOutputPackageBalance('FR-OLD').onHandPieces,200);assert.equal(getTmfOutputPackageBalance('FR-OLD').availablePieces,0)
  assert.equal(getTmfPurchaseState().packages.find(p=>p.id==='FR-OLD')!.actualCutLengthMm,500)
  const balance=getTmfPurchaseState().lots.filter(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo).reduce((n,l)=>n+l.onHandMeters,0)
  assert.equal(balance,260);assert.equal(balance+100+640,1000)
 }finally{productionOrderRuntimeStore.splice(productionOrderRuntimeStore.indexOf(main),1)}
})

test('B05实际410/590错配：短条余量冻结，连续余料8米补10条700mm至两规格生产实收',async()=>{
 const printing=await import('../../src/data/fcs/printing-task-domain.ts')
 const handover=await import('../../src/data/fcs/pda-handover-events.ts')
 const taskStore=await import('../../src/data/fcs/pda-task-mock-factory.ts')
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const p=purchase('B05-ACTUAL',1000);p.materialImageUrl='/materials/tmf/webbing-real-roll.jpg'
 prepare(p);receiveTmfBaseProduction(receipt(p,1000),warehouse,'B05-ACTUAL:base-receipt')
 const lot=getTmfPurchaseState().lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo)!.id,source=productionSource('B05-ACTUAL-PROD'),cut=source.techPackSnapshot.processEntries[0]
 const printEntry={...structuredClone(cut),id:'PRINT',processCode:'PRINT',processName:'印花',inputMaterialSkuId:'WB30-WHT',inputMaterialSkuCode:'WB30-WHT',outputMaterialSkuId:'PATTERN',outputMaterialSkuCode:'PATTERN',inputInventoryForm:'CONTINUOUS' as const,outputInventoryForm:'CONTINUOUS' as const,outputMaterialSkuMode:'CHANGED' as const,predecessorEntryIds:[],webbingSpecifications:undefined}
 cut.inputMaterialSkuId=cut.outputMaterialSkuId='PATTERN';cut.predecessorEntryIds=['PRINT'];source.techPackSnapshot.processEntries=[printEntry,cut]
 const full={...structuredClone(productionOrders.find(o=>o.techPackSnapshot)!),...source,selectedTechPackVersionId:source.techPackSnapshot.sourceTechPackVersionId,processWorkOrderDefinitions:[],auditLogs:[]}
 productionOrders.push(full)
 registerTmfProductionOrder(full,planner,'B05-ACTUAL:demands')
 const demands=getTmfPurchaseState().demands.filter(d=>d.productionOrderId===source.productionOrderId)
 printing.registerFormalProductionOrderPrintWorkOrder({workOrderId:'B05-ACTUAL-PRINT',workOrderNo:'B05-ACTUAL-PRINT',sourceKey:'B05-ACTUAL-PRINT',processName:'印花',sourceSnapshot:{sourceType:'PRODUCTION_ORDER',productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,techPackVersionId:full.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:'PRINT',routeObjectKey:'BOM:BOM-WB',bomItemId:'BOM-WB'},productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,techPackVersionId:full.techPackSnapshot.sourceTechPackVersionId,techPackVersionLabel:'V1',processEntryId:'PRINT',routeObjectKey:'BOM:BOM-WB',orderedAt:'2026-09-20 08:00:00',materialId:'WB30-WHT',materialName:'测试织带',materialItems:[{sourceBomItemId:'BOM-WB',materialId:'WB30-WHT',materialName:'测试织带',materialType:'辅料'}],inputMaterialSkuId:'WB30-WHT',inputMaterialSkuCode:'WB30-WHT',outputMaterialSkuId:'PATTERN',outputMaterialSkuCode:'PATTERN',plannedQty:650,qtyUnit:'米',processCodes:['PRINT'],spuCode:'TEST',spuName:'测试款式',requiredDeliveryDate:'2026-09-25'})
 printing.assignPrintingWorkOrder('B05-ACTUAL-PRINT',{factoryId:'F090',operatorName:'测试计划'})
 printing.linkTmfPrintCutContinuation('B05-ACTUAL-PRINT','CUT')
 reserveTmfContinuousMaterial({reservationId:'B05-ACTUAL-RES',demandId:demands[0].id,lotId:lot,reservedMeters:650,reason:'印花投入'},warehouse,'B05-ACTUAL:reserve')
 await m.issueTmfUpstreamMaterial({issueId:'B05-ACTUAL-FIRST',reservationId:'B05-ACTUAL-RES',targetFactoryId:'F090',dispatchedMeters:650},warehouse,'B05-ACTUAL:issue')
 // 专项边界的外部事实夹具：印花已交出630米；本测试不冒充印花生产/图片/打印流程已执行。
 const order=printing.getPrintWorkOrderById('B05-ACTUAL-PRINT')!
 const headId='B05-ACTUAL-HEAD',recordId='B05-ACTUAL-RECORD'
 const task=taskStore.getPdaGenericProcessTaskById(order.taskId)!
 taskStore.registerPdaGenericProcessTask({...task,status:'IN_PROGRESS',startedAt:'2026-09-19 08:00:00'})
 handover.upsertPdaHandoverHeadMock({handoverId:headId,handoverOrderId:headId,handoverOrderNo:headId,headType:'HANDOUT',qrCodeValue:headId,taskId:order.taskId,taskNo:order.taskNo,sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderId:full.productionOrderId,productionOrderNo:full.productionOrderNo,processName:'印花',processBusinessCode:'PRINT',sourceFactoryName:order.printFactoryName,sourceFactoryId:'F090',targetName:'TMF - 辅料厂',targetKind:'FACTORY',receiverKind:'FACTORY',receiverId:'FAC-TMF',receiverName:'TMF - 辅料厂',qtyUnit:'米',factoryId:'F090',taskStatus:'IN_PROGRESS',summaryStatus:'WAIT_RECEIVE',recordCount:1,pendingWritebackCount:1,writtenBackQtyTotal:0,sourceBusinessType:'PRINT_WORK_ORDER',sourceDocId:order.printOrderId,sourceDocNo:order.printOrderNo} as unknown as Parameters<typeof handover.upsertPdaHandoverHeadMock>[0])
 handover.upsertPdaHandoutRecordMock({recordId,handoverRecordId:recordId,handoverId:headId,handoverOrderId:headId,taskId:order.taskId,sequenceNo:1,submittedQty:630,qtyUnit:'米',factorySubmittedAt:'2026-09-19 10:00:00',factorySubmittedBy:'测试印花员',skuCode:'PATTERN',materialCode:'PATTERN',materialName:'测试印花织带',sourceType:'PRODUCTION_ORDER',sourceSnapshot:order.sourceSnapshot,productionOrderNo:full.productionOrderNo,productionOrderId:full.productionOrderId,handoverRecordStatus:'WAIT_RECEIVE'} as unknown as Parameters<typeof handover.upsertPdaHandoutRecordMock>[0])
 const snapshot=printing.capturePrintProcessMutationState(),stored=snapshot.workOrders.find(([id])=>id===order.printOrderId)![1]
 stored.handoverOrderId=headId;stored.businessView!.output.completedQty=630;stored.businessView!.output.sku='PATTERN';stored.businessView!.handover.handedOverQty=630
 stored.businessView!.barcodes=[{...stored.businessView!.barcodes[0],id:'B05-ACTUAL-ROLL',barcode:'B05-ACTUAL-ROLL',sku:'PATTERN',lengthY:630,meters:630,status:'已交出',handoverRecordId:recordId}]
 printing.restorePrintProcessMutationState(snapshot)
 // 正式织带印花产出没有自己的实物图时，不能借用白坯投入图交给 TMF；
 // 本副本刻意保留缺图，验证门禁不会先写交出事实。真实蓝色/花型图补齐后才可重放正常交出。
 const missingImageSnapshot=printing.capturePrintProcessMutationState(),missingImageOrder=missingImageSnapshot.workOrders.find(([id])=>id===order.printOrderId)![1]
 missingImageOrder.businessView!.handover.handedOverQty=0
 missingImageOrder.businessView!.output.imageUrl=''
 missingImageOrder.businessView!.barcodes[0].status='待交出'
 printing.restorePrintProcessMutationState(missingImageSnapshot)
 assert.throws(() => printing.handoverPrintingOutput(order.printOrderId, {
  qty: 630, barcodeIds: ['B05-ACTUAL-ROLL'], operatorName: '测试印花员', receiverName: 'TMF - 辅料厂',
 }), /缺少印花后辅料 PATTERN 的对应实物图/)
 printing.restorePrintProcessMutationState(snapshot)

 const whSupervisor={...warehouse,role:'仓库主管' as const}
 await m.allocateTmfPrintHandover({orderId:order.printOrderId,recordId,lines:demands.map((d,i)=>({issueId:`B05-IN-${i}`,demandId:d.id,sourceIssueId:'B05-ACTUAL-FIRST',meters:i?425:205}))},factory,'B05:allocate-input')
 for(const [i,d] of demands.entries()){
  await m.receiveTmfPrintMaterial({issueId:`B05-IN-${i}`,materialSkuId:'PATTERN',receivedMeters:i?425:205},factory,`B05:receive-input${i}`)
  reportTmfCutOutput({outputId:`B05-OUT-${i}`,issueId:`B05-IN-${i}`,cutPieces:i?590:410,defectivePieces:0,actualCutLengthMm:i?700:500,actualFinishedLengthMm:i?700:500,lossMeters:i?2:0,reason:'B05实际规格错配，短条多10、长条少10'},factory,`B05:cut${i}`)
 }
 assert.equal(projectTmfWorkOrders(getTmfPurchaseState()).find(o=>o.productionOrderId===full.productionOrderId)!.processingStatus,'加工中')
 assert.equal(getTmfProcessingInputBalance('B05-IN-1').remainingMeters,10)
 dispatchTmfContinuousReturn({returnId:'B05-RETURN',issueId:'B05-IN-1',batchId:'B05-RETURN-LOT',returnedMeters:10,reason:'连续印花余料回仓备补做'},factory,'B05:return')
 receiveTmfContinuousReturn({returnId:'B05-RETURN',warehouseId:p.targetWarehouseId,materialSkuId:'PATTERN',location:'R-01',receivedMeters:10},warehouse,'B05:return-receive')
 for(const [id,outputId,demandId,pieces] of [['B05-S','B05-OUT-0',demands[0].id,400],['B05-S-EXTRA','B05-OUT-0',demands[0].id,10],['B05-M','B05-OUT-1',demands[1].id,590]] as const){
  packTmfOutput({packageId:id,cutOutputId:outputId,pieces},factory,id+':pack')
  dispatchTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId},factory,id+':dispatch')
  receiveTmfOutputPackage({handoverId:id,packageId:id,warehouseId:p.targetWarehouseId,demandId,location:'P-01',receivedPieces:pieces},warehouse,id+':receipt')
 }
 const freeze={packageId:'B05-S-EXTRA',expectedPieces:10,reason:'500mm多做10条，独立冻结待处置，不能抵700mm缺口',confirmed:true}
 assert.throws(()=>m.freezeTmfSurplusPackage(freeze,warehouse,'B05:badrole'),/权限|角色|身份/)
 assert.throws(()=>m.freezeTmfSurplusPackage(freeze,whSupervisor,'B05:early-freeze'),/尚未足额分配/)
 for(const [i,id,qty] of [[0,'B05-S',400],[1,'B05-M',590]] as const){
  const allocation={allocationId:id,packageId:id,demandId:demands[i].id,pieces:qty,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'}
  allocateTmfOutputPackage(allocation,planner,id+':allocate')
  issueTmfProductionPackage({issueId:id,allocationId:id,packageId:id,demandId:demands[i].id,warehouseId:p.targetWarehouseId,pieces:qty},warehouse,id+':issue')
  receiveTmfProductionPackage({issueId:id,packageId:id,demandId:demands[i].id,receiverOrganizationId:'PRODUCTION-01',pieces:qty},productionReceiver,id+':receive')
 }
 assert.equal(getTmfProductionDemandFulfillment(demands[0].id).shortagePieces,0)
 assert.equal(getTmfProductionDemandFulfillment(demands[1].id).shortagePieces,10)
 const beforeFreeze=getTmfPurchaseState()
 assert.throws(()=>m.freezeTmfSurplusPackage({...freeze,confirmed:false},whSupervisor,'B05:unconfirmed'),/再次确认/)
 assert.throws(()=>m.freezeTmfSurplusPackage({...freeze,expectedPieces:11},whSupervisor,'B05:stale'),/实存已变化/)
 assert.deepEqual(getTmfPurchaseState(),beforeFreeze)
 m.freezeTmfSurplusPackage(freeze,whSupervisor,'B05:freeze');m.freezeTmfSurplusPackage(freeze,whSupervisor,'B05:freeze')
 assert.equal(getTmfOutputPackageBalance(freeze.packageId).onHandPieces,10)
 assert.equal(getTmfOutputPackageBalance(freeze.packageId).availablePieces,0)
 assert.throws(()=>splitTmfOutputPackage(freeze.packageId,[{id:'B05-ESCAPE-1',pieces:5},{id:'B05-ESCAPE-2',pieces:5}],whSupervisor,'B05:split-frozen'),/冻结/)
 assert.throws(()=>allocateTmfOutputPackage({allocationId:'B05-WRONG-M',packageId:freeze.packageId,demandId:demands[1].id,pieces:10,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'B05:wrong-length'),/不属于此生产需求/)
 assert.throws(()=>allocateTmfOutputPackage({allocationId:'B05-FROZEN',packageId:freeze.packageId,demandId:demands[0].id,pieces:10,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'B05:frozen-allocate'),/可分配 0/)
 // 从同一印花连续回料批次补做，不能新造8米或更改第一次截断结果。
 reserveTmfContinuousMaterial({reservationId:'B05-SUP',demandId:demands[1].id,lotId:'B05-RETURN-LOT',reservedMeters:8,reason:'补足700mm10条'},warehouse,'B05:sup-reserve')
 issueTmfContinuousMaterial({issueId:'B05-SUP',reservationId:'B05-SUP',targetFactoryId:'FAC-TMF',dispatchedMeters:8},warehouse,'B05:sup-issue')
 receiveTmfProcessingMaterial({issueId:'B05-SUP',factoryId:'FAC-TMF',materialSkuId:'PATTERN',receivedMeters:8},factory,'B05:sup-receive')
 reportTmfCutOutput({outputId:'B05-SUP',issueId:'B05-SUP',cutPieces:10,defectivePieces:0,actualCutLengthMm:700,actualFinishedLengthMm:700,lossMeters:0.5,reason:'补做10条；切口损耗0.5米'},factory,'B05:sup-cut')
 dispatchTmfContinuousReturn({returnId:'B05-SUP',issueId:'B05-SUP',batchId:'B05-SUP-RETURN',returnedMeters:0.5,reason:'补做后连续余料'},factory,'B05:sup-return')
 receiveTmfContinuousReturn({returnId:'B05-SUP',warehouseId:p.targetWarehouseId,materialSkuId:'PATTERN',location:'R-01',receivedMeters:0.5},warehouse,'B05:sup-return-receive')
 packTmfOutput({packageId:'B05-SUP',cutOutputId:'B05-SUP',pieces:10},factory,'B05:sup-pack')
 dispatchTmfOutputPackage({handoverId:'B05-SUP',packageId:'B05-SUP',warehouseId:p.targetWarehouseId},factory,'B05:sup-dispatch')
 receiveTmfOutputPackage({handoverId:'B05-SUP',packageId:'B05-SUP',warehouseId:p.targetWarehouseId,demandId:demands[1].id,location:'P-01',receivedPieces:10},warehouse,'B05:sup-warehouse')
 allocateTmfOutputPackage({allocationId:'B05-SUP',packageId:'B05-SUP',demandId:demands[1].id,pieces:10,receiverId:productionReceiver.id,receiverOrganizationId:'PRODUCTION-01'},planner,'B05:sup-allocate')
 issueTmfProductionPackage({issueId:'B05-SUP-FINAL',allocationId:'B05-SUP',packageId:'B05-SUP',demandId:demands[1].id,warehouseId:p.targetWarehouseId,pieces:10},warehouse,'B05:sup-final')
 receiveTmfProductionPackage({issueId:'B05-SUP-FINAL',packageId:'B05-SUP',demandId:demands[1].id,receiverOrganizationId:'PRODUCTION-01',pieces:10},productionReceiver,'B05:sup-production')
 const final=getTmfPurchaseState(),returns=final.lots.filter(l=>['B05-RETURN-LOT','B05-SUP-RETURN'].includes(l.id)).reduce((n,l)=>n+l.onHandMeters,0)
 assert.equal(returns,2.5)
 assert.deepEqual(demands.map(d=>getTmfProductionDemandFulfillment(d.id).receivedPieces),[400,600])
 assert.equal(final.packages.find(p=>p.id==='B05-S-EXTRA')!.surplusFreeze!.pieces,10)
 assert.equal(final.packages.find(p=>p.id==='B05-S-EXTRA')!.actualCutLengthMm,500)
 assert.equal(final.cutOutputs.filter(o=>['B05-OUT-0','B05-OUT-1','B05-SUP'].includes(o.id)).reduce((n,o)=>n+o.lossMeters,0),2.5)
 assert.equal(final.lots.find(l=>l.id===lot)!.onHandMeters,350)
 assert.equal(620+5+returns+2.5,630,'630米印花来料=生产620+冻结短条5+连续余2.5+截断损2.5')
 console.log(JSON.stringify({scenario:'B05-cut-recovery',received:[400,600],frozenPieces:10,frozenLengthMm:500,continuous:2.5,cutLoss:2.5,upstreamScope:'印花630米已交出为外部专项夹具，不冒充原生印染20米损耗或全N01'}))
})


test('加工计划时间独立保存：明确时区、并发版本阻断、实际节点不倒推开完工且库存不变',async()=>{
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const times=await import('../../src/data/fcs/tmf-work-order-times.ts')
 const source=productionSource('WORK-TIMES')
 registerTmfProductionOrder(source,planner,'WORK-TIMES:generate')
 const id=JSON.stringify([source.productionOrderId,source.techPackSnapshot.snapshotId,'CUT'])
 const input={workOrderId:id,responsibleName:'Mock织带主管',plannedStartAt:'2026-09-20T09:00:00+07:00',plannedFinishAt:'2026-09-20T17:00:00+07:00',waitingReason:'待辅料仓发料',reason:'现场排期确认',expectedRevision:0}
 const before=getTmfPurchaseState()
 assert.throws(()=>m.saveTmfWorkPlan(input,warehouse,'WORK-TIMES:bad-role'),/权限|角色|身份/)
 for(const value of ['2026-09-20T09:00','2026-02-30T09:00:00+07:00','2026-13-01T09:00:00+07:00'])assert.throws(()=>m.saveTmfWorkPlan({...input,plannedStartAt:value},planner,'WORK-TIMES:bad-date'),/日期|时区/)
 assert.throws(()=>m.saveTmfWorkPlan({...input,plannedFinishAt:input.plannedStartAt},planner,'WORK-TIMES:bad-order'),/晚于/)
 assert.deepEqual(getTmfPurchaseState(),before)
 m.saveTmfWorkPlan(input,planner,'WORK-TIMES:save');m.saveTmfWorkPlan(input,planner,'WORK-TIMES:save')
 let data=getTmfPurchaseState(),plan=data.workPlans.find(p=>p.workOrderId===id)!
 assert.equal(plan.revision,1);assert.equal(plan.plannedStartAt,'2026-09-20T02:00:00.000Z')
 assert.deepEqual({...data,workPlans:before.workPlans,operations:before.operations},before,'计划不更改数量、工艺、库存及原单')
 assert.throws(()=>m.saveTmfWorkPlan({...input,responsibleName:'旧页面'},factory,'WORK-TIMES:stale'),/其他操作更新/)
 m.saveTmfWorkPlan({...input,plannedFinishAt:'2026-09-20T18:00:00+07:00',waitingReason:'仍待发料',reason:'计划延后一小时',expectedRevision:1},factory,'WORK-TIMES:revise')
 data=getTmfPurchaseState()
 const t=times.projectTmfWorkTimes(data,id,'2026-09-20T12:00:00Z')
 assert.equal(t.plannedDurationHours,9);assert.equal(t.planFinishPassed,true)
 assert.equal(t.firstReceivedAt,undefined);assert.equal(t.firstReportedAt,undefined);assert.equal(t.elapsedHours,null)
 assert.equal(times.tmfJakartaInput(plan.plannedStartAt),'2026-09-20T09:00')
 assert.equal(times.formatTmfWorkTime('2026-09-20 09:00'),'2026-09-20 09:00（原记录未标时区）')
 assert.equal(data.operations.filter(o=>o.objectId===id&&o.action==='登记加工计划时间').length,2)
 changeTmfProductionControl({productionOrderId:source.productionOrderId,status:'ON_HOLD',reason:'核对生产变更',confirmed:true},planner,'WORK-TIMES:pause')
 assert.throws(()=>m.saveTmfWorkPlan({...input,expectedRevision:2},factory,'WORK-TIMES:paused'),/暂停/)
})

test('加工单费用按技术包需求计价：单位、币种和版本可追溯，库存与实收不被费用动作改变',async()=>{
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const source=productionSource('WORK-COST');registerTmfProductionOrder(source,planner,'WORK-COST:generate')
 const id=JSON.stringify([source.productionOrderId,source.techPackSnapshot.snapshotId,'CUT'])
 const before=getTmfPurchaseState()
 assert.equal(getTmfWorkCost(id),undefined)
 assert.deepEqual(getTmfWorkCostReview(id).quantities,{meters:620,pieces:1000})
 const input={workOrderId:id,unitPrice:2.5,currency:'CNY' as const,pricingUnit:'条' as const,reason:'确认本批织带加工报价',confirmed:true,expectedRevision:0}
 assert.throws(()=>saveTmfWorkCost(input,warehouse,'WORK-COST:role'),/权限|角色|身份/)
 assert.throws(()=>saveTmfWorkCost({...input,confirmed:false},planner,'WORK-COST:confirm'),/确认/)
 assert.throws(()=>saveTmfWorkCost({...input,unitPrice:-1},planner,'WORK-COST:price'),/单价/)
 assert.deepEqual(getTmfPurchaseState(),before)
 saveTmfWorkCost(input,planner,'WORK-COST:save');saveTmfWorkCost(input,planner,'WORK-COST:save')
 let data=getTmfPurchaseState(),cost=getTmfWorkCost(id)!
 assert.deepEqual({cost:cost.unitPrice,currency:cost.currency,unit:cost.pricingUnit,quantity:cost.pricingQuantity,amount:cost.estimatedAmount,revision:cost.revision},{cost:2.5,currency:'CNY',unit:'条',quantity:1000,amount:2500,revision:1})
 assert.equal(data.operations.filter(o=>o.objectId===id&&o.action==='登记加工单费用').length,1)
 assert.throws(()=>saveTmfWorkCost({...input,unitPrice:3,reason:'旧页面'},factory,'WORK-COST:stale'),/费用口径已由其他操作更新/)
 saveTmfWorkCost({...input,pricingUnit:'米',unitPrice:1.25,reason:'改按理论下料米数报价',expectedRevision:1},factory,'WORK-COST:revise')
 cost=getTmfWorkCost(id)!
 assert.deepEqual({unit:cost.pricingUnit,quantity:cost.pricingQuantity,amount:cost.estimatedAmount,revision:cost.revision},{unit:'米',quantity:620,amount:775,revision:2})
 assert.deepEqual({...getTmfPurchaseState(),workCosts:before.workCosts,operations:before.operations},before,'费用登记不改变库存、需求或生产事实')
})

test('织带加工单没有接单或开工门禁，投入实收后可直接加工填报', async () => {
 const source=productionSource('DIRECT-REPORT-PROD');source.demandSnapshot.skuLines=[{skuCode:'DIRECT-REPORT-S',size:'S',color:'白',qty:100}]
 source.techPackSnapshot.processEntries[0].webbingSpecifications=[source.techPackSnapshot.processEntries[0].webbingSpecifications![0]]
 registerTmfProductionOrder(source,planner,'DIRECT-REPORT:demand')
 const demand=getTmfPurchaseState().demands.find(d=>d.productionOrderId===source.productionOrderId)!
 const p=purchase('DIRECT-REPORT',60,demand.sourceMaterialSkuId);prepare(p)
 receiveTmfBaseProduction(receipt(p,60),warehouse,'DIRECT-REPORT:base-receive')
 reserveTmfContinuousMaterial({reservationId:'DIRECT-REPORT-R',demandId:demand.id,lotId:p.purchaseOrderNo+':batch',reservedMeters:50,reason:'按技术包投入'},warehouse,'DIRECT-REPORT:reserve')
 issueTmfContinuousMaterial({issueId:'DIRECT-REPORT-I',reservationId:'DIRECT-REPORT-R',targetFactoryId:'FAC-TMF',dispatchedMeters:50},warehouse,'DIRECT-REPORT:issue')
 receiveTmfProcessingMaterial({issueId:'DIRECT-REPORT-I',factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:50},factory,'DIRECT-REPORT:receive')
 reportTmfCutOutput({outputId:'DIRECT-REPORT-O',issueId:'DIRECT-REPORT-I',cutPieces:100,defectivePieces:0,actualCutLengthMm:500,actualFinishedLengthMm:500,lossMeters:0,reason:'确认接收后直接加工填报'},factory,'DIRECT-REPORT:output')
 const projected=projectTmfWorkOrders(getTmfPurchaseState()).find(o=>o.productionOrderId===source.productionOrderId)!
 assert.equal(projected.processingStatus,'合格产出达量')
 assert.equal(getTmfPurchaseState().operations.some(o=>/接单|开工/.test(o.action)&&o.objectId===projected.id),false)
})

test('B23未执行采购1000减900：版本留痕、旧预览阻断、重接单后900实际生产实收',()=>{
 const p=purchase('B23-REDUCE',1000)
 createTmfMaterialPurchase(p,buyer,'B23-REDUCE:create')
 advancePmsMaterialPurchaseOrderStatus(p.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR)
 generateTmfBaseOrder(p.purchaseOrderNo,factory,'B23-REDUCE:generate')
 const baseId=getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===p.purchaseOrderNo)!.id
 acceptTmfBaseOrder(baseId,factory,'B23-REDUCE:accept-before')
 const input={orderedQty:900,expectedVersion:1,reason:'未开工基础备货减100米',confirmed:true}
 const before=getTmfPurchaseState()
 assert.throws(()=>reviseTmfMaterialPurchase(p.purchaseOrderNo,input,factory,'B23-REDUCE:role'),/当前角色/)
 assert.throws(()=>reviseTmfMaterialPurchase(p.purchaseOrderNo,{...input,confirmed:false},buyer,'B23-REDUCE:confirm'),/确认/)
 assert.deepEqual(getTmfPurchaseState(),before)
 reviseTmfMaterialPurchase(p.purchaseOrderNo,input,buyer,'B23-REDUCE:revise')
 reviseTmfMaterialPurchase(p.purchaseOrderNo,input,buyer,'B23-REDUCE:revise')
 const changed=getTmfPurchaseState(),base=changed.baseOrders.find(b=>b.id===baseId)!
 assert.equal(base.plannedMeters,900);assert.equal(base.purchaseVersion,2);assert.equal(base.acceptedAt,undefined)
 assert.equal(base.planRevisions!.length,1)
 assert.deepEqual([base.planRevisions![0].beforeMeters,base.planRevisions![0].afterMeters,base.planRevisions![0].producedMetersAtChange],[1000,900,0])
 assert.equal(base.planRevisions![0].confirmedBy,buyer.id)
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.receivedQty,0)
 assert.throws(()=>reviseTmfMaterialPurchase(p.purchaseOrderNo,{...input,orderedQty:800},buyer,'B23-REDUCE:stale'),/版本已变化/)
 assert.deepEqual(getTmfPurchaseState(),changed)
 assert.throws(()=>reportTmfBaseProduction(baseId,1,factory,'B23-REDUCE:early-report'),/确认接收/)
 acceptTmfBaseOrder(baseId,factory,'B23-REDUCE:accept')
  assert.throws(()=>reportTmfBaseProduction(baseId,1000,factory,'B23-REDUCE:over'),/二次确认/)
 reportTmfBaseProduction(baseId,900,factory,'B23-REDUCE:produce')
 dispatchTmfBaseProduction({baseOrderId:baseId,handoverId:`${p.purchaseOrderNo}:handover`,batchId:`${p.purchaseOrderNo}:batch`,dispatchedMeters:900},factory,'B23-REDUCE:dispatch')
 receiveTmfBaseProduction(receipt(p,900),warehouse,'B23-REDUCE:receive')
 const end=getTmfPurchaseState()
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.orderedQty,900)
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.receivedQty,900)
 assert.equal(end.lots.find(l=>l.sourcePurchaseOrderNo===p.purchaseOrderNo)!.onHandMeters,900)
 assert.equal(end.baseOrders.find(b=>b.id===baseId)!.planRevisions!.length,1)
})


test('B24实收1000退100：仓库交出与TMF分次实收独立，原收保留且净900后减量',async()=>{
 const m=await import('../../src/data/pms/tmf-material-purchases.ts')
 const p=purchase('B24-RETURN',1000);prepare(p);receiveTmfBaseProduction(receipt(p,1000),warehouse,'B24-RETURN:receipt')
 const lotId=`${p.purchaseOrderNo}:batch`,baseId=getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===p.purchaseOrderNo)!.id
 const input={returnId:'B24-RETURN-100',lotId,warehouseId:p.targetWarehouseId,materialSkuId:p.materialSkuId,dispatchedMeters:100,reason:'未用连续白料退100米，采购减量',confirmed:true}
 const source=productionSource('B24-RESERVED');registerTmfProductionOrder(source,planner,'B24-RETURN:demand')
 const demand=getTmfPurchaseState().demands.find(d=>d.productionOrderId===source.productionOrderId)!
 reserveTmfContinuousMaterial({reservationId:'B24-RES',demandId:demand.id,lotId,reservedMeters:901,reason:'验证其他需求占用保护'},planner,'B24-RETURN:reserve')
 assert.throws(()=>m.dispatchTmfPurchaseReturn(input,warehouse,'B24-RETURN:reserved'),/可退/)
 releaseTmfContinuousReservation('B24-RES',901,'恢复退货专项',planner,'B24-RETURN:release')
 const before=getTmfPurchaseState()
 assert.throws(()=>m.dispatchTmfPurchaseReturn(input,factory,'B24-RETURN:role'),/当前角色/)
 assert.throws(()=>m.dispatchTmfPurchaseReturn({...input,dispatchedMeters:1001},warehouse,'B24-RETURN:over'),/可退/)
 assert.throws(()=>m.dispatchTmfPurchaseReturn({...input,materialSkuId:'WRONG'},warehouse,'B24-RETURN:sku'),/SKU/)
 assert.deepEqual(getTmfPurchaseState(),before)
 m.dispatchTmfPurchaseReturn(input,warehouse,'B24-RETURN:dispatch');m.dispatchTmfPurchaseReturn(input,warehouse,'B24-RETURN:dispatch')
 assert.equal(getTmfPurchaseState().lots.find(l=>l.id===lotId)!.onHandMeters,900)
 assert.deepEqual(m.getTmfPurchaseReturnBalance(p.purchaseOrderNo),{grossReceivedMeters:1000,returnDispatchedMeters:100,returnReceivedMeters:0,returnTransitMeters:100,netReceivedMeters:1000})
 assert.throws(()=>reviseTmfMaterialPurchase(p.purchaseOrderNo,{orderedQty:900,reason:'提前减量',confirmed:true},buyer,'B24-RETURN:early'),/退货.*在途/)
 const recv={returnId:input.returnId,factoryId:'FAC-TMF',materialSkuId:p.materialSkuId,receivedMeters:40,confirmed:true}
 assert.throws(()=>m.receiveTmfPurchaseReturn({...recv,factoryId:'FAC-SPF'},factory,'B24-RETURN:wrongfactory'),/TMF/)
 m.receiveTmfPurchaseReturn(recv,factory,'B24-RETURN:receive40');m.receiveTmfPurchaseReturn(recv,factory,'B24-RETURN:receive40')
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.receivedQty,960)
 assert.throws(()=>resolveTmfBasePurchaseChange(baseId,{reason:'未收齐',confirmed:true},factory,'B24-RETURN:earlyresolve'),/退货.*在途/)
 assert.throws(()=>m.receiveTmfPurchaseReturn({...recv,receivedMeters:61},factory,'B24-RETURN:overrecv'),/超过/)
 m.receiveTmfPurchaseReturn({...recv,receivedMeters:60},factory,'B24-RETURN:receive60')
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.receivedQty,900)
 assert.throws(()=>resolveTmfBasePurchaseChange(baseId,{reason:'采购未修订',confirmed:true},factory,'B24-RETURN:beforerevision'),/先由采购修订/)
 reviseTmfMaterialPurchase(p.purchaseOrderNo,{orderedQty:900,expectedVersion:1,reason:'退100已收齐，采购改900',confirmed:true},buyer,'B24-RETURN:revise')
 resolveTmfBasePurchaseChange(baseId,{reason:'保留原产出1000及关联退100，净采购900',confirmed:true},factory,'B24-RETURN:resolve')
 const end=getTmfPurchaseState(),base=end.baseOrders.find(b=>b.id===baseId)!
 assert.equal(base.producedMeters,1000);assert.equal(base.plannedMeters,900);assert.equal(base.changePending,false)
 assert.equal(end.handovers.find(h=>h.id===`${p.purchaseOrderNo}:handover`)!.receivedMeters,1000)
 assert.equal(end.lots.find(l=>l.id===lotId)!.receivedMeters,1000)
 assert.deepEqual(m.getTmfPurchaseReturnBalance(p.purchaseOrderNo),{grossReceivedMeters:1000,returnDispatchedMeters:100,returnReceivedMeters:100,returnTransitMeters:0,netReceivedMeters:900})
 assert.equal(end.purchaseReturns[0].receivedMeters,100)
 assert.throws(()=>dispatchTmfBaseProduction({baseOrderId:baseId,handoverId:'B24-RETURN-AGAIN',batchId:'B24-RETURN-AGAIN',dispatchedMeters:100},factory,'B24-RETURN:again'),/超过/)
 assert.equal(getPmsMaterialPurchaseOrder(p.purchaseOrderNo)!.status,'已入库')
})


test('采购取消门禁：无执行事实可取消，已收货或已生产必须先处置不能直接结案',()=>{
 const pending=purchase('B24-CANCEL-PENDING',1000)
 createTmfMaterialPurchase(pending,buyer,'B24-CANCEL-PENDING:create');advancePmsMaterialPurchaseOrderStatus(pending.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR)
 assert.throws(()=>cancelTmfMaterialPurchaseAfterDisposition(pending.purchaseOrderNo,{reason:'',confirmed:false},buyer,'B24-CANCEL-PENDING:bad'),/取消采购/)
 cancelTmfMaterialPurchaseAfterDisposition(pending.purchaseOrderNo,{reason:'供应商无法排产，未产生实物，确认取消',confirmed:true},buyer,'B24-CANCEL-PENDING:cancel')
 cancelTmfMaterialPurchaseAfterDisposition(pending.purchaseOrderNo,{reason:'供应商无法排产，未产生实物，确认取消',confirmed:true},buyer,'B24-CANCEL-PENDING:cancel')
 assert.equal(getPmsMaterialPurchaseOrder(pending.purchaseOrderNo)!.status,'已关闭')
 const executed=purchase('B24-CANCEL-EXECUTED',1000);prepare(executed);receiveTmfBaseProduction(receipt(executed,1000),warehouse,'B24-CANCEL-EXECUTED:receive')
 const before=getTmfPurchaseState();assert.throws(()=>cancelTmfMaterialPurchaseAfterDisposition(executed.purchaseOrderNo,{reason:'客户取消但尚有库存',confirmed:true},buyer,'B24-CANCEL-EXECUTED:cancel'),/已产生基础生产或交接/);assert.deepEqual(getTmfPurchaseState(),before)
})
