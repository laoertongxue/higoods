import test from 'node:test'
import assert from 'node:assert/strict'

const rows = new Map<string, string>()
const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value) }, removeItem: (key: string) => rows.delete(key) }
Object.defineProperty(globalThis, 'window', { value: { localStorage: storage, addEventListener() {}, dispatchEvent() {}, location: { pathname: '/' } }, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true })

const fixture = await import('../../src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')
const original = await import('../../src/data/fcs/cutting/simple-cut-piece-handover.ts')
const ledger = await import('../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
const model = await import('../../src/pages/central-pda/cutting-handover-model.ts')
const view = await import('../../src/pages/central-pda/cutting-handover-view.ts')
const replacement = await import('../../src/data/fcs/cutting/replacement-fabric-fei-tickets.ts')
const sources = await import('../../src/data/fcs/cutting/replacement-fabric-source.ts')
fixture.ensureSimpleCutPieceHandoverFixtures()
const preview = () => original.resolveSimpleCutPieceHandover('RW-10CIVDB-0IZLA0Q')

test('C01.12b: current task identity, whole tickets and prior quantities are included in the confirmation snapshot', () => {
  const source = preview(), signature = model.centralSimpleHandoutSnapshot(source)
  assert.equal(source.totalAvailablePieceQty, 700)
  for (const changed of [
    { ...source, totalHandedOverPieceQty: 1 }, { ...source, totalRemainingPieceQty: 899 },
    { ...source, candidateFingerprint: 'changed' }, { ...source, sheet: { ...source.sheet, taskSheetNo: 'OTHER' } },
  ]) assert.notEqual(model.centralSimpleHandoutSnapshot(changed), signature)
  assert.equal(model.centralSimpleHandoutSnapshot(source), signature)
})

test('C01.12b: Indonesian current-task view preserves piece and Yard units without role or quantity-explanation panels', () => {
  const p = preview(), context = sources.resolveReplacementFabricTaskContext(p.sheet)
  const source = { preview: p, records: [], replacement: { context, tickets: [], validTicketIds: [], valid: true,
    coverage: replacement.evaluateReplacementFabricCoverage(context, [], []) } }
  const html = view.renderCentralSimpleHandout(source, 'id', false, 15)
  assert.match(html, /700 potong/)
  assert.match(html, /200 potong/)
  assert.match(html, /5 Yard/)
  assert.doesNotMatch(html, /[\u3400-\u9fff]/)
  assert.doesNotMatch(html, /权限|身份|数量不符|为什么/)
})

test('C01.12b: scanner errors from current task-sheet parser ask for a rescan, never an unsaved-action retry', () => {
  for (const message of ['当前需要任务单条码或二维码，请核对纸上的“任务单号”。', '未找到任务单，请核对纸上的任务单号。']) {
    assert.equal(view.handoutError(new Error(message), 'id'), view.handoutText('id', 'wrong'))
    assert.equal(view.handoutError(new Error(message), 'zh'), view.handoutText('zh', 'wrong'))
    assert.doesNotMatch(view.handoutError(new Error(message), 'id')!, /tersimpan|Muat ulang/)
  }
})

test('C01.12b: a source change at the final pre-write check leaves no handover, while a committed retry returns its original result', async () => {
  const p = preview(), actor = { factoryId: 'OWN-CUTTING-001', operatorId: 'NODE-CURRENT-CHECK', operatorName: 'Node warehouse check', operatorRole: 'WAREHOUSE', source: 'WEB' as const }
  const input = { taskSheetNo: p.sheet.taskSheetNo, candidateFingerprint: p.candidateFingerprint, commandId: 'NODE-CENTRAL-HANDOUT-GUARD', actor }
  let checks = 0
  await assert.rejects(original.confirmSimpleCutPieceHandover(input, { assertCurrent() { if (++checks === 2) throw new Error('CUT_changed') } }), /CUT_changed/)
  assert.equal(checks, 2)
  assert.equal(ledger.listSimpleCutPieceHandoverEvents().length, 0)
  const saved = await original.confirmSimpleCutPieceHandover(input)
  const retry = await original.confirmSimpleCutPieceHandover(input, { assertCurrent() { throw new Error('A committed retry must not recalculate candidates') } })
  assert.equal(saved.event.eventId, retry.event.eventId)
  assert.equal(ledger.listSimpleCutPieceHandoverEvents().length, 1)
})
