import assert from 'node:assert/strict'
import { getDyeWorkOrderThreeAxisView } from '../src/data/fcs/process-order-three-axis-view.ts'
import * as dye from '../src/data/fcs/dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
const order = dye.listDyeWorkOrders().find(o => o.status === 'WAIT_MATERIAL' && !o.requiresWaterSoluble)!
assert(order)
const historical = dye.listDyeWorkOrders().find(o => o.dyeOrderId === 'DWO-008')!
assert.equal(getDyeWorkOrderThreeAxisView(historical).processingStatus, 'COMPLETED', '有完整历史包装产出时，缺染色投入明细不应回退未开始')
dye.completeDyeInputReceipt(order.dyeOrderId, { outputQty: 4, operatorName: '实收验收员', receiptId: 'DYE-RECEIPT-1', upstreamRecordId: 'DYE-SOURCE-1' })
const task = listPdaGenericProcessTasks().find(t => t.taskId === order.taskId)!
assert.equal(task.status, 'NOT_STARTED', '原料实收不能代替实际开工')
assert.equal(task.startedAt, undefined)
assert.equal(dye.getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE'), undefined, '接收不能伪造开始染色节点')
assert.equal(dye.getDyeExecutionNodeRecord(order.dyeOrderId, 'VAT_PLAN'), undefined, '接收不能自动排缸')
dye.completeDyeInputReceipt(order.dyeOrderId, { outputQty: 6, operatorName: '实收验收员', receiptId: 'DYE-RECEIPT-2', upstreamRecordId: 'DYE-SOURCE-2' })
assert.equal(dye.getDyeExecutionNodeRecord(order.dyeOrderId, 'INPUT_RECEIVED')?.outputQty, 10)
assert.throws(() => dye.completeDyeInputReceipt(order.dyeOrderId, { outputQty: 6, receiptId: 'DYE-RECEIPT-2', upstreamRecordId: 'DYE-SOURCE-2' }), /重复/)
assert.equal(dye.validateDyeStartPrerequisite(order.dyeOrderId, 11).ok, false)
console.log('染色实际接收 4+6 不自动开工、不伪造排缸/染色、重复及超实际投入阻断')
dye.startDyeing(order.dyeOrderId, { dyeVatNo: 'TEST-VAT', inputQty: 4 })
dye.completeDyeing(order.dyeOrderId, { inputQty: 4, outputQty: 4 })
for (const node of ['DEHYDRATE','DRY','SET','ROLL','PACK'] as const) {
  dye.startDyeNode(order.dyeOrderId, node)
  dye.completeDyeNode(order.dyeOrderId, node, { outputQty: 4 })
}
assert.throws(() => dye.submitDyeHandover(order.dyeOrderId, { handoverQty: 5 }), /逐卷建单/, '接收 10 但包装完成 4 时，不能把实收当成产出交出 5')
assert.equal(getDyeWorkOrderThreeAxisView(dye.getDyeWorkOrderById(order.dyeOrderId)!).processingStatus, 'PROCESSING', '首批4完成，计划10仍加工中')
console.log('染色交出只按包装实际产出，不按原料接收最大值')
function dispatch(qty: number) {
  const roll = dye.saveDyeOutputRolls(order.dyeOrderId, [{qty,weightKg:1,widthCm:160,gsm:220,vatNo:'TEST-VAT',remark:'实际包装产出'}]).at(-1)!
  dye.markDyeOutputRolls(order.dyeOrderId,[roll.id],'print')
  const doc=dye.createDyeDispatchDocument([{orderId:order.dyeOrderId,rollIds:[roll.id]}],'实收验收员')
  dye.scanDyeDispatchRoll(doc.id,roll.barcode,'实收验收员')
  dye.saveDyeDispatchTransport(doc.id,{driver:'Andi',vehicle:'货车',plate:'B 1024 QA',note:'实际交出'})
  return dye.finishDyeDispatchDocument(doc.id,'confirm')
}
dispatch(4)
const ho = await import('../src/data/fcs/pda-handover-events.ts')
const record = dye.getDyeOrderHandoverRecords(order.dyeOrderId).at(-1)!
ho.receivePreparationHandoverForTask(record.recordId, { receiptId: 'RECEIVE-DYE-4', targetTaskOrderId: 'PRINT-NEXT', qty: 4, qtyUnit: order.qtyUnit, receiverName: '接收员', receivedAt: record.factorySubmittedAt! })
dye.startDyeing(order.dyeOrderId, { dyeVatNo: 'TEST-VAT-2', inputQty: 6 })
assert.equal(getDyeWorkOrderThreeAxisView(dye.getDyeWorkOrderById(order.dyeOrderId)!).completedQty, 4, '第二批开始仍累计首批完成量')
dye.completeDyeing(order.dyeOrderId, { inputQty: 6, outputQty: 6 })
for (const node of ['DEHYDRATE','DRY','SET','ROLL','PACK'] as const) {
  dye.startDyeNode(order.dyeOrderId, node)
  dye.completeDyeNode(order.dyeOrderId, node, { outputQty: 6 })
}
const secondDispatch = dispatch(6)
assert.equal(dye.getDyeOrderHandoverSummary(order.dyeOrderId).submittedQty, 10)
const finalAxes = getDyeWorkOrderThreeAxisView(dye.getDyeWorkOrderById(order.dyeOrderId)!)
assert.equal(finalAxes.completedQty, 10, '两批完成量累计')
assert.equal(finalAxes.processingStatus, 'PROCESSING', '当前10已完成但原单计划范围尚未完成')
assert.equal(getDyeWorkOrderThreeAxisView({ ...dye.getDyeWorkOrderById(order.dyeOrderId)!, plannedQty: 10 }).processingStatus, 'COMPLETED', '明确计划10全部完成包装后加工完成')
assert.equal(finalAxes.handoverStatus, 'FULL_HANDOVER', '两批累计交出完成，与下游接收独立')
assert.equal(dye.getDyeWorkOrderById(order.dyeOrderId)?.completedExecutionBatches?.[0].find(n => n.nodeCode === 'PACK')?.outputQty, 4)
console.log('染色同单两批：实收 10，完成交出 4 后保留工序事实，再投入完成交出 6，总交出 10')
// 数量差异必须来自接收方的原交出记录，管理端不能代改实收。
const secondRecord = dye.getDyeOrderHandoverRecords(order.dyeOrderId).find(r=>r.recordId===secondDispatch.lines[0].handoverRecordId)!
ho.receivePreparationHandoverForTask(secondRecord.recordId, {receiptId:'RECEIVE-DYE-SECOND',targetTaskOrderId:'PRINT-NEXT',qty:5,qtyUnit:order.qtyUnit,receiverName:'接收员',receivedAt:secondRecord.factorySubmittedAt!})
assert.equal(dye.getDyeOrderHandoverSummary(order.dyeOrderId).writtenBackQty,9)
dye.markDyeReceiptDifference(order.dyeOrderId,{receivedBy:'数量确认员',receivedQty:9,differenceReason:'第二批实际少收 1，核实数量'})
assert.throws(()=>dye.markDyeReceiptDifference(order.dyeOrderId,{receivedBy:'数量确认员',receivedQty:10,differenceReason:'试图代改实收'}),/实际/)
assert.throws(()=>dye.confirmDyeReceipt(order.dyeOrderId,{receivedBy:'数量确认员',receivedQty:10}),/接收方/)
assert.equal(dye.getDyeOrderHandoverSummary(order.dyeOrderId).writtenBackQty,9)
console.log('实收 9 与交出 10 独立保留，登记说明不能改变实收，禁止发送方代确认')
