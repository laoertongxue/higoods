import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

// Main-application integration diagnostics: all business mutations use actual
// clicks/forms. DB access below is readonly and asserts durable downstream facts.
// No source fixtures are overwritten and no pure business builder is invoked.
const base = process.env.ACCESSORY_UPSTREAM_TEST_URL || 'http://127.0.0.1:43241'
const output = resolve('output/verification/accessory-upstream-transfer')
const GTP = 'WH-FITTING-001', HILON = 'HILON-2', MAHA = 'WH-FITTING-MAHAMERU'
type Site = 'hilon' | 'mahameru'
type Snapshot = { revision: number; records: Array<{ id: string; collection: string; value: any }>; commands: any[] }
const checks: Record<string, unknown> = {}
const sourceFiles = ['src/pages/wls/accessory-warehouses/gtp-preparation.ts', 'src/pages/wls/accessory-warehouses/transfers.ts',
  'src/data/wls/accessory-warehouse-factory-link.ts', 'src/data/fcs/production-context-actions.ts', 'src/pages/unified-dispatch-workbench.ts',
  'src/data/wls/accessory-warehouse-upstream-fixtures.ts', 'src/data/wls/accessory-warehouse-stock-sources.ts']
let browser: Browser, sourceBefore: Record<string, string>
let serviceEvidence: Record<string, string> = {}
let runOutput = output

async function fingerprints(): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file,
    await readFile(file).then(bytes => createHash('sha256').update(bytes).digest('hex')).catch(() => 'missing'),
  ])))
}
before(async () => {
  runOutput = resolve(output, new Date().toISOString().replace(/[:.]/g, '-'))
  await mkdir(runOutput, { recursive: true })
  sourceBefore = await fingerprints()
  const url = new URL(base)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'this contract only operates isolated local app contexts')
  try {
    const listener = execFileSync('lsof', ['-nP', `-iTCP:${url.port || '80'}`, '-sTCP:LISTEN', '-Fpcn'], { encoding: 'utf8' })
    const pid = listener.match(/^p(\d+)/m)?.[1]
    serviceEvidence = { listener, cwd: pid ? execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }) : 'unavailable' }
  } catch (error) { serviceEvidence = { inspectionUnavailable: String(error) } }
  browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close()
  const report = JSON.stringify({ capturedAt: new Date().toISOString(), base, evidenceDirectory: runOutput,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'isolated Chromium contexts against local Vite development application',
    productionPerformanceAccepted: false, serviceEvidence, sourceBefore, sourceAfter: await fingerprints(), checks,
  }, null, 2)
  await writeFile(resolve(runOutput, 'results.json'), report)
  await writeFile(resolve(output, 'results.json'), report)
})

async function withPage(name: string, run: (page: Page) => Promise<unknown>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const page = await context.newPage(), errors: string[] = [], uiEvents: unknown[] = []
  const hmrMessages: unknown[] = [], navigations: unknown[] = []
  page.setDefaultTimeout(20000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push({ at: new Date().toISOString(), url: frame.url() }) })
  page.on('websocket', socket => {
    socket.on('framereceived', event => {
      try {
        const message = JSON.parse(String(event.payload))
        if (['full-reload', 'update', 'error', 'prune'].includes(message.type)) {
          const url = new URL(socket.url())
          hmrMessages.push({ at: new Date().toISOString(), socket: url.origin + url.pathname, message })
        }
      } catch { /* Only Vite diagnostic messages are relevant; do not log unrelated payloads. */ }
    })
  })
  await page.exposeFunction('__awRecordIntegrationEvent', (value: unknown) => { uiEvents.push({ url: page.url(), value }) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    for (const type of ['click', 'input', 'change']) document.addEventListener(type, event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(
        '[data-accessory-action],[data-accessory-field],[data-aw-qty],[data-aw-location],[data-aw-actor],'
        + '[data-accessory-transfer-action],[data-accessory-transfer-field],[data-aw-transfer-qty],[data-aw-transfer-location],'
        + '[data-unified-action],[data-unified-field],[data-unified-filter]',
      ) : null
      if (target) void (globalThis as any).__awRecordIntegrationEvent({ type, trusted: event.isTrusted,
        text: target.textContent?.trim().slice(0, 90), data: { ...target.dataset },
        value: target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.value : undefined })
    }, true)
  })
  try {
    const result = await run(page)
    assert.deepEqual(errors, [], 'main application must not throw uncaught exceptions')
    checks[name] = { passed: true, hmrMessages, navigations, result }
    await page.screenshot({ path: resolve(runOutput, `${name}-final.png`), fullPage: true })
  } catch (error) {
    const failure = { capturedAt: new Date().toISOString(), url: page.url(), error: String(error), errors, hmrMessages, navigations,
      snapshot: await readDurable(page).catch(error => ({ readFailure: String(error) })),
      bodyText: await page.locator('body').innerText().catch(() => '') }
    checks[name] = { passed: false, ...failure }
    await writeFile(resolve(runOutput, `${name}-failure-${Date.now()}.json`), JSON.stringify(failure, null, 2))
    await page.screenshot({ path: resolve(runOutput, `${name}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await writeFile(resolve(runOutput, `${name}-events.json`), JSON.stringify({ uiEvents, errors, hmrMessages, navigations }, null, 2))
    await context.close()
  }
}

async function readDurable(page: Page): Promise<Snapshot> {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(database => database.name === 'higood-cutting-records-v1')) {
      throw new Error('应用记录库尚不存在；只读断言不创建数据库。')
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-cutting-records-v1')
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('只读断言不初始化或升级应用数据库。')) }
    })
    try {
      const tx = db.transaction(['records', 'meta', 'commands'], 'readonly')
      const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
      const result = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const [records, revision, commands] = await Promise.all([
        result(tx.objectStore('records').getAll(IDBKeyRange.bound('accessory-warehouse:', 'accessory-warehouse:\uffff'))),
        result(tx.objectStore('meta').get('revision')), result(tx.objectStore('commands').getAll()),
      ])
      await done
      return { records, revision: revision?.value || 0, commands }
    } finally { db.close() }
  })
}
function values(snapshot: Snapshot, kind: string): any[] {
  return snapshot.records.filter(row => row.collection === `accessory-warehouse:${kind}`).map(row => row.value)
}
function orderTransfer(snapshot: Snapshot, order: string, kind = 'GTP_TO_SITE') {
  const rows = values(snapshot, 'transfer').filter(row => row.productionOrderId === order && row.kind === kind)
  assert.equal(rows.length, 1, `${order} must have exactly one ${kind} transfer`)
  return rows[0]
}
async function go(page: Page, path: string, selector: string) {
  await page.goto(base + path)
  await page.locator(selector).waitFor()
}
async function preparationSource(page: Page, order: string): Promise<any> {
  return page.evaluate(async orderNo => {
    const module = await import('/src/data/wls/accessory-warehouse-sources.ts')
    return module.listAccessoryPreparations().find((row: any) => row.productionOrderNo === orderNo)
  }, order)
}
async function fillWholePreparation(page: Page, order: string, verifyMaterialPictures = false): Promise<any> {
  await go(page, '/wls/accessory-warehouses/gtp/preparation', '[data-accessory-preparation-root]')
  const initial = await readDurable(page)
  assert.equal(initial.records.length, 0, 'opening source fixtures must not copy accessory records into DB')
  await page.locator('[data-accessory-field="keyword"]').fill(order)
  await page.locator('[data-accessory-action="query"]').click()
  await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(1)
  const source = await preparationSource(page, order)
  assert.ok(source, `${order} must come from actual upstream production source`)
  assert.equal(source.lines.length, 6)
  assert.ok(source.lines.every((line: any) => line.preparedQty === 0))
  await page.locator('[data-accessory-action="prepare"]').click()
  const dialog = page.getByRole('dialog', { name: '登记配料', exact: true })
  if (verifyMaterialPictures) {
    for (const materialName of ['价格吊牌', '品牌吊牌', '吊粒']) {
      const button = dialog.locator(`[data-accessory-action="image"][data-label="${materialName}"]`)
      await button.scrollIntoViewIfNeeded()
      await expect.poll(() => button.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      await button.click()
      const enlarged = page.getByRole('dialog', { name: materialName, exact: true })
      await expect(enlarged).toBeVisible()
      await expect.poll(() => enlarged.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      await page.screenshot({ path: resolve(runOutput, `material-${materialName}-enlarged.png`), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(enlarged).toHaveCount(0)
      await expect(dialog).toBeVisible()
    }
  }
  const expected: Record<string, [number, string]> = { 'AW-DEMO-ZIPPER': [100, 'GTP-A-01'], 'AW-DEMO-BUTTON': [200, 'GTP-A-02'],
    'AW-DEMO-PRICE-TAG': [100, 'GTP-A-03'], 'AW-DEMO-BRAND-TAG': [100, 'GTP-B-01'],
    'AW-DEMO-TAG-FASTENER': [100, 'GTP-B-02'], 'AW-DEMO-SEWING-THREAD': [1, 'GTP-B-03'] }
  for (const line of source.lines) {
    const [qty, location] = expected[line.materialSku]
    assert.equal(line.requiredQty, qty)
    await dialog.locator(`[data-aw-qty="${line.id}"]`).fill(String(qty))
    await dialog.locator(`[data-aw-location="${line.id}"]`).selectOption({ label: location })
  }
  await dialog.locator('[data-aw-actor]').fill('上游调拨集成验收')
  await page.screenshot({ path: resolve(runOutput, `${order}-whole-preparation.png`), fullPage: true })
  await dialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const snapshot = await readDurable(page), preparation = values(snapshot, 'preparation').find(row => row.productionOrderId === order)
  assert.equal(preparation.status, '已配齐')
  assert.equal(values(snapshot, 'stock').length, 6)
  assert.equal(values(snapshot, 'transfer').length, 1)
  assert.equal(snapshot.commands.length - initial.commands.length, 1, 'preparation, reservations, transfer and receipt commit in one command')
  const stocks = values(snapshot, 'stock')
  for (const line of preparation.lines) {
    const stock = stocks.find(row => row.materialSku === line.materialSku && row.unit === line.unit)
    assert.equal(stock.reservedQty, line.requiredQty)
    assert.equal(stock.sourceRefs.find((ref: any) => ref.kind === 'RESERVATION' && ref.sourceId === preparation.id)?.qty, line.requiredQty)
  }
  const identity = orderTransfer(snapshot, order).id
  await page.reload()
  await page.locator('[data-accessory-preparation-root]').waitFor()
  const refreshed = await readDurable(page)
  assert.equal(orderTransfer(refreshed, order).id, identity)
  assert.equal(values(refreshed, 'preparation').length, 1)
  return { preparation, transfer: orderTransfer(refreshed, order), snapshot: refreshed }
}

async function transferQuery(page: Page, key: 'gtp' | Site, view: 'transfers' | 'receipts' | 'stock', order: string) {
  await go(page, `/wls/accessory-warehouses/${key}/${view}`, '[data-accessory-transfer-root]')
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(order)
  await page.locator('[data-accessory-transfer-action="query"]').click()
  const snapshot = await readDurable(page), code = key === 'gtp' ? GTP : key === 'hilon' ? HILON : MAHA
  const matchingTransfers = values(snapshot, 'transfer').filter(row => row.productionOrderId === order)
  const expectedRows = view === 'receipts' ? values(snapshot, 'receipt').filter(receipt => receipt.warehouseCode === code
    && matchingTransfers.some(transfer => transfer.id === receipt.transferId)).length
    : matchingTransfers.filter(transfer => transfer.fromWarehouse === code).length
  await expect(page.locator('[data-accessory-transfer-root] tbody tr')).toHaveCount(expectedRows)
}

test('裁剪改回原厂：GTP未出库保留单号并新建有效收货事项，旧事项不复活', { timeout: 180000 }, async () => {
  await withPage('return-original-before-out', async page => {
    const order = 'PO-AW-202610-F01', prepared = await fillWholePreparation(page, order)
    const firstReceipt = values(prepared.snapshot, 'receipt')[0]
    await assignCutting(page, order, 'SEA-CUTTING-002', 'REASSIGN')
    const firstChange = await readDurable(page), middleReceipt = values(firstChange, 'receipt').find(row => row.status === '待收货')
    assert.equal(middleReceipt.warehouseCode, MAHA)
    await assignCutting(page, order, 'SEA-CUTTING-001', 'REASSIGN')
    const returned = await readDurable(page), transfer = orderTransfer(returned, order)
    assert.equal(transfer.id, prepared.transfer.id)
    assert.equal(transfer.toWarehouse, HILON)
    assert.equal(transfer.status, '待出库')
    assert.equal(values(returned, 'transfer').length, 1)
    assert.equal(values(returned, 'receipt').find(row => row.id === firstReceipt.id).status, '已取消')
    assert.equal(values(returned, 'receipt').find(row => row.id === middleReceipt.id).status, '已取消')
    const active = values(returned, 'receipt').filter(row => row.status === '待收货')
    assert.equal(active.length, 1)
    assert.equal(active[0].warehouseCode, HILON)
    assert.notEqual(active[0].id, firstReceipt.id)
    await dispatch(page, 'gtp', order, transfer.id)
    const final = await receive(page, 'hilon', order, transfer.id)
    assertInventoryConservation(final, values(prepared.snapshot, 'stock'))
    assert.equal(values(final, 'receipt').filter(row => row.status === '已收货').length, 1)
    assert.equal(values(final, 'receipt').filter(row => row.status === '已取消').length, 2)
    return { prepared: prepared.snapshot, firstChange, returned, final }
  })
})

test('裁剪改回原厂：已收货仓间HILON→Mahameru→HILON，逐段实交实收保留历史', { timeout: 180000 }, async () => {
  await withPage('return-original-after-received', async page => {
    const order = 'PO-AW-202610-F01', prepared = await fillWholePreparation(page, order)
    const originalStocks = values(prepared.snapshot, 'stock')
    await dispatch(page, 'gtp', order, prepared.transfer.id)
    await receive(page, 'hilon', order, prepared.transfer.id)
    await assignCutting(page, order, 'SEA-CUTTING-002', 'REASSIGN')
    const firstChange = await readDurable(page), onward = orderTransfer(firstChange, order, 'SITE_REASSIGN')
    await dispatch(page, 'hilon', order, onward.id)
    const receivedMaha = await receive(page, 'mahameru', order, onward.id)
    assertInventoryConservation(receivedMaha, originalStocks)
    await assignCutting(page, order, 'SEA-CUTTING-001', 'REASSIGN')
    const returned = await readDurable(page), transfers = values(returned, 'transfer')
    const back = transfers.find(row => row.kind === 'SITE_REASSIGN' && row.sourceTransferId === onward.id)
    assert.ok(back)
    assert.equal(transfers.length, 3)
    assert.equal(back.fromWarehouse, MAHA)
    assert.equal(back.toWarehouse, HILON)
    assert.equal(back.status, '待出库')
    assert.deepEqual(transfers.find(row => row.id === prepared.transfer.id), values(receivedMaha, 'transfer').find(row => row.id === prepared.transfer.id))
    assert.deepEqual(transfers.find(row => row.id === onward.id), values(receivedMaha, 'transfer').find(row => row.id === onward.id))
    await dispatch(page, 'mahameru', order, back.id)
    assertInventoryConservation(await readDurable(page), originalStocks)
    const final = await receive(page, 'hilon', order, back.id)
    assertInventoryConservation(final, originalStocks)
    assert.equal(values(final, 'transfer').filter(row => row.status === '已收货').length, 3)
    assert.equal(values(final, 'receipt').filter(row => row.status === '已收货').length, 3)
    assert.ok(values(final, 'stock').filter(row => row.warehouseCode === MAHA).every(row => row.onHandQty === 0))
    await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
    assert.deepEqual(await readDurable(page), final)
    return { firstChange, receivedMaha, returned, final }
  })
})
async function dispatch(page: Page, key: 'gtp' | Site, order: string, id: string) {
  await transferQuery(page, key, 'transfers', order)
  await page.locator(`[data-accessory-transfer-action="dispatch"][data-id="${id}"]`).click()
  const dialog = page.getByRole('dialog', { name: '整单确认出库', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-accessory-transfer-action="save"]').click()
  await expect(dialog).toHaveCount(0)
  const result = values(await readDurable(page), 'transfer').find(row => row.id === id)
  assert.equal(result.status, '已出库待收货')
  return result
}
async function receive(page: Page, key: Site, order: string, transferId: string) {
  const before = await readDurable(page), transfer = values(before, 'transfer').find(row => row.id === transferId)
  const receipt = values(before, 'receipt').find(row => row.transferId === transferId && row.status === '待收货')
  assert.ok(receipt)
  await transferQuery(page, key, 'receipts', order)
  await page.locator(`[data-accessory-transfer-action="receive"][data-id="${receipt.id}"]`).click()
  const dialog = page.getByRole('dialog', { name: '确认收货并上架', exact: true })
  for (const line of transfer.lines) {
    await dialog.locator(`[data-aw-transfer-qty="${line.id}"]`).fill(String(line.qty))
    await dialog.locator(`[data-aw-transfer-location="${line.id}"]`).selectOption({ label: key === 'hilon' ? 'HILON-A-01' : 'MAHAMERU-A-01' })
  }
  await page.screenshot({ path: resolve(runOutput, `${order}-${key}-receipt.png`), fullPage: true })
  await dialog.locator('[data-accessory-transfer-action="save"]').click()
  await expect(dialog).toHaveCount(0)
  const after = await readDurable(page)
  assert.equal(values(after, 'transfer').find(row => row.id === transferId).status, '已收货')
  const savedReceipt = values(after, 'receipt').find(row => row.id === receipt.id)
  assert.equal(savedReceipt.status, '已收货')
  assert.equal(savedReceipt.lines.length, transfer.lines.length)
  assert.ok(savedReceipt.lines.every((line: any) => line.locationId.startsWith(key === 'hilon' ? HILON : MAHA)))
  for (const line of transfer.lines) assert.ok(values(after, 'stock').some(stock => stock.warehouseCode === transfer.toWarehouse
    && stock.materialSku === line.materialSku && stock.unit === line.unit && stock.onHandQty === line.qty))
  return after
}

async function assignCutting(page: Page, order: string, factoryId: string, mode: 'DIRECT' | 'REASSIGN') {
  await go(page, '/fcs/dispatch/workbench?type=NON_SEWING', '[data-unified-field="keyword"]')
  await page.locator('[data-unified-field="keyword"]').fill(order)
  const target = `TASKGEN-AW-202610-${order.slice(-3)}-001__ORDER`
  const action = mode === 'DIRECT' ? 'open-direct' : 'open-reassign'
  const button = page.locator(`[data-unified-action="${action}"][data-task-id="${target}"]`)
  await expect(button).toBeVisible()
  await button.click()
  await expect(page.locator('[data-unified-field="factoryId"]')).toBeVisible()
  await page.locator('[data-unified-field="factoryId"]').selectOption(factoryId)
  await page.locator('[data-unified-field="price"]').fill('1000')
  if (mode === 'REASSIGN') await page.locator('[data-unified-field="reassignReason"]').fill('辅料仓两方向改厂集成验收')
  await page.locator('[data-unified-action="confirm-dispatch"]').click()
  await expect(page.getByRole('button', { name: '确认提交并冻结价格', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认提交并冻结价格', exact: true }).click()
  await expect(page.locator('[data-unified-action="confirm-dispatch"]')).toHaveCount(0)
  return page.evaluate(async taskId => {
    const tasks = await import('/src/data/fcs/runtime-process-tasks.ts')
    return tasks.listRuntimeProcessTasks().find((task: any) => task.taskId === taskId)
  }, target)
}

function assertInventoryConservation(snapshot: Snapshot, originalStock: any[]) {
  const stocks = values(snapshot, 'stock'), transit = values(snapshot, 'transfer').filter(row => row.status === '已出库待收货')
  for (const original of originalStock) {
    const physical = stocks.filter(row => row.materialSku === original.materialSku && row.unit === original.unit).reduce((sum, row) => sum + row.onHandQty, 0)
    const travelling = transit.flatMap(row => row.lines).filter((line: any) => line.materialSku === original.materialSku && line.unit === original.unit)
      .reduce((sum: number, line: any) => sum + line.qty, 0)
    assert.ok(Math.abs(physical + travelling - original.onHandQty) < 0.000001,
      `${original.materialSku}: physical ${physical} + transit ${travelling} must equal ${original.onHandQty}`)
  }
}

test('F02 原生产主线→GTP六辅料自动建单→真实出库→Mahameru整单收货上架', { timeout: 180000 }, async () => {
  await withPage('F02-mahameru-whole-transfer', async page => {
    const order = 'PO-AW-202610-F02', prepared = await fillWholePreparation(page, order, true)
    assert.equal(prepared.transfer.toWarehouse, MAHA)
    assert.equal(prepared.transfer.status, '待出库')
    assert.equal(values(prepared.snapshot, 'receipt').length, 1)
    assert.equal(values(prepared.snapshot, 'receipt')[0].warehouseCode, MAHA)
    assert.equal(values(prepared.snapshot, 'stock').filter(row => row.warehouseCode !== GTP).length, 0)
    await dispatch(page, 'gtp', order, prepared.transfer.id)
    const inTransit = await readDurable(page)
    assert.ok(values(inTransit, 'stock').every(row => row.reservedQty === 0))
    assert.equal(values(inTransit, 'stock').filter(row => row.warehouseCode !== GTP).length, 0)
    const received = await receive(page, 'mahameru', order, prepared.transfer.id)
    await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
    assert.deepEqual(values(await readDurable(page), 'stock'), values(received, 'stock'))
    return { prepared: prepared.snapshot, inTransit, received }
  })
})

test('F03 裁剪待定配齐无错误收货，统一工作台真实分配sea cutting后同一调拨补齐去向', { timeout: 180000 }, async () => {
  await withPage('F03-pending-then-assigned', async page => {
    const order = 'PO-AW-202610-F03', prepared = await fillWholePreparation(page, order)
    assert.equal(prepared.transfer.status, '待定调入方')
    assert.equal(prepared.transfer.toWarehouse, null)
    assert.equal(values(prepared.snapshot, 'receipt').length, 0)
    await transferQuery(page, 'gtp', 'transfers', order)
    await expect(page.locator('[data-accessory-transfer-action="dispatch"]')).toBeDisabled()
    const assigned = await assignCutting(page, order, 'SEA-CUTTING-001', 'DIRECT')
    assert.equal(assigned?.assignedFactoryId, 'SEA-CUTTING-001')
    const durable = await readDurable(page), linked = orderTransfer(durable, order)
    assert.equal(durable.revision - prepared.snapshot.revision, 1, 'task assignment and linked accessory changes share one commit')
    assert.equal(durable.commands.length - prepared.snapshot.commands.length, 1)
    assert.equal(linked.id, prepared.transfer.id)
    assert.equal(linked.status, '待出库')
    assert.equal(linked.toWarehouse, HILON)
    assert.equal(values(durable, 'receipt').length, 1)
    assert.equal(values(durable, 'receipt')[0].warehouseCode, HILON)
    await page.reload(); await page.locator('[data-unified-field="keyword"]').waitFor()
    assert.equal(orderTransfer(await readDurable(page), order).id, prepared.transfer.id)
    return { pending: prepared.snapshot, assigned, linked: durable }
  })
})

for (const condition of ['before-out', 'in-transit', 'received'] as const) {
  for (const direction of [
    { key: 'F01', from: 'hilon' as Site, to: 'mahameru' as Site, fromCode: HILON, toCode: MAHA, toFactory: 'SEA-CUTTING-002' },
    { key: 'F02', from: 'mahameru' as Site, to: 'hilon' as Site, fromCode: MAHA, toCode: HILON, toFactory: 'SEA-CUTTING-001' },
  ]) {
    test(`裁剪工厂改派 ${condition} ${direction.from}→${direction.to} 实际统一工作台与仓间流转`, { timeout: 180000 }, async () => {
      const name = `${condition}-${direction.from}-to-${direction.to}`
      await withPage(name, async page => {
        const order = `PO-AW-202610-${direction.key}`, prepared = await fillWholePreparation(page, order)
        const originalTransfer = prepared.transfer, initialStocks = values(prepared.snapshot, 'stock')
        const originalReceipt = values(prepared.snapshot, 'receipt')[0]
        assert.equal(originalTransfer.toWarehouse, direction.fromCode)
        if (condition !== 'before-out') await dispatch(page, 'gtp', order, originalTransfer.id)
        if (condition === 'received') await receive(page, direction.from, order, originalTransfer.id)
        const before = await readDurable(page)
        assertInventoryConservation(before, initialStocks)
        const assigned = await assignCutting(page, order, direction.toFactory, 'REASSIGN')
        assert.equal(assigned?.assignedFactoryId, direction.toFactory)
        const changed = await readDurable(page)
        assert.equal(changed.revision - before.revision, 1, 'cutting reassignment and accessory consequences are one atomic commit')
        assert.equal(changed.commands.length - before.commands.length, 1)
        const currentPreparation = values(changed, 'preparation').find(row => row.productionOrderId === order)
        assert.equal(currentPreparation.cuttingFactoryId, direction.toFactory)
        assert.deepEqual(currentPreparation.lines.map((line: any) => [line.id, line.requiredQty, line.preparedQty]),
          prepared.preparation.lines.map((line: any) => [line.id, line.requiredQty, line.preparedQty]))
        assertInventoryConservation(changed, initialStocks)
        let final: Snapshot
        if (condition === 'before-out') {
          const rerouted = orderTransfer(changed, order)
          assert.equal(rerouted.id, originalTransfer.id)
          assert.equal(rerouted.toWarehouse, direction.toCode)
          assert.equal(rerouted.status, '待出库')
          const cancelled = values(changed, 'receipt').find(row => row.id === originalReceipt.id)
          assert.equal(cancelled.status, '已取消')
          assert.ok(cancelled.cancelledAt && cancelled.cancellationReason)
          const currentReceipts = values(changed, 'receipt').filter(row => row.status === '待收货')
          assert.equal(currentReceipts.length, 1)
          assert.equal(currentReceipts[0].warehouseCode, direction.toCode)
          assert.equal(cancelled.replacedByReceiptId, currentReceipts[0].id)
          await transferQuery(page, direction.from, 'receipts', order)
          await expect(page.locator('[data-accessory-transfer-action="receive"]')).toBeDisabled()
          await dispatch(page, 'gtp', order, originalTransfer.id)
          final = await receive(page, direction.to, order, originalTransfer.id)
        } else {
          // Historical GTP movement and original receiving responsibility remain intact.
          assert.deepEqual(orderTransfer(changed, order), orderTransfer(before, order))
          assert.deepEqual(values(changed, 'receipt').find(row => row.id === originalReceipt.id),
            values(before, 'receipt').find(row => row.id === originalReceipt.id))
          let onward: any
          if (condition === 'in-transit') {
            assert.equal(values(changed, 'transfer').filter(row => row.kind === 'SITE_REASSIGN').length, 0)
            const change = values(changed, 'change').find(row => row.sourceTransferId === originalTransfer.id)
            assert.equal(change.status, '等待原仓收货')
            assert.equal(change.toWarehouse, direction.toCode)
            assert.equal(values(changed, 'receipt').length, 1, 'new destination cannot bypass original receipt')
            const originalReceived = await receive(page, direction.from, order, originalTransfer.id)
            onward = orderTransfer(originalReceived, order, 'SITE_REASSIGN')
            assert.equal(values(originalReceived, 'change')[0].status, '待仓间调拨')
            assert.equal(values(originalReceived, 'transfer').filter(row => row.kind === 'SITE_REASSIGN').length, 1)
          } else onward = orderTransfer(changed, order, 'SITE_REASSIGN')
          assert.equal(onward.fromWarehouse, direction.fromCode)
          assert.equal(onward.toWarehouse, direction.toCode)
          assert.equal(onward.sourceTransferId, originalTransfer.id)
          assert.equal(onward.status, '待出库')
          assert.deepEqual(onward.lines.map((line: any) => [line.materialSku, line.qty, line.unit]),
            originalTransfer.lines.map((line: any) => [line.materialSku, line.qty, line.unit]))
          // Creating the onward transfer alone must leave all source physical stock intact.
          const beforeOnwardOut = await readDurable(page)
          assertInventoryConservation(beforeOnwardOut, initialStocks)
          for (const line of onward.lines) assert.ok(values(beforeOnwardOut, 'stock').some(stock => stock.warehouseCode === direction.fromCode
            && stock.materialSku === line.materialSku && stock.onHandQty === line.qty))
          await dispatch(page, direction.from, order, onward.id)
          const onwardTransit = await readDurable(page)
          assertInventoryConservation(onwardTransit, initialStocks)
          assert.ok(values(onwardTransit, 'stock').filter(stock => stock.warehouseCode === direction.fromCode).every(stock => stock.onHandQty === 0))
          final = await receive(page, direction.to, order, onward.id)
          assert.equal(values(final, 'receipt').find(row => row.id === originalReceipt.id).status, '已收货')
        }
        assertInventoryConservation(final, initialStocks)
        await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
        assert.deepEqual(await readDurable(page), final, 'refresh cannot duplicate transfer, receipt, stock or command')
        return { before, assigned, changed, final }
      })
    })
  }
}
