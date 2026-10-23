import assert from 'node:assert/strict'
import test from 'node:test'
import { printIncomingRollMatches, printIncomingSourceRows } from '../../src/pages/central-pda/print-scan.ts'
type Incoming = Parameters<typeof printIncomingRollMatches>[0][number]
const row = (key: string, available: boolean, orderId = 'same-order') => ({ key, orderId,
  line: { rolls: [{ barcode: 'ROLL-A', yard: 10 }] }, remainingRolls: available ? [{ barcode: 'ROLL-A', yard: 10 }] : [],
}) as Incoming

test('C04.15: old received source does not hide a unique new physical source with the same code', () => {
  const next = row('next-source|line', true)
  assert.deepEqual(printIncomingRollMatches([row('old-source|line', false), next], 'ROLL-A'), { available: [next], received: false })
})
test('C04.15: two available sources remain ambiguous even when both belong to one order', () => {
  const first = row('source-A|line', true), second = row('source-B|line', true)
  assert.deepEqual(printIncomingRollMatches([first, row('old|line', false), second], 'ROLL-A'), { available: [first, second], received: false })
})
test('C04.15: received-only and wrong codes stay distinct and never supply an available source', () => {
  assert.deepEqual(printIncomingRollMatches([row('old|line', false)], 'ROLL-A'), { available: [], received: true })
  assert.deepEqual(printIncomingRollMatches([row('next|line', true)], 'WRONG'), { available: [], received: false })
})

test('C04.18: source IDs and document codes select original lines, not the shared order identity', () => {
  const first = { ...row('source-A|line', true), source: { id: 'source-A', documentNo: 'DOC-A' }, line: { material: { batchNo: 'SAME-LOT' } } } as Incoming
  const second = { ...row('source-B|line', true), source: { id: 'source-B', documentNo: 'DOC-B' }, line: { material: { batchNo: 'SAME-LOT' } } } as Incoming
  assert.deepEqual(printIncomingSourceRows([first, second], 'DOC-B'), [second])
  assert.deepEqual(printIncomingSourceRows([first, second], 'source-A'), [first])
  assert.deepEqual(printIncomingSourceRows([first, second], 'SAME-LOT'), [first, second])
  assert.deepEqual(printIncomingSourceRows([first, second], 'same-order'), [])
})
