import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyFactoryQcState, upsertFactoryQc, applyFactoryQcCommand, qcIdForSource, type FactoryQcSource, type QcSourceKind, waterSolubleHasFinalQcOutput } from '../../src/data/fcs/factory-qc-model.ts'

const at = '2026-10-22T10:00:00+08:00'
function source(kind: QcSourceKind = 'PRINTING'): FactoryQcSource {
  return { kind, id: 'PROCESS-1', no: '加工-1', factoryId: kind === 'PRINTING' ? 'PRINT-1' : 'DYE-1', factoryName: '来源加工厂', materialSku: 'FAB-1', materialName: '面料', imageUrl: '/fabric/1.jpg', requirementVersion: 'V1', unit: '米', target: { id: 'CUT-1', name: '裁床', kind: 'FACTORY', factoryId: 'CUT-1', isDyeingFactory: false }, hasFinalOutput: true, rolls: [{ id: 'R1', barcode: 'ROLL-1', batchId: 'FINAL-BATCH-1', qty: 100, unit: '米', confirmed: true }], handedOutRollIds: [] }
}

test('AC-001/002: the first final physical printing batch creates QC without whole-order closure', () => {
  const state = emptyFactoryQcState(), s = source()
  assert.equal(s.completedAt, undefined, '来源整单尚未结束')
  const qc = upsertFactoryQc(state, s, at)!
  assert.equal(qc.kind, 'PRINTING')
  assert.equal(qc.source.id, 'PROCESS-1')
  assert.equal(qc.rolls[0].batchId, 'FINAL-BATCH-1')
  assert.equal(qc.rolls[0].qty, 100)
  assert.equal(qc.rolls[0].completedAt, undefined)
  assert.deepEqual(qc.rolls[0].photos, [])
})

test('AC-002/003: intermediate print-transfer, dye-setting and soluble pre-process outputs cannot trigger final QC', () => {
  for (const kind of ['PRINTING', 'DYEING', 'WATER_SOLUBLE', 'STENTER_HAND_FEEL'] as const) {
    const state = emptyFactoryQcState(), s = source(kind); s.hasFinalOutput = false
    assert.equal(upsertFactoryQc(state, s, at), undefined)
    assert.equal(state.qcOrders.length, 0)
  }
})

test('AC-003/004/026: every final dye-family process creates dye QC only for an explicitly non-dye recipient', () => {
  for (const kind of ['DYEING', 'WATER_SOLUBLE', 'STENTER_HAND_FEEL'] as const) {
    const state = emptyFactoryQcState(), qc = upsertFactoryQc(state, source(kind), at)!
    assert.equal(qc.kind, 'DYEING')
    assert.equal(qc.source.kind, kind)
    assert.equal(qc.rolls.length, 1)
  }
})

test('AC-004/005: same dye factory, another dye factory and unknown recipient do not create dye QC', () => {
  for (const target of [
    { id: 'DYE-1', name: '本染厂', kind: 'FACTORY' as const, factoryId: 'DYE-1', isDyeingFactory: true },
    { id: 'DYE-OTHER', name: '其他染厂', kind: 'FACTORY' as const, factoryId: 'DYE-OTHER', isDyeingFactory: true },
    { id: 'UNKNOWN', name: '待确认', kind: 'UNKNOWN' as const, isDyeingFactory: false },
    { id: 'FACTORY-UNKNOWN-TYPE', name: '类型未知工厂', kind: 'FACTORY' as const, factoryId: 'FACTORY-UNKNOWN-TYPE' },
  ]) {
    const state = emptyFactoryQcState(), s = source('DYEING'); s.target = target
    assert.equal(upsertFactoryQc(state, s, at), undefined)
    assert.deepEqual(state, emptyFactoryQcState())
  }
})

test('AC-006: a completed source changed from dye recipient to non-dye creates one backfilled QC', () => {
  const state = emptyFactoryQcState(), s = source('DYEING')
  s.target = { id: 'DYE-2', name: '另一染厂', kind: 'FACTORY', factoryId: 'DYE-2', isDyeingFactory: true }
  upsertFactoryQc(state, s, at)
  assert.equal(state.qcOrders.length, 0)
  s.target = source('DYEING').target
  const first = upsertFactoryQc(state, s, at)!
  upsertFactoryQc(state, s, '2026-10-22T11:00:00+08:00')
  assert.equal(state.qcOrders.length, 1)
  assert.equal(state.qcOrders[0].id, first.id)
  assert.equal(state.qcOrders[0].createdAt, at)
})

test('AC-006/008: switching back to dye or unknown preserves already recorded inspection facts', () => {
  const state = emptyFactoryQcState(), s = source('DYEING'), qc = upsertFactoryQc(state, s, at)!
  const recorded = applyFactoryQcCommand(state, { type: 'SAVE_ROLL', qcId: qc.id, rollId: 'R1', expectedVersion: 0, photos: [{ id: 'PHOTO-1', name: '现场.jpg', size: 123, type: 'image/jpeg' }], results: { color: '有差异', handfeel: '偏硬', material: '一致' }, notes: '原始现场记录', complete: true }, '现场QC', 'COMPLETE-R1', at)
  const roll = structuredClone(recorded.qcOrders[0].rolls[0])
  for (const target of [{ id: 'DYE-2', name: '染厂', kind: 'FACTORY' as const, isDyeingFactory: true }, { id: '', name: '未知', kind: 'UNKNOWN' as const }]) {
    s.target = target; upsertFactoryQc(recorded, s, at)
    assert.equal(recorded.qcOrders.length, 1)
    assert.deepEqual(recorded.qcOrders[0].rolls[0], roll)
  }
})

test('AC-007/008: two final batches append to one source QC and repeated triggers cannot duplicate rolls', () => {
  const state = emptyFactoryQcState(), s = source(), first = upsertFactoryQc(state, s, at)!
  s.rolls.push({ id: 'R2', barcode: 'ROLL-2', batchId: 'FINAL-BATCH-2', qty: 75.5, unit: '米', confirmed: true })
  upsertFactoryQc(state, s, '2026-10-22T11:00:00+08:00'); upsertFactoryQc(state, s, at)
  assert.equal(state.qcOrders.length, 1)
  assert.equal(state.qcOrders[0].id, first.id)
  assert.deepEqual(state.qcOrders[0].rolls.map(roll => [roll.id, roll.batchId]), [['R1', 'FINAL-BATCH-1'], ['R2', 'FINAL-BATCH-2']])
  assert.equal(s.rolls.length, 2, '创建质检不会消耗来源实物')
})

test('AC-007: equal source numbers from different process types retain separate source identities', () => {
  const state = emptyFactoryQcState()
  const printing = upsertFactoryQc(state, source('PRINTING'), at)!, dyeing = upsertFactoryQc(state, source('DYEING'), at)!
  assert.notEqual(printing.id, dyeing.id)
  assert.equal(printing.id, qcIdForSource(source('PRINTING')))
  assert.equal(state.qcOrders.length, 2)
})

test('AC-001/013: printing QC creation is independent of downstream type, handout or missing photos', () => {
  const state = emptyFactoryQcState(), s = source()
  s.target = { id: '', name: '待确认', kind: 'UNKNOWN' }
  s.handedOutRollIds = ['R1']; s.rolls[0].handedOut = true
  const qc = upsertFactoryQc(state, s, at)!
  assert.equal(qc.kind, 'PRINTING')
  assert.equal(qc.rolls[0].photos.length, 0)
  assert.deepEqual(qc.source.handedOutRollIds, ['R1'])
  assert.equal(qc.decision, undefined)
  assert.equal(state.handfeelOrders.length, 0)
})


test('AC-003: reported water quantity during pause/rework is not a final QC batch; supervisor acceptance or normal final completion is', () => {
  for (const status of ['WAIT_FACTORY_ASSIGNMENT', 'WAIT_MATERIAL', 'WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS', 'PRODUCTION_PAUSED', 'FUTURE_UNKNOWN']) assert.equal(waterSolubleHasFinalQcOutput(12.345, status), false, status)
  for (const status of ['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'RECEIPT_DIFFERENCE', 'WAIT_MANUAL_COMPLETION', 'DONE']) {
    assert.equal(waterSolubleHasFinalQcOutput(12.345, status), true, status)
    assert.equal(waterSolubleHasFinalQcOutput(0, status), false, status)
  }
})
