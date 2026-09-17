import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureProductionDemandEarlyProcessAcceptanceData } from '../../src/data/fcs/production-demand-early-process-work-orders.ts'
import { captureFactoryReceivingData, getProcessOrderReceivingFacts, getSourceActualReceipts, listFactoryMaterialUses, restoreFactoryReceivingData, eligibleReceivingSource } from '../../src/data/fcs/factory-receiving.ts'
import { getProcessOrderTaskRelationView, withProcessOrderTaskRelationRead } from '../../src/data/fcs/process-order-task-links.ts'
import { listDyeWorkOrders } from '../../src/data/fcs/dyeing-task-domain.ts'
import { listPrintWorkOrders, listPrintWorkOrderListRecords, getPrintReviewRecordByOrderId, getPrintOrderHandoverRecords } from '../../src/data/fcs/printing-task-domain.ts'
import { listPdaHandoverHeads } from '../../src/data/fcs/pda-handover-events.ts'
import { getPdaGenericProcessTaskById, listPdaGenericProcessTasks } from '../../src/data/fcs/pda-task-mock-factory.ts'
import { getDyeMaterialReceiptOptions } from '../../src/data/fcs/dyeing-material-receipts.ts'
import { getDyeWorkOrderThreeAxisView } from '../../src/data/fcs/process-order-three-axis-view.ts'
import { listWarehouseIssueOrders, listWarehouseInternalTransferOrders } from '../../src/data/fcs/warehouse-material-execution.ts'

ensureProductionDemandEarlyProcessAcceptanceData()

test('PERF-002/004: scoped receiving reads preserve direct receipts and allocations, without exposing mutable facts', () => {
  const baseline = captureFactoryReceivingData()
  const fixture = structuredClone(baseline)
  const receipt = fixture.receipts.find(r => r.lines.length)!
  const line = receipt.lines[0]
  delete line.dyeOrderId; delete line.printingOrderId; delete line.waterOrderId
  fixture.allocations = [{ id: 'PERF-ALLOC-1', receiptLineId: line.id, printingOrderId: 'PERF-PRINT', qty: line.qty / 2, operatorName: '测试', at: '2026-09-17 12:00:00' }]
  try {
    restoreFactoryReceivingData(fixture)
    for (const [kind, key] of [['dye','dyeOrderId'],['print','printingOrderId'],['water','waterOrderId']] as const) {
      const ids = new Set([...fixture.receipts.flatMap(r => r.lines.map(l => l[key])), ...fixture.allocations.map(a => a[key]), 'missing'].filter((id): id is string => Boolean(id)))
      for (const id of ids) {
        const got = getProcessOrderReceivingFacts(id, kind)
        const allocations = fixture.allocations.filter(a => a[key] === id)
        const receipts = fixture.receipts.flatMap(r => { const lines = r.lines.filter(l => l[key] === id || allocations.some(a => a.receiptLineId === l.id)); return lines.length ? [{...r,lines}] : [] })
        const sourceIds = new Set(receipts.flatMap(r => r.lines.filter(l => allocations.some(a => a.receiptLineId === l.id)).map(l => l.sourceId)))
        const sources = fixture.sources.filter(s => eligibleReceivingSource(s) && (s.lines.some(l => l[key] === id) || sourceIds.has(s.id)))
        assert.deepEqual(got, { sources, receipts, allocations })
      }
    }
    const selected = getProcessOrderReceivingFacts('PERF-PRINT', 'print')
    assert.equal(selected.allocations[0].qty, line.qty / 2)
    selected.receipts[0].lines[0].qty = -100
    selected.sources[0].lines[0].material.name = 'changed'
    assert.deepEqual(captureFactoryReceivingData(), fixture)
    for (const source of fixture.sources) assert.deepEqual(getSourceActualReceipts(source.id), fixture.receipts.flatMap(r => r.lines.filter(l => l.sourceId === source.id).map(l => ({receiptId:r.id,receivedAt:r.receivedAt,receivedBy:r.operatorName,factoryId:r.factoryId,...l}))))
    const use = (fixture.materialUses || [])[0]
    if (use?.printingOrderId) assert.deepEqual(listFactoryMaterialUses(use.printingOrderId), fixture.materialUses!.filter(u => [u.printingOrderId,u.dyeOrderId,u.waterOrderId].includes(use.printingOrderId)))
  } finally { restoreFactoryReceivingData(baseline) }
})

test('PERF-002/004: a synchronous relation read matches independent reads and releases its scope after errors', () => {
  const ids = listDyeWorkOrders().map(order => order.dyeOrderId)
  const expected = ids.map(id => getProcessOrderTaskRelationView(id))
  assert.deepEqual(withProcessOrderTaskRelationRead(() => ids.map(id => getProcessOrderTaskRelationView(id))), expected)
  assert.throws(() => withProcessOrderTaskRelationRead(() => { const view = getProcessOrderTaskRelationView(ids[0])!; view.demandSource = 'corrupted snapshot'; throw Error('abort read') }))
  assert.deepEqual(getProcessOrderTaskRelationView(ids[0]), expected[0])
})

test('PERF-004: batched print list reviews and handovers equal independently read facts', () => {
  for (const item of listPrintWorkOrderListRecords()) {
    assert.deepEqual(item.review, getPrintReviewRecordByOrderId(item.order.printOrderId))
    assert.deepEqual(item.handoverRecords, getPrintOrderHandoverRecords(item.order.printOrderId))
  }
})

test('PERF-004: scoped handovers keep canonical sorting and task point reads preserve identity', () => {
  const tasks = [...listDyeWorkOrders(), ...listPrintWorkOrders()].map(order => order.taskId)
  const taskIds = new Set(tasks)
  assert.deepEqual(listPdaHandoverHeads({includeWool:false,taskIds}), listPdaHandoverHeads().filter(head => head.processBusinessCode !== 'WOOL' && taskIds.has(head.taskId)))
  const all = listPdaGenericProcessTasks()
  for (const id of tasks) assert.deepEqual(getPdaGenericProcessTaskById(id), all.find(task => task.taskId === id))
  assert.equal(getPdaGenericProcessTaskById('unknown-performance-task'), undefined)
})

test('PERF-004: reusing warehouse documents preserves each dye order source, quantity and receiver', () => {
  const orders = listDyeWorkOrders()
  const documents = [...listWarehouseIssueOrders(), ...listWarehouseInternalTransferOrders()]
  withProcessOrderTaskRelationRead(() => {
    for (const order of orders) {
      const source = getDyeMaterialReceiptOptions(order.dyeOrderId, order, documents)
      assert.deepEqual(source, getDyeMaterialReceiptOptions(order.dyeOrderId))
      assert.deepEqual(getDyeWorkOrderThreeAxisView(order, source, documents), getDyeWorkOrderThreeAxisView(order))
    }
  })
})
