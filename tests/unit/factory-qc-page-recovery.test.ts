import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function functions(names: string[], deps: Record<string, unknown>) {
  const source = ts.createSourceFile('factory-qc.ts', readFileSync(new URL('../../src/pages/process-factory/shared/factory-qc.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const nodes = names.map(name => {
    const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(node, name); return node.getText(source).replace(/^export /, '')
  })
  const code = ts.transpileModule(nodes.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('deps', `with(deps){${code};return {${names.join(',')}}}`)(deps)
}
function element() {
  return { innerHTML: '', textContent: '', focused: false, setAttribute() {}, focus() { this.focused = true } }
}

test('the actual detail reread action clears a failed read before attempting to access the order and retains the draft', async () => {
  const events: string[] = [], state = { notice: '', decisionDirty: true }, draft = { notes: '原输入', photoIds: ['P1'] }, before = structuredClone(draft)
  const order = { id: 'QC-1' }, alert = element(), notice = element(), root = { dataset: { factoryQcId: order.id }, querySelector: (selector: string) => selector.includes('notice') ? notice : alert }
  let unreadable = true
  const api = functions(['handleDetail'], {
    ensureFactoryQcRecords: async (force: boolean) => { assert.equal(force, true); events.push('reread'); unreadable = false },
    getFactoryQcOrder: () => { events.push('order'); if (unreadable) throw Error('current read failed'); return order },
    detailState: () => state,
    factoryQcHasUnsavedChanges: () => true,
    refreshDetail: (_root: unknown, sections: string[]) => { events.push('render'); assert.deepEqual(sections, ['summary', 'rolls', 'editor']) },
  })
  await api.handleDetail(root, { closest: () => null }, 'refresh', { type: 'click' })
  assert.deepEqual(events, ['reread', 'order', 'render'])
  assert.match(state.notice, /已重新读取.*未保存内容仍保留/)
  assert.deepEqual(draft, before)
})

for (const message of ['加工与QC资料无法读取，原记录未覆盖。', '记录已保存，页面重新读取失败；请重新读取，勿重复新建。']) {
  test('actual save error keeps the original diagnostic and recoverable editor when current records cannot be read: ' + message, async () => {
    const order = { id: 'QC-1', rolls: [{ id: 'R1' }] }, state = { selectedRoll: 'R1', decisionDirty: false, notice: '旧的已保存提示' }
    const draft = { busy: false, dirty: true, expectedVersion: 3, photos: [{ id: 'P1' }], results: { color: '有差异', handfeel: '有差异', material: '符合要求' }, notes: '保留原始输入', files: new Map() as Map<string, File>, error: '' }
    const original = { photos: structuredClone(draft.photos), results: structuredClone(draft.results), notes: draft.notes, expectedVersion: draft.expectedVersion }
    const editor = element(), errorSlot = element(), notice = element(), root = { dataset: { factoryQcId: order.id }, querySelector: (selector: string) => selector === '[data-factory-qc-editor]' ? editor : selector === '[data-factory-qc-notice]' ? notice : selector === '[data-factory-qc-roll-error]' ? errorSlot : null }
    let unreadable = false, releases = 0, imageInstalls = 0
    const api = functions(['saveRoll', 'refreshDetail'], {
      getFactoryQcOrder: () => { if (unreadable) throw Error('secondary read failure must not replace the save outcome'); return order },
      detailState: () => state, rollDraft: () => draft,
      operation: () => 'same-original-operation',
      saveFactoryQcRoll: async (_input: unknown, operation: string) => { assert.equal(operation, 'same-original-operation'); unreadable = true; throw Error(message) },
      releaseDraft: () => { releases++ }, draftKey: () => 'QC-1/R1',
      rollEditor: (snapshot: unknown) => { assert.equal(snapshot, order); return JSON.stringify({ notes: draft.notes, error: draft.error, busy: draft.busy }) },
      summary: () => '', decisionPanel: () => '', rollRows: () => '',
      installImages: () => { imageInstalls++ }, showError: () => { assert.fail('editor feedback should remain available') },
    })
    await api.saveRoll(root, order, false)
    assert.equal(draft.error, message); assert.equal(draft.busy, false); assert.equal(draft.dirty, true)
    assert.deepEqual({ photos: draft.photos, results: draft.results, notes: draft.notes, expectedVersion: draft.expectedVersion }, original)
    assert.equal(releases, 0); assert.equal(state.notice, '')
    assert.equal(notice.textContent, '')
    assert.equal(JSON.parse(editor.innerHTML).error, message); assert.equal(JSON.parse(editor.innerHTML).busy, false)
    assert.equal(errorSlot.focused, true); assert.equal(imageInstalls, 2)
  })
}
