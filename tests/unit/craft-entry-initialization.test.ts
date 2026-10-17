import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isIsolatedCraftReadEntry } from '../../src/main-infrastructure/craft-read-entry.ts'

function actualFunction(name: string) {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!
  assert.ok(node, name)
  const code = ts.transpileModule(node.getText(ast).replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', 'pathname', `with (dependencies) { ${code};return ${name}(pathname) }`)
}
const craft = '/fcs/process-factory/special-craft/aux-op-seam-embroidery/work-orders'

test('craft entry leaves PMS pending, preserves PCS/FCS read gates and later procurement initializes normally', async () => {
  const execute = actualFunction('renderCurrentPageContent'), events: string[] = []
  const dependencies = {
    authorizedCostCleanupError: undefined, isIsolatedCraftReadEntry,
    reloadForDynamicModuleLoadError: (error: unknown) => { throw error },
    Image: class { src = ''; decode() { return Promise.resolve() } },
    startPmsInitialization: () => { events.push('PMS started') },
    loadModule: async (path: string) => path.includes('pms/runtime')
      ? { hydratePmsLogsFromIdb: async () => { events.push('PMS logs') } }
      : path.includes('canonical-purchase-references')
        ? { ensurePurchaseCatalogState: async () => { events.push('catalog') } }
        : { ensurePcsRecordState: async () => { events.push('PCS') } },
    preparePageRouteEntry: async () => { events.push('FCS') },
    resolvePage: async (path: string) => { events.push('page');return path },
  }
  assert.equal(await execute(dependencies, craft), craft)
  assert.deepEqual(events, ['PCS', 'FCS', 'page'])
  events.length = 0
  assert.equal(await execute(dependencies, '/pms/material-purchase-orders'), '/pms/material-purchase-orders')
  assert.deepEqual(events, ['PMS started', 'PMS logs', 'catalog', 'FCS', 'page'])
})

function effectsSession(raw: string | null) {
  const events: string[] = [], state = { raw, fail: false }, execute = actualFunction('hydrateProductionSourceEffectsForEntry')
  const dependencies = {
    isIsolatedCraftReadEntry, productionSourceEffectsHydration: undefined,
    appStore: { getState: () => ({ pathname: craft }) },
    loadModule: async (path: string) => {
      if (path.includes('production-context-records')) return { productionContextStorage: { getItem: () => state.raw }, PRODUCTION_CONTEXT_KEYS: { effects: 'effects' } }
      assert.ok(path.includes('production-context-actions'), path)
      events.push('load effects')
      return { hydrateProductionSourceEffects: async () => { events.push('restore effects');if (state.fail) throw Error('saved effects unavailable') } }
    },
  }
  return { state, events, run: (path = craft) => execute(dependencies, path) as Promise<void> }
}

test('empty craft effects use existing static facts; a refreshed owner read view restores its saved overlay', async () => {
  const session = effectsSession(null)
  await session.run()
  assert.deepEqual(session.events, [])
  session.state.raw = JSON.stringify({ version: 1, entries: [['special-invalidation:0', { productionOrderId: 'PO-TEST' }]] })
  await session.run()
  assert.deepEqual(session.events, ['load effects', 'restore effects'])
})

test('saved effects await restoration, preserve errors and allow a real retry', async () => {
  const session = effectsSession('{"version":1,"entries":[]}')
  session.state.fail = true
  await assert.rejects(session.run(), /saved effects unavailable/)
  session.state.fail = false
  await session.run()
  assert.deepEqual(session.events, ['load effects', 'restore effects', 'load effects', 'restore effects'])
})

test('noncraft production keeps original effect initialization; existing lightweight entries retain their empty behavior', async () => {
  const ordinary = effectsSession(null)
  await ordinary.run('/fcs/progress/task-board')
  assert.deepEqual(ordinary.events, ['load effects', 'restore effects'])
  for (const path of ['/fcs/craft/post-finishing/work-orders', '/fcs/sewing-outsourcing/daily-return-report']) {
    const session = effectsSession(null)
    await session.run(path)
    assert.deepEqual(session.events, [])
  }
})

test('a consumed material-owner attachment failure renders its real reason and the existing reread action', async () => {
  const execute = actualFunction('renderCurrentPageContent')
  const reason = '当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。'
  const storageErrors: unknown[] = []
  const dependencies = {
    authorizedCostCleanupError: undefined, isIsolatedCraftReadEntry,
    reloadForDynamicModuleLoadError: () => false, console: { error() {} },
    Image: class { src = ''; decode() { return Promise.resolve() } }, startPmsInitialization() {},
    loadModule: async (path: string) => path.includes('pcs-record-runtime')
      ? { ensurePcsRecordState: async () => {}, getPcsCollectionFailure: () => reason }
      : { renderPcsStorageError: (error: Error) => { storageErrors.push(error);return `<button data-pcs-storage-retry>${error.message}</button>` } },
    preparePageRouteEntry: async () => {}, resolvePage: async () => { throw Error(reason) },
  }
  assert.match(await execute(dependencies, craft), /data-pcs-storage-retry/)
  assert.equal((storageErrors[0] as Error).message, reason)
  storageErrors.length = 0
  assert.match(await execute(dependencies, '/fcs/process-factory/special-craft/unknown/work-orders'), /页面内容加载失败/)
  assert.deepEqual(storageErrors, [])
})

function actualDispatcher() {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'dispatchPageEvent')!
  const code = ts.transpileModule(node.getText(ast).replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', 'target', 'event', `with (dependencies) { ${code};return dispatchPageEvent(target,event) }`)
}
test('canonical craft controls reuse their existing list/detail handlers without loading the aggregate; unknown routes retain fallback', async () => {
  const execute = actualDispatcher(), calls: string[] = [], state = { path: craft, listHandled: true }
  const dependencies = new Proxy({
    appStore: { getState: () => ({ pathname: state.path }) }, isIsolatedCraftReadEntry,
    getCurrentHandlerSystem: () => 'fcs',
    getFcsHandlersModule: async () => { calls.push('aggregate');return { dispatchFcsPageEvent: () => true } },
    loadModule: async (path: string) => {
      if (path.endsWith('/special-craft/task-orders.ts')) { calls.push('list module');return { handleSpecialCraftTaskOrdersEvent: (_target: unknown, event: Event) => { assert.equal(event.type, 'change');calls.push('list');return state.listHandled } } }
      assert.ok(path.endsWith('/special-craft/task-detail.ts'), path)
      calls.push('detail module');return { handleSpecialCraftTaskDetailEvent: async () => { await Promise.resolve();calls.push('detail');return true } }
    },
  }, { has: (_object, key) => !['dependencies', 'target', 'event'].includes(String(key)), get: (object, key) => Reflect.has(object, key) ? Reflect.get(object, key) : Reflect.has(globalThis, key) ? Reflect.get(globalThis, key) : () => false })
  const target = { closest: () => null }, event = { type: 'change' }
  assert.equal(await execute(dependencies, target, event), true)
  assert.deepEqual(calls, ['list module', 'list'])
  calls.length = 0;state.path = craft + '/ORDER-001';state.listHandled = false
  assert.equal(await execute(dependencies, target, event), true)
  assert.deepEqual(calls, ['list module', 'list', 'detail module', 'detail'])
  calls.length = 0;state.path = craft.replace('aux-op-seam-embroidery', 'unknown')
  assert.equal(await execute(dependencies, target, event), true)
  assert.deepEqual(calls, ['aggregate'])
})
