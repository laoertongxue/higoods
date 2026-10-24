import { buildInspectionSnapshotFromConfigurations } from '../src/data/fcs/quality-management-records.ts'
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
  const localOrder=productionOrders.filter(order=>order.techPackSnapshot?.bomItems.some(bom=>bom.type==='面料'||bom.type==='辅料') && order.demandSnapshot.skuLines.length)[input.processCodes.includes('CUTTING')?2:input.processCodes.includes('IRON_PACK')?1:0]!
  const localSku=localOrder.demandSnapshot.skuLines[0]!
  return createEffectiveTaskAssignment({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: localOrder.productionOrderId,
    productionOrderNo: localOrder.productionOrderNo,
    taskNo: `NO-${input.runtimeTaskId}`,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 20,
    skuLines: [{ skuCode: localSku.skuCode, color: localSku.color, size: localSku.size, qty: 20 }],
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

const snapshot=buildInspectionSnapshotFromConfigurations({sourceKind:'PRE_PRODUCTION_SAMPLE'})
assert.equal(getSewingSampleApprovalRecord(independent.assignmentId)!.sample.status,'WAITING_PPIC_RECEIVE')
assert.throws(()=>receivePreProductionSampleByPpic({commandId:'NO-PHOTO',assignmentId:independent.assignmentId,actor:ppicActor,receivedSamplePhotoUrls:[],receivedAt:'2026-10-16T08:00:00Z'}),/实物照片/)
receivePreProductionSampleByPpic({commandId:'RECEIVE-ONE',assignmentId:independent.assignmentId,actor:ppicActor,receivedSamplePhotoUrls:['/shirt-sample.jpg','/shirt-sample.jpg?detail=1'],receivedAt:'2026-10-16T08:00:00Z'})
handoffPreProductionSampleToApprover({commandId:'HANDOFF-ONE',assignmentId:independent.assignmentId,actor:ppicActor,approverTeamName:'批版组',handedAt:'2026-10-16T08:10:00Z'})
startSampleApproval({commandId:'START-ONE',assignmentId:independent.assignmentId,actor:approverActor,receivedAt:'2026-10-16T08:15:00Z',inspectionStandardSnapshot:snapshot})
assert.throws(()=>submitSampleApprovalSuggestion({commandId:'ISSUE-MISSING',assignmentId:independent.assignmentId,actor:approverActor,conclusion:'HAS_PROBLEM',uploadedAt:'2026-10-16T09:00:00Z'}),/具体标准项目/)
const firstSuggestion=submitSampleApprovalSuggestion({commandId:'SUGGESTION-ONE',assignmentId:independent.assignmentId,actor:approverActor,conclusion:'HAS_PROBLEM',issues:[{itemId:snapshot.items[0].id,note:'核对尺寸有偏差'}],structuredComments:{processComment:'侧缝顺直'},approvalSheetPhotoUrls:[],uploadedAt:'2026-10-16T09:00:00Z'})
assert.equal(firstSuggestion.issues!.length,1)
const finished=recordSampleApprovalFeedbackToFactory({commandId:'FEEDBACK-ONE',assignmentId:independent.assignmentId,actor:ppicActor,feedbackAt:'2026-10-16T10:00:00Z',feedbackNote:'已截图反馈工厂'})
assert.equal(finished.sample.status,'FEEDBACK_SENT')
assert.equal(finished.suggestionVersions.length,1)
assert.equal(finished.sample.roundNo,undefined)
assert.equal(finished.sample.ppicReceivedSamplePhotoUrls.length,2)
assert.throws(()=>startSampleApproval({commandId:'RESTART',assignmentId:independent.assignmentId,actor:approverActor,inspectionStandardSnapshot:snapshot}),/尚未由PPIC转交/)

assert.equal(listSewingMaterialHandoverContexts().length, 3, '三类车缝任务均建立适用物料交出账，前两类只含辅料')
for (const assignmentId of [independent.assignmentId, sewingIronPack.assignmentId]) {
  assert.equal(
    getSewingMaterialHandoverProjection(assignmentId).lines.every((line) => line.materialType === '辅料'),
    true,
    '独立车缝与车缝+烫包只能领取车缝辅料，不能把面料带入交出账',
  )
}
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

console.log('三类车缝外发产前版样衣、批版建议、适用物料交出与PCS首单样衣边界检查通过')
