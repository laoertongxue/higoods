import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generatePmsInventoryOrder,
  getPmsInventoryMonitorRow,
  listPmsInventoryMonitor,
  listPmsInventoryOrders,
  updatePmsInventoryRule,
} from '../../src/data/pms/inventory-monitor.ts'
import {
  consumePmsTransitFilter,
  filterPmsTransitReceipts,
  getPmsTransitDashboard,
  listPmsTransitOrderChecks,
  listPmsTransitPreparationTasks,
  listPmsTransitReceipts,
  setPmsTransitFilter,
} from '../../src/data/pms/transit-warehouse.ts'
import { listPmsSettingDictionaries, listPmsSettingRoles, listPmsSettingUsers } from '../../src/data/pms/settings.ts'
import { PMS_BUYER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('库存监控触发线与建议量公式，规则异常阻断建单', () => {
  const row = getPmsInventoryMonitorRow('INV-2026-0001')
  assert.ok(row)
  assert.equal(row.triggerLine, 1000)
  assert.equal(row.suggestedQty, 2200)
  assert.equal(row.ruleStatus, '待补货')
  assert.equal(row.canTransfer, true)
  assert.equal(getPmsInventoryMonitorRow('INV-2026-0004')?.suggestedQty, 0)
  assert.equal(getPmsInventoryMonitorRow('INV-2026-0005')?.ruleStatus, '规则异常')
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0005', '采购单', 1, PMS_BUYER_ACTOR), PmsDomainError)
  updatePmsInventoryRule('INV-2026-0005', { triggerRatio: 0.5 }, PMS_BUYER_ACTOR)
  assert.equal(getPmsInventoryMonitorRow('INV-2026-0005')?.ruleStatus, '正常')
})

test('建单数量不得超过建议量，调拨与采购资格分别阻断', () => {
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0004', '采购单', 1, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0003', '调拨单', 1, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0003', '采购单', 60001, PMS_BUYER_ACTOR), PmsDomainError)
  const order = generatePmsInventoryOrder('INV-2026-0003', '采购单', 60000, PMS_BUYER_ACTOR)
  assert.equal(order.orderType, '采购单')
  assert.equal(order.qty, 60000)
  assert.equal(listPmsInventoryOrders().length, 1)
  assert.equal(listPmsInventoryMonitor().length, 5)
})

test('中转看板指标、分布与筛选跳转规则', () => {
  const dashboard = getPmsTransitDashboard()
  assert.equal(dashboard.metrics.length, 9)
  assert.equal(dashboard.metrics.some((metric) => metric.label === '收货中'), true)
  assert.equal(dashboard.trend.length, 7)
  assert.equal(dashboard.exceptions.length, 1)
  assert.equal(dashboard.statusDistribution.reduce((sum, item) => sum + item.value, 0), listPmsTransitReceipts().length)
  assert.equal(filterPmsTransitReceipts('pending').length, 3)
  assert.equal(filterPmsTransitReceipts('receiving').length, 1)
  assert.equal(filterPmsTransitReceipts('exception').length, 1)
  assert.equal(filterPmsTransitReceipts('warehouse:广州中转仓').length, 5)
  setPmsTransitFilter('exception')
  assert.equal(consumePmsTransitFilter(), 'exception')
  assert.equal(consumePmsTransitFilter(), '')
})

test('生产单校验与配料任务只读数据完整，系统设置结果为 8/6/10', () => {
  assert.equal(listPmsTransitOrderChecks().length, 6)
  assert.ok(listPmsTransitOrderChecks().every((check) => ['缺货', '未收齐', '已收齐'].includes(check.receivedStatus)))
  assert.equal(listPmsTransitPreparationTasks().length, 5)
  assert.ok(listPmsTransitPreparationTasks().every((task) => ['已收齐配料', '未收齐配料'].includes(task.type)))
  assert.equal(listPmsSettingUsers().length, 8)
  assert.equal(listPmsSettingRoles().length, 6)
  assert.equal(listPmsSettingDictionaries().length, 10)
  assert.ok(listPmsSettingDictionaries().every((dictionary) => dictionary.referenceCount >= 0))
})
