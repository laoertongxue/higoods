import assert from 'node:assert/strict'
import test from 'node:test'

import { renderProductionObjectFloatingEntry } from '../../src/components/production-object-floating-entry.ts'

test('查生产入口只在合法系统路由显示，并在打印与 PDA 路由隐藏', () => {
  assert.match(renderProductionObjectFloatingEntry('/fcs/production/orders'), /查生产/)
  assert.match(renderProductionObjectFloatingEntry('/pcs/projects?tab=active'), /查生产/)
  assert.equal(renderProductionObjectFloatingEntry('/fcs/pda/exec'), '')
  assert.equal(renderProductionObjectFloatingEntry('/fcs/print/post-finishing-qc'), '')
  assert.equal(renderProductionObjectFloatingEntry('/fcs/task-print/example'), '')
  assert.equal(renderProductionObjectFloatingEntry('/fcs/production/orders/PO-001/confirmation-print'), '')
})

test('相似前缀和相似打印段不会被当成合法路由', () => {
  assert.equal(renderProductionObjectFloatingEntry('/fcs-old/production/orders'), '')
  assert.match(renderProductionObjectFloatingEntry('/fcs/production/orders/confirmation-print-preview'), /查生产/)
})
