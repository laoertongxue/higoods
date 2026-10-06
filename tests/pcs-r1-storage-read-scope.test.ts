import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readPcsRecords, type PcsStoredRecord } from '../src/data/pcs-record-db.ts'

// A request-level double checks namespace and Blob selection without opening a
// browser. Real transaction completion/rollback remains in pcs-record-db.test.ts.
test('scoped PCS reads use primary-key ranges and fetch only referenced files', async () => {
  const originalDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const originalRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange')
  const a = 'higood-pcs-style-archive-store-v3', b = 'higood-pcs-channel-catalog-v1'
  const rows: PcsStoredRecord[] = [
    { id: `${a}/meta`, collection: a, version: 1, value: { array: false, fields: { version: 3 }, groups: ['records'] } },
    { id: `${a}/records/one`, collection: `${a}/records`, version: 2, value: { position: 0, data: { styleId: 'one', image: 'pcs-file:one-file' } } },
    { id: `${a}/records/removed`, collection: 'deleted', version: 3, value: null, deleted: true },
    { id: `${a}0/records/not-the-same-namespace`, collection: `${a}0/records`, version: 1, value: {} },
    { id: `${b}/variants/two`, collection: `${b}/variants`, version: 1, value: { position: 0, data: { id: 'two', attachment: { fileId: 'unrelated-file' } } } },
  ]
  const blobs = [{ id: 'one-file', blob: new Blob(['one']) }, { id: 'unrelated-file', blob: new Blob(['other']) }]
  const calls: Array<{ store: string; action: string; key?: unknown }> = []
  let failRecords = false, closed = 0
  Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: { bound: (lower: string, upper: string, lowerOpen: boolean, upperOpen: boolean) => ({ lower, upper, lowerOpen, upperOpen }) } })
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => {
    const request: any = {}
    queueMicrotask(() => {
      request.result = {
        close: () => { closed++ },
        transaction: (_stores: string[], mode: string) => {
          assert.equal(mode, 'readonly')
          let pending = 0, aborted = false
          const tx: any = { abort: () => { aborted = true; queueMicrotask(() => tx.onabort?.()) } }
          const respond = (value: unknown, error?: Error) => {
            const req: any = {}; pending++
            queueMicrotask(() => {
              if (aborted) return
              if (error) { req.error = error; req.onerror?.(); aborted = true; queueMicrotask(() => tx.onabort?.()); return }
              req.result = structuredClone(value); req.onsuccess?.(); pending--
              setImmediate(() => { if (!pending && !aborted) tx.oncomplete?.() })
            })
            return req
          }
          tx.objectStore = (store: string) => ({
            getAll: (range?: { lower: string; upper: string }) => {
              calls.push({ store, action: 'getAll', key: range })
              if (store === 'records') return respond(range ? rows.filter(row => row.id >= range.lower && row.id < range.upper) : rows, failRecords ? new Error('read failed') : undefined)
              if (store === 'files') return respond(blobs)
              return respond([{ kind: 'legacy-verified', value: { id: a, sourceDigest: 'verified' } }])
            },
            getAllKeys: () => { calls.push({ store, action: 'getAllKeys' }); return respond(blobs.map(file => file.id)) },
            get: (id: string) => { calls.push({ store, action: 'get', key: id }); return respond(blobs.find(file => file.id === id)) },
          })
          return tx
        },
      }
      request.onsuccess?.()
    })
    return request
  } } })
  try {
    const scoped = await readPcsRecords([a, a])
    assert.deepEqual(scoped.records.map(row => row.id), rows.slice(0, 3).map(row => row.id))
    assert.deepEqual(scoped.files.map(file => file.id), ['one-file'])
    assert.equal(scoped.migrations[0].id, a)
    assert.deepEqual(calls.filter(call => call.store === 'records'), [{ store: 'records', action: 'getAll', key: { lower: `${a}/`, upper: `${a}0`, lowerOpen: false, upperOpen: true } }])
    assert.equal(calls.some(call => call.store === 'files' && call.action === 'getAll'), false)
    assert.equal(calls.some(call => call.store === 'files' && call.action === 'get' && call.key === 'unrelated-file'), false)
    calls.length = 0
    assert.equal((await readPcsRecords()).records.length, rows.length, 'unscoped migration/backup reads retain the complete database')
    assert.ok(calls.some(call => call.store === 'records' && call.action === 'getAll' && call.key === undefined))
    failRecords = true
    await assert.rejects(readPcsRecords([a]), /read failed/, 'a scoped read failure cannot become an empty successful collection')
    assert.equal(closed, 3)
  } finally {
    if (originalDb) Object.defineProperty(globalThis, 'indexedDB', originalDb); else Reflect.deleteProperty(globalThis, 'indexedDB')
    if (originalRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalRange); else Reflect.deleteProperty(globalThis, 'IDBKeyRange')
  }
})
