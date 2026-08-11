import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getCutPieceDispatchReadinessForTask } from '../src/data/fcs/cut-piece-release.ts'
import { getMaterialPrepDispatchReadinessForTask } from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  createProductionReturnRuleSnapshot,
  buildProductionReturnRulePreview,
  resetProductionReturnSnapshotSequenceForTests,
} from '../src/data/fcs/production-return-fulfillment.ts'
import {
  getRuntimeSewingTaskReassignmentScopePreview,
  getRuntimeTaskById,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  captureRuntimeTaskTenderRecordStore,
  getRuntimeTaskTenderRecord,
  recordRuntimeTaskTenderQuote,
  restoreRuntimeTaskTenderRecordStore,
  upsertRuntimeTaskTenderRecord,
} from '../src/data/fcs/runtime-task-tenders.ts'
import {
  classifyTaskFulfillmentPolicy,
  type TaskFulfillmentPolicyInput,
} from '../src/data/fcs/task-fulfillment-policy.ts'
import { resolveTenderBusinessAssignedAt } from '../src/pages/dispatch-tenders.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function policy(input: Partial<TaskFulfillmentPolicyInput>) {
  return classifyTaskFulfillmentPolicy({
    processCode: 'SEWING',
    processBusinessCode: 'SEWING',
    processNameZh: '车缝',
    taskUnitType: 'SINGLE_PROCESS_TASK',
    assignmentGranularity: 'SKU',
    ...input,
  })
}

const sewingTask = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')
assert(sewingTask, 'PO-202603-0002 必须存在可分配的独立车缝任务')
assert.equal(sewingTask.productionOrderId, 'PO-202603-0002')
assert.equal(sewingTask.scopeQty, 2500)
assert.equal(sewingTask.standardPrice, 1200, '独立车缝任务必须从任务生成事实源取得有效标准价')
assert.equal(sewingTask.standardPriceCurrency, 'IDR')
assert.equal(sewingTask.standardPriceUnit, '件')
assert.deepEqual(
  sewingTask.scopeSkuLines.map((line) => [line.skuCode, line.color, line.size, line.qty]),
  [
    ['SKU-005-S-GRY', 'Grey', 'S', 500],
    ['SKU-005-M-GRY', 'Grey', 'M', 700],
    ['SKU-005-L-GRY', 'Grey', 'L', 800],
    ['SKU-005-XL-GRY', 'Grey', 'XL', 500],
  ],
)

const cutReadiness = getCutPieceDispatchReadinessForTask({
  productionOrderId: sewingTask.productionOrderId,
  productionOrderNo: sewingTask.productionOrderNo,
  skuLines: sewingTask.scopeSkuLines,
})
assert.equal(cutReadiness.hasRecord, true)
assert.equal(cutReadiness.recordNo, 'CPR-202603-0002')
assert.equal(cutReadiness.latestUpdatedAt, '2026-08-10 09:15:00')
assert.deepEqual(
  cutReadiness.lines.map((line) => [
    line.skuCode,
    line.taskQty,
    line.targetQty,
    line.completeKitQty,
    line.releaseConfirmQty,
    line.riskReleaseQty,
    line.status,
  ]),
  [
    ['SKU-005-S-GRY', 500, 500, 490, 490, 0, '部分放行'],
    ['SKU-005-M-GRY', 700, 700, 660, 680, 20, '风险放行'],
    ['SKU-005-L-GRY', 800, 800, 720, 720, 0, '部分放行'],
    ['SKU-005-XL-GRY', 500, 500, 430, 430, 0, '部分放行'],
  ],
)

const selectedCutReadiness = getCutPieceDispatchReadinessForTask({
  productionOrderId: sewingTask.productionOrderId,
  productionOrderNo: sewingTask.productionOrderNo,
  skuLines: sewingTask.scopeSkuLines.filter((line) => line.size === 'S'),
})
assert.deepEqual(selectedCutReadiness.lines.map((line) => line.skuCode), ['SKU-005-S-GRY'])

const missingCutReadiness = getCutPieceDispatchReadinessForTask({
  productionOrderId: 'PO-NOT-SYNCED',
  productionOrderNo: 'PO-NOT-SYNCED',
  skuLines: [{ skuCode: 'SKU-NOT-SYNCED', color: 'Black', size: 'M', qty: 100 }],
})
assert.equal(missingCutReadiness.hasRecord, false)
assert.equal(missingCutReadiness.lines[0].status, '待同步')

const materialReadiness = getMaterialPrepDispatchReadinessForTask(sewingTask)
assert.equal(materialReadiness.hasMaterialPrepScope, true)
assert.equal(materialReadiness.ready, true)
assert.equal(materialReadiness.blockingLineCount, 0)
assert.deepEqual(materialReadiness.lines.map((line) => line.materialName), ['前中拉链', '主唛', '洗水唛', '缝纫线'])
assert.deepEqual(
  materialReadiness.lines.map((line) => [
    line.requiredQty,
    line.confirmedPrepQty,
    line.remainingPrepQty,
    line.availableStockQty,
    line.unit,
    line.linePrepStatus,
  ]),
  [
    [2500, 2500, 0, 3100, '条', '已配齐'],
    [2500, 2500, 0, 2800, '套', '已配齐'],
    [2500, 2500, 0, 2600, '套', '已配齐'],
    [30, 30, 0, 42, '公斤', '已配齐'],
  ],
)
for (const line of materialReadiness.lines) {
  assert(line.materialImageUrl.startsWith('/materials/'))
  assert(fs.existsSync(path.join(repoRoot, 'public', line.materialImageUrl)), `${line.materialName} 缺少真实物料图`)
}

const sewingPolicy = policy({})
const sewingIronPackPolicy = policy({
  taskUnitType: 'MERGED_PRODUCTION_TASK',
  mergedTaskType: 'SEWING_IRON_PACK',
})
const cuttingSewingIronPackPolicy = policy({
  taskUnitType: 'MERGED_PRODUCTION_TASK',
  mergedTaskType: 'CUTTING_SEWING_IRON_PACK',
})
const cuttingPolicy = policy({
  processCode: 'CUT_PANEL',
  processBusinessCode: 'CUT_PANEL',
  processNameZh: '裁片',
  assignmentGranularity: 'ORDER',
})
assert.deepEqual(sewingPolicy.milestones.map((item) => item.naturalDay), [4, 8, 9])
assert.deepEqual(sewingIronPackPolicy.milestones.map((item) => item.naturalDay), [5, 9, 10])
assert.deepEqual(cuttingSewingIronPackPolicy.milestones.map((item) => item.naturalDay), [6, 9, 12])
assert.equal(sewingPolicy.requiresSewingReadinessContext, true)
assert.equal(sewingIronPackPolicy.requiresSewingReadinessContext, true)
assert.equal(cuttingSewingIronPackPolicy.requiresSewingReadinessContext, false)
assert.equal(buildProductionReturnRulePreview({ assignedQty: 2500, businessAssignedAt: '2026-08-10 09:22:00', policy: cuttingPolicy }), null)

const independentPreview = buildProductionReturnRulePreview({
  assignedQty: 2500,
  businessAssignedAt: '2026-08-10 09:22:00',
  policy: sewingPolicy,
})
assert(independentPreview)
assert.equal(independentPreview.assignmentDate, '2026-08-10')
assert.deepEqual(independentPreview.milestones.map((item) => [item.naturalDay, item.deadlineDate, item.targetQty]), [
  [4, '2026-08-13', 750],
  [8, '2026-08-17', 1750],
  [9, '2026-08-18', 2500],
])
const selectedSkuPreview = buildProductionReturnRulePreview({
  assignedQty: 500,
  businessAssignedAt: '2026-08-11 23:59:59',
  policy: sewingPolicy,
})
assert(selectedSkuPreview)
assert.deepEqual(selectedSkuPreview.milestones.map((item) => [item.deadlineDate, item.targetQty]), [
  ['2026-08-14', 150],
  ['2026-08-18', 350],
  ['2026-08-19', 500],
])
const roundingPreview = buildProductionReturnRulePreview({
  assignedQty: 101,
  businessAssignedAt: '2026-08-10 00:00:00',
  policy: sewingPolicy,
})
assert.deepEqual(roundingPreview?.milestones.map((item) => item.targetQty), [31, 71, 101])

assert.deepEqual(
  buildProductionReturnRulePreview({ assignedQty: 2500, businessAssignedAt: '2026-08-10 09:22:00', policy: sewingIronPackPolicy })?.milestones.map((item) => [item.naturalDay, item.deadlineDate]),
  [[5, '2026-08-14'], [9, '2026-08-18'], [10, '2026-08-19']],
)
assert.deepEqual(
  buildProductionReturnRulePreview({ assignedQty: 2500, businessAssignedAt: '2026-08-10 09:22:00', policy: cuttingSewingIronPackPolicy })?.milestones.map((item) => [item.naturalDay, item.deadlineDate]),
  [[6, '2026-08-15'], [9, '2026-08-18'], [12, '2026-08-21']],
)

resetProductionReturnSnapshotSequenceForTests()
const snapshot = createProductionReturnRuleSnapshot({
  assignmentId: 'ASG-CHECK-PREVIEW-001',
  runtimeTaskId: 'TASK-CHECK-PREVIEW-001',
  productionOrderId: 'PO-CHECK-PREVIEW-001',
  factoryId: 'FAC-CHECK-001',
  factoryName: '验收工厂',
  assignedQty: 2500,
  businessAssignedAt: '2026-08-10 09:22:00',
  policy: sewingPolicy,
})
assert(snapshot)
assert.equal(snapshot.assignmentDate, independentPreview.assignmentDate)
assert.deepEqual(snapshot.milestones, independentPreview.milestones)

assert.equal(resolveTenderBusinessAssignedAt({ businessAssignedAt: '2026-08-10 09:22:00', createdAt: '2026-08-09 08:00:00' }), '2026-08-10 09:22:00')
assert.equal(resolveTenderBusinessAssignedAt({ createdAt: '2026-08-09 08:00:00' }), '2026-08-09 08:00:00')
assert.equal(resolveTenderBusinessAssignedAt(
  { businessAssignedAt: '2026-08-10 09:22:00', createdAt: '2026-08-09 08:00:00' },
  { businessAssignedAt: '2026-08-10 10:00:00' },
), '2026-08-10 10:00:00')

const tenderStoreSnapshot = captureRuntimeTaskTenderRecordStore()
try {
  upsertRuntimeTaskTenderRecord({
    tenderId: 'TD-CHECK-PREVIEW-001',
    taskId: 'TASK-CHECK-PREVIEW-001',
    businessAssignedAt: '2026-08-10 09:22:00',
    assignmentOperatedAt: '2026-08-10 10:00:00',
    biddingDeadline: '2026-08-10 12:00:00',
    taskDeadline: '',
    poolMode: 'ALL_ELIGIBLE',
    taskSnapshot: {
      taskNo: 'TASK-CHECK-PREVIEW-001',
      productionOrderId: 'PO-CHECK-PREVIEW-001',
      processName: '车缝',
      taskTypeLabel: '独立车缝任务',
      qty: 2500,
      qtyUnit: '件',
      skuLines: [
        { skuCode: 'SKU-CHECK-PREVIEW-001', color: 'Black', size: 'M', qty: 2500 },
      ],
    },
    factoryPool: [{ factoryId: 'FAC-CHECK-001', factoryName: '验收工厂' }],
    standardPrice: 1500,
    minPrice: 1200,
    currency: 'IDR',
    unit: '件',
    remark: '验证业务分配日期与招标报价共享事实',
    createdBy: '专项检查',
  })
  recordRuntimeTaskTenderQuote('TASK-CHECK-PREVIEW-001', {
    factoryId: 'FAC-CHECK-001',
    factoryName: '验收工厂',
    quotePrice: 1480,
    quoteTime: '2026-08-10 11:00:00',
    deliveryDays: 9,
  })
  const tenderRecord = getRuntimeTaskTenderRecord('TASK-CHECK-PREVIEW-001')
  assert(tenderRecord)
  assert.equal(tenderRecord.businessAssignedAt, '2026-08-10 09:22:00')
  assert.equal(tenderRecord.quotes[0].quotePrice, 1480)
  assert.throws(
    () => recordRuntimeTaskTenderQuote('TASK-CHECK-PREVIEW-001', {
      factoryId: 'FAC-CHECK-001',
      factoryName: '验收工厂',
      quotePrice: 1490,
      quoteTime: '2026-08-10 11:30:00',
    }),
    /不允许修改/,
  )
} finally {
  restoreRuntimeTaskTenderRecordStore(tenderStoreSnapshot)
}

const reassignmentPreview = getRuntimeSewingTaskReassignmentScopePreview(
  'TASKGEN-202603-0015-002__ORDER',
  '2026-08-10 23:59:59',
)
assert(reassignmentPreview)
assert.equal(
  reassignmentPreview.remainingQty,
  reassignmentPreview.originalAssignedQty - reassignmentPreview.confirmedReceivedQty,
)

const workbenchSource = fs.readFileSync(path.join(repoRoot, 'src/pages/unified-dispatch-workbench.ts'), 'utf8')
const tenderSource = fs.readFileSync(path.join(repoRoot, 'src/pages/dispatch-tenders.ts'), 'utf8')
for (const forbidden of [
  'Math.ceil(task.scopeQty * .78)',
  'Math.ceil(task.scopeQty * .4)',
  'Math.ceil(task.scopeQty * .25)',
  'Math.ceil(task.scopeQty * .1)',
  'Math.ceil(task.scopeQty * .7)',
  '/materials/accessory-button.jpg',
]) assert(!workbenchSource.includes(forbidden), `统一分配页仍保留旧推算或固定物料 Mock：${forbidden}`)
assert(!tenderSource.includes('milestone.ratioLabel'), '定标回货预览不得读取不存在的 ratioLabel 字段')
assert(tenderSource.includes('Math.round(milestone.ratio * 100)'), '定标回货预览必须从里程碑比例生成 30/70/100 标签')
assert(!tenderSource.includes('dispatchBoardState'), '招标单页不得再读取已删除的旧任务分配看板状态')
assert(workbenchSource.includes('upsertRuntimeTaskTenderRecord'), '任务分配发起竞价必须写入共享招标事实')
assert(tenderSource.includes('listRuntimeTaskTenderRecords'), '招标单管理必须读取共享招标事实')

console.log('FCS 车缝准备事实与分阶段回货预览专项检查通过')
