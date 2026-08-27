import assert from 'node:assert/strict'
import {
  assertGarmentSalesOutboundAllowed,
  appendGarmentIdentityMigrationAudits,
  buildGarmentReplacementPreview,
  completeGarmentWarehouseRelabelTask,
  completePostFactoryRelabel,
  createGarmentSpuReplacement,
  getProductionOrderGarmentComposition,
  isPostFactoryRelabelPending,
  listGarmentPrintRows,
  listGarmentSpuReplacements,
  listGarmentWarehouseInventoryBatches,
  listGarmentWarehouseMovements,
  listGarmentWarehouseRelabelTasks,
  resetGarmentSpuReplacementStore,
  resolveEffectiveGarmentIdentity,
  resolveOriginalSkuForReturnedSku,
} from '../src/data/fcs/garment-spu-replacement.ts'
import { calculateProductionOrderSettlementSummary } from '../src/data/fcs/factory-settlement-reconciliation.ts'

resetGarmentSpuReplacementStore()

const preview = buildGarmentReplacementPreview({
  productionOrderId: 'PO-202603-0001',
  sourceColor: 'White',
  targetSpuCode: 'SPU-2024-015',
  targetColor: 'White',
})

assert.deepEqual(preview.totals, {
  soldHistoryQty: 1250,
  finishedWarehouseQty: 1150,
  postFactoryQty: 700,
  remainingReturnQty: 1900,
  originalDemandQty: 5000,
  replacementQty: 3750,
})
assert.equal(preview.lines.length, 4)
preview.lines.forEach((line) => {
  assert.equal(
    line.soldHistoryQty + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty,
    line.originalDemandQty,
    `${line.size} 码数量必须守恒`,
  )
  assert.equal(line.target?.size, line.size)
  assert.equal(line.target?.spuCode, 'SPU-2024-015')
  assert.ok(line.target?.skuCode)
})

const record = createGarmentSpuReplacement({
  productionOrderId: 'PO-202603-0001',
  sourceColor: 'White',
  targetSpuCode: 'SPU-2024-015',
  targetColor: 'White',
  reason: '整色质量问题，全部未售及后续回货更换商品身份',
  operatorName: '验收员',
  occurredAt: '2026-08-27 10:00:00',
})
assert.equal(record.evidence.length, 0, '截图可不上传')
assert.equal(record.status, 'RELABELING')
assert.equal(listGarmentSpuReplacements().length, 1)
assert.throws(() => createGarmentSpuReplacement({
  productionOrderId: 'PO-202603-0001',
  sourceColor: 'White',
  targetSpuCode: 'SPU-2024-015',
  targetColor: 'White',
  reason: '重复发起',
  operatorName: '验收员',
}), /不能重复发起/)
assert.throws(() => buildGarmentReplacementPreview({
  productionOrderId: 'PO-202603-0001',
  sourceColor: 'White',
  targetSpuCode: 'SPU-NOT-EXISTS',
  targetColor: 'White',
}), /必须且只能找到一个有效 SKU/)

assert.equal(resolveEffectiveGarmentIdentity({ productionOrderId: 'PO-202603-0001', color: 'White', size: 'M', stage: 'FUTURE_RETURN' })?.skuCode, 'SKU-015-M-WHT')
assert.equal(resolveEffectiveGarmentIdentity({ productionOrderId: 'PO-202603-0001', color: 'White', size: 'M', stage: 'DEFECT' })?.skuCode, 'SKU-015-M-WHT')
assert.equal(resolveEffectiveGarmentIdentity({ productionOrderId: 'PO-202603-0001', color: 'White', size: 'M', stage: 'POST_FACTORY' })?.skuCode, 'SKU-004-M-WHT')
assert.equal(resolveOriginalSkuForReturnedSku('PO-202603-0001', 'SKU-015-M-WHT'), 'SKU-004-M-WHT')
assert.equal(isPostFactoryRelabelPending('PO-202603-0001', 'White'), true)

const migrations = appendGarmentIdentityMigrationAudits({
  replacementId: record.replacementId,
  candidates: [
    { objectType: 'QC_ORDER', objectId: 'QC-DEMO-001', size: 'M' },
    { objectType: 'RECHECK_ORDER', objectId: 'RECHECK-DEMO-001', size: 'L' },
  ],
  occurredAt: '2026-08-27 10:01:00',
})
assert.equal(migrations.length, 2)
assert.equal(migrations[0].originalSkuCode, 'SKU-004-M-WHT')
assert.equal(migrations[0].currentSkuCode, 'SKU-015-M-WHT')

const relabelTask = listGarmentWarehouseRelabelTasks()[0]
assert.equal(relabelTask.lines.reduce((sum, line) => sum + line.qty, 0), 1150)
assert.ok(relabelTask.lines.every((line) => line.status === 'PENDING'))
assert.ok(listGarmentWarehouseInventoryBatches().every((batch) => batch.currentIdentity.spuCode === 'SPU-2024-004'))
assert.throws(() => assertGarmentSalesOutboundAllowed({
  productionOrderId: record.productionOrderId,
  skuCode: relabelTask.lines[0].source.skuCode,
}), /不得完成销售出库/)
completeGarmentWarehouseRelabelTask({ taskId: relabelTask.relabelTaskId, operatorName: '成衣仓验收员', occurredAt: '2026-08-27 11:00:00' })
assert.doesNotThrow(() => assertGarmentSalesOutboundAllowed({
  productionOrderId: record.productionOrderId,
  skuCode: relabelTask.lines[0].source.skuCode,
}))
assert.equal(listGarmentWarehouseMovements(record.replacementId).length, 8, '四个尺码分别形成旧出库和新入库')
assert.ok(listGarmentWarehouseInventoryBatches().every((batch) => batch.relabeled && batch.currentIdentity.spuCode === 'SPU-2024-015'))
assert.equal(listGarmentSpuReplacements()[0].status, 'RELABELING', '后道工厂在手成衣尚未换码时总记录不能完成')

completePostFactoryRelabel({ replacementId: record.replacementId, operatorName: '后道验收员', occurredAt: '2026-08-27 11:30:00' })
assert.equal(isPostFactoryRelabelPending('PO-202603-0001', 'White'), false)
assert.equal(resolveEffectiveGarmentIdentity({ productionOrderId: 'PO-202603-0001', color: 'White', size: 'M', stage: 'POST_FACTORY' })?.skuCode, 'SKU-015-M-WHT')
assert.equal(listGarmentSpuReplacements()[0].status, 'COMPLETED')

const printRows = listGarmentPrintRows('PO-202603-0001')
assert.equal(printRows.length, 4)
assert.ok(printRows.every((line) => line.identity.spuCode === 'SPU-2024-015'))
assert.ok(printRows.every((line) => line.identity.shipmentBarcode.startsWith('HG')))
assert.ok(printRows.every((line) => line.identity.retailBarcode.length > 0))

const composition = getProductionOrderGarmentComposition('PO-202603-0001')
assert.deepEqual(composition, {
  originalDemandQty: 5000,
  originalSpuQty: 1250,
  targetSpuQty: 3750,
  remainingReturnQty: 1900,
  sourceSpuCode: 'SPU-2024-004',
  targetSpuCode: 'SPU-2024-015',
})

const settlementBefore = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 1000,
  handoverLines: [{ recordId: 'H-1', handedOverQty: 800, handedOverAt: '2026-08-27' }, { recordId: 'H-2', handedOverQty: 200, handedOverAt: '2026-08-27' }],
  reworkLines: [],
  defectReasonLines: [],
})
const settlementAfter = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 1000,
  handoverLines: [{ recordId: 'SPUA-800', handedOverQty: 800, handedOverAt: '2026-08-27' }, { recordId: 'SPUB-200', handedOverQty: 200, handedOverAt: '2026-08-27' }],
  reworkLines: [],
  defectReasonLines: [],
})
assert.deepEqual(settlementAfter, settlementBefore, '回货商品编码变化不得改变车缝厂结算数量')

resetGarmentSpuReplacementStore()
const evidenceRecord = createGarmentSpuReplacement({
  productionOrderId: 'PO-202603-0001',
  sourceColor: 'White',
  targetSpuCode: 'SPU-2024-015',
  targetColor: 'White',
  reason: '截图追溯验收',
  evidenceFileName: '现场截图.png',
  evidenceImageUrl: 'data:image/png;base64,VEVTVA==',
  operatorName: '验收员',
})
assert.deepEqual(evidenceRecord.evidence, [{
  evidenceId: `${evidenceRecord.replacementId}-EVIDENCE-1`,
  fileName: '现场截图.png',
  imageUrl: 'data:image/png;base64,VEVTVA==',
  uploadedAt: evidenceRecord.createdAt,
  uploadedBy: '验收员',
}], '截图应保留文件名、预览原图、上传人与时间；不上传仍不阻断')

console.log('成衣 SPU/SKU 整色替换核心契约通过：四类业务数量、整色唯一映射、双身份、仓库双流水、瑕疵迁移、打印当前身份、结算不变。')
