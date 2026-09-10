import assert from 'node:assert/strict'
import { completePrintingWorkOrder, getPrintingWorkOrderById, handoverPrintingOutput, listPrintingWorkOrders, receivePrintingHandover, receivePrintingInput, resetPrintingWorkOrderBusinessStore } from '../src/data/fcs/printing-work-order-business.ts'

resetPrintingWorkOrderBusinessStore()
const order = listPrintingWorkOrders().find((item) => item.processingStatus === 'WAIT_INPUT_RECEIPT')!
assert(order, '需要未接收印花单')
const id = order.workOrderId
const read = () => getPrintingWorkOrderById(id)!
receivePrintingInput(id, { actualSku: order.plannedInput.sku, receivedQty: 100, receivedRollCount: 2, receiverName: '分批验收', receiptId: 'CHECK-PRINT-RECEIPT-1', upstreamRecordId: 'CHECK-PRINT-SOURCE-1' })
completePrintingWorkOrder(id, { usedQty: 50, usedRollCount: 1, completedQty: 50, completedRollCount: 1, printerNo: 'P1', operatorName: '分批验收' })
assert.equal(read().processingStatus, 'PROCESSING', '首批完成不能关闭尚有已接收物料的加工')
handoverPrintingOutput(id, { qty: 50, barcodeIds: read().barcodes.map((item) => item.id), operatorName: '分批验收', receiverName: read().receivingTargetName })
receivePrintingHandover(id, { receivedQty: 50, receiverName: read().receivingTargetName })
const firstRoll = structuredClone(read().barcodes[0])
receivePrintingInput(id, { actualSku: order.plannedInput.sku, receivedQty: 100, receivedRollCount: 2, receiverName: '分批验收', receiptId: 'CHECK-PRINT-RECEIPT-2', upstreamRecordId: 'CHECK-PRINT-SOURCE-2' })
completePrintingWorkOrder(id, { usedQty: 150, usedRollCount: 3, completedQty: 150, completedRollCount: 3, printerNo: 'P1', operatorName: '分批验收' })
assert.deepEqual(read().barcodes[0], firstRoll, '第二批不得改写首批已入库卷及条码')
const nextRolls = read().barcodes.filter((item) => item.id !== firstRoll.id)
assert.equal(nextRolls.length, 2)
assert.equal(nextRolls.reduce((total, item) => total + item.lengthY, 0), 100)
handoverPrintingOutput(id, { qty: 100, barcodeIds: nextRolls.map((item) => item.id), operatorName: '分批验收', receiverName: read().receivingTargetName })
receivePrintingHandover(id, { receivedQty: 100, receiverName: read().receivingTargetName })
assert.equal(read().actualInput.receivedQty, 200)
assert.equal(read().output.completedQty, 150)
assert.equal(read().handover.receivedQty, 150)
assert.equal(read().manuallyCompletedAt, undefined, '分批收齐不等于人工完单')
assert.throws(() => completePrintingWorkOrder(id, { usedQty: 150, usedRollCount: 3, completedQty: 150, completedRollCount: 3, printerNo: 'P1', operatorName: '重复' }), /新增|累计|增加/)
assert.throws(() => completePrintingWorkOrder(id, { usedQty: 250, usedRollCount: 5, completedQty: 200, completedRollCount: 4, printerNo: 'P1', operatorName: '超量' }), /接收/)
console.log('PASS 印花两批接收、累计产出、两批交出及原卷历史不变；重复与超量阻断')
