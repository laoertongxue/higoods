import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
type Snapshot = { revision: number; records: unknown[] }
// Run the actual hydrate/save/migration functions; substitute only repository/file boundaries.
function runtime() {
  const source = readFileSync(new URL('../../src/data/fcs/production-context-records.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('production-context-records.ts', source, ts.ScriptTarget.Latest, true)
  const names = ['hydrate', 'hydrateProductionContextRecords', 'saveProductionContextAction', 'migrateProductionContextRecords']
  const nodes = names.map(name => {
    const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(node, name)
    return node.getText(ast).replace(/^export\s+/, '')
  })
  const code = ts.transpileModule(nodes.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const read = deferred<Snapshot>(), calls = { reads: 0, writes: 0, notifications: 0 }
  const dependencies: Record<string, any> = {
    locked: false, pendingReadHydration: undefined, current: null, stage: null,
    preparedKeys: new Set(), materializedSampleRows: new Map(), sampleSerializationDirty: false,
    keys: ['source'], prefix: 'production-context:', serialized: new Map(), initializationRecords: [],
    listeners: new Map([['source', new Set([() => { calls.notifications++ }])]]),
    readCuttingRecords: () => { calls.reads++; return read.promise },
    commitCuttingRecords: () => { calls.writes++; throw new Error('read must not write') },
    assertLegacyReady: () => {}, materializeContextFiles: async (records: unknown[]) => records,
    encodeProductionContextRecords: (_key: string, records: unknown[]) => JSON.stringify(records),
    marker: () => ({ phase: 'COMPLETE' }),
  }
  const api = new Function('dependencies', `with (dependencies) { ${code};return { hydrateProductionContextRecords, saveProductionContextAction, migrateProductionContextRecords } }`)(dependencies) as {
    hydrateProductionContextRecords: (snapshot?: Snapshot) => Promise<void>
    saveProductionContextAction: (input: unknown) => Promise<unknown>
    migrateProductionContextRecords: (input: unknown) => Promise<number>
  }
  return { api, read, calls, dependencies }
}
const snapshot = (revision: number): Snapshot => ({ revision, records: [{ collection: 'production-context:orders', id: 'order-1', value: revision }] })

test('ordinary concurrent context reads return the same Promise, read once and publish the same snapshot without writes', async () => {
  const h = runtime(), first = h.api.hydrateProductionContextRecords(), second = h.api.hydrateProductionContextRecords()
  assert.strictEqual(first, second)
  assert.equal(h.calls.reads, 1); assert.equal(h.dependencies.locked, true)
  h.read.resolve(snapshot(7))
  await Promise.all([first, second])
  assert.equal(h.dependencies.current.revision, 7)
  assert.equal(h.calls.notifications, 1); assert.equal(h.calls.writes, 0)
  assert.equal(h.dependencies.locked, false); assert.equal(h.dependencies.pendingReadHydration, undefined)
})

test('a failed shared read rejects both callers, releases the in-flight read and permits an explicit retry', async () => {
  const h = runtime(), first = h.api.hydrateProductionContextRecords(), second = h.api.hydrateProductionContextRecords()
  const failure = new Error('repository read unavailable')
  const rejected = Promise.allSettled([first, second])
  h.read.reject(failure)
  const results = await rejected
  assert.ok(results.every(result => result.status === 'rejected' && result.reason === failure))
  assert.equal(h.dependencies.current, null); assert.equal(h.dependencies.locked, false)
  assert.equal(h.dependencies.pendingReadHydration, undefined)
  h.dependencies.readCuttingRecords = async () => { h.calls.reads++; return snapshot(8) }
  const retry = h.api.hydrateProductionContextRecords()
  assert.notStrictEqual(retry, first)
  await retry
  assert.equal(h.dependencies.current.revision, 8); assert.equal(h.calls.reads, 2); assert.equal(h.calls.writes, 0)
})

test('explicit snapshots never join an ordinary in-flight read or a different explicit snapshot', async () => {
  const h = runtime(), first = h.api.hydrateProductionContextRecords()
  await assert.rejects(h.api.hydrateProductionContextRecords(snapshot(99)), /保存或迁移/)
  h.read.resolve(snapshot(9)); await first
  assert.equal(h.dependencies.current.revision, 9)
  const explicit = h.api.hydrateProductionContextRecords(snapshot(10))
  const different = h.api.hydrateProductionContextRecords(snapshot(11)), ordinary = h.api.hydrateProductionContextRecords()
  await Promise.all([assert.rejects(different, /保存或迁移/), assert.rejects(ordinary, /保存或迁移/)])
  await explicit
  assert.equal(h.dependencies.current.revision, 10)
  await h.api.hydrateProductionContextRecords(snapshot(11))
  assert.equal(h.dependencies.current.revision, 11); assert.equal(h.calls.reads, 1); assert.equal(h.calls.writes, 0)
})

test('ordinary hydration still rejects during an actual save preparation lock and allows reading after failure', async () => {
  const h = runtime()
  const saving = h.api.saveProductionContextAction({ id: 'WRITE-1', intent: 'save', action: () => {}, capture: () => ({}), restore: () => {} })
  assert.equal(h.dependencies.locked, true); assert.equal(h.dependencies.pendingReadHydration, undefined)
  await assert.rejects(h.api.hydrateProductionContextRecords(), /保存或迁移/)
  const rejected = assert.rejects(saving, /save preparation failed/)
  h.read.reject(new Error('save preparation failed')); await rejected
  assert.equal(h.dependencies.locked, false)
  h.dependencies.readCuttingRecords = async () => snapshot(12)
  await h.api.hydrateProductionContextRecords()
  assert.equal(h.dependencies.current.revision, 12); assert.equal(h.calls.writes, 0)
})

test('ordinary hydration still rejects during an actual migration lock; no queue or write is introduced', async () => {
  const h = runtime()
  const migration = h.api.migrateProductionContextRecords({ otherPagesClosed: true, progress: () => {} })
  assert.equal(h.dependencies.locked, true); assert.equal(h.dependencies.pendingReadHydration, undefined)
  await assert.rejects(h.api.hydrateProductionContextRecords(), /保存或迁移/)
  const rejected = assert.rejects(migration, /migration read failed/)
  h.read.reject(new Error('migration read failed')); await rejected
  assert.equal(h.dependencies.locked, false); assert.equal(h.calls.reads, 1); assert.equal(h.calls.writes, 0)
})

test('save and migration remain refused while an ordinary read owns the existing lock', async () => {
  const h = runtime(), reading = h.api.hydrateProductionContextRecords()
  await assert.rejects(h.api.saveProductionContextAction({}), /尚未完成/)
  await assert.rejects(h.api.migrateProductionContextRecords({ otherPagesClosed: true }), /保存或迁移/)
  h.read.resolve(snapshot(13)); await reading
  assert.equal(h.calls.reads, 1); assert.equal(h.calls.writes, 0)
})
