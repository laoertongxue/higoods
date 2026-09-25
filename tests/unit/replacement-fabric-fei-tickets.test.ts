import test from 'node:test'
import assert from 'node:assert/strict'
import { createReplacementFabricTickets, reconcileReplacementFabricAssignment, confirmReplacementFabricPrint,
  replacementFabricMaterialKey, isReplacementFabricMaterial, evaluateReplacementFabricCoverage,
  validateReplacementFabricHandover, replacementTicketCode, parseReplacementTicketCode, summarizeMixedBagQuantities,
  type ReplacementFabricState, type ReplacementFabricScope, type ReplacementFabricHandoverContext,
} from '../../src/data/fcs/cutting/replacement-fabric-fei-tickets.ts'

const a = { key: replacementFabricMaterialKey('FAB-A', '蓝'), code: 'FAB-A', name: '棉布', color: '蓝', imageUrl: '/fabric-a.jpg', skuCodes: ['SKU1', 'SKU2'] }
const b = { ...a, key: replacementFabricMaterialKey('FAB-B', '蓝'), code: 'FAB-B', skuCodes: ['SKU2'] }
const scope: ReplacementFabricScope = { productionOrderId: 'po1', productionOrderNo: 'PO-001', factoryId: 'cut1', assignmentKey: 'assign1', materials: [a, b], issues: [] }
const command = (id: string) => ({ id, at: '2026-09-24T10:00:00Z', operator: '仓管' })
const empty = (): ReplacementFabricState => ({ tickets: [], prints: [], receipts: [] })
const context: ReplacementFabricHandoverContext = { taskId: 'task1', receiverFactoryId: 'factory1', productionOrderId: 'po1', requiredMaterials: [a, b], issues: [], inScope: true }
function printed() {
  const state = empty()
  reconcileReplacementFabricAssignment(state, 'po1', [scope], command('init'))
  confirmReplacementFabricPrint(state, state.tickets.map(t => t.id), [scope], command('print'))
  return state
}
test('按名称排朴，空名拒绝，同名不同编码/颜色保留独立身份', () => {
  assert.equal(isReplacementFabricMaterial('针织朴', '面料'), false)
  assert.equal(isReplacementFabricMaterial('衬布', '面料'), true)
  assert.equal(isReplacementFabricMaterial('包装', '包装材料'), false)
  assert.throws(() => isReplacementFabricMaterial('', '面料'), /名称缺失/)
  assert.notEqual(a.key, b.key)
  assert.notEqual(a.key, replacementFabricMaterialKey('FAB-A', '黑'))
})
test('初始每面料一张，重复分配幂等；新增与补打不混淆', () => {
  const state = printed()
  reconcileReplacementFabricAssignment(state, 'po1', [scope], command('again'))
  const [added] = createReplacementFabricTickets(state, scope, a.key, 1, command('add'))
  assert.equal(added.sequence, 2)
  createReplacementFabricTickets(state, scope, a.key, 1, command('add'))
  assert.throws(() => createReplacementFabricTickets(state, scope, a.key, 2, command('add')), /用于其他内容/)
  confirmReplacementFabricPrint(state, [state.tickets[0].id], [scope], command('reprint'))
  assert.equal(state.tickets.length, 3)
  assert.equal(state.tickets.reduce((sum, t) => sum + t.length, 0), 15)
  assert.equal(state.prints.at(-1)?.kind, 'REPRINT')
  assert.equal(state.prints.some(p => p.ticketId === added.id), false)
  assert.equal(parseReplacementTicketCode(replacementTicketCode(added)), added.id)
  assert.equal(parseReplacementTicketCode('FT-001'), null)
})
test('改派未交票失效，已交历史不抹除，新范围递增序号', () => {
  const state = printed(); const old = state.tickets[0]
  state.receipts.push({ id: 'receipt1', ticket: structuredClone(old), taskId: 'task1', receiverFactoryId: 'factory1', handoverRecordId: 'handover1', confirmedAt: command('').at, confirmedBy: '仓管' })
  reconcileReplacementFabricAssignment(state, 'po1', [], command('remove'))
  assert.equal(old.invalidatedAt, undefined)
  assert.ok(state.tickets[1].invalidatedAt)
  const next = { ...scope, factoryId: 'cut2', assignmentKey: 'assign2' }
  reconcileReplacementFabricAssignment(state, 'po1', [next], command('assign2'))
  assert.deepEqual(state.tickets.slice(2).map(t => t.sequence), [2, 2])
  assert.equal(state.receipts.length, 1)
})
test('部分出纸仅确认勾选票；重复确认不增加次数，内容变化拒绝', () => {
  const state = empty(); reconcileReplacementFabricAssignment(state, 'po1', [scope], command('init'))
  confirmReplacementFabricPrint(state, [state.tickets[0].id], [scope], command('part'))
  confirmReplacementFabricPrint(state, [state.tickets[0].id], [scope], command('part'))
  assert.equal(state.prints.length, 1)
  assert.throws(() => confirmReplacementFabricPrint(state, state.tickets.map(t => t.id), [scope], command('part')), /内容已变化/)
})
test('整个批次多袋并集检查，非本次袋不可借用，顺序无关', () => {
  const state = printed(); const ids = state.tickets.map(t => t.id)
  const locations = new Map([[ids[0], 'bag1-cycle1'], [ids[1], 'bag2-cycle1']])
  const base = { state, context, scopes: [scope], selectedBagUseIds: ['bag1-cycle1', 'bag2-cycle1'], locations, cutPieceQty: 20 }
  assert.equal(validateReplacementFabricHandover({ ...base, ticketIds: ids }).length, 2)
  assert.equal(validateReplacementFabricHandover({ ...base, ticketIds: [...ids].reverse() }).length, 2)
  assert.throws(() => validateReplacementFabricHandover({ ...base, ticketIds: [ids[0]] }), /缺少换片布/)
  assert.throws(() => validateReplacementFabricHandover({ ...base, ticketIds: ids, selectedBagUseIds: ['bag1-cycle1'] }), /其他中转袋/)
  assert.throws(() => validateReplacementFabricHandover({ ...base, ticketIds: ids, cutPieceQty: 0 }), /与裁片同次/)
})
test('同任务同工厂历史可满足；不同任务或换厂必须另交', () => {
  const state = printed()
  state.receipts = state.tickets.map((ticket, index) => ({ id: String(index), ticket, taskId: context.taskId, receiverFactoryId: context.receiverFactoryId, handoverRecordId: 'handover1', confirmedAt: command('').at, confirmedBy: '仓管' }))
  assert.equal(evaluateReplacementFabricCoverage(context, state.receipts, []).allowed, true)
  assert.equal(evaluateReplacementFabricCoverage({ ...context, taskId: 'task2' }, state.receipts, []).allowed, false)
  assert.equal(evaluateReplacementFabricCoverage({ ...context, receiverFactoryId: 'factory2' }, state.receipts, []).allowed, false)
  const c = { ...a, key: replacementFabricMaterialKey('C', '蓝'), code: 'C' }
  assert.deepEqual(evaluateReplacementFabricCoverage({ ...context, requiredMaterials: [a, b, c] }, state.receipts, []).missing, [c])
  assert.throws(() => validateReplacementFabricHandover({ state, context, scopes: [scope], ticketIds: state.tickets.map(t => t.id), selectedBagUseIds: [], locations: new Map(), cutPieceQty: 5 }), /已交出/)
})
test('三方自行裁剪排除，资料缺失与无需面料分开判断', () => {
  assert.equal(evaluateReplacementFabricCoverage({ ...context, inScope: false }, [], []).allowed, true)
  assert.equal(evaluateReplacementFabricCoverage({ ...context, requiredMaterials: [] }, [], []).allowed, true)
  assert.equal(evaluateReplacementFabricCoverage({ ...context, requiredMaterials: [], issues: ['缺技术资料'] }, [], []).allowed, false)
})
test('混装按类型和单位分项，换片布不能拆成非5 Yard', () => {
  const totals = summarizeMixedBagQuantities([{ kind: 'CUT_PIECE', quantity: 50, unit: '片' }, { kind: 'REPLACEMENT_FABRIC', quantity: 5, unit: 'Yard' }, { kind: 'BINDING_STRIP', quantity: 8, unit: '米' }])
  assert.deepEqual(totals.map(t => [t.kind, t.quantity, t.unit]), [['CUT_PIECE', 50, '片'], ['REPLACEMENT_FABRIC', 5, 'Yard'], ['BINDING_STRIP', 8, '米']])
  assert.throws(() => summarizeMixedBagQuantities([{ kind: 'REPLACEMENT_FABRIC', quantity: 3, unit: 'Yard' }] as never), /数量或单位/)
})
