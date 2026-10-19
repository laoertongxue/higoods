import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

// The received stock/upstream fixture is test setup, not evidence of actual
// upstream operations. The named create/dispatch/receive/reassign actions below
// use trusted events against the real main application and actual IndexedDB.
let server: ViteDevServer, browser: Browser, base = '', runOutput = ''
const output = resolve('output/verification/accessory-final-boundaries-ui')
const sources = ['src/data/wls/accessory-warehouse-sewing.ts', 'src/data/wls/accessory-warehouse-factory-link.ts', 'src/data/wls/accessory-warehouse-post-finishing.ts', 'src/pages/wls/accessory-warehouses/pickups.ts', 'src/pages/process-factory/post-finishing/material-transfers.ts', 'src/pages/unified-dispatch-workbench.ts']
const checks: Record<string, unknown> = {}
let sourceBefore: Record<string, string>
const fingerprints = async () => Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])) )
before(async () => {
  runOutput = resolve(output, new Date().toISOString().replace(/[:.]/g, '-')); await mkdir(runOutput, { recursive: true })
  sourceBefore = await fingerprints(); server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/*'] } } }); await server.listen()
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`; browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close(); await server?.close()
  const report = { capturedAt: new Date().toISOString(), base, environment: 'isolated contexts, actual main application, Vite file watching ignored', fixtureBoundary: 'Existing helper saves valid production/task/SKU assignments and received stock only as initial test state; no upstream real-operation claim.', productSourceChanged: false, productionPerformanceAccepted: false, sourceBefore, sourceAfter: await fingerprints(), checks, evidenceDirectory: runOutput }
  await writeFile(resolve(runOutput, 'results.json'), JSON.stringify(report, null, 2)); await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2))
})
async function rawDurable(page: Page): Promise<any[]> {
  return page.evaluate(async () => {
    const databases = []
    for (const info of (await indexedDB.databases()).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      if (!info.name) continue
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(info.name!, info.version); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('readonly assertion cannot upgrade a business database')) } })
      const stores: Record<string, unknown> = {}
      try {
        for (const name of db.objectStoreNames) {
          const tx = db.transaction(name, 'readonly'), store = tx.objectStore(name), done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
          const result = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
          const [keys, values] = await Promise.all([result(store.getAllKeys()), result(store.getAll())]); await done
          stores[name] = { keys, values: await Promise.all(values.map(async row => row?.blob instanceof Blob ? { ...row, blob: { type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) } } : row)) }
        }
        databases.push({ name: db.name, version: db.version, stores })
      } finally { db.close() }
    }
    return databases
  })
}
function cutting(snapshot: any[]) { return snapshot.find(row => row.name === 'higood-cutting-records-v1') }
function values(snapshot: any[], kind: string): any[] { return cutting(snapshot).stores.records.values.filter((row: any) => row.collection === `accessory-warehouse:${kind}`).map((row: any) => row.value) }
async function withPage(name: string, run: (page: Page) => Promise<unknown>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = [], events: unknown[] = []
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => { events.push({ type: 'browser-dialog', message: dialog.message() }); await dialog.accept() })
  await page.exposeFunction('__finalBoundaryEvent', (entry: unknown) => { events.push({ url: page.url(), entry }) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    for (const type of ['click', 'input', 'change']) document.addEventListener(type, event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-accessory-pickup-action],[data-aw-pickup-qty],[data-accessory-transfer-action],[data-post-finishing-material-transfers-action],[data-post-material-qty],[data-post-material-location],[data-ppic-task-action],[data-unified-action],[data-unified-field]') : null
      if (target) void (globalThis as any).__finalBoundaryEvent({ type, trusted: event.isTrusted, text: target.textContent?.trim().slice(0, 90), dataset: { ...target.dataset }, value: target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.value : undefined })
    }, true)
  })
  try { const result = await run(page); assert.deepEqual(errors, []); checks[name] = { passed: true, result }; await page.screenshot({ path: resolve(runOutput, `${name}-final.png`), fullPage: true }) }
  catch (error) { const failure = { error: String(error), url: page.url(), errors, body: await page.locator('body').innerText().catch(() => ''), durable: await rawDurable(page).catch(String) }; checks[name] = { passed: false, ...failure }; await writeFile(resolve(runOutput, `${name}-failure.json`), JSON.stringify(failure, null, 2)); await page.screenshot({ path: resolve(runOutput, `${name}-failure.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await writeFile(resolve(runOutput, `${name}-events.json`), JSON.stringify({ events, errors }, null, 2)); await context.close() }
}
async function initialize(page: Page, key: 'hilon' | 'mahameru') {
  await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor()
  const fixture = await seedAccessorySewingFixture(page, false, key); assert.ok(!('error' in fixture)); return fixture
}
async function createPickups(page: Page, key: 'hilon' | 'mahameru') {
  await page.goto(base + `/wls/accessory-warehouses/${key}/pickups`); await page.locator('[data-accessory-pickup-root]').waitFor()
  await page.locator('[data-accessory-pickup-action="create"]').click(); await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
}

test('AC30/31 Mahameru对称真实UI：有效任务建单、四类排除、本仓出库、既有后道Web整单收货与同源库存', { timeout: 120000 }, async () => withPage('mahameru-to-post', async page => {
  const fixture = await initialize(page, 'mahameru'), initial = await rawDurable(page)
  assert.equal(fixture.warehouseCode, 'WH-FITTING-MAHAMERU'); assert.equal(values(initial, 'transfer').filter(row => row.kind === 'SITE_TO_POST').length, 0)
  const prep = values(initial, 'preparation').find(row => row.id === fixture.preparationId)!
  assert.equal(prep.cuttingFactoryId, 'SEA-CUTTING-002'); assert.equal(prep.cuttingFactoryName, 'sea cutting2')
  await page.setViewportSize({ width: 1024, height: 768 }); await createPickups(page, 'mahameru')
  const created = await rawDurable(page), pickups = values(created, 'pickup'), posts = values(created, 'transfer').filter(row => row.kind === 'SITE_TO_POST')
  assert.equal(pickups.length, 2); assert.equal(posts.length, 2)
  const excluded = ['价格吊牌', '品牌吊牌', '吊粒', '车缝线']
  assert.ok(pickups.every(row => row.warehouseCode === fixture.warehouseCode && row.lines.length === 4 && row.lines.every((line: any) => excluded.includes(line.purpose))))
  assert.ok(posts.every(row => row.fromWarehouse === fixture.warehouseCode && row.toWarehouse === 'DLN' && row.lines.length === 2 && row.lines.every((line: any) => line.purpose === '其他')))
  assert.deepEqual(posts.map(row => row.lines.map((line: any) => line.qty)), [[40, 80], [60, 120]])
  const post = posts.find(row => row.responsibilityKey.includes('AW-TEST-ASG-0'))!
  await page.screenshot({ path: resolve(runOutput, 'mahameru-created-pickups-1024.png'), fullPage: true })
  await page.goto(base + '/wls/accessory-warehouses/mahameru/transfers'); await page.locator('[data-accessory-transfer-root]').waitFor()
  await page.locator(`[data-accessory-transfer-action="dispatch"][data-id="${post.id}"]`).click()
  const dispatch = page.getByRole('dialog', { name: '整单确认出库', exact: true }); await expect(dispatch).toBeVisible(); await dispatch.locator('[data-aw-transfer-actor]').fill('Mahameru对称验收仓管'); await dispatch.locator('[data-accessory-transfer-action="save"]').click(); await expect(dispatch).toHaveCount(0)
  const departed = await rawDurable(page); assert.equal(values(departed, 'transfer').find(row => row.id === post.id).status, '已出库待收货'); assert.equal(values(departed, 'stock').filter(row => row.warehouseCode === 'DLN').length, 0)
  await page.goto(base + '/fcs/craft/post-finishing/material-transfers'); await page.locator('[data-post-material-workspace]').waitFor()
  await page.locator('[data-post-material-query] [name="keyword"]').fill(fixture.productionOrderId!); await page.locator('[data-post-finishing-material-transfers-action="query"]').click()
  await page.locator(`[data-post-finishing-material-transfers-action="detail"][data-id="${post.id}"]`).click()
  const receive = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true }); await expect(receive).toContainText('Mahameru辅料仓'); const beforePostReceive = await rawDurable(page)
  for (let index = 0; index < post.lines.length; index++) { await receive.locator('[data-post-material-qty]').nth(index).fill(String(post.lines[index].qty)); await receive.locator('[data-post-material-location]').nth(index).selectOption({ label: 'PF-MAT-A01-01' }) }
  await receive.getByRole('button', { name: '确认收货并上架', exact: true }).click(); await expect(receive).toHaveCount(0)
  const received = await rawDurable(page), finalTransfer = values(received, 'transfer').find(row => row.id === post.id)!, receipt = values(received, 'receipt').find(row => row.transferId === post.id)!
  assert.equal(finalTransfer.status, '已收货'); assert.equal(receipt.status, '已收货'); assert.equal(receipt.lines.length, 2)
  for (const line of finalTransfer.lines) {
    const destination = values(received, 'stock').find(row => row.warehouseCode === 'DLN' && row.materialSku === line.materialSku)!, source = values(received, 'stock').find(row => row.warehouseCode === fixture.warehouseCode && row.materialSku === line.materialSku)!, original = values(initial, 'stock').find(row => row.materialSku === line.materialSku)!
    assert.equal(destination.onHandQty, line.qty); assert.equal(source.onHandQty + destination.onHandQty, original.onHandQty); assert.equal(line.toLocationId, receipt.lines.find((entry: any) => entry.lineId === line.id).locationId)
  }
  for (const line of prep.lines.filter((row: any) => excluded.includes(row.purpose))) assert.equal(values(received, 'stock').find(row => row.warehouseCode === fixture.warehouseCode && row.materialSku === line.materialSku).onHandQty, line.requiredQty)
  assert.deepEqual(received.filter(row => row.name === 'higood-pcs-records'), beforePostReceive.filter(row => row.name === 'higood-pcs-records'), 'managed receipt must not write a second PCS fact')
  await page.goto(base + '/wls/accessory-warehouses/mahameru/transfers'); await page.locator('[data-accessory-transfer-root]').waitFor(); await expect(page.locator(`[data-accessory-transfer-action="detail"][data-id="${post.id}"]`).locator('xpath=ancestor::tr')).toContainText('已收货')
  await page.goto(base + '/fcs/craft/post-finishing/wait-process-warehouse?tab=materials'); await expect(page.locator('main')).toContainText(fixture.productionOrderId!); await expect(page.locator('main')).toContainText('40 条'); await expect(page.locator('main')).toContainText('80 粒')
  assert.deepEqual(await rawDurable(page), received); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await writeFile(resolve(runOutput, 'mahameru-records.json'), JSON.stringify({ fixture, initial, created, departed, beforePostReceive, received }, null, 2))
  return { fixture, taskAssignments: fixture.assignmentIds, fourExclusions: excluded, pickupCount: 2, postCount: 2, sourceTransferId: post.id, receiptId: receipt.id, finalStatus: finalTransfer.status, siteAndDlnConservation: true, rawPcsUnchanged: true, sourceAndPostStockDirectReadSameSnapshot: true, viewport: { width: 1024, height: 768 } }
}))

test('AC36/F10真实最终确认：已有实际领料后统一工作台改厂阻断，全部原始持久记录/command/revision不变', { timeout: 120000 }, async () => withPage('consumed-reassignment-blocked', async page => {
  const fixture = await initialize(page, 'hilon'); await createPickups(page, 'hilon')
  await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor(); await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A'); await page.locator('[data-ppic-task-action="query"]').click()
  const row = page.locator('[data-ppic-task-page] tbody tr').filter({ hasText: 'AW-SEW-A' }); await expect(row).toHaveCount(1); await row.locator('[data-ppic-task-action="print-pickup"]').click(); await page.locator('.print-preview-root').waitFor()
  const slip = await page.evaluate(async () => (await import('/src/data/fcs/sewing-pickup-slips.ts')).getCurrentSewingPickupSlip('AW-TEST-ASG-0', 'ACCESSORY')!)
  const pickup = values(await rawDurable(page), 'pickup').find(row => row.assignmentId === 'AW-TEST-ASG-0')!
  await page.goto(base + `/wls/accessory-warehouses/hilon/pickups?pickupId=${encodeURIComponent(pickup.id)}&versionId=${encodeURIComponent(slip.versionId)}`)
  const handover = page.getByRole('dialog', { name: '登记车缝领料实交', exact: true }); await expect(handover).toBeVisible(); await page.getByLabel('价格吊牌本次实交', { exact: true }).fill('7'); await handover.getByRole('button', { name: '确认本次实交', exact: true }).click(); await expect(page.getByRole('status')).toContainText('本次车缝领料已保存')
  const released = await rawDurable(page), releasedPickup = values(released, 'pickup').find(row => row.id === pickup.id)!
  assert.equal(releasedPickup.lines.find((line: any) => line.purpose === '价格吊牌').handedQty, 7)
  assert.equal(values(released, 'stock').find(row => row.warehouseCode === 'HILON-2' && row.materialSku === 'AW-DEMO-PRICE-TAG').onHandQty, 93)
  await page.goto(base + '/fcs/dispatch/workbench?type=NON_SEWING'); await page.locator('[data-unified-field="keyword"]').waitFor(); await page.locator('[data-unified-field="keyword"]').fill(fixture.productionOrderId!)
  const cutContext = await page.evaluate(async order => {
    const tasks = await import('/src/data/fcs/runtime-process-tasks.ts'), assignments = await import('/src/data/fcs/effective-task-assignments.ts'), source = await import('/src/data/wls/accessory-warehouse-sources.ts')
    const cuts = tasks.listRuntimeProcessTasks().filter(row => row.productionOrderId === order && row.executionEnabled !== false && row.processBusinessCode === 'CUT_PANEL')
    return { cuts, assignments: cuts.flatMap(row => assignments.listCurrentEffectiveTaskAssignments(row.taskId)), preparation: source.listAccessoryPreparations().find(row => row.productionOrderId === order) }
  }, fixture.productionOrderId!)
  assert.equal(cutContext.cuts.length, 1, 'test setup must have exactly one actual active cutting task, not a disabled TASKGEN placeholder')
  const cut = cutContext.cuts[0]; assert.equal(cut.assignedFactoryId, 'SEA-CUTTING-001'); assert.equal(cutContext.assignments.length, 1); assert.equal(cutContext.assignments[0].runtimeTaskId, cut.taskId); assert.equal(cutContext.assignments[0].status, 'EFFECTIVE'); assert.equal(cutContext.preparation?.cuttingFactoryId, 'SEA-CUTTING-001')
  const reassign = page.locator(`[data-unified-action="open-reassign"][data-task-id="${cut.taskId}"]`); await expect(reassign).toBeVisible(); await reassign.click()
  await page.locator('[data-unified-field="factoryId"]').selectOption('SEA-CUTTING-002'); await page.locator('[data-unified-field="price"]').fill('1000'); await page.locator('[data-unified-field="reassignReason"]').fill('F10实际领料后改厂阻断验收')
  await page.locator('[data-unified-action="confirm-dispatch"]').click(); const final = page.getByRole('button', { name: '确认提交并冻结价格', exact: true }); await expect(final).toBeVisible()
  const before = await rawDurable(page); await page.screenshot({ path: resolve(runOutput, 'f10-final-confirm-before.png'), fullPage: true }); await final.click()
  const blocked = page.getByText('已有辅料交给三方或后道，不能按原整包改厂；请先核对实际去向', { exact: true }); await expect(blocked).toBeVisible()
  const after = await rawDurable(page), blockingText = await blocked.innerText(); assert.deepEqual(after, before, 'all actual DB records/commands/meta/files must be unchanged after blocked final confirmation')
  await page.locator('[data-unified-action="back-dispatch"]').click(); await expect(page.locator('[data-unified-field="factoryId"]')).toHaveValue('SEA-CUTTING-002'); await expect(page.locator('[data-unified-field="reassignReason"]')).toHaveValue('F10实际领料后改厂阻断验收')
  await writeFile(resolve(runOutput, 'f10-records.json'), JSON.stringify({ fixture, released, cutContext, beforeFinalConfirmation: before, afterBlockedConfirmation: after, blockingText }, null, 2))
  return { fixture, actualHandedQty: 7, actualRemainingQty: 93, activeCutTaskId: cut.taskId, currentCutAssignmentId: cutContext.assignments[0].assignmentId, originalCutFactory: cut.assignedFactoryId, attemptedFactory: 'SEA-CUTTING-002', finalConfirmationTrustedUi: true, blockedText: blockingText, allRawDurableUnchanged: true, inputsRetained: true, viewport: { width: 1366, height: 768 } }
}))
