import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from '@playwright/test'

const base = process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'

test('后道原生读取：后登记关联集合沿用同版本已读资料、原Blob与删除标记，新版本重新完整读取', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext(), page = await context.newPage()
  try {
    await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await page.route('**/__quality-late-repository-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh"><body></body></html>' }))
    await page.goto(base + '/__quality-late-repository-contract')
    const result = await page.evaluate(async () => {
      const storage = await import('/src/data/fcs/post-finishing-records.ts')
      const pcs = await import('/src/data/pcs-record-db.ts')
      const ns = 'higood-fcs-post-finishing-records', revisionId = `${ns}/revision`
      let early: any = { record: { marker: 'static-early' } }, late: any = { record: { marker: 'static-late' }, obsolete: { count: 9 } }
      let additional: any = { record: { labels: [] } }
      storage.registerPostFinishingRepository('probe-early', 'quality-contract-early', () => early, value => { early = value })
      const initialBlob = new Blob(['original shared late-repository attachment'], { type: 'text/plain' })
      const labels = Object.assign(['原值'], { originalMetadata: { owner: 'native-original', quantity: 7 } })
      await pcs.commitPcsRecords({ puts: [
        { id: revisionId, collection: 'revision', value: 1, expectedVersion: 0 },
        { id: `${ns}/probe-early/record/value`, collection: 'probe-early/record', value: { marker: 'native-early' }, expectedVersion: 0 },
        { id: `${ns}/probe-late/record/value`, collection: 'probe-late/record', value: { marker: 'native-late', photo: 'pcs-file:late-original' }, expectedVersion: 0 },
        { id: `${ns}/probe-late/obsolete/value`, collection: 'deleted', value: null, deleted: true, expectedVersion: 0 },
        { id: `${ns}/probe-additional/record/value`, collection: 'probe-additional/record', value: { labels }, expectedVersion: 0 },
      ], deletes: [], files: [{ id: 'late-original', blob: initialBlob }], operationId: 'LATE-READ-SEED', intent: '隔离初始完整集合，后登记集合已存原始文件及删除标记' })
      const originalGetAll = IDBObjectStore.prototype.getAll, originalTransaction = IDBDatabase.prototype.transaction
      let recordReads = 0, writes = 0
      IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
        if (this.transaction.db.name === 'higood-pcs-records' && this.name === 'records') recordReads++
        return originalGetAll.apply(this, args)
      }
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) {
        const tx = originalTransaction.apply(this, args); if (tx.mode === 'readwrite') writes++; return tx
      }
      try {
        await storage.ensurePostFinishingRecordState()
        const earlyIdentity = early.record, before = { recordReads, writes }
        storage.registerPostFinishingRepository('probe-late', 'quality-contract-late', () => late, value => { late = value })
        storage.registerPostFinishingRepository('probe-additional', 'quality-contract-additional', () => additional, value => { additional = value })
        await storage.ensurePostFinishingRecordState()
        if (storage.getPostFinishingStorageFailure()) throw Error(storage.getPostFinishingStorageFailure())
        const sameRevision = { recordReads: recordReads - before.recordReads, writes: writes - before.writes, existingIdentityKept: early.record === earlyIdentity, lateMarker: late.record.marker, obsoleteAbsent: late.obsolete === undefined, originalBlobText: await (await fetch(late.record.photo)).text(), additionalMetadata: additional.record.labels.originalMetadata }
        await pcs.commitPcsRecords({ puts: [
          { id: revisionId, collection: 'revision', value: 2, expectedVersion: 1 },
          { id: `${ns}/probe-early/record/value`, collection: 'probe-early/record', value: { marker: 'new-native-early' }, expectedVersion: 1 },
        ], deletes: [], operationId: 'LATE-READ-OTHER-TAB', intent: '隔离另一个标签已提交的新版本必须读取' })
        const changedBefore = { recordReads, writes }
        await storage.ensurePostFinishingRecordState()
        const changedRevision = { recordReads: recordReads - changedBefore.recordReads, writes: writes - changedBefore.writes, marker: early.record.marker, lateMarker: late.record.marker, originalBlobText: await (await fetch(late.record.photo)).text() }
        let rejected = ''
        try {
          await storage.runPostFinishingCommand(() => { early.record.marker = 'FAILED-UNCOMMITTED-CANDIDATE'; throw Error('隔离故意失败，候选不应提交') })
        } catch (error) { rejected = String(error) }
        const restoredMarker = early.record.marker
        let replacement: any = { record: { marker: 'replacement-static' } }
        const replacementBefore = { recordReads, writes }
        storage.registerPostFinishingRepository('probe-early', 'quality-contract-early', () => replacement, value => { replacement = value })
        await storage.ensurePostFinishingRecordState()
        return { sameRevision, changedRevision, replacementAfterFailure: { rejected, restoredMarker, marker: replacement.record.marker, recordReads: recordReads - replacementBefore.recordReads, writes: writes - replacementBefore.writes }, failure: storage.getPostFinishingStorageFailure() }
      } finally { IDBObjectStore.prototype.getAll = originalGetAll; IDBDatabase.prototype.transaction = originalTransaction }
    })
    assert.deepEqual(result.sameRevision, { recordReads: 0, writes: 0, existingIdentityKept: true, lateMarker: 'native-late', obsoleteAbsent: true, originalBlobText: 'original shared late-repository attachment', additionalMetadata: { owner: 'native-original', quantity: 7 } })
    assert.deepEqual(result.changedRevision, { recordReads: 1, writes: 0, marker: 'new-native-early', lateMarker: 'native-late', originalBlobText: 'original shared late-repository attachment' })
    assert.match(result.replacementAfterFailure.rejected, /隔离故意失败/)
    assert.equal(result.replacementAfterFailure.restoredMarker, 'new-native-early')
    assert.equal(result.replacementAfterFailure.marker, 'new-native-early')
    assert.equal(result.replacementAfterFailure.recordReads, 1)
    assert.equal(result.replacementAfterFailure.writes, 0)
    assert.equal(result.failure, '')
  } finally { await context.close(); await browser.close() }
})
