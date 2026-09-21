import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTmfBaseDemoPurchases } from '../../src/data/fcs/tmf-base-demo.ts'
import { getTmfPurchaseState } from '../../src/data/pms/tmf-material-purchases.ts'
import { listPmsMaterialPurchaseOrders } from '../../src/data/pms/material-purchase-orders.ts'

test('36条基础采购演示经业务动作形成，共享PMS来源，重复载入不重置数量或伪造实收', () => {
  loadTmfBaseDemoPurchases()
  const state = getTmfPurchaseState()
  const orders = state.orders.filter((item) => item.purchaseOrderNo.startsWith('TMF-DEMO-PO-'))
  assert.equal(orders.length, 36)
  assert.equal(state.baseOrders.length, 27)
  assert.equal(state.handovers.length, 9)
  assert.equal(state.lots.length, 0)
  for (const order of orders) {
    assert.equal(order.receivedQty, 0)
    assert.equal(listPmsMaterialPurchaseOrders().find((item) => item.purchaseOrderNo === order.purchaseOrderNo)!.receivedQty, 0)
    assert.ok(order.materialImageUrl.startsWith('/materials/tmf/'))
    assert.equal(order.styleCode, '')
  }
  for (const handover of state.handovers) {
    const base = state.baseOrders.find((item) => item.id === handover.baseOrderId)!
    assert.equal(handover.dispatchedMeters, base.producedMeters)
    assert.equal(handover.receivedMeters, 0)
  }
  loadTmfBaseDemoPurchases()
  assert.deepEqual(getTmfPurchaseState(), state)
})
