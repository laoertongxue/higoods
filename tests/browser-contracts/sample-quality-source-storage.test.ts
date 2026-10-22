import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { chromium, type Browser } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Native isolated source contract; module reads are not advertised as original-page actions or performance. */
const base = process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'
const output = resolve(process.env.QUALITY_SAMPLE_GATE_REPORT_PATH || 'output/qc-implementation-20261022/sample-source-gate-native-results.json')
const results: Array<Record<string, unknown>> = []
let browser: Browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function runCase(scenario: 'LEGACY_EMPTY_IDB' | 'COPYING' | 'VERIFIED' | 'COMPLETE_REAPPEAR' | 'LS_UNKNOWN' | 'LS_COMPLETE') {
  const context = await browser.newContext(), page = await context.newPage(), pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__sample-source-gate-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh"><body></body></html>' }))
  const evidence: Record<string, unknown> = { scenario, base, kind: '隔离原生IndexedDB只读契约；非页面动作/性能/生产事实', passed: false }
  try {
    await page.goto(base + '/__sample-source-gate-contract')
    const actual = await page.evaluate(async scenario => {
      const source = (await import('/src/data/fcs/sample-quality-read-source.ts')).sampleQualityReadSource
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const originals = await import('/src/data/fcs/sewing-outsourcing-demo.ts')
      const production = await import('/src/data/fcs/production-context-records.ts')
      const key = production.PRODUCTION_CONTEXT_KEYS.samples, markerId = `source-migration:${key}`
      const sample = originals.getDefaultSewingSampleApprovalRecords()[0]
      sample.sample.styleName = '原库已确认持久样衣，不可被演示资料替代'
      const sampleRow = { id: `production-context:samples:${sample.assignmentId}`, collection: 'production-context:samples', value: sample }
      const db = await repository.openCuttingRecordDatabase()
      const phase = ['COPYING', 'VERIFIED'].includes(scenario) ? scenario : scenario.startsWith('COMPLETE') || scenario === 'LS_COMPLETE' ? 'COMPLETE' : undefined
      const marker = phase ? { id: markerId, collection: 'production-context-migrations', value: {
        key, phase, fingerprint: 'a'.repeat(64), targetFingerprint: 'b'.repeat(64), count: 1, copied: phase === 'COPYING' ? 0 : 1, ids: [sampleRow.id],
      } } : undefined
      if (scenario !== 'LEGACY_EMPTY_IDB') {
        const tx = db.transaction(['records', 'meta'], 'readwrite')
        const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
        tx.objectStore('records').put(sampleRow)
        if (marker) tx.objectStore('records').put(marker)
        tx.objectStore('meta').put({ id: 'revision', value: 1 })
        await done
      }
      const oldPayload = JSON.stringify({ version: 3, records: [sample], commands: [], sequence: 1 })
      if (scenario === 'LEGACY_EMPTY_IDB') localStorage.setItem(key, oldPayload)
      const originalGetItem = Storage.prototype.getItem
      if (scenario.startsWith('LS_')) Storage.prototype.getItem = function () { throw new DOMException('隔离整个localStorage读取不可用', 'SecurityError') }
      const originalTransaction = IDBDatabase.prototype.transaction, originalPut = IDBObjectStore.prototype.put
      const originalAdd = IDBObjectStore.prototype.add, originalDelete = IDBObjectStore.prototype.delete
      const originalGetAll = IDBObjectStore.prototype.getAll, originalGet = IDBObjectStore.prototype.get
      const transactionIds = new WeakMap<IDBTransaction, number>(), requests: Array<Record<string, unknown>> = []
      let writes = 0, nextTransaction = 0
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) {
        const tx = originalTransaction.apply(this, args); transactionIds.set(tx, ++nextTransaction); return tx
      }
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof originalPut>) { writes++; return originalPut.apply(this, args) }
      IDBObjectStore.prototype.add = function (...args: Parameters<typeof originalAdd>) { writes++; return originalAdd.apply(this, args) }
      IDBObjectStore.prototype.delete = function (...args: Parameters<typeof originalDelete>) { writes++; return originalDelete.apply(this, args) }
      IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
        requests.push({ tx: transactionIds.get(this.transaction), mode: this.transaction.mode, store: this.name, method: 'getAll', bounded: !!args[0] })
        return originalGetAll.apply(this, args)
      }
      IDBObjectStore.prototype.get = function (...args: Parameters<typeof originalGet>) {
        requests.push({ tx: transactionIds.get(this.transaction), mode: this.transaction.mode, store: this.name, method: 'get', id: String(args[0]) })
        return originalGet.apply(this, args)
      }
      const nativeRows = async () => {
        const tx = db.transaction('records', 'readonly'), request = originalGetAll.call(tx.objectStore('records'))
        return new Promise<unknown[]>((resolve, reject) => { let records: unknown[] = []; request.onsuccess = () => { records = request.result }; tx.oncomplete = () => resolve(records); tx.onabort = () => reject(tx.error) })
      }
      const attempt = async (detail: boolean) => {
        try {
          if (detail) { await source.prepareDetail!(sample.sample.sampleId); return { ok: true, value: source.get!(sample.sample.sampleId) } }
          await source.prepare!(); return { ok: true, value: source.list() }
        } catch (error) { return { ok: false, code: (error as any).code, message: String(error) } }
      }
      try {
        const before = await nativeRows()
        let initial: unknown
        if (scenario === 'COMPLETE_REAPPEAR') {
          initial = await attempt(false)
          localStorage.setItem(key, oldPayload)
        }
        const list = await attempt(false), detail = await attempt(true)
        const after = await nativeRows()
        let exposedAfterFailure = false
        if (!list.ok) { try { source.list(); exposedAfterFailure = true } catch {} }
        const preservedLegacy = scenario === 'LEGACY_EMPTY_IDB' || scenario === 'COMPLETE_REAPPEAR' ? originalGetItem.call(localStorage, key) === oldPayload : undefined
        return { scenario, initial, list, detail, writes, requests, before, after, exposedAfterFailure, preservedLegacy,
          database: db.name, version: db.version, markerId, sampleRowId: sampleRow.id, sampleId: sample.sample.sampleId, expectedName: sample.sample.styleName }
      } finally {
        Storage.prototype.getItem = originalGetItem; IDBDatabase.prototype.transaction = originalTransaction
        IDBObjectStore.prototype.put = originalPut; IDBObjectStore.prototype.add = originalAdd; IDBObjectStore.prototype.delete = originalDelete
        IDBObjectStore.prototype.getAll = originalGetAll; IDBObjectStore.prototype.get = originalGet
      }
    }, scenario)
    evidence.actual = actual
    assert.equal(actual.database, 'higood-cutting-records-v1'); assert.equal(actual.version, 1)
    assert.equal(actual.writes, 0); assert.deepEqual(actual.after, actual.before); assert.deepEqual(pageErrors, [])
    assert.equal(actual.requests.filter(row => row.store === 'records' && row.method === 'getAll' && !row.bounded).length, 0)
    assert.ok(actual.requests.every(row => row.mode === 'readonly'))
    const prefixRequests = actual.requests.filter(row => row.store === 'records' && row.method === 'getAll' && row.bounded)
    assert.ok(prefixRequests.length)
    for (const request of prefixRequests) assert.ok(actual.requests.some(row => row.tx === request.tx && row.id === actual.markerId), '样衣前缀与原迁移标记必须同一只读事务')
    if (scenario === 'LS_COMPLETE') {
      assert.equal(actual.list.ok, true); assert.equal(actual.detail.ok, true)
      assert.equal((actual.list as any).value.find((item: any) => item.id === actual.sampleId).styleName, actual.expectedName)
      assert.equal((actual.detail as any).value.styleName, actual.expectedName)
      const point = actual.requests.find(row => row.id === actual.sampleRowId)
      assert.ok(point); assert.ok(actual.requests.some(row => row.tx === point.tx && row.id === actual.markerId), '按单详情与原迁移标记必须同一只读事务')
    } else {
      assert.equal(actual.list.ok, false); assert.equal(actual.detail.ok, false)
      assert.equal((actual.list as any).code, 'PRODUCTION_CONTEXT_RECOVERY'); assert.equal((actual.detail as any).code, 'PRODUCTION_CONTEXT_RECOVERY')
      assert.equal(actual.exposedAfterFailure, false)
      if (scenario === 'COMPLETE_REAPPEAR') assert.equal((actual.initial as any).ok, true)
      if (scenario === 'LEGACY_EMPTY_IDB' || scenario === 'COMPLETE_REAPPEAR') assert.equal(actual.preservedLegacy, true)
    }
    evidence.passed = true
  } catch (error) { evidence.error = String(error); throw error }
  finally {
    results.push(evidence); mkdirSync(resolve('output/qc-implementation-20261022'), { recursive: true })
    writeFileSync(output, JSON.stringify({ scenarios: results.length, passed: results.filter(row => row.passed).length, results }, null, 2))
    await context.close()
  }
}

for (const scenario of ['LEGACY_EMPTY_IDB', 'COPYING', 'VERIFIED', 'COMPLETE_REAPPEAR', 'LS_UNKNOWN', 'LS_COMPLETE'] as const) {
  test(`原样衣窄源迁移门禁原生只读：${scenario}`, { timeout: 60000 }, () => runCase(scenario))
}
