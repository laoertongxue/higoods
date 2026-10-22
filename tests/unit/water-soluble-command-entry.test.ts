import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the real page handlers with only their external boundaries substituted.
// This avoids bootstrapping unrelated page registries and still verifies actual awaits/branches.
function pageFunctions(path: string, names: string[], entry: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const nodes = names.map(name => {
    const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(node, name)
    return node.getText(ast).replace(/^export\s+/, '')
  })
  const code = ts.transpileModule(nodes.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', `with (dependencies) { ${code}; return ${entry} }`)(dependencies) as (target: unknown) => Promise<boolean>
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
class Field { disabled = false; isConnected = true; value = '23.5' }
class Button {
  disabled = false; isConnected = true; textContent = '确认上报'; dataset: Record<string, string> = {}
  actionSelector = ''; scopeSelector = ''; controls: Array<Button | Field> = []
  closest(selector: string): unknown {
    if (selector === this.actionSelector) return this
    if (selector === this.scopeSelector) return { querySelectorAll: () => this.controls }
    return null
  }
}
const order = { waterOrderId: 'WATER-REAL-1', taskId: 'TASK-WATER-1', status: 'WATER_SOLUBLE_IN_PROGRESS', plannedQty: 100, factoryId: 'ID-F003' }

function completionPage(pda: boolean) {
  const gate = deferred(), events: string[] = [], commands: any[] = [], pending = new Set<string>()
  const button = new Button(), field = new Field(); button.controls = [button, field]
  const state: any = pda
    ? { activeTaskId: order.taskId, waterCompletionDraft: { taskId: order.taskId, orderId: order.waterOrderId, completedQty: '23.5', reason: '现场原始填写' }, waterOverlay: { type: 'completion', orderId: order.waterOrderId, taskId: order.taskId, expectedStatus: order.status, token: 'CURRENT-TOKEN' } }
    : { completionDraft: { orderId: order.waterOrderId, completedQty: '23.5', reason: '现场原始填写' }, overlay: { type: 'completion', orderId: order.waterOrderId }, overlayToken: 'CURRENT-TOKEN' }
  button.actionSelector = pda ? '[data-pda-execd-action]' : '[data-factory-water-soluble-action]'
  button.scopeSelector = pda ? '[data-testid="pda-water-soluble-overlay"], [data-testid="pda-water-soluble-detail-content"]' : '[data-factory-water-soluble-overlay], [data-testid="factory-water-soluble-card"]'
  button.dataset = pda
    ? { pdaExecdAction: 'water-confirm-completion', orderId: order.waterOrderId, taskId: order.taskId, expectedStatus: order.status, overlayToken: 'CURRENT-TOKEN' }
    : { factoryWaterSolubleAction: 'confirm-completion', orderId: order.waterOrderId, overlayToken: 'CURRENT-TOKEN' }
  const dependencies: Record<string, any> = {
    HTMLButtonElement: Button, HTMLInputElement: Field, HTMLTextAreaElement: Field, HTMLSelectElement: Field,
    state, detailState: state, pendingFactoryWaterActions: pending, pendingWaterActions: pending,
    handleManagementList: () => false, getAuthorizedOrder: () => ({ order, message: '' }),
    getWaterSolubleWorkOrderById: () => order, getPdaSession: () => ({ userName: '实际现场账号' }),
    executeWaterSolublePdaAction: (input: unknown) => { commands.push(input); events.push('COMPLETE'); return { ok: true, message: '提交成功' } },
    runDesignRevisionFcsCommand: async (target: unknown, recipe: () => unknown) => {
      assert.equal(target, order.waterOrderId)
      events.push('wrapper'); const result = recipe(); await gate.promise; events.push('commit'); return result
    },
    toast: (result: any) => events.push(result.ok ? 'success' : 'failure'),
    rejectAction: (message: string) => events.push('error:' + message),
    showPdaExecDetailToast: (message: string) => events.push(message === '提交成功' ? 'success' : 'error:' + message),
    refreshOverlay: () => events.push('overlay'), refreshList: () => events.push('list'),
    refreshWaterSolubleOverlay: () => events.push('overlay'), refreshWaterSolubleDetail: () => events.push('detail'),
    handleWoolCraftActionUi: () => false, handleKolGotoPdaExecEvent: () => false, handlePdaWoolExecutionEvent: () => false,
    syncWaterActionScope: () => {}, getCurrentExecDetailTaskId: () => order.taskId,
    validateWaterSolublePdaActor: () => '', rejectOfflinePdaMutation: () => false,
    WATER_SOLUBLE_STATUS_LABEL: { WATER_SOLUBLE_IN_PROGRESS: '水溶中' }, waterPrimaryActionTokens: new Map(),
  }
  const run = pda
    ? pageFunctions('src/pages/pda-exec-detail.ts', ['persistIndependentWaterAction', 'handlePdaExecDetailEvent'], 'handlePdaExecDetailEvent', dependencies)
    : pageFunctions('src/pages/process-factory/dyeing/water-soluble-orders.ts', ['persistFactoryWaterAction', 'hasCurrentOverlay', 'clearCompletionDraft', 'clearOverlay', 'run', 'handleCraftDyeingWaterSolubleOrdersEvent'], 'handleCraftDyeingWaterSolubleOrdersEvent', dependencies)
  return { gate, events, commands, pending, button, field, state, dependencies, run: () => run(button), draft: () => pda ? state.waterCompletionDraft : state.completionDraft, overlay: () => pda ? state.waterOverlay : state.overlay }
}

for (const pda of [false, true]) {
  const label = pda ? 'PDA' : 'factory Web'
  test(`AC-003/033: ${label} actual COMPLETE waits for the atomic wrapper before clearing draft or showing success`, async () => {
    const h = completionPage(pda), original = structuredClone(h.draft())
    let settled = false
    const saving = h.run().then(result => { settled = true; return result })
    await Promise.resolve()
    assert.deepEqual(h.events, ['wrapper', 'COMPLETE'])
    assert.equal(h.commands[0].action, 'COMPLETE'); assert.equal(h.commands[0].completedQty, 23.5)
    assert.equal(settled, false); assert.deepEqual(h.draft(), original); assert.ok(h.overlay())
    assert.equal(h.button.disabled, true); assert.equal(h.field.disabled, true)
    assert.equal(h.pending.size, 1)
    await h.run(); assert.equal(h.commands.length, 1, 'pending click must not duplicate the command')
    h.gate.resolve(); assert.equal(await saving, true)
    assert.ok(h.events.indexOf('success') > h.events.indexOf('commit'))
    assert.equal(h.draft().completedQty, ''); assert.equal(h.overlay(), null)
    assert.equal(h.pending.size, 0); assert.equal(h.button.disabled, false); assert.equal(h.field.disabled, false)
  })
  test(`AC-003/035: ${label} commit failure keeps actual draft/token and restores controls for retry`, async () => {
    const h = completionPage(pda), original = structuredClone(h.draft()), overlay = structuredClone(h.overlay())
    const saving = h.run()
    h.gate.reject(new Error('IndexedDB commit aborted'))
    assert.equal(await saving, true)
    assert.deepEqual(h.draft(), original); assert.deepEqual(h.overlay(), overlay)
    assert.equal(h.events.includes('success'), false)
    assert.ok(h.events.some(event => event.includes('commit aborted')))
    assert.equal(h.pending.size, 0); assert.equal(h.button.disabled, false); assert.equal(h.field.disabled, false)
    assert.equal(h.button.textContent, '确认上报')
    h.dependencies.runDesignRevisionFcsCommand = async (_target: unknown, recipe: () => unknown) => recipe()
    assert.equal(await h.run(), true)
    assert.equal(h.commands.length, 2); assert.equal(h.draft().completedQty, '')
  })
  test(`AC-003/037: ${label} stale confirmation token never enters the atomic wrapper`, async () => {
    const h = completionPage(pda)
    h.button.dataset.overlayToken = 'OLD-TOKEN'
    assert.equal(await h.run(), true)
    assert.equal(h.commands.length, 0); assert.equal(h.pending.size, 0)
    assert.equal(h.draft().completedQty, '23.5')
  })
}

test('AC-003/033: management factory assignment awaits the same boundary and preserves the selected factory on failure', async () => {
  const gate = deferred(), events: string[] = [], button = new Button(), field = new Field()
  field.value = 'ID-F003'; button.actionSelector = '[data-water-soluble-action]'; button.dataset = { waterSolubleAction: 'confirm-assign', orderId: order.waterOrderId }
  const state = { overlay: { type: 'assign', orderId: order.waterOrderId } }
  const dependencies: Record<string, unknown> = {
    state, assigning: false, document: { querySelector: () => field },
    assignWaterSolubleFactory: (_id: string, factoryId: string) => { assert.equal(factoryId, 'ID-F003'); events.push('assign'); return { ok: true, message: '分配成功' } },
    runDesignRevisionFcsCommand: async (target: string, recipe: () => unknown) => { assert.equal(target, order.waterOrderId); const value = recipe(); await gate.promise; return value },
    showToast: (message: string) => events.push(message), refreshOverlay: () => {}, refreshList: () => {},
  }
  const run = pageFunctions('src/pages/process-water-soluble-orders.ts', ['handleProcessWaterSolubleOrdersEvent'], 'handleProcessWaterSolubleOrdersEvent', dependencies)
  const saving = run(button)
  assert.deepEqual(events, ['assign']); assert.equal(field.disabled, true); assert.ok(state.overlay)
  gate.reject(new Error('assignment commit failed'))
  assert.equal(await saving, true)
  assert.equal(field.value, 'ID-F003'); assert.equal(field.disabled, false); assert.equal(button.disabled, false)
  assert.ok(state.overlay); assert.equal(dependencies.assigning, false)
  assert.equal(events.includes('分配成功'), false); assert.ok(events.includes('assignment commit failed'))
})
