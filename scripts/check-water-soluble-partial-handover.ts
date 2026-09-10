import assert from 'node:assert/strict'
import * as water from '../src/data/fcs/water-soluble-task-domain.ts'
import * as handover from '../src/data/fcs/pda-handover-events.ts'
import * as pda from '../src/data/fcs/store-domain-pda.ts'

// EXEC-009/010/011：同单分批产出经唯一通用交接单承接，收货不自动完单。
water.resetWaterSolubleDomainForChecks()
const order = water.listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(order, '缺少可分配水溶样例')
water.assignWaterSolubleFactory(order.waterOrderId, 'F090')
assert.equal(water.receiveWaterSolubleInput(order.waterOrderId, { qty: 1, receiptId: 'RECEIVE-FIRST', upstreamRecordId: 'CHECK-SOURCE-FIRST' }).ok, true)
assert.equal(water.completeWaterSoluble(order.waterOrderId, 2).ok, false, '产出不可超过本单实际接收')
const user = pda.listFactoryPdaUsers('F090').find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_ADMIN')
assert(user, '缺少水溶交接管理员')
const actor = pda.createPdaSessionFromUser(user)
pda.setPdaSession(actor)
let headId: string | undefined

for (const [index, cumulativeOutput] of [1, order.plannedQty].entries()) {
  if (index === 1) {
    assert.equal(water.receiveWaterSolubleInput(order.waterOrderId, { qty: order.plannedQty - 1, receiptId: 'RECEIVE-SECOND', upstreamRecordId: 'CHECK-SOURCE-SECOND' }).ok, true)
    assert.equal(water.receiveWaterSolubleInput(order.waterOrderId, { qty: order.plannedQty - 1, receiptId: 'RECEIVE-SECOND', upstreamRecordId: 'CHECK-SOURCE-SECOND' }).ok, false, '重复接收不能累计')
  }
  const outputResult = water.completeWaterSoluble(order.waterOrderId, cumulativeOutput)
  assert.equal(outputResult.ok, true, outputResult.message)
  const ensured = handover.ensureHandoverOrderForStartedTask(order.taskId)
  if (headId) assert.equal(ensured.handoverOrderId, headId, '二批必须复用同一交接单')
  headId = ensured.handoverOrderId
  assert.notEqual(handover.getHandoverOrderById(headId)?.completionStatus, 'COMPLETED', '仍有可交数量不得关闭')
  const qty = index === 0 ? 1 : order.plannedQty - 1
  const record = handover.createFactoryHandoverRecord({
    handoverOrderId: headId,
    submittedQty: qty,
    qtyUnit: order.qtyUnit,
    factorySubmittedAt: `2026-09-07 10:0${index}:00`,
    factorySubmittedBy: '验收交接员',
    scanCode: order.materialCode,
    actor,
  })
  handover.writeBackHandoverRecord({
    handoverRecordId: record.handoverRecordId || record.recordId,
    receiverWrittenQty: qty,
    receiverWrittenAt: `2026-09-07 10:0${index}:30`,
    receiverWrittenBy: '验收接收员',
  })
  assert.equal(water.getWaterSolubleWorkOrderById(order.waterOrderId)?.status, index === 0 ? 'WATER_SOLUBLE_IN_PROGRESS' : 'WAIT_MANUAL_COMPLETION')
  if (index === 0) assert.notEqual(handover.getHandoverOrderById(headId)?.completionStatus, 'COMPLETED')
}

assert(headId)
const head = handover.getHandoverOrderById(headId)
assert(head)
assert.equal(head.recordCount, 2)
assert.equal(head.submittedQtyTotal, order.plannedQty)
assert.equal(head.writtenBackQtyTotal, order.plannedQty)
assert.equal(head.handoverOrderStatus, 'CLOSED', '两笔实收均确认后交接单正常关闭')
assert.equal(water.completeWaterSolubleWorkOrder(order.waterOrderId).order?.status, 'DONE')
pda.clearPdaSession()
console.log(JSON.stringify({ waterOrder: order.waterOrderNo, headId, records: head.recordCount, submitted: head.submittedQtyTotal, received: head.writtenBackQtyTotal, manualCompletion: 'DONE' }))

// 原交出记录分配给明确目标；不创建平行仓储账。
pda.setPdaSession(actor)
water.resetWaterSolubleDomainForChecks()
const split = water.listWaterSolubleWorkOrders().find(item => item.status === 'WAIT_FACTORY_ASSIGNMENT' && item.waterOrderId !== order.waterOrderId)!
water.assignWaterSolubleFactory(split.waterOrderId, 'F090')
water.receiveWaterSolubleInput(split.waterOrderId, { qty: 10, receiptId: 'INPUT-10', upstreamRecordId: 'CHECK-SOURCE-SPLIT' })
water.completeWaterSoluble(split.waterOrderId, 10)
const splitHead = handover.ensureHandoverOrderForStartedTask(split.taskId).handoverOrderId
const upstream = handover.createFactoryHandoverRecord({ handoverOrderId: splitHead, submittedQty: 10, qtyUnit: split.qtyUnit, factorySubmittedAt: '2026-09-07 10:00:00', factorySubmittedBy: '交接员', scanCode: split.materialCode, actor })
const receive = (receiptId: string, targetTaskOrderId: string, qty: number) => handover.receivePreparationHandoverForTask(upstream.recordId, { receiptId, targetTaskOrderId, qty, qtyUnit: split.qtyUnit, receiverName: '接收员', receivedAt: '2026-09-07 10:05:00' })
receive('ALLOC-A', 'DYE-A', 4)
assert.equal(handover.findPdaHandoverRecord(upstream.recordId)?.handoverRecordStatus, 'SUBMITTED_WAIT_WRITEBACK')
assert.equal(water.getWaterSolubleWorkOrderById(split.waterOrderId)?.status, 'HANDOVER_WAIT_RECEIVE')
receive('ALLOC-A', 'DYE-A', 4)
assert.equal(handover.findPdaHandoverRecord(upstream.recordId)?.receiverWrittenQty, 4)
assert.throws(() => receive('ALLOC-B', 'DYE-B', 7), /剩余可接收/)
receive('ALLOC-B', 'DYE-B', 6)
assert.equal(handover.findPdaHandoverRecord(upstream.recordId)?.receiverWrittenQty, 10)
assert.equal(water.getWaterSolubleWorkOrderById(split.waterOrderId)?.receivedQty, 10)
assert.equal(water.getWaterSolubleWorkOrderById(split.waterOrderId)?.status, 'WATER_SOLUBLE_IN_PROGRESS')
console.log('真实原水溶 HO 10 米按目标接收 4+6，部分待收、幂等、不超量、原单累计一致')
const safeState = handover.capturePdaHandoverState()
const voidState = structuredClone(safeState)
voidState.handoutRecordOverrides.push([upstream.recordId, { handoverRecordStatus: 'VOIDED' }])
handover.restorePdaHandoverState(voidState)
const voidBefore = JSON.stringify(handover.findPdaHandoverRecord(upstream.recordId))
assert.throws(() => receive('VOID-RECEIVE', 'DYE-C', 1), /作废/)
assert.equal(JSON.stringify(handover.findPdaHandoverRecord(upstream.recordId)), voidBefore)
handover.restorePdaHandoverState(safeState)
console.log('作废原交出记录直接命令拒收且不写入接收事实')
