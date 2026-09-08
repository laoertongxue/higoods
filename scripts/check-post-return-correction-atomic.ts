import assert from 'node:assert/strict'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'

// POST-020: a rejected correction must not partly alter the confirmed receipt.
flow.resetPostFinishingFullFlow()
const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const order = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
const registered = flow.registerPostFinishingFactoryReturn({
  productionOrderNo: order.productionOrderNo, returnIndex: 91,
  triggerSource: '公共PDA自助回货', idempotencyKey: 'POST-020:ATOMIC',
  quantities: order.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 20 })),
  deliveryPersonName: actors.factoryCourier.actorName, deliveryPersonPhone: '08120000091',
  evidenceImageUrls: ['/shirt-sample.jpg'], actor: actors.factoryCourier,
})
const confirmed = flow.confirmPostFinishingFactoryReturn({
  deliveryId: registered.deliveryId,
  firstCounts: registered.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 20 })),
  actor: actors.returnConfirmer,
})
assert.ok(confirmed.lines.length > 1)
const snapshot = () => ({
  delivery: flow.getPostFinishingFactoryReturn(confirmed.deliveryId),
  warehouse: flow.listPostFinishingWaitProcessWarehouseRecords(),
  qc: flow.listPostFinishingFullFlowQcTasks(),
  versions: flow.listPostFinishingReturnConfirmationVersions({ deliveryId: confirmed.deliveryId }),
})
const before = snapshot()
assert.throws(() => flow.correctPostFinishingFactoryReturnConfirmation({
  deliveryId: confirmed.deliveryId, correctionReason: '复点订正', actor: actors.returnSupervisor,
  correctedCounts: confirmed.lines.map((line, index) => ({ skuId: line.sku.skuId, actualQty: index ? -1 : 21 })),
}))
assert.deepEqual(snapshot(), before, '无效第二条数量不得部分改变第一条确认及关联仓储/QC/版本')
const corrected = flow.correctPostFinishingFactoryReturnConfirmation({
  deliveryId: confirmed.deliveryId, correctionReason: '主管复点少一件', actor: actors.returnSupervisor,
  correctedCounts: confirmed.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 19 })),
})
assert.equal(corrected.confirmedAt, confirmed.confirmedAt)
const versions = flow.listPostFinishingReturnConfirmationVersions({ deliveryId: confirmed.deliveryId })
assert.equal(versions.length, 2)
assert.equal(versions.filter(version => version.status === 'ACTIVE').length, 1)
assert.equal(versions[0].confirmedQty, confirmed.lines.length * 20)
assert.ok(flow.listPostFinishingFullFlowQcTasks().find(task => task.qcTaskId === corrected.qcTaskId)?.lines.every(line => line.expectedQty === 19))
console.log('POST-020 correction rejection atomicity and retained confirmation versions passed')
