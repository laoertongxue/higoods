import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureTmfConnectedMockData } from '../../src/data/fcs/tmf-base-demo.ts'
import { getTmfPurchaseState, reloadTmfPurchaseRuntime, TMF_PURCHASE_STORAGE_KEY } from '../../src/data/pms/tmf-material-purchases.ts'
import { listPmsMaterialPurchaseOrders } from '../../src/data/pms/material-purchase-orders.ts'

test('五类页面共享采购到交出的串联 Mock，重复初始化不重置执行事实', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } },
  })
  try {
    reloadTmfPurchaseRuntime()
    ensureTmfConnectedMockData()
    const state = getTmfPurchaseState()
    const orders = state.orders.filter((item) => item.purchaseOrderNo.startsWith('TMF-MOCK-PO-'))
    assert.equal(orders.length, 12, '采购需求必须无需手工载入即可有数据')
    assert.equal(state.baseOrders.filter((item) => item.purchaseOrderNo.startsWith('TMF-MOCK-PO-')).length, 12, '每条采购需求必须串联半成品加工单')
    assert.equal(state.demands.filter((item) => item.productionOrderId.startsWith('TMF-WO-MOCK-')).length, 3, '织带加工单必须覆盖待接收、部分接收、已加工场景')
    assert.ok(state.processingIssues.some((item) => item.id === 'TMF-WO-MOCK-001:issue' && item.receivedMeters === 0), '待接收页必须有未收投入')
    assert.ok(state.processingIssues.some((item) => item.id === 'TMF-WO-MOCK-002:issue' && item.receivedMeters > 0 && item.receivedMeters < item.dispatchedMeters), '待接收页必须有部分接收投入')
    assert.ok(state.outputHandovers.some((item) => item.id === 'TMF-WO-MOCK-003:handover'), '交出记录必须有织带加工产出')
    assert.ok(state.handovers.some((item) => item.purchaseOrderNo === 'TMF-MOCK-PO-009'), '半成品交出必须与加工投入使用同一采购来源')
    assert.ok(state.lots.some((item) => item.sourcePurchaseOrderNo === 'TMF-MOCK-PO-009' && item.id === 'TMF-MOCK-PO-009:batch'))
    for (const order of orders) {
      assert.equal(listPmsMaterialPurchaseOrders().find((item) => item.purchaseOrderNo === order.purchaseOrderNo)?.purchaseOrderNo, order.purchaseOrderNo)
      assert.ok(order.materialImageUrl.startsWith('/materials/tmf/'))
    }
    const persisted = storage.get(TMF_PURCHASE_STORAGE_KEY)
    ensureTmfConnectedMockData()
    assert.equal(storage.get(TMF_PURCHASE_STORAGE_KEY), persisted, '重复进入页面不能覆盖现场填报或重新生成数据')
    assert.deepEqual(getTmfPurchaseState(), state)
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
    reloadTmfPurchaseRuntime()
  }
})
