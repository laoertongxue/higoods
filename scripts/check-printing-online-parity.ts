import assert from 'node:assert/strict'
import { listPrintingWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { ensurePrintingReceivingExamples } from '../src/data/fcs/printing-material-receipts.ts'
import { renderPrintingRelations } from '../src/pages/process-factory/printing/relations.ts'
import { buildPrintingInfoSheetDocument, buildPrintingConfirmationDocument, renderPrintingInfoSheetDocument, renderPrintingConfirmationDocument, printingSheetQuantities } from '../src/pages/print/templates/printing-sheet-template.ts'
import { captureFactoryReceivingData } from '../src/data/fcs/factory-receiving.ts'

// ONLINE-001/004/005/006: actual order-to-source and online paper-field contracts.
ensurePrintingReceivingExamples()
const orders = listPrintingWorkOrders()
const first = orders.find(o => o.workOrderId === 'PWO-PRINT-001')!
const upstream = renderPrintingRelations(first, 'upstream')
for (const text of ['DB-PRINT-DEMO-001', 'DB-PRINT-DEMO-002', '审核通过', '计划数量', '调拨数量', '60 Yard', '40 Yard', 'WH-FABRIC-001']) assert.ok(upstream.includes(text), text)
assert.equal((upstream.match(/data-printing-upstream-partner/g) || []).length, 1, 'one supplier, multiple documents')
assert.ok(!upstream.includes('<details'), 'relevant source documents are directly visible')
assert.ok(!upstream.includes('DB-PRINT-DEMO-003'), 'another order is excluded')
const receivingBefore = captureFactoryReceivingData()
for (const order of orders) {
  const input = { sourceType: 'PRINTING_WORK_ORDER' as const, sourceId: order.workOrderId }
  const confirmation = buildPrintingConfirmationDocument({ ...input, documentType: 'PRINTING_CONFIRMATION' })
  const info = buildPrintingInfoSheetDocument({ ...input, documentType: 'PRINTING_INFO_SHEET' })
  const c = renderPrintingConfirmationDocument(confirmation), i = renderPrintingInfoSheetDocument(info)
  assert.equal((c.match(/<tr[ >]/g) || []).length, 14)
  assert.equal((i.match(/<tr[ >]/g) || []).length, 5)
  assert.ok(c.includes('Pattern transfer<br>confirmation'), 'the online signature grid is retained for all crafts')
  assert.ok(i.includes('The quantity of raw materials used') && i.includes('The roll of raw materials used'))
  assert.equal(confirmation.headerFields.find(f => f.label === '面料 SKU')?.value, info.headerFields.find(f => f.label === 'Fabric SKU')?.value)
  assert.equal(confirmation.sections[0].fields?.find(f => f.label === '印花来源')?.value, order.salesType || '—')
  assert.equal(confirmation.imageBlocks.length, order.requirement.printSide === '双面' ? 2 : 1)
  assert.ok(i.includes('Purchase Order (PO)') && !i.includes('工序与交接记录'), 'information sheet keeps the online five-row purpose')
}
assert.deepEqual(captureFactoryReceivingData(), receivingBefore, 'rendering sheets never receives or deducts stock')
assert.deepEqual(printingSheetQuantities({ ...first, plannedInput: { ...first.plannedInput, plannedQty: 1.6, qtyUnit: 'Yard' } }), ['1.6 Yard','1.463 Meter'])
assert.deepEqual(printingSheetQuantities({ ...first, plannedInput: { ...first.plannedInput, plannedQty: 30, qtyUnit: '公斤' } }), ['30 公斤','—'])
const batch = buildPrintingConfirmationDocument({documentType:'PRINTING_CONFIRMATION',sourceType:'PRINTING_WORK_ORDER',sourceId:[orders[0].workOrderId,orders[1].workOrderId,orders[0].workOrderId].join(',')})
assert.equal(batch.relatedObjectIds?.length,2)
assert.equal((renderPrintingConfirmationDocument(batch).match(/<article /g)||[]).length,2)
assert.throws(()=>buildPrintingConfirmationDocument({documentType:'PRINTING_CONFIRMATION',sourceType:'PRINTING_WORK_ORDER',sourceId:'MISSING'}),/不存在/)
console.log('PASS ONLINE-001/004/005/006: direct upstream docs, five/14-row online forms, source/output mappings, batch dedup, accurate units, read-only preview')
