import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createServer } from 'vite'

// This suite uses fresh contexts and an inert same-origin page. It never opens
// a user's browser profile or executes application pages that could seed data.
const ownedServer = process.env.ACCESSORY_STORAGE_TEST_URL ? undefined : await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } },
})
await ownedServer?.listen()
const address = ownedServer?.httpServer?.address()
const base = process.env.ACCESSORY_STORAGE_TEST_URL
  || `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`
const contractPath = '/__accessory_storage_contract__'
let browser: Browser

function canonicalSnapshot(snapshot: { revision: number; records: Array<{ id: string }> }) {
  return { ...snapshot, records: [...snapshot.records].sort((left, right) => left.id.localeCompare(right.id)) }
}

before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await ownedServer?.close() })

async function withIsolatedContext(
  run: (page: Page, context: BrowserContext) => Promise<void>,
  setup?: (context: BrowserContext) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext()
  try {
    await context.route(`**${contractPath}`, (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Accessory IndexedDB contract</title>',
    }))
    await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await setup?.(context)
    const page = await context.newPage()
    await page.goto(base + contractPath)
    await run(page, context)
  } finally { await context.close() }
}

test('辅料首次只读不落静态种子，并按ID范围读取而不扫描其他业务记录', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page) => {
    const result = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const originalGetAll = IDBObjectStore.prototype.getAll
      const ranges: Array<{ lower: unknown; upper: unknown }> = []
      IDBObjectStore.prototype.getAll = function (query?: IDBValidKey | IDBKeyRange | null, count?: number) {
        if (this.name === 'records') {
          if (!(query instanceof IDBKeyRange)) throw new Error('Accessory ordinary reads must not scan unrelated records')
          ranges.push({ lower: query.lower, upper: query.upper })
        }
        return originalGetAll.call(this, query, count)
      }
      try {
        await api.ensureAccessoryWarehouseRecords()
        const first = api.currentAccessorySnapshot()
        const db = await repository.openCuttingRecordDatabase()
        const counts = await new Promise<Record<string, number>>((resolve, reject) => {
          const tx = db.transaction(['records', 'commands', 'meta', 'files'], 'readonly')
          const values: Record<string, number> = {}
          for (const store of ['records', 'commands', 'meta', 'files']) {
            const request = tx.objectStore(store).count()
            request.onsuccess = () => { values[store] = request.result }
          }
          tx.oncomplete = () => resolve(values)
          tx.onabort = () => reject(tx.error)
        })
        await repository.commitCuttingRecords({
          revision: 0,
          command: { id: 'unrelated-fixture', intent: 'unrelated-fixture', result: true, at: '2026-10-19T00:00:00Z' },
          change: { puts: [{ id: 'unrelated-business:sentinel', collection: 'unrelated-business', value: { preserved: true } }] },
        })
        await api.ensureAccessoryWarehouseRecords()
        return { first, counts, afterUnrelated: api.currentAccessorySnapshot(), ranges }
      } finally { IDBObjectStore.prototype.getAll = originalGetAll }
    })
    assert.deepEqual(result.first, { revision: 0, records: [] })
    assert.deepEqual(result.counts, { records: 0, commands: 0, meta: 0, files: 0 })
    assert.deepEqual(result.afterUnrelated, { revision: 1, records: [] })
    assert.equal(result.ranges.length, 2)
    assert.ok(result.ranges.every((range) => range.lower === 'accessory-warehouse:' && range.upper === 'accessory-warehouse:\uffff'))
  })
})

test('辅料关联记录同库逐条保存，complete后发布内存，刷新及同源直达独立回读', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page, context) => {
    const result = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      await api.ensureAccessoryWarehouseRecords()
      const originalTransaction = IDBDatabase.prototype.transaction
      const originalGetAll = IDBObjectStore.prototype.getAll
      const before = api.currentAccessorySnapshot()
      let snapshotAtComplete: unknown
      let snapshotAtSaved: unknown
      let savedEvents = 0
      window.addEventListener('accessory-warehouse-saved', () => { savedEvents++; snapshotAtSaved = api.currentAccessorySnapshot() })
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) {
        const tx = originalTransaction.apply(this, args)
        if (tx.mode === 'readwrite') tx.addEventListener('complete', () => { snapshotAtComplete = api.currentAccessorySnapshot() })
        return tx
      }
      IDBObjectStore.prototype.getAll = function (query?: IDBValidKey | IDBKeyRange | null, count?: number) {
        if (this.name === 'records' && !(query instanceof IDBKeyRange)) throw new Error('Saving must not scan the whole records store')
        return originalGetAll.call(this, query, count)
      }
      const rows = [
        { kind: 'preparation', id: 'PREP-1', value: { id: 'PREP-1', productionOrderId: 'PO-STORAGE-1', qty: 12 } },
        { kind: 'transfer', id: 'TRANSFER-1', value: { id: 'TRANSFER-1', preparationId: 'PREP-1', qty: 12 } },
        { kind: 'audit', id: 'AUDIT-1', value: { id: 'AUDIT-1', transferId: 'TRANSFER-1', action: '配齐建单' } },
      ]
      let saved: unknown
      try {
        saved = await api.saveAccessoryWarehouseAction({
          commandId: 'save-linked-records', intent: JSON.stringify(rows),
          result: { preparationId: 'PREP-1', transferId: 'TRANSFER-1' }, change: api.accessoryChangeFromRows(rows),
        })
      } finally {
        IDBDatabase.prototype.transaction = originalTransaction
        IDBObjectStore.prototype.getAll = originalGetAll
      }
      const persisted = await repository.readCuttingRecords()
      return { before, snapshotAtComplete, snapshotAtSaved, savedEvents, saved, persisted, snapshot: api.currentAccessorySnapshot() }
    })
    assert.deepEqual(result.before, { revision: 0, records: [] })
    assert.deepEqual(result.snapshotAtComplete, result.before, 'request success and transaction complete event must not publish uncommitted memory')
    assert.equal(result.savedEvents, 1)
    assert.deepEqual(result.saved, { preparationId: 'PREP-1', transferId: 'TRANSFER-1' })
    assert.deepEqual(canonicalSnapshot(result.snapshot), canonicalSnapshot(result.persisted))
    assert.deepEqual(canonicalSnapshot(result.snapshotAtSaved as typeof result.snapshot), canonicalSnapshot(result.persisted))
    assert.equal(result.persisted.revision, 1)
    assert.equal(result.persisted.records.length, 3)
    assert.deepEqual(new Set(result.persisted.records.map((row: any) => row.collection)), new Set([
      'accessory-warehouse:preparation', 'accessory-warehouse:transfer', 'accessory-warehouse:audit',
    ]))

    await page.reload()
    const refreshed = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      let unprepared = ''
      try { api.currentAccessorySnapshot() } catch (error) { unprepared = String(error) }
      await api.ensureAccessoryWarehouseRecords()
      return { unprepared, snapshot: api.currentAccessorySnapshot(), preparation: api.findAccessoryRecord('preparation', 'PREP-1') }
    })
    assert.match(refreshed.unprepared, /尚未读取/)
    assert.deepEqual(refreshed.snapshot, result.persisted)
    assert.deepEqual(refreshed.preparation, { id: 'PREP-1', productionOrderId: 'PO-STORAGE-1', qty: 12 })
    const direct = await context.newPage()
    await direct.goto(base + contractPath)
    assert.deepEqual(await direct.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      await api.ensureAccessoryWarehouseRecords()
      return api.currentAccessorySnapshot()
    }), result.persisted)
  })
})

test('辅料同命令同内容重放，不重复写入；不同意图或不同记录内容拒绝', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page) => {
    const result = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      await api.ensureAccessoryWarehouseRecords()
      const input = {
        commandId: 'replay-command', intent: 'confirm PREP-REPLAY', result: { id: 'PREP-REPLAY', qty: 12 },
        change: api.accessoryChangeFromRows([{ kind: 'preparation', id: 'PREP-REPLAY', value: { id: 'PREP-REPLAY', qty: 12 } }]),
      }
      const saved = await api.saveAccessoryWarehouseAction(input)
      const afterSave = await repository.readCuttingRecords()
      const replayed = await api.saveAccessoryWarehouseAction(input)
      const afterReplay = await repository.readCuttingRecords()
      async function rejection(next: typeof input): Promise<string> {
        try { await api.saveAccessoryWarehouseAction(next); return '' } catch (error) { return String(error) }
      }
      const changedIntent = await rejection({ ...input, intent: 'different operation' })
      const changedPayload = await rejection({
        ...input,
        change: api.accessoryChangeFromRows([{ kind: 'preparation', id: 'PREP-REPLAY', value: { id: 'PREP-REPLAY', qty: 99 } }]),
      })
      const changedResult = await rejection({ ...input, result: { id: 'PREP-REPLAY', qty: 99 } })
      const scopeFailure = await rejection({
        ...input, commandId: 'wrong-scope',
        change: { puts: [{ id: 'other-business:1', collection: 'other-business', value: { id: 'PREP-REPLAY', qty: 12 } }] },
      })
      return { saved, replayed, afterSave, afterReplay, changedIntent, changedPayload, changedResult, scopeFailure, final: await repository.readCuttingRecords() }
    })
    assert.deepEqual(result.replayed, result.saved)
    assert.deepEqual(result.afterReplay, result.afterSave)
    assert.match(result.changedIntent, /不同内容|其他操作|不一致/)
    assert.match(result.changedPayload, /不同内容|其他操作|不一致/)
    assert.match(result.changedResult, /不同内容|其他操作|不一致/)
    assert.match(result.scopeFailure, /未登记的记录范围/)
    assert.deepEqual(result.final, result.afterSave)
  })
})

test('两个同源标签页的旧snapshot竞争只有一笔提交，失败方保持原内存并可重新读取恢复', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (left, context) => {
    const right = await context.newPage()
    await right.goto(base + contractPath)
    const initial = await Promise.all([left, right].map((page) => page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      await api.ensureAccessoryWarehouseRecords()
      return api.currentAccessorySnapshot()
    })))
    assert.deepEqual(initial, [{ revision: 0, records: [] }, { revision: 0, records: [] }])
    const outcomes = await Promise.all([left, right].map((page, index) => page.evaluate(async (index) => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const id = `RACE-${index}`
      try {
        const saved = await api.saveAccessoryWarehouseAction({
          commandId: id, intent: id, result: { id },
          change: api.accessoryChangeFromRows([{ kind: 'transfer', id, value: { id, qty: index + 1 } }]),
        })
        return { ok: true, saved, error: '', snapshot: api.currentAccessorySnapshot() }
      } catch (error) { return { ok: false, saved: null, error: String(error), snapshot: api.currentAccessorySnapshot() } }
    }, index)))
    assert.equal(outcomes.filter((outcome) => outcome.ok).length, 1)
    const loserIndex = outcomes.findIndex((outcome) => !outcome.ok)
    assert.match(outcomes[loserIndex].error, /其他页面已更新.*未保存/)
    assert.deepEqual(outcomes[loserIndex].snapshot, { revision: 0, records: [] })
    const actual = await [left, right][loserIndex].evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      await api.ensureAccessoryWarehouseRecords()
      return { snapshot: api.currentAccessorySnapshot(), persisted: await repository.readCuttingRecords() }
    })
    assert.deepEqual(actual.snapshot, actual.persisted)
    assert.equal(actual.persisted.revision, 1)
    assert.equal(actual.persisted.records.length, 1)
    assert.equal((actual.persisted.records[0].value as { id: string }).id, outcomes.find((outcome) => outcome.ok)!.saved!.id)
  })
})

test('真实事务在全部请求success后abort仍整笔撤回，无关联半套、无内存发布且同命令可重试', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page) => {
    const result = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      await api.ensureAccessoryWarehouseRecords()
      await api.saveAccessoryWarehouseAction({
        commandId: 'abort-baseline', intent: 'baseline', result: true,
        change: api.accessoryChangeFromRows([
          { kind: 'preparation', id: 'ABORT-PREP', value: { id: 'ABORT-PREP', qty: 12 } },
          { kind: 'transfer', id: 'ABORT-OLD-TRANSFER', value: { id: 'ABORT-OLD-TRANSFER', qty: 12 } },
        ]),
      })
      const before = api.currentAccessorySnapshot()
      const dump = async () => {
        const db = await repository.openCuttingRecordDatabase()
        return new Promise<Record<string, unknown[]>>((resolve, reject) => {
          const tx = db.transaction(['records', 'commands', 'meta', 'files'], 'readonly')
          const values: Record<string, unknown[]> = {}
          for (const name of ['records', 'commands', 'meta', 'files']) {
            const request = tx.objectStore(name).getAll()
            request.onsuccess = () => { values[name] = request.result }
          }
          tx.oncomplete = () => resolve(values)
          tx.onabort = () => reject(tx.error)
        })
      }
      const beforeDisk = await dump()
      const input = {
        commandId: 'abort-and-retry', intent: 'replace linked transfer', result: { transferId: 'ABORT-NEW-TRANSFER' },
        change: {
          ...api.accessoryChangeFromRows([
            { kind: 'preparation', id: 'ABORT-PREP', value: { id: 'ABORT-PREP', qty: 20 } },
            { kind: 'transfer', id: 'ABORT-NEW-TRANSFER', value: { id: 'ABORT-NEW-TRANSFER', qty: 20 } },
            { kind: 'audit', id: 'ABORT-AUDIT', value: { id: 'ABORT-AUDIT', action: 'replace' } },
          ]),
          deletes: [api.accessoryRecord('transfer', 'ABORT-OLD-TRANSFER', {}).id],
        },
      }
      const originalPut = IDBObjectStore.prototype.put
      let successfulRecordRequests = 0
      let savedEvents = 0
      let snapshotAtAbort: unknown
      window.addEventListener('accessory-warehouse-saved', () => { savedEvents++ })
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof originalPut>) {
        const request = originalPut.apply(this, args)
        if (this.name === 'records') request.addEventListener('success', () => { successfulRecordRequests++ })
        if (this.name === 'meta' && (args[0] as { id?: string }).id === 'revision') {
          request.addEventListener('success', () => {
            snapshotAtAbort = api.currentAccessorySnapshot()
            this.transaction.abort()
          }, { once: true })
        }
        return request
      }
      let failure = ''
      try { await api.saveAccessoryWarehouseAction(input) } catch (error) { failure = String(error) }
      finally { IDBObjectStore.prototype.put = originalPut }
      const afterFailure = api.currentAccessorySnapshot()
      const afterFailureDisk = await dump()
      const eventsAfterFailure = savedEvents
      const retried = await api.saveAccessoryWarehouseAction(input)
      return { before, beforeDisk, failure, successfulRecordRequests, snapshotAtAbort, afterFailure, afterFailureDisk, eventsAfterFailure, retried, afterRetry: api.currentAccessorySnapshot(), savedEvents }
    })
    assert.equal(result.successfulRecordRequests, 3, 'aborting after record requests succeeded must still roll back')
    assert.match(result.failure, /未保存|撤回|中止/)
    assert.deepEqual(result.snapshotAtAbort, result.before)
    assert.deepEqual(result.afterFailure, result.before)
    assert.deepEqual(result.afterFailureDisk, result.beforeDisk)
    assert.equal(result.eventsAfterFailure, 0)
    assert.deepEqual(result.retried, { transferId: 'ABORT-NEW-TRANSFER' })
    assert.equal(result.afterRetry.revision, 2)
    assert.equal(result.afterRetry.records.length, 3)
    assert.equal(result.savedEvents, 1)
    assert.ok(!result.afterRetry.records.some((row: any) => row.id.endsWith(':ABORT-OLD-TRANSFER')))
  })
})

test('数据库打开失败时拒绝空列表和保存，展示真实读取错误；恢复后原记录仍可读取', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page) => {
    const before = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      await api.ensureAccessoryWarehouseRecords()
      await api.saveAccessoryWarehouseAction({
        commandId: 'open-failure-baseline', intent: 'baseline', result: true,
        change: api.accessoryChangeFromRows([{ kind: 'stock', id: 'OPEN-PRESERVED', value: { id: 'OPEN-PRESERVED', qty: 8 } }]),
      })
      return api.currentAccessorySnapshot()
    })
    await page.reload()
    const result = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const originalOpen = IDBFactory.prototype.open
      IDBFactory.prototype.open = function () { throw new DOMException('storage access denied by contract', 'SecurityError') }
      const errors = { ensure: '', list: '', snapshot: '', save: '' }
      let fallbackHtml = ''
      try {
        try { await api.ensureAccessoryWarehouseRecords() } catch (error) { errors.ensure = String(error) }
        try { api.listAccessoryRecords('stock') } catch (error) { errors.list = String(error) }
        try { api.currentAccessorySnapshot() } catch (error) { errors.snapshot = String(error) }
        try {
          await api.saveAccessoryWarehouseAction({ commandId: 'must-not-save', intent: 'must-not-save', result: true, change: { puts: [] } })
        } catch (error) { errors.save = String(error) }
        fallbackHtml = await api.withAccessoryWarehouseRecords(() => '<div>fake empty success</div>')
      } finally { IDBFactory.prototype.open = originalOpen }
      await api.ensureAccessoryWarehouseRecords()
      return { errors, fallbackHtml, recovered: api.currentAccessorySnapshot(), readError: api.accessoryWarehouseReadError() }
    })
    for (const message of Object.values(result.errors)) assert.match(message, /无法读取.*未使用空数据覆盖/s)
    assert.match(result.fallbackHtml, /role="alert"/)
    assert.match(result.fallbackHtml, /重新读取/)
    assert.ok(!result.fallbackHtml.includes('fake empty success'))
    assert.deepEqual(result.recovered, before)
    assert.equal(result.readError, '')
  })
})

test('localStorage被禁用不影响新辅料记录保存和刷新回读', { timeout: 120000 }, async () => {
  await withIsolatedContext(async (page) => {
    const saved = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      let blocked = ''
      try { localStorage.getItem('probe') } catch (error) { blocked = String(error) }
      await api.ensureAccessoryWarehouseRecords()
      const initial = api.currentAccessorySnapshot()
      await api.saveAccessoryWarehouseAction({
        commandId: 'no-local-storage', intent: 'save without localStorage', result: true,
        change: api.accessoryChangeFromRows([{ kind: 'pickup', id: 'NO-LS-PICKUP', value: { id: 'NO-LS-PICKUP', qty: 7 } }]),
      })
      return { blocked, initial, snapshot: api.currentAccessorySnapshot() }
    })
    assert.match(saved.blocked, /SecurityError/)
    assert.deepEqual(saved.initial, { revision: 0, records: [] })
    assert.equal(saved.snapshot.revision, 1)
    assert.equal(saved.snapshot.records.length, 1)
    await page.reload()
    assert.deepEqual(await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      await api.ensureAccessoryWarehouseRecords()
      return api.currentAccessorySnapshot()
    }), saved.snapshot)
  }, async (context) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('localStorage disabled by contract', 'SecurityError') },
      })
    })
  })
})

test('真实main读取失败后同路由重新读取按钮恢复当前页面，保留原审计记录且不写业务资料', { timeout: 120000 }, async () => {
  await withIsolatedContext(async page => {
    const before = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      await api.ensureAccessoryWarehouseRecords()
      await api.saveAccessoryWarehouseAction({ commandId: 'UI-READ-BASE', intent: 'ui read recovery baseline', result: true,
        change: { puts: [api.accessoryRecord('audit', 'UI-READ-PRESERVED', { id: 'UI-READ-PRESERVED', detail: '原审计事实保留' })] } })
      return api.currentAccessorySnapshot()
    })
    await page.addInitScript(() => {
      const state = window as any
      state.__readOriginalOpen = indexedDB.open
      state.__readWriteCount = 0
      const originalTransaction = IDBDatabase.prototype.transaction
      IDBDatabase.prototype.transaction = function(names: any, mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
        if (this.name === 'higood-cutting-records-v1' && mode === 'readwrite') state.__readWriteCount++
        return originalTransaction.call(this, names, mode, options)
      }
      indexedDB.open = function(name: string, version?: number) {
        if (name === 'higood-cutting-records-v1') throw new DOMException('ui-read-fault', 'UnknownError')
        return version === undefined ? state.__readOriginalOpen.call(this, name) : state.__readOriginalOpen.call(this, name, version)
      }
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/wls/accessory-warehouses/gtp/stock')
    await page.locator('[data-accessory-read-error]').waitFor()
    assert.match(await page.locator('[data-accessory-read-error]').innerText(), /ui-read-fault/)
    await page.evaluate(() => { indexedDB.open = (window as any).__readOriginalOpen })
    await page.locator('[data-accessory-read-error] [data-accessory-action="reload"]').click()
    await page.locator('[data-accessory-transfer-root]').waitFor()
    assert.equal(await page.locator('[data-accessory-read-error]').count(), 0)
    assert.equal(new URL(page.url()).pathname, '/wls/accessory-warehouses/gtp/stock')
    const after = await page.evaluate(async () => ({
      snapshot: await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot(),
      writes: (window as any).__readWriteCount,
    }))
    assert.deepEqual(after.snapshot, before)
    assert.equal(after.writes, 0)
    assert.deepEqual(errors, [])
  })
})
