import assert from 'node:assert/strict'

import {
  createEffectiveTaskAssignment,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import { getFactoryActivePpicSnapshot } from '../src/data/fcs/factory-master-store.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { resetSewingTaskResponsibilityTransfersForTests } from '../src/data/fcs/sewing-outsourcing-responsibility.ts'
import {
  cancelSewingCutPiecePartExclusion,
  createSewingCutPiecePartExclusion,
  getSewingCutPiecePartExclusionEligibility,
  getSewingCutPieceResponsibilityProjection,
  initializeSewingCutPieceResponsibility,
  listSewingCutPieceHandoverEvents,
  listSewingCutPiecePartExclusionVersions,
  listSewingReturnResponsibilityVersions,
  recordSewingCutPieceHandover,
  resetSewingCutPieceResponsibilityForTests,
} from '../src/data/fcs/sewing-cut-piece-responsibility.ts'

resetEffectiveTaskAssignmentsForTests()
resetSewingTaskResponsibilityTransfersForTests()
resetSewingCutPieceResponsibilityForTests()

const factoryId = 'ID-F021'
const ppic = getFactoryActivePpicSnapshot(factoryId)
assert(ppic, '测试车缝工厂必须有唯一有效PPIC')

function createAssignment(input: { assignmentId: string; taskId: string; skuCode: string; qty: number }) {
  return createEffectiveTaskAssignment({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.taskId,
    productionOrderId: `PO-${input.taskId}`,
    productionOrderNo: `PO-${input.taskId}`,
    taskNo: input.taskId,
    factoryId,
    factoryName: 'PPIC裁片责任测试车缝厂',
    source: 'DIRECT_DISPATCH',
    assignedQty: input.qty,
    skuLines: [{ skuCode: input.skuCode, color: 'Black', size: 'M', qty: input.qty }],
    processCodes: ['SEW'],
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-09-01 09:00:00',
    operatedAt: '2026-09-01 09:00:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
}

const assignment = createAssignment({
  assignmentId: 'ASG-CUT-RESP-001',
  taskId: 'TASK-CUT-RESP-001',
  skuCode: 'SKU-BLACK-M',
  qty: 1000,
})

initializeSewingCutPieceResponsibility({
  assignmentId: assignment.assignmentId,
  requirementSnapshotId: 'TECHPACK-CUT-PARTS-V3',
  requirementSnapshotAt: '2026-09-01 09:05:00',
  requirementSnapshotBy: '系统按分配冻结',
  requirementLines: [
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'BACK', partName: '后片', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'SLEEVE', partName: '袖片', piecesPerGarment: 2, allocatedGarmentQty: 1000 },
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'POCKET', partName: '口袋', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
  ],
})

const firstHandover = recordSewingCutPieceHandover({
  commandId: 'CMD-HAND-001',
  assignmentId: assignment.assignmentId,
  handoverRecordId: 'HO-REC-001',
  handoverRecordNo: 'JCR-001',
  dispatchBatchId: 'BATCH-001',
  handedOverAt: '2026-09-01 10:00:00',
  handedOverBy: '裁床待交出仓 张三',
  lines: [
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'FRONT', pieceQty: 1000 },
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'BACK', pieceQty: 1000 },
    { skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'SLEEVE', pieceQty: 2000 },
  ],
})
assert.equal(
  recordSewingCutPieceHandover({
    commandId: 'CMD-HAND-001',
    assignmentId: assignment.assignmentId,
    handoverRecordId: 'HO-REC-001',
    handoverRecordNo: 'JCR-001',
    dispatchBatchId: 'BATCH-001',
    handedOverAt: '2026-09-01 10:00:00',
    handedOverBy: '裁床待交出仓 张三',
    lines: [{ skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'FRONT', pieceQty: 1000 }],
  }).handoverEventId,
  firstHandover.handoverEventId,
  '重复命令必须幂等返回原交出，不得重复累加',
)

let projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.strictCompleteKitQty, 0, '完整缺一个必需部位时严格齐套必须为0')
assert.equal(projection.effectiveCompleteKitQty, 0)
assert.equal(projection.returnResponsibilityQty, 0)
const pocketDebt = projection.lines.find((line) => line.partCode === 'POCKET')
assert(pocketDebt)
assert.equal(pocketDebt.handedOverPieceQty, 0)
assert.equal(pocketDebt.debtPieceQty, 1000)
assert.equal(pocketDebt.shortageShape, 'ENTIRE_PART_MISSING')
assert.equal(getSewingCutPiecePartExclusionEligibility(pocketDebt).eligible, true, '整个部位未交必须允许当前任务PPIC判断是否排除')
assert.equal(projection.structuralMissingLineCount, 1)
const sleeve = projection.lines.find((line) => line.partCode === 'SLEEVE')
assert.equal(sleeve?.piecesPerGarment, 2)
assert.equal(sleeve?.debtPieceQty, 0, '每件2片必须按2000片需求换算')

const exclusion = createSewingCutPiecePartExclusion({
  commandId: 'CMD-EXC-001',
  assignmentId: assignment.assignmentId,
  skuCode: 'SKU-BLACK-M',
  color: 'Black',
  size: 'M',
  partCode: 'POCKET',
  reason: '裁床尚未完成整批口袋裁片，为避免主体裁片等待，PPIC暂时排除该部位计算有效齐套。',
  evidenceUrls: ['/cut-piece-release-risk-detail.svg'],
  productionImpact: '主体可先车缝，口袋后补。',
  createdAt: '2026-09-01 10:10:00',
  createdByPpicId: ppic.ppicId,
})
assert.equal(exclusion.createdByPpicName, ppic.ppicName)

projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.strictCompleteKitQty, 0, '排除不能篡改严格齐套')
assert.equal(projection.effectiveCompleteKitQty, 1000)
assert.equal(projection.returnResponsibilityQty, 1000)
assert.equal(projection.totalDebtPieceQty, 1000, '排除不能删除欠片')
assert.equal(projection.lines.find((line) => line.partCode === 'POCKET')?.excludedFromEffectiveKit, true)
assert.equal(listSewingReturnResponsibilityVersions(assignment.assignmentId).length, 1)
assert.equal(listSewingReturnResponsibilityVersions(assignment.assignmentId)[0]?.sourceKind, 'PART_EXCLUSION')

recordSewingCutPieceHandover({
  commandId: 'CMD-HAND-002',
  assignmentId: assignment.assignmentId,
  handoverRecordId: 'HO-REC-002',
  handoverRecordNo: 'JCR-002',
  dispatchBatchId: 'BATCH-002',
  handedOverAt: '2026-09-02 09:00:00',
  handedOverBy: '裁床待交出仓 李四',
  lines: [{ skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'POCKET', pieceQty: 1000 }],
})
projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.strictCompleteKitQty, 1000)
assert.equal(projection.effectiveCompleteKitQty, 1000)
assert.equal(projection.totalDebtPieceQty, 0)
assert.equal(projection.returnResponsibilityQty, 1000, '补交只消减欠片，不能把回货责任重复增加到2000')
assert.equal(listSewingReturnResponsibilityVersions(assignment.assignmentId).length, 1, '责任未增加时不制造重复版本')

const cancelledExclusion = cancelSewingCutPiecePartExclusion({
  commandId: 'CMD-CANCEL-EXC-001',
  exclusionVersionId: exclusion.exclusionVersionId,
  reason: '裁床已完成口袋补交，恢复该部位参与当前有效齐套计算。',
  cancelledAt: '2026-09-02 09:05:00',
  cancelledByPpicId: ppic.ppicId,
})
assert.equal(cancelledExclusion.status, 'CANCELLED')
projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.activeExclusionCount, 0)
assert.equal(projection.returnResponsibilityQty, 1000, '取消排除不得回退已经冻结的工厂回货责任')
assert.equal(listSewingReturnResponsibilityVersions(assignment.assignmentId).length, 1, '取消排除不制造责任回退版本')

recordSewingCutPieceHandover({
  commandId: 'CMD-HAND-003',
  assignmentId: assignment.assignmentId,
  handoverRecordId: 'HO-REC-003',
  handoverRecordNo: 'JCR-003',
  dispatchBatchId: 'BATCH-003',
  handedOverAt: '2026-09-02 09:10:00',
  handedOverBy: '裁床待交出仓 李四',
  lines: [{ skuCode: 'SKU-BLACK-M', color: 'Black', size: 'M', partCode: 'FRONT', pieceQty: 200 }],
})
projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.lines.find((line) => line.partCode === 'FRONT')?.overPieceQty, 200)
assert.equal(projection.lines.find((line) => line.partCode === 'POCKET')?.overPieceQty, 0, '前片多交不能抵消其他部位')

const minorAssignment = createAssignment({
  assignmentId: 'ASG-CUT-RESP-MINOR-001',
  taskId: 'TASK-CUT-RESP-MINOR-001',
  skuCode: 'SKU-MINOR-M',
  qty: 1000,
})
initializeSewingCutPieceResponsibility({
  assignmentId: minorAssignment.assignmentId,
  requirementSnapshotId: 'TECHPACK-CUT-PARTS-MINOR-V1',
  requirementSnapshotAt: '2026-09-01 11:00:00',
  requirementSnapshotBy: '系统按分配冻结',
  requirementLines: [
    { skuCode: 'SKU-MINOR-M', color: 'Black', size: 'M', partCode: 'BODY', partName: '衣身', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
    { skuCode: 'SKU-MINOR-M', color: 'Black', size: 'M', partCode: 'LACE', partName: '花边', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
  ],
})
const beforeMinorHandover = getSewingCutPieceResponsibilityProjection(minorAssignment.assignmentId)
assert.equal(beforeMinorHandover.structuralMissingLineCount, 0, '尚未交出时不得把所有未交部位统计成结构性欠片')
assert.equal(
  getSewingCutPiecePartExclusionEligibility(beforeMinorHandover.lines[0]!, false).eligible,
  false,
  '尚未形成确认交出时不能人为排除部位',
)
assert.throws(
  () => createSewingCutPiecePartExclusion({
    commandId: 'CMD-EXC-BEFORE-HANDOVER-001',
    assignmentId: minorAssignment.assignmentId,
    skuCode: 'SKU-MINOR-M',
    color: 'Black',
    size: 'M',
    partCode: 'LACE',
    reason: '交出前不得排除。',
    createdAt: '2026-09-01 11:05:00',
    createdByPpicId: ppic.ppicId,
  }),
  /尚未形成确认交出/,
)
recordSewingCutPieceHandover({
  commandId: 'CMD-HAND-MINOR-001',
  assignmentId: minorAssignment.assignmentId,
  handoverRecordId: 'HO-REC-MINOR-001',
  handoverRecordNo: 'JCR-MINOR-001',
  dispatchBatchId: 'BATCH-MINOR-001',
  handedOverAt: '2026-09-01 11:10:00',
  handedOverBy: '裁床待交出仓 王五',
  lines: [
    { skuCode: 'SKU-MINOR-M', color: 'Black', size: 'M', partCode: 'BODY', pieceQty: 1000 },
    { skuCode: 'SKU-MINOR-M', color: 'Black', size: 'M', partCode: 'LACE', pieceQty: 600 },
  ],
})
const minorProjection = getSewingCutPieceResponsibilityProjection(minorAssignment.assignmentId)
assert.equal(minorProjection.strictCompleteKitQty, 600)
assert.equal(minorProjection.totalDebtPieceQty, 400)
assert.equal(minorProjection.structuralMissingLineCount, 0)
assert.equal(minorProjection.lines.find((line) => line.partCode === 'LACE')?.shortageShape, 'PARTIAL_SHORTAGE', '不足需求量一半的局部缺口保留明细，不得误判成整部位或半数缺失')
assert.equal(getSewingCutPieceResponsibilityProjection(assignment.assignmentId).returnResponsibilityQty, 1000, '不同执行任务不得串账')
assert.equal(getSewingCutPiecePartExclusionEligibility(minorProjection.lines.find((line) => line.partCode === 'BODY')!).eligible, false)
assert.match(getSewingCutPiecePartExclusionEligibility(minorProjection.lines.find((line) => line.partCode === 'BODY')!).reason, /没有欠片/)
assert.throws(
  () => createSewingCutPiecePartExclusion({
    commandId: 'CMD-EXC-MINOR-001',
    assignmentId: minorAssignment.assignmentId,
    skuCode: 'SKU-MINOR-M',
    color: 'Black',
    size: 'M',
    partCode: 'LACE',
    reason: '局部欠片未达到一半时不允许排除。',
    createdAt: '2026-09-01 11:21:00',
    createdByPpicId: ppic.ppicId,
  }),
  /局部欠片未达到一半/,
)

const halfAssignment = createAssignment({
  assignmentId: 'ASG-CUT-RESP-HALF-001',
  taskId: 'TASK-CUT-RESP-HALF-001',
  skuCode: 'SKU-HALF-M',
  qty: 1000,
})
initializeSewingCutPieceResponsibility({
  assignmentId: halfAssignment.assignmentId,
  requirementSnapshotId: 'TECHPACK-CUT-PARTS-HALF-V1',
  requirementSnapshotAt: '2026-09-01 12:00:00',
  requirementSnapshotBy: '系统按分配冻结',
  requirementLines: [
    { skuCode: 'SKU-HALF-M', color: 'Black', size: 'M', partCode: 'BODY', partName: '衣身', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
    { skuCode: 'SKU-HALF-M', color: 'Black', size: 'M', partCode: 'COLLAR', partName: '领片', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
  ],
})
recordSewingCutPieceHandover({
  commandId: 'CMD-HAND-HALF-001',
  assignmentId: halfAssignment.assignmentId,
  handoverRecordId: 'HO-REC-HALF-001',
  handoverRecordNo: 'JCR-HALF-001',
  dispatchBatchId: 'BATCH-HALF-001',
  handedOverAt: '2026-09-01 12:10:00',
  handedOverBy: '裁床待交出仓 王五',
  lines: [
    { skuCode: 'SKU-HALF-M', color: 'Black', size: 'M', partCode: 'BODY', pieceQty: 1000 },
    { skuCode: 'SKU-HALF-M', color: 'Black', size: 'M', partCode: 'COLLAR', pieceQty: 500 },
  ],
})
const halfLine = getSewingCutPieceResponsibilityProjection(halfAssignment.assignmentId).lines.find((line) => line.partCode === 'COLLAR')!
assert.equal(halfLine.shortageShape, 'AT_LEAST_HALF_MISSING')
assert.equal(getSewingCutPiecePartExclusionEligibility(halfLine).eligible, true, '欠片达到应交数量一半时允许PPIC判断是否排除')
assert.equal(getSewingCutPieceResponsibilityProjection(halfAssignment.assignmentId).structuralMissingLineCount, 1, '缺口达到一半应计入排除核对阈值统计')

assert.equal(listSewingCutPieceHandoverEvents(assignment.assignmentId).length, 3)
assert.equal(listSewingCutPiecePartExclusionVersions(assignment.assignmentId).length, 1)

console.log('车缝外发裁片交出、欠片、严格/有效齐套、部位排除与单调回货责任专项检查通过')
