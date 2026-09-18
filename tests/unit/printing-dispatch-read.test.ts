import test from 'node:test'
import assert from 'node:assert/strict'
import { listPrintingWorkOrders, listPrintingDispatchDocuments, printingRollReserved } from '../../src/data/fcs/printing-task-domain.ts'

test('VERIFY-003: dispatch reads keep all documents and independent copies without projecting unrelated business views', () => {
  const expected = listPrintingWorkOrders().flatMap(order => order.dispatchDocuments || [])
  assert(expected.length > 0)
  const original = globalThis.structuredClone
  let businessCopies = 0
  globalThis.structuredClone = ((value: any, options?: any) => {
    if (value?.plannedInput && value?.product && value?.output) businessCopies++
    return original(value, options)
  }) as typeof structuredClone
  try {
    assert.deepEqual(listPrintingDispatchDocuments(), expected)
    for (const doc of expected) for (const line of doc.lines) for (const id of line.barcodeIds) {
      assert.equal(printingRollReserved(line.workOrderId, id), expected.some(item => item.status === '草稿' && item.lines.some(row => row.workOrderId === line.workOrderId && row.barcodeIds.includes(id))))
    }
    assert.equal(printingRollReserved('missing-order', 'missing-roll'), false)
    assert.equal(businessCopies, 0, 'dispatch reads must not clone every unrelated order view')
    const copy = listPrintingDispatchDocuments()
    copy[0].lines[0].barcodeIds.push('not-a-real-roll')
    assert.deepEqual(listPrintingDispatchDocuments(), expected)
  } finally { globalThis.structuredClone = original }
})
