import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  assertGarmentSalesOutboundAllowed,
  appendGarmentIdentityMigrationAudits,
  completeGarmentWarehouseRelabelTask,
  completePostFactoryRelabel,
  createGarmentSpuReplacement,
  listGarmentPrintRows,
  listGarmentSpuReplacements,
  listGarmentWarehouseMovements,
  listGarmentWarehouseRelabelTasks,
  resetGarmentSpuReplacementStore,
} from '../src/data/fcs/garment-spu-replacement.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  claimPostFinishingQcTask,
  completePostFinishingQcTask,
  confirmPostFinishingFactoryReturn,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  sendPostFinishingFactoryReturnToQc,
  setPostFinishingDemoBootstrapEnabled,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import { listPostFinishingIdentityMigrationCandidates } from '../src/data/fcs/post-finishing-current-read-model.ts'
import { createReturnInboundBatchRecord } from '../src/data/fcs/return-inbound-workflow.ts'
import type { ReturnInboundBatch } from '../src/data/fcs/store-domain-quality-types.ts'
import { createEffectiveTaskAssignment, listEffectiveTaskAssignments } from '../src/data/fcs/effective-task-assignments.ts'
import { DEFAULT_FACTORY_ONBOARDING_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { resolveReturnReceiptAssignment } from '../src/data/fcs/production-return-fulfillment.ts'
import { buildPrintDocument, renderPrintDocument, validatePrintTemplateRegistry } from '../src/data/fcs/print-template-registry.ts'

const PRODUCTION_ORDER_ID = 'PO-202603-0001'
const PRODUCTION_ORDER_NO = 'PO-202603-0001'
const SOURCE_SPU = 'SPU-2024-004'
const TARGET_SPU = 'SPU-2024-015'

resetGarmentSpuReplacementStore()
resetPostFinishingFullFlow()
setPostFinishingDemoBootstrapEnabled(false)

// 当前后道域只从 full-flow QC 形成瑕疵身份候选，不再依赖旧后道写域。
const postOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
assert.ok(postOrder?.skus.length, '当前后道验收生产单必须存在')
const delivery = registerPostFinishingFactoryReturn({
  productionOrderNo: postOrder.productionOrderNo,
  executionTaskId: postOrder.executionTaskId,
  returnIndex: 1,
  triggerSource: '车缝正常交出',
  idempotencyKey: 'GARMENT-REPLACEMENT-CURRENT-POST-QC',
  quantities: postOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 5 })),
  deliveryPersonName: '验收送货员',
  deliveryPersonPhone: '081200000000',
  evidenceImageUrls: [postOrder.skus[0].imageUrl],
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
  nowMs: Date.UTC(2026, 7, 27, 1, 0, 0),
})
const confirmed = confirmPostFinishingFactoryReturn({
  deliveryId: delivery.deliveryId,
  firstCounts: delivery.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
  nowMs: Date.UTC(2026, 7, 27, 1, 10, 0),
})
const qc = sendPostFinishingFactoryReturnToQc({
  deliveryId: confirmed.deliveryId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
  nowMs: Date.UTC(2026, 7, 27, 1, 20, 0),
})
const claimedQc = claimPostFinishingQcTask({
  qcTaskNo: qc.qcTaskNo,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
  nowMs: Date.UTC(2026, 7, 27, 1, 30, 0),
})
completePostFinishingQcTask({
  qcTaskId: claimedQc.qcTaskId,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
  results: claimedQc.lines.map((line, index) => ({
    skuId: line.sku.skuId,
    passedQty: index === 0 ? line.expectedQty - 1 : line.expectedQty,
    defectQty: index === 0 ? 1 : 0,
    returnQty: 0,
    defectReasonQuantities: index === 0 ? [{ reason: '做工原因', quantity: 1 }] : [],
  })),
  processItems: ['烫包'],
  nowMs: Date.UTC(2026, 7, 27, 1, 40, 0),
})
const currentCandidates = listPostFinishingIdentityMigrationCandidates(postOrder.productionOrderId, postOrder.skus[0].colorName)
assert.equal(currentCandidates.length, 1, '当前 full-flow QC 瑕疵必须形成且只形成一条身份迁移候选')
assert.equal(currentCandidates[0].objectType, 'QC_SKU_RESULT')
assert.equal(currentCandidates[0].originalSkuCode, postOrder.skus[0].skuCode)

// 成衣整色替换保持生产单原需求不变；换码动作与打印继续使用既有承载体。
const originalOrder = productionOrders.find((item) => item.productionOrderId === PRODUCTION_ORDER_ID)
assert.ok(originalOrder, '验收生产单必须存在')
const originalDemandSnapshot = structuredClone(originalOrder.demandSnapshot)
const replacement = createGarmentSpuReplacement({
  productionOrderId: PRODUCTION_ORDER_ID,
  sourceColor: 'White',
  targetSpuCode: TARGET_SPU,
  targetColor: 'White',
  reason: '验收：整色质量问题，成衣仓未售、后道在手及剩余待回货量全部替换',
  operatorName: '后道验收员',
  occurredAt: '2026-08-27 12:00:00',
})
const firstReplacementLine = replacement.lines.find((line) => line.replacementRequired)
assert.ok(firstReplacementLine, '替换单必须包含需要换码的尺码明细')
const migrations = appendGarmentIdentityMigrationAudits({
  replacementId: replacement.replacementId,
  candidates: [{
    objectType: 'QC_SKU_RESULT',
    objectId: 'CURRENT-QC-IDENTITY-1',
    size: firstReplacementLine.size,
    originalSpuCode: firstReplacementLine.source.spuCode,
    originalSkuCode: firstReplacementLine.source.skuCode,
  }],
  occurredAt: '2026-08-27 12:00:01',
})
assert.equal(migrations.length, 1)
assert.equal(migrations[0].currentSpuCode, TARGET_SPU)
completePostFactoryRelabel({ replacementId: replacement.replacementId, operatorName: '后道验收员', occurredAt: '2026-08-27 12:30:00' })

const returnBatches: ReturnInboundBatch[] = []
const returnBatch = createReturnInboundBatchRecord({
  batches: returnBatches,
  batchId: 'RET-GARMENT-SPU-001',
  productionOrderId: PRODUCTION_ORDER_ID,
  processType: 'SEW',
  returnedQty: 120,
  skuLines: [{ skuCode: 'SKU-004-M-WHT', color: 'White', size: 'M', qty: 120, originalSpuCode: SOURCE_SPU }],
  inboundBy: '回货验收员',
  qcPolicy: 'REQUIRED',
  now: '2026-08-27 13:00:00',
})
assert.equal(returnBatch.skuLines?.[0].effectiveSpuCode, TARGET_SPU)
assert.equal(returnBatch.skuLines?.[0].originalSpuCode, SOURCE_SPU)

const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-GARMENT-SPU-ACCEPTANCE', runtimeTaskId: 'TASK-GARMENT-SPU-ACCEPTANCE',
  productionOrderId: PRODUCTION_ORDER_ID, productionOrderNo: PRODUCTION_ORDER_NO, taskNo: 'SEW-GARMENT-SPU-ACCEPTANCE',
  factoryId: 'ID-F001', factoryName: 'PT Sinar Garment Indonesia', source: 'DIRECT_DISPATCH', assignedQty: 1000,
  skuLines: [{ skuCode: 'SKU-004-M-WHT', color: 'White', size: 'M', qty: 1000 }], processCodes: ['PROC_SEW'],
  frozenPrice: 12000, priceCurrency: 'IDR', priceUnit: '件', businessAssignedAt: '2026-08-01 09:00:00',
  operatedAt: '2026-08-01 09:00:00', operatedBy: DEFAULT_FACTORY_ONBOARDING_PPIC.ppicName,
  allocationOperatorPpicId: DEFAULT_FACTORY_ONBOARDING_PPIC.ppicId,
  allocationOperatorPpicName: DEFAULT_FACTORY_ONBOARDING_PPIC.ppicName,
})
const assignmentBeforeReturn = structuredClone(assignment)
assert.equal(resolveReturnReceiptAssignment({
  productionOrderId: PRODUCTION_ORDER_ID,
  factoryId: assignment.factoryId,
  skuCodes: ['SKU-015-M-WHT'],
  confirmedDate: '2026-08-27',
}).resolution, 'MATCHED')
assert.deepEqual(listEffectiveTaskAssignments().find((item) => item.assignmentId === assignment.assignmentId), assignmentBeforeReturn)

for (const source of [
  { sourceType: 'PRODUCTION_ORDER' as const, sourceId: PRODUCTION_ORDER_ID },
  { sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK' as const, sourceId: listGarmentWarehouseRelabelTasks()[0].relabelTaskId },
]) {
  for (const documentType of ['GARMENT_SKU_BARCODE', 'GARMENT_HANGTAG'] as const) {
    const document = buildPrintDocument({ documentType, ...source })
    const html = renderPrintDocument(document)
    assert.ok(document.barcodes.every((barcode) => barcode.value.length > 0))
    assert.match(html, /data-real-barcode/)
    assert.doesNotMatch(html, /来源 SKU|当前标签已按整色替换|成衣新条码/)
  }
}
const selectedPrintRow = listGarmentPrintRows(PRODUCTION_ORDER_ID)[0]
assert.ok(selectedPrintRow)
assert.equal(buildPrintDocument({
  documentType: 'GARMENT_SKU_BARCODE', sourceType: 'PRODUCTION_ORDER', sourceId: PRODUCTION_ORDER_ID,
  skuData: [{ skuCode: selectedPrintRow.identity.skuCode, qty: 2 }],
}).labelItems?.length, 2)
assert.deepEqual(validatePrintTemplateRegistry(), [])

const relabelTask = listGarmentWarehouseRelabelTasks()[0]
assert.throws(() => assertGarmentSalesOutboundAllowed({ productionOrderId: PRODUCTION_ORDER_ID, skuCode: relabelTask.lines[0].source.skuCode }), /不得完成销售出库/)
completeGarmentWarehouseRelabelTask({ taskId: relabelTask.relabelTaskId, operatorName: '成衣仓验收员', occurredAt: '2026-08-27 14:00:00' })
assert.equal(listGarmentWarehouseMovements(replacement.replacementId).length, relabelTask.lines.length * 2)
assert.doesNotThrow(() => assertGarmentSalesOutboundAllowed({ productionOrderId: PRODUCTION_ORDER_ID, skuCode: relabelTask.lines[0].source.skuCode }))
assert.deepEqual(originalOrder.demandSnapshot, originalDemandSnapshot, 'SPU 替换不得改写生产单原需求快照')
assert.equal(listGarmentSpuReplacements()[0].status, 'COMPLETED')

console.log('成衣 SPU/SKU 替换跨模块契约通过：当前后道 QC 候选、换码追溯、剩余回货双身份、原分配匹配、打印与成衣仓出库阻断。')
