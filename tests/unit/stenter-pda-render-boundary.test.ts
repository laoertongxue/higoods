import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function actualRender() {
  const source = ts.createSourceFile('main.ts', readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'render')!
  const code = ts.transpileModule(declaration.getText(source).replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('deps', `with(deps){${code};return render()}`)
}
function page(pathname: string) {
  const events: string[] = [], root = { innerHTML: '', querySelector: () => null }
  const deps = {
    renderSerial: 0, appStore: { getState: () => ({ pathname }) }, root,
    normalizePathname: (path: string) => path.split(/[?#]/)[0].replace(/\/$/, ''),
    ensureInitialPdaLoadingShell: () => {},
    renderCurrentPageContent: async () => { events.push('records-and-page'); return 'actual-page-content' },
    getPdaHandlersModule: async () => { events.push('aggregate-handler') },
    isPdaPath: (path: string) => path.startsWith('/fcs/pda'),
    renderAppShell: (_state: unknown, content: string) => { events.push('shell'); return content },
    includeTmfStorageWarning: (content: string) => content,
    schedulePdaMainTabPreload: () => { events.push('all-five-tab-preload') },
    hydrateIcons: () => { events.push('icons') }, queueMicrotask: (fn: () => void) => fn(),
    hydrateRealQRCodes: () => { events.push('qr') }, dynamicModuleReloadScheduled: false, clearPreloadReloadFlag: () => {},
  }
  return { events, root, run: () => actualRender()(deps) }
}

test('self-owned stenter PDA list and details keep record preparation and the shell without eagerly loading unrelated PDA aggregates', async () => {
  for (const path of ['/fcs/pda/stenter-handfeel', '/fcs/pda/stenter-handfeel/SHF-1', '/fcs/pda/stenter-handfeel/SHF-1/?x=1#rolls']) {
    const current = page(path); await current.run()
    assert.equal(current.root.innerHTML, 'actual-page-content')
    assert.deepEqual(current.events, ['records-and-page', 'shell', 'icons', 'qr'])
  }
})

test('ordinary PDA entries retain their original aggregate preparation and tab preload', async () => {
  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/stenter-handfeel-other', '/fcs/pda/stenter-handfeel/SHF-1/nested']) {
    const current = page(path); await current.run()
    assert.deepEqual(current.events, ['records-and-page', 'aggregate-handler', 'shell', 'all-five-tab-preload', 'icons', 'qr'])
  }
})
