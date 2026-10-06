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
      const originalGetAll = IDBObjectStore.prototype.getAll
      IDBObjectStore.prototype.getAll = function (...args) { if (this.name === 'records') throw new Error('ordinary commit must not scan unrelated records'); return originalGetAll.apply(this, args) }
      try { await api.commitPcsRecords(create) } finally { IDBObjectStore.prototype.getAll = originalGetAll }
      check((await api.readPcsFiles(['file-one']))[0].blob.size === 9, 'file preparation reads only requested files')
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
      const newGroup = (name: string, ids: string[]) => ({ puts: ids.map(id => ({ id, collection: 'imports', value: { name }, expectedVersion: 0 })), deletes: [], operationId: `import-${name}`, intent: name })
      const firstGroups = [newGroup('conflict', ['partial-root', 'one']), newGroup('valid', ['group-root', 'group-sku']), { ...newGroup('missing-file', ['file-root', 'file-sku']), puts: [{ id: 'file-root', collection: 'imports', value: {}, expectedVersion: 0 }, { id: 'file-sku', collection: 'imports', value: { fileId: 'missing' }, expectedVersion: 0 }] }]
      const groupResults = await api.commitPcsNewRecordGroups(firstGroups)
      check(!groupResults[0].ok && groupResults[1].ok && !groupResults[2].ok, 'new import group failure does not cancel valid groups')
      const groupRecords = (await api.readPcsRecords()).records
      check(!groupRecords.some(row => ['partial-root', 'file-root', 'file-sku'].includes(row.id)) && groupRecords.some(row => row.id === 'group-sku'), 'late collision and missing attachment roll back the whole affected group')
      const replay = await api.commitPcsNewRecordGroups([firstGroups[1], { ...firstGroups[1], intent: 'changed' }])
      check(replay[0].ok && !replay[1].ok && replay[1].message.includes('其他操作'), 'new group retry deduplicates same intent and rejects changed intent')
      const racing = await Promise.all(['left', 'right'].map(name => api.commitPcsNewRecordGroups([newGroup(name, ['race-root', 'race-sku'])])))
      check(racing.filter(result => result[0].ok).length === 1, 'new group unique-key writes reject cross-tab overwrite atomically')
      const referenceResult = await api.commitPcsNewRecordGroups([{ ...newGroup('valid-ref', ['ref-root']), puts: [{ id: 'ref-root', collection: 'imports', value: { fileId: 'file-two' }, expectedVersion: 0 }] }])
      check(referenceResult[0].ok, 'new groups reuse existing attachment bytes')
      const originalAdd = IDBObjectStore.prototype.add
      IDBObjectStore.prototype.add = function (value, ...args) { if (this.name === 'records' && value.id === 'quota-child') throw new DOMException('full', 'QuotaExceededError'); return originalAdd.call(this, value, ...args) }
      try {
        const quota = await api.commitPcsNewRecordGroups([newGroup('quota-before', ['quota-before-root', 'quota-before-sku']), newGroup('quota-group', ['quota-root', 'quota-child']), newGroup('quota-after', ['quota-after-root', 'quota-after-sku'])])
        const afterQuota = (await api.readPcsRecords()).records
        check(!quota[1].ok && quota[1].message.includes('空间不足') && !afterQuota.some(row => row.id === 'quota-root'), 'new group quota failure keeps the complete group unsaved')
        check(quota[0].ok && quota[2].ok && ['quota-before-root', 'quota-before-sku', 'quota-after-root', 'quota-after-sku'].every(id => afterQuota.some(row => row.id === id)), 'a failed cohort excludes the failed group and fully saves both unaffected neighbors')
      } finally { IDBObjectStore.prototype.add = originalAdd }
      const receiptLoad = await api.commitPcsNewRecordGroups(Array.from({ length: 1002 }, (_, index) => newGroup(`receipt-${index}`, [`receipt-${index}`])))
      check(receiptLoad.every(row => row.ok), 'thousand new groups commit independently')
      const receiptCount = await new Promise<number>((resolve, reject) => { const open = indexedDB.open('higood-pcs-records', 2); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('operations'); const count = tx.objectStore('operations').count(); count.onsuccess = () => { resolve(count.result); db.close() }; count.onerror = () => { reject(count.error); db.close() } } })
      check(receiptCount === 1000, 'batch receipt retention is bounded after completion')
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('higood-pcs-records', 2)
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('operations', 'readwrite'), store = tx.objectStore('operations')
          for (const [id, createdAt] of [['import-receipt-498', '1900-01-01'], ['import-receipt-499', '2100-01-01'], ['import-receipt-500', '1900-01-01']]) {
            const read = store.get(id); read.onsuccess = () => store.put({ ...read.result, id, createdAt })
          }
          tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
        }; request.onerror = () => reject(request.error)
      })
      await api.commitPcsNewRecordGroups([newGroup('retention-final-a', ['retention-final-a']), newGroup('retention-final-b', ['retention-final-b'])])
      const remainingReceipts = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = indexedDB.open('higood-pcs-records', 2)
        request.onsuccess = () => { const db = request.result, tx = db.transaction('operations'), keys = tx.objectStore('operations').getAllKeys(); keys.onsuccess = () => { resolve(keys.result); db.close() }; keys.onerror = () => reject(keys.error) }; request.onerror = () => reject(request.error)
      })
      check(remainingReceipts.length === 1000 && remainingReceipts.includes('import-receipt-499') && !remainingReceipts.includes('import-receipt-498') && !remainingReceipts.includes('import-receipt-500'), 'receipt range pruning preserves a newer primary key between two expired keys')
      return passed
    })
    assert.equal(checks.length, 31)
    await page.reload()
    assert.equal(await page.evaluate(async () => (await (await import('/storage.js')).readPcsRecords()).records.find(row => row.id === 'one').version), 3)
  } finally {
    await browser?.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
