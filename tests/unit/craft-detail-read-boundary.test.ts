import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const helperFile = 'src/data/fcs/process-order-task-detail-read.ts'
const printKey = 'higoods.formal-print-execution.v1'
const dyeKey = 'higoods.formal-dye-execution.v1'
type SourceReader = (codes?: ReadonlySet<string>) => any[]

// Execute actual module bodies with explicit import boundaries. No full owner is
// imported by this test process, so a previous test cannot warm a cold case.
function actualModule(file: string, dependencies: Record<string, unknown>, names: string[], dynamicOwner = false): any {
  const source = readFileSync(root + file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let body = ast.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
    .map(node => node.getText(ast).replace(/^export\s+/, '')).join('\n')
  if (dynamicOwner) {
    const dynamicCalls: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicCalls.push(node)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    assert.equal(dynamicCalls.length, 1, 'only the actual complete-owner boundary is substituted')
    assert.equal((dynamicCalls[0].arguments[0] as ts.StringLiteral).text, './process-work-order-domain.ts')
    assert.ok(body.includes(dynamicCalls[0].getText(ast)))
    body = body.replace(dynamicCalls[0].getText(ast), 'loadCompleteOwner()')
  }
  const code = ts.transpileModule(body, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText
  return new Function('dependencies', `with (dependencies) { ${code}; return {${names.join(',')}} }`)(dependencies)
}

function sourceRow(qty: number, id = 'SOURCE-A') {
  return { workOrderId: id, workOrderNo: 'DOC-' + id, processType: 'PRINT', sourceType: 'STOCK',
    sourceSnapshot: { sourceType: 'STOCK', productionOrderId: 'ORDER-A', stockMaterialId: 'MATERIAL' },
    sourceProductionOrderId: 'ORDER-A', sourceProductionOrderNo: 'PO-A', objectType: '面料',
    materialSku: 'SKU-A', materialName: '真实来源', plannedQty: qty, plannedUnit: '米' }
}

function helperSession(options: { browser?: boolean } = {}) {
  const loaded = new Set<string>(), storage = new Map<string, string>(), calls = { loads: 0, water: 0, writes: 0, keys: [] as string[] }
  // Use real synchronous EventTarget dispatch and listener identity/removal.
  // Only the module's browser boundary is isolated; the source handler runs.
  const browserWindow = new EventTarget(), listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const listenerCalls: Array<{ action: 'add' | 'remove'; type: string; listener: EventListenerOrEventListenerObject | null }> = []
  const add = browserWindow.addEventListener.bind(browserWindow), remove = browserWindow.removeEventListener.bind(browserWindow)
  browserWindow.addEventListener = (type, listener, options) => {
    if (listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener) }
    listenerCalls.push({ action: 'add', type, listener }); add(type, listener, options)
  }
  browserWindow.removeEventListener = (type, listener, options) => {
    if (listener) listeners.get(type)?.delete(listener)
    listenerCalls.push({ action: 'remove', type, listener }); remove(type, listener, options)
  }
  let rawRead: (key: string) => string | null = key => storage.get(key) ?? null
  let records = [sourceRow(7)]
  const waterRecords = [sourceRow(2, 'WATER-Z'), sourceRow(1, 'WATER-A')]
  let waterRead = () => structuredClone(waterRecords)
  const fullReader: SourceReader = () => structuredClone(records)
  let ownerLoad: () => Promise<unknown> = async () => ({ listProcessWorkOrderRelationSources: fullReader })
  const dependencies = {
    window: options.browser === false ? undefined : browserWindow,
    localStorage: options.browser === false ? undefined : {},
    PRINT_EXECUTION_STORAGE_KEY: printKey, DYE_EXECUTION_STORAGE_KEY: dyeKey,
    hasDesignRevisionFcsCacheOwner: (name: string) => loaded.has(name),
    getDesignRevisionFcsStorage: () => ({ getItem(key: string) { calls.keys.push(key); return rawRead(key) },
      setItem() { calls.writes++; throw Error('read path attempted save') }, removeItem() { calls.writes++; throw Error('read path attempted delete') } }),
    listWaterSolubleRelationSources: () => { calls.water++; return waterRead() },
    loadCompleteOwner: () => { calls.loads++; return ownerLoad() },
  }
  const actual = actualModule(helperFile, dependencies, ['readPreparedProcessOrderTaskDetail'], true)
  return { loaded, storage, calls, fullReader, waterRecords, listenerCalls,
    activePreloadListeners: () => listeners.get('vite:preloadError')?.size ?? 0,
    dispatchPreloadError: (payload: unknown, detail?: unknown) => {
      const event = new Event('vite:preloadError', { cancelable: true })
      Object.defineProperty(event, 'payload', { value: payload })
      Object.defineProperty(event, 'detail', { value: detail })
      event.preventDefault() // The existing main listener suppresses Vite's throw.
      browserWindow.dispatchEvent(event)
      return event
    },
    // The real entry accepts only synchronous HTML/string callbacks. Encode
    // fixture results inside that callback; a reader never leaves its scope.
    run: async <T>(read: (reader: SourceReader) => T): Promise<T> => JSON.parse(
      await actual.readPreparedProcessOrderTaskDetail((reader: SourceReader) => JSON.stringify(read(reader)))),
    setRead: (reader: typeof rawRead) => { rawRead = reader },
    setWater: (reader: typeof waterRead) => { waterRead = reader },
    setRecords: (next: typeof records) => { records = next },
    setLoader: (loader: typeof ownerLoad) => { ownerLoad = loader } }
}

test('an unrelated fresh detail keeps only exact water sources and performs no command writes', async () => {
  const s = helperSession(), before = structuredClone(s.waterRecords)
  let reads = 0
  const result = await s.run(reader => { reads++; return reader(new Set(['AUX_DALAN'])) })
  assert.deepEqual(result, [...before].sort((a, b) => a.workOrderNo.localeCompare(b.workOrderNo)))
  assert.deepEqual(s.waterRecords, before)
  assert.equal(reads, 1); assert.equal(s.calls.loads, 0); assert.equal(s.calls.water, 1); assert.equal(s.calls.writes, 0)
  assert.deepEqual(s.calls.keys, [printKey, dyeKey])
})

test('the original non-browser guard does not probe browser storage', async () => {
  const s = helperSession({ browser: false })
  s.setRead(() => { throw Error('this storage is not available in this environment') })
  assert.equal((await s.run(reader => reader(new Set(['CUT_PANEL'])))).length, 2)
  assert.deepEqual(s.calls.keys, []); assert.equal(s.calls.loads, 0)
})

test('undefined, PRINT and DYE scopes each make one complete-source fallback', async () => {
  for (const codes of [undefined, new Set(['PRINT']), new Set(['DYE']), new Set(['CUT', 'PRINT', 'DYE'])]) {
    const s = helperSession(); let callbacks = 0, fullReads = 0
    s.setLoader(async () => ({ listProcessWorkOrderRelationSources: (actualCodes: ReadonlySet<string> | undefined) => {
      fullReads++; assert.equal(actualCodes, codes); return [sourceRow(11)]
    } }))
    const result = await s.run(reader => { callbacks++; return reader(codes) })
    assert.equal(result[0].plannedQty, 11); assert.equal(callbacks, 2); assert.equal(fullReads, 1)
    assert.equal(s.calls.loads, 1); assert.equal(s.calls.water, 0); assert.deepEqual(s.calls.keys, [])
  }
})

test('an explicit empty code set remains distinct from an undefined unscoped read', async () => {
  const s = helperSession()
  assert.equal((await s.run(reader => reader(new Set()))).length, 2)
  assert.equal(s.calls.loads, 0); assert.equal(s.calls.water, 1)
})

test('a loaded PRINT or DYE owner preserves current unsaved source facts without a stored key', async () => {
  for (const owner of ['print', 'dye']) {
    const s = helperSession(); s.loaded.add(owner); s.setRecords([sourceRow(37)])
    assert.equal(s.storage.size, 0)
    const result = await s.run(reader => reader(new Set(['CUT_PANEL'])))
    assert.equal(result[0].plannedQty, 37); assert.equal(s.calls.loads, 1); assert.equal(s.calls.water, 0)
    assert.deepEqual(s.calls.keys, []); assert.equal(s.calls.writes, 0)
  }
})

test('non-null effective PRINT and DYE storage trigger the original reader even without native storage', async () => {
  for (const key of [printKey, dyeKey]) {
    const s = helperSession()
    // This dependency is the effective PCS/washing storage facade. A native-only
    // check would miss these rows; the helper must ask the supplied real facade.
    s.setRead(actualKey => actualKey === key ? '{effective-overlay}' : null)
    const result = await s.run(reader => reader(new Set(['CUT_PANEL'])))
    assert.equal(result[0].plannedQty, 7); assert.equal(s.calls.loads, 1); assert.equal(s.calls.water, 0)
    assert.ok(s.calls.keys.includes(key)); assert.equal(s.calls.writes, 0)
  }
})

test('real deterministic and one-shot probe errors propagate by identity without owner retries', async () => {
  for (const key of [printKey, dyeKey]) for (const once of [false, true]) {
    const s = helperSession(), error = new Error('saved source is unreadable'); let failed = false, callbacks = 0
    s.setRead(actualKey => { if (actualKey === key && (!once || !failed)) { failed = true; throw error } return null })
    await assert.rejects(s.run(reader => { callbacks++; return reader(new Set(['CUT_PANEL'])) }), actual => actual === error)
    assert.equal(callbacks, 1); assert.equal(s.calls.loads, 0); assert.equal(s.calls.water, 0); assert.equal(s.calls.writes, 0)
  }
})

test('ordinary callback and water projection errors are never mistaken for the private sentinel', async () => {
  for (const error of [new Error('pre-reader failure'), Symbol('complete process relation source required')]) {
    const s = helperSession()
    await assert.rejects(s.run(() => { throw error }), actual => actual === error)
    assert.equal(s.calls.loads, 0); assert.equal(s.calls.water, 0)
  }
  const s = helperSession(), error = new Error('water owner unreadable')
  s.setWater(() => { throw error })
  await assert.rejects(s.run(reader => reader(new Set(['CUT_PANEL']))), actual => actual === error)
  assert.equal(s.calls.loads, 0)
})

test('a rejected complete-owner import remains observable and a later explicit call can retry', async () => {
  const s = helperSession(), error = new Error('owner import rejected'); let fail = true
  s.setLoader(async () => { if (fail) throw error; return { listProcessWorkOrderRelationSources: s.fullReader } })
  await assert.rejects(s.run(reader => reader(undefined)), actual => actual === error)
  assert.equal(s.calls.loads, 1); assert.equal(s.calls.water, 0)
  fail = false
  assert.equal((await s.run(reader => reader(undefined)))[0].plannedQty, 7)
  assert.equal(s.calls.loads, 2); assert.equal(s.calls.writes, 0)
})

test('the post-import callback re-reads current task, guards and PO instead of using a captured old view', async () => {
  const s = helperSession(); s.loaded.add('print')
  let release!: () => void, entered!: () => void
  const reached = new Promise<void>(resolve => { entered = resolve })
  const wait = new Promise<void>(resolve => { release = resolve })
  s.setLoader(async () => { entered(); await wait; return { listProcessWorkOrderRelationSources: s.fullReader } })
  const current = { id: 'TASK-A', po: 'PO-A', allowed: true }, observations: string[] = []
  const pending = s.run(reader => {
    observations.push(current.id + '/' + current.po)
    if (!current.allowed) return 'blocked:' + current.id
    const rows = reader(new Set(['CUT_PANEL']))
    return current.id + '/' + current.po + '/' + rows[0].plannedQty
  })
  await reached; current.id = 'TASK-B'; current.po = 'PO-B'; s.setRecords([sourceRow(43)])
  release(); assert.equal(await pending, 'TASK-B/PO-B/43')
  assert.deepEqual(observations, ['TASK-A/PO-A', 'TASK-B/PO-B']); assert.equal(s.calls.loads, 1)
})

test('a guard changed during owner loading is applied before reading the complete source', async () => {
  const s = helperSession(); s.loaded.add('dye'); let release!: () => void, entered!: () => void, reads = 0, blocked = false
  const reached = new Promise<void>(resolve => { entered = resolve }), wait = new Promise<void>(resolve => { release = resolve })
  s.setLoader(async () => { entered(); await wait; return { listProcessWorkOrderRelationSources: () => { reads++; return [] } } })
  const pending = s.run(reader => blocked ? 'factory-blocked' : reader(new Set(['CUT_PANEL'])))
  await reached; blocked = true; release()
  assert.equal(await pending, 'factory-blocked'); assert.equal(reads, 0); assert.equal(s.calls.loads, 1)
})

test('canonical reader failure is not retried or converted to an empty relation', async () => {
  const s = helperSession(), error = new Error('canonical saved source failed'); let reads = 0, callbacks = 0
  s.setLoader(async () => ({ listProcessWorkOrderRelationSources: () => { reads++; throw error } }))
  await assert.rejects(s.run(reader => { callbacks++; return reader(new Set(['PRINT'])) }), actual => actual === error)
  assert.equal(s.calls.loads, 1); assert.equal(reads, 1); assert.equal(callbacks, 2); assert.equal(s.calls.water, 0)
})

function assertPreloadListenerRemoved(s: ReturnType<typeof helperSession>): void {
  const calls = s.listenerCalls.filter(call => call.type === 'vite:preloadError')
  assert.equal(s.activePreloadListeners(), 0, 'the temporary listener cannot survive the import')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].action, 'add'); assert.equal(calls[1].action, 'remove')
  assert.equal(calls[0].listener, calls[1].listener, 'remove the exact registered function')
  assert.equal(s.calls.writes, 0)
}

test('Vite suppressed full-owner: undefined namespace preserves the original payload identity', async () => {
  for (const payload of [new Error('Failed to fetch dynamically imported module: /assets/owner.js'), { reason: 'original owner failure' }, 'original rejection text']) {
    const s = helperSession(); let callbacks = 0
    s.setLoader(async () => {
      assert.equal(s.activePreloadListeners(), 1)
      const event = s.dispatchPreloadError(payload)
      assert.equal(event.defaultPrevented, true)
      return undefined // Actual Vite suppression can fulfill this import undefined.
    })
    await assert.rejects(s.run(reader => { callbacks++; return reader(undefined) }), actual => actual === payload)
    assert.equal(callbacks, 1, 'no complete callback may receive an absent reader')
    assert.equal(s.calls.loads, 1); assert.equal(s.calls.water, 0)
    assertPreloadListenerRemoved(s)
  }
})

test('Vite suppressed full-owner: success re-reads current task and PO then removes its listener', async () => {
  const s = helperSession(); let release!: () => void, entered!: () => void
  const reached = new Promise<void>(resolve => { entered = resolve }), wait = new Promise<void>(resolve => { release = resolve })
  s.setLoader(async () => { assert.equal(s.activePreloadListeners(), 1); entered(); await wait; return { listProcessWorkOrderRelationSources: s.fullReader } })
  const current = { task: 'TASK-OLD', po: 'PO-OLD' }, seen: string[] = []
  const pending = s.run(reader => {
    seen.push(current.task + '/' + current.po)
    const rows = reader(undefined)
    assert.equal(s.activePreloadListeners(), 1, 'this synchronous callback is covered by the same cleanup finally')
    return { task: current.task, po: current.po, qty: rows[0].plannedQty }
  })
  await reached; assert.equal(s.activePreloadListeners(), 1)
  current.task = 'TASK-CURRENT'; current.po = 'PO-CURRENT'; s.setRecords([sourceRow(53)])
  release()
  assert.deepEqual(await pending, { task: 'TASK-CURRENT', po: 'PO-CURRENT', qty: 53 })
  assert.deepEqual(seen, ['TASK-OLD/PO-OLD', 'TASK-CURRENT/PO-CURRENT'])
  assert.equal(s.calls.loads, 1); assertPreloadListenerRemoved(s)
})

test('Vite suppressed full-owner: native import rejection keeps its own identity and removes the listener', async () => {
  const s = helperSession(), rejection = new Error('native import rejection'), observed = new Error('separate preload payload')
  let callbacks = 0
  s.setLoader(async () => {
    assert.equal(s.activePreloadListeners(), 1); s.dispatchPreloadError(observed); throw rejection
  })
  await assert.rejects(s.run(reader => { callbacks++; return reader(undefined) }), actual => actual === rejection)
  assert.equal(callbacks, 1); assert.equal(s.calls.loads, 1); assertPreloadListenerRemoved(s)
})

test('Vite suppressed full-owner: absent event and invalid export gives a readable error and cleans up', async () => {
  for (const namespace of [undefined, {}, { listProcessWorkOrderRelationSources: null }]) {
    const s = helperSession(); let callbacks = 0
    s.setLoader(async () => { assert.equal(s.activePreloadListeners(), 1); return namespace })
    await assert.rejects(s.run(reader => { callbacks++; return reader(undefined) }), error => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /加载/); assert.match(error.message, /[\u4e00-\u9fff]/)
      assert.doesNotMatch(error.message, /Cannot destructure|undefined|not a function/)
      return true
    })
    assert.equal(callbacks, 1); assert.equal(s.calls.loads, 1); assertPreloadListenerRemoved(s)
  }
})

test('Vite suppressed full-owner: missing payload uses original detail or the original event identity', async () => {
  const detail = new Error('original detail error'), payload = new Error('original payload error')
  for (const input of [{ payload, detail, expected: payload }, { payload: undefined, detail, expected: detail },
    { payload: null, detail: undefined, expected: undefined }, { payload: undefined, detail: undefined, expected: undefined }]) {
    const s = helperSession(); let dispatched!: Event
    s.setLoader(async () => { dispatched = s.dispatchPreloadError(input.payload, input.detail); return undefined })
    await assert.rejects(s.run(reader => reader(undefined)), error => error === (input.expected ?? dispatched))
    assert.equal(s.calls.loads, 1); assertPreloadListenerRemoved(s)
  }
})

test('Vite suppressed full-owner: valid export preserves a real callback error despite a preload payload', async () => {
  const s = helperSession(), callbackError = new Error('canonical saved relation unreadable'), observed = new Error('other preload error')
  let callbacks = 0
  s.setLoader(async () => { assert.equal(s.activePreloadListeners(), 1); s.dispatchPreloadError(observed); return { listProcessWorkOrderRelationSources: s.fullReader } })
  await assert.rejects(s.run(reader => {
    callbacks++; reader(undefined)
    assert.equal(s.activePreloadListeners(), 1); throw callbackError
  }), actual => actual === callbackError)
  assert.equal(callbacks, 2); assert.equal(s.calls.loads, 1); assertPreloadListenerRemoved(s)
  const early = helperSession(), earlyError = new Error('guard failed before source')
  await assert.rejects(early.run(() => { throw earlyError }), actual => actual === earlyError)
  assert.equal(early.listenerCalls.length, 0); assert.equal(early.calls.loads, 0)
})

test('Vite suppressed full-owner: a later explicit entry gets a new listener after suppressed failure', async () => {
  const s = helperSession(), original = new Error('first owner GET failed'); let fail = true
  s.setLoader(async () => {
    assert.equal(s.activePreloadListeners(), 1)
    if (fail) { s.dispatchPreloadError(original); return undefined }
    return { listProcessWorkOrderRelationSources: s.fullReader }
  })
  await assert.rejects(s.run(reader => reader(undefined)), error => error === original)
  assertPreloadListenerRemoved(s); fail = false
  assert.equal((await s.run(reader => reader(undefined)))[0].plannedQty, 7)
  assert.equal(s.activePreloadListeners(), 0); assert.equal(s.calls.loads, 2)
  const adds = s.listenerCalls.filter(call => call.action === 'add'), removes = s.listenerCalls.filter(call => call.action === 'remove')
  assert.equal(adds.length, 2); assert.equal(removes.length, 2)
  assert.notEqual(adds[0].listener, adds[1].listener, 'no shared failed listener or cached import state')
  assert.equal(adds[0].listener, removes[0].listener); assert.equal(adds[1].listener, removes[1].listener)
  assert.equal(s.calls.writes, 0)
})

test('Vite suppressed full-owner: concurrent pending entries remove only their own listeners', async () => {
  const s = helperSession(), callbackError = new Error('first callback failed'), payload = new Error('second original owner failure')
  const release: Array<() => void> = [], wait = [0, 1].map(index => new Promise<void>(resolve => { release[index] = resolve }))
  let imports = 0, firstCallbacks = 0, secondCallbacks = 0
  s.setLoader(async () => {
    const index = imports++; await wait[index]
    return index === 0 ? { listProcessWorkOrderRelationSources: s.fullReader } : undefined
  })
  const first = s.run(reader => { firstCallbacks++; reader(undefined); throw callbackError })
  const second = s.run(reader => { secondCallbacks++; return reader(undefined) })
  assert.equal(s.activePreloadListeners(), 2)
  const firstRejected = assert.rejects(first, error => error === callbackError)
  release[0](); await firstRejected
  assert.equal(s.activePreloadListeners(), 1, 'first callback failure cannot remove the other pending entry listener')
  s.dispatchPreloadError(payload)
  const secondRejected = assert.rejects(second, error => error === payload)
  release[1](); await secondRejected
  assert.equal(firstCallbacks, 2); assert.equal(secondCallbacks, 1); assert.equal(s.calls.loads, 2)
  assert.equal(s.activePreloadListeners(), 0); assert.equal(s.calls.writes, 0)
  const adds = s.listenerCalls.filter(call => call.action === 'add'), removes = s.listenerCalls.filter(call => call.action === 'remove')
  assert.equal(adds.length, 2); assert.equal(removes.length, 2); assert.notEqual(adds[0].listener, adds[1].listener)
  assert.equal(adds[0].listener, removes[0].listener); assert.equal(adds[1].listener, removes[1].listener)
})

function actualCore() {
  return actualModule('src/data/fcs/process-order-task-link-core.ts', {
    removePredeterminedWashing: (entries: unknown) => entries,
    getProductionOrderProcessEntries: () => [], processTasks: [], productionOrders: [],
    readRuntimeTaskById: () => undefined, readRuntimeTasks: () => [],
    listGeneratedCutOrderSourceRecords: () => [], listSpecialCraftTaskOrders: () => [], listWoolWorkOrders: () => [],
    listLaceProductionOrders: () => [], PLATFORM_ADMIN: {}, buildBindingProcessOrders: () => [],
    PROCESS_WORK_ORDER_SOURCE_LABEL: { STOCK: '备货手动创建' },
    buildSpecialCraftTaskDetailPath: () => { throw Error('unexpected special fixture') },
  }, ['getProcessOrderTaskRelationView', 'withProcessOrderTaskRelationRead'])
}

test('actual core scopes separate readers and refresh all source facts after synchronous exit', () => {
  const core = actualCore(); let qtyA = 13, qtyB = 29, readsA = 0, readsB = 0
  const a: SourceReader = () => { readsA++; return [sourceRow(qtyA)] }
  const b: SourceReader = () => { readsB++; return [sourceRow(qtyB)] }
  core.withProcessOrderTaskRelationRead(() => {
    assert.equal(core.getProcessOrderTaskRelationView(a, 'SOURCE-A').current.quantityLabel, '13 米')
    core.withProcessOrderTaskRelationRead(() => {
      assert.equal(core.getProcessOrderTaskRelationView(b, 'SOURCE-A').current.quantityLabel, '29 米')
      qtyA = 17; qtyB = 31
    })
    assert.equal(core.getProcessOrderTaskRelationView(a, 'SOURCE-A').current.quantityLabel, '13 米')
    assert.equal(core.getProcessOrderTaskRelationView(b, 'SOURCE-A').current.quantityLabel, '29 米')
    assert.equal(readsA, 1); assert.equal(readsB, 1)
  })
  core.withProcessOrderTaskRelationRead(() => {
    assert.equal(core.getProcessOrderTaskRelationView(a, 'SOURCE-A').current.quantityLabel, '17 米')
    assert.equal(core.getProcessOrderTaskRelationView(b, 'SOURCE-A').current.quantityLabel, '31 米')
  })
  assert.equal(readsA, 2); assert.equal(readsB, 2)
})

test('actual core clears reader caches and depth after both an external throw and reader rejection', () => {
  const core = actualCore(), error = new Error('scope failed'); let qty = 3, fail = false, reads = 0
  const reader: SourceReader = () => { reads++; if (fail) throw error; return [sourceRow(qty)] }
  assert.throws(() => core.withProcessOrderTaskRelationRead(() => {
    assert.equal(core.getProcessOrderTaskRelationView(reader, 'SOURCE-A').current.quantityLabel, '3 米'); throw error
  }), actual => actual === error)
  fail = true
  assert.throws(() => core.withProcessOrderTaskRelationRead(() => core.getProcessOrderTaskRelationView(reader, 'SOURCE-A')), actual => actual === error)
  fail = false; qty = 5
  core.withProcessOrderTaskRelationRead(() => assert.equal(core.getProcessOrderTaskRelationView(reader, 'SOURCE-A').current.quantityLabel, '5 米'))
  assert.equal(reads, 3)
})

function viewFixture(rich: boolean): any {
  const document = { documentId: 'ID<1>', documentNo: 'NO&1', documentKind: 'PRODUCTION_TASK', documentTypeLabel: '加工单',
    productionOrderNo: 'PO"1', processName: '工艺<名>', objectLabel: '面料&对象', quantityLabel: '3 PIECE', sourceLabel: '正式来源', sourceEntryIds: [], bomItemIds: [] }
  return { current: document, demandSource: '来源<"&>', taskDetails: rich ? ['SKU "A" <4>', '2 米 & 3 片'] : [],
    predecessors: rich ? [{ ...document, documentId: 'PREP-A', documentKind: 'PREPARATION_ORDER' },
      { ...document, documentId: 'PRE-B', href: '/fcs/test?x="&y=1' }] : [],
    successors: rich ? [{ ...document, documentId: 'NEXT/A' }] : [],
    pendingPredecessors: rich ? [{ occurrenceEntryId: 'WAIT<1>', processName: '染色', inputObjectType: '原料', outputObjectType: '加工料' }] : [],
    pendingSuccessors: rich ? [{ occurrenceEntryId: 'WAIT-2', processName: '后道', routeObjectKey: 'BRANCH&1' }] : [] }
}

test('pure relation HTML preserves d9a3 approved bytes for empty, endpoint and linked/pending views', () => {
  const view = actualModule('src/pages/process-order-task-relations-view.ts', {}, ['renderProcessOrderTaskRelationView'])
  // Captured from the actual d9a3 archived synchronous renderer, never regenerated
  // from this implementation. Input fixtures exercise all renderer branches.
  const approved = ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'f2f91cfb52f36aa3c1a5b36aaf2446f15cb0160d9671bf2d170f752769f038bc', '9502d8bbab5c7684c6578d31d8ab368047726ff4b4bff3d60fa72d61d9ee2fab']
  for (const [index, fixture] of [undefined, viewFixture(false), viewFixture(true)].entries()) {
    const html = view.renderProcessOrderTaskRelationView(fixture)
    assert.equal(createHash('sha256').update(html).digest('hex'), approved[index])
  }
})

const nativeIntegrationPrelude = `
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:undefined});
assert.equal(typeof window,'undefined');
const from=path=>import(pathToFileURL(resolve(process.cwd(),path)).href);
const storage=await from('src/data/fcs/design-revision-pcs-storage.ts');
const helper=await from('src/data/fcs/process-order-task-detail-read.ts');
assert.equal(storage.hasDesignRevisionFcsCacheOwner('print'),false);
assert.equal(storage.hasDesignRevisionFcsCacheOwner('dye'),false);
const json=value=>JSON.parse(JSON.stringify(value));
const emit=value=>console.log('INTEGRATION_EVIDENCE '+JSON.stringify(value));
`

function nativeIntegration(body: string): void {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', nativeIntegrationPrelude + body], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  })
  if (child.stdout) console.log(child.stdout.trim())
  assert.equal(child.status, 0, child.stderr || String(child.error || 'native integration failed'))
  assert.ok(child.stdout.includes('INTEGRATION_EVIDENCE '), 'actual child completed and emitted scoped facts')
}

test('actual-module integration: loaded owner hooks retain initialized unsaved PRINT and DYE facts', () => {
  nativeIntegration(`
const print=await from('src/data/fcs/printing-task-domain.ts');
const dye=await from('src/data/fcs/dyeing-task-domain.ts');
assert.equal(storage.hasDesignRevisionFcsCacheOwner('print'),true);
assert.equal(storage.hasDesignRevisionFcsCacheOwner('dye'),true);
const initializedPrint=print.listPrintWorkOrderSourceReferences();
const initializedDye=dye.listDyeWorkOrderSourceReferences();
assert.ok(initializedPrint.length>0);assert.ok(initializedDye.length>0);
const printRead=print.readPrintWorkOrdersWithoutInitialization(),dyeRead=dye.readDyeWorkOrdersWithoutInitialization();
assert.equal(printRead.needsRestoration,false);assert.equal(dyeRead.needsRestoration,false);
assert.deepEqual(printRead.orders.map(x=>x.printOrderId).sort(),initializedPrint.map(x=>x.printOrderId).sort());
assert.deepEqual(dyeRead.orders.map(x=>x.dyeOrderId).sort(),initializedDye.map(x=>x.dyeOrderId).sort());
const full=await from('src/data/fcs/process-work-order-domain.ts'),codes=new Set(['CUT_PANEL']);
const expected=full.listProcessWorkOrderRelationSources(codes);let callbacks=0;
const actual=JSON.parse(await helper.readPreparedProcessOrderTaskDetail(reader=>{callbacks++;return JSON.stringify(reader(codes))}));
assert.equal(callbacks,2);assert.deepEqual(actual,json(expected));
assert.deepEqual(actual.filter(x=>x.processType==='PRINT').map(x=>[x.workOrderId,x.plannedQty,x.plannedUnit]).sort(),
 printRead.orders.map(x=>[x.printOrderId,x.plannedQty,x.qtyUnit]).sort());
assert.deepEqual(actual.filter(x=>x.processType==='DYE').map(x=>[x.workOrderId,x.plannedQty,x.plannedUnit]).sort(),
 dyeRead.orders.map(x=>[x.dyeOrderId,x.plannedQty,x.qtyUnit]).sort());
const registry=await from('src/data/fcs/process-work-order-generation-registry.ts');
const generationRegistration={};for(const code of ['PRINT','DYE']){try{registry.getProcessWorkOrderGenerationRegistrar(code);generationRegistration[code]=true}catch{generationRegistration[code]=false}}
assert.equal(typeof localStorage,'undefined');
emit({case:'actual-loaded-owners',print:printRead.orders.length,dye:dyeRead.orders.length,callbacks,generationRegistration,
 nativeStorage:false,savedBusinessRecords:false,ownerHookSource:'actual top-level module registrations',sourceParity:true});
`)
})

test('actual-module integration: empty-route fallback repeats real derived reads without duplicate facts', () => {
  nativeIntegration(`
const core=await from('src/data/fcs/process-order-task-link-core.ts');
const orders=await from('src/data/fcs/production-orders.ts');
const tech=await from('src/data/fcs/production-order-tech-pack-runtime.ts');
const tasks=await from('src/data/fcs/process-tasks.ts');
const special=await from('src/data/fcs/special-craft-task-orders.ts');
const warehouse=await from('src/data/fcs/factory-internal-warehouse.ts');
const cut=await from('src/data/fcs/cutting/generated-cut-orders.ts');
const cacheMap=()=>new Map(storage.captureDesignRevisionFcsCaches());
const before=cacheMap(),beforeTaskIds=tasks.processTasks.map(x=>x.taskId).sort();
const order=orders.productionOrders.find(x=>tech.getProductionOrderProcessEntries(x.productionOrderId).length===0);
// Current fixtures have no existing zero-route order. The real reader's missing
// hint boundary is used explicitly; no order/task/command fixture is inserted.
const hint=order?.productionOrderId??'__READ_ONLY_MISSING_ORDER_ROUTE__',checkpoints=[];
assert.equal(tech.getProductionOrderProcessEntries(hint).length,0);
const snapshot=()=>{
 const cached=cacheMap(),wool=cached.get('wool'),receiving=cached.get('receiving');
 return {tasks:json(tasks.processTasks),cut:cut.listGeneratedCutOrderSourceRecords(),special:json(special.listSpecialCraftTaskOrders()),
  wool:json(wool??null),receiving:json(receiving??null),warehouse:warehouse.createFactoryInternalWarehouseMutationSnapshot()};
};
let callbacks=0;
await helper.readPreparedProcessOrderTaskDetail(reader=>{
 callbacks++;const view=core.getProcessOrderTaskRelationView(codes=>{
  assert.equal(codes,undefined,'actual core supplies undefined for this actual empty-route lookup');
  checkpoints.push(snapshot());return reader(codes);
 },'__READ_ONLY_MISSING_DOCUMENT__',hint);return JSON.stringify(view??null);
});
assert.equal(callbacks,2);assert.equal(checkpoints.length,2);
assert.deepEqual(checkpoints[0],checkpoints[1],'pre-source projections are identical across sentinel import fallback');
const after=cacheMap(),first=snapshot();
await helper.readPreparedProcessOrderTaskDetail(reader=>JSON.stringify(core.getProcessOrderTaskRelationView(reader,'__READ_ONLY_MISSING_DOCUMENT__',hint)??null));
const second=snapshot();assert.deepEqual(second,first,'another complete read cannot add tasks/orders/receipt projection or change revisions');
const woolBefore=before.get('wool'),woolAfter=after.get('wool');
assert.ok(woolAfter?.memoryStore&&Object.keys(woolAfter.memoryStore.workOrders).length>0);
assert.ok(first.cut.length>0&&first.special.length>0&&first.warehouse.inboundRecords.length>0,'real cut/special/warehouse projections must be present');
for(const [name,rows,key] of [['tasks',first.tasks,'taskId'],['special',first.special,'taskOrderId'],
 ['inbound',first.warehouse.inboundRecords,'inboundRecordId'],['outbound',first.warehouse.outboundRecords,'outboundRecordId']]){
 const ids=rows.map(x=>x[key]);assert.ok(ids.every(Boolean),name+' has actual record identities');
 assert.equal(new Set(ids).size,ids.length,name+' actual record IDs remain unique (task references are not receipt identities)');
}
const newTaskIds=first.tasks.map(x=>x.taskId).filter(x=>!beforeTaskIds.includes(x));
const beforeWoolIds=Object.keys(woolBefore?.memoryStore?.workOrders??{}),afterWoolIds=Object.keys(woolAfter.memoryStore.workOrders);
assert.ok(!woolBefore?.memoryStore||newTaskIds.length>0||afterWoolIds.some(x=>!beforeWoolIds.includes(x)),'the fixture must exercise real initialization/derivation, not just compare empty snapshots');
emit({case:'actual-empty-route-derived-idempotence',productionOrderId:hint,existingZeroRouteOrder:!!order,missingOrderHintBoundary:!order,callbacks,cut:first.cut.length,special:first.special.length,
 sourceTasks:first.tasks.length,sourceTaskIdsAdded:newTaskIds.length,woolBefore:beforeWoolIds.length,woolAfter:afterWoolIds.length,
 woolRevisionBefore:woolBefore?.woolRevision??null,woolRevisionAfter:woolAfter.woolRevision,
 receivingRevision:first.receiving?.receivingRevision??null,receiptProjection:first.receiving?.cache?.receipts?.length??0,
 warehouseInbound:first.warehouse.inboundRecords.length,preSourceSnapshotsEqual:true,repeatedFinalSnapshotEqual:true,
 runtimeGeneratedWoolOrdersAdded:afterWoolIds.filter(x=>!beforeWoolIds.includes(x)&&x.startsWith('WOOL-STAGE:')).length,
 limitation:'Current fixtures contain no existing zero-route order, so this run explicitly uses the missing-order hint boundary and real baseline/source/warehouse/receipt projection initialization. New runtime wool-order creation is claimed only when the separately reported added count is positive; no order/task or command fixture was inserted.'});
`)
})

test('actual-module integration: a legitimate final task has identical fresh narrow and complete relation HTML', () => {
  nativeIntegration(`
const core=await from('src/data/fcs/process-order-task-link-core.ts'),ui=await from('src/pages/process-order-task-relations-view.ts');
const special=await from('src/data/fcs/special-craft-task-orders.ts'),tech=await from('src/data/fcs/production-order-tech-pack-runtime.ts');
const task=special.listSpecialCraftTaskOrders().find(x=>!x.woolPieceKey&&x.operationId==='AUX-OP-DALAN'&&
 tech.getProductionOrderProcessEntries(x.productionOrderId).length>0&&
 !tech.getProductionOrderProcessEntries(x.productionOrderId).some(e=>e.processCode==='PRINT'||e.processCode==='DYE'));
assert.ok(task,'a genuine final task with a nonempty unrelated route is required');
assert.equal(storage.hasDesignRevisionFcsCacheOwner('print'),false);assert.equal(storage.hasDesignRevisionFcsCacheOwner('dye'),false);
let callbacks=0,narrowView;
const narrowHtml=await helper.readPreparedProcessOrderTaskDetail(reader=>{callbacks++;
 narrowView=core.getProcessOrderTaskRelationView(reader,task.taskOrderId,task.productionOrderId);assert.ok(narrowView);
 return ui.renderProcessOrderTaskRelationView(narrowView);
});
assert.equal(callbacks,1);assert.equal(storage.hasDesignRevisionFcsCacheOwner('print'),false);assert.equal(storage.hasDesignRevisionFcsCacheOwner('dye'),false);
const full=await from('src/data/fcs/process-work-order-domain.ts');
const completeView=core.getProcessOrderTaskRelationView(full.listProcessWorkOrderRelationSources,task.taskOrderId,task.productionOrderId);
assert.deepEqual(json(completeView),json(narrowView));assert.equal(ui.renderProcessOrderTaskRelationView(completeView),narrowHtml);
assert.equal(storage.hasDesignRevisionFcsCacheOwner('print'),true);assert.equal(storage.hasDesignRevisionFcsCacheOwner('dye'),true);
emit({case:'actual-final-task-narrow-full-parity',taskOrderId:task.taskOrderId,productionOrderId:task.productionOrderId,
 narrowCallbacks:callbacks,freshNarrowDidNotLoadOwners:true,completeViewEqual:true,htmlBytesEqual:true,htmlLength:narrowHtml.length,
 nativeStorage:false,savedBusinessRecords:false});
`)
})
