import assert from 'node:assert/strict'
import test from 'node:test'
import { sameDyeExecutionSnapshot } from '../../src/data/fcs/dye-execution-snapshot.ts'
const original = () => ({ version: 1, state: { workOrders: [['A', { dyeOrderId: 'A', qty: 5 }], ['B', { dyeOrderId: 'B', qty: 8 }]], nodeRecords: [['A', [{ nodeCode: 'DYE', inputQty: 5 }, { nodeCode: 'PACK', outputQty: 4 }]]], reviewRecords: [], vatSchedules: [], formulas: [] }, tasks: [{ taskId: 'TA', user: 'A' }, { taskId: 'TB', user: 'B' }], demoOutput: [{ id: 'A', rolls: ['R1', 'R2'] }, { id: 'B', rolls: [] }], demoHandovers: [] })
const raw = JSON.stringify
test('Dye native owner overlays may reorder identified rows without changing a saved result', () => {
  const value = original(), reordered = original(); reordered.state.workOrders.reverse(); reordered.tasks.reverse(); reordered.demoOutput.reverse()
  assert.equal(sameDyeExecutionSnapshot(raw(reordered), raw(value)), true)
})
test('Dye save verification rejects changed quantities, operators, units and metadata', () => {
  const source = raw(original())
  for (const change of [(d: any) => { d.state.workOrders[0][1].qty = 6 }, (d: any) => { d.tasks[0].user = 'another' }, (d: any) => { d.version = 2 }, (d: any) => { d.unit = 'kg' }, (d: any) => { delete d.demoHandovers }]) { const value = original(); change(value); assert.equal(sameDyeExecutionSnapshot(raw(value), source), false) }
})
test('Dye identified collections reject duplicates and missing rows', () => {
  const source = raw(original()), duplicate = original(), missing = original()
  duplicate.tasks[1] = duplicate.tasks[0]; missing.state.workOrders.pop()
  assert.equal(sameDyeExecutionSnapshot(raw(duplicate), source), false)
  assert.equal(sameDyeExecutionSnapshot(raw(missing), source), false)
  assert.equal(sameDyeExecutionSnapshot(null, source), false)
  assert.equal(sameDyeExecutionSnapshot('{', source), false)
})
test('Dye verification retains actual node and roll ordering inside each record', () => {
  const source = raw(original()), nodes = original(), rolls = original()
  ;(nodes.state.nodeRecords[0][1] as any[]).reverse(); rolls.demoOutput[0].rolls.reverse()
  assert.equal(sameDyeExecutionSnapshot(raw(nodes), source), false)
  assert.equal(sameDyeExecutionSnapshot(raw(rolls), source), false)
})
