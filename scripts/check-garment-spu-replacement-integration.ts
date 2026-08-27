import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  assertGarmentSalesOutboundAllowed,
  appendGarmentIdentityMigrationAudits,
  completeGarmentWarehouseRelabelTask,
  completePostFactoryRelabel,
  createGarmentSpuReplacement,
  listGarmentSpuReplacements,
  listGarmentWarehouseMovements,
  listGarmentWarehouseRelabelTasks,
  resetGarmentSpuReplacementStore,
} from '../src/data/fcs/garment-spu-replacement.ts'
import {
  completePostFinishingRecheckOrder,
  getPostFinishingRecheckOrderById,
  listPostFinishingAvailableHandoverLines,
  listPostFinishingIdentityMigrationCandidates,
  listPostFinishingQcOrderEntities,
  listPostFinishingRecheckOrderEntities,
  listPostFinishingWaitHandoverWarehouseRecords,
  type PostFinishingQcSkuResult,
  type PostFinishingRecheckSkuResult,
} from '../src/data/fcs/post-finishing-domain.ts'
import { createReturnInboundBatchRecord } from '../src/data/fcs/return-inbound-workflow.ts'
import type { ReturnInboundBatch } from '../src/data/fcs/store-domain-quality-types.ts'
import { createEffectiveTaskAssignment, listEffectiveTaskAssignments } from '../src/data/fcs/effective-task-assignments.ts'
import { resolveReturnReceiptAssignment } from '../src/data/fcs/production-return-fulfillment.ts'
import {
  buildPrintDocument,
  renderPrintDocument,
  validatePrintTemplateRegistry,
} from '../src/data/fcs/print-template-registry.ts'

const PRODUCTION_ORDER_ID = 'PO-202603-0001'
const PRODUCTION_ORDER_NO = 'PO-202603-0001'
const SOURCE_SPU = 'SPU-2024-004'
const TARGET_SPU = 'SPU-2024-015'

function withoutQcIdentity(result: PostFinishingQcSkuResult) {
  const { skuId: _skuId, skuCode: _skuCode, originalSkuCode: _originalSkuCode, skuImageUrl: _skuImageUrl, ...facts } = result
  return facts
}

function withoutRecheckIdentity(result: PostFinishingRecheckSkuResult) {
  const { skuId: _skuId, skuCode: _skuCode, originalSkuCode: _originalSkuCode, skuImageUrl: _skuImageUrl, ...facts } = result
  return facts
}

resetGarmentSpuReplacementStore()

const originalOrder = productionOrders.find((item) => item.productionOrderId === PRODUCTION_ORDER_ID)
assert.ok(originalOrder, '验收生产单必须存在')
const originalDemandSnapshot = structuredClone(originalOrder.demandSnapshot)

// 先形成一条真实复检瑕疵，验证“替换前已存在”的复检记录也会迁移。
const recheckBeforeCompletion = getPostFinishingRecheckOrderById('PF-RC-001')
assert.ok(recheckBeforeCompletion, '验收复检单必须存在')
const recheckWithExistingDefect = recheckBeforeCompletion.recheckSkuResults.map((result, index) => ({
  ...result,
  recheckQty: index === 0 ? 10 : 0,
  qualifiedQty: index === 0 ? 9 : 0,
  unqualifiedQty: index === 0 ? 1 : 0,
}))
const completedRecheckBeforeReplacement = completePostFinishingRecheckOrder({
  recheckOrderId: recheckBeforeCompletion.recheckOrderId,
  operatorName: '复检验收员',
  recheckSkuResults: recheckWithExistingDefect,
})
assert.equal(completedRecheckBeforeReplacement.recheckSkuResults[0].skuCode, 'SKU-2024-004-WHT-M')
assert.equal(completedRecheckBeforeReplacement.recheckSkuResults[0].unqualifiedQty, 1)
assert.ok(listPostFinishingWaitHandoverWarehouseRecords().some((item) => item.sourceProductionOrderNo === PRODUCTION_ORDER_NO))
assert.ok(listPostFinishingAvailableHandoverLines().some((item) => item.sourceProductionOrderNo === PRODUCTION_ORDER_NO))

const qcBefore = listPostFinishingQcOrderEntities()
  .filter((order) => order.productionOrderId === PRODUCTION_ORDER_ID)
  .flatMap((order) => order.qcSkuResults)
  .filter((result) => result.unqualifiedQty > 0)
  .map((result) => structuredClone(result))
const recheckDefectBefore = listPostFinishingRecheckOrderEntities()
  .filter((order) => order.productionOrderNo === PRODUCTION_ORDER_NO)
  .flatMap((order) => order.recheckSkuResults)
  .find((result) => result.unqualifiedQty > 0)
assert.equal(qcBefore.length, 2, '验收数据应包含 M/L 两条既有 QC 瑕疵')
assert.ok(recheckDefectBefore, '验收数据应包含一条既有复检瑕疵')

const candidatesBefore = listPostFinishingIdentityMigrationCandidates(PRODUCTION_ORDER_ID, 'White')
assert.equal(candidatesBefore.length, 3, '既有 QC 两条＋复检一条都应进入迁移候选')
assert.ok(candidatesBefore.some((item) => item.originalSkuCode === 'SKU-2024-004-WHT-M'))

const replacement = createGarmentSpuReplacement({
  productionOrderId: PRODUCTION_ORDER_ID,
  sourceColor: 'White',
  targetSpuCode: TARGET_SPU,
  targetColor: 'White',
  reason: '验收：整色质量问题，成衣仓未售、后道在手及剩余待回货量全部替换',
  operatorName: '后道验收员',
  occurredAt: '2026-08-27 12:00:00',
})
const migrations = appendGarmentIdentityMigrationAudits({
  replacementId: replacement.replacementId,
  candidates: candidatesBefore,
  occurredAt: '2026-08-27 12:00:01',
})
assert.equal(migrations.length, 3)
assert.ok(migrations.some((item) => item.originalSkuCode === 'SKU-2024-004-WHT-M' && item.currentSkuCode === 'SKU-015-M-WHT'))

// 后道工厂在手成衣未换码前，可交出数量必须被收口；完成后恢复并使用目标身份。
assert.equal(
  listPostFinishingAvailableHandoverLines().filter((item) => item.sourceProductionOrderNo === PRODUCTION_ORDER_NO).length,
  0,
  '后道工厂在手成衣未换码不得继续交成衣仓',
)

const qcAfter = listPostFinishingQcOrderEntities()
  .filter((order) => order.productionOrderId === PRODUCTION_ORDER_ID)
  .flatMap((order) => order.qcSkuResults)
  .filter((result) => result.unqualifiedQty > 0)
for (const before of qcBefore) {
  const after = qcAfter.find((item) => item.qcSkuResultId === before.qcSkuResultId)
  assert.ok(after)
  assert.equal(after.skuCode, before.sizeName === 'M' ? 'SKU-015-M-WHT' : 'SKU-015-L-WHT')
  assert.equal(after.originalSkuCode, before.skuCode)
  assert.deepEqual(withoutQcIdentity(after), withoutQcIdentity(before), 'QC 数量、原因、责任和扣款字段不得被换码改写')
}

const projectedExistingRecheck = listPostFinishingRecheckOrderEntities()
  .filter((order) => order.productionOrderNo === PRODUCTION_ORDER_NO)
  .flatMap((order) => order.recheckSkuResults)
  .find((result) => result.recheckSkuResultId === recheckDefectBefore.recheckSkuResultId)
assert.ok(projectedExistingRecheck)
assert.equal(projectedExistingRecheck.skuCode, 'SKU-015-M-WHT')
assert.equal(projectedExistingRecheck.originalSkuCode, recheckDefectBefore.skuCode)
assert.deepEqual(withoutRecheckIdentity(projectedExistingRecheck), withoutRecheckIdentity(recheckDefectBefore))

completePostFactoryRelabel({
  replacementId: replacement.replacementId,
  operatorName: '后道验收员',
  occurredAt: '2026-08-27 12:30:00',
})
const availableAfterPostRelabel = listPostFinishingAvailableHandoverLines()
  .filter((item) => item.sourceProductionOrderNo === PRODUCTION_ORDER_NO)
assert.ok(availableAfterPostRelabel.length > 0)
assert.ok(availableAfterPostRelabel.every((item) => item.spuCode === TARGET_SPU))

// 替换后新增复检瑕疵，写入和读取都直接使用目标 SKU。
const recheckAfterReplacement = getPostFinishingRecheckOrderById('PF-RC-001')
assert.ok(recheckAfterReplacement)
const newDefectResults = recheckAfterReplacement.recheckSkuResults.map((result) => ({
  ...result,
  recheckQty: result.sizeName === 'L' ? 12 : result.recheckQty,
  qualifiedQty: result.sizeName === 'L' ? 10 : result.qualifiedQty,
  unqualifiedQty: result.sizeName === 'L' ? 2 : result.unqualifiedQty,
}))
const newDefectRecheck = completePostFinishingRecheckOrder({
  recheckOrderId: recheckAfterReplacement.recheckOrderId,
  operatorName: '复检验收员',
  recheckSkuResults: newDefectResults,
})
assert.equal(newDefectRecheck.recheckSkuResults.find((item) => item.sizeName === 'L')?.skuCode, 'SKU-015-L-WHT')

// 剩余待回货批次保留原 SKU，并以目标 SKU 作为当前实物身份。
const returnBatches: ReturnInboundBatch[] = []
const returnBatch = createReturnInboundBatchRecord({
  batches: returnBatches,
  batchId: 'RET-GARMENT-SPU-001',
  productionOrderId: PRODUCTION_ORDER_ID,
  processType: 'SEW',
  returnedQty: 120,
  skuLines: [{
    skuCode: 'SKU-004-M-WHT',
    color: 'White',
    size: 'M',
    qty: 120,
    originalSpuCode: SOURCE_SPU,
  }],
  inboundBy: '回货验收员',
  qcPolicy: 'REQUIRED',
  now: '2026-08-27 13:00:00',
})
assert.deepEqual(returnBatch.skuLines?.[0], {
  skuCode: 'SKU-015-M-WHT',
  color: 'White',
  size: 'M',
  qty: 120,
  originalSkuCode: 'SKU-004-M-WHT',
  originalSpuCode: SOURCE_SPU,
  effectiveSpuCode: TARGET_SPU,
})

// 目标 SKU 仍反查原分配，且分配价格、工厂和数量保持冻结。
const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-GARMENT-SPU-ACCEPTANCE',
  runtimeTaskId: 'TASK-GARMENT-SPU-ACCEPTANCE',
  productionOrderId: PRODUCTION_ORDER_ID,
  productionOrderNo: PRODUCTION_ORDER_NO,
  taskNo: 'SEW-GARMENT-SPU-ACCEPTANCE',
  factoryId: 'FACTORY-SEW-001',
  factoryName: '车缝验收工厂',
  source: 'DIRECT_DISPATCH',
  assignedQty: 1000,
  skuLines: [{ skuCode: 'SKU-004-M-WHT', color: 'White', size: 'M', qty: 1000 }],
  processCodes: ['PROC_SEW'],
  frozenPrice: 12000,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-08-01 09:00:00',
  operatedAt: '2026-08-01 09:00:00',
  operatedBy: '派单员',
})
const assignmentBeforeReturn = structuredClone(assignment)
assert.deepEqual(resolveReturnReceiptAssignment({
  productionOrderId: PRODUCTION_ORDER_ID,
  factoryId: assignment.factoryId,
  skuCodes: ['SKU-015-M-WHT'],
  confirmedDate: '2026-08-27',
}), {
  resolution: 'MATCHED',
  assignmentId: assignment.assignmentId,
  reason: '已按生产单、加工厂、SKU和到货日期匹配当前有效分配',
})
assert.deepEqual(
  listEffectiveTaskAssignments().find((item) => item.assignmentId === assignment.assignmentId),
  assignmentBeforeReturn,
  '回货商品编码变化不得改写原工厂分配与冻结价格',
)

// 生产单与仓库任务的条码、吊牌都读取目标 SKU，并使用真实 Code 128 DOM。
for (const source of [
  { sourceType: 'PRODUCTION_ORDER' as const, sourceId: PRODUCTION_ORDER_ID },
  { sourceType: 'GARMENT_WAREHOUSE_RELABEL_TASK' as const, sourceId: listGarmentWarehouseRelabelTasks()[0].relabelTaskId },
]) {
  for (const documentType of ['GARMENT_SKU_BARCODE', 'GARMENT_HANGTAG'] as const) {
    const document = buildPrintDocument({ documentType, ...source })
    const html = renderPrintDocument(document)
    assert.ok(document.labelItems?.every((item) => item.labelFields.some((field) => field.label === '当前 SKU' && field.value.startsWith('SKU-015-'))))
    assert.ok(document.labelItems?.every((item) => item.labelFields.some((field) => field.label === '日期')))
    assert.ok(document.barcodes.every((barcode) => barcode.value.length > 0))
    assert.match(html, /<svg/)
    assert.match(html, /SKU-015-/)
    assert.match(html, /HG\d+/)
  }
}
assert.deepEqual(validatePrintTemplateRegistry(), [])

// 成衣仓未售成衣的换码任务必须阻断旧 SKU 销售出库，完成后生成每尺码旧出、新入两笔流水。
const relabelTask = listGarmentWarehouseRelabelTasks()[0]
assert.throws(() => assertGarmentSalesOutboundAllowed({
  productionOrderId: PRODUCTION_ORDER_ID,
  skuCode: relabelTask.lines[0].source.skuCode,
}), /不得完成销售出库/)
completeGarmentWarehouseRelabelTask({
  taskId: relabelTask.relabelTaskId,
  operatorName: '成衣仓验收员',
  occurredAt: '2026-08-27 14:00:00',
})
assert.equal(listGarmentWarehouseMovements(replacement.replacementId).length, relabelTask.lines.length * 2)
assert.doesNotThrow(() => assertGarmentSalesOutboundAllowed({
  productionOrderId: PRODUCTION_ORDER_ID,
  skuCode: relabelTask.lines[0].source.skuCode,
}))

assert.deepEqual(originalOrder.demandSnapshot, originalDemandSnapshot, 'SPU 替换不得改写生产单原需求快照')
assert.equal(listGarmentSpuReplacements()[0].status, 'COMPLETED')

console.log('成衣 SPU/SKU 替换跨模块契约通过：后道交出门禁、QC/复检瑕疵迁移、剩余待回货双身份、原分配匹配、生产单/仓库条码与吊牌、成衣仓旧 SKU 销售出库阻断。')
