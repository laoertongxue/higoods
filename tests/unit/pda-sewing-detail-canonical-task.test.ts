import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import {
  getMobileTaskAccessResult,
  getMobileTaskProcessType,
  getPdaMobileExecutionTaskById,
  listPdaMobileExecutionTasks,
} from '../../src/data/fcs/process-mobile-task-binding.ts'
import { getRuntimeTaskById, isRuntimeIndependentSewingTask, listRuntimeProcessTasks } from '../../src/data/fcs/runtime-process-tasks.ts'
import {
  getProductionObjectSearchIndex,
  getProductionObjectLinkIndex,
  resolveProductionObjectRequest,
  type ProductionObjectSearchIndex,
} from '../../src/data/fcs/production-object-overview.ts'

test('PDA order/task link indexes preserve all full-index candidates without constructing unrelated material rows', () => {
  const all = getProductionObjectSearchIndex(true)
  for (const objectType of ['PRODUCTION_ORDER', 'PROCESS_DOC'] as const) {
    const links = getProductionObjectLinkIndex(objectType)
    assert.deepEqual(links, all.filter(row => row.objectType === objectType), objectType)
    assert.notEqual(getProductionObjectLinkIndex(objectType), links, 'each render receives current source rows, not a cross-render cache')
    for (const row of links) {
      for (const relatedProductionOrderNo of [row.relatedProductionOrderNo, undefined, 'WRONG-CONTEXT']) {
        const request = { objectType, objectId: row.primaryNo, relatedProductionOrderNo }
        assert.deepEqual(resolveProductionObjectRequest(request, links), resolveProductionObjectRequest(request, all), row.id)
      }
    }
    const missing = { objectType, objectId: 'NOT-A-REGISTERED-DOCUMENT' }
    assert.deepEqual(resolveProductionObjectRequest(missing, links), resolveProductionObjectRequest(missing, all))
  }
  assert.equal(getProductionObjectSearchIndex(), all, 'link reads do not replace the shared full index')
})

test('ordinary sewing direct lookup keeps every field and factory permission from the complete canonical projection', () => {
  const all = listPdaMobileExecutionTasks()
  const sewing = all.filter(task => task.taskId.startsWith('TASK-SEW-') && getMobileTaskProcessType(task) === 'SEWING')
  assert.equal(sewing.length, 11)
  const statuses = new Set<string>()
  for (const expected of sewing) {
    const actual = getPdaMobileExecutionTaskById(expected.taskId)
    assert.deepEqual(actual, expected, expected.taskId)
    for (const factory of [expected.assignedFactoryId!, 'F090', 'another-factory']) {
      assert.deepEqual(getMobileTaskAccessResult(actual, factory), getMobileTaskAccessResult(expected, factory), `${expected.taskId}/${factory}`)
    }
    statuses.add(expected.status || 'NOT_STARTED')
  }
  assert.ok(statuses.size >= 3, 'comparison covers distinct execution states')
  const target = getPdaMobileExecutionTaskById('TASK-SEW-000513-F090-3')!
  assert.equal(target.qty, 940)
  assert.equal(target.dispatchedAt, '2026-03-28 07:30:00')
  assert.equal(target.acceptedAt, '2026-03-28 08:05:00')
  assert.equal(target.status, 'NOT_STARTED')
  assert.equal(getMobileTaskAccessResult(target, 'F090').canExecuteInMobile, true)
  assert.equal(getMobileTaskAccessResult(target, 'another-factory').canExecuteInMobile, false)
})

test('runtime sewing overrides and legacy/missing IDs retain the complete projection result', () => {
  const all = listPdaMobileExecutionTasks()
  const runtimeSewing = listRuntimeProcessTasks().filter(task => getMobileTaskProcessType(task) === 'SEWING')
  assert.ok(runtimeSewing.length > 0)
  for (const task of runtimeSewing) {
    const expected = all.find(candidate => candidate.taskId === task.taskId) ?? null
    assert.deepEqual(getPdaMobileExecutionTaskById(task.taskId), expected, task.taskId)
    if (expected) assert.deepEqual(expected, getRuntimeTaskById(task.taskId), `${task.taskId} retains the runtime override`)
  }
  const generatedSewing = runtimeSewing.filter(task => task.taskId.startsWith('TASKGEN-')
    && task.executionEnabled !== false && isRuntimeIndependentSewingTask(task))
  assert.ok(generatedSewing.length >= 2)
  const bindingSource = readFileSync(new URL('../../src/data/fcs/process-mobile-task-binding.ts', import.meta.url), 'utf8')
  const bindingAst = ts.createSourceFile('binding.ts', bindingSource, ts.ScriptTarget.Latest, true)
  const lookup = bindingAst.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === 'getPdaMobileExecutionTaskById')!
  const lookupJs = ts.transpileModule(lookup.getText(bindingAst).replace(/^export /, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const boundedLookup = new Function('dependencies', `with (dependencies) { ${lookupJs}; return getPdaMobileExecutionTaskById; }`)({
    applyPendingDispatchAutoAcceptance: () => {}, getRuntimeTaskById, isRuntimeIndependentSewingTask, getMobileTaskProcessType,
    getSpecialCraftTaskOrderById: () => null,
    listPdaMobileExecutionTasks: () => { throw new Error('single sewing detail enumerated unrelated factory domains') },
  })
  for (const task of generatedSewing) assert.deepEqual(boundedLookup(task.taskId), all.find(row => row.taskId === task.taskId))
  for (const id of ['TASK-SEW-missing-task', 'PDA-EXEC-legacy-missing-task', '']) {
    assert.equal(getPdaMobileExecutionTaskById(id), null, id)
  }
})

test('one fresh read-only object snapshot preserves readiness, context and unknown references without refreshing per miss', () => {
  // Earlier canonical runtime tests can add their normal warehouse seed rows.
  // Compare two current reads, not a snapshot captured before those facts.
  const previous = getProductionObjectSearchIndex(true)
  const snapshot = getProductionObjectSearchIndex(true)
  assert.notEqual(snapshot, previous, 'a new render must refresh actual source records once')
  assert.deepEqual(snapshot, previous, 'refresh cannot change unchanged source facts')
  const actualRequests = [
    { objectType: 'PROCESS_DOC' as const, objectId: 'TASK-SEW-000513-F090-3', relatedProductionOrderNo: 'PO-20260328-131' },
    { objectType: 'PROCESS_DOC' as const, objectId: 'TASK-SEW-000513-F090-3' },
    { objectType: 'PRODUCTION_ORDER' as const, objectId: 'PO-20260328-131' },
  ]
  for (const request of actualRequests) {
    assert.deepEqual(resolveProductionObjectRequest(request, snapshot), resolveProductionObjectRequest(request))
    assert.equal(resolveProductionObjectRequest(request, snapshot).status, 'UNLINKED', 'unregistered IDs stay plain text')
  }
  const ready = snapshot.find(row => row.objectType === 'PRODUCTION_ORDER' && row.relatedProductionOrderNo)!
  assert.ok(ready)
  for (const relatedProductionOrderNo of [ready.relatedProductionOrderNo, 'WRONG-CONTEXT']) {
    const request = { objectType: ready.objectType, objectId: ready.primaryNo, relatedProductionOrderNo }
    assert.deepEqual(resolveProductionObjectRequest(request, snapshot), resolveProductionObjectRequest(request))
  }

  // Two known matches with the same document number must still require an
  // explicit production order, and an unrelated context must remain unlinked.
  const row: ProductionObjectSearchIndex = {
    id: 'snapshot-known-doc', objectType: 'PROCESS_DOC', primaryNo: 'SNAPSHOT-DOC',
    displayTitle: '已登记工艺单', keywords: [], sourceDomain: 'FCS',
    relatedProductionOrderNo: 'SNAPSHOT-PO-A', routePath: '/fcs/process-orders/SNAPSHOT-DOC',
  }
  const duplicateSnapshot = Object.freeze([row, { ...row, id: 'snapshot-known-doc-b', relatedProductionOrderNo: 'SNAPSHOT-PO-B' }])
  const currentSourceIndex = getProductionObjectSearchIndex()
  const noContext = resolveProductionObjectRequest({ objectType: 'PROCESS_DOC', objectId: row.primaryNo }, duplicateSnapshot)
  assert.equal(noContext.status, 'MULTIPLE_MATCHES')
  if (noContext.status === 'MULTIPLE_MATCHES') assert.deepEqual(noContext.candidates, duplicateSnapshot)
  const withContext = resolveProductionObjectRequest({ objectType: 'PROCESS_DOC', objectId: row.primaryNo, relatedProductionOrderNo: 'SNAPSHOT-PO-B' }, duplicateSnapshot)
  assert.equal(withContext.status, 'READY')
  if (withContext.status === 'READY') assert.equal(withContext.indexItem.relatedProductionOrderNo, 'SNAPSHOT-PO-B')
  assert.equal(resolveProductionObjectRequest({ objectType: 'PROCESS_DOC', objectId: row.primaryNo, relatedProductionOrderNo: 'UNKNOWN' }, duplicateSnapshot).status, 'UNLINKED')
  assert.equal(resolveProductionObjectRequest({ objectType: 'PROCESS_DOC', objectId: 'NOT-IN-SNAPSHOT' }, duplicateSnapshot).status, 'UNLINKED')
  assert.equal(getProductionObjectSearchIndex(), currentSourceIndex, 'snapshot misses never replace the current source index')
})

test('PDA handlers wait for part-ticket hydration, and the real detail is not mounted before both dependencies complete', async () => {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['renderCurrentPageContent', 'render'].includes(node.name?.text || ''))
  assert.equal(functions.length, 2)
  // Execute the actual routing/render control flow with bounded module loaders.
  // Replacing import syntax lets the test reproduce the observed module read
  // gate without opening or altering any browser/business store.
  const script = functions.map(node => node.getText(ast)).join('\n').replaceAll('import(', 'loadModule(')
  const javascript = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  let releasePreparation!: () => void
  let releaseHandler!: () => void
  let prepared = false
  const preparation = new Promise<void>(resolve => { releasePreparation = resolve })
  const handlers = new Promise<void>(resolve => { releaseHandler = resolve })
  const events: string[] = []
  let mounted = ''
  const dependencies = {
    renderSerial: 0,
    appStore: { getState: () => ({ pathname: '/fcs/pda/exec/TASK-SEW-000513-F090-3' }) },
    ensureInitialPdaLoadingShell: () => {},
    startPmsInitialization: () => {},
    loadModule: async () => ({ ensurePcsRecordState: async () => { events.push('PCS ready') } }),
    preparePageRouteEntry: async () => { events.push('preparation started'); await preparation; prepared = true; events.push('part tickets ready') },
    resolvePage: async () => { assert.equal(prepared, true); events.push('detail ready'); return '<article>Actual task 940</article>' },
    getPdaHandlersModule: async () => { assert.equal(prepared, true, 'warehouse handler module may read part tickets only after hydration'); events.push('handler requested'); await handlers; events.push('handler ready') },
    isPdaPath: () => true,
    root: { get innerHTML() { return mounted }, set innerHTML(html: string) { mounted = html; events.push('mounted') }, querySelector: () => null },
    renderAppShell: (_state: unknown, html: string) => html,
    includeTmfStorageWarning: (html: string) => html,
    schedulePdaMainTabPreload: () => {},
    hydrateIcons: () => {},
    hydrateRealQRCodes: () => {},
    dynamicModuleReloadScheduled: false,
    clearPreloadReloadFlag: () => {},
  }
  const execute = new Function('dependencies', `with (dependencies) { ${javascript}; return render() }`)
  const rendering = execute(dependencies) as Promise<void>
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(events.includes('handler requested'), false)
  assert.equal(mounted, '')
  releasePreparation()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(events.includes('detail ready'), true)
  assert.equal(events.includes('handler requested'), true)
  assert.equal(mounted, '', 'Loading/partial data must not count as the operative DOM')
  releaseHandler()
  await rendering
  assert.equal(mounted, '<article>Actual task 940</article>')
  assert.ok(events.indexOf('part tickets ready') < events.indexOf('handler requested'))
  assert.ok(events.indexOf('handler ready') < events.indexOf('mounted'))
})

test('ordinary sewing detail leaves unrelated PMS initialization pending until a normal module entry', async () => {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const routeFunction = ast.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === 'renderCurrentPageContent')!
  const script = routeFunction.getText(ast).replaceAll('import(', 'loadModule(')
  const javascript = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const execute = new Function('dependencies', 'pathname', `with (dependencies) { ${javascript}; return renderCurrentPageContent(pathname) }`)
  function createSession() {
    const events: string[] = []
    let pmsInitializationStarted = false
    const dependencies = {
      startPmsInitialization: () => {
        if (pmsInitializationStarted) return
        pmsInitializationStarted = true
        events.push('PMS started')
      },
      loadModule: async (path: string) => path.includes('runtime-process-tasks')
        ? { getRuntimeTaskById, isRuntimeIndependentSewingTask }
        : path.includes('pda-exec-detail')
          ? { renderPdaExecDetailPage: (taskId: string) => {
            assert.ok(events.includes('FCS and part tickets ready'))
            assert.ok(events.includes('PDA handler ready'))
            events.push(`direct sewing ${taskId}`)
            return `<article>/fcs/pda/exec/${taskId}</article>`
          } }
        : { ensurePcsRecordState: async () => { events.push('PCS ready') } },
      preparePageRouteEntry: async () => { events.push('FCS and part tickets ready') },
      resolvePage: async (pathname: string) => { events.push(`page ${pathname}`); return `<article>${pathname}</article>` },
      getPdaHandlersModule: async () => { events.push('PDA handler ready') },
    }
    return { events, dependencies, isPmsStarted: () => pmsInitializationStarted }
  }
  const session = createSession()
  const sewingPath = '/fcs/pda/exec/TASK-SEW-000513-F090-3'
  const generatedPaths = ['/fcs/pda/exec/TASKGEN-202603-0007-002__ORDER', '/fcs/pda/exec/TASKGEN-202603-0015-002__ORDER']
  for (const pathname of [sewingPath, `${sewingPath}?returnTo=%2Ffcs%2Fpda%2Fexec&action=start`, ...generatedPaths]) {
    assert.equal(await execute(session.dependencies, pathname), `<article>${pathname}</article>`)
    assert.equal(session.isPmsStarted(), false)
  }
  assert.equal(session.events.filter(event => event === 'PCS ready').length, 4)
  assert.equal(session.events.filter(event => event === 'FCS and part tickets ready').length, 4)
  assert.equal(session.events.filter(event => event === 'PDA handler ready').length, 4)
  assert.equal(session.events.filter(event => event.startsWith('direct sewing ')).length, 2)
  assert.equal(session.events.some(event => event.startsWith('page /fcs/pda/exec/TASKGEN-')), false,
    'ordinary generated sewing must not evaluate the unrelated cutting/supplement route registry')
  assert.ok(session.events.indexOf('PCS ready') < session.events.indexOf('FCS and part tickets ready'))
  assert.ok(session.events.indexOf('FCS and part tickets ready') < session.events.indexOf('PDA handler ready'))
  await execute(session.dependencies, '/pms/product-purchase-orders')
  assert.equal(session.isPmsStarted(), true, 'entering PMS still starts its original initialization')
  assert.equal(session.events.filter(event => event === 'PMS started').length, 1)

  for (const pathname of ['/fcs/pda/exec/TASK-PRINT-000714', '/fcs/pda/exec/TASKGEN-202603-0007-001__ORDER', '/fcs/progress/board']) {
    const other = createSession()
    assert.equal(await execute(other.dependencies, pathname), `<article>${pathname}</article>`)
    assert.equal(other.isPmsStarted(), true, pathname)
    assert.equal(other.events.filter(event => event === 'PMS started').length, 1)
  }
})
