import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { buildAccessoryWorkflowMockRecords } from '../../src/data/wls/accessory-warehouse-mock.ts'
import { mergeAccessoryMockRecords, accessoryRecord } from '../../src/data/wls/accessory-warehouse-records.ts'
import { ACCESSORY_WAREHOUSE_DEMOS } from '../../src/data/wls/accessory-warehouse-demo.ts'
import { ACCESSORY_WORKFLOW_SCENES } from '../../src/data/wls/accessory-warehouse-upstream-fixtures.ts'
import { buildAccessoryDispatchChange, buildAccessoryReceiveChange, type AccessoryReceipt } from '../../src/data/wls/accessory-warehouse-commands.ts'
import { listAccessoryWarehouseLocations } from '../../src/data/wls/accessory-warehouse-master.ts'
import { getAccessoryStockId, type AccessoryStock } from '../../src/data/wls/accessory-warehouse-stock.ts'
import type { AccessoryPreparation, AccessoryTransfer, AccessoryPickup } from '../../src/data/wls/accessory-warehouse-flow.ts'
import type { SewingMaterialHandoverEvent } from '../../src/data/fcs/sewing-material-handover.ts'

const baseline = buildAccessoryWorkflowMockRecords()
const list = <T>(kind: string) => baseline.filter(row => row.collection === `accessory-warehouse:${kind}`).map(row => row.value as T)

test('AM-01/02 旧三单不变，新14场景来源身份唯一，冻结BOM/图片齐全', () => {
  assert.equal(ACCESSORY_WAREHOUSE_DEMOS.length, 17)
  assert.equal(ACCESSORY_WORKFLOW_SCENES.length, 14)
  assert.equal(new Set(baseline.map(row => row.id)).size, baseline.length)
  assert.equal(list('preparation').length, 14)
  for (const fixture of ACCESSORY_WAREHOUSE_DEMOS) {
    assert.equal(fixture.order.demandId, fixture.demand.demandId)
    assert.equal(fixture.order.techPackSnapshot?.snapshotId, fixture.techPack.snapshotId)
    assert.equal(fixture.demand.skuLines.reduce((sum, row) => sum + row.qty, 0), 100)
    assert.ok(existsSync(`public${fixture.demand.imageUrl}`))
    for (const bom of fixture.techPack.bomItems) assert.ok(existsSync(`public${bom.materialImageUrl}`))
  }
  const preps = list<AccessoryPreparation>('preparation')
  assert.equal(preps.find(row => row.productionOrderId.endsWith('C01'))?.status, '配料中')
  assert.ok(preps.find(row => row.productionOrderId.endsWith('C01'))?.lines.every(row => row.preparedQty === row.requiredQty / 2))
  assert.equal(list<AccessoryTransfer>('transfer').find(row => row.productionOrderId.endsWith('C02'))?.status, '待定调入方')
  assert.deepEqual(buildAccessoryWorkflowMockRecords(), baseline, '固定场景可重复读取，不被调用方修改')
})

test('AM-03/04/06 库存按固定盘点及来源事件守恒，所有调拨整单、收货库位同仓，后道排除四类', () => {
  const transfers = list<AccessoryTransfer>('transfer'), receipts = list<AccessoryReceipt>('receipt')
  for (const transfer of transfers) {
    if (transfer.kind === 'GTP_TO_SITE') assert.equal(transfer.lines.length, 6)
    else assert.deepEqual(transfer.lines.map(row => row.purpose), ['其他', '其他'])
    if (transfer.status === '已收货') {
      const receipt = receipts.find(row => row.transferId === transfer.id)!
      assert.equal(receipt.status, '已收货')
      assert.equal(receipt.lines.length, transfer.lines.length)
      for (const line of transfer.lines) assert.equal(receipt.lines.find(row => row.lineId === line.id)?.qty, line.qty)
    }
  }
  for (const stock of list<AccessoryStock>('stock')) {
    assert.equal(stock.id, getAccessoryStockId(stock.warehouseCode, stock.locationId, stock.materialSku, stock.unit))
    const initial = stock.warehouseCode === 'WH-FITTING-001' ? stock.materialSku.endsWith('BUTTON') ? 1200 : stock.materialSku.endsWith('THREAD') ? 12 : 600 : 0
    const refs = stock.sourceRefs || []
    const delta = refs.reduce((sum, ref) => sum + (ref.kind === 'TRANSFER_IN' ? ref.qty : ['TRANSFER_OUT', 'PICKUP_OUT'].includes(ref.kind) ? -ref.qty : 0), 0)
    assert.equal(stock.onHandQty, initial + delta)
    assert.equal(stock.reservedQty, refs.filter(ref => ref.kind === 'RESERVATION').reduce((sum, ref) => sum + ref.qty, 0))
  }
})

test('AM-05 两仓待领/部分/完成与同任务实交账、数量及库存一致', () => {
  const pickups = list<AccessoryPickup>('pickup'), events = list<SewingMaterialHandoverEvent>('sewing-handover')
  assert.equal(pickups.length, 6)
  for (const site of ['HILON-2', 'WH-FITTING-MAHAMERU']) assert.deepEqual(pickups.filter(row => row.warehouseCode === site).map(row => row.status), ['待领料', '领料中', '已领料'])
  for (const pickup of pickups) {
    assert.deepEqual(pickup.lines.map(row => row.purpose), ['价格吊牌', '品牌吊牌', '吊粒', '车缝线'])
    const handed = events.filter(row => row.assignmentId === pickup.assignmentId).flatMap(row => row.lines)
    for (const line of pickup.lines) assert.equal(handed.filter(row => row.materialCode === line.materialSku).reduce((sum, row) => sum + row.actualQty, 0), line.handedQty)
    assert.ok(list<any>('sewing-slip').some(row => row.assignmentId === pickup.assignmentId && row.status === 'CURRENT'))
  }
})

test('AM-07 保存的零余额、修改及删除优先，静态基线本身保持不变', () => {
  const original = list<AccessoryStock>('stock')[0]
  const zero = { ...original, onHandQty: 0, reservedQty: 0, sourceRefs: [], version: 50 }
  const saved = accessoryRecord('stock', original.id, zero)
  const merged = mergeAccessoryMockRecords(baseline, [saved])
  assert.deepEqual(merged.find(row => row.id === saved.id)?.value, zero)
  const deleted = { id: saved.id, collection: 'accessory-warehouse:tombstone', value: { id: saved.id, deleted: true } }
  assert.equal(mergeAccessoryMockRecords(baseline, [deleted]).some(row => row.id === saved.id), false)
  assert.notEqual((baseline.find(row => row.id === saved.id)!.value as AccessoryStock).onHandQty, 0)
})

test('AM-03 必须整单、同仓同库位；缺操作人和重复收货仍阻断，待出库可用原库存发出', () => {
  const transfers = list<AccessoryTransfer>('transfer'), stocks = list<AccessoryStock>('stock')
  const waiting = transfers.find(row => row.id === 'AW-MOCK:H01:GTP')!
  const sent = buildAccessoryDispatchChange({ transfer: waiting, stocks, actor: { warehouseCode: waiting.fromWarehouse, role: '仓管', name: '验收仓管' }, commandId: 'check-send', at: '2026-10-22' })
  assert.equal(sent.transfer.status, '已出库待收货')
  const transfer = transfers.find(row => row.id === 'AW-MOCK:H02:GTP')!, receipt = list<AccessoryReceipt>('receipt').find(row => row.transferId === transfer.id)!
  const locations = listAccessoryWarehouseLocations(transfer.toWarehouse!)
  const input = { transfer, receipt, stocks, locations, actor: { warehouseCode: transfer.toWarehouse!, role: '仓管' as const, name: '验收仓管' }, commandId: 'check-receive', at: '2026-10-22', lines: transfer.lines.map(row => ({ lineId: row.id, qty: row.qty, locationId: locations[0].id })) }
  assert.throws(() => buildAccessoryReceiveChange({ ...input, lines: input.lines.slice(1) }), /整单|分批/)
  assert.throws(() => buildAccessoryReceiveChange({ ...input, lines: input.lines.map((row, i) => i ? row : { ...row, qty: row.qty - 1 }) }), /实收与应收/)
  assert.throws(() => buildAccessoryReceiveChange({ ...input, lines: input.lines.map(row => ({ ...row, locationId: 'OTHER-WAREHOUSE' })) }), /本仓启用库位/)
  assert.throws(() => buildAccessoryReceiveChange({ ...input, actor: { ...input.actor, name: '' } }), /本仓仓管/)
  const result = buildAccessoryReceiveChange(input)
  assert.equal(result.receipt.status, '已收货')
  assert.throws(() => buildAccessoryReceiveChange({ ...input, transfer: result.transfer, receipt: result.receipt }), /失效|不能重复/)
})
