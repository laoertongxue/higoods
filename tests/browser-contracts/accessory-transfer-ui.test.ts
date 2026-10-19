import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

// Isolated fixture contract: saved real records + actual exported UI handler.
// This harness does not claim the upstream route/menu integration is accepted.
const base = process.env.ACCESSORY_TRANSFER_TEST_URL || 'http://127.0.0.1:43241'
const output = resolve(process.env.ACCESSORY_WAREHOUSE_TEST_OUTPUT ? `${process.env.ACCESSORY_WAREHOUSE_TEST_OUTPUT}/transfers` : 'output/playwright/accessory-warehouse/stage2-transfer-ui')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, environment: 'Vite isolated saved-record UI harness', routeIntegrationAccepted: false, evidence }, null, 2)) })
async function run(fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__accessory-transfer-isolated-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  try { await page.goto(base + '/__accessory-transfer-isolated-harness'); await fixture(page); await fn(page); assert.deepEqual(errors, []) }
  catch (error) { const id = `failure-${Date.now()}`; await writeFile(resolve(output, `${id}.json`), JSON.stringify({ at: new Date().toISOString(), url: page.url(), error: String(error), errors }, null, 2)); await page.screenshot({ path: resolve(output, `${id}.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}
async function fixture(page: Page) {
  await page.evaluate(async () => {
    const records = await import('/src/data/wls/accessory-warehouse-records.ts')
    const master = await import('/src/data/wls/accessory-warehouse-master.ts')
    const stock = await import('/src/data/wls/accessory-warehouse-stock.ts')
    const commands = await import('/src/data/wls/accessory-warehouse-commands.ts')
    await records.ensureAccessoryWarehouseRecords()
    const source = master.listEnabledAccessoryWarehouseLocations('WH-FITTING-001')[0].id
    const puts: any[] = []
    for (let index = 0; index < 13; index++) {
      const id = `UI-${index + 1}`, prep = `PREP-${id}`, sku = `UI-ZIP-${index + 1}`
      const transfer = {
        id, preparationId: prep, productionOrderId: `PO-${id}`, kind: 'GTP_TO_SITE',
        fromWarehouse: 'WH-FITTING-001', toWarehouse: index === 2 ? null : index === 1 ? 'WH-FITTING-MAHAMERU' : 'HILON-2',
        status: index === 2 ? '待定调入方' : index === 3 ? '已出库待收货' : '待出库', version: 1,
        createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`, createdBy: '演示配料仓管', history: [{ action: '创建调拨单', by: '演示配料仓管', at: '2026-10-01T09:00:00.000Z', detail: '配齐后建立整单调拨，尚未确认出库。' }],
        lines: (index === 0 ? [6, 4] : [3]).map((qty, line) => ({ id: `${id}-L${line + 1}`, sourceLineId: `${prep}-L${line + 1}`, materialSku: sku, materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg', color: '黑色', spec: '60cm', unit: '条', purpose: '其他', requiresCutting: false, qty, fromLocationId: source })),
      }
      const preparation = { id: prep, productionOrderId: transfer.productionOrderId, productionOrderNo: `PO-UI-${String(index + 1).padStart(3, '0')}`, styleName: `演示款 ${index + 1}`, styleImageUrl: '/production-confirmation-demo/grey-zip-hoodie.png', techPackVersion: 'UI-V1', cuttingFactoryId: 'FIXTURE', cuttingFactoryName: index === 1 ? 'sea cutting2' : 'sea cutting', version: 1, status: '已配齐', remark: '', lines: transfer.lines.map(line => ({ ...line, id: line.sourceLineId, requiredQty: line.qty, preparedQty: line.qty, availableQty: 0, locationId: source })), history: [] }
      const total = transfer.lines.reduce((sum, line) => sum + line.qty, 0)
      const balance = { id: stock.getAccessoryStockId('WH-FITTING-001', source, sku, '条'), warehouseCode: 'WH-FITTING-001', locationId: source, materialSku: sku, unit: '条', onHandQty: index === 3 ? 0 : total, reservedQty: index === 3 ? 0 : total, version: 1, sourceRefs: index === 3 ? [] : [{ kind: 'RESERVATION', sourceId: prep, qty: total }] }
      puts.push(records.accessoryRecord('preparation', prep, preparation), records.accessoryRecord('transfer', id, transfer), records.accessoryRecord('stock', balance.id, balance))
      const receipt = commands.accessoryReceiptForTransfer(transfer as any)
      if (receipt) puts.push(records.accessoryRecord('receipt', receipt.id, index === 3 ? { ...receipt, status: '已取消', cancellationReason: '接收事项已替换' } : receipt))
    }
    await records.saveAccessoryWarehouseAction({ commandId: 'UI-FIXTURE-V1', intent: 'isolated transfer UI fixtures', result: true, change: { puts } })
  })
}
async function mount(page: Page, key: 'gtp' | 'hilon' | 'mahameru', view: 'transfers' | 'receipts' | 'stock') {
  await page.evaluate(async ({ key, view }) => {
    const records = await import('/src/data/wls/accessory-warehouse-records.ts')
    await records.ensureAccessoryWarehouseRecords()
    const ui = await import('/src/pages/wls/accessory-warehouses/transfers.ts')
    document.body.innerHTML = `<a href="/isolated-leave" data-nav="/isolated-leave">离开页面</a>${ui.renderAccessoryTransfersPage(key, view)}`
    if (!(globalThis as any).__transferUiBound) {
      for (const type of ['click', 'input', 'change']) document.body.addEventListener(type, event => {
        if (event.target instanceof HTMLElement) ui.handleAccessoryTransferEvent(event.target, event)
      })
      ;(globalThis as any).__transferUiBound = true
    }
  }, { key, view })
  await page.locator('[data-accessory-transfer-root]').waitFor()
}
async function snapshot(page: Page) { return page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()) }
async function query(page: Page, keyword: string) {
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(keyword)
  await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('[data-aw-transfer-workspace] tbody tr')).toHaveCount(1)
}
async function dispatch(page: Page, order: string) {
  await mount(page, 'gtp', 'transfers'); await query(page, order)
  await page.locator('[data-accessory-transfer-action="dispatch"]').click()
  const dialog = page.getByRole('dialog', { name: '整单确认出库', exact: true })
  await expect(dialog).toContainText('目的仓须另行确认收货')
  await dialog.getByRole('button', { name: '整单确认出库', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

test('GTP调拨创建后库存未出，整单出库才原子扣减；操作直接展示，待定及取消接收均不可执行', { timeout: 120000 }, async () => run(async page => {
  await mount(page, 'gtp', 'transfers')
  await expect(page.locator('[data-aw-transfer-workspace] tbody tr')).toHaveCount(10)
  await page.locator('[data-accessory-transfer-action="next-page"]').click()
  await expect(page.locator('[data-aw-transfer-workspace] tbody tr')).toHaveCount(3)
  await query(page, 'PO-UI-003')
  await expect(page.locator('[data-accessory-transfer-action="dispatch"]')).toBeDisabled()
  await query(page, 'PO-UI-001')
  const before = await snapshot(page)
  const balance = before.records.find(row => row.collection === 'accessory-warehouse:stock' && (row.value as any).materialSku === 'UI-ZIP-1')!.value as any
  assert.equal(balance.onHandQty, 10); assert.equal(balance.reservedQty, 10)
  await expect(page.locator('[data-accessory-transfer-field="role"]')).toHaveCount(0)
  await expect(page.locator('[data-accessory-transfer-action="dispatch"]')).toBeEnabled()
  await query(page, 'PO-UI-003')
  await page.locator('[data-accessory-transfer-action="dispatch"]').evaluate(element => element.removeAttribute('disabled'))
  await page.locator('[data-accessory-transfer-action="dispatch"]').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  assert.deepEqual(await snapshot(page), before)
  await dispatch(page, 'PO-UI-001')
  const after = await snapshot(page)
  const updated = after.records.find(row => row.id.endsWith('transfer:UI-1'))!.value as any
  assert.equal(updated.status, '已出库待收货')
  const out = after.records.find(row => row.collection === 'accessory-warehouse:stock' && (row.value as any).materialSku === 'UI-ZIP-1')!.value as any
  assert.equal(out.onHandQty, 0); assert.equal(out.reservedQty, 0)
  await mount(page, 'gtp', 'stock')
  await page.locator('[data-accessory-transfer-field="stockMode"]').selectOption('transit')
  await page.locator('[data-accessory-transfer-field="keyword"]').fill('PO-UI-001')
  await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('[data-aw-transfer-workspace] tbody tr')).toHaveCount(2)
  await expect(page.locator('[data-aw-transfer-workspace]')).toContainText('6 条')
  await mount(page, 'hilon', 'receipts'); await query(page, 'PO-UI-004')
  await expect(page.locator('[data-accessory-transfer-action="receive"]')).toBeDisabled()
  evidence.dispatch = { passed: true, physicalBefore: 10, physicalAfter: 0, inTransitLines: 2, fullActionsWithoutDemoRole: true, pendingDestinationSourceGuard: true, cancelledReceiptBlocked: true }
}))

test('HILON一次收货上架逐行阻断缺量、差量、错仓位，失败保留输入并用同命令重试，刷新同源回读', { timeout: 120000 }, async () => run(async page => {
  await dispatch(page, 'PO-UI-001')
  await page.evaluate(async () => {
    const records = await import('/src/data/wls/accessory-warehouse-records.ts')
    const change = { id: 'UI-REASSIGN-1', sourceTransferId: 'UI-1', fromWarehouse: 'HILON-2', toWarehouse: 'WH-FITTING-MAHAMERU', newFactoryId: 'UI-SEA2', newFactoryName: 'sea cutting2', reason: '在途改厂测试安排', status: '等待原仓收货', at: '2026-10-19T09:00:00.000Z', by: '演示计划员' }
    await records.saveAccessoryWarehouseAction({ commandId: 'UI-IN-TRANSIT-REASSIGN', intent: 'isolated waiting reassignment fixture', result: true, change: { puts: [records.accessoryRecord('change', change.id, change)] } })
  })
  await mount(page, 'hilon', 'receipts'); await query(page, 'PO-UI-001')
  await page.locator('[data-accessory-transfer-action="receive"]').click()
  const dialog = page.getByRole('dialog', { name: '确认收货并上架', exact: true })
  const before = await snapshot(page)
  await dialog.locator('[data-aw-transfer-qty]').first().fill('6')
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-aw-transfer-error]')).not.toBeEmpty()
  assert.deepEqual(await snapshot(page), before)
  const fields = dialog.locator('[data-aw-transfer-qty]'), locations = dialog.locator('[data-aw-transfer-location]')
  await fields.nth(1).fill('4')
  await locations.nth(0).selectOption({ label: 'HILON-A-01' }); await locations.nth(1).selectOption({ label: 'HILON-A-01' })
  await locations.nth(0).evaluate(async element => {
    const master = await import('/src/data/wls/accessory-warehouse-master.ts')
    const foreign = master.listEnabledAccessoryWarehouseLocations('WH-FITTING-MAHAMERU')[0]
    const option = new Option('错误仓位测试', foreign.id); element.append(option); element.value = foreign.id; element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-aw-transfer-error]')).toContainText('库位')
  assert.deepEqual(await snapshot(page), before)
  await locations.nth(0).selectOption({ label: 'HILON-A-01' }); await fields.nth(0).fill('5')
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-aw-transfer-error]')).toContainText('整单')
  await fields.nth(0).fill('6')
  page.once('dialog', async confirmation => { assert.equal(confirmation.type(), 'confirm'); await confirmation.dismiss() })
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    ;(globalThis as any).__originalTransferPut = IDBObjectStore.prototype.put
    ;(globalThis as any).__originalTransferUuid = crypto.randomUUID.bind(crypto)
    ;(globalThis as any).__transferUuidCalls = 0
    crypto.randomUUID = () => { (globalThis as any).__transferUuidCalls++; return (globalThis as any).__originalTransferUuid() }
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) { if (this.name === 'records') throw new DOMException('receive quota injection', 'QuotaExceededError'); return (globalThis as any).__originalTransferPut.apply(this, args) }
  })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-aw-transfer-error]')).toContainText('receive quota injection')
  assert.equal(await fields.nth(0).inputValue(), '6'); assert.equal(await fields.nth(1).inputValue(), '4')
  assert.deepEqual(await snapshot(page), before)
  const calls = await page.evaluate(() => (globalThis as any).__transferUuidCalls)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__originalTransferPut })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  assert.equal(await page.evaluate(() => (globalThis as any).__transferUuidCalls), calls)
  const after = await snapshot(page)
  const targetStocks = after.records.filter(row => row.collection === 'accessory-warehouse:stock' && (row.value as any).warehouseCode === 'HILON-2')
  assert.equal(targetStocks.length, 1); assert.equal((targetStocks[0].value as any).onHandQty, 10)
  assert.equal((after.records.find(row => row.id.endsWith('transfer:UI-1'))!.value as any).status, '已收货')
  const onward = after.records.filter(row => row.collection === 'accessory-warehouse:transfer' && (row.value as any).kind === 'SITE_REASSIGN')
  assert.equal(onward.length, 1); assert.equal((onward[0].value as any).fromWarehouse, 'HILON-2'); assert.equal((onward[0].value as any).toWarehouse, 'WH-FITTING-MAHAMERU')
  await expect(page.getByRole('status')).toContainText('已建立转往新仓的调拨单')
  await mount(page, 'hilon', 'stock')
  await page.locator('[data-accessory-transfer-field="keyword"]').fill('UI-ZIP-1')
  await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('[data-aw-transfer-workspace] tbody tr')).toHaveCount(1)
  await expect(page.locator('[data-aw-transfer-workspace]')).toContainText('10 条')
  await expect.poll(() => page.locator('[data-aw-transfer-workspace] tbody img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: resolve(output, 'hilon-received-stock-1366.png'), fullPage: true })
  // Reopening a new document and mounting only the read UI proves persistence.
  await page.reload(); await mount(page, 'hilon', 'receipts'); await query(page, 'PO-UI-001')
  await expect(page.locator('[data-aw-transfer-workspace]')).toContainText('已收货')
  assert.deepEqual(await snapshot(page), after)
  evidence.hilonReceipt = { passed: true, rowsAggregated: 2, stockRowsCreated: 1, receivedQty: 10, blockedMissingDifferenceForeignLocation: true, dirtyCloseProtected: true, failedInputsRetained: true, sameCommandRetry: true, reopenedReadMatches: true, waitingReassignmentForwardedToCommand: true, onwardTransferCount: 1 }
}))

test('Mahameru同一次收货流程、双层图片与1024窗口可达；1366/1280/1024三视图主体不溢出', { timeout: 120000 }, async () => run(async page => {
  await dispatch(page, 'PO-UI-002')
  await mount(page, 'mahameru', 'receipts'); await query(page, 'PO-UI-002')
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.locator('[data-accessory-transfer-action="receive"]').click()
  const dialog = page.getByRole('dialog', { name: '确认收货并上架', exact: true })
  await dialog.locator('[data-accessory-action="image"]').first().click()
  await expect(page.getByRole('dialog', { name: '演示款 2', exact: true })).toBeVisible()
  await expect.poll(() => page.getByRole('dialog', { name: '演示款 2', exact: true }).locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible()
  await dialog.locator('[data-accessory-action="image"]').last().click()
  const imageDialog = page.getByRole('dialog', { name: '拉链', exact: true })
  await expect(imageDialog).toBeVisible()
  await expect.poll(() => imageDialog.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape'); await expect(imageDialog).toHaveCount(0); await expect(dialog).toBeVisible()
  await page.route('**/materials/accessory-zipper.jpg?failure=*', route => route.abort('failed'))
  await dialog.locator('[data-accessory-action="image"]').last().evaluate(element => { (element as HTMLElement).dataset.image = '/materials/accessory-zipper.jpg?failure=stage2' })
  await dialog.locator('[data-accessory-action="image"]').last().click()
  await expect(imageDialog.getByText('图片加载失败，关闭后点击缩略图重试。', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(imageDialog).toHaveCount(0); await expect(dialog).toBeVisible()
  await page.unroute('**/materials/accessory-zipper.jpg?failure=*')
  await dialog.locator('[data-accessory-action="image"]').last().evaluate(element => { (element as HTMLElement).dataset.image = '/materials/accessory-zipper.jpg' })
  await dialog.locator('[data-aw-transfer-qty]').fill('3')
  await dialog.locator('[data-aw-transfer-location]').selectOption({ label: 'MAHAMERU-A-01' })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const stocks = (await snapshot(page)).records.filter(row => row.collection === 'accessory-warehouse:stock' && (row.value as any).warehouseCode === 'WH-FITTING-MAHAMERU')
  assert.equal(stocks.length, 1); assert.equal((stocks[0].value as any).onHandQty, 3)
  const layouts: any[] = []
  for (const width of [1366, 1280, 1024]) for (const view of ['transfers', 'receipts', 'stock'] as const) {
    await page.setViewportSize({ width, height: 768 }); await mount(page, view === 'transfers' ? 'gtp' : 'mahameru', view)
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth, root: document.querySelector('[data-accessory-transfer-root]')!.getBoundingClientRect().width }))
    assert.ok(dimensions.body <= width + 1, JSON.stringify({ view, ...dimensions })); layouts.push({ width, view, ...dimensions })
  }
  await expect.poll(() => page.locator('[data-aw-transfer-workspace] tbody img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: resolve(output, 'mahameru-stock-1024.png'), fullPage: true })
  evidence.mahameruAndLayout = { passed: true, receivedQty: 3, stackedStyleAndMaterialImageLoadEsc: true, imageFailureClosesToParent: true, layouts }
}))
