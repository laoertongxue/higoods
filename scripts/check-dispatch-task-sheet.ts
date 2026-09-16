import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createEffectiveTaskAssignment } from '../src/data/fcs/effective-task-assignments.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { buildDispatchTaskSheetData, getDispatchTaskSheetIdentity, parseDispatchTaskSheetCode, resolveDispatchTaskSheet } from '../src/data/fcs/dispatch-task-sheet.ts'
import { getCurrentSewingPickupSlip } from '../src/data/fcs/sewing-pickup-slips.ts'
import { listCuttingRuntimeEvents } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { buildDispatchTaskSheetPrintDocument, renderDispatchTaskSheetTemplate, selectDispatchTaskSheetTechnicalScope } from '../src/pages/print/templates/dispatch-task-sheet-template.ts'
import { buildPrintDocument } from '../src/data/fcs/print-template-registry.ts'
import type { ProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-types.ts'

// TASK/CODE/PRINT: two factories on one production order must never print the
// same assignment scope, and printing/reprinting must not create pickup facts.
const operator = SEWING_OUTSOURCING_DEMO_CURRENT_PPIC
function assign(suffix: string, processCodes = ['SEWING'], factoryId = 'ID-F021') {
  return createEffectiveTaskAssignment({
    assignmentId: `ASG-PRINT-CONTRACT-${suffix}`, runtimeTaskId: `TASK-PRINT-CONTRACT-${suffix}`,
    productionOrderId: 'PO-202603-0004', productionOrderNo: 'PO-202603-0004', taskNo: `CF-${suffix}`,
    factoryId, factoryName: `任务单验收工厂${suffix}`, source: 'DIRECT_DISPATCH', assignedQty: 12,
    skuLines: [{ skuCode: `SCOPE-${suffix}-M`, color: suffix, size: 'M', qty: 12 }], processCodes,
    frozenPrice: 1500, priceCurrency: 'IDR', priceUnit: '件',
    businessAssignedAt: '2026-09-16 09:00:00', operatedAt: '2026-09-16 09:00:00',
    operatedBy: operator.ppicName, allocationOperatorPpicId: operator.ppicId, allocationOperatorPpicName: operator.ppicName,
  })
}
const first = assign('A')
const second = assign('B')
const combined = assign('C', ['SEWING', 'IRON_PACK'])
const triple = assign('D', ['CUTTING', 'SEWING', 'IRON_PACK'])
const beforeEvents = JSON.stringify(listCuttingRuntimeEvents())
const beforePickup = getCurrentSewingPickupSlip(first.assignmentId, 'CUT_PIECE')
const firstData = buildDispatchTaskSheetData(first.assignmentId)
const printInput = { documentType: 'DISPATCH_TASK_SHEET' as const, sourceType: 'EFFECTIVE_TASK_ASSIGNMENT' as const, sourceId: first.assignmentId }
const firstDocument = buildDispatchTaskSheetPrintDocument(printInput)
const repeatedDocument = buildDispatchTaskSheetPrintDocument(printInput)
assert.deepEqual(firstDocument.tables.find((table) => table.tableId === 'task-sku-scope')?.rows.slice(0, -1), [['SCOPE-A-M', 'A', 'M', '12 件']])
assert.equal(firstDocument.barcodePayload, repeatedDocument.barcodePayload)
assert.equal(firstDocument.barcodePayload, firstData.taskSheetNo)
assert.notEqual(firstData.taskSheetNo, getDispatchTaskSheetIdentity(second).taskSheetNo)
assert.equal(parseDispatchTaskSheetCode(firstData.qrValue), firstData.taskSheetNo)
assert.equal(resolveDispatchTaskSheet(firstData.qrValue).assignment.factoryId, first.factoryId)
assert.deepEqual(resolveDispatchTaskSheet(firstData.taskSheetNo).assignment.skuLines, first.skuLines)
for (const wrongCode of ['PO-202603-0004', 'FEI-123', 'BAG-123', JSON.stringify({ sourceType: 'PRODUCTION_ORDER', businessNo: firstData.taskSheetNo })]) {
  assert.throws(() => parseDispatchTaskSheetCode(wrongCode), /任务单/)
}
const html = renderDispatchTaskSheetTemplate(firstDocument)
assert(html.includes('data-real-barcode'))
assert(html.includes('data-real-qr'))
assert(html.includes('裁床待交出仓'))
assert(!html.includes('SCOPE-B-M'), '其他工厂 SKU 不得出现在本任务单')
assert(html.includes('未维护') || html.includes('data-print-image'), '资料缺项不能填假图')
assert.equal(buildDispatchTaskSheetData(combined.assignmentId).taskTypeLabel, '车缝+烫包')
assert.equal(buildDispatchTaskSheetData(triple.assignmentId).pickupObject, '面辅料')
assert.equal(buildDispatchTaskSheetData(triple.assignmentId).supportsCutPieceHandover, false)
assert.equal(buildDispatchTaskSheetData(triple.assignmentId).pickupLocation.includes('自行裁剪'), true)
assert.equal(buildPrintDocument(printInput).templateCode, 'DISPATCH_TASK_SHEET_V1')
assert.deepEqual(getCurrentSewingPickupSlip(first.assignmentId, 'CUT_PIECE'), beforePickup, '打印不能签发或作废旧领料单')
assert.equal(JSON.stringify(listCuttingRuntimeEvents()), beforeEvents, '打印不能新增交出/库存/接收事件')

const scopedData = { ...firstData, techPack: {
  ...firstData.techPack,
  bomItems: [
    { id: 'fabric-a', type: '面料', name: 'A 面料', spec: '', unitConsumption: 0.125, lossRate: 0, supplier: '', materialSkuId: 'FAB-A', materialImageUrl: '/materials/fei-ticket/robe-stripe.svg', applicableSkuCodes: ['SCOPE-A-M'], usageProcessCodes: ['SEWING'] },
    { id: 'fabric-b', type: '面料', name: 'B 面料', spec: '', unitConsumption: 1, lossRate: 0, supplier: '', materialSkuId: 'FAB-B', applicableSkuCodes: ['SCOPE-B-M'], usageProcessCodes: ['SEWING'] },
    { id: 'package', type: '包装材料', name: '包装袋', spec: '', unitConsumption: 1, lossRate: 0, supplier: '', applicableSkuCodes: ['SCOPE-A-M'], usageProcessCodes: ['IRON_PACK'] },
  ],
  processEntries: [
    { id: 'sew', entryType: 'PROCESS_BASELINE', stageCode: 'PROD', stageName: '生产', processCode: 'SEW', processName: '车缝', assignmentGranularity: 'SKU', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false },
    { id: 'iron', entryType: 'PROCESS_BASELINE', stageCode: 'POST', stageName: '后道', processCode: 'IRON_PACK', processName: '烫包', assignmentGranularity: 'ORDER', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false },
  ],
  patternFiles: [], colorMaterialMappings: [],
  cutPieceParts: [
    { partCode: 'A', partNameCn: '前片', materialSku: 'FAB-A', pieceCountPerGarment: 2, applicableColorList: ['A'], applicableSizeList: ['M'], manualConfirmRequired: false },
    { partCode: 'B', partNameCn: '另一颜色前片', materialSku: 'FAB-B', pieceCountPerGarment: 2, applicableColorList: ['B'], applicableSizeList: ['M'], manualConfirmRequired: false },
  ],
  sizeMeasurements: [
    { sizeCode: 'M', measurementPart: '胸围', measurementValue: 108, measurementUnit: 'cm' },
    { sizeCode: 'L', measurementPart: '胸围', measurementValue: 112, measurementUnit: 'cm' },
  ],
} as ProductionOrderTechPackSnapshot }
const scope = selectDispatchTaskSheetTechnicalScope(scopedData)
assert.deepEqual(scope.materials.map((item) => item.id), ['fabric-a'], 'SKU 与工序必须同时筛选适用物料')
assert.deepEqual(scope.processes.map((item) => item.id), ['sew'], '独立车缝不能承诺后续烫包')
assert.deepEqual(scope.parts.map((item) => item.partCode), ['A'])
assert.deepEqual(scope.measurements.map((item) => item.sizeCode), ['M'])

const replacement = createEffectiveTaskAssignment({ ...first, assignmentId: 'ASG-PRINT-CONTRACT-A-REASSIGNED', source: 'REASSIGNMENT', factoryName: '改派后的工厂' })
assert.throws(() => resolveDispatchTaskSheet(firstData.taskSheetNo), /失效/)
assert.notEqual(getDispatchTaskSheetIdentity(replacement).taskSheetNo, firstData.taskSheetNo)
const taskPage = readFileSync('src/pages/sewing-outsourcing/tasks.ts', 'utf8')
assert(!taskPage.includes("pickupAction(row, 'CUT_PIECE'"), 'PPIC 裁片入口不得再签发旧领料单')
assert(taskPage.includes("documentType: 'DISPATCH_TASK_SHEET'"))
console.log('[check-dispatch-task-sheet] identity, assignment scope, technical scope, unified template and no-handover side effects passed')
