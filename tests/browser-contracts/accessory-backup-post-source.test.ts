import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium, expect, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// Isolated frozen legacy state is test setup, not real upstream execution.
// Only the migration/export/restore steps below use the actual main UI.
let base = ''
const gtp = '/wls/accessory-warehouses/gtp/preparation'
const fixturePath = 'tests/fixtures/accessory-warehouse/postLegacy.json'
const frozen = [fixturePath, 'tests/fixtures/accessory-warehouse/sew.json']
const hash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex')
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
async function installFixture(page: Page, fixture: any) {
  await page.route('**/__post-backup-fixture-install', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })); await page.goto(base + '/__post-backup-fixture-install')
  await page.evaluate(async fixture => {
    function decode(value: any): any { if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type }); if (Array.isArray(value)) return value.map(decode); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)])); return value }
    if ((await indexedDB.databases()).length) throw new Error('fixture installation requires an isolated empty context')
    for (const info of fixture.databases) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(info.name, info.version); r.onupgradeneeded = () => { for (const s of info.stores) { const store = r.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const i of s.indexes || []) store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }) } }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      const tx = db.transaction(info.stores.map((s: any) => s.name), 'readwrite'), done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
      for (const s of info.stores) for (const row of s.rows) { const store = tx.objectStore(s.name); store.keyPath === null ? store.put(decode(row.value), decode(row.key)) : store.put(decode(row.value)) }; await done; db.close()
    }
    for (const [key, value] of Object.entries(fixture.localStorage || {})) localStorage.setItem(key, String(value))
  }, fixture)
}

async function allDurable(page: Page) {
  return page.evaluate(async () => {
    async function encode(value: any): Promise<any> { if (value instanceof Blob) return { __fixtureType: 'Blob', type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) }; if (Array.isArray(value)) return Promise.all(value.map(encode)); if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encode(item)]))); return value }
    const result = []
    for (const info of (await indexedDB.databases()).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(info.name!, info.version); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      const stores: Record<string, any> = {}
      for (const name of db.objectStoreNames) { const tx = db.transaction(name, 'readonly'), request = tx.objectStore(name).getAll(); const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); const rows = await new Promise<any[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); await done; stores[name] = await encode(rows) }
      result.push({ name: db.name, version: db.version, stores }); db.close()
    }
    return result
  })
}
async function canonical(page: Page) {
  return page.evaluate(async () => { const data = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup(); return { ...data, files: await Promise.all(data.files.map(async file => ({ id: file.id, type: file.blob.type, bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())) }))) } })
}
async function dataDialog(page: Page) {
  await page.goto(base + gtp); await page.locator('[data-accessory-preparation-root]').waitFor(); await page.locator('[data-accessory-action="data"]').click(); const dialog = page.getByRole('dialog', { name: '辅料仓本机资料', exact: true }); await expect(dialog).toBeVisible(); return dialog
}
test('旧后道已入库资料与Blob：统一备份只读包含必要静态配料来源，空环境UI恢复一致且非空拒绝不损原', { timeout: 150000 }, async () => {
  const output = resolve('output/verification/accessory-backup-post-source', new Date().toISOString().replace(/[:.]/g, '-')); await mkdir(output, { recursive: true })
  const beforeHashes = Object.fromEntries(await Promise.all(frozen.map(async path => [path, await hash(path)]))), sourceHashBefore = await hash('src/data/wls/accessory-warehouse-migration.ts')
  const server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } } }); await server.listen(); base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  const browser = await chromium.launch({ headless: true }), sourceContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true }), restoredContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const source = await sourceContext.newPage(), restored = await restoredContext.newPage(), evidence: Record<string, any> = {}, errors: string[] = []
  for (const page of [source, restored]) { await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value }); page.on('pageerror', error => errors.push(error.message)) }
  try {
    await installFixture(source, JSON.parse(await readFile(fixturePath, 'utf8')))
    await source.goto(base + '/fcs/craft/post-finishing/material-transfers'); await source.locator('[data-post-material-migration]').waitFor(); await source.locator('[data-post-finishing-material-transfers-action="migrate"]').click(); await expect(source.locator('[data-post-material-migration]')).toContainText('原后道辅料：已完成')
    const migrated = await canonical(source), prepId = migrated.records.find(row => row.collection === 'accessory-warehouse:transfer' && (row.value as any).id === 'OLD-POST-1')!.value as any
    assert.equal(migrated.records.filter(row => row.collection === 'accessory-warehouse:preparation').length, 0)
    const beforeExport = await allDurable(source)
    // Minimal reproduction: before the fix this throws the original missing-source error.
    const exported = await source.evaluate(async () => { const api = await import('/src/data/wls/accessory-warehouse-migration.ts'); try { return { value: JSON.parse(await (await api.encodeAccessoryWarehouseBackup(await api.exportAccessoryWarehouseBackup())).text()), error: '' } } catch (error) { return { value: null, error: String(error) } } })
    const afterExport = await allDurable(source); assert.deepEqual(afterExport, beforeExport); evidence.exportReadOnly = { beforeExport, afterExport, error: exported.error }
    await writeFile(resolve(output, 'export-readonly.json'), JSON.stringify(evidence.exportReadOnly, null, 2)); assert.equal(exported.error, '')
    const minimal = exported.value, sourcePreparation = minimal.records.find((row: any) => row.collection === 'accessory-warehouse:preparation' && row.value.id === prepId.preparationId)
    assert.ok(sourcePreparation); assert.equal(sourcePreparation.value.status, '待配料'); assert.equal(sourcePreparation.value.completedAt, undefined); assert.ok(sourcePreparation.value.lines.every((line: any) => line.preparedQty === 0)); assert.equal(minimal.records.filter((row: any) => row.collection === 'accessory-warehouse:preparation').length, 1)
    assert.equal(minimal.records.filter((row: any) => row.collection === 'accessory-warehouse:transfer').length, 1); assert.ok((minimal.records.find((row: any) => row.value.id === 'OLD-POST-1').value.lines as any[]).every(line => !line.fromLocationId))
    const dialog = await dataDialog(source), beforeUiExport = await allDurable(source), downloadWait = source.waitForEvent('download'); await dialog.getByRole('button', { name: '导出辅料仓备份', exact: true }).click(); const download = await downloadWait, bytes = await readFile((await download.path())!), backup = JSON.parse(bytes.toString('utf8')); await writeFile(resolve(output, 'unified-ui-backup.json'), bytes)
    assert.deepEqual(await allDurable(source), beforeUiExport); assert.equal(backup.files.length, 1); assert.equal(backup.files[0].bytes.length, 31); assert.equal(new TextDecoder().decode(new Uint8Array(backup.files[0].bytes)), 'original scope attachment bytes')
    const restore = await dataDialog(restored); const empty = await canonical(restored); assert.equal(empty.records.length, 0); assert.equal(empty.files.length, 0)
    await restore.locator('[data-aw-backup]').setInputFiles({ name: '旧后道完整辅料仓备份.json', mimeType: 'application/json', buffer: bytes }); await restore.getByRole('button', { name: '恢复本范围资料', exact: true }).click(); await expect(restore.getByRole('button', { name: '恢复本范围资料', exact: true })).toHaveCount(0); await expect(restore.locator('[data-aw-modal-error]')).toHaveText('')
    const restoredData = await canonical(restored); assert.deepEqual(sorted(restoredData.records), sorted([...backup.records, ...backup.dependencies])); assert.deepEqual(sorted(restoredData.commands), sorted(backup.commands)); assert.deepEqual(sorted(restoredData.files), sorted(backup.files))
    await restored.goto(base + '/fcs/craft/post-finishing/material-transfers'); await restored.locator('[data-post-material-workspace]').waitFor(); const post = await restored.evaluate(async () => { const api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), flow = await import('/src/data/fcs/post-finishing-full-flow.ts'); await api.prepareAccessoryPostFinishing(); return { order: flow.getPostFinishingMaterialTransferOrder('OLD-POST-1'), stocks: flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderId === 'OLD-POST-1') } }); assert.equal(post.order?.status, '已入库'); assert.equal(post.stocks[0].currentQty, 7); assert.equal(post.stocks[0].inboundQty, 10)
    await restored.reload(); await restored.locator('[data-post-material-workspace]').waitFor(); await restored.screenshot({ path: resolve(output, 'restored-post-list.png'), fullPage: true })
    const again = await dataDialog(restored), beforeReject = await allDurable(restored); await again.locator('[data-aw-backup]').setInputFiles({ name: '同一备份再次恢复.json', mimeType: 'application/json', buffer: bytes }); await again.getByRole('button', { name: '恢复本范围资料', exact: true }).click(); await expect(again.locator('[data-aw-modal-error]')).toContainText('非空'); assert.deepEqual(await allDurable(restored), beforeReject); await restored.screenshot({ path: resolve(output, 'nonempty-restore-rejected.png'), fullPage: true })
    const invalid = structuredClone(backup); invalid.records = invalid.records.filter((row: any) => row.collection !== 'accessory-warehouse:preparation'); const validation = await restored.evaluate(async value => { const api = await import('/src/data/wls/accessory-warehouse-migration.ts'); try { api.validateAccessoryWarehouseBackup(await api.parseAccessoryWarehouseBackup(new Blob([JSON.stringify(value)]))); return '' } catch (error) { return String(error) } }, invalid); assert.match(validation, /缺少原配料/)
    assert.deepEqual(errors, []); evidence.passed = true; evidence.sourceSnapshot = sourcePreparation; evidence.postReadback = post; evidence.backup = { records: backup.records.length, dependencies: backup.dependencies.length, files: backup.files, sourcePreparations: 1, noGtpFlowCreated: true }; evidence.emptyUiRestoreEqual = true; evidence.nonemptyUiRejectUnchanged = true; evidence.validatorStillRejectsMissingPreparation = validation
    await writeFile(resolve(output, 'restore-readback.json'), JSON.stringify({ originalMigrated: migrated, restoredData, post, beforeReject, afterReject: await allDurable(restored) }, null, 2))
  } catch (error) { evidence.failure = String(error); evidence.errors = errors; await source.screenshot({ path: resolve(output, 'failure-source.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await browser.close(); await server.close(); const afterHashes = Object.fromEntries(await Promise.all(frozen.map(async path => [path, await hash(path)]))); evidence.frozenFixturesBefore = beforeHashes; evidence.frozenFixturesAfter = afterHashes; evidence.fixtureHashesUnchanged = JSON.stringify(beforeHashes) === JSON.stringify(afterHashes); evidence.sourceHashBefore = sourceHashBefore; evidence.sourceHashAfter = await hash('src/data/wls/accessory-warehouse-migration.ts'); await writeFile(resolve(output, 'results.json'), JSON.stringify({ scope: 'post legacy canonical plus referenced static preparation source in unified backup', environment: 'fresh source main UI; isolated Chromium only, no formal performance result', fixtureBoundary: 'frozen test initial state; not upstream actual-operation evidence', ...evidence }, null, 2)); console.log(`Evidence: ${output}`) }
})
