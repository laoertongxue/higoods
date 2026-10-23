import assert from 'node:assert/strict'
import test from 'node:test'
import { isWaterSolubleRecordTarget, waterSolubleCommandGuardKeys } from '../../src/data/fcs/water-soluble-records.ts'
import { listWaterSolubleWorkOrders } from '../../src/data/fcs/water-soluble-task-domain.ts'

test('C06.04: water command dispatch resolves original orders, current tasks and existing dispatch documents', () => {
  const orders = listWaterSolubleWorkOrders()
  assert.equal(orders.length, 7)
  const original = orders.find(order => order.waterOrderId === 'WATER-OUTPUT-DEMO-4')!
  assert.equal(isWaterSolubleRecordTarget(original.waterOrderId), true)
  assert.equal(isWaterSolubleRecordTarget({ taskId: original.taskId }), true)
  assert.equal(isWaterSolubleRecordTarget([{ orderId: original.waterOrderId, rollIds: ['physical roll'] }]), true)
  assert.equal(isWaterSolubleRecordTarget('SJ-SR-20260914-001'), true)
})

test('C06.04: a prefix or a display reference does not adopt a foreign document', () => {
  for (const target of ['WATER-NOT-AN-ORDER', 'TASK-WATER-UNKNOWN', 'TASK-SR-UNKNOWN', 'SJ-SR-UNKNOWN', 'F090', 'PO-202603-081', 'DYE-DISPATCH-DEMO-3']) {
    assert.equal(isWaterSolubleRecordTarget(target), false, target)
  }
})


test('C06.15: command versions cover selected original orders and all existing document lines only', () => {
  assert.deepEqual(waterSolubleCommandGuardKeys([{orderId:'WATER-OUTPUT-DEMO-4'},{orderId:'WATER-OUTPUT-DEMO-2'},{taskId:'TASK-WATER-OUTPUT-DEMO-4'}]), ['water/WATER-OUTPUT-DEMO-2','water/WATER-OUTPUT-DEMO-4'])
  assert.deepEqual(waterSolubleCommandGuardKeys('SJ-SR-20260914-001'), ['water/WATER-OUTPUT-DEMO-3'])
  assert.deepEqual(waterSolubleCommandGuardKeys({factoryId:'F090',label:'WATER-NOT-AN-ORDER'}), [])
})
