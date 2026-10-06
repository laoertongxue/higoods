import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { pcsFileReferences, type PcsStoredRecord } from '../src/data/pcs-record-db.ts'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'

test('identified old-demo omissions project new review examples without writes; later and unrelated deletions stay deleted', async () => {
  const key = 'higood-pcs-technical-data-version-store-v5'
  const rowId = `${key}/records/tdv_demand_SPU_QC_001`
  const sourceDigest = '05d0a7a093ba8cff7006d673107c188f0db15502b2d1575331418bea507971a6'
  const staticRaw = JSON.stringify({ version: 5, records: [{ technicalVersionId: 'tdv_demand_SPU_QC_001', technicalVersionCode: '22' }], contents: [], pendingItems: [] })
  let rows: PcsStoredRecord[] = [{ id: rowId, collection: 'deleted', version: 1, deleted: true, value: null }]
  let receipt = { id: key, sourceDigest, legacyDigest: sourceDigest, legacyKey: key, recordIds: [`${key}/meta`], completedAt: '2026-10-06T03:55:52.054Z' }
  const storage = { getItem: () => null, setItem: () => assert.fail('unexpected legacy write'), removeItem: () => assert.fail('unexpected deletion') }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: storage }) })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  mock.module(new URL('../src/data/pcs-record-db.ts', import.meta.url).href, { namedExports: {
    pcsFileReferences, readPcsRecords: async () => ({ records: structuredClone(rows), files: [], migrations: [receipt] }), readPcsFiles: async () => [],
    commitPcsRecords: async () => assert.fail('ordinary read must not write'), commitPcsNewRecordGroups: async () => assert.fail('not an import'),
  } })
  let api: typeof import('../src/data/pcs-record-runtime.ts')
  mock.module(new URL('../src/data/pcs-record-bootstrap.ts', import.meta.url).href, { namedExports: {
    initializePcsRecordBaseline: async () => api.withPcsDemoData(() => api.pcsRecordStore.setItem(key, staticRaw)),
  } })
  api = await import('../src/data/pcs-record-runtime.ts')
  rows.unshift({ ...decodePcsRecordSnapshot(key, staticRaw)[0], version: 1 })
  await api.ensurePcsRecordState([key])
  assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).records.length, 1)
  assert.equal(api.getPcsDeletedRecordIds(key).size, 0)
  assert.equal(rows[1].deleted, true, 'read-only projection preserves the actual stored marker')
  rows[1].version = 2
  await api.retryPcsRecordState()
  assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).records.length, 0)
  assert.ok(api.getPcsDeletedRecordIds(key).has(rowId))
  rows[1].version = 1; receipt = { ...receipt, sourceDigest: 'different-source' }
  await api.retryPcsRecordState()
  assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).records.length, 0)
})
