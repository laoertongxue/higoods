import assert from 'node:assert/strict'
import test from 'node:test'
import { splitFactoryProcessLedger, rebuildFactoryProcessLedger, sameProcessLedgerRow, FACTORY_PROCESS_KEYS, WATER_EXECUTION_STORAGE_KEY } from '../../src/data/fcs/factory-process-storage.ts'
import { CENTRAL_EXECUTION_LEGACY_KEYS } from '../../src/data/fcs/central-execution-record-bridge.ts'

test('C06.04: water records keep the original work order identity independently of its task reference', () => {
  const raw = JSON.stringify({ version: 1, orders: [
    { waterOrderId: 'WATER-OUTPUT-DEMO-1', taskId: 'TASK-WATER-OUTPUT-DEMO-1', completedQty: 240 },
    { waterOrderId: 'WATER-OUTPUT-DEMO-2', taskId: 'TASK-WATER-OUTPUT-DEMO-2', completedQty: 180 },
  ] })
  const rows = splitFactoryProcessLedger(raw)
  assert.deepEqual(rows.map(row => row.key), ['WATER-OUTPUT-DEMO-1', 'WATER-OUTPUT-DEMO-2'])
  const changed = { ...rows[0], value: { ...rows[0].value as object, taskId: 'TASK-RESTORED', completedQty: 200 } }
  const result = JSON.parse(rebuildFactoryProcessLedger(raw, [changed])!)
  assert.equal(result.orders.length, 2)
  assert.equal(result.orders[0].waterOrderId, 'WATER-OUTPUT-DEMO-1')
  assert.equal(result.orders[0].completedQty, 200)
  assert.deepEqual(result.orders[1], JSON.parse(raw).orders[1], 'another water order is not rewritten as the changed physical object')
})

test('C06.02: water remains one of the process ledger keys after washing retirement', () => {
  assert.equal(FACTORY_PROCESS_KEYS.includes(WATER_EXECUTION_STORAGE_KEY), true)
  assert.equal(CENTRAL_EXECUTION_LEGACY_KEYS.includes(WATER_EXECUTION_STORAGE_KEY), true)
})

test('common row-only dye overlays retain the required empty reference collections without persisting seeds', () => {
  const raw = rebuildFactoryProcessLedger(null, [{ path: 'state.workOrders', key: 'DYE-ONLY-CHANGE', tuple: true, value: { dyeOrderId: 'DYE-ONLY-CHANGE' } }])!
  const value = JSON.parse(raw)
  assert.deepEqual(Object.keys(value.state).sort(), ['formulas', 'nodeRecords', 'reviewRecords', 'vatSchedules', 'workOrders'])
  assert.equal(value.state.workOrders.length, 1)
  assert.deepEqual(value.tasks, [])
  assert.deepEqual(value.state.nodeRecords, [])
})

test('reading a water source with reordered object fields does not adopt an unmodified static order', () => {
  const base = { path: 'orders', key: 'WATER-SAME', tuple: false, value: { inputQty: 10, status: 'WAIT_HANDOVER', rows: [{ qty: 4, unit: '米' }, { qty: 6, unit: '米' }] } }
  const reordered = { ...base, value: { rows: [{ unit: '米', qty: 4 }, { unit: '米', qty: 6 }], status: 'WAIT_HANDOVER', inputQty: 10 } }
  assert.equal(sameProcessLedgerRow(base, reordered), true)
  assert.equal(sameProcessLedgerRow(base, { ...base, value: { ...base.value, inputQty: 9 } }), false)
  assert.equal(sameProcessLedgerRow(base, { ...base, value: { ...base.value, rows: [...base.value.rows].reverse() } }), false)
  assert.equal(sameProcessLedgerRow(base, { ...reordered, key: 'WATER-OTHER' }), false)
  assert.equal(sameProcessLedgerRow(base, undefined), false)
})
