import test from 'node:test'
import assert from 'node:assert/strict'
import { productionOrders, validatePersistedProductionOrders } from '../../src/data/fcs/production-orders.ts'

test('静态生产单更新任务状态时保留原冻结资料，不强造不存在的技术版本', () => {
  const order = structuredClone(productionOrders.find(order => order.productionOrderId === 'PO-202603-081')!)
  assert.ok(order)
  assert.equal(order.selectedTechPackVersionId, undefined)
  order.updatedAt = '2026-09-25 11:00:00'
  assert.doesNotThrow(() => validatePersistedProductionOrders([order]))
})
test('沿用静态资料的例外不能用于新单、篡改快照或错误技术版本', () => {
  const original = structuredClone(productionOrders.find(order => order.productionOrderId === 'PO-202603-081')!)
  assert.throws(() => validatePersistedProductionOrders([{ ...original, productionOrderId: 'NEW-WITHOUT-VERSION' }]), /资料不完整/)
  const changed = structuredClone(original)
  changed.techPackSnapshot!.sourceTechPackVersionId = 'OTHER'
  assert.throws(() => validatePersistedProductionOrders([changed]), /资料不完整/)
  assert.throws(() => validatePersistedProductionOrders([{ ...original, selectedTechPackVersionId: 'OTHER' }]), /资料不完整/)
})
