// POST-014 / POST-021: the external garment warehouse boundary owns reception.
import assert from 'node:assert/strict'
import * as f from '../src/data/fcs/post-finishing-full-flow.ts'
f.resetPostFinishingFullFlow()
f.setPostFinishingDemoBootstrapEnabled(false)
const a = f.POST_FINISHING_ACCEPTANCE_ACTORS
const order = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
function makeOutbound(returnIndex: number) {
  const registered = f.registerPostFinishingFactoryReturn({ productionOrderNo: order.productionOrderNo, returnIndex, triggerSource: '公共PDA自助回货', idempotencyKey: `POST014:ROLE:${returnIndex}`, quantities: order.skus.map(s => ({ skuId: s.skuId, registeredQty: 2 })), deliveryPersonName: a.factoryCourier.actorName, deliveryPersonPhone: '08120000001', evidenceImageUrls: ['/shirt-sample.jpg'], actor: a.factoryCourier })
  const confirmed = f.confirmPostFinishingFactoryReturn({ deliveryId: registered.deliveryId, firstCounts: registered.lines.map(l => ({ skuId: l.sku.skuId, actualQty: 2 })), actor: a.returnConfirmer })
  const qc = f.sendPostFinishingFactoryReturnToQc({ deliveryId: confirmed.deliveryId, actor: a.sender })
  f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: a.qcA })
  const done = f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: a.qcA, results: qc.lines.map(l => ({ skuId: l.sku.skuId, passedQty: 2, defectQty: 0, returnQty: 0 })), processItems: [] })
  if (done.postTaskNo) {
    const task = f.startPostFinishingPostTask({ postTaskNo: done.postTaskNo, actor: a.postOperator })
    const completed = f.completePostFinishingPostTask({ postTaskId: task.postTaskId, actor: a.postOperator, results: task.lines.map(l => ({ skuId: l.sku.skuId, processedQty: l.expectedQty, unprocessedQty: 0 })) })
    const recheck = f.claimPostFinishingRecheckOrder({ recheckOrderNo: completed.recheckOrderNo!, actor: a.recheckerA })
    for (const l of recheck.lines) f.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: recheck.recheckOrderId, skuId: l.sku.skuId, scannedBarcode: l.sku.barcode, actor: a.recheckerA })
    f.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: recheck.recheckOrderId, actor: a.recheckerA, results: recheck.lines.map(l => ({ skuId: l.sku.skuId, handoverQty: l.expectedQty })) })
  }
  const outbound = f.listPostFinishingFullFlowOutboundOrders().find(o => o.qcTaskId === done.qcTaskId)
  assert(outbound, '正式处理链应生成待外部成衣仓接收FCK')
  return outbound
}
const outbound = makeOutbound(71)
const input = { outboundOrderNo: outbound.outboundOrderNo, receivedQuantities: outbound.lines.map(l => ({ skuId: l.sku.skuId, receivedQty: l.outboundQty })), actor: a.warehouseReceiver }
const snapshot = () => JSON.stringify({ trace: f.tracePostFinishingFullFlow(outbound.outboundOrderNo), receipts: f.listPostFinishingWarehouseReceipts() })
const before = snapshot()
for (const actor of [a.qcA, a.postOperator, a.recheckerA, { ...a.warehouseReceiver, actorId: ' ' }, { ...a.warehouseReceiver, actorName: ' ' }]) {
  assert.throws(() => f.receivePostFinishingOutboundOrder({ ...input, actor }), /仓库收货/, '非仓库或身份缺失不得收货')
  assert.equal(snapshot(), before, '拒绝不改变当前接收事实')
}
assert.throws(() => f.receivePostFinishingOutboundOrder({ ...input, outboundOrderNo: outbound.qcTaskNo }), /完整 FCK/)
assert.equal(snapshot(), before)
const result = f.receivePostFinishingOutboundOrder(input)
assert.equal(result.outbound.status, '已接收入库')
assert.equal(result.receipt.receivedBy.actorId, a.warehouseReceiver.actorId)
assert(result.receipt.lines.every(l => l.receivedQty === l.expectedQty))
const accepted = snapshot()
const repeat = f.receivePostFinishingOutboundOrder(input)
assert.equal(repeat.alreadyReceived, true)
assert.equal(repeat.receipt.receiptId, result.receipt.receiptId)
assert.equal(snapshot(), accepted)
assert.throws(() => f.receivePostFinishingOutboundOrder({ ...input, actor: a.qcA }), /仓库收货/, '非仓库不能绕过幂等分支获取收货成功')
assert.equal(snapshot(), accepted)
const legacyAdapterOutbound = makeOutbound(72)
assert.equal(f.receivePostFinishingOutboundOrder({ outboundOrderNo: legacyAdapterOutbound.outboundOrderNo, actor: { actorId: 'PDA-GARMENT-WAREHOUSE', actorName: '仓库接收员', roleName: '成衣仓收货员' }, receivedQuantities: legacyAdapterOutbound.lines.map(l => ({ skuId: l.sku.skuId, receivedQty: l.outboundQty })) }).alreadyReceived, false)
console.log('POST-014 / POST-021: warehouse role, old adapter role, exact FCK, matched receipt, repeat stable, QC/post/recheck/blank identity rejected')
