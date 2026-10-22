import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** FULL019: isolated original IndexedDB + actual start commands. No product hook, external DB or physical handover claim. */
const base = process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'
const route = '/__sewing-execution-storage-contract'
let browser: Browser
const results: Array<Record<string, unknown>> = []
const reportPath = resolve(process.env.QUALITY_SEWING_EXECUTION_REPORT_PATH || 'output/qc-implementation-20261022/sewing-execution-native-results.json')
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function connect(page: Page) {
  await page.route('**' + route, request => request.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh"><body></body></html>' }))
  await page.goto(base + route)
  await bootstrap(page)
}
async function bootstrap(page: Page) {
  await page.evaluate(async () => {
    const production = await import('/src/data/fcs/production-context-records.ts')
    const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
    const orders = await import('/src/data/fcs/production-orders.ts')
    const history = await import('/src/data/fcs/sewing-execution-history.ts')
    const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
    await production.hydrateProductionContextRecords()
    const capture = () => ({ runtime: runtime.captureRuntimeDirectDispatchState(), orders: orders.captureProductionOrderPersistenceState() })
    const restore = (value: ReturnType<typeof capture>) => {
      runtime.restoreRuntimeDirectDispatchState(value.runtime, false); orders.restoreProductionOrderPersistenceState(value.orders)
    }
    const start = (taskId: string, entry: 'MANUAL' | 'CUT_PIECE', commandId: string, intent = commandId) => production.saveProductionContextAction({
      id: commandId, intent, capture, restore: value => restore(value as ReturnType<typeof capture>), action: () => {
        ;(window as any).__sewingStartCalls = ((window as any).__sewingStartCalls || 0) + 1
        return entry === 'MANUAL'
          ? runtime.recordRuntimeTaskExecution(taskId, { status: 'IN_PROGRESS', startedAt: '2026-10-22T01:00:00.000Z', updatedAt: '2026-10-22T01:00:00.000Z', auditLogs: [{ id: `AUDIT:${commandId}`, by: '隔离原生实际开工人', at: '2026-10-22T01:00:00.000Z', action: 'START', detail: '原手动开工命令，非现场发生证明' }] as any })
          : runtime.autoStartRuntimeSewingTaskFromCutPieceHandover({ taskId, handoverRecordNo: `RECEIVED:${commandId}`, receivedAt: '2026-10-22T01:01:00.000Z', receivedBy: '隔离原生裁片接收人' })
      },
    })
    ;(window as any).__sewingNative = { production, runtime, orders, history, repository, start }
  })
}
async function fixture(page: Page) {
  return page.evaluate(async () => {
    const { production: p, runtime: r, orders: o, repository: db, history: h } = (window as any).__sewingNative
    const template = r.listRuntimeProcessTasks().find((task: any) => task.processBusinessCode === 'SEW' && !task.isSplitSource)
    const originalOrder = o.productionOrders.find((order: any) => order.productionOrderId === template.productionOrderId)
    if (!template || !originalOrder?.techPackSnapshot) throw Error('必须保留原车缝任务和生产单正式绑定技术资料')
    const taskIds = ['NATIVE-SEW-MANUAL', 'NATIVE-SEW-SKU-ALIAS', 'NATIVE-SEW-AUTO']
    const orderIds = ['NATIVE-SEW-ORDER-ONE', 'NATIVE-SEW-ORDER-TWO']
    const sourceOrders = orderIds.map(id => {
      const order = structuredClone(originalOrder)
      order.productionOrderId = id; order.productionOrderNo = id; order.status = 'WAIT_ASSIGNMENT'; order.auditLogs = []
      order.techPackSnapshot.productionOrderId = id; order.techPackSnapshot.productionOrderNo = id
      order.selectedTechPackVersionId = order.techPackSnapshot.sourceTechPackVersionId
      return order
    })
    o.validatePersistedProductionOrders(sourceOrders)
    const tasks = taskIds.map((id, index) => ({ ...structuredClone(template), taskId: id, baseTaskId: id, scopeKey: id,
      productionOrderId: orderIds[index === 2 ? 1 : 0], executionEnabled: true, isSplitSource: false, isSplitResult: false, mergedIntoTaskId: undefined,
      assignedFactoryId: 'ID-F021', assignedFactoryName: '原三方车缝工厂隔离任务', assignmentStatus: 'ASSIGNED', acceptanceStatus: 'ACCEPTED',
      status: 'NOT_STARTED', startedAt: undefined, finishedAt: undefined, dependsOnTaskIds: [], baseDependsOnTaskIds: [], auditLogs: [],
    }))
    const runtimeRows = p.decodeProductionContextRecords(p.PRODUCTION_CONTEXT_KEYS.runtime, JSON.stringify({ version: 1,
      taskOverrides: [], splitPlans: [], mergedPlans: [], reassignedTasks: tasks.map((task: any) => [task.taskId, task]), auditSeq: 0 }))
    const orderRows = p.decodeProductionContextRecords(p.PRODUCTION_CONTEXT_KEYS.orders, JSON.stringify({ version: 1, orders: sourceOrders }))
    const before = await db.readCuttingRecords()
    await db.commitCuttingRecords({ revision: before.revision, change: { puts: [...runtimeRows, ...orderRows] }, command: {
      id: 'ISOLATED-SEWING-LEGAL-ASSIGNED-FIXTURE', intent: '明确隔离的合法已分配已接单、未开工任务；不是已执行事实', result: taskIds, at: '2026-10-22T00:00:00.000Z',
    } })
    await p.hydrateProductionContextRecords()
    const beforeFacts = h.listSewingExecutionFacts()
    if (beforeFacts.length) throw Error('夹具不得先注入真实执行事实')
    for (const id of taskIds) if (r.getRuntimeTaskById(id)?.status !== 'NOT_STARTED') throw Error('夹具未保持合法未开工任务')
    return { taskIds, orderIds, factoryId: 'ID-F021', styleCode: sourceOrders[0].techPackSnapshot.styleCode,
      fixtureBoundary: '原公开codec及原库txn预装合法任务/正式生产单；只有下述原开工命令才产生执行事实。', beforeFacts }
  })
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { repository, history, runtime, orders } = (window as any).__sewingNative
    const db = await repository.openCuttingRecordDatabase(), tx = db.transaction(['records', 'commands', 'meta', 'files'], 'readonly')
    const requests = ['records', 'commands', 'meta', 'files'].map(name => ({ name, request: tx.objectStore(name).getAll() }))
    return new Promise<any>((resolve, reject) => {
      const saved: Record<string, unknown> = {}
      for (const { name, request } of requests) request.onsuccess = () => { saved[name] = request.result }
      tx.oncomplete = () => resolve({ database: db.name, version: db.version, ...saved, facts: history.listSewingExecutionFacts(),
        tasks: ['NATIVE-SEW-MANUAL', 'NATIVE-SEW-SKU-ALIAS', 'NATIVE-SEW-AUTO'].map(id => runtime.getRuntimeTaskById(id)),
        orders: orders.productionOrders.filter((order: any) => order.productionOrderId.startsWith('NATIVE-SEW-ORDER-')), calls: (window as any).__sewingStartCalls || 0 })
      tx.onabort = () => reject(tx.error)
    })
  })
}
async function withCase(name: string, run: (page: Page) => Promise<unknown>) {
  const context = await browser.newContext(), page = await context.newPage(), errors: string[] = []
  await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  page.on('pageerror', error => errors.push(error.message))
  const result: Record<string, unknown> = { name, base, passed: false, kind: '原生隔离浏览器公开命令契约；非真实现场车缝或外部DB事实' }
  try { await connect(page); result.evidence = await run(page); assert.deepEqual(errors, []); result.passed = true }
  catch (error) {
    result.error = String(error)
    try { result.failureState = await snapshot(page) } catch (readError) { result.failureReadError = String(readError) }
    throw error
  }
  finally {
    results.push(result); mkdirSync(resolve('output/qc-implementation-20261022'), { recursive: true })
    writeFileSync(reportPath, JSON.stringify({ cases: results.length, passed: results.filter(result => result.passed).length, results }, null, 2))
    await context.close()
  }
}

test('FULL019原生：原手动/裁片接收开工与首次执行事实同事务，故障一起回滚，原重试及SKU别名不重计', { timeout: 120000 }, () => withCase('ATOMIC_START_AND_ALIAS', async page => {
  const declared = await fixture(page), before = await snapshot(page)
  assert.equal(before.database, 'higood-cutting-records-v1'); assert.equal(before.version, 1); assert.deepEqual(before.facts, [])
  const failure = await page.evaluate(async () => {
    const { start, runtime, history } = (window as any).__sewingNative
    const originalPut = IDBObjectStore.prototype.put, nativeSet = Storage.prototype.setItem
    const observations: unknown[] = []; let taskWrites = 0, lsWrites = 0, rejected = false, error = ''
    Storage.prototype.setItem = function (...args: Parameters<typeof nativeSet>) { lsWrites++; return nativeSet.apply(this, args) }
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof originalPut>) {
      const row = args[0]
      if (this.name === 'records' && row?.collection?.startsWith('production-context:')) taskWrites++
      if (this.name === 'records' && row?.collection === 'production-context:sewing-executions') {
        observations.push({ beforeComplete: true, task: runtime.getRuntimeTaskById('NATIVE-SEW-MANUAL')?.status, facts: history.listSewingExecutionFacts().length })
        throw new DOMException('隔离首次执行事实保存故障', 'QuotaExceededError')
      }
      return originalPut.apply(this, args)
    }
    try { await start('NATIVE-SEW-MANUAL', 'MANUAL', 'NATIVE-MANUAL-START') } catch (cause) { rejected = true; error = String(cause) }
    finally { IDBObjectStore.prototype.put = originalPut; Storage.prototype.setItem = nativeSet }
    return { rejected, error, taskWrites, lsWrites, observations }
  })
  assert.equal(failure.rejected, true); assert.ok(failure.taskWrites > 1); assert.equal(failure.lsWrites, 0)
  assert.deepEqual(failure.observations, [{ beforeComplete: true, task: 'NOT_STARTED', facts: 0 }])
  const failed = await snapshot(page)
  assert.deepEqual(failed.records, before.records); assert.deepEqual(failed.commands, before.commands); assert.deepEqual(failed.meta, before.meta)
  assert.deepEqual(failed.facts, []); assert.equal(failed.tasks[0].status, 'NOT_STARTED'); assert.equal(failed.orders[0].status, 'WAIT_ASSIGNMENT')
  const completeObservations = await page.evaluate(async () => {
    const { start, runtime, history } = (window as any).__sewingNative
    const native = IDBDatabase.prototype.transaction, observations: unknown[] = []
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof native>) {
      const tx = native.apply(this, args)
      if (this.name === 'higood-cutting-records-v1' && tx.mode === 'readwrite') tx.addEventListener('complete', () => observations.push({ taskAtCompleteEvent: runtime.getRuntimeTaskById('NATIVE-SEW-MANUAL')?.status, factsAtCompleteEvent: history.listSewingExecutionFacts().length }))
      return tx
    }
    try { await start('NATIVE-SEW-MANUAL', 'MANUAL', 'NATIVE-MANUAL-START') } finally { IDBDatabase.prototype.transaction = native }
    return observations
  })
  assert.ok(completeObservations.length); assert.ok(completeObservations.every((row: any) => row.taskAtCompleteEvent === 'NOT_STARTED' && row.factsAtCompleteEvent === 0))
  const manual = await snapshot(page)
  assert.equal(manual.tasks[0].status, 'IN_PROGRESS'); assert.equal(manual.orders[0].status, 'EXECUTING')
  assert.equal(manual.facts.length, 1); assert.equal(manual.facts[0].ordinal, 1); assert.equal(manual.facts[0].source, 'MANUAL_START')
  assert.equal(manual.records.filter((row: any) => row.collection === 'production-context:sewing-executions').length, 1)
  await page.evaluate(async () => { await (window as any).__sewingNative.start('NATIVE-SEW-MANUAL', 'MANUAL', 'NATIVE-MANUAL-START') })
  const replayed = await snapshot(page)
  assert.deepEqual(replayed.records, manual.records); assert.deepEqual(replayed.commands, manual.commands); assert.equal(replayed.calls, manual.calls)
  await page.evaluate(async () => {
    const { start } = (window as any).__sewingNative
    await start('NATIVE-SEW-SKU-ALIAS', 'CUT_PIECE', 'NATIVE-SKU-ALIAS-RECEIVE')
    await start('NATIVE-SEW-SKU-ALIAS', 'CUT_PIECE', 'NATIVE-SKU-ALIAS-SECOND-BATCH')
    await start('NATIVE-SEW-AUTO', 'CUT_PIECE', 'NATIVE-SECOND-TASK-RECEIVE')
  })
  const after = await snapshot(page)
  assert.equal(after.facts.length, 2); assert.deepEqual(after.facts.map((fact: any) => fact.ordinal).sort(), [1, 2])
  const canonical = after.facts.find((fact: any) => fact.ordinal === 1)
  assert.equal(canonical.taskId, declared.taskIds[0]); assert.deepEqual(canonical.taskAliases, declared.taskIds.slice(0, 2)); assert.equal(canonical.source, 'MANUAL_START')
  assert.equal(after.facts.find((fact: any) => fact.ordinal === 2).source, 'CUT_PIECE_RECEIVE_START')
  assert.ok(after.tasks.every((task: any) => task.status === 'IN_PROGRESS'))
  await page.reload(); await bootstrap(page)
  const refreshed = await snapshot(page)
  assert.deepEqual(refreshed.facts, after.facts); assert.ok(refreshed.tasks.every((task: any) => task.status === 'IN_PROGRESS'))
  return { declared, failure, completeObservations, before, failed, manual, replayed, after, refreshed }
}))

test('FULL019原生：同厂双标签两个新真实任务竞争同revision，一笔CAS拒绝后重读重试保留唯一连续序次', { timeout: 120000 }, () => withCase('TWO_TABS_FACTORY_ORDINAL', async first => {
  const declared = await fixture(first), second = await first.context().newPage()
  await connect(second)
  const arm = (page: Page, intent: string) => page.evaluate(intent => {
    const native = crypto.subtle.digest.bind(crypto.subtle)
    let release: (() => void) | undefined
    const barrier = new Promise<void>(resolve => { release = resolve })
    ;(window as any).__sewingDigestBarrier = { blocked: false, release, restore: () => { crypto.subtle.digest = native } }
    crypto.subtle.digest = async function (algorithm: AlgorithmIdentifier, data: BufferSource) {
      const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data)
      if (new TextDecoder().decode(bytes) === intent) { (window as any).__sewingDigestBarrier.blocked = true; await barrier }
      return native(algorithm, data)
    }
  }, intent)
  await arm(first, 'CONCURRENT-NATIVE-FIRST'); await arm(second, 'CONCURRENT-NATIVE-SECOND')
  const command = (page: Page, taskId: string, entry: 'MANUAL' | 'CUT_PIECE', commandId: string) => page.evaluate(async ({ taskId, entry, commandId }) => {
    try { const result = await (window as any).__sewingNative.start(taskId, entry, commandId); return { ok: true, taskId: result.taskId, status: result.status } }
    catch (error) { return { ok: false, taskId, error: String(error) } }
  }, { taskId, entry, commandId })
  const pendingFirst = command(first, declared.taskIds[0], 'MANUAL', 'CONCURRENT-NATIVE-FIRST')
  const pendingSecond = command(second, declared.taskIds[2], 'CUT_PIECE', 'CONCURRENT-NATIVE-SECOND')
  await first.waitForFunction(() => (window as any).__sewingDigestBarrier.blocked)
  await second.waitForFunction(() => (window as any).__sewingDigestBarrier.blocked)
  // This is a native crypto scheduling barrier after each original hydrate,
  // not a product write hook or an invented ordinal allocator.
  await Promise.all([first.evaluate(() => (window as any).__sewingDigestBarrier.release()), second.evaluate(() => (window as any).__sewingDigestBarrier.release())])
  const outcomes = await Promise.all([pendingFirst, pendingSecond])
  await Promise.all([first.evaluate(() => (window as any).__sewingDigestBarrier.restore()), second.evaluate(() => (window as any).__sewingDigestBarrier.restore())])
  assert.equal(outcomes.filter(outcome => outcome.ok).length, 1)
  const loser = outcomes.findIndex(outcome => !outcome.ok), page = loser === 0 ? first : second
  assert.match(outcomes[loser].error!, /其他页面|重新核对|刷新/)
  await first.evaluate(async () => { await (window as any).__sewingNative.production.hydrateProductionContextRecords() })
  const oneCommitted = await snapshot(first)
  assert.equal(oneCommitted.facts.length, 1); assert.equal(oneCommitted.facts[0].ordinal, 1)
  assert.equal(oneCommitted.tasks.filter((task: any) => [declared.taskIds[0], declared.taskIds[2]].includes(task.taskId) && task.status === 'IN_PROGRESS').length, 1)
  await page.evaluate(async () => { await (window as any).__sewingNative.production.hydrateProductionContextRecords() })
  const retried = await command(page, declared.taskIds[loser === 0 ? 0 : 2], loser === 0 ? 'MANUAL' : 'CUT_PIECE', loser === 0 ? 'CONCURRENT-NATIVE-FIRST' : 'CONCURRENT-NATIVE-SECOND')
  assert.equal(retried.ok, true)
  await first.evaluate(async () => { await (window as any).__sewingNative.production.hydrateProductionContextRecords() })
  const final = await snapshot(first)
  assert.equal(final.facts.length, 2); assert.deepEqual(final.facts.map((fact: any) => fact.ordinal).sort(), [1, 2])
  assert.equal(new Set(final.facts.map((fact: any) => fact.id)).size, 2)
  assert.equal(new Set(final.facts.map((fact: any) => `${fact.factoryId}/${fact.productionOrderId}/${fact.styleCode}`)).size, 2)
  assert.equal(final.tasks.filter((task: any) => [declared.taskIds[0], declared.taskIds[2]].includes(task.taskId) && task.status === 'IN_PROGRESS').length, 2)
  await second.close()
  return { declared, schedulingBoundary: '仅在原hydrate之后的原crypto intent摘要处等待两标签就绪；真实原库revision/CAS决定唯一提交与序次。', outcomes, oneCommitted, retried, final }
}))

test('FULL019冷启动回归：先hydrate持久用户任务后首次列表，不吸收用户覆盖/静态删除标记/审计序次为默认', { timeout: 120000 }, () => withCase('COLD_HYDRATE_BEFORE_FIRST_LIST', async first => {
  const declared = await fixture(first)
  const persisted = await first.evaluate(async () => {
    const { production: p, runtime: r, repository: repository } = (window as any).__sewingNative
    const baseline = r.captureRuntimeDirectDispatchState()
    const candidates = baseline.taskOverrides.filter(([id]: [string, unknown]) => !id.startsWith('NATIVE-SEW-'))
    if (candidates.length < 2) throw Error('必须使用原静态任务覆盖及可删除基准，不能制造空基准')
    const [overrideId, originalOverride] = candidates[0], [deletedId] = candidates[1]
    const override = { ...structuredClone(originalOverride), dispatchRemark: '真实持久用户覆盖：冷初始化后不得改回演示文案' }
    const saved = JSON.parse(p.productionContextStorage.getItem(p.PRODUCTION_CONTEXT_KEYS.runtime))
    saved.taskOverrides = [...saved.taskOverrides.filter(([id]: [string, unknown]) => ![overrideId, deletedId].includes(id)),
      [overrideId, override], [deletedId, { __removedStaticRuntimeEntry: true }]]
    saved.auditSeq = 9000
    const rows = p.decodeProductionContextRecords(p.PRODUCTION_CONTEXT_KEYS.runtime, JSON.stringify(saved))
    const before = await repository.readCuttingRecords()
    await repository.commitCuttingRecords({ revision: before.revision, change: { puts: rows }, command: {
      id: 'ISOLATED-COLD-RUNTIME-USER-OVERLAY', intent: '原codec隔离预装用户覆盖、原静态删除标记及审计序次；非新增产品删除入口',
      result: { overrideId, deletedId }, at: '2026-10-22T00:00:00.000Z',
    } })
    return { overrideId, deletedId, override, auditSeq: 9000 }
  })
  const cold = await first.context().newPage(), errors: string[] = []
  cold.on('pageerror', error => errors.push(error.message))
  await cold.addInitScript(() => {
    ;(window as any).__coldRuntimeWrites = 0
    for (const method of ['put', 'add', 'delete'] as const) {
      const original = IDBObjectStore.prototype[method]
      ;(IDBObjectStore.prototype as any)[method] = function (...args: unknown[]) {
        ;(window as any).__coldRuntimeWrites++
        return (original as any).apply(this, args)
      }
    }
  })
  await connect(cold)
  const firstList = await cold.evaluate(({ overrideId, deletedId }) => {
    const { runtime: r, history: h } = (window as any).__sewingNative
    const before = r.captureRuntimeDirectDispatchState()
    if (before.dispatchBoardSeedReady) throw Error('夹具必须先冷hydrate，再首次list；不能先预热静态基准')
    const loadedTasks = r.listRuntimeProcessTasks()
    const after = r.captureRuntimeDirectDispatchState()
    return { before: { ready: before.dispatchBoardSeedReady, auditSeq: before.auditSeq, reassignedIds: before.reassignedTasks.map(([id]: [string, unknown]) => id) },
      after: { ready: after.dispatchBoardSeedReady, auditSeq: after.auditSeq, reassignedIds: after.reassignedTasks.map(([id]: [string, unknown]) => id),
        override: after.taskOverrides.find(([id]: [string, unknown]) => id === overrideId)?.[1], deletedStillPresent: after.taskOverrides.some(([id]: [string, unknown]) => id === deletedId) },
      taskIds: loadedTasks.map((task: any) => task.taskId), executionFacts: h.listSewingExecutionFacts(), writes: (window as any).__coldRuntimeWrites }
  }, persisted)
  assert.equal(firstList.before.ready, false); assert.equal(firstList.after.ready, true)
  assert.deepEqual(firstList.before.reassignedIds.sort(), declared.taskIds.slice().sort())
  assert.deepEqual(firstList.after.reassignedIds.sort(), declared.taskIds.slice().sort())
  assert.deepEqual(firstList.after.override, persisted.override); assert.equal(firstList.after.deletedStillPresent, false)
  assert.equal(firstList.before.auditSeq, persisted.auditSeq)
  assert.ok(firstList.after.auditSeq >= persisted.auditSeq, '原审计序次不得回落；原只读演示生成可在内存分配审计编号，不能当执行次数')
  assert.deepEqual(firstList.executionFacts, []); assert.equal(firstList.writes, 0, '普通冷hydrate及首次列表不得写回种子或用户覆盖')
  assert.ok(declared.taskIds.every(id => firstList.taskIds.includes(id)))
  await cold.evaluate(async () => { await (window as any).__sewingNative.start('NATIVE-SEW-MANUAL', 'MANUAL', 'COLD-FIRST-ACTUAL-START') })
  const afterStart = await snapshot(cold)
  assert.ok(afterStart.tasks.every((task: any) => task !== null), '差量保存后全部三条真实用户任务仍存在')
  assert.equal(afterStart.facts.length, 1); assert.equal(afterStart.facts[0].ordinal, 1, '静态seed和持久审计序次均不能冒充真实执行次数')
  const savedTasks = afterStart.records.filter((row: any) => row.collection === 'production-context:reassignedTasks')
  assert.deepEqual(savedTasks.map((row: any) => row.value.key).sort(), declared.taskIds.slice().sort())
  const savedOverride = afterStart.records.find((row: any) => row.id === `production-context:taskOverrides:${persisted.overrideId}`)
  const savedDeletion = afterStart.records.find((row: any) => row.id === `production-context:taskOverrides:${persisted.deletedId}`)
  assert.deepEqual(savedOverride.value.value, persisted.override)
  assert.deepEqual(savedDeletion.value.value, { __removedStaticRuntimeEntry: true })
  assert.ok(afterStart.records.find((row: any) => row.collection === 'production-context:runtime-meta').value.auditSeq >= persisted.auditSeq)
  await cold.reload(); await bootstrap(cold)
  const reopened = await cold.evaluate(({ overrideId, deletedId }) => {
    const { runtime: r, history: h } = (window as any).__sewingNative
    r.listRuntimeProcessTasks()
    const state = r.captureRuntimeDirectDispatchState()
    return { tasks: ['NATIVE-SEW-MANUAL', 'NATIVE-SEW-SKU-ALIAS', 'NATIVE-SEW-AUTO'].map(id => r.getRuntimeTaskById(id)),
      override: state.taskOverrides.find(([id]: [string, unknown]) => id === overrideId)?.[1],
      deletedStillPresent: state.taskOverrides.some(([id]: [string, unknown]) => id === deletedId), auditSeq: state.auditSeq, facts: h.listSewingExecutionFacts(),
      writes: (window as any).__coldRuntimeWrites }
  }, persisted)
  assert.ok(reopened.tasks.every((task: any) => task !== null)); assert.equal(reopened.tasks[0].status, 'IN_PROGRESS')
  assert.deepEqual(reopened.override, persisted.override); assert.equal(reopened.deletedStillPresent, false)
  assert.ok(reopened.auditSeq >= persisted.auditSeq); assert.deepEqual(reopened.facts, afterStart.facts)
  assert.equal(reopened.writes, 0, '刷新读取仍不得重写原业务或默认种子')
  assert.deepEqual(errors, [])
  await cold.close()
  return { declared, persisted, firstList, afterStart, reopened,
    fixtureBoundary: '原公开codec及同库txn预装合法历史覆盖/原静态删除标记；不新增产品删除入口，不预装真实执行事实。' }
}))
