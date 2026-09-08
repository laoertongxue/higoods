// PROD-003 / EXEC-012: actual wool processing, cutting receipt and joint sewing handover.
import assert from 'node:assert/strict'
import { readWoolStore, replaceWoolStore, addWoolYarnReceipt, addWoolProcessReport, addWoolHandover, confirmWoolDownstreamReceipt } from '../src/data/fcs/wool-task-domain.ts'

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
  getRuntimeTaskById,
  isRuntimeIndependentSewingTask,
  listRuntimeTasksByOrder,
} from '../src/data/fcs/runtime-process-tasks.ts'
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
    ))
    && listRuntimeTasksByOrder(item.productionOrderId).some(isRuntimeIndependentSewingTask),
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
const runtimeSewingTask = listRuntimeTasksByOrder(productionOrder.productionOrderId)
  .find(isRuntimeIndependentSewingTask)
assert(runtimeSewingTask, '测试生产单必须存在正式独立车缝运行任务')
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

// Fixture contains a legitimate WOOL pattern part; no spreading/cutting fact is created for it.
const woolPartCode = 'PROD003-COLLAR'
const woolPartName = '验收毛织领片'
const patternTemplate = techPackSnapshot.patternFiles.find((file) => file.pieceRows.length)!
assert(patternTemplate)
techPackSnapshot.patternFiles.push({ ...structuredClone(patternTemplate), id: 'PATTERN-PROD003-WOOL', patternMaterialType: 'WOOL', pieceRows: [{ ...structuredClone(patternTemplate.pieceRows[0]), id: woolPartCode, partTemplateId: woolPartCode, partTemplateName: woolPartName, name: woolPartName, count: 1, applicableSkuCodes: [skuLine.skuCode], colorAllocations: [{ colorName: skuLine.color, skuCodes: [skuLine.skuCode], pieceCount: 1 }] }] })
productionOrder.techPackSnapshot = techPackSnapshot
const woolStore = readWoolStore()
const woolTemplate = Object.values(woolStore.workOrders).find((order) => order.kind === 'PART_PANEL')!
assert(woolTemplate)
const woolOrder = { ...structuredClone(woolTemplate), woolOrderId: 'WO-PROD003-ATOMIC', woolOrderNo: 'WO-PROD003-ATOMIC', styleNo: productionOrder.demandSnapshot.spuCode, styleName: productionOrder.demandSnapshot.spuName, styleImageUrl: '', productionOrderId: productionOrder.productionOrderId, productionOrderNo: productionOrder.productionOrderNo, taskId: 'WOOL-PROD003-ATOMIC', kind: 'PART_PANEL' as const, downstreamTarget: { receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' as const, receiverId: 'CUTTING-WAIT-HANDOVER', receiverName: '裁床待交出仓' }, outputPlanLines: [{ ...structuredClone(woolTemplate.outputPlanLines[0]), outputSkuCode: 'WP-PROD003-COLLAR', outputObjectType: 'WOOL_PANEL' as const, garmentSkuCode: skuLine.skuCode, woolPartCode, woolPartName, colorName: skuLine.color, colorCode: skuLine.color, sizeCode: skuLine.size, plannedQty: assignmentQty, requiredYarnSkus: ['YARN-PROD003'] }] }
woolStore.workOrders[woolOrder.woolOrderId] = woolOrder
replaceWoolStore(woolStore)
addWoolYarnReceipt(woolOrder.woolOrderId, { commandId: 'PROD003-YARN', receivedAt: '2026-09-01 08:00:00', receivedBy: '毛织仓管', lines: [{ yarnSkuCode: 'YARN-PROD003', receivedQty: 10 }] })
addWoolProcessReport(woolOrder.woolOrderId, { commandId: 'PROD003-REPORT', outputSkuCode: woolOrder.outputPlanLines[0].outputSkuCode, reportedQty: 7, reportedAt: '2026-09-01 08:10:00', reportedBy: '毛织主管' })
const woolHandover = addWoolHandover(woolOrder.woolOrderId, { commandId: 'PROD003-HANDOVER', outputSkuCode: woolOrder.outputPlanLines[0].outputSkuCode, handoverQty: 7, handedOverAt: '2026-09-01 08:20:00', handedOverBy: '毛织仓管' })
const panelNo = `WOOL-PANEL:${woolHandover.handoverId}`
assert(!listAvailableFeiTicketsForSewingDispatch().some((item) => item.feiTicketNo === panelNo), '未实际接收的毛织片不得可交车缝')
confirmWoolDownstreamReceipt(woolHandover.handoverId, { commandId: 'PROD003-RECEIVE', actualReceivedQty: 6, receivedAt: '2026-09-01 08:30:00', receivedBy: '裁床仓管' })
// A whole garment with an actual downstream receipt must never become a cutting source.
const wholeStore = readWoolStore()
const wholeOrder = { ...structuredClone(woolOrder), woolOrderId: 'WO-PROD003-WHOLE', taskId: 'WOOL-PROD003-WHOLE', kind: 'WHOLE_GARMENT' as const, downstreamTarget: { receiverType: 'DOWNSTREAM_FACTORY' as const, receiverId: 'ID-F021', receiverName: '后道工厂' }, outputPlanLines: woolOrder.outputPlanLines.map((line) => ({ ...line, outputSkuCode: 'GARMENT-PROD003', outputObjectType: 'GARMENT' as const })) }
wholeStore.workOrders[wholeOrder.woolOrderId] = wholeOrder
replaceWoolStore(wholeStore)
addWoolYarnReceipt(wholeOrder.woolOrderId, { commandId: 'PROD003-WHOLE-YARN', receivedAt: '2026-09-01 08:00:00', receivedBy: '毛织仓管', lines: [{ yarnSkuCode: 'YARN-PROD003', receivedQty: 10 }] })
addWoolProcessReport(wholeOrder.woolOrderId, { commandId: 'PROD003-WHOLE-REPORT', outputSkuCode: 'GARMENT-PROD003', reportedQty: 4, reportedAt: '2026-09-01 08:10:00', reportedBy: '毛织主管' })
const wholeHandover = addWoolHandover(wholeOrder.woolOrderId, { commandId: 'PROD003-WHOLE-HANDOVER', outputSkuCode: 'GARMENT-PROD003', handoverQty: 4, handedOverAt: '2026-09-01 08:20:00', handedOverBy: '毛织仓管' })
confirmWoolDownstreamReceipt(wholeHandover.handoverId, { commandId: 'PROD003-WHOLE-RECEIVE', actualReceivedQty: 4, receivedAt: '2026-09-01 08:30:00', receivedBy: '后道仓管' })
assert(!listAvailableFeiTicketsForSewingDispatch().some((item) => item.feiTicketNo === `WOOL-PANEL:${wholeHandover.handoverId}`), '整件毛织不得误入裁床')
const woolBeforeDispatch = JSON.stringify(readWoolStore())
const panel = listAvailableFeiTicketsForSewingDispatch().find((item) => item.feiTicketNo === panelNo)
assert(panel, 'PROD-003: 已实收毛织片必须进入裁床现有待交出对象来源')
assert.equal(panel.qty, 6, '毛织片按实收6片，不按交出7片')
assert.equal(panel.sourceBasisType, 'WOOL_PANEL_RECEIPT')
assert.equal(panel.sourceSpreadingSessionId, '', '不得伪造铺布发生')
assert.equal(panel.cutOrderId, '', '不得伪造裁剪单')
assert.equal(panel.actualCutPieceQty, 0, '毛织片不是实际裁剪产出')

const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-WOOL-CUT-JOINT-001',
  runtimeTaskId: runtimeSewingTask.taskId,
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
const woolScan = scanFeiTicketIntoTransferBag({ transferBagId: bag.transferBagId, feiTicketNo: panelNo })
assert.equal(woolScan.validationResult.blocking, false, '同一袋允许毛织领片与布料裁片共同交出')
assert(woolScan.updatedTransferBag.contentItems.some((item) => item.sourceNo === panelNo && item.contentType === '毛织片票'), '袋内保留毛织片身份，不伪装布料裁片')
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
assert.equal(submitted.handoverRecord.receiverWrittenQty, submitted.handoverRecord.submittedQty, '裁床交出必须在同一动作自动记为三方车缝工厂接收')
assert.equal(submitted.handoverRecord.combinedWritebackStatus, '已回写', '裁片自动接收后不得停留在待回写')
const startedTask = getRuntimeTaskById(runtimeSewingTask.taskId)
assert.equal(startedTask?.status, 'IN_PROGRESS', '裁片自动接收后车缝任务必须自动开工')
assert.equal(startedTask?.startedAt, '2026-09-01 10:00:00')
assert.equal(
  startedTask?.auditLogs.filter((log) => log.action === 'AUTO_RECEIVE_AND_START_FROM_CUT_PIECE_HANDOVER').length,
  1,
  '第一次裁片交出只能形成一条自动接收开工审计',
)

submitCuttingSewingDispatchBatch({
  dispatchBatchId: batch.dispatchBatchId,
  operatorName: '裁床待交出仓 王敏',
  submittedAt: '2026-09-01 10:00:00',
})
assert.equal(listSewingCutPieceHandoverEvents(assignment.assignmentId).length, 1, '重复提交不得重复累加裁片责任')
assert.equal(
  getRuntimeTaskById(runtimeSewingTask.taskId)?.auditLogs.filter((log) => log.action === 'AUTO_RECEIVE_AND_START_FROM_CUT_PIECE_HANDOVER').length,
  1,
  '重复提交不得重复记录自动开工',
)

assert.equal(submitted.handoverRecord.submittedQty, ticketPieceQty + 6)
assert(submitted.handoverRecord.cutPieceLines?.some((line) => line.piecePartCode === woolPartCode && line.pieceQty === 6))
assert(!listAvailableFeiTicketsForSewingDispatch().some((item) => item.feiTicketNo === panelNo), '交出后既有袋占用防止毛织片二次交出')
assert.equal(JSON.stringify(readWoolStore()), woolBeforeDispatch, '汇合送车缝不重复扣毛织源库存或创建第二毛织账')
console.log('PROD-003: 7片毛织交出→6片裁床实收→与布料裁片同袋交车缝并自动开工；重复幂等通过')
