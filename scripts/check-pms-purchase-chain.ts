import assert from 'node:assert/strict'
import { menusBySystem, systems } from '../src/data/app-shell-config.ts'
import {
  inboundPmsKolDemand,
  listPmsKolDemands,
  listPmsSuggestionViews,
  markSuggestionConverted,
  rejectPmsKolDemand,
} from '../src/data/pms/purchase-suggestions.ts'
import { PMS_BUYER_ACTOR, PMS_FINANCE_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../src/data/pms/runtime.ts'
import {
  advancePmsProductPurchaseOrderStatus,
  checkPmsGenerateMaterialRequirement,
  closePmsProductPurchaseOrder,
  createPmsProductPurchaseOrders,
  generatePmsMaterialRequirement,
  getPmsProductPurchaseOrder,
} from '../src/data/pms/product-purchase-orders.ts'
import { listPmsMaterialRequirements } from '../src/data/pms/material-requirements.ts'
import {
  checkPmsMaterialRequirementPush,
  closePmsMaterialPurchaseOrder,
  getPmsMaterialPurchaseOrder,
  importPmsMaterialLogistics,
  listPmsMaterialLogisticsRecords,
  listPmsMaterialPurchaseOrders,
  pushPmsMaterialRequirement,
  registerPmsMaterialPurchaseArrival,
  signPmsMaterialLogistics,
  validatePmsLogisticsImportRow,
  type PmsLogisticsImportRow,
} from '../src/data/pms/material-purchase-orders.ts'
import {
  advancePmsFirstLegBatchStatus,
  batchLoadPmsFirstLegBatches,
  batchShipPmsFirstLegBatches,
  createPmsFirstLegCarrier,
  createPmsFirstLegChannel,
  createPmsFirstLegBatch,
  getPmsFirstLegBatch,
  listPmsFirstLegBatches,
  listPmsFirstLegCarriers,
  listPmsJoinableLogisticsRows,
  pmsFirstLegBatchAggregate,
  pmsFirstLegFeeSubtotal,
  pmsFirstLegTransitDays,
  togglePmsFirstLegCarrierStatus,
  updatePmsFirstLegCarrier,
} from '../src/data/pms/first-leg-logistics.ts'
import {
  checkPmsConfirmation,
  confirmPmsSupplierConfirmation,
  generatePmsConfirmationLabels,
  printPmsConfirmationLabels,
  getPmsSupplierConfirmation,
} from '../src/data/pms/supplier-confirmations.ts'
import {
  advancePmsSupplierStatus,
  createPmsSupplier,
  getPmsSupplier,
  listPmsSuppliers,
  type PmsSupplierInput,
} from '../src/data/pms/suppliers.ts'
import {
  computePmsSupplyConversion,
  convertPmsSupplyQty,
  listPmsSupplyArchives,
  updatePmsSupplyArchive,
} from '../src/data/pms/supplier-supply-archives.ts'
import { getPmsMaterial, listPmsMaterials, updatePmsMaterialComplianceInfo, updatePmsMaterialProcurementInfo } from '../src/data/pms/materials.ts'
import { listPmsProductSkus } from '../src/data/pms/product-skus.ts'
import { listPmsWarehouses, syncPmsWarehouses } from '../src/data/pms/warehouses.ts'
import { createPmsUnit, listPmsUnits, togglePmsUnitStatus, updatePmsUnit, type PmsUnitInput } from '../src/data/pms/units.ts'
import { getPmsBomDetail, submitPmsBomTemplate, updatePmsBomDetail } from '../src/data/pms/bom-detail.ts'
import { getPmsBomTemplate, updatePmsBomMaterialUsage } from '../src/data/pms/bom-templates.ts'
import { getPmsSubjectOperation, listPmsSubjectOperations, updatePmsSubjectOperation } from '../src/data/pms/subject-operations.ts'
import { pmsProductPurchaseOrderAmount, pmsProductPurchaseOrderLineAmount } from '../src/data/pms/product-purchase-orders.ts'
import {
  PMS_LOGISTICS_IMPORT_HEADERS,
  PMS_MATERIAL_BILL_IMPORT_HEADERS,
  batchConfirmPmsMaterialReconciliationFees,
  checkPmsLogisticsReconciliationGenerate,
  checkPmsMaterialReconciliationGenerate,
  confirmAllPmsLogisticsReconciliationFees,
  confirmAllPmsMaterialReconciliationFees,
  confirmPmsLogisticsReconciliation,
  confirmPmsLogisticsReconciliationDifference,
  confirmPmsMaterialReconciliation,
  confirmPmsMaterialReconciliationDifference,
  confirmPmsMaterialReconciliationFees,
  getPmsLogisticsReconciliation,
  getPmsMaterialReconciliation,
  importPmsLogisticsActualFees,
  importPmsMaterialSupplierBills,
  listPmsLogisticsReconciliationShipments,
  listPmsLogisticsReconciliations,
  listPmsMaterialReconciliations,
  pmsMaterialEffectiveLogisticsFee,
  pmsMaterialEffectivePurchaseAmount,
  updatePmsMaterialReconciliation,
  validatePmsLogisticsActualImportRow,
  validatePmsMaterialBillImportRow,
} from '../src/data/pms/reconciliations.ts'
import {
  addPmsPaymentAttachment,
  checkPmsPaymentRequestEditScope,
  consumePmsPaymentDraft,
  createPmsPaymentRequestFromDraft,
  getPmsPaymentRequest,
  listPmsPaymentRequests,
  registerPmsPayment,
  updatePmsPaymentRequestInfo,
  setPmsLogisticsPaymentDraft,
  setPmsMaterialPaymentDraft,
  submitPmsPaymentRequest,
  voidPmsPaymentRequest,
} from '../src/data/pms/payment-requests.ts'
import { routes } from '../src/router/routes-pms.ts'
import {
  generatePmsInventoryOrder,
  getPmsInventoryMonitorRow,
  listPmsInventoryMonitor,
  listPmsInventoryOrders,
  updatePmsInventoryRule,
} from '../src/data/pms/inventory-monitor.ts'
import {
  consumePmsTransitFilter,
  filterPmsTransitReceipts,
  getPmsTransitDashboard,
  listPmsTransitOrderChecks,
  listPmsTransitPreparationTasks,
  listPmsTransitReceipts,
  setPmsTransitFilter,
} from '../src/data/pms/transit-warehouse.ts'
import { listPmsSettingDictionaries, listPmsSettingRoles, listPmsSettingUsers } from '../src/data/pms/settings.ts'
import { renderPmsMaterialInventoryPage } from '../src/pages/pms/material-inventory.ts'
import { renderPmsTransitDashboardPage } from '../src/pages/pms/transit-dashboard.ts'
import { renderPmsTransitReceiptsPage } from '../src/pages/pms/transit-receipts.ts'
import { renderPmsTransitOrderChecksPage, renderPmsTransitPreparationTasksPage } from '../src/pages/pms/transit-simple-lists.ts'
import { renderPmsUsersPage, renderPmsRolesPage, renderPmsDictionariesPage } from '../src/pages/pms/settings.ts'
import { renderPmsSubjectOperationsPage } from '../src/pages/pms/subject-operations.ts'
import { renderPmsMaterialReconciliationsPage } from '../src/pages/pms/material-reconciliations.ts'
import { renderPmsLogisticsReconciliationsPage } from '../src/pages/pms/logistics-reconciliations.ts'
import { renderPmsMaterialPaymentRequestsPage, renderPmsLogisticsPaymentRequestsPage } from '../src/pages/pms/payment-requests.ts'
import { renderPmsTradeSubjectsPage } from '../src/pages/pms/trade-subjects.ts'
import { renderPmsSuppliersPage } from '../src/pages/pms/suppliers.ts'
import { renderPmsSupplierSupplyArchivesPage } from '../src/pages/pms/supplier-supply-archives.ts'
import { renderPmsMaterialArchivesPage } from '../src/pages/pms/material-archives.ts'
import { renderPmsGarmentSkusPage, renderPmsSampleSkusPage } from '../src/pages/pms/product-skus.ts'
import { renderPmsWarehousesPage } from '../src/pages/pms/warehouses.ts'
import { renderPmsUnitsPage } from '../src/pages/pms/units.ts'
import { renderPmsBomTemplatesPage } from '../src/pages/pms/bom-templates.ts'
import { renderPmsBomDetailPage } from '../src/pages/pms/bom-detail.ts'
import { renderPmsMaterialRequirementsPage } from '../src/pages/pms/material-requirements.ts'
import { renderPmsMaterialPurchaseOrdersPage } from '../src/pages/pms/material-purchase-orders.ts'
import { renderPmsMaterialPurchaseTrackingPage } from '../src/pages/pms/material-purchase-tracking.ts'
import { renderPmsSupplierConfirmationsPage } from '../src/pages/pms/supplier-confirmations.ts'
import { addPmsConfirmationBoxSpec, addPmsConfirmationPackageDetail, calculatePmsBoxVolume, generatePmsConfirmationRolls, removePmsConfirmationBoxSpec } from '../src/data/pms/supplier-confirmations.ts'
import { createPmsInventoryMonitorRow, formatPmsInventoryProcessChain, refreshPmsInventoryStocks } from '../src/data/pms/inventory-monitor.ts'
import { renderPmsFirstLegShipmentsPage } from '../src/pages/pms/first-leg-shipments.ts'
import { renderPmsFirstLegCarriersPage } from '../src/pages/pms/first-leg-carriers.ts'
import { renderPmsWorkbenchPage } from '../src/pages/pms/workbench.ts'
import { renderPmsPurchaseSuggestionsPage } from '../src/pages/pms/purchase-suggestions.ts'
import { renderPmsKolDemandsPage } from '../src/pages/pms/kol-demands.ts'
import { renderPmsProductPurchaseOrdersPage } from '../src/pages/pms/product-purchase-orders.ts'

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), `${label} 缺少内容：${needle}`)
}

// 1. 菜单与路由一致性：PMS 每个菜单 href 必须存在精确路由，默认页必须可达。
const pmsSystem = systems.find((system) => system.id === 'pms')
assert.ok(pmsSystem, 'PMS 系统未注册')
assert.ok(routes.exactRoutes[pmsSystem.defaultPage], `PMS 默认页没有精确路由：${pmsSystem.defaultPage}`)

const pmsMenuHrefs = (menusBySystem.pms ?? [])
  .flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]))
  .map((item) => item.href)
  .filter((href): href is string => Boolean(href))
assert.ok(pmsMenuHrefs.length >= 5, `PMS 菜单项过少：${pmsMenuHrefs.length}`)
for (const href of pmsMenuHrefs) {
  assert.ok(routes.exactRoutes[href], `PMS 菜单缺少精确路由：${href}`)
}
for (const removed of ['/pms/supplier', '/pms/contract']) {
  assert.ok(!pmsMenuHrefs.includes(removed), `旧占位菜单未删除：${removed}`)
  assert.ok(!routes.exactRoutes[removed], `旧占位路由未删除：${removed}`)
}

// 2. 页面渲染冒烟：四个 P1 页面可以同步渲染出业务内容。
assertIncludes(renderPmsWorkbenchPage(), '采购管理工作台', '采购工作台')
assertIncludes(renderPmsPurchaseSuggestionsPage(), 'data-pms-psk-root', '商品采购建议页')
assertIncludes(renderPmsKolDemandsPage(), 'data-pms-kol-root', 'KOL 采购需求页')
assertIncludes(renderPmsProductPurchaseOrdersPage(), 'data-pms-ppo-root', '商品采购单页')
for (const [name, html] of [
  ['采购工作台', renderPmsWorkbenchPage()],
  ['商品采购建议', renderPmsPurchaseSuggestionsPage()],
  ['KOL 采购需求', renderPmsKolDemandsPage()],
  ['商品采购单', renderPmsProductPurchaseOrdersPage()],
] as const) {
  assert.ok(!html.includes('待迁移完整 UI'), `${name} 仍是占位页`)
}

// 3. 采购建议公式：缺口 = max(0, 待发货 + KOL − 采购中 − 库存)，建议量 = ceil(缺口 × 折扣)。
const suggestion = listPmsSuggestionViews().find((row) => row.suggestionNo === 'PSG-2026-0001')
assert.ok(suggestion, 'PSG-2026-0001 建议不存在')
assert.equal(suggestion.totalKolApplyQty, 1000, 'KOL 申请合计应为 600 + 400')
const whiteM = suggestion.skuItems.find((sku) => sku.sku === 'HG-TS-2601-WH-M')
assert.ok(whiteM, 'HG-TS-2601-WH-M 不存在')
assert.equal(whiteM.gapQty, 1800, 'WH-M 缺口应为 4200 + 600 − 1200 − 1800')
assert.equal(whiteM.discount, 0.7, '爆款折扣应为 0.7')
assert.equal(whiteM.suggestedQty, 1260, 'WH-M 建议量应为 ceil(1800 × 0.7)')
assert.equal(suggestion.totalSuggestedQty, 3780, 'PSG-2026-0001 建议合计应为 3780')

// 4. 建议转采购单：生成后写回已转数量与状态，采购单进入待采购。
const [createdOrder] = createPmsProductPurchaseOrders(
  [
    {
      spu: suggestion.spu,
      productName: suggestion.productName,
      imageUrl: suggestion.imageUrl,
      purchaseType: suggestion.purchaseType,
      area: suggestion.area,
      supplierName: '广州华盛制衣有限公司',
      warehouse: '印尼雅加达成品仓',
      expectedDeliveryDate: '2026-07-20',
      sourceSuggestionNo: suggestion.suggestionNo,
      lines: [{ sku: whiteM.sku, color: whiteM.color, size: whiteM.size, qty: whiteM.availableQty, standardPrice: 31.5, actualPrice: 31.5 }],
    },
  ],
  PMS_BUYER_ACTOR,
)
assert.equal(createdOrder.status, '待采购', '新建采购单状态应为待采购')
assert.equal(createdOrder.lines[0].qty, 1260, '新建采购单数量应为建议量')
markSuggestionConverted(suggestion.suggestionNo, createdOrder.purchaseOrderNo, [{ sku: whiteM.sku, qty: 1260 }], PMS_BUYER_ACTOR)
const converted = listPmsSuggestionViews().find((row) => row.suggestionNo === 'PSG-2026-0001')
assert.ok(converted, '转单后建议不存在')
assert.equal(converted.status, '部分生成', '仅部分 SKU 转单应为部分生成')
assert.equal(converted.skuItems.find((sku) => sku.sku === whiteM.sku)?.availableQty, 0, '已转单 SKU 待生成量应为 0')

// 5. 生成面辅料需求：按 BOM 数量 × (1 + 损耗) 扣减库存与采购中；重复生成被阻断。
const seedOrder = getPmsProductPurchaseOrder('CG-2026-0016')
assert.ok(seedOrder, 'CG-2026-0016 不存在')
const seedCheck = checkPmsGenerateMaterialRequirement('CG-2026-0016')
assert.equal(seedCheck.ok, true, `CG-2026-0016 应允许生成：${seedCheck.reason}`)
const generated = generatePmsMaterialRequirement('CG-2026-0016', PMS_BUYER_ACTOR)
const fabricLine = generated.lines.find((line) => line.materialCode === 'FAB-2026-0001')
assert.ok(fabricLine, '面辅料需求缺少面料行')
assert.equal(fabricLine.bomDemand, 2241.75, '面料需求应为 6100 × 0.35 × 1.05')
assert.equal(fabricLine.suggestedQty, 441.75, '面料建议采购量应扣减库存 1200 与采购中 600')
assert.equal(getPmsProductPurchaseOrder('CG-2026-0016')?.lines[0].materialStatus, '已生成', '采购单面辅料状态应回写为已生成')
const secondCheck = checkPmsGenerateMaterialRequirement('CG-2026-0016')
assert.equal(secondCheck.ok, false, '重复生成应被阻断')
assertIncludes(secondCheck.reason, '已经生成', '重复生成阻断原因')
assert.ok(listPmsMaterialRequirements().some((requirement) => requirement.requirementNo === generated.requirementNo), '生成的面辅料需求应可查询')
const draftCheck = checkPmsGenerateMaterialRequirement('CG-2026-0019')
assertIncludes(draftCheck.reason, '草稿', '草稿阻断原因')
const garmentCheck = checkPmsGenerateMaterialRequirement('CG-2026-0022')
assertIncludes(garmentCheck.reason, '做货', '成衣阻断原因')

// 6. 关闭采购单必须填写原因并二次确认。
assert.throws(() => closePmsProductPurchaseOrder(createdOrder.purchaseOrderNo, '', PMS_MANAGER_ACTOR), PmsDomainError)
closePmsProductPurchaseOrder(createdOrder.purchaseOrderNo, '终端取消本批订单', PMS_MANAGER_ACTOR)
assert.equal(getPmsProductPurchaseOrder(createdOrder.purchaseOrderNo)?.status, '已关闭', '采购单应关闭')

// 7. KOL 入库：单条超量需二次确认，驳回后不计入建议。
assert.throws(
  () => inboundPmsKolDemand('KOL-2026-0002', { qty: 260, note: '超量测试' }, PMS_BUYER_ACTOR),
  (error: unknown) => error instanceof PmsDomainError && error.code === 'KOL_OVER_CONFIRM_REQUIRED',
)
const kolDemand = inboundPmsKolDemand('KOL-2026-0002', { qty: 260, note: '超量二次确认', overConfirm: true }, PMS_BUYER_ACTOR)
assert.equal(kolDemand.status, '全部入库', 'KOL 需求应全部入库')
assert.throws(
  () => inboundPmsKolDemand('KOL-2026-0002', { qty: 1, note: '' }, PMS_BUYER_ACTOR),
  (error: unknown) => error instanceof PmsDomainError && error.code === 'KOL_FULL_BLOCKED',
)
rejectPmsKolDemand('KOL-2026-0001', '本场直播改期，需求取消', PMS_BUYER_ACTOR)
const rejected = listPmsKolDemands().find((demand) => demand.demandNo === 'KOL-2026-0001')
assert.equal(rejected?.status, '已驳回', 'KOL 需求应驳回')

// 8. P2 页面路由与渲染冒烟。
for (const route of [
  '/pms/material-requirements',
  '/pms/material-purchase-orders',
  '/pms/material-purchase-tracking',
  '/pms/material-supplier-confirmations',
  '/pms/first-leg-shipments',
  '/pms/first-leg-carriers',
]) {
  assert.ok(routes.exactRoutes[route], `P2 缺少精确路由：${route}`)
}
assertIncludes(renderPmsMaterialRequirementsPage(), 'data-pms-mreq-root', '面辅料需求页')
assertIncludes(renderPmsMaterialPurchaseOrdersPage(), 'data-pms-mpo-root', '面辅料采购单页')
assertIncludes(renderPmsMaterialPurchaseTrackingPage(), 'data-pms-mtrk-root', '采购跟踪页')
assertIncludes(renderPmsSupplierConfirmationsPage(), 'data-pms-conf-root', '供应商确认页')
assertIncludes(renderPmsFirstLegShipmentsPage(), 'data-pms-fls-root', '头程物流页')
assertIncludes(renderPmsFirstLegCarriersPage(), 'data-pms-flc-root', '头程物流商页')

// 9. 面辅料需求下推：生成采购单并回写需求状态与商品采购单面辅料状态。
const pushCheck = checkPmsMaterialRequirementPush('MREQ-0001')
assert.equal(pushCheck.ok, true, `MREQ-0001 应可下推：${pushCheck.reason}`)
const pushable = pushCheck.pushableLines.filter((line) => line.suggestedQty > 0)
assert.ok(pushable.length >= 3, `MREQ-0001 可下推行不足：${pushable.length}`)
const pushedOrders = pushPmsMaterialRequirement(
  'MREQ-0001',
  pushable.map((line) => ({ lineNo: line.lineNo, actualQty: line.suggestedQty, unitPrice: 10 })),
  PMS_BUYER_ACTOR,
)
assert.equal(pushedOrders.length, pushable.length, '下推应逐物料生成采购单')
assert.ok(pushedOrders.every((order) => order.status === '待采购'), '下推生成的采购单应为待采购')
const requirementAfterPush = listPmsMaterialRequirements().find((requirement) => requirement.requirementNo === 'MREQ-0001')
assert.equal(requirementAfterPush?.status, '部分下推', '存在建议量为 0 的行时需求应为部分下推')
assert.throws(() => pushPmsMaterialRequirement('MREQ-0001', [{ lineNo: pushable[0].lineNo, actualQty: 1, unitPrice: 1 }], PMS_BUYER_ACTOR), PmsDomainError)
const zeroCheck = checkPmsMaterialRequirementPush('MREQ-0002')
assert.equal(zeroCheck.ok, false, '剩余建议量全为 0 的需求应阻断下推')

// 10. 快递信息导入校验与回写。
const initialLogisticsCount = listPmsMaterialLogisticsRecords().length
const importRow: PmsLogisticsImportRow = {
  purchaseOrderNo: 'CGF-2026-0007',
  company: '顺丰速运',
  trackingNo: 'SFTEST0001',
  shipDate: '2026-06-12',
  estimatedArrival: '2026-06-15',
  boxCount: 2,
  rolls: 2,
  qty: 300,
  fee: 120,
  remark: '测试导入',
}
assert.equal(validatePmsLogisticsImportRow(importRow, new Set(listPmsMaterialLogisticsRecords().map((record) => record.trackingNo)), new Set()), '', '合法导入行应通过校验')
assert.match(validatePmsLogisticsImportRow({ ...importRow, trackingNo: 'SF1368000123456' }, new Set(listPmsMaterialLogisticsRecords().map((record) => record.trackingNo)), new Set()), /已存在/, '重复物流单号应阻断')
assert.match(validatePmsLogisticsImportRow({ ...importRow, purchaseOrderNo: 'CGF-NOT-EXIST' }, new Set(), new Set()), /不存在/, '未知采购单应阻断')
const importedRecords = importPmsMaterialLogistics([importRow], PMS_BUYER_ACTOR)
assert.equal(importedRecords.length, 1, '应导入一条物流记录')
assert.equal(listPmsMaterialLogisticsRecords().length, initialLogisticsCount + 1, '物流记录数应增加')

// 11. 签收与加入头程、头程状态机、到仓自动签收。
assert.throws(() => signPmsMaterialLogistics([importedRecords[0].recordNo], 'head', PMS_BUYER_ACTOR), PmsDomainError)
signPmsMaterialLogistics([importedRecords[0].recordNo], 'domestic', PMS_BUYER_ACTOR)
const joinable = listPmsJoinableLogisticsRows()
assert.ok(joinable.some((row) => row.record.recordNo === importedRecords[0].recordNo), '签收后应可加入头程')
const batch = createPmsFirstLegBatch(
  {
    batchNo: 'FL-2026-0099',
    batchName: '',
    carrierId: 'FL-CN-001',
    channelId: 'CH-CN-0001',
    transferCenter: '',
    destinationWarehouse: '',
    plannedShipDate: '2026-06-20',
    fee: 100,
    remark: '检查脚本创建',
    billOfLadingNo: 'BL-SCRIPT-0001',
    billOfLadingRemark: '脚本提单备注',
    shippingLineName: '脚本船司',
    sourceRegion: '中国',
    warehouse: '脚本仓',
    cargoType: '海运',
    area: 'A区',
    logisticsCompany: '脚本货代',
    inboundStatus: '待交货',
    estimatedArrivalAt: '2026-06-30',
    fees: { logisticsFeeRmb: 100, logisticsFeeUsd: 0, incomeTaxIdr: 200, vatIdr: 0, customsDutyIdr: 0, penaltyIdr: 0, clearanceFeeIdr: 0 },
    allocations: [{ recordNo: importedRecords[0].recordNo, qty: 100, rolls: 1 }],
  },
  PMS_BUYER_ACTOR,
)
assert.equal(batch.status, '待起运', '新建头程单应为待起运')
assert.equal(batch.billOfLadingNo, 'BL-SCRIPT-0001', '提单号应保存')
assert.equal(batch.shippingLineName, '脚本船司', '船司名应保存')
assert.equal(batch.cargoType, '海运', '货运类型应保存')
assert.equal(batch.inboundStatus, '待交货', '入库状态应保存')
assert.equal(batch.estimatedArrivalAt, '2026-06-30', '预计送达应保存')
assert.equal(batch.fees.incomeTaxIdr, 200, '税费明细应保存')
assert.equal(pmsFirstLegFeeSubtotal(batch.fees, 'RMB'), 100, 'RMB 费用小计应为 100')
assert.equal(pmsFirstLegFeeSubtotal(batch.fees, 'USD'), 0, 'USD 费用小计应为 0')
assert.equal(pmsFirstLegFeeSubtotal(batch.fees, 'IDR'), 200, 'IDR 费用小计应为 200')
assert.throws(
  () => createPmsFirstLegBatch({ ...batch, batchNo: 'FL-2026-0098', fees: { ...batch.fees, logisticsFeeRmb: -1 }, allocations: [{ recordNo: importedRecords[0].recordNo, qty: 1, rolls: 0 }] }, PMS_BUYER_ACTOR),
  PmsDomainError,
)
assert.throws(
  () => createPmsFirstLegBatch({ ...batch, batchNo: 'FL-2026-0099', allocations: [{ recordNo: importedRecords[0].recordNo, qty: 1, rolls: 0 }] }, PMS_BUYER_ACTOR),
  PmsDomainError,
)
const loadOutcome = batchLoadPmsFirstLegBatches(['FL-2026-0099'], PMS_BUYER_ACTOR)
assert.deepEqual(loadOutcome.updated, ['FL-2026-0099'], '批量装柜应更新待起运批次')
const shipOutcome = batchShipPmsFirstLegBatches(['FL-2026-0099'], PMS_BUYER_ACTOR)
assert.deepEqual(shipOutcome.updated, ['FL-2026-0099'], '批量出运应更新已装柜批次')
assert.deepEqual(shipOutcome.skipped, [], '批量出运不应有跳过项')
advancePmsFirstLegBatchStatus('FL-2026-0099', '已到仓', PMS_BUYER_ACTOR)
const arrivedBatch = getPmsFirstLegBatch('FL-2026-0099')
assert.equal(arrivedBatch?.status, '已到仓', '头程单应到仓')
const arrivedRecord = listPmsMaterialLogisticsRecords().find((record) => record.recordNo === importedRecords[0].recordNo)
assert.equal(arrivedRecord?.headSigned, true, '到仓应自动签收头程')

assert.throws(() => closePmsMaterialPurchaseOrder('CGF-2026-0007', '', PMS_BUYER_ACTOR), PmsDomainError)
closePmsMaterialPurchaseOrder('CGF-2026-0007', '供应商产能不足，脚本关闭', PMS_BUYER_ACTOR)
assert.equal(getPmsMaterialPurchaseOrder('CGF-2026-0007')?.status, '已关闭', '采购单应可带原因关闭')
assert.throws(() => registerPmsMaterialPurchaseArrival('CGF-2026-0007', 1, PMS_BUYER_ACTOR), PmsDomainError)

// 12. 供应商确认：标签齐备后才能确认并回写采购单。
const fabricConfirmation = getPmsSupplierConfirmation('CONF-2026-0001')
assert.ok(fabricConfirmation, 'CONF-2026-0001 不存在')
assert.equal(checkPmsConfirmation('CONF-2026-0001').ok, false, '存在未生成标签时不能确认')
const missingLabels = fabricConfirmation.rolls.filter((roll) => !roll.labelNo).map((roll) => roll.rollNo)
generatePmsConfirmationLabels('CONF-2026-0001', missingLabels, PMS_BUYER_ACTOR)
printPmsConfirmationLabels('CONF-2026-0001', fabricConfirmation.rolls.map((roll) => roll.rollNo), PMS_BUYER_ACTOR)
assert.equal(checkPmsConfirmation('CONF-2026-0001').ok, true, '标签齐备后应可确认')
confirmPmsSupplierConfirmation('CONF-2026-0001', PMS_MANAGER_ACTOR)
assert.equal(getPmsSupplierConfirmation('CONF-2026-0001')?.status, '已确认', '确认单应已确认')
assert.equal(getPmsMaterialPurchaseOrder('CGF-2026-0001')?.supplierConfirmed, true, '确认应回写采购单')

// 13. 物流商与渠道：整柜计费必须完整配置四个箱型。
const toggledCarrier = togglePmsFirstLegCarrierStatus('FL-CN-004', PMS_BUYER_ACTOR)
assert.equal(toggledCarrier.status, '启用', '停用物流商应可重新启用')
updatePmsFirstLegCarrier('FL-CN-004', { contactName: '吴敏（新）' }, PMS_BUYER_ACTOR)
assert.throws(
  () => createPmsFirstLegChannel(
    {
      carrierId: 'FL-CN-002',
      channelName: '整柜缺配置',
      transportMethod: '海卡',
      estimatedTransitDays: 15,
      billingMethod: '整柜',
      unitPrice: 0,
      currency: 'RMB',
      taxMethod: '不报税',
      containerPrices: [],
      originPlace: '广州',
      destinationWarehouse: '印尼雅加达面辅料仓',
      remark: '',
    },
    PMS_BUYER_ACTOR,
  ),
  PmsDomainError,
)
const newChannel = createPmsFirstLegChannel(
  {
    carrierId: 'FL-CN-002',
    channelName: '广州-雅加达 整柜（新增）',
    transportMethod: '海卡',
    estimatedTransitDays: 16,
    billingMethod: '整柜',
    unitPrice: 0,
    currency: 'RMB',
    taxMethod: '不报税',
    containerPrices: ['20GP', '40GP', '40HQ', '45HQ'].map((type) => ({ containerType: type as '20GP' | '40GP' | '40HQ' | '45HQ', weightLimit: 20000, volumeLimit: 60, price: 28000, currency: 'RMB' as const })),
    originPlace: '广州',
    destinationWarehouse: '印尼雅加达面辅料仓',
    remark: '',
  },
  PMS_BUYER_ACTOR,
)
assert.equal(newChannel.status, '启用', '新渠道应启用')

// 14. P3a 基础资料：路由、渲染与主数据规则。
for (const route of [
  '/pms/trade-subjects',
  '/pms/suppliers',
  '/pms/supplier-supply-archives',
  '/pms/material-archives',
  '/pms/garment-skus',
  '/pms/sample-skus',
  '/pms/warehouses',
  '/pms/units',
  '/pms/bom-templates',
]) {
  assert.ok(routes.exactRoutes[route], `P3a 缺少精确路由：${route}`)
}
assert.ok(routes.dynamicRoutes.some((route) => route.pattern.test('/pms/bom-templates/HG-TS-2601')), 'BOM 详情动态路由缺失')
assertIncludes(renderPmsTradeSubjectsPage(), 'data-pms-ts-root', '贸易主体页')
assertIncludes(renderPmsSuppliersPage(), 'data-pms-sup-root', '供应商页')
assertIncludes(renderPmsSupplierSupplyArchivesPage(), 'data-pms-arc-root', '供货档案页')
assertIncludes(renderPmsMaterialArchivesPage(), 'data-pms-mat-root', '物料档案页')
assertIncludes(renderPmsGarmentSkusPage(), 'data-pms-sku-root', '成衣页')
assertIncludes(renderPmsSampleSkusPage(), 'data-pms-sku-root', '样衣页')
assertIncludes(renderPmsWarehousesPage(), 'data-pms-wh-root', '仓库页')
assertIncludes(renderPmsUnitsPage(), 'data-pms-unit-root', '单位页')
assertIncludes(renderPmsBomTemplatesPage(), 'data-pms-bom-root', 'BOM 列表页')
assertIncludes(renderPmsBomDetailPage('HG-TS-2601'), 'SPU 物料组成', 'BOM 详情页')

const materials = listPmsMaterials()
assert.equal(materials.length, 14, '物料数量应为 14')
assert.ok(materials.every((material) => material.imageUrl.startsWith('/')), '每个物料都应有真实图片路径')
assert.ok(materials.every((material) => !/hangtag|carton|sticker|desiccant/.test(material.imageUrl)), '不应再引用缺图占位路径')
updatePmsMaterialProcurementInfo('FAB-2026-0001', { defaultSupplier: '广州华盛面料有限公司（新）', referencePurchasePrice: 27.2 }, PMS_BUYER_ACTOR)
assert.equal(getPmsMaterial('FAB-2026-0001')?.referencePurchasePrice, 27.2, '物料采购补充信息应可更新')
updatePmsMaterialComplianceInfo('FAB-2026-0001', { declaration: { weavingMethod: 'knitted' }, customs: { domesticSourcePlace: '广东佛山' } }, PMS_BUYER_ACTOR)
assert.equal(getPmsMaterial('FAB-2026-0001')?.declarationInfo?.weavingMethod, 'knitted', '申报织造方式应可更新')
assert.equal(getPmsMaterial('FAB-2026-0001')?.customsInfo?.domesticSourcePlace, '广东佛山', '报关境内货源地应可更新')
assert.throws(() => updatePmsMaterialComplianceInfo('FAB-2026-0001', { declaration: { chineseClearanceName: '' } }, PMS_BUYER_ACTOR))

const supplierInput: PmsSupplierInput = {
  supplierName: '测试供应商（脚本）',
  shortName: '测试供应商',
  category: '面料供应商',
  country: '中国',
  city: '广东广州',
  defaultDeliveryMethod: '供应商直发海外仓',
  contactName: '测试联系人',
  contactPhone: '13800000000',
  email: 'test@example.com',
  level: 'C级',
  paymentMethod: '月结',
  currency: 'RMB',
  leadTimeDays: 10,
  address: '测试地址',
  remark: '',
}
const newSupplier = createPmsSupplier(supplierInput, PMS_BUYER_ACTOR)
assert.equal(newSupplier.status, '草稿', '新建供应商应为草稿')
assert.throws(() => createPmsSupplier(supplierInput, PMS_BUYER_ACTOR), PmsDomainError)
advancePmsSupplierStatus(newSupplier.supplierCode, '待审核', PMS_BUYER_ACTOR)
advancePmsSupplierStatus(newSupplier.supplierCode, '已启用', PMS_BUYER_ACTOR)
assert.equal(getPmsSupplier(newSupplier.supplierCode)?.status, '已启用', '供应商应可审核启用')
assert.equal(listPmsSuppliers().length, 14, '供应商应为 13 条种子 + 1 条脚本新增')

const archive = listPmsSupplyArchives()[0]
const conversion = computePmsSupplyConversion(archive, 250)
assert.equal(conversion.packageCount, 3, '250 米按 100 米/卷应为 3 卷（向上取整）')
assert.equal(conversion.boxCount, 1, '250 米按 4 卷/箱应为 1 箱')
assert.equal(convertPmsSupplyQty(archive, 2, 'box', 'base'), 800, '2 箱应等于 800 米')
const archiveVersion = archive.version
const snapshotCount = archive.snapshots.length
updatePmsSupplyArchive(archive.archiveId, { price: archive.price + 1 }, PMS_BUYER_ACTOR)
assert.equal(archive.version, archiveVersion + 1, '更新供货档案应版本 +1')
assert.equal(archive.snapshots.length, snapshotCount + 1, '应生成包装快照')

assert.equal(listPmsProductSkus('garment').length, 7, '成衣 SKU 应有 7 个款式')
assert.equal(listPmsProductSkus('sample').length, 2, '样衣 SKU 应有 2 个款式')

const warehouses = listPmsWarehouses()
const syncedAtBefore = warehouses[1].syncedAt
syncPmsWarehouses(PMS_BUYER_ACTOR)
assert.notEqual(warehouses[1].syncedAt, syncedAtBefore, '同步后仓库时间应更新')

const unitInput: PmsUnitInput = { unitName: '测试单位', symbol: 'TST', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '', remark: '' }
const newUnit = createPmsUnit(unitInput, PMS_BUYER_ACTOR)
assert.equal(newUnit.status, '启用', '新建单位应启用')
assert.throws(() => createPmsUnit(unitInput, PMS_BUYER_ACTOR), PmsDomainError)
updatePmsUnit(newUnit.unitCode, { ...unitInput, symbol: 'TST2' }, PMS_BUYER_ACTOR)
assert.equal(togglePmsUnitStatus(newUnit.unitCode, PMS_BUYER_ACTOR).status, '停用', '单位应可停用')
assert.equal(listPmsUnits().length >= 21, true, '单位列表应包含新增项')

const bomDetail = getPmsBomDetail('HG-TS-2601')
assert.ok(bomDetail, 'BOM 详情应存在')
assert.equal(bomDetail.craftRoute.length > 0, true, 'BOM 详情应有工艺路线')
updatePmsBomMaterialUsage('HG-TS-2601', 'FAB-2026-0001', { usagePerPiece: 0.36 }, PMS_BUYER_ACTOR)
const updatedTemplate = getPmsBomTemplate('HG-TS-2601')
const usageLine = updatedTemplate?.materials.find((material) => material.materialCode === 'FAB-2026-0001')
assert.equal(usageLine?.usagePerPiece, 0.36, '单件用量应可修改')
updatePmsBomDetail('HG-TS-2601', { description: '脚本更新说明' }, PMS_BUYER_ACTOR)
assert.equal(getPmsBomDetail('HG-TS-2601')?.description, '脚本更新说明', '样板说明应可保存')

// 15. 发布未匹配 BOM 后，草稿采购单可继续生成面辅料需求。
assert.equal(getPmsBomTemplate('HG-JK-2605')?.status, '未匹配', 'JK BOM 初始应为未匹配')
submitPmsBomTemplate('HG-JK-2605', PMS_MANAGER_ACTOR)
assert.equal(getPmsBomTemplate('HG-JK-2605')?.status, '已发布', '提交后 BOM 应已发布')
advancePmsProductPurchaseOrderStatus('CG-2026-0019', '待采购', PMS_BUYER_ACTOR)
const jkCheck = checkPmsGenerateMaterialRequirement('CG-2026-0019')
assert.equal(jkCheck.ok, true, `BOM 发布后应可生成需求：${jkCheck.reason}`)
generatePmsMaterialRequirement('CG-2026-0019', PMS_BUYER_ACTOR)

// 16. P3b 对账与请款：路由、公式、差异门禁、草稿与付款闭环。
for (const route of [
  '/pms/subject-operations',
  '/pms/material-reconciliations',
  '/pms/logistics-reconciliations',
  '/pms/material-payment-requests',
  '/pms/logistics-payment-requests',
]) {
  assert.ok(routes.exactRoutes[route], `P3b 缺少精确路由：${route}`)
}
assertIncludes(renderPmsSubjectOperationsPage(), 'data-pms-so-root', '主体经营页')
assertIncludes(renderPmsMaterialReconciliationsPage(), 'data-pms-mrec-root', '面辅料对账页')
assertIncludes(renderPmsLogisticsReconciliationsPage(), 'data-pms-lrec-root', '物流对账页')
assertIncludes(renderPmsMaterialPaymentRequestsPage(), 'data-pms-pay-root', '面辅料请款页')
assertIncludes(renderPmsLogisticsPaymentRequestsPage(), 'data-pms-pay-root', '物流请款页')

const subjectRow = getPmsSubjectOperation('SO-2026-05-01')
assert.ok(subjectRow, '主体经营明细应存在')
assert.equal(subjectRow.totalCost, subjectRow.purchaseCost + subjectRow.logisticsCost + subjectRow.allocatedCost + subjectRow.otherCost, '总成本公式')
assert.equal(subjectRow.grossProfit, subjectRow.salesAmount - subjectRow.totalCost, '毛利公式')
assert.equal(subjectRow.grossMargin, Math.round((subjectRow.grossProfit / subjectRow.salesAmount) * 10000) / 100, '毛利率公式')
updatePmsSubjectOperation('SO-2026-05-01', { allocatedCost: subjectRow.allocatedCost + 1000 }, PMS_FINANCE_ACTOR)
assert.equal(getPmsSubjectOperation('SO-2026-05-01')?.allocatedCost, subjectRow.allocatedCost, '费用分摊应可更新')

const materialRecon = getPmsMaterialReconciliation('MR-2026-0004')
assert.ok(materialRecon, 'MR-2026-0004 应存在')
assert.equal(materialRecon.finalPayable, pmsMaterialEffectivePurchaseAmount(materialRecon) + pmsMaterialEffectiveLogisticsFee(materialRecon) + materialRecon.adjustment, '最终应付 = 实际采购货款 + 实际国内物流费 + 调整')
assert.equal(materialRecon.difference, materialRecon.supplierBillAmount - materialRecon.finalPayable, '差异公式')
assert.equal(materialRecon.status, '部分确认', '部分费用项确认后应显示部分确认')
assert.throws(() => confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR), PmsDomainError)
confirmAllPmsMaterialReconciliationFees('MR-2026-0004', PMS_FINANCE_ACTOR)
assert.throws(() => confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR), PmsDomainError)
confirmPmsMaterialReconciliationDifference('MR-2026-0004', PMS_FINANCE_ACTOR)
confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR)
assert.equal(getPmsMaterialReconciliation('MR-2026-0004')?.status, '已确认', '费用项与差异确认后应可确认对账')
const partialOutcome = batchConfirmPmsMaterialReconciliationFees(['MR-2026-0008', 'MR-2026-0001'], ['purchaseAmount', 'domesticLogisticsFee'], PMS_FINANCE_ACTOR)
assert.deepEqual(partialOutcome.updated, ['MR-2026-0008'], '批量部分确认应更新未确认记录')
assert.equal(partialOutcome.skipped[0]?.id, 'MR-2026-0001', '已确认记录应跳过')
assert.equal(getPmsMaterialReconciliation('MR-2026-0008')?.status, '部分确认', '批量部分确认后状态应为部分确认')

const materialDraft = setPmsMaterialPaymentDraft(['MR-2026-0004'])
assert.equal(materialDraft.totalAmount, materialRecon.finalPayable, '请款草稿金额应为最终应付')
assert.ok(consumePmsPaymentDraft('material'), '草稿应可被请款页消费')
assert.equal(consumePmsPaymentDraft('material'), null, '草稿消费后应清空')
const materialRequest = createPmsPaymentRequestFromDraft(materialDraft, PMS_FINANCE_ACTOR)
assert.equal(materialRequest.status, '未请款', '新建请款单应为未请款')
assert.equal(getPmsMaterialReconciliation('MR-2026-0004')?.paymentRequestNo, materialRequest.requestNo, '对账应回写请款单号')
assert.throws(() => submitPmsPaymentRequest(materialRequest.requestNo, materialRequest.payableAmount + 1, PMS_FINANCE_ACTOR), PmsDomainError)
submitPmsPaymentRequest(materialRequest.requestNo, materialRequest.payableAmount, PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest(materialRequest.requestNo)?.status, '已请款', '全额请款后应为已请款')
assert.throws(() => registerPmsPayment(materialRequest.requestNo, { amount: materialRequest.payableAmount + 1, method: '银行转账' }, PMS_FINANCE_ACTOR), PmsDomainError)
registerPmsPayment(materialRequest.requestNo, { amount: 1000, method: '银行转账' }, PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest(materialRequest.requestNo)?.paymentStatus, '部分付款', '部分付款状态')
assert.equal(checkPmsPaymentRequestEditScope(materialRequest.requestNo).level, 'attachment-only', '已请款仅可补充附件备注')
addPmsPaymentAttachment(materialRequest.requestNo, '付款回单-脚本.jpg', PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest(materialRequest.requestNo)?.attachments.length, 1, '附件应登记')

assert.equal(PMS_MATERIAL_BILL_IMPORT_HEADERS.length, 9, '供应商账单模板应为 9 列')
const confirmedMaterial = getPmsMaterialReconciliation('MR-2026-0001')
assert.ok(confirmedMaterial, 'MR-2026-0001 应存在')
const importTarget = getPmsMaterialReconciliation('MR-2026-0006')
assert.ok(importTarget, 'MR-2026-0006 应存在')
assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: 'CGF-2026-9999', materialCode: 'MAT-X', supplierBillAmount: 1 }, new Set()), /不在对账列表/)
assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: confirmedMaterial.purchaseOrderNos[0], materialCode: confirmedMaterial.materialCode, supplierBillAmount: 1 }, new Set()), /已确认/)
assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: importTarget.purchaseOrderNos[0], materialCode: importTarget.materialCode }, new Set()), /至少要填写一项费用/)
assert.equal(validatePmsMaterialBillImportRow({ purchaseOrderNo: importTarget.purchaseOrderNos[0], materialCode: importTarget.materialCode, supplierBillAmount: 6400, actualDomesticLogisticsFee: importTarget.domesticLogisticsFee + 8 }, new Set()), '')
const materialBillImported = importPmsMaterialSupplierBills([{ purchaseOrderNo: importTarget.purchaseOrderNos[0], materialCode: importTarget.materialCode, supplierBillAmount: 6400, actualDomesticLogisticsFee: importTarget.domesticLogisticsFee + 8, remark: '脚本导入验证' }], PMS_FINANCE_ACTOR)
assert.equal(materialBillImported, 1, '供应商账单应导入 1 条')
assert.equal(getPmsMaterialReconciliation('MR-2026-0006')?.supplierBillAmount, 6400, '导入应覆盖供应商账单金额')
assert.equal(getPmsMaterialReconciliation('MR-2026-0006')?.actualDomesticLogisticsFee, importTarget.domesticLogisticsFee + 8, '导入应覆盖实际国内物流费')
assert.equal(getPmsMaterialReconciliation('MR-2026-0006')?.remark, '脚本导入验证', '导入应写入备注')
assert.equal(getPmsMaterialReconciliation('MR-2026-0006')?.status, '待确认', '导入账单不自动确认对账')
assert.notEqual(getPmsMaterialReconciliation('MR-2026-0006')?.difference, 0, '导入账单后差异应重算')
confirmAllPmsMaterialReconciliationFees('MR-2026-0006', PMS_FINANCE_ACTOR)
confirmPmsMaterialReconciliationDifference('MR-2026-0006', PMS_FINANCE_ACTOR)
confirmPmsMaterialReconciliation('MR-2026-0006', PMS_FINANCE_ACTOR)
confirmAllPmsMaterialReconciliationFees('MR-2026-0007', PMS_FINANCE_ACTOR)
confirmPmsMaterialReconciliationDifference('MR-2026-0007', PMS_FINANCE_ACTOR)
confirmPmsMaterialReconciliation('MR-2026-0007', PMS_FINANCE_ACTOR)
const mixedCheck = checkPmsMaterialReconciliationGenerate(['MR-2026-0006', 'MR-2026-0007'])
assert.equal(mixedCheck.ok, false, '不同供应商不能合并请款')
assert.match(mixedCheck.reason, /同一供应商/, '合并请款应提示供应商不一致')
assert.throws(() => voidPmsPaymentRequest('PAY-M-2026-0002', '已有付款不可作废', PMS_FINANCE_ACTOR), PmsDomainError)

const logisticsRecon = getPmsLogisticsReconciliation('LR-2026-0003')
assert.ok(logisticsRecon, 'LR-2026-0003 应存在')
assert.equal(logisticsRecon.status, '待确认', 'LR-2026-0003 初始应为待确认')
assert.equal(PMS_LOGISTICS_IMPORT_HEADERS.length, 12, '物流实际费用模板应为 12 列')
assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-NOT-EXIST', fees: {} }, new Set()), /不在物流对账列表/)
assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0002', fees: {} }, new Set()), /已确认/)
assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0003', carrierName: '错误的物流商', fees: {} }, new Set()), /物流商/)
const importedFees = importPmsLogisticsActualFees([{ batchNo: 'FL-2026-0003', carrierName: '义乌市陆港供应链管理有限公司', trackingNos: 'DB6600123987', shipmentNo: 'HB-0003', remark: '脚本导入验证', fees: { freight: 800, customsDuty: 50, clearance: 20, vat: 10 } }], PMS_FINANCE_ACTOR)
assert.equal(importedFees, 1, '实际费用应导入 1 条')
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.actualTotal, 880, '实际费用合计应为 880')
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.feeDifference, 20, '预计/实际差异应为 20')
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.status, '待确认', '导入不自动确认对账')
const shipments = listPmsLogisticsReconciliationShipments('FL-2026-0003')
assert.ok(shipments.length > 0, '物流对账应能读取运单/货件信息')
assert.equal(shipments[0].issuedQty > 0, true, '发出数量应大于 0')
assert.throws(() => confirmPmsLogisticsReconciliation('LR-2026-0003', PMS_FINANCE_ACTOR), PmsDomainError)
confirmAllPmsLogisticsReconciliationFees('LR-2026-0003', PMS_FINANCE_ACTOR)
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.fees.every((fee) => fee.confirmed), true, '确认全部费用后 7 项应为已确认')
confirmPmsLogisticsReconciliationDifference('LR-2026-0003', PMS_FINANCE_ACTOR)
confirmPmsLogisticsReconciliation('LR-2026-0003', PMS_FINANCE_ACTOR)
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.status, '已确认', '物流对账应确认')
const logisticsDraft = setPmsLogisticsPaymentDraft(['LR-2026-0003'])
const logisticsRequest = createPmsPaymentRequestFromDraft(logisticsDraft, PMS_FINANCE_ACTOR)
assert.equal(logisticsRequest.status, '未请款', '物流请款单应为未请款')
voidPmsPaymentRequest(logisticsRequest.requestNo, '供应商账单重开', PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest(logisticsRequest.requestNo)?.status, '已作废', '请款单应作废')
assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.paymentRequestNo, '', '作废后应释放来源对账')

// 17. P4 外围：库存监控、中转仓与系统设置结果页。
for (const route of [
  '/pms/material-inventory',
  '/pms/transit/dashboard',
  '/pms/transit/receipts',
  '/pms/transit/order-checks',
  '/pms/transit/preparation-tasks',
  '/pms/users',
  '/pms/roles',
  '/pms/dictionaries',
]) {
  assert.ok(routes.exactRoutes[route], `P4 缺少精确路由：${route}`)
}
assertIncludes(renderPmsMaterialInventoryPage(), 'data-pms-inv-root', '库存监控页')
assertIncludes(renderPmsTransitDashboardPage(), '中转仓数据总览', '中转总览页')
assertIncludes(renderPmsTransitReceiptsPage(), 'data-pms-trnr-root', '收货单页')
assertIncludes(renderPmsTransitOrderChecksPage(), 'data-pms-trno-root', '生产单校验页')
assertIncludes(renderPmsTransitPreparationTasksPage(), 'data-pms-trnp-root', '配料任务页')
assertIncludes(renderPmsUsersPage(), 'data-pms-usr-root', '用户页')
assertIncludes(renderPmsRolesPage(), 'data-pms-role-root', '角色页')
assertIncludes(renderPmsDictionariesPage(), 'data-pms-dict-root', '字典页')

const inventoryRows = listPmsInventoryMonitor()
assert.equal(inventoryRows.length, 5, '库存监控应有 5 条')
const inventory1 = getPmsInventoryMonitorRow('INV-2026-0001')
assert.ok(inventory1, 'INV-2026-0001 应存在')
assert.equal(inventory1.triggerLine, 1000, '触发线应为阈值 × 比例')
assert.equal(inventory1.suggestedQty, 2200, '建议量应为 max(0, 目标库存 − 库存)')
assert.equal(inventory1.ruleStatus, '待补货', '低于触发线应为待补货')
assert.equal(inventory1.canTransfer, true, '待补货且库存大于 0 可调拨')
assert.equal(getPmsInventoryMonitorRow('INV-2026-0004')?.suggestedQty, 0, '库存高于目标时建议量为 0')
updatePmsInventoryRule('INV-2026-0005', { triggerRatio: 0.5 }, PMS_BUYER_ACTOR)
assert.equal(getPmsInventoryMonitorRow('INV-2026-0005')?.ruleStatus, '正常', '修复比例后规则应恢复')
assert.throws(() => generatePmsInventoryOrder('INV-2026-0004', '采购单', 1, PMS_BUYER_ACTOR), PmsDomainError)
assert.throws(() => generatePmsInventoryOrder('INV-2026-0003', '调拨单', 1, PMS_BUYER_ACTOR), PmsDomainError)
assert.throws(() => generatePmsInventoryOrder('INV-2026-0003', '采购单', 999999, PMS_BUYER_ACTOR), PmsDomainError)
const inventoryOrder = generatePmsInventoryOrder('INV-2026-0003', '采购单', 1000, PMS_BUYER_ACTOR)
assert.equal(inventoryOrder.orderType, '采购单', '应生成采购单')
assert.equal(listPmsInventoryOrders().length, 1, '建单日志应保留')

const transitDashboard = getPmsTransitDashboard()
assert.equal(transitDashboard.metrics.length, 9, '看板应有 9 个指标（含收货中）')
assert.equal(transitDashboard.trend.length, 7, '趋势应有 7 天')
assert.equal(transitDashboard.statusDistribution.reduce((sum, item) => sum + item.value, 0), listPmsTransitReceipts().length, '状态分布应与收货单一致')
assert.equal(transitDashboard.metrics.some((metric) => metric.label === '收货中'), true, '看板应含收货中指标')
assert.equal(transitDashboard.exceptions.length, 1, '应有 1 条收货异常')
assert.equal(filterPmsTransitReceipts('pending').length, 3, '待收货筛选应有 3 单')
assert.equal(filterPmsTransitReceipts('warehouse:广州中转仓').length, 5, '广州中转仓应有 5 单')
setPmsTransitFilter('exception')
assert.equal(consumePmsTransitFilter(), 'exception', '看板筛选应可传递给收货单列表')
assert.equal(consumePmsTransitFilter(), '', '筛选消费后应清空')
assert.equal(listPmsTransitOrderChecks().length, 6, '生产单校验应有 6 条')
assert.equal(listPmsTransitPreparationTasks().length, 5, '配料任务应有 5 条')

assert.equal(listPmsSettingUsers().length, 8, '用户应有 8 个')
assert.equal(listPmsSettingRoles().length, 6, '角色应有 6 个')
assert.equal(listPmsSettingDictionaries().length, 10, '字典应有 10 项')


// 15. 第二轮字段级补全断言（批次 A–F）。
const paymentInfoTarget = getPmsPaymentRequest('PAY-M-2026-0004')
assert.ok(paymentInfoTarget, 'PAY-M-2026-0004 应存在')
assert.equal(paymentInfoTarget.payee.name, paymentInfoTarget.objectName, '收款人默认取付款对象')
assert.equal(paymentInfoTarget.paymentInfo.nature, '材料款', '请款性质默认材料款')
updatePmsPaymentRequestInfo('PAY-M-2026-0004', {
  payee: { bankName: '中国银行脚本支行', bankAccount: '6222 0000 0000 0001', contactName: '脚本联系人' },
  paymentInfo: { paymentType: '全款', applicantDept: '财务部', note: '脚本付款信息' },
  amountInfo: { exchangeRate: 1, baseCurrencyAmount: paymentInfoTarget.payableAmount },
  narrative: { purpose: '脚本请款用途' },
}, PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest('PAY-M-2026-0004')?.payee.bankName, '中国银行脚本支行', '收款人银行信息应保存')
assert.throws(() => updatePmsPaymentRequestInfo('PAY-M-2026-0004', { amountInfo: { exchangeRate: 0 } }, PMS_FINANCE_ACTOR), PmsDomainError)
submitPmsPaymentRequest('PAY-M-2026-0004', paymentInfoTarget.payableAmount, PMS_FINANCE_ACTOR, '脚本请款备注', '2026-06-21')
assert.equal(getPmsPaymentRequest('PAY-M-2026-0004')?.requestRecords[0]?.note, '脚本请款备注', '请款记录应保留备注')
registerPmsPayment('PAY-M-2026-0004', { amount: paymentInfoTarget.payableAmount, method: '银行转账', voucherNo: 'BK-SCRIPT-0001', paidAt: '2026-06-22', note: '脚本付款' }, PMS_FINANCE_ACTOR)
assert.equal(getPmsPaymentRequest('PAY-M-2026-0004')?.paymentRecords[0]?.voucherNo, 'BK-SCRIPT-0001', '付款记录应保留凭证号')
assert.equal(getPmsPaymentRequest('PAY-M-2026-0004')?.status, '已完成', '全额付款后应完成')

const ruledInventory = updatePmsInventoryRule('INV-2026-0001', {
  processChain: ['染色', '印花', '绣花'],
  greigeSpu: 'GREIGE-SPU-01',
  greigeSku: 'GREIGE-SKU-01',
  greigeName: '脚本坯布',
  greigeStock: 1000,
}, PMS_BUYER_ACTOR)
assert.equal(formatPmsInventoryProcessChain(ruledInventory.processChain), '染色 → 印花 → 绣花', '工序链应按顺序保存')
assert.equal(ruledInventory.canTransfer, true, '坯布库存大于 0 时应可调拨')
assert.equal(ruledInventory.greigeSku, 'GREIGE-SKU-01', '坯布匹配应保存')
const transferOrder = generatePmsInventoryOrder('INV-2026-0001', '调拨单', 100, PMS_BUYER_ACTOR, {
  fromWarehouse: '广州原料仓',
  toWarehouse: '印尼雅加达面辅料仓',
  syncProcessOrder: true,
})
assert.equal(transferOrder.processOrderNos.length, 3, '同步加工单应按三道工序生成 3 个号')
assert.equal(transferOrder.syncProcessOrder, true, '调拨单应记录同步加工单')
const refreshResult = refreshPmsInventoryStocks(PMS_BUYER_ACTOR)
assert.ok(refreshResult.count >= 5, '批量刷新库存应覆盖全部监控行')
createPmsInventoryMonitorRow({ materialCode: 'FAB-SCRIPT-01', warehouse: '广州原料仓', stockQty: 100, safetyThreshold: 500, triggerMode: '比例', triggerRatio: 0.5, fixedTrigger: 0, targetStock: 2000 }, PMS_BUYER_ACTOR)
assert.ok(listPmsInventoryMonitor().some((row) => row.materialCode === 'FAB-SCRIPT-01'), '手动添加的监控 SKU 应进入列表')
assert.throws(() => createPmsInventoryMonitorRow({ materialCode: 'FAB-SCRIPT-01', warehouse: '广州原料仓', stockQty: 1, safetyThreshold: 1, triggerMode: '比例', triggerRatio: 0.5, fixedTrigger: 0, targetStock: 2 }, PMS_BUYER_ACTOR), PmsDomainError)

assert.equal(calculatePmsBoxVolume(60, 40, 30), 72000, '箱规体积应为长宽高乘积')
assert.throws(() => removePmsConfirmationBoxSpec('CONF-2026-0001', 'BOX-001', PMS_BUYER_ACTOR), PmsDomainError)
const boxConfirmation = addPmsConfirmationBoxSpec('CONF-2026-0002', { boxNo: 'BOX-SCRIPT-1', length: 60, width: 40, height: 30, remark: '脚本箱规' }, PMS_BUYER_ACTOR)
assert.ok(boxConfirmation.boxSpecs.some((spec) => spec.boxNo === 'BOX-SCRIPT-1' && spec.volume === 72000), '箱规应保存并计算体积')
const packageConfirmation = addPmsConfirmationPackageDetail('CONF-2026-0002', { packageMethod: '袋装', qty: 10, unit: '卷', remark: '脚本包装' }, PMS_BUYER_ACTOR)
assert.ok(packageConfirmation.packageDetails.some((detail) => detail.packageMethod === '袋装' && detail.qty === 10), '包装明细应保存')
const numberedConfirmation = generatePmsConfirmationRolls('CONF-2026-0004', { rollCount: 0, qtyPerPackage: 50, packageUnit: '米', boxCount: 2, rollNoPrefix: 'ROLL-SCRIPT', metersPerRoll: 50, weightPerRoll: 12.5, startSequence: 3 }, PMS_BUYER_ACTOR)
assert.equal(numberedConfirmation.rolls[0]?.rollNo, 'ROLL-SCRIPT-3', '卷号应按前缀与起始序号生成')
assert.throws(() => generatePmsConfirmationRolls('CONF-2026-0002', { rollCount: 0, qtyPerPackage: 50, packageUnit: '米', boxCount: 2, rollNoPrefix: 'X', metersPerRoll: 0, startSequence: 1 }, PMS_BUYER_ACTOR), PmsDomainError)

const materialWithDeclaration = updatePmsMaterialComplianceInfo('FAB-2026-0001', {
  declaration: { brandType: '自有品牌', brandName: '海谷脚本品牌', brandEnglishName: 'HiGood Script', productModel: 'HG-SCRIPT-01', otherDeclarationElements: '脚本申报要素', specialAttributes: ['纺织品', '金属'] },
  customs: { needCustomsDeclaration: true, legalSecondUnit: '千克', legalSecondUnitValue: 1.2 },
}, PMS_BUYER_ACTOR)
assert.equal(materialWithDeclaration.declarationInfo?.brandName, '海谷脚本品牌', '申报品牌应保存')
assert.deepEqual(materialWithDeclaration.declarationInfo?.specialAttributes, ['纺织品', '金属'], '特殊属性应保存')
assert.equal(materialWithDeclaration.customsInfo?.legalSecondUnit, '千克', '法定第二计量单位应保存')
assert.throws(() => updatePmsMaterialComplianceInfo('FAB-2026-0001', { declaration: { brandType: '非法品牌类型' } }, PMS_BUYER_ACTOR), PmsDomainError)
assert.throws(() => updatePmsMaterialComplianceInfo('FAB-2026-0001', { customs: { legalSecondUnitValue: -1 } }, PMS_BUYER_ACTOR), PmsDomainError)

updatePmsBomDetail('HG-TS-2601', { suggestedPrice: 129, targetGrossMargin: 38.5, mainFabric: '脚本主布料', printType: '水印', packagingNotes: '脚本包装说明' }, PMS_BUYER_ACTOR)
assert.equal(getPmsBomDetail('HG-TS-2601')?.suggestedPrice, 129, 'BOM 建议售价应保存')
assert.equal(getPmsBomDetail('HG-TS-2601')?.mainFabric, '脚本主布料', 'BOM 主布料应保存')
assert.throws(() => updatePmsBomDetail('HG-TS-2601', { suggestedPrice: -1 }, PMS_BUYER_ACTOR), PmsDomainError)

updatePmsSubjectOperation('SO-2026-05-01', { domesticFreight: 1200, customsDuty: 800, revenueStatus: '部分确认', confirmedRevenue: 50000 }, PMS_FINANCE_ACTOR)
const subjectAfter = getPmsSubjectOperation('SO-2026-05-01')
assert.ok(subjectAfter, '主体经营明细应存在')
assert.equal(subjectAfter.domesticFreight, 1200, '国内段运费应保存')
assert.equal(subjectAfter.customsDuty, 800, '关税应保存')
assert.equal(subjectAfter.revenueStatus, '部分确认', '收入状态应保存')
assert.equal(subjectAfter.confirmedRevenue, 50000, '已确认收入应保存')


// 16. 第三轮独立复核补全断言（M5-M7、P3-1..P3-7）。
const carrierWithExtras = createPmsFirstLegCarrier({
  carrierName: '脚本扩展物流商',
  shortName: '脚本扩展',
  countryOrRegion: '印尼',
  city: '雅加达',
  level: 'B级',
  contactName: '脚本联系人',
  contactPhone: '081200019999',
  email: 'script@carrier.co.id',
  wechat: 'script_carrier',
  address: 'Jl. Script No. 1',
  settlementCurrency: 'IDR',
  paymentMethod: '月结',
  accountPeriodDays: 30,
  invoiceInfo: '脚本开票信息',
  bankAccount: 'BCA 1234567890',
  payeeName: 'PT Script Carrier',
  supportedTransportMethods: ['海派', '快递'],
  supportedDestinations: ['印尼', '中国'],
  supportTaxDeclaration: true,
  supportCustomsClearance: true,
  supportDelivery: false,
  remark: '脚本创建',
}, PMS_BUYER_ACTOR)
assert.equal(carrierWithExtras.email, 'script@carrier.co.id', '物流商邮箱应保存')
assert.equal(carrierWithExtras.wechat, 'script_carrier', '物流商微信应保存')
assert.equal(carrierWithExtras.accountPeriodDays, 30, '账期天数应保存')
assert.deepEqual(carrierWithExtras.supportedTransportMethods, ['海派', '快递'], '支持运输方式应保存')
assert.equal(carrierWithExtras.supportDelivery, false, '支持派送开关应保存')
updatePmsFirstLegCarrier(carrierWithExtras.carrierCode, { accountPeriodDays: 45 }, PMS_BUYER_ACTOR)
assert.equal(listPmsFirstLegCarriers().find((carrier) => carrier.carrierCode === carrierWithExtras.carrierCode)?.accountPeriodDays, 45, '账期天数应可更新')
const channelWithExtras = createPmsFirstLegChannel({
  carrierId: carrierWithExtras.carrierCode,
  channelName: '脚本-雅加达 专线',
  transportMethod: '海派',
  estimatedTransitDays: 10,
  minTransitDays: 7,
  maxTransitDays: 14,
  cutoffTime: '18:00',
  departureFrequency: '每周三班',
  billingMethod: '计费重',
  chargeWeightFactor: 6000,
  volumeDivisor: 6000,
  minChargeWeight: 21,
  firstWeightPrice: 35,
  additionalWeightPrice: 12,
  unitPrice: 9.5,
  currency: 'RMB',
  includeTax: true,
  includeCustomsClearance: true,
  includeDelivery: false,
  taxRemark: '报价含税',
  taxMethod: '报税',
  originPlace: '深圳',
  destinationCountry: '印度尼西亚',
  destinationWarehouse: '印尼雅加达面辅料仓',
  applicableArea: '雅加达',
  transferCenter: '深圳转运中心',
  supportBattery: false,
  supportLiquid: false,
  supportSensitiveGoods: true,
  supportNormalGoods: true,
  maxBoxWeight: 30,
  maxBoxVolume: 0.3,
  remark: '脚本渠道',
}, PMS_BUYER_ACTOR)
assert.equal(channelWithExtras.minTransitDays, 7, '最短时效应保存')
assert.equal(channelWithExtras.cutoffTime, '18:00', '截单时间应保存')
assert.equal(channelWithExtras.chargeWeightFactor, 6000, '计费重系数应保存')
assert.equal(channelWithExtras.includeCustomsClearance, true, '包清关应保存')
assert.equal(channelWithExtras.supportSensitiveGoods, true, '敏感货支持应保存')
const aggregate = pmsFirstLegBatchAggregate(getPmsFirstLegBatch('FL-2026-0003') ?? batch)
assert.equal(aggregate.boxCount, 5, '批次总箱数应按记录箱数聚合')
assert.equal(typeof aggregate.totalWeightKg, 'number', '批次总重量应为数字')
assert.equal(pmsFirstLegTransitDays({ actualShipDate: '2026-06-05T20:00:00+07:00', arrivedAt: '2026-06-11T09:10:00+07:00' }), 6, '转运天数按出运到到仓计算')

const supplierSeed = getPmsSupplier('SUP-2026-0001')
assert.equal(supplierSeed?.category, '面料供应商', '供应商类型应对齐 SRM')
assert.equal(supplierSeed?.defaultDeliveryMethod, '供应商直发海外仓', '默认交货方式应对齐 SRM')
assert.equal(typeof supplierSeed?.onTimeDeliveryRate, 'number', '协同指标应存在')
assert.equal(getPmsSupplier(newSupplier.supplierCode)?.country, '中国', '供应商国家应保存')
assert.equal(getPmsSupplier(newSupplier.supplierCode)?.defaultDeliveryMethod, '供应商直发海外仓', '供应商交货方式应保存')
assert.ok(!['面辅料', '成衣', '样衣', '综合'].includes(String(getPmsSupplier(newSupplier.supplierCode)?.category)), '不应保留旧供应商类型')

const ppo = getPmsProductPurchaseOrder('CG-2026-0016') ?? getPmsProductPurchaseOrder('CG-2026-0001')
assert.ok(ppo, '商品采购单应存在')
assert.equal(typeof ppo?.purchaser, 'string', '采购专员应存在')
assert.equal(['是', '否'].includes(String(ppo?.isUrgent)), true, '加急字段应为是/否')
assert.ok(ppo?.lines.some((line) => typeof line.bomNo === 'string'), '明细应含 BOM 编号')
assert.ok(ppo?.lines.every((line) => pmsProductPurchaseOrderLineAmount(line) >= 0), '行采购金额应非负')
assert.equal(pmsProductPurchaseOrderAmount(ppo!), ppo!.lines.reduce((sum, line) => sum + pmsProductPurchaseOrderLineAmount(line), 0), '汇总金额应与行金额一致')

assert.ok(listPmsWarehouses().every((warehouse) => ['面辅料仓', '加工仓', '成衣仓', '样衣仓', '中转仓', '退货仓'].includes(warehouse.warehouseType)), '仓库类型应对齐 SRM 枚举（无旧值）')
assert.equal(new Set(listPmsWarehouses().map((warehouse) => warehouse.warehouseType)).size, 6, '仓库种子应覆盖全部 6 种类型')
assert.throws(() => updatePmsMaterialProcurementInfo('FAB-2026-0001', { defaultPurchaseRegion: '海外' as never }, PMS_BUYER_ACTOR), PmsDomainError)
assert.throws(() => updatePmsMaterialProcurementInfo('FAB-2026-0001', { currency: 'EUR' as never }, PMS_BUYER_ACTOR), PmsDomainError)
assert.ok(listPmsWarehouses().every((warehouse) => ['已同步', '同步异常'].includes(warehouse.syncStatus)), '仓库应有同步状态')
assert.ok(listPmsWarehouses().every((warehouse) => typeof warehouse.availableForShipment === 'boolean'), '仓库应有可发货开关')
assert.ok(listPmsUnits().every((unit) => ['长度', '重量', '数量', '包装', '面积', '体积'].includes(unit.category)), '单位类型应为 SRM 六类')
assert.ok(listPmsUnits().some((unit) => unit.category === '包装'), '单位类型应包含包装')
assert.ok(listPmsUnits().every((unit) => unit.category !== '时间'), '单位类型不应再含时间')
const requirementWithHistory = listPmsMaterialRequirements().flatMap((requirement) => requirement.lines)[0]
assert.ok(requirementWithHistory && requirementWithHistory.historicalStockQty >= 0, '物料行应有历史库存')
assert.ok(requirementWithHistory && requirementWithHistory.idHistoricalStockQty >= 0, '物料行应有 ID 历史库存')
assert.ok(listPmsTransitOrderChecks().every((check) => ['缺货', '未收齐', '已收齐'].includes(check.receivedStatus)), '生产单校验状态应对齐 SRM')
assert.ok(listPmsTransitPreparationTasks().every((task) => ['已收齐配料', '未收齐配料'].includes(task.type)), '配料任务类型应对齐 SRM')
assert.equal(filterPmsTransitReceipts('receiving').length, 1, '收货中筛选应命中 1 单')

console.log('[check-pms-purchase-chain] PASS')
console.log(`  菜单路由: ${pmsMenuHrefs.length} 条，精确路由 ${Object.keys(routes.exactRoutes).length} 条`)
console.log(`  采购建议: ${suggestion.suggestionNo} 建议量 ${suggestion.totalSuggestedQty}`)
console.log(`  面辅料需求: ${generated.requirementNo} 物料行 ${generated.lines.length}`)
console.log(`  生成采购单: ${createdOrder.purchaseOrderNo}`)
console.log(`  面辅料下推: ${pushedOrders.map((order) => order.purchaseOrderNo).join('、')}`)
console.log(`  头程单: ${batch.batchNo} → ${arrivedBatch?.status}`)
console.log(`  供应商确认: CONF-2026-0001 已确认并回写`)
console.log(`  主数据: 物料 ${materials.length}、供应商 ${listPmsSuppliers().length}、供货档案 ${listPmsSupplyArchives().length}、单位 ${listPmsUnits().length}`)
console.log(`  BOM: HG-JK-2605 发布后生成需求成功`)
console.log(`  对账请款: 面辅料对账 ${listPmsMaterialReconciliations().length} 条、物流对账 ${listPmsLogisticsReconciliations().length} 条、请款单 ${listPmsPaymentRequests().length} 张`)
console.log(`  请款闭环: ${materialRequest.requestNo} 已请款并部分付款；${logisticsRequest.requestNo} 已作废并释放对账`)
console.log(`  库存监控: ${inventoryRows.length} 条、建单 ${inventoryOrder.orderNo}`)
console.log(`  中转仓: 收货单 ${listPmsTransitReceipts().length} 条、异常 ${transitDashboard.exceptions.length} 条`)
console.log(`  系统设置: 用户 ${listPmsSettingUsers().length}、角色 ${listPmsSettingRoles().length}、字典 ${listPmsSettingDictionaries().length}`)
