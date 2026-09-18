import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPmsInventoryMonitorRow,
  formatPmsInventoryProcessChain,
  generatePmsInventoryOrder,
  getPmsInventoryMonitorRow,
  listPmsInventoryMonitor,
  PMS_INVENTORY_PROCESSES,
  refreshPmsInventoryStocks,
  updatePmsInventoryRule,
  type PmsInventoryMonitorInput,
  type PmsInventoryProcess,
} from '../../src/data/pms/inventory-monitor.ts'
import { listPmsLogs, PMS_BUYER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

function monitorInput(patch: Partial<PmsInventoryMonitorInput> & { materialCode: string }): PmsInventoryMonitorInput {
  return {
    warehouse: '广州原料仓',
    stockQty: 10,
    safetyThreshold: 100,
    triggerMode: '比例',
    triggerRatio: 0.5,
    fixedTrigger: 0,
    targetStock: 200,
    ...patch,
  }
}

test('工序链按保存顺序生效，合法工序集合固定，非法或重复工序被拒', () => {
  assert.deepEqual(PMS_INVENTORY_PROCESSES, ['染色', '印花', '绣花', '花边'])
  const row = updatePmsInventoryRule('INV-2026-0001', { processChain: ['印花', '染色'] }, PMS_BUYER_ACTOR)
  assert.deepEqual(row.processChain, ['印花', '染色'])
  assert.equal(formatPmsInventoryProcessChain(row.processChain), '印花 → 染色')
  assert.throws(() => updatePmsInventoryRule('INV-2026-0001', { processChain: ['水洗' as PmsInventoryProcess] }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsInventoryRule('INV-2026-0001', { processChain: ['染色', '染色'] }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.deepEqual(getPmsInventoryMonitorRow('INV-2026-0001')?.processChain, ['印花', '染色'])
  const cleared = updatePmsInventoryRule('INV-2026-0001', { processChain: [] }, PMS_BUYER_ACTOR)
  assert.deepEqual(cleared.processChain, [])
  assert.equal(formatPmsInventoryProcessChain(cleared.processChain), '—')
})

test('坯布 SKU 必填，坯布库存为 0 时调拨资格被拒，补足后恢复', () => {
  assert.throws(() => updatePmsInventoryRule('INV-2026-0003', { greigeSpu: 'HG-GR-2609' }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsInventoryRule('INV-2026-0002', { greigeStock: -1 }, PMS_BUYER_ACTOR), PmsDomainError)
  const blocked = updatePmsInventoryRule('INV-2026-0002', { greigeStock: 0 }, PMS_BUYER_ACTOR)
  assert.equal(blocked.canTransfer, false)
  assert.match(blocked.transferBlockReason, /坯布库存/)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0002', '调拨单', 10, PMS_BUYER_ACTOR), PmsDomainError)
  const restored = updatePmsInventoryRule('INV-2026-0002', { greigeStock: 500 }, PMS_BUYER_ACTOR)
  assert.equal(restored.canTransfer, true)
  assert.equal(restored.transferBlockReason, '')
  assert.equal(generatePmsInventoryOrder('INV-2026-0002', '调拨单', 10, PMS_BUYER_ACTOR).qty, 10)
})

test('采购单按勾选 SKU 生成明细，数量与枚举非法被拒', () => {
  const order = generatePmsInventoryOrder('INV-2026-0001', '采购单', 300, PMS_BUYER_ACTOR, {
    supplierName: '广州华盛面料有限公司',
    purchaseRegion: '国内',
    usageType: '成衣破货',
    items: [
      { sku: 'FAB-2026-0001', qty: 100 },
      { sku: 'FAB-2026-0002', qty: 200 },
    ],
  })
  assert.equal(order.orderType, '采购单')
  assert.equal(order.lines.length, 2)
  assert.equal(order.qty, 300)
  assert.equal(order.supplierName, '广州华盛面料有限公司')
  assert.equal(order.purchaseRegion, '国内')
  assert.equal(order.usageType, '成衣破货')
  assert.equal(order.lines[1].sku, 'FAB-2026-0002')
  assert.deepEqual(order.processOrderNos, [])
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0001', '采购单', 10, PMS_BUYER_ACTOR, { items: [{ sku: 'FAB-2026-0001', qty: 2201 }] }), PmsDomainError)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0001', '采购单', 10, PMS_BUYER_ACTOR, { usageType: '返工返修' as never }), PmsDomainError)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0001', '调拨单', 10, PMS_BUYER_ACTOR, { items: [{ sku: 'FAB-2026-0001', qty: 10 }] }), PmsDomainError)
})

test('调拨单可选择调出仓库与调入目标，同步生成加工单号链', () => {
  updatePmsInventoryRule('INV-2026-0001', { processChain: ['染色', '印花'] }, PMS_BUYER_ACTOR)
  const synced = generatePmsInventoryOrder('INV-2026-0001', '调拨单', 100, PMS_BUYER_ACTOR, {
    fromWarehouse: '广州原料仓',
    toWarehouse: '印尼雅加达面辅料仓',
    syncProcessOrder: true,
  })
  assert.equal(synced.fromWarehouse, '广州原料仓')
  assert.equal(synced.toTarget, '印尼雅加达面辅料仓')
  assert.equal(synced.syncProcessOrder, true)
  assert.equal(synced.processOrderNos.length, 2)
  synced.processOrderNos.forEach((orderNo) => assert.match(orderNo, /^PO-2026-\d{4}$/))
  assert.equal(Number(synced.processOrderNos[1].slice(-4)) - Number(synced.processOrderNos[0].slice(-4)), 1)
  const plain = generatePmsInventoryOrder('INV-2026-0001', '调拨单', 100, PMS_BUYER_ACTOR, { toWarehouse: '印尼雅加达面辅料仓' })
  assert.deepEqual(plain.processOrderNos, [])
  assert.equal(plain.syncProcessOrder, false)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0001', '调拨单', 100, PMS_BUYER_ACTOR, { fromWarehouse: '   ' }), PmsDomainError)
  assert.throws(() => generatePmsInventoryOrder('INV-2026-0001', '调拨单', 100, PMS_BUYER_ACTOR, { toWarehouse: '   ' }), PmsDomainError)
})

test('批量刷新库存更新全部监控行与刷新时间并写日志', () => {
  const before = listPmsInventoryMonitor().map((row) => ({ id: row.id, stockQty: row.stockQty, updatedAt: row.updatedAt }))
  const result = refreshPmsInventoryStocks(PMS_BUYER_ACTOR)
  assert.equal(result.count, before.length)
  const rows = listPmsInventoryMonitor()
  rows.forEach((row, index) => {
    assert.equal(row.id, before[index].id)
    assert.ok(row.stockQty > before[index].stockQty)
    assert.equal(row.updatedAt, result.refreshedAt)
  })
  const logs = listPmsLogs('inventory-monitor', 'ALL')
  assert.ok(logs.some((log) => log.action === '批量刷新库存' && log.actorName === PMS_BUYER_ACTOR.name))
})

test('手动添加监控 SKU 校验 SKU 必填与重复，添加后进入列表', () => {
  const countBefore = listPmsInventoryMonitor().length
  assert.throws(() => createPmsInventoryMonitorRow(monitorInput({ materialCode: '   ' }), PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => createPmsInventoryMonitorRow(monitorInput({ materialCode: 'FAB-2026-0001' }), PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => createPmsInventoryMonitorRow(monitorInput({ materialCode: 'ACC-2026-0005', greigeSpu: 'HG-GR-2605' }), PMS_BUYER_ACTOR), PmsDomainError)
  const row = createPmsInventoryMonitorRow(monitorInput({ materialCode: 'ACC-2026-0005', warehouse: '广州辅料仓', stockQty: 50, triggerMode: '固定', fixedTrigger: 100, targetStock: 300, processChain: ['绣花'], greigeSku: 'HG-GR-2605', greigeStock: 0, remark: '手动补充监控' }), PMS_BUYER_ACTOR)
  assert.equal(row.materialCode, 'ACC-2026-0005')
  assert.deepEqual(row.processChain, ['绣花'])
  assert.equal(listPmsInventoryMonitor().length, countBefore + 1)
  assert.equal(getPmsInventoryMonitorRow(row.id)?.materialCode, 'ACC-2026-0005')
  const logs = listPmsLogs('inventory-monitor', row.id)
  assert.ok(logs.some((log) => log.action === '添加监控 SKU'))
  assert.throws(() => createPmsInventoryMonitorRow(monitorInput({ materialCode: 'ACC-2026-0005' }), PMS_BUYER_ACTOR), PmsDomainError)
})
