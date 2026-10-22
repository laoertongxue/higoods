import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFactoryQcCommand, emptyFactoryQcState, HAND_FEELS, HAND_FEEL_ENGLISH, STENTER_FACTORY,
  upsertFactoryQc, handfeelStatus, type FactoryQcSource, type FactoryQcCommand, type HandFeel, type QcSourceKind,
} from '../../src/data/fcs/factory-qc-model.ts'

const at = '2026-10-22T10:00:00+08:00'
function source(kind: QcSourceKind = 'PRINTING'): FactoryQcSource {
  return { kind, id: 'SOURCE-1', no: '来源-1', factoryId: kind === 'PRINTING' ? 'PRINT-1' : STENTER_FACTORY.id, factoryName: kind === 'PRINTING' ? '印花厂' : 'GTG', materialSku: 'FAB-1', materialName: '面料', imageUrl: '/fabric/1.jpg', requirementVersion: 'V1', unit: '米', target: { id: 'CUT-1', name: '裁床', kind: 'FACTORY', factoryId: 'CUT-1', isDyeingFactory: false }, hasFinalOutput: true, rolls: [1, 2].map(n => ({ id: 'R' + n, barcode: 'ROLL-' + n, batchId: 'B1', qty: 12.345, unit: '米', confirmed: true })), handedOutRollIds: [] }
}
function harness(s = source()) {
  let state = emptyFactoryQcState(), n = 0
  const qc = upsertFactoryQc(state, s, at)!
  const act = (command: FactoryQcCommand, currentSource = s, operationId = 'OP-' + ++n) => { state = applyFactoryQcCommand(state, command, '现场记录人', operationId, at, currentSource); return state }
  const decide = (needs = true, target?: HandFeel, currentSource = s, operationId?: string) => act({ type: 'DECIDE', qcId: qc.id, expectedVersion: state.qcOrders[0].version, needs, target }, currentSource, operationId)
  const execute = (type: 'SEND' | 'RECEIVE' | 'START' | 'OUTPUT' | 'HANDOUT' | 'DOWNSTREAM_RECEIVE', rolls: Array<{ id: string; qty?: number; barcode?: string; warehouseId?: string; locationId?: string }>, differenceConfirmed = false) => act({ type, orderId: state.handfeelOrders[0].id, expectedVersion: state.handfeelOrders[0].version, rolls, differenceConfirmed })
  return { s, qcId: qc.id, state: () => state, act, decide, execute }
}
const receive = (id = 'R1', qty = 12.345) => [{ id, barcode: 'ROLL-' + id.slice(1), qty, warehouseId: 'GTG-WH', locationId: 'A-01' }]
function started() { const h = harness(); h.decide(true, HAND_FEELS[0]); h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }]); h.execute('RECEIVE', receive()); h.execute('START', [{ id: 'R1' }]); return h }

test('AC-015/016: four fixed target names are distinct from actual touch results and processing decisions', () => {
  assert.deepEqual(HAND_FEELS, ['柔软手感', '增厚蓬松棉手感', '硬挺加厚手感', '加厚手感'])
  assert.deepEqual(Object.values(HAND_FEEL_ENGLISH), ['Soft', 'Bulk', 'Firm & Hard', 'Firm'])
  for (const kind of ['PRINTING', 'DYEING'] as const) for (const target of HAND_FEELS) {
    const h = harness(source(kind)); h.decide(true, target)
    const qc = h.state().qcOrders[0], order = h.state().handfeelOrders[0]
    assert.equal(qc.decision?.needs, true); assert.equal(qc.decision?.target, target)
    assert.equal(order.handFeel, target)
    assert.equal(qc.rolls[0].results.handfeel, '', '目标要求不能填进现场触摸结果')
    assert.equal(qc.rolls[0].completedAt, undefined, '处理决定不能完成逐卷质检')
  }
})

test('AC-015/026: water-soluble and handfeel-source QC cannot recursively initiate processing', () => {
  for (const kind of ['WATER_SOLUBLE', 'STENTER_HAND_FEEL'] as const) {
    const h = harness(source(kind)), before = structuredClone(h.state())
    assert.throws(() => h.decide(true, HAND_FEELS[0]), /只有印花和染色来源/)
    assert.deepEqual(h.state(), before)
  }
})

test('AC-017/022/023: creating a GTG order does not invent source handout, receipt, use or output', () => {
  for (const kind of ['PRINTING', 'DYEING'] as const) {
    const h = harness(source(kind)), original = structuredClone(h.s); h.decide(true, HAND_FEELS[0])
    const order = h.state().handfeelOrders[0]
    assert.equal(order.factoryId, 'ID-F003'); assert.equal(order.factoryName, 'GTG')
    assert.deepEqual(order.source.target, h.s.target)
    for (const roll of order.rolls) {
      assert.equal(roll.sentAt, undefined); assert.equal(roll.receivedAt, undefined)
      assert.equal(roll.startedAt, undefined); assert.equal(roll.completedAt, undefined)
      assert.equal(roll.handedOutAt, undefined); assert.equal(roll.downstreamReceivedAt, undefined)
    }
    assert.equal(handfeelStatus(order), kind === 'DYEING' ? '待内部转入' : '待来源交出')
    assert.deepEqual(h.s, original)
  }
})

test('AC-016/017: missing reference data or target requirement does not silently prevent legitimate order creation', () => {
  const s = source(); s.imageUrl = ''; s.referenceImageUrl = ''; s.requiredMaterialSku = ''
  const h = harness(s); h.decide(true)
  const order = h.state().handfeelOrders[0]
  assert.ok(order); assert.equal(order.handFeel, undefined)
  assert.equal(handfeelStatus(order), '目标手感待补充')
  h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }]); h.execute('RECEIVE', receive())
  assert.throws(() => h.execute('START', [{ id: 'R1' }]), /目标手感/)
  h.act({ type: 'TARGET', orderId: order.id, expectedVersion: h.state().handfeelOrders[0].version, target: HAND_FEELS[3] })
  h.execute('START', [{ id: 'R1' }])
  assert.equal(h.state().handfeelOrders[0].handFeel, '加厚手感')
})

test('AC-016: legacy or arbitrary target names are rejected without creating a processing order', () => {
  for (const target of ['硬挺手感', '任意类型'] as HandFeel[]) {
    const h = harness(); assert.throws(() => h.decide(true, target), /四类/)
    assert.equal(h.state().handfeelOrders.length, 0)
  }
})

test('AC-018/020: any partial actual handout prevents the whole order, even when other rolls remain', () => {
  for (const markActual of [(s: FactoryQcSource) => { s.handedOutRollIds = ['R1'] }, (s: FactoryQcSource) => { s.rolls[0].handedOut = true }]) {
    const s = source(); markActual(s); const h = harness(s); h.decide(true, HAND_FEELS[0])
    assert.equal(h.state().handfeelOrders.length, 0)
    assert.equal(h.state().qcOrders[0].decision?.needs, true)
    assert.match(h.state().qcOrders[0].decision?.reason || '', /已有实际交出/)
    assert.equal(h.s.rolls.length, 2, '不能删掉已交卷后给剩余卷另建')
  }
})

test('AC-018/020: draft reservation or downstream nonreceipt is not an actual handout fact', () => {
  const h = harness()
  Object.assign(h.s, { dispatchDraft: { rollIds: ['R1'], scanned: true }, downstreamReceived: false })
  h.decide(true, HAND_FEELS[0])
  assert.equal(h.state().handfeelOrders.length, 1)
  assert.equal(h.state().handfeelOrders[0].rolls.length, 2)
})

test('AC-019/020: the latest actual handout wins over a stale QC source snapshot', () => {
  const h = harness(), latest = structuredClone(h.s); latest.handedOutRollIds = ['R1']
  h.decide(true, HAND_FEELS[0], latest)
  assert.equal(h.state().handfeelOrders.length, 0)
  assert.equal(h.state().qcOrders[0].decision?.needs, true)
})

test('AC-019/037: decision refuses a different or changed-requirement source without partial side effects', () => {
  for (const mutate of [(s: FactoryQcSource) => { s.id = 'OTHER-SOURCE' }, (s: FactoryQcSource) => { s.requirementVersion = 'V2' }, (s: FactoryQcSource) => { s.rolls[0].qty = 99 }]) {
    const h = harness(), latest = structuredClone(h.s), before = structuredClone(h.state()); mutate(latest)
    assert.throws(() => h.decide(true, HAND_FEELS[0], latest), /来源|版本|要求/)
    assert.deepEqual(h.state(), before)
  }
})

test('AC-019/037: stale whole-order decision versions cannot overwrite another page', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0]); const before = structuredClone(h.state())
  assert.throws(() => h.act({ type: 'DECIDE', qcId: h.qcId, expectedVersion: 0, needs: true, target: HAND_FEELS[1] }), /其他页面更新/)
  assert.deepEqual(h.state(), before)
})

test('AC-007/019/021: retry and later batches retain one decision and one handfeel order without opposite decisions', () => {
  const h = harness(), command: FactoryQcCommand = { type: 'DECIDE', qcId: h.qcId, expectedVersion: 0, needs: true, target: HAND_FEELS[0] }
  h.act(command, h.s, 'STABLE-DECISION'); const committed = structuredClone(h.state())
  h.act(command, h.s, 'STABLE-DECISION'); assert.deepEqual(h.state(), committed)
  h.s.rolls.push({ id: 'R3', barcode: 'ROLL-3', batchId: 'B2', qty: 6, unit: '米', confirmed: true })
  upsertFactoryQc(h.state(), h.s, at)
  h.decide(true, HAND_FEELS[0]); assert.equal(h.state().handfeelOrders.length, 1)
  const beforeOpposite = structuredClone(h.state())
  assert.throws(() => h.decide(false), /相反判断/)
  assert.deepEqual(h.state(), beforeOpposite)
})

test('AC-018: a recorded no-treatment decision creates no order and no processing facts', () => {
  const h = harness(); h.decide(false)
  assert.equal(h.state().handfeelOrders.length, 0)
  assert.equal(h.state().qcOrders[0].decision?.needs, false)
  assert.equal(h.state().qcOrders[0].rolls[0].completedAt, undefined)
})

test('AC-022/025: GTG receipt requires source handout, correct physical code, positive actual quantity and location', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0])
  assert.throws(() => h.execute('RECEIVE', receive()), /尚未实际交出/)
  assert.throws(() => h.execute('SEND', [{ id: 'R1', barcode: 'WRONG' }]), /卷码/)
  h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }])
  for (const patch of [{ barcode: 'WRONG' }, { qty: 0 }, { qty: Number.NaN }, { qty: Number.POSITIVE_INFINITY }, { warehouseId: '' }, { locationId: '' }]) {
    const before = structuredClone(h.state())
    assert.throws(() => h.execute('RECEIVE', [{ ...receive()[0], ...patch }]), /卷码|接收数量|仓库|库位/)
    assert.deepEqual(h.state(), before)
  }
  assert.throws(() => h.execute('RECEIVE', receive('R1', 12)), /差异/)
  h.execute('RECEIVE', receive('R1', 12), true)
  assert.equal(h.state().handfeelOrders[0].rolls[0].receivedQty, 12)
})

test('AC-022/025: GTG cannot receive another physical code under the selected source roll identity', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0]); h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }])
  const before = structuredClone(h.state())
  assert.throws(() => h.execute('RECEIVE', [{ ...receive()[0], barcode: 'ROLL-2' }]), /卷码/)
  assert.deepEqual(h.state(), before)
})

test('AC-025: processing requires actual receipt and preserves decimal quantities and original units', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0])
  assert.throws(() => h.execute('START', [{ id: 'R1' }]), /尚未实收/)
  assert.throws(() => h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: 'OUT-1' }]), /尚未投入/)
  h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }]); h.execute('RECEIVE', receive()); h.execute('START', [{ id: 'R1' }])
  assert.throws(() => h.execute('OUTPUT', [{ id: 'R1', qty: 12.12, barcode: 'OUT-1' }]), /差异/)
  h.execute('OUTPUT', [{ id: 'R1', qty: 12.12, barcode: 'OUT-1' }], true)
  const roll = h.state().handfeelOrders[0].rolls[0]
  assert.equal(roll.inputQty, 12.345); assert.equal(roll.receivedQty, 12.345); assert.equal(roll.outputQty, 12.12); assert.equal(roll.unit, '米')
})

test('AC-025: output requires a positive actual quantity and a unique actual output code', () => {
  const h = started()
  for (const qty of [0, -1, NaN, Infinity]) assert.throws(() => h.execute('OUTPUT', [{ id: 'R1', qty, barcode: 'OUT-1' }], true), /实际产出数量/)
  assert.throws(() => h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: ' ' }]), /产出卷码/)
  h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: 'OUT-1' }])
  h.execute('SEND', [{ id: 'R2', barcode: 'ROLL-2' }]); h.execute('RECEIVE', receive('R2')); h.execute('START', [{ id: 'R2' }])
  for (const barcode of ['OUT-1', ' OUT-1 ']) {
    const before = structuredClone(h.state())
    assert.throws(() => h.execute('OUTPUT', [{ id: 'R2', qty: 12.345, barcode }]), /卷码已使用/)
    assert.deepEqual(h.state(), before)
  }
})

test('AC-026: first real handfeel output creates dye QC before other rolls finish or manual closure', () => {
  const h = started(); h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: 'OUT-1' }])
  const order = h.state().handfeelOrders[0], downstreamQc = h.state().qcOrders.find(qc => qc.source.kind === 'STENTER_HAND_FEEL')!
  assert.equal(order.completedAt, undefined)
  assert.equal(order.rolls[1].completedAt, undefined)
  assert.equal(downstreamQc.kind, 'DYEING'); assert.equal(downstreamQc.source.id, order.id)
  assert.deepEqual(downstreamQc.rolls.map(roll => roll.id), ['R1'])
  assert.equal(downstreamQc.rolls[0].barcode, 'OUT-1')
  const before = structuredClone(h.state())
  assert.throws(() => h.act({ type: 'DECIDE', qcId: downstreamQc.id, expectedVersion: downstreamQc.version, needs: true, target: HAND_FEELS[0] }, downstreamQc.source), /只有印花和染色来源/)
  assert.deepEqual(h.state(), before)
})

test('AC-014/025/027: handout scans the real output despite unfinished QC; receipt remains an independent actual fact', () => {
  const h = started(); h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: 'OUT-1' }])
  assert.throws(() => h.execute('HANDOUT', [{ id: 'R1', barcode: 'ROLL-1' }]), /实际产出卷码/)
  h.execute('HANDOUT', [{ id: 'R1', barcode: 'OUT-1' }])
  assert.equal(h.state().handfeelOrders[0].rolls[0].downstreamReceivedAt, undefined)
  assert.equal(h.state().qcOrders.find(qc => qc.source.kind === 'STENTER_HAND_FEEL')!.rolls[0].completedAt, undefined)
  assert.throws(() => h.execute('DOWNSTREAM_RECEIVE', [{ id: 'R1', qty: 12 }]), /差异/)
  h.execute('DOWNSTREAM_RECEIVE', [{ id: 'R1', qty: 12 }], true)
  assert.equal(h.state().handfeelOrders[0].rolls[0].downstreamQty, 12)
  const order = h.state().handfeelOrders[0]
  assert.throws(() => h.act({ type: 'COMPLETE', orderId: order.id, expectedVersion: order.version }), /全部实际卷/)
})

test('AC-025/037: batch actions are all-or-nothing for a foreign or duplicate roll and stale order version', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0]); const before = structuredClone(h.state())
  assert.throws(() => h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }, { id: 'OTHER', barcode: 'OTHER' }]), /不属于本单/)
  assert.deepEqual(h.state(), before)
  assert.throws(() => h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }, { id: 'R1', barcode: 'ROLL-1' }]), /重复操作/)
  assert.deepEqual(h.state(), before)
  h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }]); const committed = structuredClone(h.state())
  assert.throws(() => h.act({ type: 'SEND', orderId: h.state().handfeelOrders[0].id, expectedVersion: 0, rolls: [{ id: 'R2', barcode: 'ROLL-2' }] }), /其他页面更新/)
  assert.deepEqual(h.state(), committed)
})

test('AC-021/025: manual closure requires every actual downstream receipt and cannot rewrite physical history afterwards', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0])
  for (const id of ['R1', 'R2']) {
    const number = id.slice(1)
    h.execute('SEND', [{ id, barcode: 'ROLL-' + number }]); h.execute('RECEIVE', receive(id)); h.execute('START', [{ id }])
    h.execute('OUTPUT', [{ id, qty: 12.345, barcode: 'OUT-' + number }])
    h.execute('HANDOUT', [{ id, barcode: 'OUT-' + number }]); h.execute('DOWNSTREAM_RECEIVE', [{ id, qty: 12.345 }])
  }
  const order = h.state().handfeelOrders[0]
  h.act({ type: 'COMPLETE', orderId: order.id, expectedVersion: order.version })
  const completed = structuredClone(h.state())
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '已完单')
  assert.equal(h.state().handfeelOrders[0].rolls.every(roll => !!roll.downstreamReceivedAt), true)
  assert.throws(() => h.act({ type: 'TARGET', orderId: order.id, expectedVersion: h.state().handfeelOrders[0].version, target: HAND_FEELS[1] }), /人工完结/)
  assert.deepEqual(h.state(), completed)
})

test('AC-021: repeated QC decisions cannot diverge the linked target requirement', () => {
  const h = harness(); h.decide(true, HAND_FEELS[0])
  const before = structuredClone(h.state())
  assert.throws(() => h.decide(true, HAND_FEELS[3]), /关联手感单|目标要求/)
  assert.deepEqual(h.state(), before)
  const order = h.state().handfeelOrders[0]
  h.act({ type: 'TARGET', orderId: order.id, expectedVersion: order.version, target: HAND_FEELS[3] })
  assert.equal(h.state().qcOrders[0].decision?.target, h.state().handfeelOrders[0].handFeel)
})

test('AC-021: later batches stay on the same manually closed order and require an explicit continuation', () => {
  const s = source(); s.rolls = s.rolls.slice(0, 1)
  const h = harness(s); h.decide(true, HAND_FEELS[0])
  h.execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }]); h.execute('RECEIVE', receive())
  h.execute('START', [{ id: 'R1' }]); h.execute('OUTPUT', [{ id: 'R1', qty: 12.345, barcode: 'OUTPUT-1' }])
  h.execute('HANDOUT', [{ id: 'R1', barcode: 'OUTPUT-1' }]); h.execute('DOWNSTREAM_RECEIVE', [{ id: 'R1', qty: 12.345 }])
  let order = h.state().handfeelOrders[0]
  h.act({ type: 'COMPLETE', orderId: order.id, expectedVersion: order.version })
  const first = structuredClone(h.state().handfeelOrders[0].rolls[0])
  const latest = structuredClone(s); latest.rolls.push({ id: 'R2', barcode: 'ROLL-2', batchId: 'B2', qty: 15, unit: '米', confirmed: true })
  upsertFactoryQc(h.state(), latest, at)
  order = h.state().handfeelOrders[0]
  assert.equal(h.state().handfeelOrders.length, 1); assert.equal(order.rolls.length, 2)
  assert.ok(order.completedAt, '新批次不能自动重开')
  assert.throws(() => h.execute('SEND', [{ id: 'R2', barcode: 'ROLL-2' }]), /人工完结/)
  h.act({ type: 'CONTINUE', orderId: order.id, expectedVersion: order.version })
  assert.equal(h.state().handfeelOrders[0].completedAt, undefined)
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待来源交出', '已收旧卷不能把新增未交卷显示成待下游实收')
  assert.deepEqual(h.state().handfeelOrders[0].rolls[0], first, '明确继续也不改原实物事实')
  assert.ok(h.state().actions.some(action => action.kind === 'COMPLETE'))
  assert.match(h.state().actions.find(action => action.kind === 'CONTINUE')?.note || '', /原人工完单时间/)
  h.execute('SEND', [{ id: 'R2', barcode: 'ROLL-2' }])
  assert.ok(h.state().handfeelOrders[0].rolls[1].sentAt)
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待GTG实收')
  h.execute('RECEIVE', [{ id: 'R2', barcode: 'ROLL-2', qty: 15, warehouseId: 'GTG-WH', locationId: 'GTG-POS' }])
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待投入')
  h.execute('START', [{ id: 'R2' }])
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '加工中')
  h.execute('OUTPUT', [{ id: 'R2', qty: 15, barcode: 'OUTPUT-2' }])
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待交出')
  h.execute('HANDOUT', [{ id: 'R2', barcode: 'OUTPUT-2' }])
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待下游实收')
  h.execute('DOWNSTREAM_RECEIVE', [{ id: 'R2', qty: 15 }])
  assert.equal(handfeelStatus(h.state().handfeelOrders[0]), '待人工完单')
})
