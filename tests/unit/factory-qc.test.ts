import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFactoryQcCommand, emptyFactoryQcState, qcProgress, upsertFactoryQc,
  type FactoryQcCommand, type FactoryQcPhoto, type FactoryQcSource, type FactoryQcState,
} from '../../src/data/fcs/factory-qc-model.ts'

const at = '2026-10-22T10:00:00+08:00'
const photo: FactoryQcPhoto = { id: 'photo-actual-r1', name: '第一卷实拍.jpg', type: 'image/jpeg', size: 125000 }
function source(): FactoryQcSource {
  return { kind: 'PRINTING', id: 'PRINT-1', no: '印花-1', factoryId: 'PRINT-FACTORY', factoryName: '印花厂', materialSku: 'FAB-1', materialName: '棉面料', imageUrl: '/fabric/source.jpg', referenceImageUrl: '/fabric/approved-v1.jpg', requiredMaterialSku: 'FAB-REQUIRED', requirementVersion: 'V1', unit: '米', target: { id: 'CUT-1', name: '裁床', kind: 'FACTORY', factoryId: 'CUT-1', isDyeingFactory: false }, hasFinalOutput: true, rolls: [1, 2].map(n => ({ id: 'R' + n, barcode: 'ROLL-' + n, batchId: 'B1', qty: 12.345, unit: '米', confirmed: true })), handedOutRollIds: [] }
}
function harness() {
  let state = emptyFactoryQcState(), n = 0
  const qc = upsertFactoryQc(state, source(), at)!
  return { qcId: qc.id, state: () => state, save: (command: FactoryQcCommand, actor = '驻厂QC', op = 'OP-' + ++n) => { state = applyFactoryQcCommand(state, command, actor, op, at); return state } }
}
const complete = (qcId: string, rollId = 'R1', expectedVersion = 0): FactoryQcCommand => ({ type: 'SAVE_ROLL', qcId, rollId, expectedVersion, photos: [photo], results: { color: '有色差，详见照片', handfeel: '实际触摸偏硬', material: '与要求一致' }, notes: '现场检查说明', complete: true })

test('AC-009/011: every physical roll records photos and three facts; quality issues still count as inspected', () => {
  const h = harness()
  h.save(complete(h.qcId))
  const qc = h.state().qcOrders[0], inspected = qc.rolls[0]
  assert.deepEqual(qcProgress(qc), { total: 2, checked: 1, status: '质检中' })
  assert.equal(inspected.results.color, '有色差，详见照片')
  assert.equal(inspected.results.handfeel, '实际触摸偏硬')
  assert.equal(inspected.completedBy, '驻厂QC')
  assert.equal(inspected.completedAt, at)
  assert.equal(qc.decision, undefined, '触摸检查不会自动决定是否加工手感')
  assert.equal('passed' in qc || 'approved' in qc || 'pass' in qc, false)
  h.save(complete(h.qcId, 'R2'))
  assert.deepEqual(qcProgress(h.state().qcOrders[0]), { total: 2, checked: 2, status: '已完成质检' })
})

test('AC-009/011: missing any photo or any one result refuses completion without changing caller state', () => {
  const h = harness(), before = structuredClone(h.state())
  const valid = complete(h.qcId)
  assert.equal(valid.type, 'SAVE_ROLL')
  if (valid.type !== 'SAVE_ROLL') throw new Error('fixture')
  for (const patch of [{ photos: [] }, ...['color', 'handfeel', 'material'].map(key => ({ results: { ...valid.results, [key]: '  ' } }))]) {
    assert.throws(() => h.save({ ...valid, ...patch }), /照片|三个结果/)
    assert.deepEqual(h.state(), before)
  }
})

test('AC-010/013: an incomplete photo/result draft remains saved and does not invent QC release approval', () => {
  const h = harness(), command = complete(h.qcId)
  if (command.type !== 'SAVE_ROLL') throw new Error('fixture')
  h.save({ ...command, photos: [], results: { color: '待对比', handfeel: '', material: '' }, complete: false })
  const qc = h.state().qcOrders[0]
  assert.deepEqual(qcProgress(qc), { total: 2, checked: 0, status: '待质检' })
  assert.equal(qc.rolls[0].completedAt, undefined)
  assert.equal(qc.rolls[0].notes, '现场检查说明')
  assert.equal(qc.rolls[0].version, 1)
  assert.equal(qc.decision, undefined)
})

test('AC-037: any actor is refused when changing completed photos, results, notes or completion information', () => {
  const h = harness()
  h.save(complete(h.qcId))
  const frozen = structuredClone(h.state()), initial = complete(h.qcId, 'R1', 1)
  if (initial.type !== 'SAVE_ROLL') throw new Error('fixture')
  for (const actor of ['驻厂QC', '主管', '其他人员']) {
    for (const patch of [{ photos: [] }, { results: { color: '无色差', handfeel: '柔软', material: '一致' } }, { notes: '覆盖原说明' }, { complete: false }]) {
      assert.throws(() => h.save({ ...initial, ...patch }, actor), /已完成质检.*不允许修改/)
      assert.deepEqual(h.state(), frozen)
    }
  }
})

test('AC-037: a stale editable tab cannot overwrite a newer draft or completed inspection', () => {
  const h = harness(), first = complete(h.qcId)
  if (first.type !== 'SAVE_ROLL') throw new Error('fixture')
  h.save({ ...first, complete: false })
  const draft = structuredClone(h.state())
  assert.throws(() => h.save({ ...first, notes: '陈旧页面覆盖' }), /其他页面更新/)
  assert.deepEqual(h.state(), draft)
  h.save({ ...first, expectedVersion: 1 })
  const completed = structuredClone(h.state())
  assert.throws(() => h.save({ ...first, expectedVersion: 1, complete: false }), /已完成质检/)
  assert.deepEqual(h.state(), completed)
})

test('AC-037: retrying the exact completed operation returns its prior result without a second action', () => {
  const h = harness(), command = complete(h.qcId)
  h.save(command, '驻厂QC', 'COMPLETE-R1-STABLE')
  const committed = structuredClone(h.state())
  h.save(command, '驻厂QC', 'COMPLETE-R1-STABLE')
  assert.deepEqual(h.state(), committed)
  assert.equal(h.state().actions.length, 1)
})

test('AC-009/040: two names for one attachment ID cannot masquerade as two roll photographs', () => {
  const h = harness(), command = complete(h.qcId)
  if (command.type !== 'SAVE_ROLL') throw new Error('fixture')
  assert.throws(() => h.save({ ...command, photos: [photo, { ...photo, name: '重复.jpg' }] }), /照片引用重复/)
  assert.equal(h.state().qcOrders[0].rolls[0].photos.length, 0)
})

test('AC-008/037: later source requirements cannot replace a completed roll inspection snapshot', () => {
  const h = harness()
  h.save(complete(h.qcId))
  const snapshot = structuredClone(h.state().qcOrders[0].rolls[0]), next = source()
  next.requirementVersion = 'V2'; next.referenceImageUrl = '/fabric/approved-v2.jpg'; next.requiredMaterialSku = 'FAB-NEW'
  next.rolls[0].barcode = 'UPDATED-OLD-CODE'; next.rolls[0].qty = 99
  next.rolls.push({ id: 'R3', barcode: 'ROLL-3', batchId: 'B2', qty: 5, unit: '米', confirmed: true })
  upsertFactoryQc(h.state(), next, '2026-10-22T11:00:00+08:00')
  assert.deepEqual(h.state().qcOrders[0].rolls[0], snapshot)
  assert.equal(h.state().qcOrders[0].rolls[2].requirementVersion, 'V2')
  assert.equal(h.state().qcOrders[0].rolls[2].referenceImageUrl, '/fabric/approved-v2.jpg')
  assert.equal(h.state().qcOrders[0].rolls[2].requiredMaterialSku, 'FAB-NEW')
  assert.deepEqual(qcProgress(h.state().qcOrders[0]), { total: 3, checked: 1, status: '质检中' })
})

test('AC-037: failed foreign-roll updates leave caller state and all other rolls untouched', () => {
  const h = harness(), before: FactoryQcState = structuredClone(h.state())
  assert.throws(() => h.save(complete(h.qcId, 'UNRELATED-ROLL')), /不属于当前QC单/)
  assert.deepEqual(h.state(), before)
  assert.throws(() => h.save(complete('OTHER-QC')), /QC单不存在/)
  assert.deepEqual(h.state(), before)
})

test('AC-011: a QC awaiting physical roll identity does not report itself as fully inspected', () => {
  const state = emptyFactoryQcState(), s = source(); s.rolls = []
  const qc = upsertFactoryQc(state, s, at)!
  assert.deepEqual(qcProgress(qc), { total: 0, checked: 0, status: '待补卷' })
})

test('AC-007/037: unfinished roll follows corrected actual quantity while preserving its saved inspection draft', () => {
  const s = source(), state = emptyFactoryQcState()
  s.rolls[0].qty = 0; s.rolls[0].confirmed = false
  const qc = upsertFactoryQc(state, s, at)!
  qc.rolls[0].notes = '已触摸待补实测长度'; qc.rolls[0].results.handfeel = '有差异'
  const later = structuredClone(s); later.rolls[0].qty = 18.375; later.rolls[0].confirmed = true
  upsertFactoryQc(state, later, at)
  assert.equal(qc.rolls[0].qty, 18.375); assert.equal(qc.rolls[0].confirmed, true)
  assert.equal(qc.rolls[0].notes, '已触摸待补实测长度'); assert.equal(qc.rolls[0].results.handfeel, '有差异')
  assert.equal(qc.rolls[0].version, 1)
})
