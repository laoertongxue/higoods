import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  completeSupplementOrder,
  getSupplementOrder,
  registerSupplementOrder,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'
import {
  getCutPieceReturnCase,
  listCutPieceReturnInitiationCandidates,
} from '../src/data/fcs/cutting/cut-piece-return-domain.ts'
import { getFactoryActivePpicSnapshot } from '../src/data/fcs/factory-master-store.ts'
import {
  ensureSewingOutsourcingSupplementDemo,
  listSewingSupplementTrackingRows,
  recordSewingSupplementFollowUp,
  SEWING_SUPPLEMENT_DEMO_ORDER_ID,
} from '../src/data/fcs/sewing-outsourcing-supplement-tracking.ts'
import {
  createSewingCutPieceReturnRequestByPpic,
  ensureSewingCutPieceReturnPageDemo,
  ensureSewingCutPieceReturnWorkflowDemo,
  receiveApprovedCutPieceReturnByWarehouse,
  reconfirmSewingCutPieceReturnByPpic,
  resetSewingCutPieceReturnWorkflowForTests,
} from '../src/data/fcs/sewing-cut-piece-return-workflow.ts'

const supplementRow = ensureSewingOutsourcingSupplementDemo()
const supplementRows = listSewingSupplementTrackingRows().filter((item) => item.hasConfirmedHandover && item.totalDebtPieceQty > 0)
assert.ok(supplementRows.length >= 3, '补料跟进必须有足够Mock覆盖三个欠片衔接状态')
assert.ok(supplementRows.every((item) => item.hasConfirmedHandover && item.totalDebtPieceQty > 0), '补料跟进列表只允许出现已确认交出后当前仍欠片的任务')
assert.ok(listSewingSupplementTrackingRows().some((item) => !item.hasConfirmedHandover), '必须保留未交出任务供工作台跟进裁床，但不得混入补料列表')
assert.deepEqual(
  [...new Set(supplementRows.map((item) => item.availability))].sort(),
  ['NO_SUPPLEMENT_ORDER', 'CUTTING_PROCESSING', 'WAITING_CUTTING_HANDOVER'].sort(),
  '欠片任务必须覆盖尚无补料单、裁床处理中和补料完成待实际交出三态Mock',
)
assert.equal(supplementRow.structuralMissingLineCount, 1, '演示场景应是口袋整部位缺失，而不是只差零星裁片')
assert.equal(supplementRow.missingLines[0]?.partName, '口袋')
assert.equal(supplementRow.supplementOrders[0]?.id, SEWING_SUPPLEMENT_DEMO_ORDER_ID)
assert.equal(supplementRow.availability, 'CUTTING_PROCESSING', '补料单未完成时不能显示可交工厂')
assert.equal(supplementRow.canHandToFactory, false)
assert.equal(supplementRow.followUpLogs.length, 4, '跟进次数不能被硬编码为最多三次')
assert.equal(supplementRow.followUpLogs.slice(0, 3).length, 3, '页面可重点展示最近三次')

const demoOrder = getSupplementOrder(SEWING_SUPPLEMENT_DEMO_ORDER_ID)!
assert.throws(
  () => registerSupplementOrder({ ...demoOrder, id: 'SUP-PPIC-FORBIDDEN', recordNo: 'BL-PPIC-FORBIDDEN' }, 'PPIC'),
  /只能由裁床发起和推进/,
)
assert.equal(getSupplementOrder('SUP-PPIC-FORBIDDEN'), undefined, 'PPIC越权创建不得留下补料单')
assert.throws(
  () => completeSupplementOrder({ id: demoOrder.id, completedAt: '2026-09-01 18:00:00', completedBy: '凌云', actorRole: 'PPIC_LEADER' }),
  /只能由裁床发起和推进/,
)
assert.equal(getSupplementOrder(demoOrder.id)?.status, '未完成', 'PPIC负责人也不能推进补料状态')

recordSewingSupplementFollowUp({
  commandId: 'CMD-SUP-FOLLOW-DEMO-005',
  assignmentId: supplementRow.assignmentId,
  ppicId: supplementRow.ppicId,
  result: '第五次跟进仍保留。',
  nextAction: '等待裁床实际交出裁片。',
  followedAt: '2026-09-02 09:00:00',
})
assert.equal(listSewingSupplementTrackingRows().find((item) => item.assignmentId === supplementRow.assignmentId)?.followUpLogs.length, 5)
assert.throws(() => recordSewingSupplementFollowUp({
  commandId: 'CMD-SUP-FOLLOW-WRONG-PPIC',
  assignmentId: supplementRow.assignmentId,
  ppicId: 'PPIC-OTHER',
  result: '越权',
  nextAction: '无',
  followedAt: '2026-09-02 09:10:00',
}), /当前任务PPIC/)

ensureSewingCutPieceReturnWorkflowDemo()
const pageHistoryDemo = ensureSewingCutPieceReturnPageDemo()
assert.equal(pageHistoryDemo.status, 'WAREHOUSED', 'PPIC退仓页应保留一条已入仓历史，同时释放责任范围供新增演示')
assert.equal(pageHistoryDemo.returnReasonCode, 'TASK_QTY_REDUCED')
assert.equal(pageHistoryDemo.responsibilityAdjustmentQty, 10)
assert.equal(pageHistoryDemo.expectedReturnQtyAfter, pageHistoryDemo.expectedReturnQtyBefore - 10)
assert.equal(getCutPieceReturnCase(pageHistoryDemo.legacyReturnCaseId)?.receipts[0]?.responsibilityAdjustmentGarmentQty, 10, '正式调减原因应在仓库入仓后按核定数量调整回货责任')
assert.ok(listCutPieceReturnInitiationCandidates().some((item) => item.eligible), '历史入仓后仍有剩余裁片责任时应允许PPIC继续建单')
resetSewingCutPieceReturnWorkflowForTests()
const candidate = listCutPieceReturnInitiationCandidates().find((item) => item.eligible)
assert.ok(candidate, '必须存在有正式裁片交出责任的退仓来源')
const ppic = getFactoryActivePpicSnapshot(candidate!.sourceFactoryId)
assert.ok(ppic, '候选车缝工厂必须有有效PPIC')
const partCounts = candidate!.parts.map((part) => ({
  partCode: part.partCode,
  sourceCutOrderId: part.sourceCutOrderId,
  pieceQty: Math.min(10 * part.piecesPerGarment, part.currentReturnablePieceQty),
  identificationMode: 'MANUAL_PART_SELECTION' as const,
  physicalTicketStatus: 'MISSING' as const,
}))
assert.throws(() => createSewingCutPieceReturnRequestByPpic({
  commandId: 'CMD-WRONG-PPIC-RETURN-CREATE-001',
  candidateId: candidate!.candidateId,
  returnedGarmentQty: 10,
  returnReasonCode: 'EXCESS_OR_WRONG_PIECES',
  returnReasonDetail: '多交裁片退回。',
  responsibilityAdjustmentQty: 0,
  partCounts,
  offlineRequestNote: '线下申请。',
  actor: { actorId: 'PPIC-OTHER', actorName: '其他PPIC', role: 'PPIC' },
  createdAt: '2026-09-01 09:10:00',
}), /当前PPIC/, '非任务PPIC不得代建退仓申请')
assert.throws(() => createSewingCutPieceReturnRequestByPpic({
  commandId: 'CMD-IMPACT-WITHOUT-REFERENCE-001',
  candidateId: candidate!.candidateId,
  returnedGarmentQty: 10,
  returnReasonCode: 'TASK_QTY_REDUCED',
  returnReasonDetail: '任务数量正式调减。',
  responsibilityAdjustmentQty: 10,
  partCounts,
  offlineRequestNote: '线下申请。',
  actor: { actorId: ppic!.ppicId, actorName: ppic!.ppicName, role: 'PPIC' },
  createdAt: '2026-09-01 09:15:00',
}), /必须填写已确认的调整依据号/, '影响回货责任的原因没有正式依据时必须阻断')
const request = createSewingCutPieceReturnRequestByPpic({
  commandId: 'CMD-PPIC-RETURN-CREATE-001',
  candidateId: candidate!.candidateId,
  returnedGarmentQty: 10,
  returnReasonCode: 'EXCESS_OR_WRONG_PIECES',
  returnReasonDetail: '裁片交出时多配了前片和后片，工厂未投入生产并原样退回。',
  responsibilityAdjustmentQty: 0,
  partCounts,
  offlineRequestNote: 'PPIC线下收到车缝工厂退仓申请，并已核对实物部位和数量。',
  actor: { actorId: ppic!.ppicId, actorName: ppic!.ppicName, role: 'PPIC' },
  createdAt: '2026-09-01 09:20:00',
})
assert.equal(request.status, 'APPROVED_WAITING_WAREHOUSE')
assert.equal(request.events[0]?.eventType, 'PPIC_CREATED')
assert.equal(request.partCounts.length, partCounts.length)
assert.equal(request.expectedReturnQtyAfter, request.expectedReturnQtyBefore, '多交／错发裁片退回不得减少工厂回货责任')

const exception = receiveApprovedCutPieceReturnByWarehouse({
  commandId: 'CMD-WAREHOUSE-EXCEPTION-001',
  requestId: request.requestId,
  actor: { actorId: 'WAREHOUSE-001', actorName: '裁床待交出仓', role: 'WAREHOUSE' },
  receivedAt: '2026-09-01 10:30:00',
  exceptionNote: '包装破损，暂不入仓。',
})
assert.equal(exception.status, 'WAREHOUSE_EXCEPTION')
assert.deepEqual(exception.partCounts, request.partCounts, '仓库异常不得修改PPIC建单数量')

assert.throws(() => reconfirmSewingCutPieceReturnByPpic({
  commandId: 'CMD-WRONG-PPIC-RECONFIRM-001',
  requestId: request.requestId,
  note: '越权处理。',
  actor: { actorId: 'PPIC-OTHER', actorName: '其他PPIC', role: 'PPIC' },
  reconfirmedAt: '2026-09-01 10:35:00',
}), /当前PPIC/)
const reconfirmed = reconfirmSewingCutPieceReturnByPpic({
  commandId: 'CMD-PPIC-RECONFIRM-001',
  requestId: request.requestId,
  note: '包装已更换，原建单部位和数量继续有效。',
  actor: { actorId: request.ppicId, actorName: request.ppicName, role: 'PPIC' },
  reconfirmedAt: '2026-09-01 10:40:00',
})
assert.equal(reconfirmed.status, 'APPROVED_WAITING_WAREHOUSE')

const warehoused = receiveApprovedCutPieceReturnByWarehouse({
  commandId: 'CMD-WAREHOUSE-RECEIVE-001',
  requestId: request.requestId,
  actor: { actorId: 'WAREHOUSE-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' },
  receivedAt: '2026-09-01 11:00:00',
})
assert.equal(warehoused.status, 'WAREHOUSED')
assert.ok(warehoused.legacyReturnCaseId)
const receipt = getCutPieceReturnCase(warehoused.legacyReturnCaseId)?.receipts[0]
assert.equal(receipt?.confirmedBy, '裁床待交出仓 王敏', '仓库仅记录接收入仓人')
assert.equal(receipt?.responsibilityAdjustmentGarmentQty, 0, '不影响责任的实物退仓必须以0件责任调整入账')
assert.equal(getCutPieceReturnCase(warehoused.legacyReturnCaseId)?.responsibility.currentExpectedReturnQty, request.expectedReturnQtyBefore, '实物已入仓不等于工厂回货责任减少')
assert.ok(receipt?.partCounts.every((item) => item.identifiedBy === request.createdBy), '裁片部位识别责任必须保留为建单PPIC')
const replay = receiveApprovedCutPieceReturnByWarehouse({
  commandId: 'CMD-WAREHOUSE-RECEIVE-001',
  requestId: request.requestId,
  actor: { actorId: 'WAREHOUSE-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' },
  receivedAt: '2026-09-01 11:00:00',
})
assert.equal(replay.legacyReturnCaseId, warehoused.legacyReturnCaseId, '重复接收入仓必须幂等')

const ppicPage = readFileSync('src/pages/sewing-outsourcing/cut-piece-returns.ts', 'utf8')
const supplementPage = readFileSync('src/pages/sewing-outsourcing/supplements.ts', 'utf8')
const warehousePage = readFileSync('src/pages/process-factory/cutting/cut-piece-return-warehouse.ts', 'utf8')
const renderers = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
assert.ok(ppicPage.includes('data-ppic-return-action="create"'))
assert.ok(ppicPage.includes('操作角色：任务PPIC'))
assert.ok(ppicPage.includes('createSewingCutPieceReturnRequestByPpic'))
assert.ok(ppicPage.includes('退仓原因'))
assert.ok(ppicPage.includes('实物退仓折算件数'))
assert.ok(ppicPage.includes('回货责任调整数量'))
assert.ok(ppicPage.includes('正式调整依据号'))
assert.ok(ppicPage.includes('statusTabsHtml: renderUiTabs({'))
assert.ok(ppicPage.includes('filtersHtml: renderStandardListFilters({'))
assert.ok(!ppicPage.includes('statsHtml:'), '裁片退仓不得重复展示统计卡片')
assert.ok(!ppicPage.includes('操作角色：三方车缝工厂'))
assert.ok(supplementPage.includes('PPIC只写协同日志，不修改补料单状态'))
assert.ok(supplementPage.includes("filter((item) => item.hasConfirmedHandover && item.totalDebtPieceQty > 0)"))
assert.ok(!supplementPage.includes("READY_TO_HANDOVER"), '补料完成但尚未实际交出时不能显示为可交工厂')
assert.ok(!supplementPage.includes('创建补料单</button>'))
assert.ok(warehousePage.includes('待交出仓只做接收和入仓'))
assert.ok(warehousePage.includes('仓库不可修改'))
assert.ok(!warehousePage.includes('新增退仓'))
assert.ok(!warehousePage.includes('data-cut-piece-return-warehouse-field="approvedGarmentQty"'))
assert.ok(renderers.includes("import('../pages/process-factory/cutting/cut-piece-return-warehouse')"), '旧裁床退仓页不得继续作为可达路由')

console.log('PPIC补料只读跟进、PPIC线下收申请后建退仓单与仓库只接收入仓契约检查通过')
