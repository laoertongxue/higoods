import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReplacementFabricDemoState } from '../../src/data/fcs/cutting/replacement-fabric-demo.ts'
import { replacementStateChangeRecords } from '../../src/data/fcs/cutting/replacement-fabric-repository.ts'

test('C01.04c.2: receiving normal material does not persist the unrelated replacement demo read model', () => {
  const before = buildReplacementFabricDemoState()
  assert.ok(before.receipts.length > 0)
  assert.deepEqual(replacementStateChangeRecords(before, structuredClone(before), []), [])
})

test('C01.04c.2: an explicit print persists its own original ticket and new print, without copying previous demo receipts', () => {
  const before = buildReplacementFabricDemoState(), after = structuredClone(before)
  const original = before.prints[0]
  assert.ok(original)
  after.prints.push({ ...original, id: 'QA-actual-new-print', commandId: 'QA-print-command', printedBy: 'Current named printer' })
  const rows = replacementStateChangeRecords(before, after, [])
  assert.equal(rows.length, 2)
  assert.equal(rows.filter(row => row.collection === 'replacement-tickets').length, 1)
  assert.equal(rows.filter(row => row.collection === 'replacement-prints').length, 1)
  assert.equal(rows.find(row => row.collection === 'replacement-prints')?.value, after.prints.at(-1))
  assert.ok(rows.every(row => row.collection !== 'replacement-receipts'))
  assert.deepEqual(replacementStateChangeRecords(after, structuredClone(after), rows), [])
})
