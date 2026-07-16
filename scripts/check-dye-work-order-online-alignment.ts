import assert from 'node:assert/strict'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderHighRiskStatusChange,
  listDyeWorkOrderOnlineLogs,
  updateDyeWorkOrderFromPfos,
} from '../src/data/fcs/dye-work-order-online-domain.ts'
import {
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
} from '../src/data/fcs/dye-work-order-online-view.ts'

const order = listDyeWorkOrders().find((item) => getDyeWorkOrderOnlineRecord(item.dyeOrderId).status === '等待处理')
assert(order, '至少需要一张等待处理的染色加工单')

const initial = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(initial.status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '接单',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:00:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '开工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:10:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '染色中')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '完工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 12:00:00',
  source: 'PDA',
  completedQty: 80,
  lossQty: 3,
})
const completed = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(completed.status, '染色完成')
assert.equal(completed.completedQty, 80)
assert.equal(completed.lossQty, 3)

assert.equal(isDyeWorkOrderHighRiskStatusChange('染色完成', '等待处理'), true)
updateDyeWorkOrderFromPfos(order.dyeOrderId, {
  expectedVersion: completed.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 12:10:00',
  status: '等待处理',
  plannedFinishAt: '2026-07-20 18:00:00',
  factoryId: order.dyeFactoryId,
  factoryName: order.dyeFactoryName,
  receiverName: order.receiverName,
  shade: '深色',
  temperature: 205,
  rawMaterialQty: 83,
  rawMaterialRollCount: 2,
  completedQty: 80,
  lossQty: 3,
  remark: '主管回退复核',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')
assert.throws(
  () => updateDyeWorkOrderFromPfos(order.dyeOrderId, {
    expectedVersion: completed.version,
    operatorName: '染厂主管',
    operatedAt: '2026-07-16 12:11:00',
    status: '取消',
    plannedFinishAt: '2026-07-20 18:00:00',
    factoryId: order.dyeFactoryId,
    factoryName: order.dyeFactoryName,
    receiverName: order.receiverName,
    shade: '深色',
    temperature: 205,
    rawMaterialQty: 83,
    rawMaterialRollCount: 2,
    completedQty: 80,
    lossQty: 3,
    remark: '过期版本',
  }),
  /已被其他操作更新/,
)

const logs = listDyeWorkOrderOnlineLogs(order.dyeOrderId)
assert(logs.some((log) => log.action === 'PFOS人工编辑'))
assert(logs.some((log) => log.action === '开工'))
assert(logs.every((log) => log.workOrderNo === order.dyeOrderNo))

const rows = listDyeWorkOrderOnlineRows()
assert(rows.length >= 8, '染色加工单线上列表演示数据不足')
assert(rows.every((row) => row.workOrderNo === row.platformWorkOrderNo), '列表只能使用平台加工单号')
assert(rows.some((row) => row.productImageUrl && row.materialImageUrl), '列表需要商品图和面料图')
assert(rows.some((row) => row.status === '部分入库' && row.pendingInboundQty > 0), '列表需要部分入库样本')
assert(rows.some((row) => row.isOverdue && !['取消', '已完成'].includes(row.status)), '列表需要超期未完结样本')

const filtered = filterDyeWorkOrderOnlineRows(rows, { statuses: ['染色中'] })
assert(filtered.length > 0, '列表需要染色中样本')
assert(filtered.every((row) => row.status === '染色中'))
const summary = getDyeWorkOrderOnlineSummary(rows)
assert(summary.plannedQtyByUnit.some((item) => item.unit === 'Yard'))
assert(buildDyeWorkOrderCsv(rows, '备料').startsWith('\uFEFF'))
assert(buildDyeWorkOrderCsv(rows, '超期未完结').includes('平台加工单号'))

console.log('dye work order online alignment check passed')
