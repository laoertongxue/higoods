import assert from 'node:assert/strict'
import * as f from '../src/data/fcs/post-finishing-full-flow.ts'
import { getPostFinishingExecutionStatistics } from '../src/data/fcs/process-statistics-domain.ts'
// POST-024: counts labelled as QC/post/recheck documents must count documents,
// even when two return batches belong to the same production task.
f.resetPostFinishingFullFlow()
const actors = f.POST_FINISHING_ACCEPTANCE_ACTORS
const order = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
for (const returnIndex of [91, 92]) {
  const delivery = f.registerPostFinishingFactoryReturn({
    productionOrderNo: order.productionOrderNo, returnIndex, triggerSource: '公共PDA自助回货',
    idempotencyKey: `POST-024:${returnIndex}`,
    quantities: order.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 20 })),
    deliveryPersonName: actors.factoryCourier.actorName, deliveryPersonPhone: '08120000091',
    evidenceImageUrls: ['/shirt-sample.jpg'], actor: actors.factoryCourier,
  })
  f.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId,
    firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 20 })), actor: actors.returnConfirmer })
  f.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender })
}
const stats = getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo })
assert.equal(stats.waitQcTaskCount, 2, '同一生产任务两批待质检应显示2张质检单')
const qcs = f.listPostFinishingFullFlowQcTasks()
f.claimPostFinishingQcTask({ qcTaskNo: qcs[0].qcTaskNo, actor: actors.qcA })
const claimed = getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo })
assert.equal(claimed.waitQcTaskCount, 1)
assert.equal(claimed.qcDoingTaskCount, 1)
f.completePostFinishingQcTask({ qcTaskId: qcs[0].qcTaskId, actor: actors.qcA,
  results: qcs[0].lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) })
const post = f.listPostFinishingFullFlowPostTasks()[0]
f.startPostFinishingPostTask({ postTaskNo: post.postTaskNo, actor: actors.postOperator })
assert.equal(getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo }).postDoingTaskCount, 1)
f.completePostFinishingPostTask({ postTaskId: post.postTaskId, actor: actors.postOperator,
  results: post.lines.map(line => ({ skuId: line.sku.skuId, processedQty: line.expectedQty, unprocessedQty: 0 })) })
const recheck = f.listPostFinishingFullFlowRecheckOrders()[0]
assert.equal(getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo }).waitRecheckTaskCount, 1)
assert.equal(getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo }).recheckDoingTaskCount, 0)
f.claimPostFinishingRecheckOrder({ recheckOrderNo: recheck.recheckOrderNo, actor: actors.recheckerA })
assert.equal(getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo }).waitRecheckTaskCount, 0)
assert.equal(getPostFinishingExecutionStatistics({ workOrderId: order.productionOrderNo }).recheckDoingTaskCount, 1)
console.log('POST-024 multiple batch document counts and waiting/claimed states passed')

// POST-021/024: direct QC output is not handed over until the warehouse confirms.
const directOrder = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1]
const createDirectReturn = (returnIndex: number) => f.registerPostFinishingFactoryReturn({
  productionOrderNo: directOrder.productionOrderNo, returnIndex, triggerSource: '公共PDA自助回货',
  idempotencyKey: `POST-024:DIRECT:${returnIndex}`,
  quantities: directOrder.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 3 })),
  deliveryPersonName: actors.factoryCourier.actorName, deliveryPersonPhone: '08120000091',
  evidenceImageUrls: ['/shirt-sample.jpg'], actor: actors.factoryCourier,
})
const discarded = createDirectReturn(93)
f.discardPostFinishingFactoryReturn({ deliveryId: discarded.deliveryId, reason: '重复登记，尚未确认', actor: actors.returnConfirmer })
const direct = createDirectReturn(94)
f.confirmPostFinishingFactoryReturn({ deliveryId: direct.deliveryId,
  firstCounts: direct.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 3 })), actor: actors.returnConfirmer })
const directQc = f.sendPostFinishingFactoryReturnToQc({ deliveryId: direct.deliveryId, actor: actors.sender })
f.claimPostFinishingQcTask({ qcTaskNo: directQc.qcTaskNo, actor: actors.qcB })
f.completePostFinishingQcTask({ qcTaskId: directQc.qcTaskId, actor: actors.qcB,
  results: directQc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), processItems: [] })
const outbound = f.listPostFinishingFullFlowOutboundOrders().find(item => item.deliveryId === direct.deliveryId)!
assert.ok(outbound)
assert.equal(outbound.sourceType, '质检直达')
let directStats = getPostFinishingExecutionStatistics({ workOrderId: directOrder.productionOrderNo })
assert.equal(directStats.handedOverTaskCount, 0)
f.receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, actor: actors.warehouseReceiver,
  receivedQuantities: outbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })) })
directStats = getPostFinishingExecutionStatistics({ workOrderId: directOrder.productionOrderNo })
assert.equal(directStats.handedOverTaskCount, 1, '空项目QC直达也必须进入已交出统计')
assert.equal(directStats.waitReceiveTaskCount, 1, '废弃回货不造成待收货；该生产单仅剩后续上游交出')
assert.equal(directStats.statusCounts['待收货'] || 0, 0, '废弃记录不能制造虚假待确认任务')
assert.equal(directStats.completedTaskCount, 0)
console.log('POST-021/024 generated versus confirmed outbound and discarded-return exclusion passed')
