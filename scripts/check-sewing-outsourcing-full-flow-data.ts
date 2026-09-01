import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  confirmCutPieceReleaseAvailableQty,
  getCutPieceDispatchReadinessForTask,
  listCutPieceReleaseAvailableQtyVersions,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release.ts'
import {
  createEffectiveTaskAssignment,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import {
  PPIC_TEAM_LEADER_LINGYUN,
  SEWING_OUTSOURCING_DEMO_CURRENT_PPIC,
  getAvailableOnboardingPpicOptions,
} from '../src/data/fcs/factory-onboarding-ppic.ts'
import {
  getCurrentSewingTaskResponsibility,
  listSewingTaskResponsibilityVersions,
  resetSewingTaskResponsibilityTransfersForTests,
  transferSewingTaskResponsibility,
} from '../src/data/fcs/sewing-outsourcing-responsibility.ts'
import {
  createSewingCutPiecePartExclusion,
  getSewingCutPieceResponsibilityProjection,
  initializeSewingCutPieceResponsibility,
  listSewingReturnResponsibilityVersions,
  recordSewingCutPieceHandover,
  resetSewingCutPieceResponsibilityForTests,
} from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import {
  completeSupplementOrder,
  registerSupplementOrder,
  resetSupplementOrderRegistryForTesting,
  type RegisterSupplementOrderInput,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'
import {
  listSewingSupplementTrackingRows,
  recordSewingSupplementFollowUp,
  resetSewingSupplementTrackingForTests,
} from '../src/data/fcs/sewing-outsourcing-supplement-tracking.ts'
import {
  getSewingSampleApprovalRecord,
  handoffPreProductionSampleToApprover,
  markPreProductionSampleFactoryCompleted,
  receivePreProductionSampleByPpic,
  recordSampleApprovalFeedbackToFactory,
  startSampleApproval,
  submitSampleApprovalSuggestion,
} from '../src/data/fcs/sewing-sample-approval-suggestion.ts'
import {
  getSewingMaterialHandoverProjection,
  recordSewingMaterialHandover,
} from '../src/data/fcs/sewing-material-handover.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  confirmPostFinishingFactoryReturn,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  listSewingOutsourcingReturnTrackingRows,
} from '../src/data/fcs/sewing-outsourcing-return-tracking.ts'
import { resetProductionReturnSnapshotSequenceForTests } from '../src/data/fcs/production-return-fulfillment.ts'
import {
  ensureSewingCutPieceReturnWorkflowDemo,
  receiveApprovedCutPieceReturnByWarehouse,
  resetSewingCutPieceReturnWorkflowForTests,
} from '../src/data/fcs/sewing-cut-piece-return-workflow.ts'
import {
  listSewingFactoriesWithoutActivePpic,
  listSewingFactoryMasterRecords,
} from '../src/data/fcs/factory-master-store.ts'
import { classifyTaskFulfillmentPolicy } from '../src/data/fcs/task-fulfillment-policy.ts'

type ReceiptStep = {
  step: string
  objectIds: string[]
  before?: unknown
  after: unknown
  assertions: string[]
}

const passName = process.env.VERIFICATION_PASS?.trim() || 'manual'
const evidenceDir = path.resolve(process.env.PPIC_EVIDENCE_DIR?.trim() || `/private/tmp/ppic-${passName}`)
const steps: ReceiptStep[] = []

function record(step: ReceiptStep): void {
  steps.push(step)
}

function assertGate(label: string, run: () => unknown, pattern: RegExp): string {
  try {
    run()
  } catch (error) {
    assert(error instanceof Error, `${label}必须返回明确错误`)
    assert.match(error.message, pattern, `${label}错误信息必须说明业务门禁`)
    return error.message
  }
  assert.fail(`${label}必须被阻断`)
}

resetCutPieceReleasePrototypeStoreForTesting()
resetEffectiveTaskAssignmentsForTests()
resetSewingTaskResponsibilityTransfersForTests()
resetSewingCutPieceResponsibilityForTests()
resetSupplementOrderRegistryForTesting()
resetSewingSupplementTrackingForTests()
resetPostFinishingFullFlow()
resetProductionReturnSnapshotSequenceForTests()
resetSewingCutPieceReturnWorkflowForTests()

const formalSewingFactories = listSewingFactoryMasterRecords()
assert(formalSewingFactories.length > 0, '必须存在正式三方车缝工厂')
assert.deepEqual(listSewingFactoriesWithoutActivePpic(), [], '所有正式三方车缝工厂必须有唯一有效PPIC')
assert(formalSewingFactories.every((factory) => !/DEFAULT|默认/.test(`${factory.assignedPpicId || ''}${factory.assignedPpicName || ''}`)), '正式工厂不得挂占位PPIC')
record({
  step: '正式工厂PPIC完整性',
  objectIds: formalSewingFactories.map((factory) => factory.id),
  after: { formalSewingFactoryCount: formalSewingFactories.length, missingPpicCount: 0, placeholderPpicCount: 0 },
  assertions: ['每家正式三方车缝工厂有且仅有一名启用PPIC', '不存在默认或占位PPIC身份'],
})

const initialReadiness = getCutPieceDispatchReadinessForTask({
  productionOrderId: 'PO-202603-0002',
  skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 500 }],
})
assert.equal(initialReadiness.canDispatch, false, '裁床放行数量不足时PPIC不得分配对应车缝数量')
const release = confirmCutPieceReleaseAvailableQty({
  productionOrderId: 'PO-202603-0002',
  basisMatrixVersion: 1,
  basisTargetVersion: 1,
  releaseQtyByColorSize: { 'Grey::S': 500, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 },
  riskReason: '裁床确认完整部位与当前可做数量后放行。',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-09-01 08:40:00',
})
assert.equal(release.ok, true)
record({
  step: '裁片放行后开放PPIC分配',
  objectIds: ['PO-202603-0002', release.version!.releaseVersionId],
  before: { canDispatch: initialReadiness.canDispatch, availableQty: initialReadiness.lines[0]?.availableQty },
  after: { canDispatch: true, releaseQty: release.version!.releaseQtyByColorSize['Grey::S'] },
  assertions: ['放行数量不足时禁止分配', '放行由裁床确认并形成版本'],
})

const nonPpicAllocationMessage = assertGate('非PPIC分配车缝任务', () => createEffectiveTaskAssignment({
  assignmentId: 'ASG-PPIC-E2E-NON-PPIC',
  runtimeTaskId: 'TASK-PPIC-E2E-NON-PPIC',
  productionOrderId: 'PO-202603-0002',
  factoryId: 'ID-F021',
  factoryName: 'CV Micro Sewing Jakarta Pusat',
  source: 'DIRECT_DISPATCH',
  assignedQty: 10,
  skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 10 }],
  processCodes: ['SEW'],
  frozenPrice: 1500,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-09-01 08:45:00',
  operatedAt: '2026-09-01 08:45:00',
  operatedBy: '生产计划员',
}), /只能由当前登录的有效PPIC分配/)

const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-PPIC-E2E-001',
  runtimeTaskId: 'TASKGEN-202603-0002-002__ORDER',
  productionOrderId: 'PO-202603-0002',
  productionOrderNo: 'PO-202603-0002',
  taskNo: 'SEW-PPIC-E2E-001',
  factoryId: 'ID-F021',
  factoryName: 'CV Micro Sewing Jakarta Pusat',
  source: 'DIRECT_DISPATCH',
  assignedQty: 400,
  skuLines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', qty: 400 }],
  processCodes: ['SEW'],
  frozenPrice: 1500,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-09-01 08:50:00',
  operatedAt: '2026-09-01 08:50:00',
  operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
})
assert.equal(assignment.allocationOperatorPpicId, SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId)
assert.equal(assignment.ppicId, SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId)
record({
  step: 'PPIC按完整SKU分配独立车缝任务',
  objectIds: [assignment.assignmentId, assignment.runtimeTaskId, assignment.skuLines[0]!.skuCode],
  before: { rejectedNonPpicOperator: nonPpicAllocationMessage },
  after: { allocator: assignment.allocationOperatorPpicName, taskPpic: assignment.ppicName, factoryId: assignment.factoryId, assignedQty: assignment.assignedQty },
  assertions: ['含车缝任务只能由有效PPIC分配', '分配后冻结承接工厂和任务PPIC', '分配明细保留完整SKU'],
})

const releaseVersionsBeforeReject = listCutPieceReleaseAvailableQtyVersions('PO-202603-0002').length
const rejectedReleaseDecrease = confirmCutPieceReleaseAvailableQty({
  productionOrderId: 'PO-202603-0002',
  basisMatrixVersion: 1,
  basisTargetVersion: 1,
  releaseQtyByColorSize: { 'Grey::S': 399, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 },
  riskReason: '验证不得低于分配占用。',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-09-01 08:55:00',
})
assert.equal(rejectedReleaseDecrease.ok, false)
assert.match(rejectedReleaseDecrease.message, /不得低于已分配数量 400 件/)
assert.equal(listCutPieceReleaseAvailableQtyVersions('PO-202603-0002').length, releaseVersionsBeforeReject)
record({
  step: '已分配后放行数量下限保护',
  objectIds: ['PO-202603-0002', assignment.assignmentId],
  before: { effectiveReleaseQty: 500, activeAssignedQty: 400, versionCount: releaseVersionsBeforeReject },
  after: { attemptedReleaseQty: 399, saved: false, versionCount: listCutPieceReleaseAvailableQtyVersions('PO-202603-0002').length },
  assertions: ['放行不得低于有效分配数量', '失败修改不新增版本且不改写历史'],
})

const sewingIronReadiness = getCutPieceDispatchReadinessForTask({
  productionOrderId: 'PO-202603-0002',
  skuLines: [{ skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M', qty: 100 }],
})
assert.equal(sewingIronReadiness.canDispatch, true)
const sewingIronAssignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-PPIC-E2E-SEW-IRON-001',
  runtimeTaskId: 'TASK-PPIC-E2E-SEW-IRON-001',
  productionOrderId: 'PO-202603-0002',
  productionOrderNo: 'PO-202603-0002',
  taskNo: 'SEW-IRON-PPIC-E2E-001',
  factoryId: 'ID-F021',
  factoryName: 'CV Micro Sewing Jakarta Pusat',
  source: 'DIRECT_DISPATCH',
  assignedQty: 100,
  skuLines: [{ skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M', qty: 100 }],
  processCodes: ['SEW', 'IRON_PACK'],
  frozenPrice: 1800,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-09-01 08:56:00',
  operatedAt: '2026-09-01 08:56:00',
  operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
})
initializeSewingCutPieceResponsibility({
  assignmentId: sewingIronAssignment.assignmentId,
  requirementSnapshotId: 'TECHPACK-PPIC-E2E-SEW-IRON-V1',
  requirementSnapshotAt: '2026-09-01 08:57:00',
  requirementSnapshotBy: '系统按有效分配冻结',
  requirementLines: [
    { skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M', partCode: 'BODY', partName: '衣身', piecesPerGarment: 1, allocatedGarmentQty: 100 },
  ],
})
recordSewingCutPieceHandover({
  commandId: 'CMD-PPIC-E2E-SEW-IRON-HANDOVER-001',
  assignmentId: sewingIronAssignment.assignmentId,
  handoverRecordId: 'HANDOVER-PPIC-E2E-SEW-IRON-001',
  handoverRecordNo: 'JCR-PPIC-E2E-SEW-IRON-001',
  dispatchBatchId: 'BATCH-PPIC-E2E-SEW-IRON-001',
  handedOverAt: '2026-09-01 08:58:00',
  handedOverBy: '裁床待交出仓 王敏',
  lines: [{ skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M', partCode: 'BODY', pieceQty: 100 }],
})
const sewingIronProjection = getSewingCutPieceResponsibilityProjection(sewingIronAssignment.assignmentId)
assert.equal(sewingIronProjection.strictCompleteKitQty, 100)
assert.equal(sewingIronProjection.returnResponsibilityQty, 100)
assert.equal(sewingIronProjection.totalDebtPieceQty, 0)
record({
  step: '车缝+烫包整任务的放行、裁片交出与回货责任',
  objectIds: [sewingIronAssignment.assignmentId, 'HANDOVER-PPIC-E2E-SEW-IRON-001'],
  before: { canDispatch: sewingIronReadiness.canDispatch, availableQty: sewingIronReadiness.lines[0]?.availableQty },
  after: { assignedFactoryCount: 1, assignedQty: sewingIronAssignment.assignedQty, strictKitQty: sewingIronProjection.strictCompleteKitQty, returnResponsibilityQty: sewingIronProjection.returnResponsibilityQty, debtPieceQty: sewingIronProjection.totalDebtPieceQty },
  assertions: ['车缝+烫包整任务只分一家工厂', '该类型与独立车缝一样受裁片放行门禁', '实际交出形成齐套和成衣回货责任'],
})

initializeSewingCutPieceResponsibility({
  assignmentId: assignment.assignmentId,
  requirementSnapshotId: 'TECHPACK-PPIC-E2E-CUT-V1',
  requirementSnapshotAt: '2026-09-01 09:00:00',
  requirementSnapshotBy: '系统按有效分配冻结',
  requirementLines: [
    { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: 400 },
    { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'BACK', partName: '后片', piecesPerGarment: 1, allocatedGarmentQty: 400 },
    { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'POCKET', partName: '口袋', piecesPerGarment: 1, allocatedGarmentQty: 400 },
  ],
})
recordSewingCutPieceHandover({
  commandId: 'CMD-PPIC-E2E-HANDOVER-001',
  assignmentId: assignment.assignmentId,
  handoverRecordId: 'HANDOVER-PPIC-E2E-001',
  handoverRecordNo: 'JCR-PPIC-E2E-001',
  dispatchBatchId: 'BATCH-PPIC-E2E-001',
  handedOverAt: '2026-09-01 09:10:00',
  handedOverBy: '裁床待交出仓 王敏',
  lines: [
    { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'FRONT', pieceQty: 400 },
    { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'BACK', pieceQty: 400 },
  ],
})
const beforeExclusion = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(beforeExclusion.totalDebtPieceQty, 400)
assert.equal(beforeExclusion.structuralMissingLineCount, 1)
assert.equal(beforeExclusion.strictCompleteKitQty, 0)

const transferTarget = getAvailableOnboardingPpicOptions().find((ppic) => ppic.status === '启用' && ppic.role === 'MEMBER' && ppic.ppicId !== assignment.ppicId)
assert(transferTarget, '必须有另一名有效PPIC用于负责人明确移交')
const transfer = transferSewingTaskResponsibility({
  commandId: 'CMD-PPIC-E2E-TRANSFER-001',
  runtimeTaskId: assignment.runtimeTaskId,
  targetPpicId: transferTarget.ppicId,
  reason: '凌云按团队负荷重新安排尚未完成任务',
  remainingItems: ['跟进整部位欠片及补料', '转交产前版样衣并反馈批版建议', '跟进后道回货'],
  operatedAt: '2026-09-01 09:15:00',
  operatedByPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
})
assert.equal(getCurrentSewingTaskResponsibility(assignment.runtimeTaskId)?.ppicId, transferTarget.ppicId)
assert.equal(listSewingTaskResponsibilityVersions(assignment.runtimeTaskId).length, 2)

const oldPpicExclusionMessage = assertGate('原PPIC移交后排除部位', () => createSewingCutPiecePartExclusion({
  commandId: 'CMD-PPIC-E2E-EXCLUSION-OLD-PPIC',
  assignmentId: assignment.assignmentId,
  skuCode: 'SKU-005-S-GRY',
  color: 'Grey',
  size: 'S',
  partCode: 'POCKET',
  reason: '裁床尚未裁出口袋，先排除后安排主体生产。',
  createdAt: '2026-09-01 09:20:00',
  createdByPpicId: assignment.ppicId!,
}), /只有该执行任务当前PPIC/)
const exclusion = createSewingCutPiecePartExclusion({
  commandId: 'CMD-PPIC-E2E-EXCLUSION-001',
  assignmentId: assignment.assignmentId,
  skuCode: 'SKU-005-S-GRY',
  color: 'Grey',
  size: 'S',
  partCode: 'POCKET',
  reason: '口袋整个部位尚未由裁床裁出，为避免主体停线，按批版要求先生产主体。',
  evidenceUrls: ['/shirt-sample.jpg'],
  productionImpact: '主体可先生产，但口袋补齐前不得完成整件。',
  createdAt: '2026-09-01 09:21:00',
  createdByPpicId: transferTarget.ppicId,
})
const afterExclusion = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(afterExclusion.strictCompleteKitQty, 0)
assert.equal(afterExclusion.effectiveCompleteKitQty, 400)
assert.equal(afterExclusion.returnResponsibilityQty, 400)
assert.equal(afterExclusion.totalDebtPieceQty, 400, '排除部位不能消灭欠片')
record({
  step: '整部位欠片、负责人移交与人为排除',
  objectIds: [assignment.assignmentId, transfer.responsibilityVersionId, exclusion.exclusionVersionId],
  before: { currentPpic: assignment.ppicName, strictKitQty: beforeExclusion.strictCompleteKitQty, debtPieceQty: beforeExclusion.totalDebtPieceQty },
  after: { currentPpic: transfer.ppicName, strictKitQty: afterExclusion.strictCompleteKitQty, effectiveKitQty: afterExclusion.effectiveCompleteKitQty, returnResponsibilityQty: afterExclusion.returnResponsibilityQty, debtPieceQty: afterExclusion.totalDebtPieceQty, oldPpicRejected: oldPpicExclusionMessage },
  assertions: ['尚未完成任务只能由PPIC管理人员明确移交', '移交保留原责任版本', '人为排除仅调整有效齐套和应回责任，不清除欠片'],
})

const supplementInput: RegisterSupplementOrderInput = {
  id: 'SUP-PPIC-E2E-001',
  recordNo: 'BL-PPIC-E2E-001',
  cutOrderId: 'CUT-PPIC-E2E-001',
  cutOrderNo: 'CUT-PPIC-E2E-001',
  productionOrderId: assignment.productionOrderId,
  productionOrderNo: assignment.productionOrderNo!,
  reason: '裁片不足',
  reasonDetail: '车缝任务SKU-005-S-GRY的POCKET口袋整个部位缺少400片。',
  totalQty: 400,
  lineSummary: 'Grey / S / 口袋（POCKET）400片',
  lines: [{ color: 'Grey', size: 'S', supplementQty: 400 }],
  materialDemands: [],
  createdAt: '2026-09-01 09:30:00',
  createdBy: '裁床主管 王敏',
}
const ppicSupplementMessage = assertGate('PPIC发起补料单', () => registerSupplementOrder(supplementInput, 'PPIC'), /只能由裁床发起和推进/)
const systemSupplementMessage = assertGate('SYSTEM绕过补料岗位', () => registerSupplementOrder(supplementInput, 'SYSTEM' as never), /只能由裁床发起和推进/)
const supplement = registerSupplementOrder(supplementInput, 'CUTTING')
const supplementRow = listSewingSupplementTrackingRows().find((row) => row.assignmentId === assignment.assignmentId)
assert(supplementRow, 'PPIC必须能按生产单与缺片部位读取裁床补料单')
assert.equal(supplementRow.supplementOrders.some((order) => order.id === supplement.id), true)
assert.equal(supplementRow.structuralMissingLineCount, 1)
const followUp = recordSewingSupplementFollowUp({
  commandId: 'CMD-PPIC-E2E-SUP-FOLLOW-001',
  assignmentId: assignment.assignmentId,
  ppicId: transferTarget.ppicId,
  result: '已与裁床确认口袋整部位补裁，补料单已进入裁剪。',
  nextAction: '按承诺时间核查补裁完成并安排补交工厂。',
  promisedAt: '2026-09-01 15:00:00',
  followedAt: '2026-09-01 09:40:00',
})
const ppicCompleteMessage = assertGate('PPIC推进补料完成', () => completeSupplementOrder({
  id: supplement.id,
  completedAt: '2026-09-01 14:00:00',
  completedBy: transferTarget.ppicName,
  actorRole: 'PPIC',
}), /只能由裁床发起和推进/)
const completedSupplement = completeSupplementOrder({
  id: supplement.id,
  completedAt: '2026-09-01 14:00:00',
  completedBy: '裁床主管 王敏',
  actorRole: 'CUTTING',
})
recordSewingCutPieceHandover({
  commandId: 'CMD-PPIC-E2E-HANDOVER-SUP-001',
  assignmentId: assignment.assignmentId,
  handoverRecordId: 'HANDOVER-PPIC-E2E-SUP-001',
  handoverRecordNo: 'JCR-PPIC-E2E-SUP-001',
  dispatchBatchId: 'BATCH-PPIC-E2E-SUP-001',
  handedOverAt: '2026-09-01 14:20:00',
  handedOverBy: '裁床待交出仓 王敏',
  lines: [{ skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S', partCode: 'POCKET', pieceQty: 400 }],
})
const afterSupplementHandover = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(afterSupplementHandover.totalDebtPieceQty, 0)
assert.equal(afterSupplementHandover.returnResponsibilityQty, 400, '补交欠片不得把应回责任重复增加到800件')
record({
  step: '裁床补料、PPIC只读跟进与补交消欠',
  objectIds: [supplement.id, followUp.logId, 'HANDOVER-PPIC-E2E-SUP-001'],
  before: { debtPieceQty: afterExclusion.totalDebtPieceQty, ppicCreateRejected: ppicSupplementMessage, systemBypassRejected: systemSupplementMessage, ppicCompleteRejected: ppicCompleteMessage },
  after: { supplementStatus: completedSupplement.status, debtPieceQty: afterSupplementHandover.totalDebtPieceQty, returnResponsibilityQty: afterSupplementHandover.returnResponsibilityQty },
  assertions: ['补料只能由裁床发起和推进', 'PPIC只记录协同跟进并读取补料状态', '补交裁片只消减欠片，不重复增加成衣回货责任'],
})

const factoryActor = { actorId: assignment.factoryId, actorName: `${assignment.factoryName} 样衣员`, role: 'FACTORY' as const }
const currentPpicActor = { actorId: transferTarget.ppicId, actorName: transferTarget.ppicName, role: 'PPIC' as const }
const approverActor = { actorId: 'SAMPLE-APPROVER-E2E-001', actorName: '批版人员 林慧', role: 'SAMPLE_APPROVER' as const }
markPreProductionSampleFactoryCompleted({
  commandId: 'CMD-PPIC-E2E-SAMPLE-FACTORY', assignmentId: assignment.assignmentId, actor: factoryActor,
  samplePhotoUrls: ['/shirt-sample.jpg'], completedAt: '2026-09-01 14:30:00',
})
receivePreProductionSampleByPpic({
  commandId: 'CMD-PPIC-E2E-SAMPLE-RECEIVE', assignmentId: assignment.assignmentId, actor: currentPpicActor,
  receivedSamplePhotoUrls: ['/shirt-sample.jpg'],
  receivedAt: '2026-09-01 15:00:00',
})
handoffPreProductionSampleToApprover({
  commandId: 'CMD-PPIC-E2E-SAMPLE-HANDOFF', assignmentId: assignment.assignmentId, actor: currentPpicActor,
  approverTeamName: '大货批版组', handedAt: '2026-09-01 15:10:00',
})
startSampleApproval({ commandId: 'CMD-PPIC-E2E-SAMPLE-START', assignmentId: assignment.assignmentId, actor: approverActor })
const suggestion = submitSampleApprovalSuggestion({
  commandId: 'CMD-PPIC-E2E-SAMPLE-SUGGESTION', assignmentId: assignment.assignmentId, actor: approverActor,
  conclusion: 'HAS_PROBLEM', problemParts: ['口袋', '侧缝'],
  specificAdvice: '口袋位置上移1cm；侧缝按纸样顺直车缝，大货按本批版建议执行。',
  annotatedImageUrls: ['/shirt-sample.jpg'], requiresAnotherApproval: false, uploadedAt: '2026-09-01 15:30:00',
})
recordSampleApprovalFeedbackToFactory({
  commandId: 'CMD-PPIC-E2E-SAMPLE-FEEDBACK', assignmentId: assignment.assignmentId, actor: currentPpicActor,
  feedbackAt: '2026-09-01 15:40:00', feedbackNote: '已截图发送工厂负责人并确认按批版建议生产大货。',
})
const sampleRecord = getSewingSampleApprovalRecord(assignment.assignmentId)!
assert.equal(sampleRecord.sample.status, 'FEEDBACK_SENT')
assert.equal(sampleRecord.sample.currentPpicId, transferTarget.ppicId)
assert.equal(suggestion.conclusion, 'HAS_PROBLEM')
record({
  step: '产前版样衣实物与批版建议',
  objectIds: [sampleRecord.sample.sampleId, suggestion.suggestionVersionId],
  after: { physicalObject: '产前版样衣', businessAction: '批版建议', status: sampleRecord.sample.status, currentPpic: sampleRecord.sample.currentPpicName, conclusion: suggestion.conclusion, specificAdvice: suggestion.specificAdvice },
  assertions: ['三方车缝工厂先制作一件大货产前版', 'PPIC接收实物并交批版人员', '批版人员核对参考资料并上传具体建议', 'PPIC反馈工厂后才能进入大货执行依据'],
})

const materialOrder = productionOrders.find((order) => order.techPackSnapshot?.bomItems.some((item) => item.type === '面料' || item.type === '辅料') && order.demandSnapshot.skuLines.length)
assert(materialOrder, '必须有含面辅料技术包的生产单')
const materialSku = materialOrder.demandSnapshot.skuLines[0]!
const materialAssignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-PPIC-E2E-MATERIAL-001', runtimeTaskId: 'TASK-PPIC-E2E-MATERIAL-001',
  productionOrderId: materialOrder.productionOrderId, productionOrderNo: materialOrder.productionOrderNo,
  taskNo: 'CUT-SEW-IRON-PPIC-E2E-001', factoryId: 'ID-F021', factoryName: 'CV Micro Sewing Jakarta Pusat',
  source: 'DIRECT_DISPATCH', assignedQty: 20,
  skuLines: [{ skuCode: materialSku.skuCode, color: materialSku.color, size: materialSku.size, qty: 20 }],
  processCodes: ['CUTTING', 'SEW', 'IRON_PACK'], frozenPrice: 2400, priceCurrency: 'IDR', priceUnit: '件',
  businessAssignedAt: '2026-09-01 10:00:00', operatedAt: '2026-09-01 10:00:00',
  operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
})
const materialBefore = getSewingMaterialHandoverProjection(materialAssignment.assignmentId)
assert.equal(materialBefore.context.dataCompleteness, 'COMPLETE')
const ppicMaterialMessage = assertGate('PPIC填写面辅料实交数量', () => recordSewingMaterialHandover({
  commandId: 'CMD-PPIC-E2E-MATERIAL-PPIC', assignmentId: materialAssignment.assignmentId,
  sourceRecordId: 'MAT-OUT-PPIC-E2E-001', sourceRecordNo: 'MCLL-PPIC-E2E-001',
  handedOverAt: '2026-09-01 10:10:00', handedOverBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  handedOverByRole: 'PPIC',
  lines: materialBefore.context.requirementLines.map((line) => ({ requirementLineId: line.requirementLineId, actualQty: line.requiredQty })),
}), /PPIC只能查看面辅料交出/)
const materialHandover = recordSewingMaterialHandover({
  commandId: 'CMD-PPIC-E2E-MATERIAL-WAREHOUSE', assignmentId: materialAssignment.assignmentId,
  sourceRecordId: 'MAT-OUT-PPIC-E2E-001', sourceRecordNo: 'MCLL-PPIC-E2E-001',
  handedOverAt: '2026-09-01 10:15:00', handedOverBy: '面辅料仓 李华', handedOverByRole: 'MATERIAL_WAREHOUSE',
  lines: materialBefore.context.requirementLines.map((line) => ({ requirementLineId: line.requirementLineId, actualQty: line.requiredQty })),
})
const materialAfter = getSewingMaterialHandoverProjection(materialAssignment.assignmentId)
assert.equal(materialAfter.materialShortageLineCount, 0)
assert.equal(materialAfter.hasCutPieceRelease, false)
assert.equal(materialAfter.hasCutPieceDebt, false)
assertGate('裁剪+车缝+烫包建立裁片欠片账', () => getSewingCutPieceResponsibilityProjection(materialAssignment.assignmentId), /尚未冻结必需裁片部位/)
record({
  step: '裁剪+车缝+烫包面辅料交出边界',
  objectIds: [materialAssignment.assignmentId, materialHandover.handoverEventId],
  before: { requirementLineCount: materialBefore.context.requirementLines.length, ppicWriteRejected: ppicMaterialMessage },
  after: { materialShortageLineCount: materialAfter.materialShortageLineCount, hasCutPieceRelease: materialAfter.hasCutPieceRelease, hasCutPieceDebt: materialAfter.hasCutPieceDebt },
  assertions: ['该任务只交出面料和辅料', '不建立裁片放行或欠片语义', 'PPIC不得替仓库填写实交数量'],
})

const firstPostOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]!
const ppicReturnRegisterMessage = assertGate('PPIC登记工厂回货数量', () => registerPostFinishingFactoryReturn({
  productionOrderNo: firstPostOrder.productionOrderNo, returnIndex: 1, triggerSource: '公共PDA自助回货',
  idempotencyKey: 'PPIC-E2E-ILLEGAL-RETURN-REGISTER',
  quantities: firstPostOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 10 })),
  deliveryPersonName: 'PPIC', deliveryPersonPhone: '', evidenceImageUrls: ['/shirt-sample.jpg'],
  actor: { actorId: transferTarget.ppicId, actorName: transferTarget.ppicName, roleName: 'PPIC' },
}), /回货登记只能由车缝工厂送货人员或已登录工厂账号/)
assert(ppicReturnRegisterMessage)
const returnRows = listSewingOutsourcingReturnTrackingRows('2026-09-01 12:00:00')
assert.equal(returnRows.length, 3)
const returnByType = new Map(returnRows.map((row) => [row.taskType, row]))
assert.deepEqual(returnByType.get('INDEPENDENT_SEWING')!.returnProjection.snapshot.milestones.map((item) => item.naturalDay), [4, 8, 9])
assert.deepEqual(returnByType.get('SEWING_TO_IRON_PACK')!.returnProjection.snapshot.milestones.map((item) => item.naturalDay), [5, 9, 10])
assert.deepEqual(returnByType.get('CUTTING_TO_IRON_PACK')!.returnProjection.snapshot.milestones.map((item) => item.naturalDay), [6, 9, 12])
assert(returnByType.get('INDEPENDENT_SEWING')!.confirmedQty > 0)
assert(returnByType.get('SEWING_TO_IRON_PACK')!.confirmedQty > 0)
const pendingPostRow = returnByType.get('CUTTING_TO_IRON_PACK')!
assert(pendingPostRow.declaredQty > 0 && pendingPostRow.confirmedQty === 0, '后道未最终确认前PPIC回货数必须保持0')
const ppicReturnConfirmMessage = assertGate('PPIC最终确认回货数量', () => confirmPostFinishingFactoryReturn({
  deliveryId: pendingPostRow.deliveries[0]!.deliveryId,
  firstCounts: pendingPostRow.deliveries[0]!.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
  actor: { actorId: transferTarget.ppicId, actorName: transferTarget.ppicName, roleName: 'PPIC' },
}), /回货最终确认只能由后道回货确认岗位/)
assert.equal(pendingPostRow.deliveries[0]!.status, '待后道确认')
record({
  step: '后道最终确认作为PPIC唯一回货事实',
  objectIds: returnRows.flatMap((row) => [row.assignment.assignmentId, ...row.deliveries.map((delivery) => delivery.deliveryId)]),
  before: { ppicRegisterRejected: ppicReturnRegisterMessage, pendingDeclaredQty: pendingPostRow.declaredQty, pendingConfirmedQty: pendingPostRow.confirmedQty },
  after: {
    independentConfirmedQty: returnByType.get('INDEPENDENT_SEWING')!.confirmedQty,
    sewingIronPackConfirmedQty: returnByType.get('SEWING_TO_IRON_PACK')!.confirmedQty,
    cuttingIronPackPendingConfirmedQty: pendingPostRow.confirmedQty,
    ppicConfirmRejected: ppicReturnConfirmMessage,
    source: 'POST_FINISHING_FINAL_CONFIRMATION',
  },
  assertions: ['PPIC不得手填回货登记或最终确认', '仅后道最终确认版本进入PPIC回货投影', '登记未确认数量不计回货'],
})

const independentPolicy = classifyTaskFulfillmentPolicy({ processCode: 'SEW', processBusinessCode: 'SEW', processNameZh: '车缝', taskUnitType: 'PROCESS_TASK', assignmentGranularity: 'SKU' })
const sewingIronPolicy = classifyTaskFulfillmentPolicy({ processCode: 'SEWING_IRON_PACK', processNameZh: '车缝＋烫包', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'SEWING_IRON_PACK' })
const cuttingIronPolicy = classifyTaskFulfillmentPolicy({ processCode: 'CUTTING_SEWING_IRON_PACK', processNameZh: '裁剪＋车缝＋烫包', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'CUTTING_SEWING_IRON_PACK' })
assert.deepEqual(independentPolicy.milestones.map((item) => [item.ratio, item.naturalDay]), [[0.3, 4], [0.7, 8], [1, 9]])
assert.deepEqual(sewingIronPolicy.milestones.map((item) => [item.ratio, item.naturalDay]), [[0.3, 5], [0.7, 9], [1, 10]])
assert.deepEqual(cuttingIronPolicy.milestones.map((item) => [item.ratio, item.naturalDay]), [[0.3, 6], [0.7, 9], [1, 12]])
record({
  step: '三类任务30%/70%/100%回货时效',
  objectIds: ['SEWING_ONLY', 'SEWING_TO_IRON_PACK', 'CUTTING_TO_IRON_PACK'],
  after: { independentSewing: [4, 8, 9], sewingIronPack: [5, 9, 10], cuttingSewingIronPack: [6, 9, 12], dayBasis: '分配当天为第1个自然日', deadlineTime: '23:59:59' },
  assertions: ['三类任务分别使用确认后的时效', '30%/70%/100%均有独立节点', '自然日起算和截止时刻由规则快照冻结'],
})

const submittedCutReturn = ensureSewingCutPieceReturnWorkflowDemo()
assert.equal(submittedCutReturn.status, 'APPROVED_WAITING_WAREHOUSE')
assert.equal(submittedCutReturn.events[0]?.eventType, 'PPIC_CREATED')
const warehousedCutReturn = receiveApprovedCutPieceReturnByWarehouse({
  commandId: 'CMD-PPIC-E2E-CUT-RETURN-WAREHOUSE', requestId: submittedCutReturn.requestId,
  actor: { actorId: 'CUT-WAREHOUSE-E2E-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' },
  receivedAt: '2026-09-01 10:20:00',
})
assert.equal(warehousedCutReturn.status, 'WAREHOUSED')
assert(warehousedCutReturn.legacyReturnCaseId && warehousedCutReturn.legacyReturnOrderNo)
record({
  step: 'PPIC根据线下申请创建裁片退仓、裁床仓只接收入仓',
  objectIds: [warehousedCutReturn.requestId, warehousedCutReturn.legacyReturnCaseId, warehousedCutReturn.legacyReturnOrderNo],
  before: { status: submittedCutReturn.status, returnedGarmentQty: submittedCutReturn.returnedGarmentQty, createdBy: submittedCutReturn.createdBy },
  after: { status: warehousedCutReturn.status, warehouseReceivedBy: warehousedCutReturn.warehouseReceivedBy, returnedGarmentQty: warehousedCutReturn.returnedGarmentQty },
  assertions: ['PPIC线下收到工厂申请后建单并核对部位与数量', '三方工厂不在系统发起退仓', '待交出仓仅接收并入仓或反馈接收异常'],
})

const responsibilityVersions = listSewingReturnResponsibilityVersions(assignment.assignmentId)
assert(responsibilityVersions.length >= 1)
assert.equal(responsibilityVersions.at(-1)?.totalResponsibilityQty, 400)
assert(responsibilityVersions.every((version, index) => index === 0 || version.totalResponsibilityQty >= responsibilityVersions[index - 1]!.totalResponsibilityQty), '成衣回货责任必须单调不回退')

const receipt = {
  schemaVersion: 1,
  passName,
  scope: '车缝外发协同（PPIC）全流程数据操作',
  result: 'PASS',
  stepCount: steps.length,
  fixedBusinessTime: '2026-09-01 16:00:00',
  steps,
}
mkdirSync(evidenceDir, { recursive: true })
const receiptPath = path.join(evidenceDir, 'full-flow-data-receipt.json')
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
console.log(`车缝外发协同（PPIC）全流程数据操作检查通过：${steps.length}步；收据 ${receiptPath}`)
