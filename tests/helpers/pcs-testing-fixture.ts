import { buildPcsSampleTagCode } from '../../src/data/pcs-sample-management.ts'
import assert from 'node:assert/strict'
import { createTestingOrder, listTestingOrders, updateTestingOrder, advanceTestingOrder, completeSampleInbound, completeLabelStep, setBulkDecision } from '../../src/data/pcs-testing-order-repository.ts'

/** Test prerequisites follow the same receipt/tagging/decision actions as the UI. */
export function completeTestingFixture(styleId: string): void {
  if (listTestingOrders().some(o => o.styleId === styleId && o.status === '已结束' && o.bulkDecision === '是')) return
  const order = listTestingOrders().find(o => o.styleId === styleId && o.status === '进行中') || createTestingOrder({ styleId }).order
  assert.ok(order)
  if (!order.sampleInboundAt) {
    assert.equal(advanceTestingOrder(order.testingOrderId, 'logistics').ok, true)
    updateTestingOrder(order.testingOrderId, { logisticsCarrier: 'Mock 测试', logisticsTrackingNo: 'MOCK-FIXTURE' })
    assert.equal(advanceTestingOrder(order.testingOrderId, 'sample-inbound').ok, true)
    assert.equal(completeSampleInbound(order.testingOrderId, 'Mock 到样', '测试仓管').ok, true)
  }
  if (order.currentStepKey === 'label' || !order.labeledAt) for (const code of order.skuCodes) assert.equal(completeLabelStep(order.testingOrderId, buildPcsSampleTagCode(code), '测试仓管').ok, true)
  assert.equal(advanceTestingOrder(order.testingOrderId, 'bulk-decision').ok, true)
  assert.equal(setBulkDecision(order.testingOrderId, '是', 'Mock 测款通过', '测试买手').ok, true)
}
