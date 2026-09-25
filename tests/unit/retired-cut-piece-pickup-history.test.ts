import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRetiredCutPiecePickupHistory } from '../../src/data/fcs/cutting/retired-cut-piece-pickup-history.ts'
import type { CuttingStoredRecord } from '../../src/data/fcs/cutting/cutting-record-repository.ts'

function records(): CuttingStoredRecord[] {
  return [
    { id: 'retired-cut-piece-pickup-versions:V1', collection: 'retired-cut-piece-pickup-versions', value: { versionId: 'V1', assignmentId: 'A1', objectKind: 'CUT_PIECE', lines: [{ lineId: 'L1', objectCode: 'SKU', color: '灰', size: 'M', part: '前片' }] } },
    { id: 'retired-cut-piece-pickup-results:C1', collection: 'retired-cut-piece-pickup-results', value: { commandId: 'C1', versionId: 'V1', sourceRecordId: 'H1', quantities: [{ lineId: 'L1', actualQty: 18 }] } },
  ]
}
test('历史裁片实交保留原数量与归属，其他集合不混入', () => {
  const source = validateRetiredCutPiecePickupHistory([...records(), { id: 'unrelated', collection: 'other', value: {} }])
  assert.equal(source.handoverResults[0].quantities[0].actualQty, 18)
  assert.equal(source.versions[0].assignmentId, 'A1')
})
test('历史缺原版本、交错明细、负数量或记录身份错误均阻断恢复', () => {
  const missing = records().slice(1)
  assert.throws(() => validateRetiredCutPiecePickupHistory(missing), /缺少原单/)
  for (const patch of [{ quantities: [{ lineId: 'other', actualQty: 18 }] }, { quantities: [{ lineId: 'L1', actualQty: -1 }] }]) {
    const rows = records(); Object.assign(rows[1].value as object, patch)
    assert.throws(() => validateRetiredCutPiecePickupHistory(rows), /有效数量/)
  }
  const wrong = records(); wrong[0].id = 'wrong-id'
  assert.throws(() => validateRetiredCutPiecePickupHistory(wrong), /身份不一致/)
})
test('面辅料单不可写入退役裁片历史，未完成迁移标记不可恢复', () => {
  const rows = records(); Object.assign(rows[0].value as object, { objectKind: 'ACCESSORY' })
  assert.throws(() => validateRetiredCutPiecePickupHistory(rows), /非裁片/)
  assert.throws(() => validateRetiredCutPiecePickupHistory([...records(), { id: 'retired-cut-piece-pickup:scope', collection: 'retired-cut-piece-pickup-scopes', value: { phase: 'PENDING' } }]), /标记/)
})
