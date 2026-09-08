// PROD-003 / EXEC-012: actual wool processing, cutting receipt and joint sewing handover.
import assert from 'node:assert/strict'
import { resolveActionBagCurrent } from '../src/pages/process-factory/cutting/wait-handover-actions.ts'
import { cancelEffectiveTaskAssignment } from '../src/data/fcs/effective-task-assignments.ts'
import { captureRuntimeDirectDispatchState, restoreRuntimeDirectDispatchState } from '../src/data/fcs/runtime-process-tasks.ts'
import { appendWaitHandoverBaggingEvent, appendWaitHandoverInboundEvent, buildWaitHandoverRuntimeTicketFromGeneratedTicket } from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
import { resolveTransferBagCurrentUse, submitWholeBagHandover } from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import { listCuttingRuntimeEvents } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
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

const ledgerRecords = new Map<string, string>()
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => ledgerRecords.get(key) ?? null, setItem: (key: string, value: string) => { ledgerRecords.set(key, value) }, removeItem: (key: string) => { ledgerRecords.delete(key) } } } })

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

const operator = { operatorName: '裁床仓管', operatorRole: '裁片仓交出员' }
const bagCode = 'BAG-WOOL-CURRENT-001'
const physicalTickets = [ticket, panel].map(buildWaitHandoverRuntimeTicketFromGeneratedTicket)
appendWaitHandoverBaggingEvent({ source: 'WEB', operator, bagCode, tickets: physicalTickets, occurredAt: '2026-09-01 09:20:00' })
appendWaitHandoverInboundEvent({ source: 'WEB', operator, bagCode, warehouseArea: '待交出 A 区', locationCode: 'A-01', occurredAt: '2026-09-01 09:30:00' })
const mapped = resolveActionBagCurrent(bagCode)
assert(mapped.tickets.every((item) => item.sewingTaskId === assignment.runtimeTaskId), '实际交出下拉从唯一正式有效分配读取任务')
const duplicateAssignment = createEffectiveTaskAssignment({ ...assignment, runtimeTaskId: 'TASK-WOOL-AMBIGUOUS-INPUT', assignmentId: 'ASG-WOOL-AMBIGUOUS', businessAssignedAt: assignment.operatedAt, allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId, allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName })
assert(resolveActionBagCurrent(bagCode).tickets.every((item) => !item.sewingTaskId), '同完整SKU多条有效分配时不得猜测任务')
cancelEffectiveTaskAssignment(duplicateAssignment.assignmentId, '完成歧义阻断验收', assignment.operatedBy, assignment.operatedAt)
const current = resolveTransferBagCurrentUse(bagCode)
const assignments = physicalTickets.map((item) => ({ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, sewingTaskId: runtimeSewingTask.taskId, sewingTaskNo: runtimeSewingTask.taskNo || runtimeSewingTask.taskId, receiverFactoryId: sewingFactory.id, receiverFactoryName: sewingFactory.name }))
const submittedTicketSnapshot = current.tickets.map((item) => ({ ...item, ...assignments.find((row) => row.feiTicketId === item.feiTicketId)! }))
const input = { bagCode, usageCycleId: current.usageCycleId!, handoverOrderId: 'HO-WOOL-CURRENT', handoverOrderNo: 'HO-WOOL-CURRENT', handoverRecordId: 'HR-WOOL-CURRENT', handoverRecordNo: 'HR-WOOL-CURRENT', assignments, submittedTicketSnapshot, operator, source: 'WEB' as const, occurredAt: '2026-09-01 10:00:00' }
assert.notEqual(getRuntimeTaskById(runtimeSewingTask.taskId)?.status, 'IN_PROGRESS', '夹具必须从未开工任务开始')
assert(submittedTicketSnapshot.filter((item) => item.feiTicketNo.startsWith('WOOL-PANEL:')).every((item) => !item.cutOrderId && !item.cutOrderNo), '同袋毛织票不得继承首张布料票裁剪字段')
for (const forged of [{ pieceQty: 7 }, { partCode: 'OTHER-PART' }, { cutOrderId: ticket.cutOrderId }]) {
  const beforeForgery = JSON.stringify(listCuttingRuntimeEvents())
  assert.throws(() => submitWholeBagHandover({ ...input, submittedTicketSnapshot: submittedTicketSnapshot.map((item) => item.feiTicketNo === panelNo ? { ...item, ...forged } : item) }), /毛织片票|快照|裁片|数量|不一致/)
  assert.equal(JSON.stringify(listCuttingRuntimeEvents()), beforeForgery, '伪毛织票不能产生事件')
}
const event = submitWholeBagHandover(input)
assert.equal(getRuntimeTaskById(runtimeSewingTask.taskId)?.status, 'IN_PROGRESS', 'EXEC-012 当前现场整袋交出必须自动开工')
const receipts = event.payload.automaticSewingReceipts
assert.equal(receipts?.length, 1)
assert.equal(receipts[0].receivedPieceQty, ticketPieceQty + 6)
assert.equal(receipts[0].runtimeTaskId, runtimeSewingTask.taskId)
assert.equal(receipts[0].receivedAt, input.occurredAt)
const before = JSON.stringify({ events: listCuttingRuntimeEvents(), task: getRuntimeTaskById(runtimeSewingTask.taskId), wool: readWoolStore() })
assert.equal(submitWholeBagHandover(input).eventId, event.eventId)
assert.equal(JSON.stringify({ events: listCuttingRuntimeEvents(), task: getRuntimeTaskById(runtimeSewingTask.taskId), wool: readWoolStore() }), before, '当前现场重复提交不能增加事件、数量或开工日志')
assert.equal(getRuntimeTaskById(runtimeSewingTask.taskId)?.status, 'IN_PROGRESS', '交出不能代替人工完成')
console.log('PROD-003 / EXEC-012 current whole-bag entry: wool 6 + cloth ' + ticketPieceQty + ' received once; IN_PROGRESS; repeat stable')

// An already completed task is fixture input for the negative gate, not a simulated completion result.
const doneState = captureRuntimeDirectDispatchState()
const oldOverride = doneState.taskOverrides.find(([id]) => id === runtimeSewingTask.taskId)?.[1] || {}
doneState.taskOverrides = doneState.taskOverrides.filter(([id]) => id !== runtimeSewingTask.taskId)
doneState.taskOverrides.push([runtimeSewingTask.taskId, { ...oldOverride, status: 'DONE', finishedAt: '2026-09-01 11:00:00' }])
restoreRuntimeDirectDispatchState(doneState)
assert.equal(submitWholeBagHandover(input).eventId, event.eventId, '已完工后的原成功事件重试仍幂等')
const blockedBag = 'BAG-DONE-NEGATIVE'
appendWaitHandoverBaggingEvent({ source: 'WEB', operator, bagCode: blockedBag, tickets: physicalTickets, occurredAt: '2026-09-01 12:00:00' })
appendWaitHandoverInboundEvent({ source: 'WEB', operator, bagCode: blockedBag, warehouseArea: '待交出 A 区', locationCode: 'A-02', occurredAt: '2026-09-01 12:01:00' })
const blockedCurrent = resolveTransferBagCurrentUse(blockedBag)
const newInput = { ...input, bagCode: blockedBag, usageCycleId: blockedCurrent.usageCycleId!, handoverRecordId: 'HR-DONE-REJECT', handoverRecordNo: 'HR-DONE-REJECT', occurredAt: '2026-09-01 12:02:00' }
const beforeRejected = JSON.stringify(listCuttingRuntimeEvents())
assert.throws(() => submitWholeBagHandover(newInput), /当前不能接收本生产单裁片/)
assert.equal(JSON.stringify(listCuttingRuntimeEvents()), beforeRejected, 'DONE新交出拒绝必须零写')
console.log('Latest unique full-SKU assignment; ambiguous assignment blocked; DONE rejects new events but permits successful retry')
