import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import ts from 'typescript'

test('PCS real IndexedDB: atomic writes, versions, retry, attachment references and backup', async () => {
  const source = await readFile(new URL('../../src/data/pcs-record-db.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/storage.js' ? 'text/javascript' : 'text/html')
    res.end(req.url === '/storage.js' ? code : '<!doctype html><title>PCS storage test</title>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.addInitScript('globalThis.__name = (value) => value')
    await page.goto(`http://127.0.0.1:${address.port}`)
    const checks = await page.evaluate(async () => {
      const api = await import('/storage.js')
      const passed: string[] = []
      function check(ok: boolean, label: string) { if (!ok) throw new Error(label); passed.push(label) }
      async function rejected(action: () => Promise<unknown>, text: string) {
        try { await action() } catch (error) { check(String(error).includes(text), text); return }
        throw new Error(`Expected failure: ${text}`)
      }
      const initial = await api.readPcsRecords()
      check(initial.records.length === 0 && initial.files.length === 0, 'fresh read never seeds')
      const create = { puts: [{ id: 'one', collection: 'orders', value: { nested: { fileId: 'file-one' } }, expectedVersion: 0 }], deletes: [], files: [{ id: 'file-one', blob: new Blob(['real file']) }], operationId: 'create', intent: 'create-one' }
      await api.commitPcsRecords(create)
      await api.commitPcsRecords(create)
      check((await api.readPcsRecords()).records[0].version === 1, 'same intent retry deduplicated')
      await rejected(() => api.commitPcsRecords({ ...create, intent: 'other' }), '操作编号已用于其他操作')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'two', collection: 'orders', value: {}, expectedVersion: 0 }, { id: 'one', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'conflict', intent: 'conflict' }), '已被其他页面修改')
      check((await api.readPcsRecords()).records.length === 1, 'conflict rolls back other writes')
      await rejected(() => api.commitPcsRecords({ puts: [], deletes: [], deleteFileIds: ['file-one'], operationId: 'file-delete', intent: 'file-delete' }), '仍被记录或历史版本引用')
      check(await api.cleanupUnreferencedPcsFiles() === 0, 'cleanup preserves referenced blob')
      await api.commitPcsRecords({ puts: [], deletes: [{ id: 'one', expectedVersion: 1 }], operationId: 'delete', intent: 'delete' })
      const deleted = (await api.readPcsRecords()).records[0]
      check(deleted.deleted === true && deleted.version === 2, 'delete retains version tombstone')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'one', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'aba', intent: 'aba' }), '已被其他页面修改')
      check(await api.cleanupUnreferencedPcsFiles() === 1, 'cleanup removes unreferenced blob')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'bad', collection: 'orders', value: { fileId: 'missing' }, expectedVersion: 0 }], deletes: [], operationId: 'bad', intent: 'bad' }), '附件引用不完整')
      await api.commitPcsRecords({ puts: [{ id: 'one', collection: 'orders', value: { url: 'pcs-file:file-two' }, expectedVersion: 2 }], deletes: [], files: [{ id: 'file-two', blob: new Blob(['restorable']) }], operationId: 'restore', intent: 'restore' })
      const backup = await api.exportPcsBackup()
      check(backup.version === 1 && await backup.files[0].blob.text() === 'restorable', 'backup includes original file bytes')
      await rejected(() => api.restorePcsBackup(backup), '当前已有本地数据')
      await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('higood-pcs-records'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) })
      await api.restorePcsBackup(backup)
      const restored = await api.readPcsRecords()
      check(restored.records[0].version === 3 && await restored.files[0].blob.text() === 'restorable', 'backup restores versions and blobs')
      await rejected(() => api.commitPcsRecords({ puts: [{ id: 'base64', collection: 'orders', value: { url: 'data:image/png;base64,ABC' }, expectedVersion: 0 }], deletes: [], operationId: 'base64', intent: 'base64' }), '不能保存 Base64')
      const contenders = await Promise.allSettled(['a', 'b'].map(id => api.commitPcsRecords({ puts: [{ id: 'race', collection: 'orders', value: id, expectedVersion: 0 }], deletes: [], operationId: `race-${id}`, intent: id })))
      check(contenders.filter(outcome => outcome.status === 'fulfilled').length === 1, 'concurrent transactions reject lost update')
      const originalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) { if (this.name === 'records') throw new DOMException('full', 'QuotaExceededError'); return originalPut.apply(this, args) }
      try {
        await rejected(() => api.commitPcsRecords({ puts: [{ id: 'quota', collection: 'orders', value: {}, expectedVersion: 0 }], deletes: [], operationId: 'quota', intent: 'quota' }), '浏览器空间不足')
      } finally { IDBObjectStore.prototype.put = originalPut }
      check(!(await api.readPcsRecords()).records.some(record => record.id === 'quota'), 'quota failure leaves records unchanged')
      const originalOpen = IDBFactory.prototype.open
      IDBFactory.prototype.open = function () { throw new DOMException('denied', 'SecurityError') }
      try { await rejected(() => api.readPcsRecords(), 'SecurityError') } finally { IDBFactory.prototype.open = originalOpen }
      check((await api.readPcsRecords()).records.length === 2, 'open failure can retry with a new connection')
      return passed
    })
    assert.equal(checks.length, 20)
    await page.reload()
    assert.equal(await page.evaluate(async () => (await (await import('/storage.js')).readPcsRecords()).records[0].version), 3)
  } finally {
    await browser?.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
