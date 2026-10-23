import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isIsolatedCraftReadEntry } from '../../src/main-infrastructure/craft-read-entry.ts'
import { renderCraftWorkbenchOverviewPage } from '../../src/pages/process-factory/workbench/overview.ts'

function actualFunction(name: string) {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!
  assert.ok(node, name)
  const code = ts.transpileModule(node.getText(ast).replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', 'pathname', `with (dependencies) { ${code};return ${name}(pathname) }`)
}
const craft = '/fcs/process-factory/special-craft/aux-op-seam-embroidery/work-orders'

test('static craft overview renders its original content before unrelated procurement and production initialization', async () => {
  const execute = actualFunction('renderCurrentPageContent'), events: string[] = []
  const dependencies = {
    authorizedCostCleanupError: undefined, isIsolatedCraftReadEntry,
    previousRenderedPagePathname: '/fcs/craft/cutting/supplement-management',
    reloadForDynamicModuleLoadError: (error: unknown) => { throw error },
    Image: class { src = ''; decode() { return Promise.resolve() } },
    startPmsInitialization: () => { events.push('PMS') },
    preparePageRouteEntry: async () => { events.push('production') },
    resolvePage: async () => { events.push('registry');return 'generic-route' },
    loadModule: async (path: string) => {
      assert.equal(path, './pages/process-factory/workbench/overview.ts')
      events.push('overview');return { renderCraftWorkbenchOverviewPage }
    },
  }
  for (const path of ['/fcs/craft/workbench/overview', '/fcs/craft/workbench/overview/?tab=x#top']) {
    events.length = 0
    assert.equal(await execute(dependencies, path), renderCraftWorkbenchOverviewPage())
    assert.deepEqual(events, ['overview'])
    assert.equal(dependencies.previousRenderedPagePathname, path.split('?')[0].split('#')[0])
  }
  for (const path of ['/fcs/craft/workbench/overview-extra', '/fcs/craft/workbench/overview/child', '/fcs/workbench/overview']) {
    events.length = 0
    assert.equal(await execute(dependencies, path), 'generic-route')
    assert.deepEqual(events, ['PMS', 'production', 'registry'])
  }
})

test('factory profile uses its existing page owner without unrelated initialization and retains the prior cleanup error guard', async () => {
  const execute = actualFunction('renderCurrentPageContent'), events: string[] = []
  const dependencies = {
    authorizedCostCleanupError: undefined as Error | undefined, isIsolatedCraftReadEntry,
    previousRenderedPagePathname: '/fcs/craft/cutting/supplement-management',
    reloadForDynamicModuleLoadError: (error: unknown) => { throw error },
    Image: class { src = ''; decode() { return Promise.resolve() } },
    startPmsInitialization: () => { events.push('PMS') },
    preparePageRouteEntry: async () => { events.push('production') },
    resolvePage: async () => { events.push('registry');return 'generic-route' },
    getFactoryProfilePageModule: async () => ({ renderFactoryProfilePage: () => { events.push('profile');return 'existing-profile' } }),
    loadModule: async (path: string) => {
      assert.equal(path, './pages/pcs-storage-error.ts')
      return { renderPcsStorageError: (error: Error) => error.message }
    },
  }
  for (const path of ['/fcs/factories/profile', '/fcs/factories/profile/?view=x#top']) {
    events.length = 0
    assert.equal(await execute(dependencies, path), 'existing-profile')
    assert.deepEqual(events, ['profile'])
    assert.equal(dependencies.previousRenderedPagePathname, path.split('?')[0].split('#')[0])
  }
  events.length = 0
  assert.equal(await execute(dependencies, '/fcs/factories/profile-extra'), 'generic-route')
  assert.deepEqual(events, ['PMS', 'production', 'registry'])
  dependencies.authorizedCostCleanupError = new Error('existing cleanup read failed')
  events.length = 0
  for (const path of ['/fcs/craft/workbench/overview', '/fcs/factories/profile']) {
    assert.equal(await execute(dependencies, path), 'existing cleanup read failed')
  }
  assert.deepEqual(events, [])
})

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

test('affected financial and dye-report entries retain preparation after PCS where required, with PMS deferred', async () => {
  const execute = actualFunction('renderCurrentPageContent'), events: string[] = []
  const dependencies = {
    authorizedCostCleanupError: undefined, isIsolatedCraftReadEntry,
    reloadForDynamicModuleLoadError: (error: unknown) => { throw error },
    Image: class { src = ''; decode() { return Promise.resolve() } },
    startPmsInitialization: () => { events.push('PMS') },
    loadModule: async (path: string) => path.endsWith('/central-execution-record-bridge.ts')
      ? { ensureCentralExecutionRecordRead: async () => { events.push('shared receipts') } }
      : { ensurePcsRecordState: async () => { events.push('PCS') } },
    preparePageRouteEntry: async () => { events.push('FCS') },
    resolvePage: async (path: string) => { events.push('page');return path },
  }
  for (const path of ['/fcs/settlement/adjustments', '/fcs/settlement/statements', '/fcs/quality/deduction-analysis', '/fcs/craft/dyeing/reports']) {
    events.length = 0
    assert.equal(await execute(dependencies, path), path)
    assert.deepEqual(events, path.endsWith('/reports') ? ['shared receipts', 'PCS', 'FCS', 'page'] : ['FCS', 'page'], path)
  }
})

test('four affected read entries skip absent effects, restore saved effects, and preserve failure/retry', async () => {
  for (const path of ['/fcs/settlement/adjustments', '/fcs/settlement/statements', '/fcs/quality/deduction-analysis', '/fcs/craft/dyeing/reports']) {
    const session = effectsSession(null)
    await session.run(path)
    assert.deepEqual(session.events, [], path)
    session.state.raw = '{invalid saved effects'
    session.state.fail = true
    await assert.rejects(session.run(path), /saved effects unavailable/)
    session.state.raw = '{"version":1,"entries":[]}'
    session.state.fail = false
    await session.run(path)
    assert.deepEqual(session.events, ['load effects', 'restore effects', 'load effects', 'restore effects'], path)
  }
})

test('affected page controls return the original owner result without the aggregate, including draft-only false', async () => {
  const execute = actualDispatcher(), calls: string[] = [], state = { path: '', handled: false }
  const owners = new Map([
    ['/fcs/settlement/adjustments', ['./pages/adjustments.ts', 'handleAdjustmentsEvent']],
    ['/fcs/settlement/statements', ['./pages/statements.ts', 'handleStatementsEvent']],
    ['/fcs/quality/deduction-analysis', ['./pages/deduction-analysis.ts', 'handleDeductionAnalysisEvent']],
    ['/fcs/craft/dyeing/reports', ['./pages/process-factory/dyeing/events.ts', 'handleCraftDyeingEvent']],
  ])
  const dependencies = new Proxy({
    appStore: { getState: () => ({ pathname: state.path }) }, isIsolatedCraftReadEntry,
    getCurrentHandlerSystem: () => 'fcs',
    getFcsHandlersModule: async () => { throw Error('unrelated aggregate loaded') },
    loadModule: async (path: string) => {
      const [expected, handler] = owners.get(state.path)!
      assert.equal(path, expected);calls.push(path)
      return { [handler]: async () => state.handled }
    },
  }, { has: (_object, key) => !['dependencies', 'target', 'event'].includes(String(key)), get: (object, key) => Reflect.has(object, key) ? Reflect.get(object, key) : Reflect.has(globalThis, key) ? Reflect.get(globalThis, key) : () => false })
  for (const [path, [owner]] of owners) for (const handled of [false, true]) {
    state.path = path;state.handled = handled;calls.length = 0
    assert.equal(await execute(dependencies, { closest: () => null }, { type: 'change' }), handled)
    assert.deepEqual(calls, [owner])
  }
})

test('affected Escape keeps the existing statement close-detail operation and avoids unrelated closers', async () => {
  const execute = actualFunction('closeDialogsOnEscape'), calls: string[] = [], state = { path: '', open: false }
  const dependencies = {
    appStore: { getState: () => ({ pathname: state.path }) },
    loadModule: async (path: string) => { assert.equal(path, './pages/statements.ts');calls.push('statements');return {
      isStatementsDialogOpen: () => state.open,
      handleStatementsEvent: (target: { dataset: { stmAction?: string } }) => { calls.push(target.dataset.stmAction!);return true },
    } },
    document: { createElement: () => ({ dataset: {} }) },
    isProductionRoutePath: () => false,
    getCurrentHandlerSystem: () => 'fcs', getFcsHandlersModule: () => { throw Error('unrelated aggregate loaded') },
  }
  for (const path of ['/fcs/settlement/adjustments', '/fcs/quality/deduction-analysis', '/fcs/craft/dyeing/reports']) {
    state.path = path;assert.equal(await execute(dependencies, ''), false)
  }
  assert.deepEqual(calls, [])
  state.path = '/fcs/settlement/statements'
  assert.equal(await execute(dependencies, ''), false)
  state.open = true
  assert.equal(await execute(dependencies, ''), true)
  assert.deepEqual(calls, ['statements', 'statements', 'close-detail'])
})

test('four affected pages expose actual malformed-source reason and existing reload recovery without displaying normal data', async () => {
  const execute = actualFunction('renderCurrentPageContent')
  const reason = '分配关联记录身份错误，未覆盖原数据。'
  const dependencies = {
    authorizedCostCleanupError: undefined, isIsolatedCraftReadEntry,
    reloadForDynamicModuleLoadError: () => false, console: { error() {} },
    Image: class { src = ''; decode() { return Promise.resolve() } }, startPmsInitialization() {},
    normalizePathname: (path: string) => path.split(/[?#]/)[0],
    escapeHtml: (value: string) => value.replaceAll('<', '&lt;'),
    loadModule: async () => ({ ensureCentralExecutionRecordRead: async () => {}, ensurePcsRecordState: async () => {}, getPcsCollectionFailure: () => '' }),
    preparePageRouteEntry: async () => { throw Error(reason) },
    resolvePage: async () => { throw Error('normal renderer must stay blocked') },
  }
  for (const path of ['/fcs/settlement/adjustments', '/fcs/settlement/statements', '/fcs/quality/deduction-analysis', '/fcs/craft/dyeing/reports']) {
    const html = await execute(dependencies, path)
    assert.match(html, /role="alert"/)
    assert.ok(html.includes(reason), path)
    assert.match(html, /data-cutting-record-retry/)
    assert.match(html, /原记录没有被覆盖/)
  }
  assert.equal(await execute(dependencies, '/fcs/quality/unrelated'), '<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">页面内容加载失败，请稍后重试。</section>')
})
