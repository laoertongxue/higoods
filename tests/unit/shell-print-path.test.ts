import assert from 'node:assert/strict'
import test from 'node:test'

import { isStandalonePrintPath } from '../../src/components/shell.ts'

test('独立打印外壳只命中完整生产确认单打印路由', () => {
  assert.equal(isStandalonePrintPath('/fcs/production/orders/PO-1/confirmation-print'), true)
  assert.equal(isStandalonePrintPath('/fcs/production/orders/PO-1/confirmation-print?preview=1'), true)
  assert.equal(isStandalonePrintPath('/fcs/production/orders/PO-1/confirmation-print-preview'), false)
  assert.equal(isStandalonePrintPath('/fcs/production/orders/PO-1/confirmation-print/extra'), false)
})

test('既有固定打印路由仍使用独立打印外壳', () => {
  assert.equal(isStandalonePrintPath('/fcs/print/post-finishing-qc'), true)
  assert.equal(isStandalonePrintPath('/fcs/task-print/TASK-1'), true)
  assert.equal(isStandalonePrintPath('/fcs/contracts/print/CONTRACT-1'), true)
  assert.equal(isStandalonePrintPath('/fcs/craft/post-finishing/print?type=QC_ORDER'), true)
  assert.equal(isStandalonePrintPath('/fcs/print-preview'), false)
  assert.equal(isStandalonePrintPath('/fcs/task-print-preview/TASK-1'), false)
  assert.equal(isStandalonePrintPath('/fcs/contracts/printing/CONTRACT-1'), false)
  assert.equal(isStandalonePrintPath('/fcs/craft/post-finishing/printing'), false)
})
