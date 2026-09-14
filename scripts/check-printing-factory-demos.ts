import assert from 'node:assert/strict'
import { PRINTING_FACTORIES } from '../src/data/fcs/printing-factories.ts'
import { listPrintingWorkOrders, getPrintingWorkflowFacts, listPrintingDispatchDocuments } from '../src/data/fcs/printing-task-domain.ts'
import { getPrintingWarehouseView } from '../src/data/fcs/printing-warehouse-view.ts'
import { listFactoryReceivingSources, listFactoryReceipts, getDefaultFactoryReceiptPosition } from '../src/data/fcs/factory-receiving.ts'

const factories = PRINTING_FACTORIES.filter(factory => factory.id !== 'F090')
const all = listPrintingWorkOrders()
assert.equal(all.filter(order => order.printFactoryId === 'F090').length, 12)
const docs = listPrintingDispatchDocuments()
for (const [factoryIndex,factory] of factories.entries()) {
  const rows = all.filter(order => order.printFactoryId === factory.id)
  assert.equal(rows.length, 5, `${factory.name} needs five executable scenarios`)
  assert.equal(new Set(rows.map(order => order.taskNo)).size, 5)
  assert.deepEqual(rows.map(row => row.processingStatus), ['WAIT_INPUT_RECEIPT','WAIT_START','PROCESSING','PROCESS_COMPLETED','PROCESS_COMPLETED'])
  const qty = rows[0].plannedInput.plannedQty
  assert.deepEqual(rows.map(row => row.actualInput.receivedQty), [0,qty,qty,qty,qty])
  assert.deepEqual(rows.map(row => row.actualInput.usedQty), [0,0,qty,qty,qty])
  assert.deepEqual(rows.map(row => row.actualInput.usedRollCount), [0,0,2,2,2])
  assert.deepEqual(rows.map(row => row.output.completedQty), [0,0,0,qty-2,qty-2])
  assert.equal(rows[4].handover.handedOverQty, qty-2)
  const outcome=(factoryIndex+1)%3
  assert.equal(rows[4].handover.receivedQty,outcome===1?0:outcome===2?qty-3:qty-2)
  assert.equal(rows[4].pendingWritebackQty,outcome===1?qty-2:outcome===2?1:0)
  const sources = listFactoryReceivingSources(factory.id)
  assert.equal(sources.filter(source => source.id.startsWith('DEMO-PRINT-IN-')&&source.handedOutAt).length, 5)
  assert.equal(listFactoryReceipts(factory.id).filter(receipt => receipt.id.startsWith('DEMO-PRINT-RCV-')).length, 4)
  assert.ok(getDefaultFactoryReceiptPosition(factory.id).locationId)
  const stock = getPrintingWarehouseView({factoryId:factory.id,timeRange:'ALL'})
  assert.equal(stock.waitProcessItems.reduce((sum,row) => sum+row.receivedQty,0), qty)
  assert.equal(stock.waitHandoverItems.reduce((sum,row) => sum+row.waitHandoverQty,0), qty-2)
  assert.ok(docs.some(doc => doc.lines.some(line => line.workOrderId === rows[4].workOrderId) && doc.status === '已交出'))
  for (const row of rows) {
    assert.ok(row.demandSource.sourceNo)
    for (const item of [row.product,row.plannedInput,row.output,row.requirement.frontPattern]) assert.ok(item.imageUrl && !/placeholder|data:image/.test(item.imageUrl))
    assert.equal(row.receivingTargetId, 'WH-FABRIC-001')
    assert.ok(row.remark.includes('测试'))
    const facts = getPrintingWorkflowFacts(row.workOrderId)
    assert.ok(facts.availableInputQty >= 0 && facts.availableOutputQty >= 0)
  }
}
const snapshot = JSON.stringify({orders:all,receipts:listFactoryReceipts(),docs})
assert.equal(JSON.stringify({orders:listPrintingWorkOrders(),receipts:listFactoryReceipts(),docs:listPrintingDispatchDocuments()}), snapshot, 're-entry must not overwrite facts or seed twice')
console.log('PASS factory demos: 10 factories × 5 scenarios, original 12 retained, source/receipt/stock/dispatch consistency and repeated reads')
