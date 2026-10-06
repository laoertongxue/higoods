import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { pcsFileReferences, type PcsCommitInput, type PcsStoredRecord } from '../src/data/pcs-record-db.ts'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'

// Use the real FCS storage bridge and staged-storage hook. Only database
// completion and the published baseline are controlled; no browser data is used.
test('PCS scoped commands preserve freshly read FCS caches and own-action rollback', async t => {
  const material = 'higood-pcs-material-archive-store-v2'
  const fcs = 'higood-pcs-fcs-design-revision-dye-v1'
  const nativeKey = 'higoods.formal-dye-execution.v1'
  const saved = new Map<string, PcsStoredRecord>()
  const commits: PcsCommitInput[] = []
  const localStorage = { getItem: () => null, setItem: () => assert.fail('unexpected legacy write'), removeItem: () => assert.fail('unexpected legacy removal') }
  const fakeWindow = Object.assign(new EventTarget(), { localStorage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })

  let api: typeof import('../src/data/pcs-record-runtime.ts')
  let controlled: { operationId: string; wait: Promise<void>; entered(): void; fail: boolean } | undefined
  mock.module(new URL('../src/data/pcs-record-db.ts', import.meta.url).href, { namedExports: {
    pcsFileReferences,
    readPcsRecords: async (scope?: readonly string[]) => ({
      records: structuredClone([...saved.values()].filter(row => !scope?.length || scope.includes(row.id.split('/')[0]))), files: [], migrations: [],
    }),
    readPcsFiles: async () => [],
    commitPcsRecords: async (input: PcsCommitInput) => {
      commits.push(structuredClone(input))
      if (controlled?.operationId === input.operationId) {
        const gate = controlled
        gate.entered(); await gate.wait
        if (gate.fail) throw new Error('controlled commit failure')
      }
      for (const row of [...input.puts, ...input.deletes]) assert.equal(saved.get(row.id)?.version ?? 0, row.expectedVersion, 'record version remains current')
      for (const { expectedVersion, ...row } of input.puts) saved.set(row.id, { ...row, version: expectedVersion + 1 })
      for (const row of input.deletes) saved.set(row.id, { id: row.id, collection: saved.get(row.id)?.collection ?? 'deleted', version: row.expectedVersion + 1, value: null, deleted: true })
    },
    commitPcsNewRecordGroups: async () => assert.fail('not an import test'),
  } })
  mock.module(new URL('../src/data/pcs-record-bootstrap.ts', import.meta.url).href, { namedExports: {
    initializePcsRecordBaseline: async () => api.withPcsDemoData(() => api.pcsRecordStore.setItem(material, JSON.stringify({ version: 2, records: [{ materialId: 'material', name: 'Original material' }], skuRecords: [] }))),
  } })
  api = await import('../src/data/pcs-record-runtime.ts')
  const bridge = await import('../src/data/fcs/design-revision-pcs-storage.ts')
  const storage = bridge.getDesignRevisionFcsStorage()
  const document = () => JSON.parse(storage.getItem(nativeKey)!) as { state: { workOrders: Array<[string, { status: string; note?: string }]> } }
  const readStatus = () => document().state.workOrders[0][1].status
  const stageStatus = (status: string) => {
    const next = document(); next.state.workOrders[0][1].status = status
    storage.setItem(nativeKey, JSON.stringify(next))
  }
  const persistedOrder = () => [...saved.values()].find(row => row.id.startsWith(`${fcs}/items/`))!
  const seed = () => {
    saved.clear()
    const row = { id: 'state.workOrders/dye-1', path: 'state.workOrders', key: 'dye-1', tuple: true, value: { id: 'dye-1', taskId: 'task-1', sourceType: 'DESIGN_REVISION', status: 'initial' } }
    decodePcsRecordSnapshot(fcs, JSON.stringify([row])).forEach(value => saved.set(value.id, { ...value, version: 1 }))
  }
  const gateCommit = (operationId: string, fail: boolean) => {
    let release!: () => void, entered!: () => void
    const reached = new Promise<void>(resolve => { entered = resolve })
    const wait = new Promise<void>(resolve => { release = resolve })
    controlled = { operationId, wait, entered, fail }
    return { reached, release }
  }
  seed()
  await api.ensurePcsRecordState([material, fcs])

  for (const fail of [false, true]) {
    await t.test(`unrelated material ${fail ? 'rollback' : 'commit'} preserves FCS reloaded while saving`, async () => {
      seed(); await api.retryPcsRecordState()
      await api.runPcsRecordCommand(() => stageStatus('previously-saved'), `seed-staged-${fail}`, [fcs])
      const operationId = `material-${fail}`, gate = gateCommit(operationId, fail)
      const pending = api.runPcsRecordCommand(() => {
        const next = JSON.parse(api.pcsRecordStore.getItem(material)!)
        next.records[0].name = 'Edited material'
        api.pcsRecordStore.setItem(material, JSON.stringify(next))
      }, operationId, [material])
      const outcome = pending.then(() => null, error => error as Error)
      await gate.reached
      const row = persistedOrder()
      row.version++
      ;(row.value as { data: { value: { status: string } } }).data.value.status = 'freshly-reloaded'
      await api.retryPcsRecordState()
      assert.equal(readStatus(), 'freshly-reloaded')
      gate.release()
      const error = await outcome
      controlled = undefined
      assert.equal(error?.message ?? null, fail ? 'controlled commit failure' : null)
      assert.equal(readStatus(), 'freshly-reloaded')
      assert.equal(await api.runPcsRecordCommand(readStatus, `read-fcs-after-${fail}`, [fcs]), 'freshly-reloaded', 'a later FCS action must not resurrect the old staged document')
      // A later real edit must preserve the freshly read status and its version.
      await api.runPcsRecordCommand(() => {
        const next = document(); next.state.workOrders[0][1].note = 'Later FCS edit'
        storage.setItem(nativeKey, JSON.stringify(next))
      }, `edit-fcs-after-${fail}`, [fcs])
      assert.equal((persistedOrder().value as { data: { value: { status: string } } }).data.value.status, 'freshly-reloaded')
    })
  }

  for (const fail of [false, true]) {
    await t.test(`FCS own ${fail ? 'failed save restores' : 'completed save publishes'} its staged document`, async () => {
      seed(); await api.retryPcsRecordState()
      await api.runPcsRecordCommand(() => stageStatus('saved-before'), `fcs-before-${fail}`, [fcs])
      const operationId = `fcs-own-${fail}`, gate = gateCommit(operationId, fail)
      const pending = api.runPcsRecordCommand(() => stageStatus('pending-change'), operationId, [fcs])
      const outcome = pending.then(() => null, error => error as Error)
      await gate.reached
      assert.equal(readStatus(), 'saved-before', 'uncommitted FCS values remain private')
      gate.release(); const error = await outcome; controlled = undefined
      assert.equal(error?.message ?? null, fail ? 'controlled commit failure' : null)
      const expected = fail ? 'saved-before' : 'pending-change'
      assert.equal(readStatus(), expected)
      assert.equal(await api.runPcsRecordCommand(readStatus, `fcs-read-own-${fail}`, [fcs]), expected)
    })
  }
  await t.test('a rejected out-of-scope FCS write restores its pre-command cache', async () => {
    seed(); await api.retryPcsRecordState()
    const count = commits.length
    await assert.rejects(api.runPcsRecordCommand(() => stageStatus('out-of-scope'), 'out-of-scope-fcs', [material]), /未登记的资料范围/)
    assert.equal(commits.length, count)
    assert.equal(readStatus(), 'initial')
    assert.equal(await api.runPcsRecordCommand(readStatus, 'fcs-read-after-scope-error', [fcs]), 'initial')
  })
  fakeWindow.dispatchEvent(new Event('pagehide'))
})
