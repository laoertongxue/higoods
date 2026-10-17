import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function receiptSession() {
  const source = readFileSync(new URL('../../src/pages/process-factory/special-craft/task-detail.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('task-detail.ts', source, ts.ScriptTarget.Latest, true)
  const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleWoolFinalReceipt')!
  assert.ok(handler)
  const code = ts.transpileModule(handler.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const state = { pathname: '/fcs/process-factory/special-craft/current/work-orders/ORDER-A' }
  const errorNode = { textContent: '' }
  const content = { isConnected: true, replaceWith(value: unknown) { replacements.push(value) } }
  let currentContent: typeof content | undefined = content
  const dialog = {
    isConnected: true, dataset: { taskId: 'ORDER-A', command: 'REV-A' },
    remove() { this.isConnected = false },
    querySelector() { return errorNode },
    querySelectorAll(selector: string) {
      return selector.includes('select')
        ? [{ checked: true, dataset: { woolFinalSelect: 'HANDOVER-A' } }]
        : [{ value: '7', dataset: { woolFinalHandoverId: 'HANDOVER-A' } }]
    },
  }
  const replacements: unknown[] = [], toasts: string[] = [], commands: unknown[] = [], rendered: unknown[] = []
  let completeCommand!: (value: { message: string }) => void, failCommand!: (error: Error) => void
  let completeRender!: (value: string) => void
  let markCommand!: () => void, markRender!: () => void
  const commandStarted = new Promise<void>(resolve => { markCommand = resolve })
  const renderStarted = new Promise<void>(resolve => { markRender = resolve })
  const pendingCommand = new Promise<{ message: string }>((resolve, reject) => { completeCommand = resolve; failCommand = reject })
  const pendingRender = new Promise<string>(resolve => { completeRender = resolve })
  const fresh = { current: true }
  const document = {
    getElementById() { return dialog },
    querySelector() { return currentContent },
    createElement() {
      return { set innerHTML(value: unknown) { rendered.push(value) }, content: { querySelector() { return fresh } } }
    },
  }
  const api = {
    document, appStore: { getState: () => state },
    getSpecialCraftTaskOrderById: () => ({ taskOrderId: 'ORDER-A', operationId: 'OP-A' }),
    loadSpecialCraftCommandModules: async () => [{
      runDesignRevisionFcsCommand: (_id: string, command: () => unknown) => { command(); markCommand(); return pendingCommand },
    }, { executeProcessWebAction: (input: unknown) => { commands.push(input) } }],
    showToast: (message: string) => toasts.push(message),
    renderSpecialCraftTaskDetailPage: async (...args: unknown[]) => { rendered.push(args); markRender(); return pendingRender },
  }
  const handle = new Function(...Object.keys(api), `${code}; return handleWoolFinalReceipt`)(...Object.values(api))
  return {
    state, content, dialog, errorNode, commands, rendered, replacements, toasts, fresh,
    commandStarted, renderStarted, completeCommand, failCommand, completeRender,
    replaceContent() { currentContent = { ...content } },
    start() { return handle({ closest: () => ({ dataset: { woolFinalAction: 'receive' } }) }) as Promise<boolean> },
  }
}

test('wool final receipt waits for the actual async detail HTML before replacing current content', async () => {
  const session = receiptSession(), pending = session.start()
  await session.commandStarted
  assert.equal(session.commands.length, 1)
  session.completeCommand({ message: '已接收' })
  await session.renderStarted
  assert.deepEqual(session.replacements, [])
  session.completeRender('<section>current receipt</section>')
  assert.equal(await pending, true)
  assert.deepEqual(session.replacements, [session.fresh])
  assert.equal(session.rendered.at(-1), '<section>current receipt</section>')
  assert.deepEqual(session.toasts, ['已接收'])
})

test('wool final receipt cannot redraw another route or replacement DOM after command completion', async () => {
  for (const change of ['route', 'dom']) {
    const session = receiptSession(), pending = session.start()
    await session.commandStarted
    if (change === 'route') session.state.pathname = '/another-order'
    else session.replaceContent()
    session.completeCommand({ message: '已接收' })
    assert.equal(await pending, true)
    assert.deepEqual(session.rendered, [])
    assert.deepEqual(session.replacements, [])
    assert.deepEqual(session.toasts, [])
  }
})

test('wool receipt late detail HTML cannot replace a detached or same-URL replacement content node', async () => {
  for (const change of ['route', 'detached', 'replacement']) {
    const session = receiptSession(), pending = session.start()
    await session.commandStarted
    session.completeCommand({ message: '已接收' })
    await session.renderStarted
    if (change === 'route') session.state.pathname = '/another-order'
    else if (change === 'detached') session.content.isConnected = false
    else session.replaceContent()
    session.completeRender('<section>old receipt</section>')
    assert.equal(await pending, true)
    assert.deepEqual(session.replacements, [])
    assert.deepEqual(session.rendered, [['OP-A', 'ORDER-A']])
  }
})

test('wool receipt save error preserves current input and cannot publish a stale error on another page', async () => {
  for (const leave of [false, true]) {
    const session = receiptSession(), pending = session.start()
    await session.commandStarted
    if (leave) session.state.pathname = '/another-order'
    session.failCommand(new Error('原保存错误'))
    assert.equal(await pending, true)
    assert.equal(session.errorNode.textContent, leave ? '' : '原保存错误')
    assert.equal(session.dialog.isConnected, true)
    assert.deepEqual(session.replacements, [])
    assert.deepEqual(session.toasts, [])
  }
})
