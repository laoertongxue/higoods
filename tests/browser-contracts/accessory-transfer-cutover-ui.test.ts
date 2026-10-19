import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

// AC47: setup uses existing pure builders and the canonical save API to model a
// stage-one saved completion. It is not evidence of upstream user operations.
// Only the actual main GTP maintenance/dispatch UI performs the tested actions.
const base = process.env.ACCESSORY_CUTOVER_UI_URL || 'http://127.0.0.1:43241'
const output = resolve('output/playwright/accessory-warehouse/transfer-cutover')
const gtp = '/wls/accessory-warehouses/gtp/preparation'
const sourcePaths = ['src/data/wls/accessory-warehouse-transfer-cutover.ts', 'src/data/wls/accessory-warehouse-flow.ts', 'src/data/wls/accessory-warehouse-records.ts', 'src/pages/wls/accessory-warehouses/gtp-preparation.ts', 'src/pages/wls/accessory-warehouses/transfers.ts']
let browser: Browser, runOutput = output, sourceBefore: Record<string, string>
const checks: Record<string, unknown> = {}
const fingerprints = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])) )
before(async () => {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  runOutput = resolve(output, new Date().toISOString().replace(/[:.]/g, '-'))
  await mkdir(runOutput, { recursive: true }); sourceBefore = await fingerprints(); browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close()
  const report = { capturedAt: new Date().toISOString(), base, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), evidenceDirectory: runOutput,
    environment: 'isolated Chromium main-application development diagnostic', requirement: 'AC47', productionPerformanceAccepted: false,
    fixtureBoundary: 'Existing pure preparation/reservation builders plus canonical save create test initial state only. Fixture setup is not upstream actual-operation evidence.', sourceBefore, sourceAfter: await fingerprints(), checks }
  await writeFile(resolve(runOutput, 'results.json'), JSON.stringify(report, null, 2)); await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2))
})
type Snapshot = { revision: number; records: Array<{ id: string; collection: string; value: any }>; commands: any[] }
function values(snapshot: Snapshot, kind: string): any[] { return snapshot.records.filter(row => row.collection === `accessory-warehouse:${kind}`).map(row => row.value) }
async function durable(page: Page): Promise<Snapshot> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('higood-cutting-records-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('readonly assertion does not initialize business database')) } })
    try {
      const tx = db.transaction(['records', 'meta', 'commands'], 'readonly'), done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
      const get = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const [records, meta, commands] = await Promise.all([get(tx.objectStore('records').getAll(IDBKeyRange.bound('accessory-warehouse:', 'accessory-warehouse:\uffff'))), get(tx.objectStore('meta').get('revision')), get(tx.objectStore('commands').getAll())]); await done
      return { records, revision: meta?.value || 0, commands }
    } finally { db.close() }
  })
}
async function withPage(name: string, body: (page: Page) => Promise<unknown>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = [], events: unknown[] = []
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => { events.push({ browserDialog: dialog.type(), message: dialog.message() }); await dialog.accept() })
  await page.exposeFunction('__awCutoverEvent', (value: unknown) => { events.push({ url: page.url(), value }) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    for (const type of ['click', 'input', 'change']) document.addEventListener(type, event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-accessory-action],[data-aw-actor],[data-accessory-transfer-action],[data-accessory-transfer-field]') : null
      if (target) void (globalThis as any).__awCutoverEvent({ type, trusted: event.isTrusted, text: target.textContent?.trim().slice(0, 90), dataset: { ...target.dataset }, value: target instanceof HTMLInputElement ? target.value : undefined })
    }, true)
  })
  try { const result = await body(page); assert.deepEqual(errors, []); checks[name] = { passed: true, result }; await page.screenshot({ path: resolve(runOutput, `${name}-final.png`), fullPage: true }) }
  catch (error) { const failure = { url: page.url(), error: String(error), errors, snapshot: await durable(page).catch(String) }; checks[name] = { passed: false, ...failure }; await writeFile(resolve(runOutput, `${name}-failure.json`), JSON.stringify(failure, null, 2)); await page.screenshot({ path: resolve(runOutput, `${name}-failure.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await writeFile(resolve(runOutput, `${name}-events.json`), JSON.stringify({ events, errors }, null, 2)); await context.close() }
}
async function openGtp(page: Page) { await page.goto(base + gtp); await page.locator('[data-accessory-preparation-root]').waitFor() }
async function dataDialog(page: Page) {
  await page.locator('[data-accessory-action="data"]').click()
  const dialog = page.getByRole('dialog', { name: '辅料仓本机资料', exact: true }); await expect(dialog).toBeVisible(); return dialog
}
async function stageOneFixture(page: Page) {
  return page.evaluate(async () => {
    const sources = await import('/src/data/wls/accessory-warehouse-sources.ts'), flow = await import('/src/data/wls/accessory-warehouse-flow.ts'), stockApi = await import('/src/data/wls/accessory-warehouse-stock.ts'), stockSources = await import('/src/data/wls/accessory-warehouse-stock-sources.ts'), records = await import('/src/data/wls/accessory-warehouse-records.ts')
    await sources.prepareAccessoryWarehouseSources()
    const initial = sources.listAccessoryPreparations(), original = { at: '2026-10-18T14:00:00.000Z', by: '阶段一原仓管（测试初态）' }, changedStocks = new Map<string, any>(), prepared: any[] = []
    let stocks = stockSources.listAccessoryStockSources(records.listAccessoryRecords('stock'))
    for (const [index, key] of ['F01', 'F03', 'F02'].entries()) {
      const source = structuredClone(initial.find(row => row.productionOrderId === `PO-AW-202610-${key}`)!)
      if (!source) throw new Error('existing accessory source fixture missing')
      const locationByLine = Object.fromEntries(source.lines.map(line => { const stock = stocks.find(row => row.materialSku === line.materialSku && row.unit === line.unit && row.onHandQty - row.reservedQty >= line.requiredQty)!; if (!stock) throw new Error(`${line.materialName} test source stock insufficient`); return [line.id, stock.locationId] }))
      const projected = stockSources.projectAccessoryPreparationAvailability(source, stocks, { locationByLine })
      const entries = (index < 2 ? projected.lines : projected.lines.slice(0, 1)).map(line => ({ lineId: line.id, qty: index < 2 ? line.requiredQty : line.requiredQty / 2, locationId: locationByLine[line.id] }))
      const reserved = stockApi.reserveAccessoryPreparationStock(stocks, projected, entries, { operationId: `AC47-FIXTURE-RESERVE-${key}`, expectedVersions: Object.fromEntries(stocks.map(row => [row.id, row.version])) })
      for (const stock of reserved.changed) changedStocks.set(stock.id, stock)
      const next = new Map(stocks.map(row => [row.id, row])); for (const stock of reserved.changed) next.set(stock.id, stock); stocks = [...next.values()]
      const registered = flow.registerAccessoryPreparation(projected, entries, original)
      const preparation = index < 2 ? flow.completeAccessoryPreparation(registered, { ...original, transferId: `DISCARDED-SETUP-${key}` }).preparation : registered
      prepared.push(preparation)
    }
    await records.saveAccessoryWarehouseAction({ commandId: 'AC47-STAGE1-INITIAL-STATE', intent: 'isolated test setup only: stage-one completed preparations and existing owned reservations without transfer', result: prepared.map(row => row.id), change: { puts: [...prepared.map(row => records.accessoryRecord('preparation', row.id, row)), ...[...changedStocks.values()].map(row => records.accessoryRecord('stock', row.id, row))] } })
    return { original, normal: prepared[0], pending: prepared[1], incomplete: prepared[2], unsavedStaticPreparationIds: initial.filter(row => !prepared.some(saved => saved.id === row.id)).map(row => row.id), unsavedStaticCount: initial.length - prepared.length }
  })
}
async function abortNextCutover(page: Page) {
  await page.evaluate(() => {
    const global = globalThis as any; global.__ac47Put = IDBObjectStore.prototype.put; global.__ac47Get = IDBObjectStore.prototype.get; global.__ac47CommandReads = []; global.__ac47Aborted = false; global.__ac47AbortRequested = false
    IDBObjectStore.prototype.get = function (key: IDBValidKey | IDBKeyRange) { if (this.name === 'commands') global.__ac47CommandReads.push(String(key)); return global.__ac47Get.call(this, key) }
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) { const request = global.__ac47Put.apply(this, args); if (this.name === 'records' && args[0]?.value?.kind === 'GTP_TO_SITE' && !global.__ac47AbortRequested) { global.__ac47AbortRequested = true; const transaction = this.transaction; request.addEventListener('success', () => { global.__ac47Aborted = true; transaction.abort() }, { once: true }) }; return request }
  })
}
async function restorePuts(page: Page) { await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__ac47Put }) }
function assertCreated(snapshot: Snapshot, fixture: Awaited<ReturnType<typeof stageOneFixture>>) {
  const transfers = values(snapshot, 'transfer'), receipts = values(snapshot, 'receipt'), preparations = values(snapshot, 'preparation'), audit = values(snapshot, 'audit')
  assert.equal(transfers.length, 2); assert.equal(receipts.length, 1); assert.equal(audit.filter(row => row.action === '历史已配齐调拨补建').length, 2)
  const normal = transfers.find(row => row.preparationId === fixture.normal.id)!, pending = transfers.find(row => row.preparationId === fixture.pending.id)!
  assert.equal(normal.status, '待出库'); assert.equal(normal.toWarehouse, 'HILON-2'); assert.equal(pending.status, '待定调入方'); assert.equal(pending.toWarehouse, null)
  for (const original of [fixture.normal, fixture.pending]) {
    assert.deepEqual(preparations.find(row => row.id === original.id), original, 'original completion, quantities, locations and history remain byte-equivalent')
    const transfer = transfers.find(row => row.preparationId === original.id)!
    assert.equal(transfer.createdBy, 'AC47核对仓管'); assert.notEqual(transfer.createdAt, original.completedAt); assert.ok(Date.parse(transfer.createdAt) > Date.parse(original.completedAt))
    assert.equal(transfer.history[0].action, '历史已配齐切换补建'); assert.equal(transfer.history[0].at, transfer.createdAt); assert.equal(transfer.history[0].by, transfer.createdBy)
    const item = audit.find(row => row.preparationId === original.id)!; assert.equal(item.originalCompletedAt, original.completedAt); assert.equal(item.originalCompletedBy, original.completedBy); assert.equal(item.at, transfer.createdAt)
    assert.deepEqual(transfer.lines.map((line: any) => ({ sku: line.materialSku, qty: line.qty, location: line.fromLocationId })), original.lines.map((line: any) => ({ sku: line.materialSku, qty: line.preparedQty, location: line.locationId })))
  }
  assert.ok(!transfers.some(row => row.preparationId === fixture.incomplete.id || fixture.unsavedStaticPreparationIds.includes(row.preparationId)))
  assert.deepEqual(preparations.find(row => row.id === fixture.incomplete.id), fixture.incomplete)
  return { normal, pending }
}

test('AC47真实GTP本机资料：首次只读、事务abort原输入保留、同按钮重试、原完成事实不变且正常单可整单出库', { timeout: 120000 }, async () => withPage('retry-and-dispatch', async page => {
  await openGtp(page); const empty = await durable(page); assert.equal(empty.records.length, 0); assert.equal(empty.commands.length, 0)
  const fixture = await stageOneFixture(page), initial = await durable(page); assert.equal(values(initial, 'transfer').length, 0)
  await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor(); assert.deepEqual(await durable(page), initial)
  let dialog = await dataDialog(page); await expect(dialog).toContainText('2 张已保存配齐记录'); assert.deepEqual(await durable(page), initial)
  await dialog.locator('[data-aw-actor]').fill('AC47核对仓管'); await abortNextCutover(page)
  await dialog.locator('[data-accessory-action="transfer-cutover"]').click()
  await expect(dialog.locator('[data-aw-modal-error]')).toContainText(/尚未保存|撤回|中止|abort/i)
  assert.equal(await page.evaluate(() => (globalThis as any).__ac47Aborted), true); assert.deepEqual(await durable(page), initial)
  assert.equal(await dialog.locator('[data-aw-actor]').inputValue(), 'AC47核对仓管')
  const attempted = await page.evaluate(() => [...(globalThis as any).__ac47CommandReads]); assert.ok(attempted.length > 0)
  await page.screenshot({ path: resolve(runOutput, 'abort-retained-input-1366.png'), fullPage: true }); await restorePuts(page)
  await dialog.locator('[data-accessory-action="transfer-cutover"]').click()
  await expect(dialog.locator('[data-accessory-action="transfer-cutover"]')).toHaveCount(0)
  const saved = await durable(page), created = assertCreated(saved, fixture), commandReads = await page.evaluate(() => [...(globalThis as any).__ac47CommandReads])
  assert.ok(commandReads.every((id: string) => id === attempted[0]), 'retry preserves the same command identity')
  assert.equal(saved.commands.length, initial.commands.length + 1)
  assert.deepEqual(values(saved, 'stock'), values(initial, 'stock'), 'cutover does not invent, release or move historical reservations')
  await writeFile(resolve(runOutput, 'before-cutover.json'), JSON.stringify({ fixture, snapshot: initial }, null, 2)); await writeFile(resolve(runOutput, 'after-cutover.json'), JSON.stringify(saved, null, 2))
  await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor(); dialog = await dataDialog(page)
  await expect(dialog.locator('[data-accessory-action="transfer-cutover"]')).toHaveCount(0); assert.deepEqual(await durable(page), saved)
  await page.goto(base + '/wls/accessory-warehouses/gtp/transfers'); await page.locator('[data-accessory-transfer-root]').waitFor()
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(fixture.pending.productionOrderNo); await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('[data-accessory-transfer-root] tbody tr')).toHaveCount(1); await expect(page.locator('[data-accessory-transfer-action="dispatch"]')).toBeDisabled()
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(fixture.normal.productionOrderNo); await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('[data-accessory-transfer-root] tbody tr')).toHaveCount(1)
  await page.locator(`[data-accessory-transfer-action="dispatch"][data-id="${created.normal.id}"]`).click()
  const dispatch = page.getByRole('dialog', { name: '整单确认出库', exact: true }); await expect(dispatch).toBeVisible(); await dispatch.locator('[data-aw-transfer-actor]').fill('AC47实际出库仓管'); await dispatch.locator('[data-accessory-transfer-action="save"]').click(); await expect(dispatch).toHaveCount(0)
  const final = await durable(page), sent = values(final, 'transfer').find(row => row.id === created.normal.id)!
  assert.equal(sent.status, '已出库待收货'); assert.equal(sent.createdAt, created.normal.createdAt); assert.equal(sent.createdBy, created.normal.createdBy)
  assert.equal(values(final, 'transfer').find(row => row.id === created.pending.id)!.status, '待定调入方')
  for (const before of values(saved, 'stock')) {
    const stock = values(final, 'stock').find(row => row.id === before.id)!, lines = sent.lines.filter((line: any) => line.materialSku === before.materialSku && line.unit === before.unit && line.fromLocationId === before.locationId), quantity = lines.reduce((sum: number, line: any) => sum + line.qty, 0)
    assert.ok(Math.abs(stock.onHandQty - (before.onHandQty - quantity)) < 1e-6); assert.ok(Math.abs(stock.reservedQty - (before.reservedQty - quantity)) < 1e-6)
    assert.ok(!stock.sourceRefs.some((ref: any) => ref.kind === 'RESERVATION' && ref.sourceId === fixture.normal.id)); assert.ok(stock.sourceRefs.some((ref: any) => ref.kind === 'RESERVATION' && ref.sourceId === fixture.pending.id))
  }
  await writeFile(resolve(runOutput, 'after-dispatch.json'), JSON.stringify(final, null, 2)); await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor(); assert.deepEqual(await durable(page), final)
  return { originalCompletedAt: fixture.original.at, originalCompletedBy: fixture.original.by, createdNormal: created.normal, createdPending: created.pending, staticDefaultExcludedCount: fixture.unsavedStaticCount, incompleteExcluded: true, actualTransactionAbort: true, inputRetained: true, stableRetryCommand: attempted[0], noRepeatedOfferAfterReload: true, dispatchConsumesOnlyExistingReservation: true }
}))

test('AC47中断后重新进入：失败不留半套，显式再核对仅创建一次，重复直达读取不补静态或未齐记录', { timeout: 120000 }, async () => withPage('interrupted-reentry', async page => {
  await openGtp(page); const fixture = await stageOneFixture(page), initial = await durable(page)
  await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor(); let dialog = await dataDialog(page)
  await dialog.locator('[data-aw-actor]').fill('AC47核对仓管'); await abortNextCutover(page); await dialog.locator('[data-accessory-action="transfer-cutover"]').click(); await expect(dialog.locator('[data-aw-modal-error]')).toContainText(/尚未保存|撤回|中止|abort/i); assert.deepEqual(await durable(page), initial)
  await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor(); assert.deepEqual(await durable(page), initial)
  dialog = await dataDialog(page); await expect(dialog).toContainText('2 张已保存配齐记录'); await dialog.locator('[data-aw-actor]').fill('AC47核对仓管'); await dialog.locator('[data-accessory-action="transfer-cutover"]').click(); await expect(dialog.locator('[data-accessory-action="transfer-cutover"]')).toHaveCount(0)
  const saved = await durable(page); assertCreated(saved, fixture)
  await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor(); dialog = await dataDialog(page); await expect(dialog.locator('[data-accessory-action="transfer-cutover"]')).toHaveCount(0); assert.deepEqual(await durable(page), saved)
  await writeFile(resolve(runOutput, 'interrupted-reentry-records.json'), JSON.stringify({ before: initial, after: saved }, null, 2))
  return { abortedSnapshotUnchanged: true, reloadBeforeRetryUnchanged: true, afterRetryTransferCount: 2, receiptCount: 1, noDuplicateAfterReentry: true, incompleteAndStaticNotBackfilled: true }
}))
