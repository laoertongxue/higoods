import assert from 'node:assert/strict'
import '../src/data/fcs/runtime-process-tasks.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS as actors,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  claimPostFinishingQcTask,
  completePostFinishingQcTask,
  confirmPostFinishingFactoryReturn,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingQcReworkFactoryOptions,
  listPostFinishingReturnRegistrationSources,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  resolvePostFinishingReturnRegistrationSource,
  sendPostFinishingFactoryReturnToQc,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  getPostFinishingTaskByProductionOrder,
  listPostFinishingActionRecords,
  listPostFinishingQcOrders,
} from '../src/data/fcs/post-finishing-current-read-model.ts'

// POST-002 / POST-008 / POST-024 / CLEAN-005：通用消费者不能丢失正式任务和直达 QC。
resetPostFinishingFullFlow()
const source = listPostFinishingReturnRegistrationSources().find((item) => item.executionTaskId)
assert(source, '当前正式有效分配应有回货来源')
const formal = resolvePostFinishingReturnRegistrationSource(source.scanValue).productionOrder
assert(!POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.some((item) => item.productionOrderId === formal.productionOrderId))
assert(getPostFinishingTaskByProductionOrder(formal.productionOrderId), '正式任务在回货前即可从生产单追踪')
const registered = registerPostFinishingFactoryReturn({
  productionOrderNo: formal.productionOrderNo, executionTaskId: formal.executionTaskId,
  returnIndex: source.returnIndex, triggerSource: '车缝正常交出', idempotencyKey: 'READ-MODEL-FORMAL',
  quantities: [{ skuId: formal.skus[0].skuId, registeredQty: 1 }],
  deliveryPersonName: '正式来源送货人', deliveryPersonPhone: '', evidenceImageUrls: [formal.skus[0].imageUrl],
  actor: actors.factoryCourier,
})
confirmPostFinishingFactoryReturn({
  deliveryId: registered.deliveryId, actor: actors.returnConfirmer,
  firstCounts: registered.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
})
assert.equal(getPostFinishingTaskByProductionOrder(formal.productionOrderId)?.receivedQty, 1)

const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1]
const delivery = registerPostFinishingFactoryReturn({
  productionOrderNo: order.productionOrderNo, returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: 'READ-MODEL-DIRECT',
  quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 10 })),
  deliveryPersonName: '直达来源送货人', deliveryPersonPhone: '', evidenceImageUrls: [order.skus[0].imageUrl],
  actor: actors.factoryCourier,
})
confirmPostFinishingFactoryReturn({
  deliveryId: delivery.deliveryId, actor: actors.returnConfirmer,
  firstCounts: delivery.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 10 })),
})
const qc = sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender })
assert(listPostFinishingQcOrders().some((item) => item.actionRecordId === qc.qcTaskId), '待质检事实不依赖加工单存在')
claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA })
const receiver = listPostFinishingQcReworkFactoryOptions().find((item) => item.value !== order.sewingFactoryName)
assert(receiver)
completePostFinishingQcTask({
  qcTaskId: qc.qcTaskId, actor: actors.qcA, processItems: [],
  results: qc.lines.map((line) => ({
    skuId: line.sku.skuId, passedQty: 7, defectQty: 1, returnQty: 2,
    defectReasonQuantities: [{ reason: '破洞', quantity: 1 }],
    returnReason: '车缝返工', returnReceiver: receiver.value,
  })),
})
assert(!listPostFinishingFullFlowPostTasks().some((item) => item.qcTaskId === qc.qcTaskId), '空项目保持不生成加工单')
const projected = listPostFinishingQcOrders().find((item) => item.actionRecordId === qc.qcTaskId)
assert(projected, '没有加工单的 QC 仍须进入质量和结算消费者')
assert.equal(projected.inspectedGarmentQty, 50)
assert.equal(projected.passedGarmentQty, 35)
assert.equal(projected.reworkGarmentQty, 10)
assert.equal(projected.defectAcceptedGarmentQty, 5)
assert.equal(projected.warehouseAllocations?.[0].productionOrderNo, order.productionOrderNo)
assert.equal(projected.warehouseAllocations?.[0].postTaskId, getPostFinishingTaskByProductionOrder(order.productionOrderId)?.postTaskId)
assert.equal(projected.qcSkuResults?.reduce((sum, line) => sum + (line.sourceChargeback?.amount || 0), 0), 50000)
assert.equal(listPostFinishingActionRecords().filter((item) => item.actionRecordId === qc.qcTaskId).length, 1, '同一 QC 只投影一次')
resetPostFinishingFullFlow()
console.log('post-finishing current read model passed: formal task visibility, independent QC facts, quantities and chargeback preserved')
