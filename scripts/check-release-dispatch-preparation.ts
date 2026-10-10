import assert from 'node:assert/strict'

import {
  assertSewingAssignmentMaterialReadiness,
  evaluateSewingMaterialReadiness,
  getSewingAssignmentReadiness,
} from '../src/data/fcs/sewing-assignment-readiness.ts'
import { getMaterialPrepDispatchReadinessForTask, type MaterialPrepDispatchReadiness } from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  confirmCutPieceReleaseAvailableQty,
  getCutPieceDispatchReadinessForTask,
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseTargetSnapshots,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release.ts'
import { createEffectiveTaskAssignment, getEffectiveTaskAssignment, resetEffectiveTaskAssignmentsForTests } from '../src/data/fcs/effective-task-assignments.ts'
import { getRuntimeTaskById } from '../src/data/fcs/runtime-process-tasks.ts'
import { classifyTaskFulfillmentPolicy } from '../src/data/fcs/task-fulfillment-policy.ts'
import { getPpicPreparationFollowUp } from '../src/pages/sewing-outsourcing/tasks.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'

// DISPATCH-001/004/005, ACCESSORY-001/002: readiness means a lawful assignment,
// while quantities remain the accessory warehouse's own facts and units.
const material: MaterialPrepDispatchReadiness = {
  taskId: 'SEW', taskNo: 'SEW', taskName: '车缝', productionOrderId: 'PO-CHECK', productionOrderNo: 'PO-CHECK',
  taskType: '车缝任务', hasMaterialPrepScope: true, ready: false, blockingLineCount: 1,
  summaryText: '拉链未配 30 条',
  lines: [{
    prepOrderId: 'PREP-CHECK', prepOrderNo: 'PREP-CHECK', productionOrderNo: 'PO-CHECK', prepLineId: 'ZIP',
    materialSku: 'ZIP-01', materialName: '拉链', materialImageUrl: '/material.jpg', color: 'Black', spec: '20cm',
    unit: '条', requiredQty: 100, confirmedPrepQty: 70, remainingPrepQty: 30, availableStockQty: 20,
    linePrepStatus: '部分已配', upstreamProgressStatus: '采购中', upstreamDocumentNo: '', ready: false,
  }],
}
const before = structuredClone(material)
const po2Prep = getMaterialPrepDispatchReadinessForTask({ taskId: 'SEW-PO2', productionOrderId: 'PO-202603-0002', processCode: 'SEW' })
const po1Prep = getMaterialPrepDispatchReadinessForTask({ taskId: 'SEW-PO1', productionOrderId: 'PO-202603-0001', processCode: 'SEW' })
assert(po2Prep.lines.every((line) => line.productionOrderNo === 'PO-202603-0002'), '按单投影不能混入其他生产单的物料')
assert(po1Prep.lines.length > 0 && po1Prep.lines.every((line) => line.productionOrderNo === 'PO-202603-0001'), '另一生产单仍从自身配料来源读取')
assert(po1Prep.lines.every((line) => line.remainingPrepQty === 0), 'PO0002演示欠料不能污染PO0001已配齐事实')
assert.deepEqual(getMaterialPrepDispatchReadinessForTask({ taskId: 'SEW-PO2-AGAIN', productionOrderId: 'PO-202603-0002', processCode: 'SEW' }).lines, po2Prep.lines, '交替读取不同生产单后不能复用其他单的投影')
assert.equal(getMaterialPrepDispatchReadinessForTask({ taskId: 'SEW-UNKNOWN', productionOrderId: 'PO-MISSING-SCOPE', processCode: 'SEW' }).lines.length, 0, '未知生产单不能回退到任一演示单配料')
const incomplete = evaluateSewingMaterialReadiness(material, '车缝配料', false)
assert.equal(incomplete.reasons.length, 0, '辅料未齐本身不得阻断从车缝开始任务')
assert.match(incomplete.warnings.join('；'), /未配齐.*30 条/)
assert.deepEqual(material, before, '不得将裁片数量写入配料事实或推定已配齐')
assert(evaluateSewingMaterialReadiness(material, '车缝配料', true).reasons.length > 0, '整包自裁的原有配齐条件保留')

const missing = { ...material, hasMaterialPrepScope: false, lines: [], ready: true }
assert.equal(evaluateSewingMaterialReadiness(missing, '车缝配料', false).reasons.length, 0)
assert.match(evaluateSewingMaterialReadiness(missing, '车缝配料', false).warnings.join('；'), /核对.*配料明细/)
assert(evaluateSewingMaterialReadiness(missing, '裁剪配料', true).reasons.length > 0)
for (const patch of [
  { unit: '' }, { materialSku: '' }, { requiredQty: NaN }, { requiredQty: 0 },
  { confirmedPrepQty: -1 }, { confirmedPrepQty: Infinity },
]) {
  const invalid = { ...material, lines: [{ ...material.lines[0], ...patch }] }
  assert(evaluateSewingMaterialReadiness(invalid, '车缝配料', false).reasons.length > 0, '放开完成度不代表接受坏身份、单位或数量')
}

resetEffectiveTaskAssignmentsForTests()
resetCutPieceReleasePrototypeStoreForTesting()
try {
  const task = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')
  assert(task, '缺少独立车缝专项任务')
  assert.equal(classifyTaskFulfillmentPolicy(task).startsWithSewing, true)
  const basis = getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId)
  const target = listCutPieceReleaseTargetSnapshots(task.productionOrderId).at(-1)
  assert(basis && target, '缺少当前放行与目标依据')
  const confirmed = confirmCutPieceReleaseAvailableQty({
    productionOrderId: task.productionOrderId,
    basisMatrixVersion: basis.latestMatrixVersion, basisTargetVersion: target.matrixVersion,
    releaseQtyByColorSize: { 'Grey::S': 500, 'Grey::M': 0, 'Grey::L': 0, 'Grey::XL': 0 },
    riskReason: '验证特殊工艺与辅料待完成仍可按已确认放行范围分配。',
    confirmedBy: '裁床主管', confirmedAt: '2026-10-09 12:00:00',
  })
  assert.equal(confirmed.ok, true, confirmed.message)
  const sLine = task.scopeSkuLines.find((line) => line.size === 'S')
  assert(sLine, '任务必须有 S 码完整 SKU')
  assert.doesNotThrow(() => assertSewingAssignmentMaterialReadiness(task))
  assert.equal(getSewingAssignmentReadiness(task).ready, true, '候选入口不能被另一个未放行 SKU 误阻')
  assert.equal(getSewingAssignmentReadiness(task, [sLine]).ready, true, '提交只核对本次合法完整 SKU')
  assert.match(getSewingAssignmentReadiness(task, [sLine]).warnings.join('；'), /前中拉链.*300\s*条/, '静态S13部分配料事实须保留警告，不能把放行视为已配齐')
  assert.equal(getSewingAssignmentReadiness(task, task.scopeSkuLines).ready, false, '显式提交全部 SKU 仍必须满足每格余量')
  const sReadiness = getCutPieceDispatchReadinessForTask({ productionOrderId: task.productionOrderId, skuLines: [sLine] })
  assert.equal(sReadiness.canDispatch, true)
  assert.equal(getSewingAssignmentReadiness(task, [{ ...sLine, qty: 501 }]).ready, false, '不得用辅料待配提示豁免超余量')
  assert.equal(getSewingAssignmentReadiness({ ...task, productionOrderId: 'PO-NO-RELEASE', productionOrderNo: 'PO-NO-RELEASE' }, [sLine]).ready, false, '未确认裁片放行不得分配')
  const assignment = createEffectiveTaskAssignment({
    assignmentId: 'ASG-PREP-FOLLOW-UP', runtimeTaskId: 'TASK-PREP-FOLLOW-UP', taskNo: 'TASK-PREP-FOLLOW-UP',
    productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo,
    factoryId: 'ID-F021', factoryName: 'PT Maju Bersama Garment', source: 'DIRECT_DISPATCH', assignedQty: sLine.qty,
    skuLines: [sLine], processCodes: ['SEW'], frozenPrice: 1500, priceCurrency: 'IDR', priceUnit: '件',
    businessAssignedAt: '2026-10-09 12:00:00', operatedAt: '2026-10-09 12:00:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
  const assignmentBefore = structuredClone(getEffectiveTaskAssignment(assignment.assignmentId))
  const followUp = getPpicPreparationFollowUp({
    assignmentId: assignment.assignmentId, runtimeTaskId: assignment.runtimeTaskId, taskNo: assignment.taskNo || assignment.runtimeTaskId,
    productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo, taskKind: 'INDEPENDENT_SEWING',
  })
  assert.equal(followUp.release?.lines.length, 1, 'PPIC 只跟进本任务颜色尺码')
  assert.equal(followUp.release?.lines[0].releaseConfirmQty, 500)
  assert.equal(followUp.release?.lines[0].allocatedQty, sLine.qty)
  assert(followUp.material.lines.every((line) => line.unit && Number.isFinite(line.requiredQty)), '辅料按真实物料单位读取')
  const zipper = followUp.material.lines.find((line) => line.materialSku === 'tdv_demand_SPU_2024_005-bom-accessory-zipper')
  assert(zipper, 'S13沿用本生产单既有前中拉链明细')
  assert.deepEqual([zipper.unit, zipper.requiredQty, zipper.confirmedPrepQty, zipper.remainingPrepQty], ['条', 2500, 2200, 300], '配料需求、已配、待配按独立来源读取，不能从A/K推定')
  assert.deepEqual(getEffectiveTaskAssignment(assignment.assignmentId), assignmentBefore, 'PPIC 读取风险不得变更已分配任务')
  assert.equal(getPpicPreparationFollowUp({
    assignmentId: assignment.assignmentId, runtimeTaskId: assignment.runtimeTaskId, taskNo: assignment.taskNo || assignment.runtimeTaskId,
    productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo, taskKind: 'CUTTING_SEWING_IRON_PACK',
  }).release, null, '整包自裁后续跟进不强加裁片放行')
} finally {
  resetEffectiveTaskAssignmentsForTests()
  resetCutPieceReleasePrototypeStoreForTesting()
}

console.log('裁片放行车缝分配：配料独立、完成度非门禁、SKU 候选与提交边界专项通过')
