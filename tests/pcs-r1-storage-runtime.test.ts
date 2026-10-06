import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { pcsFileReferences, type PcsCommitInput, type PcsStoredRecord, type PcsStoredFile, type PcsMigrationReceipt } from '../src/data/pcs-record-db.ts'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'

// Runtime contract test: database completion/failure is controlled here; actual
// IndexedDB transaction semantics remain covered by the existing browser suite.
test('PCS runtime reads, per-record commits, retained legacy sources and scoped errors', async t => {
  const saved = new Map<string, PcsStoredRecord>(), blobs = new Map<string, PcsStoredFile>(), migrations = new Map<string, PcsMigrationReceipt>()
  const calls: PcsCommitInput[] = [], receipts = new Map<string, string>(), legacy = new Map<string, string>()
  let recordReads = 0
  const readScopes: Array<readonly string[] | undefined> = []
  let failNext = false, waitForCommit: Promise<void> | undefined, finishCommit: (() => void) | undefined
  const fakeWindow = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => legacy.get(key) ?? null, setItem: (key: string, raw: string) => legacy.set(key, raw), removeItem: (key: string) => legacy.delete(key) } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  const key = 'higood-pcs-channel-catalog-v1', other = 'higood-pcs-channel-store-v1', material = 'higood-pcs-material-archive-store-v2'
  let api: typeof import('../src/data/pcs-record-runtime.ts')
  let initialized = false
  let finishBaseline!: () => void
  const baselineGate = new Promise<void>(resolve => { finishBaseline = resolve })
  const commit = async (input: PcsCommitInput) => {
      calls.push(structuredClone(input))
      if (waitForCommit) await waitForCommit
      if (failNext) { failNext = false; throw new Error('controlled commit failure') }
      if (receipts.has(input.operationId)) { assert.equal(receipts.get(input.operationId), input.intent); return }
      for (const row of [...input.puts, ...input.deletes]) if ((saved.get(row.id)?.version ?? 0) !== row.expectedVersion) throw new Error('record conflict')
      for (const { expectedVersion, ...row } of input.puts) saved.set(row.id, { ...row, version: expectedVersion + 1 })
      for (const row of input.deletes) saved.set(row.id, { id: row.id, collection: saved.get(row.id)?.collection ?? 'deleted', value: null, deleted: true, version: row.expectedVersion + 1 })
      input.files?.forEach(file => blobs.set(file.id, file)); input.migrationReceipts?.forEach(item => migrations.set(item.id, item)); receipts.set(input.operationId, input.intent)
    }
  mock.module(new URL('../src/data/pcs-record-db.ts', import.meta.url).href, { namedExports: {
    pcsFileReferences,
    readPcsRecords: async (collections?: readonly string[]) => {
      recordReads++; readScopes.push(collections)
      const records = [...saved.values()].filter(row => !collections?.length || collections.includes(row.id.split('/')[0]))
      const referenced = new Set(records.flatMap(row => row.deleted ? [] : [...pcsFileReferences(row.value)]))
      return { records: structuredClone(records), files: [...blobs.values()].filter(file => !collections?.length || referenced.has(file.id)), migrations: structuredClone([...migrations.values()]) }
    },
    readPcsFiles: async (ids: readonly string[]) => [...new Set(ids)].flatMap(id => blobs.has(id) ? [blobs.get(id)!] : []),
    commitPcsRecords: commit,
    commitPcsNewRecordGroups: async (inputs: PcsCommitInput[]) => Promise.all(inputs.map(async input => {
      try { await commit(input); return { ok: true as const } }
      catch (error) { return { ok: false as const, message: String(error) } }
    })),
  } })
  mock.module(new URL('../src/data/pcs-record-bootstrap.ts', import.meta.url).href, { namedExports: { initializePcsRecordBaseline: async () => {
    if (initialized) return
    await baselineGate
    api.withPcsDemoData(() => {
      api.pcsRecordStore.setItem(key, JSON.stringify({ version: 1, variants: [{ id: 'one', internalSkuId: 'sku', title: 'Original' }, { id: 'two', internalSkuId: 'sku', title: 'Untouched' }] }))
      api.pcsRecordStore.setItem(other, JSON.stringify({ version: 1, stores: [{ id: 'store', name: 'Current' }] }))
      api.pcsRecordStore.setItem(material, JSON.stringify({ version: 5, records: [{ materialId: 'static', name: 'Static root' }], skuRecords: [] }))
    }); initialized = true
  } } })
  mock.module(new URL('../src/data/fcs/design-revision-pcs-storage.ts', import.meta.url).href, { namedExports: {
    PCS_FCS_COLLECTIONS: [], configureDesignRevisionPcsStorage: () => {}, enumerateLegacySlices: () => [],
    captureDesignRevisionFcsCaches: () => [], restoreDesignRevisionFcsCaches: () => {}, hydrateDesignRevisionFcsCaches: () => {}, finalizeLegacySlices: () => {},
  } })
  api = await import('../src/data/pcs-record-runtime.ts')

  await t.test('scoped initialization defers unrelated records and never presents their seed as loaded user data', async () => {
    let visible = false
    const loading = api.ensurePcsRecordState([material]).then(() => { visible = true })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(recordReads, 1, 'saved records load alongside the static baseline')
    assert.equal(visible, false, 'a partial read cannot become a usable page')
    finishBaseline()
    await loading
    assert.deepEqual(readScopes, [[material]])
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records[0].name, 'Static root')
    assert.throws(() => api.pcsRecordStore.getItem(key), error => error instanceof Error && (error.cause as any)?.collection === key)
    await api.ensurePcsRecordState([material])
    assert.equal(recordReads, 1, 'repeat entry into the loaded collection performs no database read')
    await api.insertPcsRecordGroups(material, () => [])
    assert.equal(recordReads, 1, 'an import only prepares its own collection, never unrelated project or channel data')
    assert.equal(calls.length, 0)
  })
  await t.test('scoped command does not prepare unrelated collections and rejects out-of-scope writes atomically', async () => {
    const reads = recordReads
    assert.equal(await api.runPcsRecordCommand(() => 'no-change', 'scoped-read', [material]), 'no-change')
    assert.equal(recordReads, reads)
    await assert.rejects(api.runPcsRecordCommand(() => {
      api.pcsRecordStore.setItem(other, JSON.stringify({ version: 1, stores: [{ id: 'store', name: 'Unexpected write' }] }))
    }, 'scoped-outside', [material]), /未登记的资料范围/)
    assert.equal(calls.length, 0)
    assert.equal(saved.size, 0)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records[0].name, 'Static root')
    assert.throws(() => api.pcsRecordStore.getItem(other), /尚未读取/)
  })
  for (const [index, shouldFail] of [false, true].entries()) {
    await t.test(`scoped ${shouldFail ? 'rollback' : 'commit'} preserves another collection hydrated during the transaction`, async () => {
      const concurrent = index === 0 ? 'higood-pcs-material-config-v1' : 'higood-pcs-exchange-rate-config-v1'
      const persistedLabel = `Persisted concurrent ${index}`
      const rows = decodePcsRecordSnapshot(concurrent, JSON.stringify({ version: 1, label: persistedLabel }))
      rows.forEach(row => saved.set(row.id, { ...row, version: 1 }))
      const callCount = calls.length
      waitForCommit = new Promise(resolve => { finishCommit = resolve })
      const pending = api.runPcsRecordCommand(() => {
        const next = JSON.parse(api.pcsRecordStore.getItem(material)!)
        next.records[0].name = `Scoped material ${index}`
        api.pcsRecordStore.setItem(material, JSON.stringify(next))
      }, `concurrent-hydration-${index}`, [material])
      // Attach rejection handling before releasing the deliberately failing gate.
      const outcome = pending.then(() => null, error => error as Error)
      while (calls.length === callCount) await new Promise(resolve => setImmediate(resolve))
      await api.ensurePcsRecordState([concurrent])
      assert.equal(JSON.parse(api.pcsRecordStore.getItem(concurrent)!).label, persistedLabel)
      failNext = shouldFail
      finishCommit!()
      const error = await outcome
      waitForCommit = undefined
      assert.equal(error?.message ?? null, shouldFail ? 'controlled commit failure' : null)
      assert.equal(JSON.parse(api.pcsRecordStore.getItem(concurrent)!).label, persistedLabel)
      const reads = recordReads
      await api.ensurePcsRecordState([concurrent])
      assert.equal(recordReads, reads)
      assert.equal(JSON.parse(api.pcsRecordStore.getItem(concurrent)!).label, persistedLabel)
      saved.clear(); calls.length = 0
      await api.retryPcsRecordState()
    })
  }
  await t.test('group import preserves versions hydrated by another route while groups commit', async () => {
    const concurrent = 'higood-pcs-config-workspace-store-v1'
    const rows = decodePcsRecordSnapshot(concurrent, JSON.stringify({ version: 1, label: 'Persisted version three' }))
    rows.forEach(row => saved.set(row.id, { ...row, version: 3 }))
    const callCount = calls.length
    waitForCommit = new Promise(resolve => { finishCommit = resolve })
    const importing = api.insertPcsRecordGroups(material, () => [{ operationId: 'import-concurrent', result: 'concurrent-root', snapshot: { version: 5, records: [{ materialId: 'concurrent-root', name: 'Concurrent root' }], skuRecords: [] } }])
    while (calls.length === callCount) await new Promise(resolve => setImmediate(resolve))
    await api.ensurePcsRecordState([concurrent])
    finishCommit!()
    assert.deepEqual(await importing, [{ ok: true, result: 'concurrent-root' }])
    waitForCommit = undefined
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(concurrent)!)
      next.label = 'Edited after import'
      api.pcsRecordStore.setItem(concurrent, JSON.stringify(next))
    }, 'edit-after-concurrent-import', [concurrent])
    assert.equal(calls.at(-1)!.puts[0].expectedVersion, 3)
    assert.equal(saved.get(`${concurrent}/meta`)!.version, 4)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(concurrent)!).label, 'Edited after import')
    saved.clear(); calls.length = 0
    await api.retryPcsRecordState()
  })
  await t.test('initialization and repeated reads never copy static records', async () => {
    await api.ensurePcsRecordState(); await api.ensurePcsRecordState()
    assert.equal(readScopes[1]?.includes(material), false, 'full preparation incrementally loads the remaining collections')
    assert.equal(calls.length, 0); assert.equal(saved.size, 0)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants.length, 2)
  })
  await t.test('one changed record plus structure, with publication only after completion', async () => {
    const readsBefore = recordReads
    waitForCommit = new Promise(resolve => { finishCommit = resolve })
    const saving = api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(key)!); next.variants[0].title = 'Changed'
      api.pcsRecordStore.setItem(key, JSON.stringify(next)); return 'saved'
    }, 'change-one')
    while (!calls.length) await new Promise(resolve => setImmediate(resolve))
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants[0].title, 'Original')
    assert.deepEqual(calls[0].puts.map(row => row.id).sort(), [`${key}/meta`, `${key}/variants/one`])
    finishCommit!(); assert.equal(await saving, 'saved'); waitForCommit = undefined
    assert.equal(recordReads, readsBefore, 'ordinary save does not reread unrelated records for attachment preparation')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants[0].title, 'Changed')
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants[0].title, 'Changed')
  })
  await t.test('failure rolls memory back and preserves records for retry', async () => {
    const previous = structuredClone([...saved.values()]); failNext = true
    await assert.rejects(api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(key)!); next.variants[0].title = 'Failed'
      api.pcsRecordStore.setItem(key, JSON.stringify(next))
    }, 'failed'), /controlled commit failure/)
    assert.deepEqual([...saved.values()], previous)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants[0].title, 'Changed')
  })
  await t.test('a stale write uses the loaded version and cannot silently overwrite another tab', async () => {
    const id = `${key}/variants/one`, prior = saved.get(id)!
    saved.set(id, { ...prior, version: prior.version + 1, value: { position: 0, data: { id: 'one', internalSkuId: 'sku', title: 'Other tab' } } })
    await assert.rejects(api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(key)!); next.variants[0].title = 'Stale input'
      api.pcsRecordStore.setItem(key, JSON.stringify(next))
    }, 'stale-edit'), /record conflict/)
    assert.equal((saved.get(id)!.value as any).data.title, 'Other tab')
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants[0].title, 'Other tab')
  })
  await t.test('unavailable localStorage does not block IndexedDB record writes', async () => {
    const original = fakeWindow.localStorage.getItem
    fakeWindow.localStorage.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    try {
      await api.retryPcsRecordState()
      await api.runPcsRecordCommand(() => {
        const next = JSON.parse(api.pcsRecordStore.getItem(other)!); next.stores[0].name = 'No localStorage'
        api.pcsRecordStore.setItem(other, JSON.stringify(next))
      }, 'no-localStorage')
      assert.equal(JSON.parse(api.pcsRecordStore.getItem(other)!).stores[0].name, 'No localStorage')
    } finally { fakeWindow.localStorage.getItem = original }
  })
  await t.test('legacy read is read-only; save upgrades only its collection and retains the source', async () => {
    const raw = JSON.stringify({ version: 2, records: [{ materialId: 'custom', name: 'Old value' }], skuRecords: [] })
    legacy.set(material, raw); const count = calls.length
    await api.retryPcsRecordState()
    assert.equal(calls.length, count)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records[0].name, 'Old value')
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(material)!); next.records[0].name = 'New value'; api.pcsRecordStore.setItem(material, JSON.stringify(next))
    }, 'legacy-edit')
    assert.equal(legacy.get(material), raw); assert.ok(migrations.has(material))
    assert.ok(calls.slice(count).flatMap(call => [...call.puts, ...call.deletes]).every(row => row.id.startsWith(`${material}/`)))
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records[0].name, 'New value')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records.length, 1)
  })
  await t.test('new writes from an old page do not overwrite IDB or block unrelated collections', async () => {
    legacy.set(material, JSON.stringify({ records: [{ materialId: 'custom', name: 'Stale page' }], skuRecords: [] }))
    const count = calls.length; await api.retryPcsRecordState(); assert.equal(calls.length, count)
    assert.throws(() => api.pcsRecordStore.getItem(material), /旧版本页面/)
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(other)!); next.stores[0].name = 'Other saved'; api.pcsRecordStore.setItem(other, JSON.stringify(next))
    }, 'unrelated')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(other)!).stores[0].name, 'Other saved')
  })
  await t.test('missing attachment is scoped; untouched collection can still be read', async () => {
    saved.set(`${key}/variants/one`, { id: `${key}/variants/one`, collection: `${key}/variants`, value: { position: 0, data: { id: 'one', image: 'pcs-file:missing' } }, version: 2 })
    await api.retryPcsRecordState()
    assert.throws(() => api.pcsRecordStore.getItem(key), /附件文件缺失/)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(other)!).stores[0].name, 'Other saved')
    assert.equal(saved.get(`${key}/variants/one`)?.version, 2)
  })
  await t.test('a fileId-only attachment is persisted once and can be shared by another record', async () => {
    const file = api.registerPcsFile(new Blob(['shared bytes']), 'shared-file')
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(other)!); next.stores[0].attachment = { fileId: file.fileId, status: '待保存' }
      // Spaced JSON must receive the same durable status as compact snapshots.
      api.pcsRecordStore.setItem(other, JSON.stringify(next, null, 2))
    }, 'attach-file')
    assert.equal(blobs.size, 1)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(other)!).stores[0].attachment.status, '已保存')
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(other)!); next.stores.push({ id: 'copy', name: 'Copy', attachment: { fileId: file.fileId } })
      api.pcsRecordStore.setItem(other, JSON.stringify(next))
    }, 'copy-reference')
    assert.equal(blobs.size, 1); assert.equal(calls.at(-1)!.files!.length, 0)
    assert.equal(api.releasePcsPendingFile(file.fileId), false)
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(other)!).stores[1].attachment.fileId, 'shared-file')
    const count = calls.length
    assert.equal(api.getPcsDurableFileReference(file.url), 'pcs-file:shared-file')
    assert.equal(api.resolvePcsFileReference('pcs-file:shared-file'), file.url)
    assert.equal(api.resolvePcsFileReference('/materials/static.jpg'), '/materials/static.jpg')
    assert.throws(() => api.getPcsDurableFileReference('blob:unknown-session'), /未登记/)
    assert.throws(() => api.resolvePcsFileReference('pcs-file:no-file'), /不存在/)
    assert.throws(() => api.resolvePcsFileReference('data:image/png;base64,AA'), /已保存的文件引用/)
    assert.equal(calls.length, count)
  })
  await t.test('cancelled uploads stay out of persistent storage and release their URL', () => {
    const original = api.pcsRecordStore.getItem(other)!
    // A retained inline image elsewhere is not a reference to this pending file.
    api.withPcsDemoData(() => api.pcsRecordStore.setItem(other, JSON.stringify({ stores: [{ id: 'legacy-image', image: 'data:image/png;base64,AABB' }] })))
    const file = api.registerPcsFile(new Blob(['cancelled']), 'cancelled')
    assert.ok(file.url.startsWith('blob:')); assert.equal(blobs.has('cancelled'), false)
    assert.equal(api.releasePcsPendingFile('cancelled'), true)
    assert.throws(() => pcsFileReferences({ image: 'data:image/png;base64,AABB' }), /Base64/)
    api.withPcsDemoData(() => api.pcsRecordStore.setItem(other, original))
  })
  await t.test('legacy-only file references load on demand; a later missing Blob cannot reuse stale memory', async () => {
    const uploads = 'higood-pcs-engineering-task-uploads-v1'
    legacy.set(uploads, JSON.stringify([{ id: 'legacy-upload', fileId: 'legacy-only-file' }]))
    blobs.set('legacy-only-file', { id: 'legacy-only-file', blob: new Blob(['retained legacy bytes']) })
    const count = calls.length
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(uploads)!)[0].fileId, 'legacy-only-file')
    assert.ok(api.resolvePcsFileReference('pcs-file:legacy-only-file').startsWith('blob:'))
    assert.equal(calls.length, count)
    blobs.delete('legacy-only-file')
    await api.retryPcsRecordState()
    assert.throws(() => api.pcsRecordStore.getItem(uploads), /附件文件缺失/)
    assert.equal(calls.length, count)
  })
  await t.test('new static version IDs appear over an old whole snapshot without resurrecting old omissions or saved deletions', async () => {
    saved.clear(); migrations.clear(); receipts.clear(); legacy.clear(); blobs.clear()
    const styles = 'higood-pcs-style-archive-store-v3', skus = 'higood-pcs-sku-archive-store-v1'
    const newStyles = ['style_r1_wms_tee', 'style_r1_physical_set', 'style_r1_virtual_bundle']
    api.withPcsDemoData(() => {
      api.pcsRecordStore.setItem(styles, JSON.stringify({ version: 3, records: [{ styleId: 'old-kept', name: 'Static original' }, { styleId: 'old-removed', name: 'Previously deleted' }, ...newStyles.map(styleId => ({ styleId, name: 'New static' }))], pendingItems: [] }))
      api.pcsRecordStore.setItem(skus, JSON.stringify({ version: 1, records: [
        { skuId: 'sku_r1_wms_tee_black_s', styleId: newStyles[0] }, { skuId: 'sku_r1_tee_white_m', styleId: newStyles[0] },
        { skuId: 'sku_r1_physical_set_m', styleId: newStyles[1] }, { skuId: 'sku_r1_virtual_bundle_m', styleId: newStyles[2] },
      ] }))
    })
    legacy.set(styles, JSON.stringify({ version: 3, records: [{ styleId: 'old-kept', name: 'Historical edit' }], pendingItems: [] }))
    legacy.set(skus, JSON.stringify({ version: 1, records: [] }))
    saved.set(`${styles}/records/${newStyles[1]}`, { id: `${styles}/records/${newStyles[1]}`, collection: `${styles}/records`, version: 2, value: { position: 3, data: { styleId: newStyles[1], name: 'User override' } } })
    saved.set(`${styles}/records/${newStyles[2]}`, { id: `${styles}/records/${newStyles[2]}`, collection: `${styles}/records`, version: 2, deleted: true, value: null })
    const count = calls.length
    await api.retryPcsRecordState()
    assert.equal(calls.length, count)
    let view = JSON.parse(api.pcsRecordStore.getItem(styles)!)
    assert.deepEqual(view.records.map((row: any) => row.styleId), ['old-kept', newStyles[0], newStyles[1]])
    assert.equal(view.records[0].name, 'Historical edit'); assert.equal(view.records[2].name, 'User override')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(skus)!).records.length, 4)
    await api.runPcsRecordCommand(() => {
      view.records[0].name = 'Saved edit'; api.pcsRecordStore.setItem(styles, JSON.stringify(view))
    }, 'edit-old-with-new-static-version')
    assert.equal(saved.has(`${styles}/records/${newStyles[0]}`), false)
    assert.equal(saved.has(`${skus}/records/sku_r1_wms_tee_black_s`), false)
    assert.equal(saved.get(`${styles}/records/old-removed`)?.deleted, true)
    assert.equal(saved.get(`${styles}/records/${newStyles[2]}`)?.version, 2)
    await api.retryPcsRecordState()
    view = JSON.parse(api.pcsRecordStore.getItem(styles)!)
    assert.equal(view.records.length, 3); assert.equal(view.records[0].name, 'Saved edit')
    assert.equal(view.records[2].name, 'User override')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(skus)!).records.length, 4)
  })
  await t.test('legacy channel instances bridge to canonical records without copying unchanged demo rows', async () => {
    // Reset this test double only; no actual browser database is used by this suite.
    saved.clear(); migrations.clear(); receipts.clear(); legacy.clear(); blobs.clear()
    const oldKey = 'higood-pcs-project-channel-product-store-v2'
    const old = { version: 2, records: [{ channelProductId: 'historical-listing', channelProductCode: 'OLD-1', storeId: 'store', channelCode: 'tiktok', skuId: 'sku', styleId: 'style', upstreamProductId: 'pid-12', listingTitle: '原渠道标题', listingPrice: 120000, specLines: [{ specLineId: 'variant-1', internalSkuId: 'sku', upstreamSkuId: 'external-1', priceAmount: 120000 }, { specLineId: 'variant-2', internalSkuId: 'sku', upstreamSkuId: 'external-2', priceAmount: 130000 }] }] }
    api.withPcsDemoData(() => {
      api.pcsRecordStore.setItem(key, JSON.stringify({ version: 1, listings: [{ id: 'static-listing', sourceIdentity: 'static' }], variants: [], prices: [], logs: [], syncOperations: [], fieldBaselines: [], orderReferences: [] }))
      api.pcsRecordStore.setItem(other, JSON.stringify({ version: 1, stores: [{ id: 'store', storeName: 'Current', channelCode: 'tiktok', marketCode: 'ID', salesCurrency: 'IDR', legacyAliases: [] }], logs: [] }))
      api.pcsRecordStore.setItem('higood-pcs-style-archive-store-v3', JSON.stringify({ records: [{ styleId: 'style', styleCode: 'SPU', styleName: 'Style' }] }))
      api.pcsRecordStore.setItem('higood-pcs-sku-archive-store-v1', JSON.stringify({ records: [{ skuId: 'sku', skuCode: 'SKU', styleId: 'style' }] }))
      api.pcsRecordStore.setItem(oldKey, JSON.stringify({ version: 2, records: [] }))
    })
    const raw = JSON.stringify(old); legacy.set(oldKey, raw)
    const count = calls.length; await api.retryPcsRecordState()
    assert.equal(calls.length, count)
    const view = JSON.parse(api.pcsRecordStore.getItem(key)!)
    assert.equal(view.variants.length, 2); assert.ok(view.variants.every((row: any) => row.internalSkuId === 'sku'))
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(key)!); next.listings.find((row: any) => row.id === 'historical-listing').content.title = '新渠道标题'; api.pcsRecordStore.setItem(key, JSON.stringify(next))
    }, 'canonical-channel-update')
    assert.equal(legacy.get(oldKey), raw)
    assert.equal(saved.has(`${key}/listings/static-listing`), false)
    assert.equal(saved.has(`${other}/stores/store`), false)
    assert.ok(migrations.has(key)); assert.ok(migrations.has(other))
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).listings.find((row: any) => row.id === 'historical-listing').content.title, '新渠道标题')
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants.length, 2)

    // The same converter can read a previous record-based collection, with the
    // old collection retained and its source checked again before each upgrade.
    saved.clear(); migrations.clear(); receipts.clear(); legacy.clear()
    for (const row of decodePcsRecordSnapshot(oldKey, raw)) saved.set(row.id, { ...row, version: 1 })
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).variants.length, 2)
    await api.runPcsRecordCommand(() => {
      const next = JSON.parse(api.pcsRecordStore.getItem(key)!); next.listings.find((row: any) => row.id === 'historical-listing').content.title = 'IDB 源已承接'; api.pcsRecordStore.setItem(key, JSON.stringify(next))
    }, 'canonical-idb-channel-update')
    await api.retryPcsRecordState()
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(key)!).listings.find((row: any) => row.id === 'historical-listing').content.title, 'IDB 源已承接')
    assert.ok(saved.has(`${oldKey}/meta`))
  })
  await t.test('independent import groups publish only completed parents and children, without copying existing roots', async () => {
    saved.clear(); migrations.clear(); receipts.clear(); legacy.clear(); blobs.clear()
    await api.retryPcsRecordState()
    const beforeCalls = calls.length
    waitForCommit = new Promise(resolve => { finishCommit = resolve })
    failNext = true
    const pending = api.insertPcsRecordGroups(material, () => ['A', 'B', 'C'].map(id => ({
      operationId: `import-new-${id}`, result: id,
      snapshot: { version: 5, records: [{ materialId: `import-${id}`, name: id }], skuRecords: [{ materialSkuId: `sku-${id}`, materialId: `import-${id}` }] },
    })))
    while (calls.length < beforeCalls + 3) await new Promise(resolve => setImmediate(resolve))
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records.length, 1, 'pending changes are not published')
    finishCommit!()
    const outcomes = await pending; waitForCommit = undefined
    assert.deepEqual(outcomes.map(row => row.ok), [false, true, true])
    const current = JSON.parse(api.pcsRecordStore.getItem(material)!)
    assert.deepEqual(current.records.map((row: any) => row.materialId), ['import-C', 'import-B', 'static'])
    assert.equal(current.skuRecords.length, 2)
    assert.equal(saved.has(`${material}/records/import-A`), false)
    assert.equal(saved.has(`${material}/skuRecords/sku-A`), false)
    assert.equal(saved.has(`${material}/records/static`), false)
    assert.ok(calls.slice(beforeCalls).every(call => call.puts.length === 2 && call.deletes.length === 0))
    await api.retryPcsRecordState()
    assert.deepEqual(JSON.parse(api.pcsRecordStore.getItem(material)!).records, current.records)
    const retried = await api.insertPcsRecordGroups(material, () => [{ operationId: 'import-new-A', result: 'A', snapshot: { version: 5, records: [{ materialId: 'import-A', name: 'A' }], skuRecords: [{ materialSkuId: 'sku-A', materialId: 'import-A' }] } }])
    assert.equal(retried[0].ok, true)
    assert.equal(JSON.parse(api.pcsRecordStore.getItem(material)!).records.length, 4)
  })
  fakeWindow.dispatchEvent(new Event('pagehide'))
})
