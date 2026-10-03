import assert from 'node:assert/strict'
import test from 'node:test'
import { assignPcsRecordPositions } from '../../src/data/pcs-record-position.ts'

test('PCS 前插多个新记录保留全部既有位置，重复保存不产生位置变化', () => {
  const original = new Map(Array.from({ length: 200 }, (_, i) => [`old-${i}`, i]))
  const ids = ['new-1', 'new-2', ...original.keys()]
  const next = assignPcsRecordPositions(ids, original)
  for (const [id, position] of original) assert.equal(next.get(id), position)
  assert.deepEqual([...next].sort((a, b) => a[1] - b[1]).map(([id]) => id), ids)
  assert.deepEqual(assignPcsRecordPositions(ids, next), next)
})

test('PCS 单条置顶、居中插入、删除保持实际顺序且不移动其余记录', () => {
  const original = new Map([['a', 0], ['b', 1], ['c', 2], ['d', 3]])
  const moved = assignPcsRecordPositions(['c', 'a', 'b', 'd'], original)
  for (const id of ['a', 'b', 'd']) assert.equal(moved.get(id), original.get(id))
  assert.ok(moved.get('c')! < moved.get('a')!)
  const inserted = assignPcsRecordPositions(['c', 'a', 'new', 'b', 'd'], moved)
  assert.ok(inserted.get('new')! > inserted.get('a')! && inserted.get('new')! < inserted.get('b')!)
  assert.deepEqual(assignPcsRecordPositions(['a', 'b', 'd'], inserted), new Map([['a', 0], ['b', 1], ['d', 3]]))
  assert.deepEqual(assignPcsRecordPositions(['a', 'b'], new Map()), new Map([['a', 0], ['b', 1]]))
})
