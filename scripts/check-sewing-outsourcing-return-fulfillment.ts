import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, getOnboardingPpicOptionById } from '../src/data/fcs/factory-onboarding-ppic.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  correctPostFinishingFactoryReturnConfirmation,
  listPostFinishingReturnConfirmationVersions,
  resetPostFinishingFullFlow,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import { resetEffectiveTaskAssignmentsForTests } from '../src/data/fcs/effective-task-assignments.ts'
import {
  listSewingReturnResponsibilityVersions,
  resetSewingCutPieceResponsibilityForTests,
} from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import {
  projectProductionReturnFulfillment,
  resetProductionReturnSnapshotSequenceForTests,
} from '../src/data/fcs/production-return-fulfillment.ts'
import {
  listSewingDeliveryReceiptFacts,
  toConfirmedSewingDeliveryReceiptFact,
} from '../src/data/fcs/sewing-delivery-receipt-facts.ts'
import {
  listSewingOutsourcingReturnTrackingRows,
} from '../src/data/fcs/sewing-outsourcing-return-tracking.ts'
import { renderSewingOutsourcingReturnsPage } from '../src/pages/sewing-outsourcing/returns.ts'

resetPostFinishingFullFlow()
resetSewingCutPieceResponsibilityForTests()
resetProductionReturnSnapshotSequenceForTests()
resetEffectiveTaskAssignmentsForTests()

const rows = listSewingOutsourcingReturnTrackingRows('2026-09-01 12:00:00')
assert.deepEqual(rows.map((row) => row.taskType), [
  'INDEPENDENT_SEWING',
  'SEWING_TO_IRON_PACK',
  'CUTTING_TO_IRON_PACK',
])
assert.deepEqual(rows.map((row) => row.returnProjection.snapshot.milestones.map((node) => node.naturalDay)), [
  [4, 9],
  [5, 10],
  [6, 12],
])
assert.equal(rows[0]!.returnProjection.snapshot.milestones[0]!.deadlineAt, '2026-08-23 23:59:59')
assert.equal(rows[1]!.returnProjection.snapshot.milestones[0]!.deadlineAt, '2026-08-29 23:59:59')
assert.equal(rows[2]!.returnProjection.snapshot.milestones[0]!.deadlineAt, '2026-09-01 23:59:59')

// 工厂登记是申报，只有后道最终确认计入正式回货。
assert.equal(rows[0]!.declaredQty, 200)
assert.equal(rows[0]!.confirmedQty, 198)
assert.equal(rows[2]!.declaredQty, 300)
assert.equal(rows[2]!.confirmedQty, 0)
assert.equal(listSewingDeliveryReceiptFacts(rows[0]!.assignment.runtimeTaskId, '2026-09-01 12:00:00')[0]?.receivedQty, 198)
assert.equal(listSewingDeliveryReceiptFacts(rows[2]!.assignment.runtimeTaskId, '2026-09-01 12:00:00').length, 0)
assert.equal(toConfirmedSewingDeliveryReceiptFact({
  recordId: 'PDA-LOCAL-001',
  handoverRecordId: 'PDA-LOCAL-001',
  taskId: rows[2]!.assignment.runtimeTaskId,
  submittedQty: 300,
  plannedQty: 300,
  factorySubmittedAt: '2026-09-01 09:00:00',
  receiverWrittenQty: 300,
  receiverWrittenAt: '2026-09-01 10:00:00',
  handoverRecordStatus: 'WRITTEN_BACK_MATCHED',
} as never, rows[2]!.assignment.runtimeTaskId), null)
assert.equal(listSewingDeliveryReceiptFacts(rows[1]!.assignment.runtimeTaskId).every((fact) => !fact.recordId.includes(rows[0]!.assignment.runtimeTaskId)), true)

// 已确认正式应回依据替代旧分配/工厂归责分母，原分配500保持事实。
assert.equal(rows[0]!.assignment.assignedQty, 500)
assert.equal(rows[0]!.quantityBasis.expectedQty, 200)
const firstComplete = rows[0]!.returnProjection.milestones[1]!
assert.equal(rows[0]!.returnProjection.milestones[0]!.targetQty, 70)
assert.equal(firstComplete.targetQty, 200)
assert.equal(firstComplete.attributableTargetQty, 200)
assert.equal(firstComplete.confirmedQtyByDeadline, 198)
assert.equal(firstComplete.factoryPendingQty, 2)
assert.equal(firstComplete.cuttingShortfallQty, 0)
assert.equal(firstComplete.status, 'OVERDUE')
assert.equal(rows[2]!.returnProjection.milestones.every((node) => node.cuttingShortfallQty === 0), true)

// 节点截止后才新增的裁片责任，不能倒改原节点归责。
const originalResponsibility = listSewingReturnResponsibilityVersions(rows[0]!.assignment.assignmentId)
const frozenProjection = projectProductionReturnFulfillment({
  snapshot: rows[0]!.returnProjection.snapshot,
  receipts: rows[0]!.confirmationVersions.filter((version) => version.status === 'ACTIVE').map((version) => ({
    receiptId: version.confirmationVersionId,
    assignmentId: version.assignmentId,
    factoryId: version.factoryId,
    confirmedQty: version.confirmedQty,
    confirmedDate: version.confirmedAt.slice(0, 10),
    confirmedAt: version.confirmedAt,
    confirmed: true,
  })),
  today: '2026-09-01',
  nowAt: '2026-09-01 12:00:00',
  usesCutPieceResponsibility: true,
  responsibilityVersions: [
    ...originalResponsibility,
    {
      responsibilityVersionId: 'RET-RESP-LATE-TEST',
      assignmentId: rows[0]!.assignment.assignmentId,
      totalResponsibilityQty: 500,
      createdAt: '2026-08-30 09:00:00',
    },
  ],
})
assert.equal(frozenProjection.milestones[1]!.attributableTargetQty, 200)
assert.equal(frozenProjection.milestones[0]!.attributableTargetQty, 70)

// 后道主管订正生成新版本；保留原业务确认时间，不用订正时间伪造履约迟到。
const firstDelivery = rows[0]!.deliveries[0]!
correctPostFinishingFactoryReturnConfirmation({
  deliveryId: firstDelivery.deliveryId,
  correctedCounts: firstDelivery.lines.map((line, index) => ({
    skuId: line.sku.skuId,
    actualQty: index === firstDelivery.lines.length - 1 ? 39 : 40,
  })),
  correctionReason: '后道复核发现少计 1 件',
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnSupervisor,
  nowMs: Date.parse('2026-08-24T09:00:00Z'),
})
const correctedVersions = listPostFinishingReturnConfirmationVersions({ deliveryId: firstDelivery.deliveryId })
assert.equal(correctedVersions.length, 2)
assert.deepEqual(correctedVersions.map((version) => version.status), ['SUPERSEDED', 'ACTIVE'])
assert.equal(correctedVersions[1]!.confirmedQty, 199)
assert.equal(correctedVersions[1]!.confirmedAt, correctedVersions[0]!.confirmedAt)
assert.equal(correctedVersions[1]!.versionCreatedAt.startsWith('2026-08-24'), true)
assert.equal(listSewingDeliveryReceiptFacts(rows[0]!.assignment.runtimeTaskId, '2026-09-01 12:00:00')[0]?.receivedQty, 199)

// 定向页面场景用当前到期的第三方任务负责人，不能绕过新的读取隔离。
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-01T05:00:00Z') })
Object.assign(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, getOnboardingPpicOptionById(rows[2]!.ppicId)!)
const page = renderSewingOutsourcingReturnsPage()
assert(page.includes('正式数据源：后道最终确认'))
assert(page.includes('后道回货源'))
assert(page.includes('裁床待补'))
assert(!page.includes('data-ppic-return-track-action="create"'))
assert(!page.includes('只读后道最终确认'))
assert(!page.includes('不允许 PPIC 手填回货'))
mock.timers.reset()

console.log('check-sewing-outsourcing-return-fulfillment: ok')
