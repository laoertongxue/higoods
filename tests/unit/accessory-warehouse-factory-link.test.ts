import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAccessoryFactoryLinkChange } from '../../src/data/wls/accessory-warehouse-factory-link.ts'
import { accessoryRecord } from '../../src/data/wls/accessory-warehouse-records.ts'
import { completeAccessoryPreparation, type AccessoryPreparation, type AccessoryTransfer } from '../../src/data/wls/accessory-warehouse-flow.ts'
import { accessoryReceiptForTransfer } from '../../src/data/wls/accessory-warehouse-commands.ts'
import { buildCompletedAccessoryTransferCutover } from '../../src/data/wls/accessory-warehouse-transfer-cutover.ts'
import { ACCESSORY_WAREHOUSE_DEMOS } from '../../src/data/wls/accessory-warehouse-demo.ts'
import type { CuttingStoredRecord } from '../../src/data/fcs/cutting/cutting-record-repository.ts'

const at = '2026-10-19T12:00:00Z'
function preparation(): AccessoryPreparation {
  return { id: 'PREP-A', productionOrderId: 'PO-A', productionOrderNo: 'PO-A', styleName: '演示款', styleImageUrl: '/shirt-sample.jpg',
    techPackVersion: 'V1', cuttingFactoryId: 'SEA-CUTTING-001', cuttingFactoryName: 'sea cutting', version: 4, status: '已配齐',
    completedAt: '2026-10-18T06:00:00Z', completedBy: '原仓管', completionVersion: 4, remark: '', history: [], lines: [
      { id: 'LINE-A', materialSku: 'AW-DEMO-BUTTON', materialName: '纽扣', imageUrl: '/materials/accessory-button.jpg', color: '标准', spec: '', unit: '粒',
        requiredQty: 200, preparedQty: 200, availableQty: 1000, locationId: 'GTP-A', purpose: '其他', requiresCutting: false },
    ] }
}
function setup(status: AccessoryTransfer['status'] = '待出库') {
  const prep = preparation(), transfer = completeAccessoryPreparation(prep, { at, by: '仓管', transferId: 'T-A' }).transfer
  transfer.status = status
  if (status === '已收货') transfer.lines[0].toLocationId = 'HILON-A'
  const receipt = accessoryReceiptForTransfer(transfer)!
  const records = [accessoryRecord('preparation', prep.id, prep), accessoryRecord('transfer', transfer.id, transfer), accessoryRecord('receipt', receipt.id, receipt)]
  return { prep, transfer, receipt, records }
}
function changed(records: CuttingStoredRecord[], commandId = 'CHANGE-1', factoryId = 'SEA-CUTTING-002', name = 'sea cutting2') {
  const task = structuredClone(ACCESSORY_WAREHOUSE_DEMOS[0].tasks[0])
  task.productionOrderId = 'PO-A'; task.assignedFactoryId = factoryId; task.assignedFactoryName = name
  task.dispatchRemark = '改裁剪工厂'
  return buildAccessoryFactoryLinkChange({ records, tasks: [task], assignments: [], factories: [{ id: factoryId, name }], commandId, at, by: '计划员' })
}
const values = <T>(records: CuttingStoredRecord[], kind: string) => records.filter(row => row.collection === `accessory-warehouse:${kind}`).map(row => row.value as T)
test('未出GTP改厂保持原调拨身份，取消原预入库并生成不同版本的新预入库', () => {
  const original = setup(), result = changed(original.records)
  const transfer = values<AccessoryTransfer>(result.puts, 'transfer')[0]
  assert.equal(transfer.id, original.transfer.id); assert.equal(transfer.toWarehouse, 'WH-FITTING-MAHAMERU')
  const receipts = values<any>(result.puts, 'receipt')
  assert.equal(receipts.find(row => row.id === original.receipt.id).status, '已取消')
  assert.equal(receipts.find(row => row.status === '待收货').warehouseCode, 'WH-FITTING-MAHAMERU')
  assert.notEqual(receipts[0].id, receipts[1].id)
  assert.equal(original.receipt.status, '待收货')
})
test('待定分配只补原单目的方，不另建第二张首次调拨；无变化不重复写', () => {
  const original = setup(); original.prep.cuttingFactoryId = null; original.prep.cuttingFactoryName = null
  original.transfer.toWarehouse = null; original.transfer.status = '待定调入方'
  const records = [accessoryRecord('preparation', original.prep.id, original.prep), accessoryRecord('transfer', original.transfer.id, original.transfer)]
  const result = changed(records)
  assert.equal(values<AccessoryTransfer>(result.puts, 'transfer')[0].id, original.transfer.id)
  const merged = new Map(records.map(row => [row.id, row])); result.puts.forEach(row => merged.set(row.id, row))
  assert.equal(changed([...merged.values()], 'UNCHANGED').puts.length, 0)
})
test('在途改厂保留原目的仓与原待收，只安排等待原仓收货', () => {
  const original = setup('已出库待收货'), result = changed(original.records)
  assert.equal(values(result.puts, 'transfer').length, 0)
  assert.equal(values(result.puts, 'receipt').length, 0)
  assert.equal(values<any>(result.puts, 'change')[0].status, '等待原仓收货')
  assert.equal(original.transfer.toWarehouse, 'HILON-2')
  assert.throws(() => changed([...original.records, ...result.puts], 'SECOND'), /原仓尚待收货/)
})
test('已收货改厂新建仓间调拨，旧接收记录不改写；改回原厂使用新身份', () => {
  const original = setup('已收货'), first = changed(original.records), onward = values<AccessoryTransfer>(first.puts, 'transfer')[0]
  assert.equal(onward.kind, 'SITE_REASSIGN'); assert.equal(onward.fromWarehouse, 'HILON-2'); assert.equal(onward.toWarehouse, 'WH-FITTING-MAHAMERU')
  assert.equal(onward.sourceTransferId, original.transfer.id); assert.equal(onward.lines[0].fromLocationId, 'HILON-A')
  assert.equal(values<any>(first.puts, 'receipt').some(row => row.id === original.receipt.id), false)
  const merged = new Map(original.records.map(row => [row.id, row])); first.puts.forEach(row => merged.set(row.id, row))
  onward.status = '已收货'; onward.lines[0].toLocationId = 'MAHA-A'; merged.set(accessoryRecord('transfer', onward.id, onward).id, accessoryRecord('transfer', onward.id, onward))
  const second = changed([...merged.values()], 'CHANGE-BACK', 'SEA-CUTTING-001', 'sea cutting')
  const back = values<AccessoryTransfer>(second.puts, 'transfer')[0]
  assert.notEqual(back.id, onward.id); assert.equal(back.toWarehouse, 'HILON-2'); assert.equal(back.fromWarehouse, 'WH-FITTING-MAHAMERU')
})
test('已交给三方或后道不能重调原总量，未发后道单作废且旧凭证失效', () => {
  const original = setup('已收货')
  const pickup = { id: 'PICK', preparationId: original.prep.id, status: '待领料', version: 1, history: [], lines: [{ id: 'L', handedQty: 1 }] }
  assert.throws(() => changed([...original.records, accessoryRecord('pickup', pickup.id, pickup)]), /已有辅料交给/)
  pickup.lines[0].handedQty = 0
  const post = { ...original.transfer, id: 'POST-A', kind: 'SITE_TO_POST', status: '待出库' }
  const slip = { id: 'SLIP-V1', productionOrderId: 'PO-A', status: 'CURRENT' }
  const result = changed([...original.records, accessoryRecord('pickup', pickup.id, pickup), accessoryRecord('transfer', post.id, post), accessoryRecord('sewing-slip', slip.id, slip)])
  assert.equal(values<any>(result.puts, 'pickup')[0].status, '已失效')
  assert.equal(values<any>(result.puts, 'transfer').find(row => row.id === post.id).status, '已作废')
  assert.equal(values<any>(result.puts, 'sewing-slip')[0].status, 'VOIDED')
})
test('显式切换仅补已保存已配齐，保留原人时点，重复无新单，待定仍有身份', () => {
  const prep = preparation(); prep.cuttingFactoryId = null; prep.cuttingFactoryName = null
  const first = buildCompletedAccessoryTransferCutover([prep, { ...prep, id: 'NOT-FULL', status: '配料中' }], [], { at, by: '切换操作员' })
  assert.equal(first.created.length, 1)
  const transfer = values<AccessoryTransfer>(first.change.puts, 'transfer')[0]
  assert.equal(transfer.status, '待定调入方'); assert.equal(transfer.toWarehouse, null)
  assert.equal(prep.completedAt, '2026-10-18T06:00:00Z'); assert.equal(prep.completedBy, '原仓管')
  assert.equal(values(first.change.puts, 'preparation').length, 0)
  assert.equal(buildCompletedAccessoryTransferCutover([prep], [transfer], { at, by: '重跑' }).created.length, 0)
})
