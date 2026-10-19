import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
server.middlewares.use((req, res, next) => {
  if (req.url === '/__accessory-migration-contract') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body>独立辅料迁移契约</body></html>') }
  else next()
})
await server.listen(); after(async () => { await server.close() })
const address = server.httpServer!.address(), base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`
const evidenceDir = resolve('output/verification/accessory-warehouse-migration')

async function newPage(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const context = await browser.newContext(), page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.goto(`${base}/__accessory-migration-contract`)
  return { context, page, errors }
}

test('真实IndexedDB：首次只读、分批中止续迁、混合旧源保留、跨库清理失败重试与备份空环境恢复', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const { context, page, errors } = await newPage(browser)
  try {
    const result = await page.evaluate(async () => {
      const context = await import('/src/data/fcs/production-context-records.ts')
      await context.hydrateProductionContextRecords()
      const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const sources = await import('/src/data/wls/accessory-warehouse-sources.ts')
      const projections = prep.listMaterialPrepOrderProjections(null)
      const projection = projections.find(row => row.order.prepOrderId === 'prep-order-po-202603-0004')!
      const accessory = projection.lines.find(line => line.materialType === '辅料')!, fabric = projection.lines.find(line => line.materialType === '面料')!
      const common = { prepOrderId: projection.order.prepOrderId, batchNo: '旧批次001', warehouseArea: '旧库区', locationCode: 'ACC-B-001',
        operatorName: '原仓管', preparedAt: '2026-10-18 09:00:00', rollCount: 0, confirmedAt: '2026-10-18 10:00:00', confirmedBy: '原仓管', rejectedAt: '', rejectedBy: '', rejectReason: '', sourceStockEventId: '', remark: '必须保留' }
      const raw = JSON.stringify({ otherModuleMeta: { keep: '保留' }, prepRecords: [
        { ...common, prepRecordId: 'USER-MIXED', prepLineId: accessory.prepLineId, recordStatus: 'CONFIRMED', preparedQty: null, items: [
          { prepRecordItemId: 'USER-ACC', prepLineId: accessory.prepLineId, preparedQty: 7, rollCount: 0, sourceUnit: accessory.unit },
          { prepRecordItemId: 'USER-FAB', prepLineId: fabric.prepLineId, preparedQty: 11, rollCount: 1, sourceUnit: fabric.unit },
        ] },
        { ...common, prepRecordId: 'USER-DRAFT', prepLineId: accessory.prepLineId, recordStatus: 'DRAFT', preparedQty: 2 },
      ], pickupRecords: [], pickupSessions: [], pickupNodeSnapshots: [], pickupReturnRecords: [], rejectRecords: [],
        stagingRecords: [{ stagingRecordId: 'USER-STAGE', prepOrderId: projection.order.prepOrderId, prepRecordId: 'USER-MIXED', status: '已确认' }], closedOrders: [] })
      localStorage.setItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, raw)
      await sources.prepareAccessoryWarehouseSources()
      sources.listAccessoryPreparations()
      const before = await records.readAccessoryRecordSnapshot()
      const inspected = await migration.inspectLegacyAccessoryMigration()
      const readonly = { count: before.records.length, rawSame: localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY) === raw }
      const put = IDBObjectStore.prototype.put
      let count = 0
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        if (this.name === 'records' && String((args[0] as any)?.id).includes('legacy-entry:') && ++count === 2) throw new DOMException('模拟第二批失败', 'QuotaExceededError')
        return put.apply(this, args)
      }
      let failure = ''
      try { await migration.migrateLegacyAccessoryPreparation({ commandId: 'migration-contract', operator: '验收', at: '2026-10-19 10:00:00', batchSize: 1 }) }
      catch (error) { failure = String(error) } finally { IDBObjectStore.prototype.put = put }
      const progress = await migration.inspectLegacyAccessoryMigration(), rawAfterFailure = localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
      const verified = await migration.migrateLegacyAccessoryPreparation({ commandId: 'migration-contract', operator: '验收', batchSize: 1, finalize: false })
      const stillRaw = localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) { if (key === prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY) throw new DOMException('模拟旧范围清理失败', 'QuotaExceededError'); return setItem.call(this, key, value) }
      let cleanupFailure = ''
      try { await migration.migrateLegacyAccessoryPreparation({ commandId: 'migration-contract', operator: '验收', batchSize: 1 }) }
      catch (error) { cleanupFailure = String(error) } finally { Storage.prototype.setItem = setItem }
      const complete = await migration.migrateLegacyAccessoryPreparation({ commandId: 'migration-contract', operator: '验收', batchSize: 1 })
      const after = await records.readAccessoryRecordSnapshot(), afterRaw = JSON.parse(localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY)!)
      await sources.prepareAccessoryWarehouseSources()
      const actual = sources.getAccessoryPreparation(projection.order.prepOrderId)!
      const initialQty = actual.lines.find(line => line.id === accessory.prepLineId)!.preparedQty
      const otherStore = prep.hydrateProductionMaterialPrepStore()
      otherStore.prepRecords.push({ ...common, prepRecordId: 'USER-FABRIC-CONTINUED', prepOrderId: projection.order.prepOrderId,
        prepLineId: fabric.prepLineId, recordStatus: 'DRAFT', preparedQty: 1 })
      prep.persistProductionMaterialPrepStore(otherStore)
      const continuedRaw = JSON.parse(localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY)!)
      const scopeIds = new Set(projections.flatMap(row => row.lines.filter(line => prep.isAccessoryWarehouseScopeLine(line, row.order)).map(line => line.prepLineId)))
      const noOwnedLegacyWriteBack = !continuedRaw.prepRecords.some((record: any) => (record.items?.length ? record.items : [record]).some((item: any) => scopeIds.has(item.prepLineId)))
      const backup = await migration.exportAccessoryWarehouseBackup(), blob = await migration.encodeAccessoryWarehouseBackup(backup)
      const beforeRepeat = after.records.length
      await migration.migrateLegacyAccessoryPreparation({ commandId: 'migration-contract', operator: '验收' })
      const afterRepeat = (await records.readAccessoryRecordSnapshot()).records.length
      let nonemptyRestore = ''
      try { await migration.restoreAccessoryWarehouseBackup(backup) } catch (error) { nonemptyRestore = String(error) }
      const get = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!
      Storage.prototype.getItem = function (key) { if (key === prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY) throw new Error('读取已禁用'); return get.value.call(this, key) }
      let independent = false, unreadableBackup: { status?: string; conflicts: number; state: string } | undefined
      try {
        independent = sources.getAccessoryPreparation(projection.order.prepOrderId)!.lines.find(line => line.id === accessory.prepLineId)!.preparedQty === initialQty
        const preservedBackup = await migration.exportAccessoryWarehouseBackup(), unreadableInspection = await migration.inspectLegacyAccessoryMigration()
        unreadableBackup = { status: preservedBackup.legacySource?.status, conflicts: preservedBackup.conflicts?.length || 0, state: unreadableInspection.state }
      } finally { Object.defineProperty(Storage.prototype, 'getItem', get) }
      return { inspected, readonly, failure, progress, rawAfterFailureSame: rawAfterFailure === raw, verified, verifiedStillRaw: stillRaw === raw,
        cleanupFailure, complete, remaining: afterRaw, archiveCount: after.records.filter(row => row.collection.endsWith('migration') && (row.value as any).kind === 'LEGACY_ENTRY').length,
        initialQty, expectedQty: accessory.confirmedPrepQty + 7, accessoryLineId: accessory.prepLineId, fabricLineId: fabric.prepLineId,
        preparationId: projection.order.prepOrderId, backupText: await blob.text(), beforeRepeat, afterRepeat, nonemptyRestore, independent, noOwnedLegacyWriteBack, unreadableBackup }
    })
    assert.deepEqual(result.readonly, { count: 0, rawSame: true })
    assert.equal(result.inspected.state, '待迁移')
    assert.match(result.failure, /第二批失败/)
    assert.equal(result.progress.copiedCount, 1)
    assert.equal(result.rawAfterFailureSame, true)
    assert.equal(result.verified.state, '待清理')
    assert.equal(result.verifiedStillRaw, true)
    assert.match(result.cleanupFailure, /清理失败/)
    assert.equal(result.complete.state, '已完成')
    assert.equal(result.remaining.prepRecords.length, 1)
    assert.equal(result.remaining.prepRecords[0].items.length, 1)
    assert.equal(result.remaining.prepRecords[0].items[0].prepLineId, result.fabricLineId)
    assert.deepEqual(result.remaining.otherModuleMeta, { keep: '保留' })
    assert.equal(result.remaining.stagingRecords.length, 1)
    assert.equal(result.initialQty, result.expectedQty)
    assert.equal(result.beforeRepeat, result.afterRepeat)
    assert.match(result.nonemptyRestore, /非空/)
    assert.equal(result.independent, true)
    assert.equal(result.noOwnedLegacyWriteBack, true)
    assert.deepEqual(result.unreadableBackup, { status: 'UNREADABLE', conflicts: 0, state: '已完成' })
    const fresh = await newPage(browser)
    const restored = await fresh.page.evaluate(async ({ text, preparationId, lineId }) => {
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const sources = await import('/src/data/wls/accessory-warehouse-sources.ts')
      const backup = await migration.parseAccessoryWarehouseBackup(new Blob([text], { type: 'application/json' }))
      await migration.restoreAccessoryWarehouseBackup(backup)
      await sources.prepareAccessoryWarehouseSources()
      return { quantity: sources.getAccessoryPreparation(preparationId)!.lines.find(line => line.id === lineId)!.preparedQty,
        legacy: localStorage.getItem('productionMaterialPrepWorkflow') }
    }, { text: result.backupText, preparationId: result.preparationId, lineId: result.accessoryLineId })
    assert.equal(restored.quantity, result.initialQty)
    assert.equal(restored.legacy, null)
    assert.deepEqual(errors, [])
    assert.deepEqual(fresh.errors, [])
    await fresh.context.close()
    await mkdir(evidenceDir, { recursive: true })
    const { backupText: _, ...summary } = result
    await writeFile(resolve(evidenceDir, 'migration-contract.json'), JSON.stringify({ base, at: new Date().toISOString(), summary, restored }, null, 2))
  } finally { await context.close(); await browser.close() }
})

test('真实IndexedDB：来源版本变化停止迁移；缺附件、事务中止、非空目标恢复均无半套成功', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const source = await newPage(browser)
  try {
    const result = await source.page.evaluate(async () => {
      const context = await import('/src/data/fcs/production-context-records.ts'); await context.hydrateProductionContextRecords()
      const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      const projection = prep.listMaterialPrepOrderProjections(null).find(row => row.order.prepOrderId === 'prep-order-po-202603-0004')!
      const line = projection.lines.find(line => line.materialType === '辅料')!
      const old = { prepRecords: [1, 2].map(number => ({ prepRecordId: `SOURCE-${number}`, prepOrderId: projection.order.prepOrderId, prepLineId: line.prepLineId,
        recordStatus: 'DRAFT', preparedQty: number, preparedAt: '2026-10-18 09:00:00', operatorName: '旧仓管' })), pickupRecords: [], pickupSessions: [],
        pickupNodeSnapshots: [], pickupReturnRecords: [], rejectRecords: [], stagingRecords: [], closedOrders: [] }
      localStorage.setItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(old))
      let changedRaw = '', once = false
      const listener = () => { if (!once) { once = true; changedRaw = JSON.stringify({ ...old, concurrentOtherMetadata: '并发更新应保留' }); localStorage.setItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, changedRaw) } }
      window.addEventListener('accessory-warehouse-saved', listener)
      let failure = ''
      try { await migration.migrateLegacyAccessoryPreparation({ commandId: 'source-conflict', operator: '验收', batchSize: 1 }) }
      catch (error) { failure = String(error) } finally { window.removeEventListener('accessory-warehouse-saved', listener) }
      let retry = ''
      try { await migration.migrateLegacyAccessoryPreparation({ commandId: 'source-conflict', operator: '验收', batchSize: 1 }) } catch (error) { retry = String(error) }
      const saved = await records.readAccessoryRecordSnapshot()
      return { failure, retry, rawPreserved: localStorage.getItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY) === changedRaw,
        archived: saved.records.filter(row => (row.value as any).kind === 'LEGACY_ENTRY').length }
    })
    assert.match(result.failure, /已变化/)
    assert.match(result.retry, /已变化/)
    assert.equal(result.rawPreserved, true)
    assert.equal(result.archived, 1)
    await source.context.close()
    const attachmentSource = await newPage(browser)
    const backupText = await attachmentSource.page.evaluate(async () => {
      const context = await import('/src/data/fcs/production-context-records.ts'); await context.hydrateProductionContextRecords()
      const sources = await import('/src/data/wls/accessory-warehouse-sources.ts'); await sources.prepareAccessoryWarehouseSources()
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      const identity = await import('/src/data/fcs/cutting/cutting-record-identity.ts')
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const preparation = sources.listAccessoryPreparations().find(row => row.id === 'prep-order-po-202603-0004')!
      const blob = new Blob(['附件原始字节\u0000测试'], { type: 'application/octet-stream' })
      const fileId = `production-context-file:${await identity.cuttingRecordBytesFingerprint(new Uint8Array(await blob.arrayBuffer()))}`
      ;(preparation as any).attachment = { $productionFile: fileId }
      await records.saveAccessoryWarehouseAction({ commandId: 'attachment-setup', intent: 'attachment-setup', result: { preparationId: preparation.id },
        change: { puts: [records.accessoryRecord('preparation', preparation.id, preparation)], files: [{ id: fileId, blob }] } })
      return (await migration.encodeAccessoryWarehouseBackup(await migration.exportAccessoryWarehouseBackup())).text()
    })
    await attachmentSource.context.close()
    const target = await newPage(browser)
    const restored = await target.page.evaluate(async text => {
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const repo = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const data = await migration.parseAccessoryWarehouseBackup(new Blob([text]))
      let missing = ''
      try { await migration.restoreAccessoryWarehouseBackup({ ...data, files: [] }) } catch (error) { missing = String(error) }
      const put = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) { if (this.name === 'meta') throw new DOMException('恢复事务中止', 'QuotaExceededError'); return put.apply(this, args) }
      let failure = ''
      try { await migration.restoreAccessoryWarehouseBackup(data) } catch (error) { failure = String(error) } finally { IDBObjectStore.prototype.put = put }
      const afterFailure = await repo.exportCuttingRecordBackup()
      await migration.restoreAccessoryWarehouseBackup(data)
      const actual = await repo.exportCuttingRecordBackup()
      return { missing, failure, afterFailure: { records: afterFailure.records.length, commands: afterFailure.commands.length, files: afterFailure.files.length },
        files: actual.files.length, content: await actual.files[0].blob.text(), type: actual.files[0].blob.type,
        records: actual.records.filter(row => row.id.startsWith('accessory-warehouse:')).length }
    }, backupText)
    assert.match(restored.missing, /附件实体/)
    assert.match(restored.failure, /恢复事务中止/)
    assert.deepEqual(restored.afterFailure, { records: 0, commands: 0, files: 0 })
    assert.equal(restored.files, 1)
    assert.equal(restored.content, '附件原始字节\u0000测试')
    assert.equal(restored.type, 'application/octet-stream')
    assert.ok(restored.records > 0)
    assert.deepEqual(source.errors, [])
    assert.deepEqual(attachmentSource.errors, [])
    assert.deepEqual(target.errors, [])
    await target.context.close()
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(resolve(evidenceDir, 'conflict-and-attachment-restore.json'), JSON.stringify({ base, at: new Date().toISOString(), result, restored }, null, 2))
  } finally { await source.context.close(); await browser.close() }
})
