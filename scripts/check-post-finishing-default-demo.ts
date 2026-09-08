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
  listPostFinishingWaitHandoverWarehouseMovements,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWarehouseReceipts,
  loadPostFinishingDemoData,
  tracePostFinishingFullFlow,
} from '../src/data/fcs/post-finishing-full-flow.ts'

loadPostFinishingDemoData()

const deliveries = listPostFinishingFactoryReturns()
const warehouseRecords = listPostFinishingWaitProcessWarehouseRecords()
const movements = listPostFinishingWaitProcessWarehouseMovements()
const qcTasks = listPostFinishingFullFlowQcTasks()
const waitHandoverRecords = listPostFinishingWaitHandoverWarehouseRecords()
const waitHandoverMovements = listPostFinishingWaitHandoverWarehouseMovements()

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

assert.equal(qcTasks.length, 12, '默认 Mock 中十二次已确认回货必须各自自动生成质检单')
assert.equal(qcTasks.filter((item) => item.status === '待送检').length, 3, '每个生产单必须各有一个已建单但尚未送检的质检任务')
assert.equal(qcTasks.filter((item) => item.status === '待质检').length, 3, '每个生产单必须各有一个待质检任务')
assert.equal(qcTasks.filter((item) => item.status === '质检中').length, 1, '默认 Mock 必须保留一个质检中任务')
assert.equal(qcTasks.filter((item) => item.status === '质检完成').length, 5, '默认 Mock 必须覆盖五个已完成质检任务')
for (const productionOrderNo of new Set(deliveries.map((item) => item.productionOrderNo))) {
  const confirmedReturns = deliveries.filter((item) => item.productionOrderNo === productionOrderNo && item.confirmedAt)
  const orderQcTasks = qcTasks.filter((item) => item.productionOrderNo === productionOrderNo).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  assert.equal(orderQcTasks.length, confirmedReturns.length, `${productionOrderNo} 每次已确认回货必须各有一张质检单`)
  assert.deepEqual(orderQcTasks.map((item) => item.qcTaskNo), [1, 2, 3, 4].map((sequence) => `${productionOrderNo}-${sequence}`), `${productionOrderNo} 质检单号必须按确认先后严格连续递增`)
}
assert.equal(listPostFinishingFullFlowPostTasks().length, 3, '默认 Mock 必须覆盖待后道、后道完成与多批次状态')
assert.equal(listPostFinishingFullFlowRecheckOrders().length, 2, '只有后道加工完成批次生成处理后复核，默认 Mock 覆盖待复核和复核完成')
assert.equal(listPostFinishingFullFlowOutboundOrders().length, 3, '默认 Mock 必须覆盖 QC 直达待收、QC 直达已收和后道处理后待交接')
assert.equal(listPostFinishingFullFlowOutboundOrders().filter((item) => item.sourceType === '质检直达').length, 2, 'QC 空项目必须直接生成两张成衣仓交接单')
assert.equal(listPostFinishingWarehouseReceipts().length, 1, '默认 Mock 必须覆盖成衣仓实际确认收货场景')
assert.equal(waitHandoverRecords.length, 1, '只有处理后复核完成批次形成后道待交出仓记录')
assert.equal(waitHandoverRecords.filter((item) => item.status === '待交出').length, 1, '默认 Mock 必须有一条仍在待交出仓的批次')
assert.equal(waitHandoverRecords.filter((item) => item.status === '已交出').length, 0, 'QC 直达已收不得伪造后道待交出仓历史')
assert.equal(waitHandoverMovements.filter((item) => item.movementType === '复检完成入仓').length, 1, '处理后复核完成必须形成唯一待交出入仓流水')
assert.equal(waitHandoverMovements.filter((item) => item.movementType === '后道出货交出').length, 0, 'QC 直达已收不得补写后道待交出仓交出流水')
assert.equal(waitHandoverRecords.find((item) => item.status === '待交出')?.lines.reduce((sum, line) => sum + line.availableQty, 0), 100, '待交出批次必须保留 100 件可用库存')
assert(deliveries.every((delivery) => tracePostFinishingFullFlow(delivery.deliveryOrderNo).delivery?.deliveryId === delivery.deliveryId), '十五条默认 Mock 都必须可按送货单回溯')
assert(waitHandoverRecords.every((record) => tracePostFinishingFullFlow(record.outboundOrderNo).waitHandoverRecord?.warehouseRecordId === record.warehouseRecordId), '待交出仓批次必须能从出货单回溯同一链')

console.log(JSON.stringify({
  suite: 'QC 后道默认 3×5×5 Mock 数据检查',
  productionOrders: 3,
  returns: deliveries.length,
  skuLines: deliveries.reduce((sum, item) => sum + item.lines.length, 0),
  warehouseRecords: warehouseRecords.length,
  warehouseMovements: movements.length,
  waitHandoverWarehouseRecords: waitHandoverRecords.length,
  waitHandoverWarehouseMovements: waitHandoverMovements.length,
  qcTasks: qcTasks.length,
  result: '通过',
}, null, 2))
