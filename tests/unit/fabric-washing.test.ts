import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWashingCommand, emptyWashingState, washingInitiationRolls, washingRollRelease, washingPrintSignature, type WashingSource, type WashingState, type WashingCommand, type WashingActor, WASHING_HAND_FEELS } from '../../src/data/fcs/fabric-washing-model.ts'

const site: WashingActor = { id: 'site-1', name: '现场人员', role: '现场判断人员', factoryId: 'PRINT-1' }
const planner: WashingActor = { id: 'plan-1', name: '计划员', role: '计划跟单' }
const factory: WashingActor = { id: 'dye-1', name: '染厂人员', role: '染厂人员', factoryId: 'ID-F003' }
const receiver: WashingActor = { id: 'receive-1', name: '仓管', role: '接收人员', factoryId: 'CUT-1', warehouseId:'W-1' }
const source = (sourceType: WashingSource['sourceType'] = 'PRODUCTION'): WashingSource => ({
  objectType: 'FABRIC', id: 'PRINT-1/BATCH-1', printOrderId: 'PRINT-1', printOrderNo: '印花单 1', batchId: 'BATCH-1', sourceType, sourceNo: '来源 1',
  factoryId: 'PRINT-1', factoryName: '印花厂', materialSku: 'FAB-1', materialName: '印花面料', imageUrl: '/materials/fabric-main.jpg',
  revision: 'V1', actualCompleted: true, target: { id: 'CUT-1', name: '原裁床', factoryId: 'CUT-1', warehouseId: 'W-1' },
  rolls: [1, 2, 3].map(n => ({ id: 'R' + n, barcode: 'ROLL-' + n, qty: 100, unit: 'Yard', confirmed: true, handedOut: false })),
})
function harness() {
  let state: WashingState = emptyWashingState(), i = 0
  const act = (command: WashingCommand, actor = site, op = 'OP-' + ++i) => {
    const result = applyWashingCommand(state, command, actor, op, '2026-10-15T10:00:00+08:00')
    state = result.state
    return result.orderId
  }
  return { act, state: () => state }
}
const judge = (s = source(), feel = WASHING_HAND_FEELS[0], rolls = ['R1', 'R2']): WashingCommand => ({ type: 'JUDGE', source: s, rollIds: rolls, decision: 'WASH', handFeel: feel })

test('WASH-226/231: touch initiation immediately assigns GTG and preserves the original downstream', () => {
  const h = harness(), s = source()
  h.act(judge(s))
  const order = h.state().orders[0]
  assert.equal(order.assignedFactoryId, 'ID-F003')
  assert.equal(order.assignedFactoryName, 'GTG')
  assert.equal(order.acceptance, 'PENDING')
  assert.equal(order.assignedAt, order.createdAt)
  assert.deepEqual(order.source.target, s.target)
  assert.equal(order.rolls[0].receivedAt, undefined)
})

test('WASH-227: another factory cannot replace GTG', () => {
  const h = harness(), id = h.act(judge())!
  assert.throws(() => h.act({type:'ASSIGN', orderId:id, factory:{id:'OTHER',name:'其他厂',enabled:true}}, planner), /GTG/)
  assert.equal(h.state().orders[0].assignedFactoryId, 'ID-F003')
})

test('WASH-206/208: initiation uses completed physical batches and never mutates source facts', () => {
  const s = source(), before = structuredClone(s)
  assert.deepEqual(washingInitiationRolls(emptyWashingState(), s).map(r => r.id), ['R1', 'R2', 'R3'])
  assert.deepEqual(s, before)
})
test('WASH-209/212: non-fabric, unfinished, blocked or incomplete source cannot initiate', () => {
  for (const patch of [{objectType:'PAPER'}, {actualCompleted:false}, {blockedReason:'生产单已暂停'}, {printOrderId:''}, {imageUrl:''}]) {
    const s = {...source(), ...patch} as WashingSource
    assert.deepEqual(washingInitiationRolls(emptyWashingState(), s), [])
  }
})
test('WASH-210/212: initiation excludes unconfirmed, non-positive, unitless, handed-out and draft-occupied rolls', () => {
  for (const patch of [{confirmed:false}, {qty:0}, {qty:-1}, {qty:NaN}, {qty:Infinity}, {unit:''}, {handedOut:true}, {blockedReason:'交出草稿占用'}]) {
    const s = source(); Object.assign(s.rolls[0], patch)
    assert.deepEqual(washingInitiationRolls(emptyWashingState(), s).map(r => r.id), ['R2', 'R3'])
  }
})
test('WASH-211: every existing touch decision prevents duplicate initiation, leaving other rolls available', () => {
  const h = harness(), s = source()
  h.act(judge(s))
  assert.deepEqual(washingInitiationRolls(h.state(), s).map(r => r.id), ['R3'])
  h.act({type:'JUDGE', source:s, rollIds:['R3'], decision:'NO_WASH'})
  assert.deepEqual(washingInitiationRolls(h.state(), s), [])
})
test('WASH-218: judgment rejects a planner or a different onsite factory without creating records', () => {
  const h = harness()
  assert.throws(() => h.act(judge(), planner), /当前人员不能执行/)
  assert.throws(() => h.act(judge(), {...site, factoryId:'OTHER'}), /当前现场面料/)
  assert.deepEqual(h.state(), emptyWashingState())
})

test('CT-02: unfinished fabric cannot be judged; input remains unchanged', () => {
  const h = harness(), s = source(); s.actualCompleted = false
  assert.throws(() => h.act(judge(s)), /尚未实际完成/)
  assert.equal(h.state().orders.length, 0)
})
test('CT-03/04: all six sources accept three hand feels without a factory or chemistry', () => {
  for (const type of ['PRODUCTION', 'PRODUCTION_DEMAND', 'PURCHASE', 'STOCK', 'SUPPLEMENT', 'DESIGN_REVISION'] as const) {
    for (const feel of WASHING_HAND_FEELS) {
      const h = harness(), id = h.act(judge(source(type), feel))!
      const order = h.state().orders.find(row => row.id === id)!
      assert.equal(order.handFeel, feel); assert.equal(order.source.sourceType, type)
      assert.equal(order.assignedFactoryId, 'ID-F003')
      assert.equal(JSON.stringify(order).includes('percentage'), false)
      assert.equal(order.source.productionOrderId, undefined)
    }
  }
})
test('CT-03/09: duplicate operation is idempotent but changed intent is rejected', () => {
  const h = harness(), command = judge()
  const id = h.act(command, site, 'STABLE')
  assert.equal(h.act(command, site, 'STABLE'), id)
  assert.equal(h.state().orders.length, 1)
  assert.throws(() => h.act(judge(source(), WASHING_HAND_FEELS[2]), site, 'STABLE'), /操作标识/)
})
test('CT-03: duplicate rolls and partial correction of an existing order fail', () => {
  const h = harness()
  assert.throws(() => h.act(judge(source(), WASHING_HAND_FEELS[0], ['R1', 'R1'])), /不重复/)
  h.act(judge())
  assert.throws(() => h.act(judge(source(), WASHING_HAND_FEELS[2], ['R1'])), /完整选择/)
  assert.equal(h.state().orders.filter(row => !row.cancelledAt).length, 1)
})
test('CT-05: no-wash and wash can coexist; undecided rolls remain guarded', () => {
  const h = harness()
  h.act({ type: 'JUDGE', source: source(), rollIds: ['R3'], decision: 'NO_WASH' })
  h.act(judge())
  assert.equal(washingRollRelease(h.state(), 'PRINT-1', 'R3', 'V1'), '')
  assert.match(washingRollRelease(h.state(), 'PRINT-1', 'R1', 'V1'), /需要洗水/)
  assert.match(washingRollRelease(h.state(), 'PRINT-1', 'UNKNOWN'), /实际触摸/)
  assert.match(washingRollRelease(h.state(), 'PRINT-1', 'R3', 'V2'), /实际触摸/)
})
test('CT-06: assignment does not receive; physical receipt and output govern release', () => {
  const h = harness(), id = h.act(judge())!
  h.act({ type: 'ASSIGN', orderId: id, factory: { id: 'ID-F003', name: 'GTG', enabled: true } }, planner)
  assert.equal(h.state().orders[0].rolls[0].receivedAt, undefined)
  assert.throws(() => h.act({ type: 'START', orderId: id, rollIds: ['R1'] }, factory), /已接收/)
  h.act({ type: 'ACCEPT', orderId: id }, factory)
  h.act({ type: 'SEND', orderId: id, rollIds: ['R1'], scannedCodes: ['ROLL-1'] })
  assert.throws(() => h.act({ type: 'RECEIVE', orderId: id, lines: [{ rollId: 'R1', barcode: 'WRONG', qty: 100 }], warehouseId: 'W-DYE', locationId: 'A1' }, factory), /卷码/)
  h.act({ type: 'RECEIVE', orderId: id, lines: [{ rollId: 'R1', barcode: 'ROLL-1', qty: 100 }], warehouseId: 'W-DYE', locationId: 'A1' }, factory)
  h.act({ type: 'START', orderId: id, rollIds: ['R1'] }, factory)
  assert.throws(() => h.act({ type: 'OUTPUT', orderId: id, lines: [{ rollId: 'R1', qty: 98 }] }, factory), /数量有变化/)
  h.act({ type: 'OUTPUT', orderId: id, lines: [{ rollId: 'R1', qty: 98 }], differenceConfirmed: true }, factory)
  assert.match(washingRollRelease(h.state(), 'PRINT-1', 'R1'), /下游实收/)
  h.act({ type: 'HANDOUT', orderId: id, rollIds: ['R1'], scannedCodes: ['ROLL-1'], target: source().target! }, factory)
  h.act({ type: 'DOWNSTREAM_RECEIVE', warehouseId:'W-1',locationId:'L-1', orderId: id, lines: [{ rollId: 'R1', qty: 98 }] }, receiver)
  assert.equal(washingRollRelease(h.state(), 'PRINT-1', 'R1'), '')
  assert.match(washingRollRelease(h.state(), 'PRINT-1', 'R2'), /需要洗水/)
  assert.throws(() => h.act({ type: 'COMPLETE', orderId: id }, factory), /仍有未加工/)
})
test('CT-07: wrong factory cannot act; a sent order cannot be cancelled', () => {
  const h = harness(), id = h.act(judge())!
  h.act({ type: 'ASSIGN', orderId: id, factory: { id: 'ID-F003', name: 'GTG', enabled: true } }, planner)
  assert.throws(() => h.act({ type: 'ACCEPT', orderId: id }, { ...factory, factoryId: 'OTHER' }), /本厂/)
  h.act({ type: 'ACCEPT', orderId: id }, factory)
  h.act({ type: 'SEND', orderId: id, rollIds: ['R1'], scannedCodes: ['ROLL-1'] })
  assert.throws(() => h.act({ type: 'CANCEL', orderId: id, reason: '误判', confirmed: true }, planner), /已有实物交接/)
})
test('CT-04: a late match preserves order identity and prior physical facts', () => {
  const h = harness(), id = h.act(judge(source('PRODUCTION_DEMAND')))!
  h.act({ type: 'LINK', printOrderId: 'PRINT-1', productionOrderId: 'PO-1' }, planner)
  assert.equal(h.state().orders.length, 1)
  assert.equal(h.state().orders[0].id, id)
  assert.equal(h.state().orders[0].source.productionOrderId, 'PO-1')
})
test('CT-07: coordinated source verification keeps judgment history and refuses changed physical quantities', () => {
  const h=harness(),s=source(),id=h.act(judge(s))!,supervisor:WashingActor={id:'supervisor',name:'负责人',role:'现场负责人'}
  h.act({type:'EXCEPTION',orderId:id,reason:'要求版本变化',confirmed:true},supervisor)
  const changed=structuredClone(s);changed.revision='V2';changed.rolls[0].qty=99
  assert.throws(()=>h.act({type:'RESOLVE_EXCEPTION',orderId:id,reason:'实物核对',confirmed:true,verifiedSource:changed},supervisor),/实物范围或数量/)
  changed.rolls[0].qty=100
  h.act({type:'RESOLVE_EXCEPTION',orderId:id,reason:'同一实物重新触摸并核对',confirmed:true,verifiedSource:changed},supervisor)
  assert.equal(h.state().judgments[0].sourceRevision,'V2');assert.equal(h.state().judgments[0].history[0].sourceRevision,'V1')
  assert.equal(h.state().orders[0].rolls[0].inputQty,100)
})
test('CT-06: kilograms and decimal metres retain identity and precision without conversion',()=>{
 for(const unit of ['kg','米']){const h=harness(),s=source();s.rolls.forEach(r=>{r.unit=unit;r.qty=12.34567});h.act(judge(s));assert.equal(h.state().orders[0].rolls[0].unit,unit);assert.equal(h.state().orders[0].rolls[0].inputQty,12.34567)}
})
test('CT-07: cancelling leaves the original decision stale and never deletes the order',()=>{
 const h=harness(),id=h.act(judge())!;h.act({type:'CANCEL',orderId:id,reason:'实物重新核对',confirmed:true},planner)
 assert.equal(h.state().orders.length,1);assert.ok(h.state().orders[0].cancelledAt);assert.match(washingRollRelease(h.state(),'PRINT-1','R1'),/实际触摸/)
})
test('PR-01/02: a committed late target change invalidates the printed content signature',()=>{
 const h=harness(),id=h.act(judge(source('PRODUCTION_DEMAND')))!;h.act({type:'PRINT',orderId:id},planner)
 const order=h.state().orders[0];assert.equal(order.printedContentSignature,washingPrintSignature(order))
 order.source.target={id:'NEW-RECEIVER',name:'匹配后的接收方',factoryId:'NEW-RECEIVER'}
 assert.notEqual(order.printedContentSignature,washingPrintSignature(order));assert.equal(order.printedRevision,order.revision)
})
