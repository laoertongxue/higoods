import assert from 'node:assert/strict'

import {
  createCuttingSewingDispatchBatch,
  createCuttingSewingDispatchOrder,
  createCuttingSewingTransferBags,
  ensureCuttingSewingDispatchSeeded,
  listAvailableFeiTicketsForSewingDispatch,
  scanFeiTicketIntoTransferBag,
  submitCuttingSewingDispatchBatch,
  validateDispatchBatchCompleteness,
} from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { createEffectiveTaskAssignment, resetEffectiveTaskAssignmentsForTests } from '../src/data/fcs/effective-task-assignments.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import { getFactoryActivePpicSnapshot } from '../src/data/fcs/factory-master-store.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import {
  getSewingCutPieceResponsibilityProjection,
  listSewingCutPieceHandoverEvents,
  resetSewingCutPieceResponsibilityForTests,
} from '../src/data/fcs/sewing-cut-piece-responsibility.ts'

ensureCuttingSewingDispatchSeeded()
resetEffectiveTaskAssignmentsForTests()
resetSewingCutPieceResponsibilityForTests()

const ticket = listAvailableFeiTicketsForSewingDispatch().find((item) => {
  const order = productionOrders.find((candidate) => candidate.productionOrderId === item.productionOrderId)
  const snapshot = getProductionOrderTechPackSnapshot(item.productionOrderId)
  return Boolean(
    order?.demandSnapshot.skuLines.some((line) => line.color === item.garmentColor && line.size === item.skuSize)
    && snapshot?.cutPieceParts.some((part) => (
      part.partCode
      && part.partNameCn === item.partName
      && part.pieceCountPerGarment > 0
      && (!part.applicableSizeList.length || part.applicableSizeList.includes(item.skuSize))
      && (!part.applicableColorList.length || part.applicableColorList.includes(item.garmentColor) || part.applicableColorList.includes('按 SKU 适配'))
    )),
  )
})
assert(ticket, '测试必须找到仍在裁床待交出仓、且具备技术包裁片部位的菲票')

const productionOrder = productionOrders.find((item) => item.productionOrderId === ticket.productionOrderId)!
const techPackSnapshot = getProductionOrderTechPackSnapshot(ticket.productionOrderId)!
const skuLine = productionOrder.demandSnapshot.skuLines.find((line) => (
  line.color === ticket.garmentColor && line.size === ticket.skuSize
))!
const ticketPart = techPackSnapshot.cutPieceParts.find((part) => part.partNameCn === ticket.partName)!
const ticketPieceQty = Math.max(ticket.qty || ticket.actualCutPieceQty || 1, 1)
const assignmentQty = Math.ceil(ticketPieceQty / ticketPart.pieceCountPerGarment)
assert.ok(assignmentQty <= skuLine.qty, '测试菲票换算件数不得超过生产单SKU数量')
const sewingFactory = mockFactories.find((factory) => factory.id === 'ID-F021')
assert(sewingFactory, '测试三方车缝工厂必须存在')
const factoryPpic = getFactoryActivePpicSnapshot(sewingFactory.id)
assert(factoryPpic, '测试三方车缝工厂必须具备唯一有效PPIC')

assert.throws(
  () => createCuttingSewingDispatchOrder({ productionOrderId: productionOrder.productionOrderId }),
  /必须绑定已分配的车缝执行任务/,
  '新裁片交出单不得脱离车缝执行任务单独创建',
)

const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-CUT-DISPATCH-LEDGER-LINK-001',
  runtimeTaskId: 'TASK-CUT-DISPATCH-LEDGER-LINK-001',
  productionOrderId: productionOrder.productionOrderId,
  productionOrderNo: productionOrder.productionOrderNo,
  taskNo: 'SEW-CUT-DISPATCH-LEDGER-LINK-001',
  factoryId: sewingFactory.id,
  factoryName: sewingFactory.name,
  source: 'DIRECT_DISPATCH',
  assignedQty: assignmentQty,
  skuLines: [{ skuCode: skuLine.skuCode, color: skuLine.color, size: skuLine.size, qty: assignmentQty }],
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

const dispatchOrder = createCuttingSewingDispatchOrder({
  productionOrderId: productionOrder.productionOrderId,
  sewingFactoryId: sewingFactory.id,
  executionAssignmentId: assignment.assignmentId,
})
assert.equal(dispatchOrder.executionAssignmentId, assignment.assignmentId)
assert.equal(dispatchOrder.runtimeTaskId, assignment.runtimeTaskId)
assert.equal(dispatchOrder.ppicId, factoryPpic.ppicId)
assert.equal(dispatchOrder.ppicName, factoryPpic.ppicName)
assert.equal(dispatchOrder.totalProductionQty, assignmentQty, '任务交出总量必须采用该执行任务分配量，而非整张生产单数量')

const batch = createCuttingSewingDispatchBatch({
  dispatchOrderId: dispatchOrder.dispatchOrderId,
  plannedSkuQtyLines: [{
    colorName: skuLine.color,
    colorCode: skuLine.color,
    sizeCode: skuLine.size,
    plannedGarmentQty: assignmentQty,
  }],
})
assert.equal(batch.plannedSkuQtyLines[0]?.skuCode, skuLine.skuCode, '交出批次必须绑定完整SKU')
assert.throws(
  () => createCuttingSewingDispatchBatch({
    dispatchOrderId: dispatchOrder.dispatchOrderId,
    plannedSkuQtyLines: [{
      colorName: skuLine.color,
      colorCode: skuLine.color,
      sizeCode: skuLine.size,
      plannedGarmentQty: 1,
    }],
  }),
  new RegExp(`累计裁片交出计划不能超过任务分配${assignmentQty}件`),
  '同一执行任务的累计裁片交出计划不得超过已分配数量',
)

const [bag] = createCuttingSewingTransferBags({
  dispatchBatchId: batch.dispatchBatchId,
  bagPlanList: [{ plannedGarmentQty: assignmentQty, skuQtyLines: batch.plannedSkuQtyLines }],
})
assert(bag)
scanFeiTicketIntoTransferBag({ transferBagId: bag.transferBagId, feiTicketNo: ticket.feiTicketNo })
validateDispatchBatchCompleteness(batch.dispatchBatchId)
const submitted = submitCuttingSewingDispatchBatch({
  dispatchBatchId: batch.dispatchBatchId,
  operatorName: '裁床待交出仓 王敏',
  submittedAt: '2026-09-01 10:00:00',
})

const handoverEvents = listSewingCutPieceHandoverEvents(assignment.assignmentId)
assert.equal(handoverEvents.length, 1, '裁床确认交出后必须进入绑定执行任务的裁片责任账')
assert.equal(handoverEvents[0]?.dispatchBatchId, batch.dispatchBatchId)
assert.equal(handoverEvents[0]?.handoverRecordId, submitted.handoverRecord.handoverRecordId || submitted.handoverRecord.recordId)
assert.ok(handoverEvents[0]?.lines.every((line) => line.skuCode === skuLine.skuCode), '责任账必须保存完整SKU而非颜色尺码拼接值')
assert.ok(handoverEvents[0]?.lines.every((line) => Boolean(line.partCode)), '责任账必须保存技术包部位编码')

const projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
assert.equal(projection.context.runtimeTaskId, assignment.runtimeTaskId)
assert.equal(projection.context.factoryId, sewingFactory.id)
assert.equal(projection.context.ppicId, factoryPpic.ppicId)
assert.ok(projection.totalHandedOverPieceQty > 0)
assert.ok(projection.lines.length > handoverEvents[0]!.lines.length, '未及时裁出的完整部位必须以0片保留在冻结责任账中')

submitCuttingSewingDispatchBatch({
  dispatchBatchId: batch.dispatchBatchId,
  operatorName: '裁床待交出仓 王敏',
  submittedAt: '2026-09-01 10:00:00',
})
assert.equal(listSewingCutPieceHandoverEvents(assignment.assignmentId).length, 1, '重复提交不得重复累加裁片责任')

console.log('裁床交出批次绑定车缝执行任务、工厂、PPIC与裁片责任账专项检查通过')
