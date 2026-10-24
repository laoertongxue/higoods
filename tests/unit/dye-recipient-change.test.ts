import test from 'node:test'
import assert from 'node:assert/strict'
import { captureDyeProcessMutationState, restoreDyeProcessMutationState, getDyeWorkOrderById, getDyeDispatchPartner, getDyeReceivingTargetChangeBlocker, listDyeReceivingTargetOptions, updateDyeReceivingTarget, finishDyeDispatchDocument } from '../../src/data/fcs/dyeing-task-domain.ts'
const sourceId = 'DYE-DISPATCH-DEMO-2'
const input = () => { const order = getDyeWorkOrderById(sourceId)!, target = getDyeDispatchPartner(sourceId); return { targetKey: 'FACTORY:F090', expectedUpdatedAt: order.updatedAt, expectedTargetKey: target.kind + ':' + target.id, by: '跟单核对员', reason: '现场确认实际下游加工厂' } }
function isolated(recipe: () => void) { getDyeWorkOrderById(sourceId); const before = captureDyeProcessMutationState(); try { recipe() } finally { restoreDyeProcessMutationState(before) } }

test('AC-006: a real final-packed dye source can change dye recipient to an explicitly registered non-dye factory without creating physical delivery', () => isolated(() => {
  finishDyeDispatchDocument('SJ-DEMO-20260911-001', 'void')
  const before = structuredClone(getDyeWorkOrderById(sourceId)!), nodes = captureDyeProcessMutationState().nodeRecords
  assert.equal(getDyeDispatchPartner(sourceId).id, 'ID-F002')
  assert.equal(getDyeReceivingTargetChangeBlocker(sourceId), '')
  const after = updateDyeReceivingTarget(sourceId, input())
  assert.equal(getDyeDispatchPartner(sourceId).id, 'F090')
  assert.deepEqual(after.outputRolls, before.outputRolls)
  assert.deepEqual(after.dispatchDocuments, before.dispatchDocuments)
  assert.deepEqual(captureDyeProcessMutationState().nodeRecords, nodes)
  assert.equal(after.receivingTargetChanges?.at(-1)?.from.id, 'ID-F002')
  assert.equal(after.receivingTargetChanges?.at(-1)?.to.id, 'F090')
  assert.equal(after.receivingTargetChanges?.at(-1)?.reason, '现场确认实际下游加工厂')
}))
test('AC-006/019: an existing dispatch draft or actual delivery still blocks a recipient change', () => isolated(() => {
  for (const id of ['DYE-DISPATCH-DEMO-1', 'DYE-DISPATCH-DEMO-2', 'DWO-008']) {
    const before = structuredClone(getDyeWorkOrderById(id)!), target = getDyeDispatchPartner(id)
    assert.ok(getDyeReceivingTargetChangeBlocker(id))
    assert.throws(() => updateDyeReceivingTarget(id, { ...input(), expectedUpdatedAt: before.updatedAt, expectedTargetKey: target.kind + ':' + target.id }), /交出|交接|完单/)
    assert.deepEqual(getDyeWorkOrderById(id), before)
  }
}))
test('AC-006/038: a stale page cannot replace a newer recipient or append a second misleading history entry', () => isolated(() => {
  finishDyeDispatchDocument('SJ-DEMO-20260911-001', 'void')
  const stale = input()
  updateDyeReceivingTarget(sourceId, stale)
  const saved = structuredClone(getDyeWorkOrderById(sourceId))
  assert.throws(() => updateDyeReceivingTarget(sourceId, { ...stale, targetKey: 'FACTORY:ID-F003' }), /已变化/)
  assert.deepEqual(getDyeWorkOrderById(sourceId), saved)
}))
test('AC-005/006: no arbitrary name or missing reason can establish a recipient identity', () => isolated(() => {
  finishDyeDispatchDocument('SJ-DEMO-20260911-001', 'void')
  const before = structuredClone(getDyeWorkOrderById(sourceId))
  assert.throws(() => updateDyeReceivingTarget(sourceId, { ...input(), targetKey: 'FACTORY:UNREGISTERED' }), /已登记/)
  assert.throws(() => updateDyeReceivingTarget(sourceId, { ...input(), reason: '' }), /原因/)
  assert.deepEqual(getDyeWorkOrderById(sourceId), before)
  assert.ok(listDyeReceivingTargetOptions().some(target => target.kind === 'WAREHOUSE' && target.id === 'WH-FITTING-001'))
}))
