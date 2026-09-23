import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureTmfConnectedMockData } from '../../src/data/fcs/tmf-base-demo.ts'
import { getTmfPurchaseState, reloadTmfPurchaseRuntime, TMF_PURCHASE_STORAGE_KEY } from '../../src/data/pms/tmf-material-purchases.ts'
import { listPmsMaterialPurchaseOrders } from '../../src/data/pms/material-purchase-orders.ts'
import { listPmsMaterialRequirements } from '../../src/data/pms/material-requirements.ts'
import { listTmfWorkOrders } from '../../src/data/fcs/tmf-work-order-view.ts'

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
    assert.equal(listTmfWorkOrders().length, 5, '织带加工单必须覆盖待接收、部分接收、已加工、多长度和三种端头可见场景')
    assert.ok(state.processingIssues.some((item) => item.id === 'TMF-WO-MOCK-001:issue' && item.receivedMeters === 0), '待接收页必须有未收投入')
    assert.ok(state.processingIssues.some((item) => item.id === 'TMF-WO-MOCK-002:issue' && item.receivedMeters > 0 && item.receivedMeters < item.dispatchedMeters), '待接收页必须有部分接收投入')
    assert.ok(state.outputHandovers.some((item) => item.id === 'TMF-WO-MOCK-003:handover'), '交出记录必须有织带加工产出')
    assert.ok(state.operations.some((item) => item.id === 'TMF-WO-MOCK-003:production-receive' && item.action === '生产领料方确认实收'), '闭环场景必须到生产实收终点')
    assert.ok(state.handovers.some((item) => item.purchaseOrderNo === 'TMF-MOCK-PO-009'), '半成品交出必须与加工投入使用同一采购来源')
    assert.ok(state.lots.some((item) => item.sourcePurchaseOrderNo === 'TMF-MOCK-PO-009' && item.id === 'TMF-MOCK-PO-009:batch'))
    for (const order of orders) {
      assert.equal(listPmsMaterialPurchaseOrders().find((item) => item.purchaseOrderNo === order.purchaseOrderNo)?.purchaseOrderNo, order.purchaseOrderNo)
      assert.ok(listPmsMaterialRequirements().some((item) => item.requirementNo === order.requirementNo && item.lines.some((line) => line.lineNo === order.sourceRequirementLineNo)), '每条 TMF 采购必须可回溯到 PMS 需求行')
      assert.ok(order.materialImageUrl.startsWith('/materials/tmf/'))
      assert.notEqual(order.styleImageUrl, order.materialImageUrl, '款式图片不能用物料图片冒充')
      assert.ok(order.baseMaterialRecipe?.materialSkuId, '半成品加工必须冻结原料配方')
    }
    for (const base of state.baseOrders.filter((item) => item.producedMeters > 0 && item.purchaseOrderNo.startsWith('TMF-MOCK-PO-'))) {
      const issues = state.baseMaterialIssues.filter((item) => item.baseOrderId === base.id)
      assert.ok(issues.length > 0 && issues.every((item) => item.receivedQty > 0 && item.consumedQty > 0), '半成品产出前必须存在原料发出、实收和耗用事实')
    }
    const multiLength = listTmfWorkOrders().find((item) => item.productionOrderNo === 'TMF-WO-MOCK-004')!
    assert.deepEqual([...new Set(multiLength.demands.map((item) => item.materialSkuId))], ['WB20-WHT'], '同 SKU 的生产用截断长度不拆永久 SKU')
    assert.deepEqual(multiLength.demands.map((item) => item.specification.finishedLengthMm).sort((a, b) => a - b), [500, 700])
    const rope = listTmfWorkOrders().find((item) => item.productionOrderNo === 'TMF-WO-MOCK-005')!
    assert.equal(rope.sourcePurchases[0]?.purchaseOrderNo, 'TMF-MOCK-PO-012')
    assert.deepEqual(rope.demands.map((item) => item.specification.endA.method).sort(), ['METAL', 'PLASTIC_WRAP', 'SILICONE_DIP'])
    assert.ok(listTmfWorkOrders().every((item) => /^TMF-WO-[A-Za-z0-9_-]+$/.test(item.workOrderNo) && !item.workOrderNo.includes('["')), '加工单号必须可读，不能暴露 JSON 身份')
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
