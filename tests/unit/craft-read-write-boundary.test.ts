import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function valueImports(relative: string): string[] {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true)
  return ast.statements.filter(ts.isImportDeclaration).filter(node => {
    const clause = node.importClause
    if (!clause) return true
    if (clause.isTypeOnly) return false
    return Boolean(clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)
      || clause.namedBindings.elements.some(item => !item.isTypeOnly))
  }).map(node => (node.moduleSpecifier as ts.StringLiteral).text)
}

test('opening a craft detail does not statically load confirmation-only command domains', () => {
  const imports = valueImports('../../src/pages/process-factory/special-craft/task-detail.ts')
  assert.ok(!imports.some(path => /\/(?:design-revision-pcs-command|process-web-status-actions)\.ts$/.test(path)))
  assert.ok(!imports.some(path => path.endsWith('/web-status-action-dialog.ts')))
})

test('dialog views contain no runtime command dependency', () => {
  const imports = valueImports('../../src/pages/process-factory/shared/web-status-action-dialog-view.ts')
  assert.deepEqual(imports, ['../../../utils'])
})

test('existing dialog public API exports the same view and field functions', async () => {
  const view = await import('../../src/pages/process-factory/shared/web-status-action-dialog-view.ts')
  const original = await import('../../src/pages/process-factory/shared/web-status-action-dialog.ts')
  for (const name of ['closeProcessWebStatusActionDialog', 'isQuantityField', 'getDefaultFieldValue', 'openProcessWebStatusActionDialog', 'collectProcessWebStatusActionFields'] as const) {
    assert.equal(original[name], view[name], name)
  }
})

function actualDetailHandler(dependencies: object) {
  const relative = '../../src/pages/process-factory/special-craft/task-detail.ts'
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleSpecialCraftTaskDetailEvent')!
  const moduleState = ast.statements.filter(ts.isVariableStatement).map(node => node.getText(ast)).join('\n')
  const code = ts.transpileModule(moduleState + '\n' + node.getText(ast).replace(/^export /, '').replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', `with (dependencies) { ${code}; return handleSpecialCraftTaskDetailEvent }`)(dependencies) as (target: object) => Promise<boolean>
}
function confirmationSession(actionCode: string, load: () => Promise<void>) {
  let pathname = '/fcs/process-factory/special-craft/aux-op-seam-embroidery/work-orders/TASK-READ-BOUNDARY'
  const inserted: string[] = [], actionNode = { isConnected: true, dataset: { specialCraftWebAction: 'open-web-status-action-dialog', actionCode, sourceId: 'TASK-READ-BOUNDARY' } }
  const root = { insertAdjacentHTML: (_where: string, html: string) => inserted.push(html) }
  const dependencies = {
    handleWoolFinalReceipt: async () => false, handleWoolCraftActionUi: () => false,
    appStore: { getState: () => ({ pathname }) },
    getSpecialCraftTaskOrderById: () => ({ taskOrderId: 'TASK-READ-BOUNDARY', quantityMode: 'TICKET_INPUT_OUTPUT' }),
    loadSpecialCraftCommandModules: load, document: { getElementById: () => root, body: root },
    renderButtonLoopTaskActionDialog: (task: { taskOrderId: string }, code: string) => `${task.taskOrderId}/${code}`,
  }
  const target = { closest: (selector: string) => selector === '[data-special-craft-web-action]' ? actionNode : null }
  const handle = actualDetailHandler(dependencies)
  return { inserted, actionNode, setPathname: (next: string) => { pathname = next }, run: () => handle(target) }
}

test('all four confirmation forms wait for their original command modules before accepting input', { timeout: 10000 }, async () => {
  for (const action of ['SPECIAL_CRAFT_CONFIRM_RECEIVE', 'SPECIAL_CRAFT_PROCESS_REPORT', 'SPECIAL_CRAFT_SUBMIT_HANDOVER', 'SPECIAL_CRAFT_COMPLETE_ORDER']) {
    let release!: () => void, entered!: () => void
    const ready = new Promise<void>(resolve => { release = resolve })
    const reached = new Promise<void>(resolve => { entered = resolve })
    const session = confirmationSession(action, () => { entered(); return ready })
    const result = session.run(); await reached
    assert.deepEqual(session.inserted, [], 'no form exists while modules are unavailable')
    release(); assert.equal(await result, true)
    assert.deepEqual(session.inserted, [`TASK-READ-BOUNDARY/${action}`])
  }
})

test('a command module loading failure leaves no form or accepted unsaved input', async () => {
  const session = confirmationSession('SPECIAL_CRAFT_CONFIRM_RECEIVE', async () => { throw Error('command module unavailable') })
  await assert.rejects(session.run(), /command module unavailable/)
  assert.deepEqual(session.inserted, [])
})


test('double clicking while command loading opens only one confirmation form', async () => {
  let release!: () => void, entered!: () => void, loads = 0
  const ready = new Promise<void>(resolve => { release = resolve })
  const reached = new Promise<void>(resolve => { entered = resolve })
  const session = confirmationSession('SPECIAL_CRAFT_CONFIRM_RECEIVE', () => { loads++; entered(); return ready })
  const first = session.run(); await reached
  const second = session.run()
  await Promise.resolve(); await Promise.resolve()
  assert.deepEqual(session.inserted, [])
  release(); await Promise.all([first, second])
  assert.equal(session.inserted.length, 1)
  assert.equal(loads, 1)
})

test('a pending confirmation never opens on a changed page or a detached previous entry', async () => {
  for (const mode of ['changed-path', 'detached-entry', 'leave-and-return']) {
    let release!: () => void, entered!: () => void
    const ready = new Promise<void>(resolve => { release = resolve })
    const reached = new Promise<void>(resolve => { entered = resolve })
    const session = confirmationSession('SPECIAL_CRAFT_CONFIRM_RECEIVE', () => { entered(); return ready })
    const first = session.run(); await reached
    if (mode !== 'detached-entry') session.setPathname('/fcs/craft/wool/knitting-orders')
    if (mode !== 'changed-path') session.actionNode.isConnected = false
    if (mode === 'leave-and-return') session.setPathname('/fcs/process-factory/special-craft/aux-op-seam-embroidery/work-orders/TASK-READ-BOUNDARY')
    release(); assert.equal(await first, true)
    assert.deepEqual(session.inserted, [], mode)
  }
})

test('failed command loading releases the opening guard so a real retry can open', async () => {
  let loads = 0
  const session = confirmationSession('SPECIAL_CRAFT_CONFIRM_RECEIVE', async () => {
    if (++loads === 1) throw Error('transient command load failure')
  })
  await assert.rejects(session.run(), /transient command load failure/)
  assert.deepEqual(session.inserted, [])
  assert.equal(await session.run(), true)
  assert.equal(session.inserted.length, 1)
  assert.equal(loads, 2)
})
