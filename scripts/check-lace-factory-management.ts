import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  cancelLaceProductionOrder,
  cancelPurchaseOrder,
  checkPurchaseOrderCancellation,
  completeLaceProduction,
  confirmLaceReceipt,
  countPendingPurchaseChanges,
  createLaceCompletionReport,
  createLaceHandover,
  getLaceProductionOrderView,
  getLaceRuntimeEvidenceSnapshot,
  getPurchaseChangeViewStatus,
  getPurchaseSkuReceivedQty,
  LaceDomainError,
  LACE_FACTORY_OPERATOR,
  LACE_FACTORY_SUPERVISOR,
  listLaceCompletionReports,
  listLaceHandovers,
  listLaceOperationLogs,
  listLaceProductionOrders,
  markPurchaseChangeViewed,
  PLATFORM_ADMIN,
  PMS_BUYER,
  recordPurchaseCancellationAttempt,
  requiresLaceOverproductionConfirmation,
  resetLaceFactoryRuntime,
  restoreCancelledLaceProductionOrder,
  startLaceProduction,
  syncLaceProductionOrders,
  undoLaceProductionCompletion,
  updateLaceProcessingInputs,
  updateLaceCompletionReport,
  updatePurchaseOrder,
  validateCriticalPurchaseChange,
  WLS_ACCESSORY_CLERK,
  WLS_ACCESSORY_SUPERVISOR,
} from '../src/data/fcs/lace-factory-domain.ts'
import { buildLaceProductionGenerationKey } from '../src/data/fcs/lace-production-generation-key.ts'
import {
  createAccessoryPurchaseOrderSeeds,
  projectLacePurchaseDemands,
} from '../src/data/fcs/lace-factory-purchase-projection.ts'
import { menusBySystem } from '../src/data/app-shell-config.ts'
import { renderLaceHandoverRecordsPage } from '../src/pages/process-factory/accessory/lace/handover-records.ts'
import {
  buildLacePurchaseDemandRows,
  renderLacePurchaseDemandsPage,
} from '../src/pages/process-factory/accessory/lace/purchase-demands.ts'
import { renderLaceWorkOrderDetailPage } from '../src/pages/process-factory/accessory/lace/work-order-detail.ts'
import { renderLaceWorkOrdersPage } from '../src/pages/process-factory/accessory/lace/work-orders.ts'
import { listExecutableLaceWorkOrderActions } from '../src/pages/process-factory/accessory/lace/work-order-action-policy.ts'
import { renderPmsPurchaseOrdersPage } from '../src/pages/pms-purchase-orders.ts'
import { renderWlsAccessoryReceiptsPage } from '../src/pages/wls-accessory-receipts.ts'

function expectDomainError(code: string, fn: () => unknown): void {
  assert.throws(fn, (error: unknown) => error instanceof LaceDomainError && error.code === code)
}

function findOrderBySku(skuCode: string) {
  const order = listLaceProductionOrders(PLATFORM_ADMIN).find((item) => item.skuCode === skuCode)
  assert.ok(order, `missing work order for ${skuCode}`)
  return order
}

const observedLogActions = new Set<string>()
const observedSecondConfirmations = new Set<string>()

function captureOperationEvidence(): void {
  listLaceOperationLogs().forEach((log) => {
    observedLogActions.add(log.action)
    if (log.secondConfirmation === '已确认') observedSecondConfirmations.add(log.action)
  })
}

const domainSource = readFileSync(new URL('../src/data/fcs/lace-factory-domain.ts', import.meta.url), 'utf8')
const actionPolicySource = readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-order-action-policy.ts', import.meta.url), 'utf8')
const workOrderListSource = readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-orders.ts', import.meta.url), 'utf8')
const workOrderDetailSource = readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-order-detail.ts', import.meta.url), 'utf8')
const projectionSource = readFileSync(new URL('../src/data/fcs/lace-factory-purchase-projection.ts', import.meta.url), 'utf8')
const v15ContractGaps: string[] = []

function requireV15Contract(condition: boolean, gap: string): void {
  if (!condition) v15ContractGaps.push(gap)
}

requireV15Contract(
  /export type LaceProductionStatus\s*=\s*'待接收'\s*\|\s*'加工中'\s*\|\s*'已完结'\s*\|\s*'已取消'/.test(domainSource),
  '花边生产主状态必须对齐辅助工艺：待接收、加工中、已完结、已取消。',
)
requireV15Contract(
  /demandSource\s*:\s*LaceDemandSourceSnapshot/.test(domainSource),
  '生产单必须具有独立 demandSource: LaceDemandSourceSnapshot 需求来源快照。',
)
requireV15Contract(
  /inputLines\s*:\s*LaceProcessingInputLine\[\]/.test(domainSource),
  '生产单必须保留独立 inputLines: LaceProcessingInputLine[] 加工投入清单。',
)
requireV15Contract(
  /processingOutput\s*:\s*LaceProcessingOutput/.test(domainSource),
  '生产单必须具有独立 processingOutput: LaceProcessingOutput 加工产出对象。',
)
for (const label of ['确认接收', '加工填报', '完成加工单']) {
  requireV15Contract(actionPolicySource.includes(`label: '${label}'`), `共用动作策略必须提供“${label}”。`)
}
for (const legacyLabel of ['开始生产', '填报完工', '手动完成']) {
  requireV15Contract(!actionPolicySource.includes(`label: '${legacyLabel}'`), `共用动作策略不得继续展示旧动作“${legacyLabel}”。`)
}
for (const label of ['全部', '采购变更待查看', '待接收', '加工中', '已完结', '已取消']) {
  requireV15Contract(workOrderListSource.includes(label), `花边生产单任务 Tab 必须包含“${label}”。`)
}
for (const label of ['加工投入', '需求来源', '加工产出']) {
  requireV15Contract(new RegExp(`title:\\s*'${label}'`).test(workOrderListSource), `花边生产单列表必须有独立“${label}”摘要列。`)
  requireV15Contract(workOrderDetailSource.includes(`>${label}<`), `生产信息 Tab 必须完整展示“${label}”事实块。`)
}
requireV15Contract(/unitUsage\s*:\s*number/.test(projectionSource), '默认加工投入必须保存单位用量。')
requireV15Contract(workOrderDetailSource.includes('修改加工投入'), '详情加工投入区必须提供“修改加工投入”。')
requireV15Contract(!actionPolicySource.includes('maintain-input'), '列表和页头动作策略不得出现维护／修改投入动作。')
for (const removedFact of ['recordLaceActualInputs', 'recordNoActualLaceInputReason', 'sourceOrBatchNote', 'noActualInputReason']) {
  requireV15Contract(!`${domainSource}\n${workOrderDetailSource}`.includes(removedFact), `当前实现不得继续保留旧投入事实 ${removedFact}。`)
}
if (v15ContractGaps.length > 0) {
  throw new Error(`花边生产单 V1.5 专项契约尚未满足：\n- ${v15ContractGaps.join('\n- ')}`)
}

resetLaceFactoryRuntime()
let snapshot = getLaceRuntimeEvidenceSnapshot()

assert.equal(snapshot.factoryMappings.length, 1)
assert.equal(snapshot.factoryMappings[0].supplierName, 'Renda Jaya')
assert.equal(snapshot.factoryMappings[0].factoryOrgId, 'FAC-RJ-LACE')
assert.equal(snapshot.demands.length, 4, 'only active internal lace purchase SKUs enter PFOS')
assert.equal(snapshot.failures.length, 1, 'incomplete internal lace source is isolated as a generation failure')
assert.equal(snapshot.workOrders.length, 4, 'one work order per purchase order + SKU')
assert.equal(new Set(snapshot.workOrders.map((order) => order.generationKey)).size, 4)
snapshot.workOrders.forEach((order) => {
  assert.equal(order.demandSource.purchaseOrderId, order.purchaseOrderId)
  assert.equal(order.demandSource.purchaseVersion, order.purchaseVersion)
  assert.deepEqual(order.demandSource.sourceLineIds, order.sourceLineIds)
  assert.equal(order.processingOutput.skuId, order.skuId)
  assert.equal(order.processingOutput.planQty, order.planQty)
  assert.equal(order.processingOutput.unit, order.unit)
  assert.ok(order.inputLines.length > 0, 'every generated work order has known default processing inputs')
  order.inputLines.forEach((line) => {
    assert.ok(line.inputMaterialSku)
    assert.ok(line.unitUsage > 0)
    assert.equal(line.plannedQty, Math.round(order.planQty * line.unitUsage * 100) / 100)
  })
})
assert.ok(snapshot.failures.some((failure) => failure.reason.includes('默认加工投入')), 'missing default input stays in the purchase-demand failure row')
assert.equal(buildLaceProductionGenerationKey(' po-338468 ', ' sku-a '), 'PO-338468::SKU-A')
assert.ok(snapshot.logs.some((log) => log.action === '识别内部花边采购需求'))
assert.ok(snapshot.logs.some((log) => log.action === '自动生成生产单失败'))
assert.ok(snapshot.logs.every((log) => Boolean(log.actorOrgId)), 'all operation logs identify the acting organization')

const mergedDemand = snapshot.demands.find((demand) => demand.skuCode === 'IDFL251050-BLACK-19-4003PT')
assert.ok(mergedDemand)
assert.equal(mergedDemand.orderedQty, 350)
assert.deepEqual(mergedDemand.sourceLineIds, ['POL-338468-001-A', 'POL-338468-001-B'])
assert.equal(snapshot.workOrders.filter((order) => order.purchaseOrderId === 'PO-338468').length, 3)
assert.ok(!snapshot.workOrders.some((order) => order.skuCode === 'EXT-LACE-8CM'))
assert.ok(!snapshot.workOrders.some((order) => order.skuCode === 'ZIPPER-BRASS-18'))
assert.ok(!snapshot.workOrders.some((order) => order.skuCode === 'CANCELLED-LACE-5CM'))

const foreignFactoryActor = { ...LACE_FACTORY_OPERATOR, actorId: 'OTHER', factoryOrgId: 'FAC-OTHER' }
assert.equal(listLaceProductionOrders(foreignFactoryActor).length, 0, 'factory user data is isolated by factory org')
assert.equal(listLaceHandovers(undefined, foreignFactoryActor).length, 0, 'factory handover records are isolated by factory org')

const partialInvalidSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338468')!
partialInvalidSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-B')!.targetWarehouseId = ''
const partialInvalidProjection = projectLacePurchaseDemands([partialInvalidSource])
assert.ok(partialInvalidProjection.failures.some((failure) => failure.skuId === 'SKU-IDFL251050-BLACK-19-4003PT'))
assert.ok(
  !partialInvalidProjection.demands.some((demand) => demand.skuId === 'SKU-IDFL251050-BLACK-19-4003PT'),
  'one invalid source row blocks the whole purchase-order SKU group instead of generating a partial work order',
)

const missingDefaultInputSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338501')!
missingDefaultInputSource.lines[0].plannedInputs = undefined
const missingDefaultInputProjection = projectLacePurchaseDemands([missingDefaultInputSource])
assert.ok(missingDefaultInputProjection.failures.some((failure) => failure.reason.includes('默认加工投入')))
assert.equal(missingDefaultInputProjection.demands.length, 0, 'missing default input blocks work-order generation instead of creating a blank-input order')

const multipleInvalidSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338468')!
multipleInvalidSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-A')!.unit = ''
const secondInvalidLine = multipleInvalidSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-B')!
secondInvalidLine.targetWarehouseId = ''
secondInvalidLine.targetWarehouseName = ''
const multipleInvalidProjection = projectLacePurchaseDemands([multipleInvalidSource])
const unifiedFailureRows = buildLacePurchaseDemandRows({
  actor: LACE_FACTORY_OPERATOR,
  demands: multipleInvalidProjection.demands,
  workOrders: [],
  purchaseOrders: [multipleInvalidSource],
  failures: multipleInvalidProjection.failures,
}).filter((row) => row.kind === 'failure' && row.skuId === 'SKU-IDFL251050-BLACK-19-4003PT')
assert.equal(unifiedFailureRows.length, 1, 'multiple failures of one purchase-order SKU render as one standard-list row')
assert.equal(unifiedFailureRows[0].failureReasons.length, 2, 'the unified failure row keeps every distinct failure reason')
assert.equal(unifiedFailureRows[0].orderedQty, undefined, 'the row does not fabricate a quantity when source units are incomplete')
assert.equal(unifiedFailureRows[0].unit, undefined)

const inconsistentSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338468')!
inconsistentSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-B')!.unit = 'KG'
const inconsistentProjection = projectLacePurchaseDemands([inconsistentSource])
assert.ok(inconsistentProjection.failures.some((failure) => failure.reason.includes('同一采购单 SKU 来源行不一致')))
assert.ok(!inconsistentProjection.demands.some((demand) => demand.skuId === 'SKU-IDFL251050-BLACK-19-4003PT'))

const mixedMaterialSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338468')!
mixedMaterialSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-B')!.materialType = '拉链'
const mixedMaterialProjection = projectLacePurchaseDemands([mixedMaterialSource])
assert.ok(mixedMaterialProjection.failures.some((failure) => failure.reason.includes('物料类型')))
assert.ok(!mixedMaterialProjection.demands.some((demand) => demand.skuId === 'SKU-IDFL251050-BLACK-19-4003PT'))

const multipleStyleSource = createAccessoryPurchaseOrderSeeds().find((order) => order.purchaseOrderId === 'PO-338468')!
const secondStyleLine = multipleStyleSource.lines.find((line) => line.purchaseOrderLineId === 'POL-338468-001-B')!
secondStyleLine.styleId = 'STYLE-DENIM-SHORTS'
secondStyleLine.styleCode = 'DENIM-SHORTS-2608'
secondStyleLine.styleName = '牛仔短裤'
secondStyleLine.styleImageUrl = '/denim-shorts-sample.jpg'
const multipleStyleProjection = projectLacePurchaseDemands([multipleStyleSource])
const multipleStyleDemand = multipleStyleProjection.demands.find((demand) => demand.skuId === 'SKU-IDFL251050-BLACK-19-4003PT')
assert.ok(multipleStyleDemand, 'multiple source styles still merge into one purchase-order SKU demand')
assert.equal(new Set(multipleStyleDemand.sourceLines.map((line) => line.styleId)).size, 2)
assert.equal(multipleStyleDemand.sourceLineIds.length, 2)

const partial = findOrderBySku('IDFL251050-BLACK-19-4003PT')
assert.equal(partial.status, '加工中')
assert.equal(partial.completedQty, 196)
assert.equal(partial.handedOverQty, 120)
assert.equal(partial.receivedQty, 118)
assert.equal(partial.remainingHandoverQty, 76)
assert.equal(partial.handoverStatus, '部分交出')
assert.equal(partial.receiptStatus, '已收货')
assert.equal(partial.hasReceiptDifference, true)

assert.equal(requiresLaceOverproductionConfirmation(100, 149.99), false)
assert.equal(requiresLaceOverproductionConfirmation(100, 150), true)
assert.equal(requiresLaceOverproductionConfirmation(100, 151), true)

const inputPending = findOrderBySku('FLSZ26051153-104-11CM')
assert.equal(inputPending.inputLines.length, 2)
assert.deepEqual(inputPending.inputLines.map((line) => line.unitUsage), [1, 0.02])
assert.deepEqual(inputPending.inputLines.map((line) => line.plannedQty), [600, 12])
expectDomainError('REASON_REQUIRED', () => updateLaceProcessingInputs(
  inputPending.workOrderId,
  inputPending.inputLines.map((line) => ({
    currentInputMaterialId: line.inputMaterialId,
    nextInputMaterialId: line.inputMaterialId,
    unitUsage: line.unitUsage,
  })),
  '',
  LACE_FACTORY_OPERATOR,
))
const originalStatus = inputPending.status
const updatedInputs = updateLaceProcessingInputs(inputPending.workOrderId, [
  {
    currentInputMaterialId: inputPending.inputLines[0].inputMaterialId,
    nextInputMaterialId: 'MAT-RJ-YARN-002',
    unitUsage: 0.025,
  },
  {
    currentInputMaterialId: inputPending.inputLines[1].inputMaterialId,
    nextInputMaterialId: inputPending.inputLines[1].inputMaterialId,
    unitUsage: inputPending.inputLines[1].unitUsage,
  },
], '样品确认后调整投入 SKU 与单位用量', LACE_FACTORY_OPERATOR)
assert.equal(updatedInputs.status, originalStatus, 'editing input never changes production status')
assert.equal(updatedInputs.inputLines[0].inputMaterialSku, 'RJ-YARN-LACE-150D')
assert.equal(updatedInputs.inputLines[0].unitUsage, 0.025)
assert.equal(updatedInputs.inputLines[0].plannedQty, 15)
assert.equal(updatedInputs.inputLines.length, 2, 'the first phase does not add or remove input lines')
startLaceProduction(inputPending.workOrderId, LACE_FACTORY_OPERATOR)
expectDomainError('FORBIDDEN_FACTORY', () => startLaceProduction(inputPending.workOrderId, PMS_BUYER))
expectDomainError('FUTURE_EVENT_TIME', () => createLaceCompletionReport({
  workOrderId: inputPending.workOrderId,
  qty: 1,
  reportedAt: '2999-01-01T00:00:00+07:00',
  clientActionId: 'CHECK-FUTURE-REPORT',
}))
let createdReport = createLaceCompletionReport({
  workOrderId: inputPending.workOrderId,
  qty: 600,
  note: '一次完工',
  clientActionId: 'CHECK-REPORT-IDEMPOTENT',
})
const sameReport = createLaceCompletionReport({
  workOrderId: inputPending.workOrderId,
  qty: 600,
  note: '重复提交不新增',
  clientActionId: 'CHECK-REPORT-IDEMPOTENT',
})
assert.equal(createdReport.reportId, sameReport.reportId)
assert.equal(listLaceCompletionReports(inputPending.workOrderId).length, 1)
assert.equal(getLaceProductionOrderView(inputPending.workOrderId, LACE_FACTORY_OPERATOR)?.status, '加工中', 'reaching plan never auto-completes')
completeLaceProduction(inputPending.workOrderId, '人员完成加工单', LACE_FACTORY_OPERATOR)
assert.equal(getLaceProductionOrderView(inputPending.workOrderId, LACE_FACTORY_OPERATOR)?.status, '已完结')
expectDomainError('INPUT_LOCKED', () => updateLaceProcessingInputs(
  inputPending.workOrderId,
  updatedInputs.inputLines.map((line) => ({
    currentInputMaterialId: line.inputMaterialId,
    nextInputMaterialId: line.inputMaterialId,
    unitUsage: line.unitUsage,
  })),
  '已完结时不可修改',
  LACE_FACTORY_OPERATOR,
))
expectDomainError('SUPERVISOR_REQUIRED', () => undoLaceProductionCompletion(inputPending.workOrderId, '普通业务员不可撤销', LACE_FACTORY_OPERATOR))
expectDomainError('REPORT_STATUS_LOCKED', () => createLaceCompletionReport({
  workOrderId: inputPending.workOrderId,
  qty: 1,
  clientActionId: 'CHECK-LOCKED-REPORT',
}))
undoLaceProductionCompletion(inputPending.workOrderId, '继续补产', LACE_FACTORY_SUPERVISOR)
assert.equal(getLaceProductionOrderView(inputPending.workOrderId, LACE_FACTORY_OPERATOR)?.completedQty, 600)
createdReport = updateLaceCompletionReport({
  reportId: createdReport.reportId,
  qty: 590,
  reason: '复核后修正首批完工数量',
  actor: LACE_FACTORY_OPERATOR,
})
completeLaceProduction(inputPending.workOrderId, '少产仍由人员完成加工单', LACE_FACTORY_OPERATOR)
assert.equal(getLaceProductionOrderView(inputPending.workOrderId, LACE_FACTORY_OPERATOR)?.status, '已完结')
undoLaceProductionCompletion(inputPending.workOrderId, '继续核对等量完成', LACE_FACTORY_SUPERVISOR)
createdReport = updateLaceCompletionReport({
  reportId: createdReport.reportId,
  qty: 600,
  reason: '核对为等量完工',
  actor: LACE_FACTORY_OPERATOR,
})
completeLaceProduction(inputPending.workOrderId, '等量仍由人员完成加工单', LACE_FACTORY_OPERATOR)
undoLaceProductionCompletion(inputPending.workOrderId, '继续核对超产完成', LACE_FACTORY_SUPERVISOR)
createdReport = updateLaceCompletionReport({
  reportId: createdReport.reportId,
  qty: 610,
  reason: '核对为普通超产',
  actor: LACE_FACTORY_OPERATOR,
})
completeLaceProduction(inputPending.workOrderId, '普通超产仍由人员完成加工单', LACE_FACTORY_OPERATOR)
const completedStatusHandover = createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 10,
  deliveryNo: 'CHECK-DELIVERY-COMPLETED',
  packageCount: 1,
  packageNote: '已完结状态仍可交出',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-COMPLETED',
})
assert.equal(completedStatusHandover.qty, 10)
undoLaceProductionCompletion(inputPending.workOrderId, '已完结交出后仍可撤销完成，历史交出不回滚', LACE_FACTORY_SUPERVISOR)
createdReport = updateLaceCompletionReport({
  reportId: createdReport.reportId,
  qty: 590,
  reason: '回到后续交出检查数量',
  actor: LACE_FACTORY_OPERATOR,
})

let handoverCount = listLaceHandovers(inputPending.workOrderId).length
const handover = createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 300,
  deliveryNo: 'CHECK-DELIVERY-001',
  packageCount: 3,
  packageNote: '三包',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-IDEMPOTENT',
})
const repeatedHandover = createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 300,
  deliveryNo: 'CHECK-DELIVERY-001',
  packageCount: 3,
  packageNote: '重复提交',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-IDEMPOTENT',
})
assert.equal(handover.handoverId, repeatedHandover.handoverId)
assert.equal(listLaceHandovers(inputPending.workOrderId).length, handoverCount + 1)
expectDomainError('FUTURE_EVENT_TIME', () => createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 1,
  deliveryNo: 'CHECK-DELIVERY-FUTURE',
  packageCount: 1,
  packageNote: '',
  expectedReceiverName: '中央辅料仓',
  handedOverAt: '2999-01-01T00:00:00+07:00',
  clientActionId: 'CHECK-HANDOVER-FUTURE',
}))
expectDomainError('COMPLETION_BELOW_HANDOVER', () => updateLaceCompletionReport({
  reportId: createdReport.reportId,
  qty: 200,
  reason: '错误修改',
}))
handoverCount = listLaceHandovers(inputPending.workOrderId).length
expectDomainError('HANDOVER_EXCEEDS_REMAINING', () => createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 301,
  deliveryNo: 'CHECK-DELIVERY-BAD',
  packageCount: 1,
  packageNote: '',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-BAD',
}))
expectDomainError('HANDOVER_FIELDS_REQUIRED', () => createLaceHandover({
  workOrderId: inputPending.workOrderId,
  qty: 1,
  deliveryNo: 'CHECK-DELIVERY-FRACTIONAL-PACKAGE',
  packageCount: 0.5,
  packageNote: '',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-FRACTIONAL-PACKAGE',
}))
assert.equal(listLaceHandovers(inputPending.workOrderId).length, handoverCount, 'failed handover creates no half-chain')

const pendingReceiptHandover = listLaceHandovers().find((item) => item.skuCode === 'FLSZ26051153-105-4CM' && item.receiptStatus === '待收货')
assert.ok(pendingReceiptHandover)
expectDomainError('WLS_ROLE_REQUIRED', () => confirmLaceReceipt({
  handoverId: pendingReceiptHandover.handoverId,
  actualQty: 420,
  differenceReason: '',
  evidence: '',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-WRONG-RECEIPT-ROLE',
  actor: LACE_FACTORY_OPERATOR,
}))
const receipt = confirmLaceReceipt({
  handoverId: pendingReceiptHandover.handoverId,
  actualQty: 418,
  differenceReason: '清点短少 2 Yard',
  evidence: 'CHECK-RECEIPT.jpg',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-RECEIPT-IDEMPOTENT',
  actor: WLS_ACCESSORY_CLERK,
})
const repeatedReceipt = confirmLaceReceipt({
  handoverId: pendingReceiptHandover.handoverId,
  actualQty: 418,
  differenceReason: '重复提交',
  evidence: 'CHECK-RECEIPT.jpg',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-RECEIPT-IDEMPOTENT',
  actor: WLS_ACCESSORY_CLERK,
})
assert.equal(receipt.receiptId, repeatedReceipt.receiptId)
assert.equal(receipt.warehouseLocation, '辅料收货区 A-01')
assert.equal(getPurchaseSkuReceivedQty('PO-338468', 'SKU-FLSZ26051153-105-4CM'), 418)
assert.ok(listLaceOperationLogs().some((log) => log.action === '回写采购 SKU 实收' && log.objectId === 'PO-338468'))
assert.ok(listLaceOperationLogs({ objectId: pendingReceiptHandover.handoverId }).some((log) => log.action === '确认实际收货'), 'handover trace includes its related receipt log')
const receiptWorkOrderLogs = listLaceOperationLogs({ workOrderId: pendingReceiptHandover.workOrderId })
assert.ok(receiptWorkOrderLogs.some((log) => log.action === '确认实际收货'))
assert.ok(receiptWorkOrderLogs.some((log) => log.action === '回写采购 SKU 实收'), 'work-order trace reaches the downstream PMS receipt writeback')
expectDomainError('RECEIPT_ALREADY_CONFIRMED', () => confirmLaceReceipt({
  handoverId: pendingReceiptHandover.handoverId,
  actualQty: 418,
  differenceReason: '',
  evidence: '',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-SECOND-FINAL-RECEIPT',
}))

const partialSecondHandover = createLaceHandover({
  workOrderId: partial.workOrderId,
  qty: 76,
  deliveryNo: 'CHECK-DELIVERY-OVER-RECEIPT',
  packageCount: 1,
  packageNote: '一包',
  expectedReceiverName: '中央辅料仓',
  clientActionId: 'CHECK-HANDOVER-OVER-RECEIPT',
})
expectDomainError('RECEIPT_BEFORE_HANDOVER', () => confirmLaceReceipt({
  handoverId: partialSecondHandover.handoverId,
  actualQty: 76,
  differenceReason: '',
  evidence: '',
  warehouseLocation: '辅料收货区 A-01',
  receivedAt: '2020-01-01T00:00:00+07:00',
  clientActionId: 'CHECK-RECEIPT-BEFORE-HANDOVER',
}))
expectDomainError('FUTURE_EVENT_TIME', () => confirmLaceReceipt({
  handoverId: partialSecondHandover.handoverId,
  actualQty: 76,
  differenceReason: '',
  evidence: '',
  warehouseLocation: '辅料收货区 A-01',
  receivedAt: '2999-01-01T00:00:00+07:00',
  clientActionId: 'CHECK-RECEIPT-FUTURE',
}))
expectDomainError('OVER_RECEIPT_CONFIRM_REQUIRED', () => confirmLaceReceipt({
  handoverId: partialSecondHandover.handoverId,
  actualQty: 80,
  differenceReason: '现场复磅多 4 Yard',
  evidence: 'CHECK-OVER.jpg',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-OVER-RECEIPT',
  actor: WLS_ACCESSORY_CLERK,
}))
confirmLaceReceipt({
  handoverId: partialSecondHandover.handoverId,
  actualQty: 80,
  differenceReason: '现场复磅多 4 Yard',
  evidence: 'CHECK-OVER.jpg',
  warehouseLocation: '辅料收货区 A-01',
  clientActionId: 'CHECK-OVER-RECEIPT',
  overReceiptConfirmed: true,
  actor: WLS_ACCESSORY_SUPERVISOR,
})

captureOperationEvidence()
resetLaceFactoryRuntime()
assert.equal(countPendingPurchaseChanges(LACE_FACTORY_OPERATOR), 1, 'pending change count is deduped by purchase order')
assert.equal(getPurchaseChangeViewStatus('PO-338468', LACE_FACTORY_OPERATOR), '待查看')
assert.equal(
  listLaceProductionOrders(LACE_FACTORY_OPERATOR).filter((order) => order.purchaseChangeStatus === '待查看').length,
  3,
  'one changed purchase order can put multiple work orders into the pending-view task tab',
)
expectDomainError('FORBIDDEN_FACTORY', () => markPurchaseChangeViewed('PO-338468', PMS_BUYER))
const secondFactoryViewer = { ...LACE_FACTORY_OPERATOR, actorId: 'USR-RJ-BUSINESS-02', actorName: 'Dian · Renda Jaya' }
markPurchaseChangeViewed('PO-338468', LACE_FACTORY_OPERATOR)
assert.equal(countPendingPurchaseChanges(LACE_FACTORY_OPERATOR), 0)
assert.equal(
  listLaceProductionOrders(LACE_FACTORY_OPERATOR).filter((order) => order.purchaseChangeStatus === '待查看').length,
  0,
  'viewing the purchase-order change removes all of that user\'s affected work orders from the pending-view tab',
)
assert.equal(getPurchaseChangeViewStatus('PO-338468', secondFactoryViewer), '待查看', 'view state is isolated by user and purchase version')
const purchaseBeforeFailedChange = getLaceRuntimeEvidenceSnapshot().purchaseOrders.find((order) => order.purchaseOrderId === 'PO-338468')!
expectDomainError('INVALID_PURCHASE_QTY', () => updatePurchaseOrder('PO-338468', {
  quantityBySku: {
    'SKU-IDFL251050-BLACK-19-4003PT': 355,
    'SKU-FLSZ26051153-104-11CM': 0,
  },
}, 'CHECK-PURCHASE-ATOMIC-FAILURE'))
const purchaseAfterFailedChange = getLaceRuntimeEvidenceSnapshot().purchaseOrders.find((order) => order.purchaseOrderId === 'PO-338468')!
assert.equal(purchaseAfterFailedChange.version, purchaseBeforeFailedChange.version, 'failed purchase changes must not advance the version')
assert.deepEqual(
  purchaseAfterFailedChange.lines.map((line) => [line.purchaseOrderLineId, line.orderedQty]),
  purchaseBeforeFailedChange.lines.map((line) => [line.purchaseOrderLineId, line.orderedQty]),
  'failed purchase changes must not leave a partially updated SKU row',
)
expectDomainError('PURCHASE_SKU_NOT_FOUND', () => updatePurchaseOrder('PO-338468', {
  quantityBySku: { 'SKU-NOT-IN-ORDER': 10 },
  note: '不得忽略未知 SKU 后只保存备注',
}, 'CHECK-PURCHASE-UNKNOWN-SKU'))
expectDomainError('INVALID_PURCHASE_DUE_DATE', () => updatePurchaseOrder('PO-338468', {
  quantityBySku: { 'SKU-IDFL251050-BLACK-19-4003PT': 355 },
  dueDate: '',
}, 'CHECK-PURCHASE-INVALID-DATE'))
expectDomainError('INVALID_TARGET_WAREHOUSE', () => updatePurchaseOrder('PO-338468', {
  quantityBySku: { 'SKU-IDFL251050-BLACK-19-4003PT': 355 },
  targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
}, 'CHECK-PURCHASE-INCOMPLETE-WAREHOUSE'))
const purchaseAfterAllFailedChanges = getLaceRuntimeEvidenceSnapshot().purchaseOrders.find((order) => order.purchaseOrderId === 'PO-338468')!
assert.equal(purchaseAfterAllFailedChanges.version, purchaseBeforeFailedChange.version)
assert.deepEqual(
  purchaseAfterAllFailedChanges.lines.map((line) => [line.purchaseOrderLineId, line.orderedQty]),
  purchaseBeforeFailedChange.lines.map((line) => [line.purchaseOrderLineId, line.orderedQty]),
)
updatePurchaseOrder('PO-338468', {
  quantityBySku: { 'SKU-IDFL251050-BLACK-19-4003PT': 360 },
  dueDate: '2026-08-16',
  note: '第三版采购变更',
}, 'CHECK-PURCHASE-CHANGE')
assert.equal(countPendingPurchaseChanges(LACE_FACTORY_OPERATOR), 1, 'new purchase version resets viewed state')
assert.equal(
  listLaceProductionOrders(LACE_FACTORY_OPERATOR).filter((order) => order.purchaseOrderId === 'PO-338468' && order.purchaseChangeStatus === '待查看').length,
  3,
  'a new purchase version makes all affected work orders pending-view again for the same user',
)
assert.equal(getPurchaseChangeViewStatus('PO-338468', secondFactoryViewer), '待查看')
assert.equal(findOrderBySku('IDFL251050-BLACK-19-4003PT').planQty, 360)
assert.equal(findOrderBySku('IDFL251050-BLACK-19-4003PT').demandSource.purchaseVersion, 3)
assert.equal(findOrderBySku('IDFL251050-BLACK-19-4003PT').demandSource.planQty, 360)
assert.equal(findOrderBySku('IDFL251050-BLACK-19-4003PT').demandSource.dueDate, '2026-08-16')
assert.equal(findOrderBySku('IDFL251050-BLACK-19-4003PT').processingOutput.planQty, 360)
assert.equal(validateCriticalPurchaseChange('PO-338468', 'SKU').allowed, false)
assert.equal(validateCriticalPurchaseChange('PO-338468', '供应商／工厂').allowed, false)
assert.equal(validateCriticalPurchaseChange('PO-338468', '单位').allowed, false)

snapshot = getLaceRuntimeEvidenceSnapshot()
const workOrderCountBeforeFix = snapshot.workOrders.length
const validDefaultInputs = createAccessoryPurchaseOrderSeeds()
  .find((order) => order.purchaseOrderId === 'PO-338501')!
  .lines[0].plannedInputs!
updatePurchaseOrder('PO-338520', {
  plannedInputsBySku: { 'SKU-FLSZ26051153-107-2CM': validDefaultInputs },
}, 'CHECK-FIX-GENERATION-FAILURE')
assert.equal(getLaceRuntimeEvidenceSnapshot().failures.length, 0)
assert.equal(getLaceRuntimeEvidenceSnapshot().workOrders.length, workOrderCountBeforeFix + 1)
syncLaceProductionOrders()
assert.equal(getLaceRuntimeEvidenceSnapshot().workOrders.length, workOrderCountBeforeFix + 1, 'safe retry remains idempotent')

captureOperationEvidence()
resetLaceFactoryRuntime()
assert.equal(checkPurchaseOrderCancellation('PO-338501').allowed, true)
cancelPurchaseOrder({ purchaseOrderId: 'PO-338501', reason: '待接收采购需求整体撤回', clientActionId: 'CHECK-PURCHASE-CANCEL-PENDING' })
assert.ok(listLaceOperationLogs().some((log) => log.action === '采购取消同步取消生产单'))
captureOperationEvidence()
resetLaceFactoryRuntime()
assert.equal(checkPurchaseOrderCancellation('PO-338468').allowed, false)
const orderWithDownstream = findOrderBySku('IDFL251050-BLACK-19-4003PT')
expectDomainError('DOWNSTREAM_FACT_EXISTS', () => cancelLaceProductionOrder({
  workOrderId: orderWithDownstream.workOrderId,
  reason: '已有下游事实不得取消',
  actor: LACE_FACTORY_SUPERVISOR,
  secondConfirmed: true,
}))
recordPurchaseCancellationAttempt('PO-338468')
assert.ok(listLaceOperationLogs().some((log) => log.action === '采购取消被生产门禁阻断' && log.objectId === 'PO-338468'))
assert.equal(checkPurchaseOrderCancellation('PO-338501').allowed, true)
const pendingCancelable = findOrderBySku('FLSZ26051153-106-3CM')
expectDomainError('SUPERVISOR_REQUIRED', () => cancelLaceProductionOrder({
  workOrderId: pendingCancelable.workOrderId,
  reason: '普通业务员不可取消',
  actor: LACE_FACTORY_OPERATOR,
}))
startLaceProduction(pendingCancelable.workOrderId, LACE_FACTORY_OPERATOR)
assert.equal(checkPurchaseOrderCancellation('PO-338501').allowed, false, 'entered production blocks purchase cancellation')
expectDomainError('CANCEL_CONFIRM_REQUIRED', () => cancelLaceProductionOrder({
  workOrderId: pendingCancelable.workOrderId,
  reason: '主管尚未二次确认',
  actor: LACE_FACTORY_SUPERVISOR,
}))
cancelLaceProductionOrder({
  workOrderId: pendingCancelable.workOrderId,
  reason: '主管确认先取消已进入加工的生产单',
  actor: LACE_FACTORY_SUPERVISOR,
  secondConfirmed: true,
})
assert.equal(checkPurchaseOrderCancellation('PO-338501').allowed, true, 'purchase cancellation is allowed only after the entered production order is cancelled')
expectDomainError('PMS_ROLE_REQUIRED', () => cancelPurchaseOrder({
  purchaseOrderId: 'PO-338501', reason: '错误角色', clientActionId: 'CHECK-PURCHASE-WRONG-ROLE', actor: LACE_FACTORY_OPERATOR,
}))
cancelPurchaseOrder({ purchaseOrderId: 'PO-338501', reason: '采购需求撤回', clientActionId: 'CHECK-PURCHASE-CANCEL' })
assert.equal(findOrderBySku('FLSZ26051153-106-3CM').status, '已取消')
assert.ok(listLaceOperationLogs().some((log) => log.action === '取消生产单'
  && log.objectId === pendingCancelable.workOrderId
  && log.secondConfirmation === '已确认'))
expectDomainError('PURCHASE_NOT_ACTIVE', () => restoreCancelledLaceProductionOrder(
  pendingCancelable.workOrderId,
  '采购已取消时不得恢复生产单',
  PLATFORM_ADMIN,
))

const cancellableStarted = findOrderBySku('FLSZ26051153-104-11CM')
startLaceProduction(cancellableStarted.workOrderId)
createLaceCompletionReport({ workOrderId: cancellableStarted.workOrderId, qty: 10, clientActionId: 'CHECK-CANCEL-REPORT' })
expectDomainError('CANCEL_CONFIRM_REQUIRED', () => cancelLaceProductionOrder({
  workOrderId: cancellableStarted.workOrderId,
  reason: '主管尚未二次确认',
  actor: LACE_FACTORY_SUPERVISOR,
}))
cancelLaceProductionOrder({
  workOrderId: cancellableStarted.workOrderId,
  reason: '主管确认停止生产',
  actor: LACE_FACTORY_SUPERVISOR,
  secondConfirmed: true,
})
assert.equal(listLaceCompletionReports(cancellableStarted.workOrderId).length, 1, 'cancel never deletes completion facts')
const generationKeyBeforeRestore = findOrderBySku('FLSZ26051153-104-11CM').generationKey
const countBeforeRestore = listLaceProductionOrders(PLATFORM_ADMIN).length
restoreCancelledLaceProductionOrder(cancellableStarted.workOrderId, '误取消恢复', PLATFORM_ADMIN)
assert.equal(findOrderBySku('FLSZ26051153-104-11CM').generationKey, generationKeyBeforeRestore)
assert.equal(listLaceProductionOrders(PLATFORM_ADMIN).length, countBeforeRestore)

captureOperationEvidence()
resetLaceFactoryRuntime()
const inputOrder = findOrderBySku('FLSZ26051153-106-3CM')
startLaceProduction(inputOrder.workOrderId)
createLaceCompletionReport({ workOrderId: inputOrder.workOrderId, qty: 269.99, clientActionId: 'CHECK-149-POINT-99' })
expectDomainError('OVERPRODUCTION_CONFIRM_REQUIRED', () => createLaceCompletionReport({
  workOrderId: inputOrder.workOrderId,
  qty: 0.01,
  clientActionId: 'CHECK-150-BOUNDARY',
}))
createLaceCompletionReport({
  workOrderId: inputOrder.workOrderId,
  qty: 0.01,
  clientActionId: 'CHECK-150-BOUNDARY',
  overproductionConfirmed: true,
})
assert.equal(getLaceProductionOrderView(inputOrder.workOrderId, LACE_FACTORY_OPERATOR)?.status, '加工中')

const logs = listLaceOperationLogs()
assert.ok(logs.length > 10)
logs.forEach((log) => {
  assert.ok(log.objectId)
  assert.ok(log.action)
  assert.ok(log.actorName)
  assert.ok(log.actorOrgId)
  assert.ok(log.occurredAt)
  assert.ok(log.source)
  assert.equal(log.timeZone, 'Asia/Jakarta')
  assert.ok(log.relatedObjectType)
  assert.ok(log.relatedObjectId)
  assert.ok(Number.isInteger(log.relatedPurchaseVersion), `${log.action} must keep a structured related purchase version`)
  assert.ok(['不适用', '已确认'].includes(log.secondConfirmation))
})
assert.ok(logs.some((log) => log.reason.includes('1.5 倍超量二次确认') && log.secondConfirmation === '已确认'))
captureOperationEvidence()
for (const action of [
  '识别内部花边采购需求',
  '自动生成生产单',
  '自动生成生产单失败',
  '变更采购单',
  '同步采购变更',
  '查看采购变更',
  '修改加工投入',
  '确认接收',
  '加工填报',
  '修改加工填报',
  '完成加工单',
  '撤销完成',
  '取消生产单',
  '恢复误取消生产单',
  '发起交出',
  '确认实际收货',
  '回写采购 SKU 实收',
  '采购取消被生产门禁阻断',
  '取消采购单',
  '采购取消同步取消生产单',
]) assert.ok(observedLogActions.has(action), `missing operation log action ${action}`)
assert.ok(observedSecondConfirmations.has('加工填报'))
assert.ok(observedSecondConfirmations.has('确认实际收货'))
assert.ok(observedSecondConfirmations.has('撤销完成'))

resetLaceFactoryRuntime()
const actionPending = findOrderBySku('FLSZ26051153-104-11CM')
const operatorPendingActions = listExecutableLaceWorkOrderActions(actionPending, LACE_FACTORY_OPERATOR).map((action) => action.key)
assert.ok(operatorPendingActions.includes('start-production'))
assert.ok(!operatorPendingActions.some((action) => String(action).includes('input')), 'input editing is located inside the detail input section, not the list action column')
assert.ok(!operatorPendingActions.includes('cancel-order'))
assert.ok(!operatorPendingActions.includes('undo-completion'))
assert.ok(!operatorPendingActions.includes('restore-order'))
const supervisorPendingActions = listExecutableLaceWorkOrderActions(actionPending, LACE_FACTORY_SUPERVISOR).map((action) => action.key)
assert.ok(supervisorPendingActions.includes('cancel-order'))
const actionProduction = findOrderBySku('IDFL251050-BLACK-19-4003PT')
const operatorProductionActions = listExecutableLaceWorkOrderActions(actionProduction, LACE_FACTORY_OPERATOR).map((action) => action.key)
for (const action of ['report-completion', 'complete-production', 'handover']) assert.ok(operatorProductionActions.includes(action as typeof operatorProductionActions[number]))
assert.ok(!operatorProductionActions.includes('cancel-order'), 'a row with downstream handover facts does not offer a non-executable cancel action')

const pageHtml = [
  renderLacePurchaseDemandsPage(),
  renderLaceWorkOrdersPage(),
  renderLaceWorkOrderDetailPage(findOrderBySku('IDFL251050-BLACK-19-4003PT').workOrderId),
  renderLaceHandoverRecordsPage(),
  renderWlsAccessoryReceiptsPage(),
  renderPmsPurchaseOrdersPage(),
].join('\n')
for (const requiredText of ['加工投入', '需求来源', '加工产出', '采购变更待查看', '花边生产单', '中央辅料仓收货']) {
  assert.match(pageHtml, new RegExp(requiredText))
}
assert.match(pageHtml, /data-lace-common-action="open-image"/)
assert.match(pageHtml, /图片加载失败，点击重试/)
assert.match(pageHtml, /图片加载中/)
assert.match(pageHtml, /当前操作身份/)
assert.match(pageHtml, /当前查看身份/)
assert.match(pageHtml, /当前收货身份/)
assert.match(pageHtml, /单位用量/)
assert.match(pageHtml, /修改加工投入/)
assert.doesNotMatch(pageHtml, /实际投入|投入来源／批次|无可记录投入/)
assert.match(pageHtml, /全部关联款式/)
assert.match(pageHtml, /入库库区/)
assert.match(pageHtml, /关联生产状态/)
assert.match(pageHtml, /交出履约/)
assert.match(pageHtml, /采购版本／变更影响/)
assert.match(pageHtml, /目标仓库/)
assert.doesNotMatch(pageHtml, /采购价格|加工费|结算状态|对账|付款|财务状态/)

const purchaseDemandHtml = renderLacePurchaseDemandsPage()
assert.match(purchaseDemandHtml, /自动生成异常/)
assert.match(purchaseDemandHtml, /PMS 采购人员补齐来源后/)
assert.doesNotMatch(purchaseDemandHtml, /data-lace-generation-failures/)
const purchaseDemandSourceText = readFileSync(new URL('../src/pages/process-factory/accessory/lace/purchase-demands.ts', import.meta.url), 'utf8')
const purchaseStatsSource = purchaseDemandSourceText.slice(purchaseDemandSourceText.indexOf('statsHtml:'), purchaseDemandSourceText.indexOf('listTitle:'))
assert.doesNotMatch(purchaseStatsSource, /自动生成异常/, 'generation failures must not occupy a standalone summary card')

const workOrderListHtml = renderLaceWorkOrdersPage()
assert.equal((workOrderListHtml.match(/data-lace-work-orders-action="task-tab:/g) ?? []).length, 6, 'work-order list renders exactly six task tabs')
for (const label of ['全部', '采购变更待查看', '待接收', '加工中', '已完结', '已取消']) assert.match(workOrderListHtml, new RegExp(label))
assert.match(workOrderListHtml, /个采购单／\d+ 张生产单/)
assert.match(workOrderListHtml, /查看详情/)
assert.match(workOrderListHtml, /确认接收/)
assert.doesNotMatch(workOrderListHtml, /维护投入|修改加工投入/)
assert.doesNotMatch(workOrderListHtml, /查看\s*\/\s*操作/)

const imageHelperSource = readFileSync(new URL('../src/pages/process-factory/accessory/lace/shared.ts', import.meta.url), 'utf8')
assert.match(imageHelperSource, /data-lace-common-action="retry-image"/)
assert.match(imageHelperSource, /Escape/)
const recoverableInteractionSource = [
  readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-order-detail.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/pages/wls-accessory-receipts.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/pages/pms-purchase-orders.ts', import.meta.url), 'utf8'),
].join('\n')
assert.match(recoverableInteractionSource, /未看到成功提示即表示本次未保存/)
assert.match(recoverableInteractionSource, /请修正后重新提交/)
assert.match(recoverableInteractionSource, /currentLaceDetailActor/)
assert.match(recoverableInteractionSource, /currentReceiptActor/)
assert.doesNotMatch(recoverableInteractionSource, /actor:\s*LACE_FACTORY_SUPERVISOR/)
assert.doesNotMatch(recoverableInteractionSource, /actor:\s*WLS_ACCESSORY_SUPERVISOR/)

const purchaseDemandSource = purchaseDemandSourceText
assert.match(purchaseDemandSource, /currentDemandActor/)
assert.match(purchaseDemandSource, /data-lace-demand-field="actorRole"/)
assert.match(purchaseDemandSource, /markPurchaseChangeViewed\(purchaseOrderId, actor\)/)
assert.doesNotMatch(purchaseDemandSource, /markPurchaseChangeViewed\(purchaseOrderId, LACE_FACTORY_OPERATOR\)/)

for (const pagePath of [
  '../src/pages/process-factory/accessory/lace/purchase-demands.ts',
  '../src/pages/process-factory/accessory/lace/work-orders.ts',
  '../src/pages/process-factory/accessory/lace/handover-records.ts',
  '../src/pages/wls-accessory-receipts.ts',
  '../src/pages/pms-purchase-orders.ts',
]) {
  const source = readFileSync(new URL(pagePath, import.meta.url), 'utf8')
  for (const action of ['apply-filters', 'reset-filters']) {
    const actionStart = source.indexOf(`if (action === '${action}')`)
    assert.notEqual(actionStart, -1, `${pagePath} must implement ${action}`)
    const controllerRefreshAt = source.indexOf('controller.refresh()', actionStart)
    assert.notEqual(controllerRefreshAt, -1, `${pagePath} handles ${action} through the local list controller`)
    const localActionFlow = source.slice(actionStart, controllerRefreshAt + 'controller.refresh()'.length)
    assert.doesNotMatch(localActionFlow, /refreshAll\(\)/, `${pagePath} must not redraw the whole page for ${action}`)
  }
}

const detailHtml = renderLaceWorkOrderDetailPage(findOrderBySku('IDFL251050-BLACK-19-4003PT').workOrderId)
assert.ok(
  detailHtml.indexOf('data-lace-detail-section="purchase-change-banner"') < detailHtml.indexOf('data-lace-detail-section="processing-input"'),
  'purchase-change banner is the first business section on the work-order detail',
)
assert.equal((detailHtml.match(/data-lace-detail-action="content-tab:/g) ?? []).length, 3, 'work-order detail renders exactly three content tabs')
for (const label of ['生产信息', '完工与交出', '操作日志']) assert.match(detailHtml, new RegExp(label))
assert.ok(detailHtml.indexOf('data-lace-detail-summary') < detailHtml.indexOf('data-lace-detail-tab-shell'))
for (const label of ['生产：', '交出：', '收货：', '计划数量', '累计完工', '累计交出', '累计实收', '剩余可交出']) assert.match(detailHtml, new RegExp(label))
assert.match(detailHtml, /data-lace-detail-section="processing-input"/)
assert.match(detailHtml, /修改加工投入/)
assert.match(detailHtml, /单位用量/)
assert.doesNotMatch(detailHtml, /加工填报记录/, 'inactive fulfillment content is not flattened below the production tab')
assert.doesNotMatch(detailHtml, /data-lace-detail-section="operation-logs"/, 'inactive logs are not flattened below the production tab')
const detailSource = readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-order-detail.ts', import.meta.url), 'utf8')
const tabActionStart = detailSource.indexOf("if (action.startsWith('content-tab:'))")
const tabActionEnd = detailSource.indexOf('const order = currentOrder()', tabActionStart)
assert.notEqual(tabActionStart, -1)
assert.match(detailSource.slice(tabActionStart, tabActionEnd), /refreshDetailTabSurfaces\(\)/)
assert.doesNotMatch(detailSource.slice(tabActionStart, tabActionEnd), /refreshAll\(\)/, 'tab switching must update only tab surfaces')
assert.match(detailSource, /ensureLaceDetailEscapeBinding\(\)/)
assert.match(detailSource, /event\.stopImmediatePropagation\(\)/, 'detail action dialogs close locally on Escape before the global full-page renderer')
for (const label of ['提交前累计完工', '本次完工数量', '提交后累计完工', '超出计划数量', '相对计划比例']) {
  assert.match(recoverableInteractionSource, new RegExp(label))
}
for (const label of ['计划数量', '累计完工', '累计交出', '剩余可交出', '完工差异']) {
  assert.match(recoverableInteractionSource, new RegExp(label))
}

for (const imagePath of [
  '../public/materials/fabric-contrast.jpg',
  '../public/materials/yarn-stitching.jpg',
  '../public/lace-dress-sample.jpg',
  '../public/materials/accessory-zipper.jpg',
  '../public/denim-shorts-sample.jpg',
]) assert.ok(existsSync(new URL(imagePath, import.meta.url)), `missing real business image ${imagePath}`)

const pfosTitles = menusBySystem.pfos.map((group) => group.title)
assert.deepEqual(
  pfosTitles.slice(pfosTitles.indexOf('毛织厂管理'), pfosTitles.indexOf('后道工厂管理') + 1),
  ['毛织厂管理', '辅料工厂管理', '后道工厂管理'],
)
const accessoryGroup = menusBySystem.pfos.find((group) => group.title === '辅料工厂管理')
assert.ok(accessoryGroup)
assert.equal(accessoryGroup.items[0].title, '花边厂管理')
assert.deepEqual(accessoryGroup.items[0].children?.map((item) => item.title), ['采购需求', '花边生产单', '交出记录'])
assert.ok(!JSON.stringify(accessoryGroup).includes('Renda Jaya'))
assert.ok(!JSON.stringify(accessoryGroup).includes('拉链厂管理'))
assert.ok(menusBySystem.wls.some((group) => group.items.some((item) => item.href === '/wls/accessory-receipts')))

const routesText = `${readFileSync(new URL('../src/router/routes-fcs.ts', import.meta.url), 'utf8')}\n${readFileSync(new URL('../src/router/routes.ts', import.meta.url), 'utf8')}`
for (const route of [
  '/fcs/craft/accessory/lace/purchase-demands',
  '/fcs/craft/accessory/lace/work-orders',
  '/fcs/craft/accessory/lace/handover-records',
  '/wls/accessory-receipts',
  '/pms/purchase-order',
]) assert.ok(routesText.includes(route), `missing route ${route}`)
assert.doesNotMatch(routesText, /accessory\/lace\/pda|accessory\/lace\/print/)

for (const pagePath of [
  '../src/pages/process-factory/accessory/lace/purchase-demands.ts',
  '../src/pages/process-factory/accessory/lace/work-orders.ts',
  '../src/pages/process-factory/accessory/lace/handover-records.ts',
  '../src/pages/wls-accessory-receipts.ts',
  '../src/pages/pms-purchase-orders.ts',
]) {
  const source = readFileSync(new URL(pagePath, import.meta.url), 'utf8')
  assert.match(source, /@page-pattern:\s*list/)
  assert.match(source, /renderStandardListPage/)
  assert.match(source, /createProcessOrderListController/)
}
assert.match(
  readFileSync(new URL('../src/pages/process-factory/accessory/lace/work-order-detail.ts', import.meta.url), 'utf8'),
  /@page-pattern:\s*detail/,
)

console.log('辅料工厂管理 V1.5 专项检查通过：默认加工投入、SKU／单位用量例外修改、三类独立事实、辅助工艺状态动作、采购投影、幂等生成、交出、WLS 实收、PMS 门禁、图片、日志与范围边界均已覆盖。')
