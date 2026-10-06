import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { pcsFileReferences, type PcsStoredRecord } from '../src/data/pcs-record-db.ts'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'

test('material cold read preserves isolation, readonly initialization, staged diff and failed-command rollback', async () => {
  const key = 'higood-pcs-material-archive-store-v2'
  const raw = JSON.stringify({ version: 5, records: [{ materialId: 'root', name: 'saved' }], skuRecords: [], assets: [] })
  let rows: PcsStoredRecord[] = decodePcsRecordSnapshot(key, raw).map(row => ({ ...row, version: 1 }))
  let commits = 0, fail = false
  const storage = { getItem: () => null, setItem: () => assert.fail('unexpected legacy write'), removeItem: () => assert.fail('unexpected deletion') }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: storage }) })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  mock.module(new URL('../src/data/pcs-record-db.ts', import.meta.url).href, { namedExports: {
    pcsFileReferences, readPcsRecords: async () => ({ records: structuredClone(rows), files: [], migrations: [] }), readPcsFiles: async () => [],
    commitPcsRecords: async (input: { puts: Array<Omit<PcsStoredRecord, 'version'> & { expectedVersion: number }>; deletes: unknown[] }) => {
      commits++
      assert.equal(input.puts.length, 1, 'unchanged records must not be rewritten')
      assert.equal(input.puts[0].expectedVersion, 1)
      assert.equal((input.puts[0].value as any).data.name, 'changed')
      assert.equal(input.deletes.length, 0)
      if (fail) throw new Error('injected transaction abort')
      rows = rows.map(row => row.id === input.puts[0].id ? { ...input.puts[0], version: 2 } : row)
    },
    commitPcsNewRecordGroups: async () => assert.fail('not an import'),
  } })
  let api: typeof import('../src/data/pcs-record-runtime.ts')
  mock.module(new URL('../src/data/pcs-record-bootstrap.ts', import.meta.url).href, { namedExports: {
    initializePcsRecordBaseline: async () => api.withPcsDemoData(() => api.pcsRecordStore.setItem(key, raw)),
  } })
  api = await import('../src/data/pcs-record-runtime.ts')
  await api.ensurePcsRecordState([key])
  const view = api.readPcsMaterialSnapshot()!
  assert.ok(view)
  const copy = () => view.project(value => structuredClone(value)) as any
  const copied = copy()
  copied.records[0].name = 'must stay private'
  assert.equal(copy().records[0].name, 'saved')
  assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).records[0].name, 'saved')
  assert.equal(commits, 0)
  const change = () => {
    const snapshot = JSON.parse(api.pcsRecordStore.getItem(key)!)
    snapshot.records[0].name = 'changed'
    api.pcsRecordStore.setItem(key, JSON.stringify(snapshot))
  }
  fail = true
  await assert.rejects(api.runPcsRecordCommand(change, 'failed', [key]), /transaction abort/)
  assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).records[0].name, 'saved')
  assert.equal((rows[1].value as any).data.name, 'saved')
  fail = false
  await api.runPcsRecordCommand(change, 'saved', [key])
  await api.retryPcsRecordState()
  assert.equal((api.readPcsMaterialSnapshot()!.project(value => structuredClone(value)) as any).records[0].name, 'changed')
  assert.equal(commits, 2)
})
