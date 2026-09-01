#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  listPostFinishingFactoryReturns,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitProcessWarehouseRecords,
  listPostFinishingWarehouseReceipts,
  loadPostFinishingDemoData,
  tracePostFinishingFullFlow,
} from '../src/data/fcs/post-finishing-full-flow.ts'

loadPostFinishingDemoData()

const deliveries = listPostFinishingFactoryReturns()
const warehouseRecords = listPostFinishingWaitProcessWarehouseRecords()
const movements = listPostFinishingWaitProcessWarehouseMovements()
const qcTasks = listPostFinishingFullFlowQcTasks()

assert.equal(new Set(deliveries.map((item) => item.productionOrderNo)).size, 3, '默认 Mock 必须覆盖 3 个生产单')
assert.equal(deliveries.length, 15, '默认 Mock 必须覆盖每个生产单 5 次、共 15 次回货')
assert.equal(deliveries.reduce((sum, item) => sum + item.lines.length, 0), 75, '默认 Mock 必须覆盖 15 次回货 × 5 个 SKU')
for (const productionOrderNo of new Set(deliveries.map((item) => item.productionOrderNo))) {
  const orderReturns = deliveries.filter((item) => item.productionOrderNo === productionOrderNo)
  assert.equal(orderReturns.length, 5, `${productionOrderNo} 必须有 5 次回货`)
  assert.deepEqual(orderReturns.map((item) => item.returnIndex).sort(), [1, 2, 3, 4, 5], `${productionOrderNo} 回货序号必须完整`)
  assert(orderReturns.every((item) => item.lines.length === 5), `${productionOrderNo} 每次回货必须有 5 个 SKU`)
}

assert.equal(warehouseRecords.length, 15, '每次回货必须生成后道待加工仓记录')
assert.equal(warehouseRecords.filter((item) => item.status === '待确认').length, 3, '每个生产单必须各有一条待确认回货')
assert.equal(warehouseRecords.filter((item) => item.status === '待送检').length, 3, '每个生产单必须各有一条已入仓待送检库存')
assert.equal(warehouseRecords.filter((item) => item.status === '已送检').length, 9, '其余九条必须形成已送检历史事实')
assert.equal(movements.filter((item) => item.movementType === '确认入库').length, 12, '已确认的十二次回货必须各有确认入库流水')
assert.equal(movements.filter((item) => item.movementType === '送检出库').length, 9, '已送检的九次回货必须各有送检出库流水')

assert.equal(qcTasks.length, 9, '默认 Mock 必须覆盖九个已送检质检任务')
assert.equal(qcTasks.filter((item) => item.status === '待质检').length, 3, '每个生产单必须各有一个待质检任务')
assert.equal(qcTasks.filter((item) => item.status === '质检中').length, 3, '每个生产单必须各有一个质检中任务')
assert.equal(qcTasks.filter((item) => item.status === '质检完成').length, 3, '每个生产单必须各有一个质检完成任务')
assert.equal(listPostFinishingFullFlowPostTasks().length, 2, '默认 Mock 必须覆盖待后道和后道完成状态')
assert.equal(listPostFinishingFullFlowRecheckOrders().length, 2, '默认 Mock 必须覆盖待复检和复检完成状态')
assert.equal(listPostFinishingFullFlowOutboundOrders().length, 1, '默认 Mock 必须覆盖唯一出货单场景')
assert.equal(listPostFinishingWarehouseReceipts().length, 1, '默认 Mock 必须覆盖出货收货完成场景')
assert(deliveries.every((delivery) => tracePostFinishingFullFlow(delivery.deliveryOrderNo).delivery?.deliveryId === delivery.deliveryId), '十五条默认 Mock 都必须可按送货单回溯')

console.log(JSON.stringify({
  suite: 'QC 后道默认 3×5×5 Mock 数据检查',
  productionOrders: 3,
  returns: deliveries.length,
  skuLines: deliveries.reduce((sum, item) => sum + item.lines.length, 0),
  warehouseRecords: warehouseRecords.length,
  warehouseMovements: movements.length,
  qcTasks: qcTasks.length,
  result: '通过',
}, null, 2))
