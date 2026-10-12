import assert from 'node:assert/strict'

import '../src/data/fcs/sewing-assignment-readiness.ts'

import {
  MERGED_PRODUCTION_TASK_DEFINITIONS,
} from '../src/data/fcs/merged-production-task.ts'
import { listSewingFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  allocateRuntimeSkuTaskScope,
  applyRuntimeDirectDispatchMeta,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  listRuntimeExecutionTasks,
  listRuntimeTaskSplitGroupsByOrder,
  restoreRuntimeDirectDispatchState,
} from '../src/data/fcs/runtime-process-tasks.ts'
import { classifyTaskFulfillmentPolicy } from '../src/data/fcs/task-fulfillment-policy.ts'
import {
  confirmCutPieceReleaseAvailableQty,
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseTargetSnapshots,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release.ts'

resetCutPieceReleasePrototypeStoreForTesting()
const fullRelease = confirmCutPieceReleaseAvailableQty({
  productionOrderId: 'PO-202603-0002',
  basisMatrixVersion: getCutPieceReleaseSummaryForProductionOrder('PO-202603-0002')!.latestMatrixVersion,
  basisTargetVersion: listCutPieceReleaseTargetSnapshots('PO-202603-0002').at(-1)!.matrixVersion,
  releaseQtyByColorSize: {
    'Grey::S': 500,
    'Grey::M': 700,
    'Grey::L': 800,
    'Grey::XL': 500,
  },
  riskReason: '任务边界专项需先满足裁片放行硬门禁。',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-08-31 08:55:00',
})
assert.equal(fullRelease.ok, true)

const independentSewingTaskId = 'TASKGEN-202603-0002-002__ORDER'
const independentSewingTask = getRuntimeTaskById(independentSewingTaskId)
assert(independentSewingTask, '必须存在独立车缝演示任务')

const cuttingSewingIronPackTask = listRuntimeExecutionTasks().find((task) => (
  task.mergedTaskType === 'CUTTING_SEWING_IRON_PACK'
  && task.assignmentStatus === 'UNASSIGNED'
))
assert(cuttingSewingIronPackTask, '必须存在待分配的裁剪+车缝+烫包演示任务')
const existingSewingFactory = listSewingFactoryMasterRecords().find((factory) => !factory.id.startsWith('KOL-GOTO'))
assert(existingSewingFactory, '必须存在有效三方车缝工厂用于直接派单验证')

const independentPolicy = classifyTaskFulfillmentPolicy(independentSewingTask)
const sewingIronPackPolicy = classifyTaskFulfillmentPolicy({
  processCode: 'SEWING',
  processBusinessCode: 'SEWING',
  processNameZh: '车缝+烫包',
  taskUnitType: 'MERGED_PRODUCTION_TASK',
  mergedTaskType: 'SEWING_IRON_PACK',
})
const cuttingSewingIronPackPolicy = classifyTaskFulfillmentPolicy(cuttingSewingIronPackTask)

// 业务任务只有三类；独立车缝单厂/多厂只是分配结果，不是新的任务类型。
assert.equal(independentPolicy.taskTypeLabel, '独立车缝任务')
assert.equal(sewingIronPackPolicy.taskTypeLabel, '车缝+烫包')
assert.equal(cuttingSewingIronPackPolicy.taskTypeLabel, '裁剪+车缝+烫包')
assert.equal(independentPolicy.involvesSewingOutsourcing, true)
assert.equal(sewingIronPackPolicy.involvesSewingOutsourcing, true)
assert.equal(cuttingSewingIronPackPolicy.involvesSewingOutsourcing, true)
assert.equal(cuttingSewingIronPackPolicy.startsWithSewing, false, '裁剪+车缝+烫包属于车缝外发，但不能套用裁片装袋和欠片口径')

// 车缝、车缝＋烫包允许按完整 SKU 拆分；裁剪＋车缝＋烫包必须整任务单厂。
assert.equal(independentPolicy.assignmentGranularity, 'SKU')
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK.assignmentGranularity, 'SKU')
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.CUTTING_SEWING_IRON_PACK.assignmentGranularity, 'ORDER')
assert.equal(sewingIronPackPolicy.assignmentGranularity, 'SKU')
assert.equal(cuttingSewingIronPackPolicy.assignmentGranularity, 'ORDER')

const mergedState = captureRuntimeDirectDispatchState()
try {
  const firstMergedSku = cuttingSewingIronPackTask.scopeSkuLines[0]
  assert(firstMergedSku, '合并任务必须包含SKU明细用于验证拆分阻断')
  assert.throws(
    () => allocateRuntimeSkuTaskScope({
      taskId: cuttingSewingIronPackTask.taskId,
      lines: [{ skuCode: firstMergedSku.skuCode, qty: firstMergedSku.qty }],
      by: 'PPIC任务边界专项检查',
      operatedAt: '2026-08-31 09:00:00',
    }),
    /必须整单分配/,
  )

} finally {
  restoreRuntimeDirectDispatchState(mergedState)
}

// 页面逐次分配时，本次所选 SKU 为一张任务，全部剩余 SKU 仍只能是一张待分配任务；
// 同一来源任务下已经承接过的工厂不得再次承接另一张执行任务。
const incrementalState = captureRuntimeDirectDispatchState()
try {
  const firstSku = independentSewingTask.scopeSkuLines[0]
  assert(firstSku)
  const firstFactoryTask = allocateRuntimeSkuTaskScope({
    taskId: independentSewingTask.taskId,
    lines: [{ skuCode: firstSku.skuCode, qty: firstSku.qty }],
    by: 'PPIC任务边界专项检查',
    operatedAt: '2026-08-31 09:10:00',
  })
  const splitGroup = listRuntimeTaskSplitGroupsByOrder(independentSewingTask.productionOrderId)
    .find((item) => item.sourceTaskId === independentSewingTask.taskId)
  assert(splitGroup)
  assert.equal(splitGroup.resultTasks.length, 2, '本次所选SKU与全部剩余SKU必须只形成两张任务')

  const commonDispatchInput = {
    factoryId: existingSewingFactory.id,
    factoryName: existingSewingFactory.name,
    acceptDeadline: '',
    taskDeadline: '',
    remark: '验证同源任务一厂一任务',
    by: 'PPIC任务边界专项检查',
    dispatchPrice: 1200,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
    businessAssignedAt: '2026-08-31 09:10:00',
    operatedAt: '2026-08-31 09:10:00',
    autoAccept: true,
  }
  assert(applyRuntimeDirectDispatchMeta({ taskId: firstFactoryTask.taskId, ...commonDispatchInput }))
  const residualTaskId = splitGroup.resultTasks.find((item) => item.taskId !== firstFactoryTask.taskId)?.taskId
  assert(residualTaskId)
  assert.throws(
    () => applyRuntimeDirectDispatchMeta({
      taskId: residualTaskId,
      ...commonDispatchInput,
      operatedAt: '2026-08-31 09:11:00',
    }),
    /同一来源车缝任务下，一家工厂只能对应一张执行任务/,
  )
} finally {
  restoreRuntimeDirectDispatchState(incrementalState)
}

console.log('车缝外发任务类型、完整SKU拆分与一厂一执行任务专项检查通过')
