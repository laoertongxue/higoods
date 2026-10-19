import test from 'node:test'
import assert from 'node:assert/strict'
import { accessoryReceiptForTransfer, buildAccessoryDispatchChange, buildAccessoryReceiveChange } from '../../src/data/wls/accessory-warehouse-commands.ts'
import { getAccessoryStockId, type AccessoryStock } from '../../src/data/wls/accessory-warehouse-stock.ts'
import type { AccessoryTransfer } from '../../src/data/wls/accessory-warehouse-flow.ts'

const at = '2026-10-19T09:00:00.000Z'
function transfer(): AccessoryTransfer {
  return { id: 'T1', kind: 'GTP_TO_SITE', preparationId: 'P1', productionOrderId: 'PO1', fromWarehouse: 'WH-FITTING-001', toWarehouse: 'HILON-2', status: '待出库', version: 1, createdAt: at, createdBy: 'GTP仓管', history: [], lines: [
    { id: 'L1', materialSku: 'ZIP-01', materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg', color: '黑色', spec: '60cm', unit: '条', purpose: '其他', requiresCutting: false, qty: 60, fromLocationId: 'GTP-A-01' },
    { id: 'L2', materialSku: 'ZIP-01', materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg', color: '黑色', spec: '60cm', unit: '条', purpose: '其他', requiresCutting: false, qty: 40, fromLocationId: 'GTP-A-01' },
  ] }
}
function stock(qty = 100): AccessoryStock {
  return { id: getAccessoryStockId('WH-FITTING-001', 'GTP-A-01', 'ZIP-01', '条'), warehouseCode: 'WH-FITTING-001', locationId: 'GTP-A-01', materialSku: 'ZIP-01', unit: '条', onHandQty: qty, reservedQty: qty, version: 1, sourceRefs: [{ kind: 'RESERVATION', sourceId: 'P1', qty }] }
}
const gtp = { warehouseCode: 'WH-FITTING-001', role: '仓管' as const, name: 'GTP仓管' }
const hilon = { warehouseCode: 'HILON-2', role: '仓管' as const, name: 'HILON仓管' }
test('整单出库将真实单据、聚合库存和审计放入同一change；不修改输入', () => {
  const before = transfer(), stocks = [stock()], original = structuredClone({ before, stocks })
  const result = buildAccessoryDispatchChange({ transfer: before, stocks, actor: gtp, commandId: 'OUT-1', at })
  assert.equal(result.transfer.status, '已出库待收货')
  assert.equal(result.change.puts.length, 3)
  const inventory = result.change.puts.find(row => row.collection === 'accessory-warehouse:stock')!.value as AccessoryStock
  assert.equal(inventory.onHandQty, 0); assert.equal(inventory.reservedQty, 0)
  assert.deepEqual({ before, stocks }, original)
})
test('同SKU相同位置的多行不能重复使用一份余额；另一仓/PPIC不能代确认', () => {
  assert.throws(() => buildAccessoryDispatchChange({ transfer: transfer(), stocks: [stock(90)], actor: gtp, commandId: 'OUT-2', at }), /不足/)
  assert.throws(() => buildAccessoryDispatchChange({ transfer: transfer(), stocks: [stock()], actor: hilon, commandId: 'OUT-2', at }), /本仓/)
  assert.throws(() => buildAccessoryDispatchChange({ transfer: transfer(), stocks: [stock()], actor: { ...gtp, role: 'PPIC' }, commandId: 'OUT-2', at }), /本仓/)
})
test('一次收货上架聚合相同位置的100条且关联原单及当前接收事项', () => {
  const dispatched = buildAccessoryDispatchChange({ transfer: transfer(), stocks: [stock()], actor: gtp, commandId: 'OUT-3', at }).transfer
  const receipt = accessoryReceiptForTransfer(dispatched)!
  const result = buildAccessoryReceiveChange({ transfer: dispatched, receipt, stocks: [], actor: hilon, commandId: 'IN-1', at,
    lines: dispatched.lines.map(line => ({ lineId: line.id, qty: line.qty, locationId: 'HILON-A-01' })), locations: [{ id: 'HILON-A-01', warehouseCode: 'HILON-2', enabled: true }] })
  assert.equal(result.transfer.status, '已收货'); assert.equal(result.receipt.status, '已收货')
  assert.equal(result.change.puts.length, 4)
  const inventory = result.change.puts.find(row => row.collection === 'accessory-warehouse:stock')!.value as AccessoryStock
  assert.equal(inventory.onHandQty, 100); assert.equal(inventory.locationId, 'HILON-A-01')
  assert.equal(receipt.status, '待收货')
})
test('差异、过期接收及未出库均不能生成半套接收change', () => {
  const current = transfer(), receipt = accessoryReceiptForTransfer(current)!
  const input = { transfer: current, receipt, stocks: [], actor: hilon, commandId: 'IN-2', at, lines: current.lines.map(line => ({ lineId: line.id, qty: line.qty, locationId: 'HILON-A-01' })), locations: [{ id: 'HILON-A-01', warehouseCode: 'HILON-2', enabled: true }] }
  assert.throws(() => buildAccessoryReceiveChange(input), /出库/)
  const dispatched = buildAccessoryDispatchChange({ transfer: current, stocks: [stock()], actor: gtp, commandId: 'OUT-4', at }).transfer
  assert.throws(() => buildAccessoryReceiveChange({ ...input, transfer: dispatched, lines: [{ ...input.lines[0], qty: 59 }, input.lines[1]] }), /整单|数量|差异/)
  assert.throws(() => buildAccessoryReceiveChange({ ...input, transfer: dispatched, receipt: { ...receipt, status: '已取消' } }), /失效/)
})
