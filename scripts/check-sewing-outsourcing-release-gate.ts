import assert from 'node:assert/strict'

import {
  assertCutPieceReleaseDispatchAvailable,
  confirmCutPieceReleaseAvailableQty,
  getCutPieceDispatchReadinessForTask,
  listCutPieceReleaseAvailableQtyVersions,
  requiresCutPieceReleaseForProcessCodes,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release.ts'
import {
  cancelEffectiveTaskAssignment,
  createEffectiveTaskAssignment,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import {
  applyRuntimeDirectDispatchMeta,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  restoreRuntimeDirectDispatchState,
} from '../src/data/fcs/runtime-process-tasks.ts'

const taskId = 'TASKGEN-202603-0002-002__ORDER'
const runtimeState = captureRuntimeDirectDispatchState()

resetCutPieceReleasePrototypeStoreForTesting()
resetEffectiveTaskAssignmentsForTests()

try {
  assert.equal(requiresCutPieceReleaseForProcessCodes(['SEW']), true)
  assert.equal(requiresCutPieceReleaseForProcessCodes(['SEW', 'IRON', 'PACK']), true)
  assert.equal(requiresCutPieceReleaseForProcessCodes(['CUTTING', 'SEW', 'IRON', 'PACK']), false)

  const task = getRuntimeTaskById(taskId)
  assert(task, '专项检查缺少独立车缝运行任务')
  const beforeAssignmentStatus = task.assignmentStatus
  assert.throws(
    () => applyRuntimeDirectDispatchMeta({
      taskId,
      factoryId: 'ID-F021',
      factoryName: 'PT Maju Bersama Garment',
      acceptDeadline: '',
      taskDeadline: '',
      remark: '验证无足额放行时不得派单',
      by: '生产计划员',
      dispatchPrice: 1500,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      priceDiffReason: '',
      businessAssignedAt: '2026-08-31 09:00:00',
      operatedAt: '2026-08-31 09:05:00',
      autoAccept: true,
    }),
    /裁片放行不足/,
  )
  assert.equal(getRuntimeTaskById(taskId)?.assignmentStatus, beforeAssignmentStatus, '放行阻断后不得留下部分派单状态')

  const initialReadiness = getCutPieceDispatchReadinessForTask({
    productionOrderId: task.productionOrderId,
    productionOrderNo: task.productionOrderNo,
    skuLines: task.scopeSkuLines,
  })
  assert.equal(initialReadiness.canDispatch, false)
  assert(initialReadiness.lines.every((line) => line.availableQty === line.releaseConfirmQty))
  assert(initialReadiness.blockingCount > 0)

  const raisedRelease = confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'PO-202603-0002',
    basisMatrixVersion: 1,
    basisTargetVersion: 1,
    releaseQtyByColorSize: {
      'Grey::S': 500,
      'Grey::M': 700,
      'Grey::L': 800,
      'Grey::XL': 500,
    },
    riskReason: '裁床确认对应裁片已裁出，允许按目标数量风险放行。',
    confirmedBy: '裁床主管 王敏',
    confirmedAt: '2026-08-31 09:10:00',
  })
  assert.equal(raisedRelease.ok, true)
  assert.doesNotThrow(() => assertCutPieceReleaseDispatchAvailable({
    productionOrderId: task.productionOrderId,
    productionOrderNo: task.productionOrderNo,
    skuLines: task.scopeSkuLines,
  }))

  const assignment = createEffectiveTaskAssignment({
    assignmentId: 'ASG-RELEASE-GATE-001',
    runtimeTaskId: 'TASK-RELEASE-GATE-S',
    productionOrderId: 'PO-202603-0002',
    productionOrderNo: 'PO-202603-0002',
    taskNo: 'TASK-RELEASE-GATE-S',
    factoryId: 'ID-F021',
    factoryName: 'PT Maju Bersama Garment',
    source: 'DIRECT_DISPATCH',
    assignedQty: 400,
    skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 400 }],
    processCodes: ['SEW'],
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-08-31 09:15:00',
    operatedAt: '2026-08-31 09:16:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })

  const remaining100 = getCutPieceDispatchReadinessForTask({
    productionOrderId: 'PO-202603-0002',
    skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 100 }],
  })
  assert.equal(remaining100.canDispatch, true)
  assert.equal(remaining100.lines[0].allocatedQty, 400)
  assert.equal(remaining100.lines[0].availableQty, 100)
  assert.deepEqual(remaining100.lines[0].allocationTaskIds, ['TASK-RELEASE-GATE-S'])

  const remaining101 = getCutPieceDispatchReadinessForTask({
    productionOrderId: 'PO-202603-0002',
    skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 101 }],
  })
  assert.equal(remaining101.canDispatch, false, '第二次分配不得与第一次共同超过有效放行')

  const versionsBeforeRejectedDecrease = listCutPieceReleaseAvailableQtyVersions('PO-202603-0002')
  const rejectedDecrease = confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'PO-202603-0002',
    basisMatrixVersion: 1,
    basisTargetVersion: 1,
    releaseQtyByColorSize: {
      'Grey::S': 399,
      'Grey::M': 680,
      'Grey::L': 720,
      'Grey::XL': 430,
    },
    riskReason: 'M码沿用现有风险放行依据。',
    confirmedBy: '裁床主管 王敏',
    confirmedAt: '2026-08-31 09:20:00',
  })
  assert.equal(rejectedDecrease.ok, false)
  assert.match(rejectedDecrease.message, /不得低于已分配数量 400 件/)
  assert.equal(
    listCutPieceReleaseAvailableQtyVersions('PO-202603-0002').length,
    versionsBeforeRejectedDecrease.length,
    '调低失败后不得新增版本或改写原有效放行',
  )
  assert.equal(listCutPieceReleaseAvailableQtyVersions('PO-202603-0002').at(-1)?.releaseQtyByColorSize['Grey::S'], 500)

  const decreaseToFloor = confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'PO-202603-0002',
    basisMatrixVersion: 1,
    basisTargetVersion: 1,
    releaseQtyByColorSize: {
      'Grey::S': 400,
      'Grey::M': 680,
      'Grey::L': 720,
      'Grey::XL': 430,
    },
    riskReason: 'M码沿用现有风险放行依据。',
    confirmedBy: '裁床主管 王敏',
    confirmedAt: '2026-08-31 09:25:00',
  })
  assert.equal(decreaseToFloor.ok, true, '放行数量等于已分配下限时允许保存')

  cancelEffectiveTaskAssignment(assignment.assignmentId, '尚无实物履约，撤销分配释放放行占用', 'PPIC 陈琳', '2026-08-31 09:30:00')
  const afterCancel = getCutPieceDispatchReadinessForTask({
    productionOrderId: 'PO-202603-0002',
    skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 400 }],
  })
  assert.equal(afterCancel.lines[0].allocatedQty, 0)
  assert.equal(afterCancel.lines[0].availableQty, 400)
  assert.equal(afterCancel.canDispatch, true)

  assert.throws(() => assertCutPieceReleaseDispatchAvailable({
    productionOrderId: 'PO-NO-RELEASE-FACT',
    skuLines: [{ skuCode: 'SKU-NO-RELEASE', color: 'Black', size: 'M', qty: 1 }],
  }), /裁片放行不足/)
} finally {
  resetEffectiveTaskAssignmentsForTests()
  resetCutPieceReleasePrototypeStoreForTesting()
  restoreRuntimeDirectDispatchState(runtimeState)
}

console.log('车缝外发裁片放行占用、调低下限与派单硬门禁专项检查通过')
