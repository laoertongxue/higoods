import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  createEffectiveTaskAssignment,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import { getFactoryActivePpicSnapshot } from '../src/data/fcs/factory-master-store.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  getSewingMaterialHandoverProjection,
  listSewingMaterialHandoverContexts,
  recordSewingMaterialHandover,
} from '../src/data/fcs/sewing-material-handover.ts'
import {
  getSewingSampleApprovalRecord,
  handoffPreProductionSampleToApprover,
  listSewingSampleApprovalRecords,
  markPreProductionSampleFactoryCompleted,
  receivePreProductionSampleByPpic,
  recordSampleApprovalFeedbackToFactory,
  startSampleApproval,
  submitSampleApprovalSuggestion,
} from '../src/data/fcs/sewing-sample-approval-suggestion.ts'
import { getSewingCutPieceResponsibilityProjection } from '../src/data/fcs/sewing-cut-piece-responsibility.ts'

resetEffectiveTaskAssignmentsForTests()

const productionOrder = productionOrders.find((item) => (
  item.techPackSnapshot?.bomItems.some((bom) => bom.type === '面料' || bom.type === '辅料')
  && item.demandSnapshot.skuLines.length > 0
))
assert(productionOrder, '样衣与面辅料测试必须找到已冻结技术包且有面辅料BOM的生产单')
const sku = productionOrder.demandSnapshot.skuLines[0]!
const factory = mockFactories.find((item) => item.id === 'ID-F021')
assert(factory, '样衣测试三方车缝工厂必须存在')
const ppic = getFactoryActivePpicSnapshot(factory.id)
assert(ppic, '样衣测试三方车缝工厂必须有唯一有效PPIC')

function createAssignment(input: { assignmentId: string; runtimeTaskId: string; processCodes: string[] }) {
  return createEffectiveTaskAssignment({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    taskNo: `NO-${input.runtimeTaskId}`,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 20,
    skuLines: [{ skuCode: sku.skuCode, color: sku.color, size: sku.size, qty: 20 }],
    processCodes: input.processCodes,
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

const independent = createAssignment({
  assignmentId: 'ASG-SAMPLE-INDEPENDENT-001',
  runtimeTaskId: 'TASK-SAMPLE-INDEPENDENT-001',
  processCodes: ['SEW'],
})
const sewingIronPack = createAssignment({
  assignmentId: 'ASG-SAMPLE-SEW-IRON-001',
  runtimeTaskId: 'TASK-SAMPLE-SEW-IRON-001',
  processCodes: ['SEW', 'IRON_PACK'],
})
const cuttingSewingIronPack = createAssignment({
  assignmentId: 'ASG-SAMPLE-CUT-SEW-IRON-001',
  runtimeTaskId: 'TASK-SAMPLE-CUT-SEW-IRON-001',
  processCodes: ['CUTTING', 'SEW', 'IRON_PACK'],
})

assert.equal(listSewingSampleApprovalRecords().length, 3, '三类含车缝执行任务均应自动生成自己的产前版样衣与批版建议主记录')
assert.equal(getSewingSampleApprovalRecord(independent.assignmentId)?.sample.taskKind, 'INDEPENDENT_SEWING')
assert.equal(getSewingSampleApprovalRecord(sewingIronPack.assignmentId)?.sample.taskKind, 'SEWING_IRON_PACK')
assert.equal(getSewingSampleApprovalRecord(cuttingSewingIronPack.assignmentId)?.sample.taskKind, 'CUTTING_SEWING_IRON_PACK')
assert.equal(new Set(listSewingSampleApprovalRecords().map((item) => item.sample.sampleId)).size, 3, '不同执行任务／工厂分配的样衣身份不得混用')

const factoryActor = { actorId: factory.id, actorName: '三方车缝工厂样衣员', role: 'FACTORY' as const }
const ppicActor = { actorId: ppic.ppicId, actorName: ppic.ppicName, role: 'PPIC' as const }
const approverActor = { actorId: 'SAMPLE-APPROVER-001', actorName: '批版人员 林慧', role: 'SAMPLE_APPROVER' as const }

markPreProductionSampleFactoryCompleted({
  commandId: 'CMD-SAMPLE-FACTORY-001',
  assignmentId: independent.assignmentId,
  actor: factoryActor,
  samplePhotoUrls: ['/shirt-sample.jpg'],
  completedAt: '2026-09-01 10:00:00',
})
assert.throws(() => receivePreProductionSampleByPpic({
  commandId: 'CMD-SAMPLE-PPIC-RECEIVE-NO-PHOTO',
  assignmentId: independent.assignmentId,
  actor: ppicActor,
  receivedSamplePhotoUrls: [],
  receivedAt: '2026-09-01 10:50:00',
}), /必须上传本次实物照片/, 'PPIC不能不上传实物照片就确认收到样衣')
receivePreProductionSampleByPpic({
  commandId: 'CMD-SAMPLE-PPIC-RECEIVE-001',
  assignmentId: independent.assignmentId,
  actor: ppicActor,
  receivedSamplePhotoUrls: [
    '/shirt-sample-front.jpg',
    '/shirt-sample-side.jpg',
    '/shirt-sample-detail.jpg',
  ],
  receivedAt: '2026-09-01 11:00:00',
})
assert.deepEqual(
  getSewingSampleApprovalRecord(independent.assignmentId)?.sample.ppicReceivedSamplePhotoUrls,
  ['/shirt-sample-front.jpg', '/shirt-sample-side.jpg', '/shirt-sample-detail.jpg'],
  'PPIC一次选择的多张产前版样衣照片必须全部保存并保持顺序',
)
handoffPreProductionSampleToApprover({
  commandId: 'CMD-SAMPLE-HANDOFF-001',
  assignmentId: independent.assignmentId,
  actor: ppicActor,
  approverTeamName: '大货批版组',
  handedAt: '2026-09-01 11:10:00',
})
startSampleApproval({
  commandId: 'CMD-SAMPLE-START-001',
  assignmentId: independent.assignmentId,
  actor: approverActor,
})
assert.throws(
  () => submitSampleApprovalSuggestion({
    commandId: 'CMD-SAMPLE-PPIC-WRITE-001',
    assignmentId: independent.assignmentId,
    actor: ppicActor,
    conclusion: 'NO_PROBLEM',
    uploadedAt: '2026-09-01 11:20:00',
  }),
  /只有批版人员可以填写或上传批版建议/,
  'PPIC不得代替批版人员填写建议',
)
assert.throws(
  () => submitSampleApprovalSuggestion({
    commandId: 'CMD-SAMPLE-MISSING-ADVICE-001',
    assignmentId: independent.assignmentId,
    actor: approverActor,
    conclusion: 'HAS_PROBLEM',
    uploadedAt: '2026-09-01 11:20:00',
  }),
  /至少填写一项结构化意见/,
  '批版结论有问题时不能只给结论，必须按线下批版单至少填写一类意见',
)
const suggestion = submitSampleApprovalSuggestion({
  commandId: 'CMD-SAMPLE-SUGGESTION-001',
  assignmentId: independent.assignmentId,
  actor: approverActor,
  conclusion: 'HAS_PROBLEM',
  structuredComments: {
    fabricApprovalComment: '面料裁片必须按色组编号顺序配套。',
    processComment: '口袋位置按纸样上移1cm，侧缝顺直车缝。',
    materialUsageComment: '肩部用量偏小，缝制时不得强行拉伸。',
    otherComment: '后续大货按本次批版建议执行。',
  },
  approvalSheetPhotoUrls: ['/approval-sheet-front.jpg', '/approval-sheet-back.jpg'],
  uploadedAt: '2026-09-01 11:20:00',
})
assert.equal(getSewingSampleApprovalRecord(independent.assignmentId)?.sample.status, 'SUGGESTION_UPLOADED', '有问题只形成可反馈建议，不得自动进入整改或复审状态')
assert.deepEqual(suggestion.structuredComments, {
  fabricApprovalComment: '面料裁片必须按色组编号顺序配套。',
  processComment: '口袋位置按纸样上移1cm，侧缝顺直车缝。',
  materialUsageComment: '肩部用量偏小，缝制时不得强行拉伸。',
  otherComment: '后续大货按本次批版建议执行。',
}, '批版建议必须按线下四类意见结构化保存')
assert.deepEqual(
  suggestion.approvalSheetPhotoUrls,
  ['/approval-sheet-front.jpg', '/approval-sheet-back.jpg'],
  '线下批版建议单照片必须作为独立佐证附件保存，不能混入样衣照片',
)
assert.equal(suggestion.uploadedByName, approverActor.actorName, '批版人员必须由当前领取人自动记录')
assert.equal(suggestion.uploadedAt, '2026-09-01 11:20:00', '批版日期必须由本次提交时间自动记录')
assert.equal(suggestion.referenceSnapshots.some((item) => item.referenceType === 'PATTERN'), true, '建议版本必须冻结本次核对的纸样资料')
assert.equal(suggestion.referenceSnapshots.some((item) => item.referenceType === 'FABRIC' || item.referenceType === 'ACCESSORY'), true, '建议版本必须冻结面辅料核对依据')

const feedback = recordSampleApprovalFeedbackToFactory({
  commandId: 'CMD-SAMPLE-FEEDBACK-001',
  assignmentId: independent.assignmentId,
  actor: ppicActor,
  feedbackAt: '2026-09-01 11:30:00',
  feedbackNote: '已截图发送给承接工厂生产负责人。',
})
assert.equal(feedback.sample.status, 'FEEDBACK_SENT')
assert.equal(feedback.suggestionVersions[0]?.feedbackSentByPpicId, ppic.ppicId)

markPreProductionSampleFactoryCompleted({
  commandId: 'CMD-SAMPLE-FACTORY-002',
  assignmentId: sewingIronPack.assignmentId,
  actor: factoryActor,
  samplePhotoUrls: ['/jacket-sample.jpg'],
  completedAt: '2026-09-01 12:00:00',
})
receivePreProductionSampleByPpic({ commandId: 'CMD-SAMPLE-PPIC-RECEIVE-002', assignmentId: sewingIronPack.assignmentId, actor: ppicActor, receivedSamplePhotoUrls: ['/jacket-sample.jpg'], receivedAt: '2026-09-01 12:30:00' })
handoffPreProductionSampleToApprover({ commandId: 'CMD-SAMPLE-HANDOFF-002', assignmentId: sewingIronPack.assignmentId, actor: ppicActor, approverTeamName: '大货批版组', handedAt: '2026-09-01 12:40:00' })
startSampleApproval({ commandId: 'CMD-SAMPLE-START-002', assignmentId: sewingIronPack.assignmentId, actor: approverActor })
submitSampleApprovalSuggestion({
  commandId: 'CMD-SAMPLE-SUGGESTION-002',
  assignmentId: sewingIronPack.assignmentId,
  actor: approverActor,
  conclusion: 'NO_PROBLEM',
  requiresAnotherApproval: true,
  uploadedAt: '2026-09-01 13:00:00',
})
const explicitNextRound = recordSampleApprovalFeedbackToFactory({
  commandId: 'CMD-SAMPLE-FEEDBACK-002',
  assignmentId: sewingIronPack.assignmentId,
  actor: ppicActor,
  feedbackAt: '2026-09-01 13:10:00',
  feedbackNote: '批版人员明确要求再做一件后复核，已截图通知工厂。',
})
assert.equal(explicitNextRound.sample.roundNo, 2)
assert.equal(explicitNextRound.sample.status, 'WAITING_FACTORY_PRODUCTION', '只有批版人员明确要求再次批版时才进入下一轮')
assert.equal(explicitNextRound.suggestionVersions.length, 1, '进入下一轮不能覆盖历史建议')

assert.equal(listSewingMaterialHandoverContexts().length, 1, '只有裁剪+车缝+烫包建立面辅料交出账')
const materialProjection = getSewingMaterialHandoverProjection(cuttingSewingIronPack.assignmentId)
assert.equal(materialProjection.hasCutPieceRelease, false)
assert.equal(materialProjection.hasCutPieceDebt, false)
assert.equal(materialProjection.context.dataCompleteness, 'COMPLETE')
assert.ok(materialProjection.lines.length > 0)
assert.throws(
  () => getSewingCutPieceResponsibilityProjection(cuttingSewingIronPack.assignmentId),
  /尚未冻结必需裁片部位/,
  '裁剪+车缝+烫包不得生成裁片欠片对象',
)
const materialLine = materialProjection.lines[0]!
assert.throws(
  () => recordSewingMaterialHandover({
    commandId: 'CMD-MATERIAL-PPIC-001',
    assignmentId: cuttingSewingIronPack.assignmentId,
    sourceRecordId: 'MAT-SOURCE-001',
    sourceRecordNo: 'MLJL-001',
    handedOverAt: '2026-09-01 14:00:00',
    handedOverBy: ppic.ppicName,
    handedOverByRole: 'PPIC',
    lines: [{ requirementLineId: materialLine.requirementLineId, actualQty: materialLine.requiredQty }],
  }),
  /PPIC只能查看面辅料交出/,
)
const materialHandover = recordSewingMaterialHandover({
  commandId: 'CMD-MATERIAL-WAREHOUSE-001',
  assignmentId: cuttingSewingIronPack.assignmentId,
  sourceRecordId: 'MAT-SOURCE-001',
  sourceRecordNo: 'MLJL-001',
  handedOverAt: '2026-09-01 14:00:00',
  handedOverBy: '物料仓 陈敏',
  handedOverByRole: 'MATERIAL_WAREHOUSE',
  lines: [{ requirementLineId: materialLine.requirementLineId, actualQty: materialLine.requiredQty / 2 }],
})
assert.equal(recordSewingMaterialHandover({
  commandId: 'CMD-MATERIAL-WAREHOUSE-001',
  assignmentId: cuttingSewingIronPack.assignmentId,
  sourceRecordId: 'MAT-SOURCE-001',
  sourceRecordNo: 'MLJL-001',
  handedOverAt: '2026-09-01 14:00:00',
  handedOverBy: '物料仓 陈敏',
  handedOverByRole: 'MATERIAL_WAREHOUSE',
  lines: [{ requirementLineId: materialLine.requirementLineId, actualQty: materialLine.requiredQty / 2 }],
}).handoverEventId, materialHandover.handoverEventId, '重复面辅料交出命令不得重复累计')
assert.ok(getSewingMaterialHandoverProjection(cuttingSewingIronPack.assignmentId).lines[0]!.shortageQty > 0)

const pcsFiles = [
  'src/data/app-shell-config.ts',
  'src/data/pcs-engineering-dependency-policy.ts',
  'src/data/pcs-engineering-master-repository.ts',
  'src/data/pcs-engineering-master-view-model.ts',
  'src/data/pcs-engineering-task-review.ts',
  'src/data/pcs-engineering-tech-pack-workspace.ts',
  'src/data/pcs-tech-pack-review.ts',
  'src/pages/pcs-engineering-master-detail.ts',
  'src/pages/pcs-engineering-tasks.ts',
  'src/pages/pcs-engineering-tasks/first-sample-task.ts',
  'src/pages/pcs-engineering-tasks/shared.ts',
  'src/pages/production/preparation-timing.ts',
]
pcsFiles.forEach((file) => assert.doesNotMatch(readFileSync(file, 'utf8'), /产前版样衣/, `${file}的PCS用户可见名称必须收口为首单样衣`))
assert.match(readFileSync('src/data/app-shell-config.ts', 'utf8'), /首单样衣任务/)
assert.doesNotMatch(readFileSync('src/data/fcs/sewing-sample-approval-suggestion.ts', 'utf8'), /factory-sample-verification/, '外发产前版样衣不能复用工厂准入样衣对象')

console.log('三类车缝外发产前版样衣、批版建议、裁剪车缝烫包面辅料与PCS首单样衣边界检查通过')
