import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureSewingCutPieceResponsibilityDemo, createSewingCutPiecePartExclusion, getSewingCutPieceResponsibilityProjection, listSewingReturnResponsibilityVersions } from '../../src/data/fcs/sewing-cut-piece-responsibility.ts'

test('EXC-001—004: a reference mark cannot change debt, strict kits or final task responsibility', () => {
  const before = ensureSewingCutPieceResponsibilityDemo()
  const assignmentId = before.context.assignmentId
  const versions = listSewingReturnResponsibilityVersions(assignmentId)
  assert.equal(before.returnResponsibilityQty, 1000)
  createSewingCutPiecePartExclusion({ commandId: 'reference-test', assignmentId, skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'POCKET', reason: '核查主体可支撑数量', createdAt: '2026-09-01 09:00:00', createdByPpicId: before.context.ppicId })
  const after = getSewingCutPieceResponsibilityProjection(assignmentId)
  assert.equal(after.strictCompleteKitQty, 0)
  assert.equal(after.effectiveCompleteKitQty, 1000)
  assert.equal(after.totalDebtPieceQty, before.totalDebtPieceQty)
  assert.equal(after.returnResponsibilityQty, before.returnResponsibilityQty)
  assert.deepEqual(listSewingReturnResponsibilityVersions(assignmentId), versions)
})
