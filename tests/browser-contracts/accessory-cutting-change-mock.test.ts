import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium, expect, type Page, type Browser } from '@playwright/test'

const server = process.env.ACCESSORY_CHANGE_TEST_URL ? undefined : await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
await server?.listen()
const address = server?.httpServer?.address()
const base = process.env.ACCESSORY_CHANGE_TEST_URL || `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'only isolated local contexts may mutate records')
const output = process.env.ACCESSORY_CHANGE_TEST_OUTPUT || 'output/verification/accessory-cutting-change-mock/browser'
let browser: Browser
const results: unknown[] = []
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch() })
after(async () => { await browser?.close(); await server?.close(); await writeFile(`${output}/results.json`, JSON.stringify({ base, results }, null, 2)) })
async function facts(page: Page) {
  return page.evaluate(async () => {
    const repo = await import('/src/data/wls/accessory-warehouse-records.ts')
    await repo.ensureAccessoryWarehouseRecords()
    const tasks = await import('/src/data/fcs/runtime-process-tasks.ts')
    return { physical: repo.currentAccessorySnapshot(), records: repo.mergeAccessoryMockRecords(repo.listAccessoryMockRecordSources(), repo.currentAccessorySnapshot().records), tasks: tasks.listRuntimeProcessTasks() }
  })
}
type Facts = Awaited<ReturnType<typeof facts>>
function rows(state: Facts, kind: string, order: string): any[] {
  return state.records.filter(row => row.collection === `accessory-warehouse:${kind}`).map(row => row.value as any)
    .filter(row => row.productionOrderId === order || (kind === 'receipt' && rows(state, 'transfer', order).some(t => t.id === row.transferId))
      || (kind === 'change' && rows(state, 'transfer', order).some(t => t.id === row.sourceTransferId)))
}
const stocks = (state: Facts, key: string) => state.records.filter(row => row.collection === 'accessory-warehouse:stock').map(row => row.value as any).filter(row => row.materialSku.startsWith(`AW-SCENE-${key}-`))
function conserved(state: Facts, key: string) {
  const order = `PO-AW-202610-${key}`, ts = rows(state, 'transfer', order)
  for (const material of ['ZIPPER', 'BUTTON', 'PRICE-TAG', 'BRAND-TAG', 'TAG-FASTENER', 'SEWING-THREAD']) {
    const sku = `AW-SCENE-${key}-${material}`, actual = stocks(state, key).filter(s => s.materialSku === sku).reduce((sum, s) => sum + s.onHandQty, 0)
      + ts.filter(t => t.status === '已出库待收货').flatMap(t => t.lines).filter((l: any) => l.materialSku === sku).reduce((sum: number, l: any) => sum + l.qty, 0)
    assert.ok(Math.abs(actual - (material === 'BUTTON' ? 1200 : material === 'SEWING-THREAD' ? 12 : 600)) < 0.000001, `${key}/${material} stock + transit conserved`)
  }
}
async function query(page: Page, site: string, view: string, order: string) {
  await page.goto(`${base}/wls/accessory-warehouses/${site}/${view}`)
  await page.locator('[data-accessory-transfer-field="keyword"]').fill(order)
  await page.locator('[data-accessory-transfer-action="query"]').click()
  await expect(page.locator('main tbody')).toContainText(order)
}
async function dispatch(page: Page, site: string, order: string, id: string) {
  await query(page, site, 'transfers', order)
  await page.locator(`[data-accessory-transfer-action="dispatch"][data-id="${id}"]`).click()
  const dialog = page.getByRole('dialog', { name: '整单确认出库', exact: true })
  await dialog.locator('[data-accessory-transfer-action="save"]').click()
  await expect(dialog).not.toBeVisible()
}
async function receive(page: Page, site: string, order: string, transfer: any, checkDifference = false) {
  const before = await facts(page), receipt = rows(before, 'receipt', order).find(r => r.transferId === transfer.id && r.status === '待收货')
  assert.ok(receipt)
  await query(page, site, 'receipts', order)
  await page.locator(`[data-accessory-transfer-action="receive"][data-id="${receipt.id}"]`).click()
  const dialog = page.getByRole('dialog', { name: '确认收货并上架', exact: true })
  for (const line of transfer.lines) {
    await dialog.locator(`[data-aw-transfer-qty="${line.id}"]`).fill(String(line.qty))
    await dialog.locator(`[data-aw-transfer-location="${line.id}"]`).selectOption({ index: 1 })
  }
  if (checkDifference) {
    await dialog.locator('[data-aw-transfer-qty]').first().fill('99')
    await dialog.locator('[data-accessory-transfer-action="save"]').click()
    await expect(dialog.locator('[data-aw-transfer-error]')).toContainText('实收与应收')
    assert.deepEqual((await facts(page)).physical, before.physical, 'short receipt cannot commit stock, receipt or onward transfer')
    await dialog.locator('[data-aw-transfer-qty]').first().fill('100')
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put
      ;(globalThis as any).__changeOriginalPut = original
      IDBObjectStore.prototype.put = function (...args: any[]) {
        if (this.name === 'records' && args[0]?.value?.kind === 'SITE_REASSIGN') throw new DOMException('isolated onward quota failure', 'QuotaExceededError')
        return original.apply(this, args as any)
      }
    })
    await dialog.locator('[data-accessory-transfer-action="save"]').click()
    await expect(dialog.locator('[data-aw-transfer-error]')).not.toBeEmpty()
    await expect(dialog.locator('[data-aw-transfer-qty]').first()).toHaveValue('100')
    assert.deepEqual((await facts(page)).physical, before.physical, 'onward creation failure aborts original receipt and stock in same transaction')
    await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__changeOriginalPut })
  }
  await dialog.locator('[data-accessory-transfer-action="save"]').click()
  await expect(dialog).not.toBeVisible()
  return facts(page)
}
async function reassign(page: Page, key: string, factory: string, failAndRetry = false, blocked = false) {
  await page.goto(`${base}/fcs/dispatch/workbench?type=NON_SEWING`)
  await page.locator('[data-unified-field="keyword"]').fill(`PO-AW-202610-${key}`)
  await page.locator(`[data-unified-action="open-reassign"][data-task-id="TASKGEN-AW-202610-${key}-001__ORDER"]`).click()
  await page.locator('[data-unified-field="factoryId"]').selectOption(factory)
  await page.locator('[data-unified-field="price"]').fill('1000')
  await page.locator('[data-unified-field="reassignReason"]').fill('裁剪改厂三阶段实物流转验收')
  await page.locator('[data-unified-action="confirm-dispatch"]').click()
  const before = failAndRetry || blocked ? await facts(page) : null
  if (failAndRetry) await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    ;(globalThis as any).__changeOriginalPut = original
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (this.name === 'records' && String(args[0]?.id).startsWith('accessory-warehouse:receipt:')) throw new DOMException('isolated reassign quota failure', 'QuotaExceededError')
      return original.apply(this, args as any)
    }
  })
  await page.getByRole('button', { name: '确认提交并冻结价格', exact: true }).click()
  if (failAndRetry || blocked) {
    await expect(page.locator('[data-unified-dispatch-overlay]')).toContainText(blocked ? '不能按原整包改厂' : /失败|空间|quota/i)
    await expect(page.locator('[data-unified-dispatch-overlay]')).toContainText('1000')
    await expect(page.locator('[data-unified-dispatch-overlay]')).toContainText('裁剪改厂三阶段实物流转验收')
    assert.deepEqual((await facts(page)).physical, before!.physical, 'failed source transaction cannot half-save task or accessory records')
    assert.deepEqual((await facts(page)).tasks.find(t => t.taskId === `TASKGEN-AW-202610-${key}-001__ORDER`), before!.tasks.find(t => t.taskId === `TASKGEN-AW-202610-${key}-001__ORDER`))
    if (blocked) return
    await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__changeOriginalPut })
    await page.getByRole('button', { name: '确认提交并冻结价格', exact: true }).click()
  }
  await expect(page.locator('[data-unified-action="confirm-dispatch"]')).toHaveCount(0)
}

for (const original of ['H', 'M'] as const) for (const stage of [7, 8, 9]) {
  const key = `${original}${String(stage).padStart(2, '0')}`
  test(`AC-02～08 ${key} 真实改派、原仓先收与全量仓间流转`, { timeout: 150000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, timezoneId: 'Asia/Shanghai' }), page = await context.newPage()
    await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
    const order = `PO-AW-202610-${key}`, from = original === 'H' ? 'hilon' : 'mahameru', to = original === 'H' ? 'mahameru' : 'hilon'
    const fromCode = original === 'H' ? 'HILON-2' : 'WH-FITTING-MAHAMERU', toCode = original === 'H' ? 'WH-FITTING-MAHAMERU' : 'HILON-2'
    try {
      await page.goto(`${base}/wls/accessory-warehouses/gtp/transfers`)
      await page.locator('[data-accessory-transfer-root]').waitFor()
      const before = await facts(page), originalTransfer = rows(before, 'transfer', order)[0], oldReceipt = rows(before, 'receipt', order)[0]
      assert.equal(before.physical.records.length, 0, 'direct Mock display does not copy static records')
      assert.equal(originalTransfer.toWarehouse, fromCode); conserved(before, key)
      await reassign(page, key, original === 'H' ? 'SEA-CUTTING-002' : 'SEA-CUTTING-001', key === 'H07')
      const changed = await facts(page), prep = rows(changed, 'preparation', order)[0], changedTransfer = rows(changed, 'transfer', order).find(t => t.kind === 'GTP_TO_SITE')
      assert.equal(prep.cuttingFactoryName, original === 'H' ? 'sea cutting2' : 'sea cutting', 'actual source save must include static accessory preparation')
      assert.equal(changed.physical.revision, before.physical.revision + 1, 'task + accessory consequences commit once')
      assert.deepEqual(stocks(changed, key), stocks(before, key), 'reassignment alone never moves physical stock')
      assert.ok(changed.physical.records.filter(r => r.id.startsWith('accessory-warehouse:')).every(r => JSON.stringify(r).includes(key)), 'only this order changes; no seed package is persisted')
      let onward: any
      if (stage === 7) {
        assert.equal(changedTransfer.id, originalTransfer.id); assert.equal(changedTransfer.toWarehouse, toCode)
        assert.equal(rows(changed, 'receipt', order).find(r => r.id === oldReceipt.id).status, '已取消')
        assert.equal(rows(changed, 'transfer', order).length, 1)
        await dispatch(page, 'gtp', order, changedTransfer.id)
        await receive(page, to, order, changedTransfer)
      } else {
        assert.deepEqual(changedTransfer, originalTransfer)
        assert.deepEqual(rows(changed, 'receipt', order).find(r => r.id === oldReceipt.id), oldReceipt)
        if (stage === 8) {
          assert.equal(rows(changed, 'change', order)[0].status, '等待原仓收货')
          assert.equal(rows(changed, 'transfer', order).length, 1)
          assert.equal(rows(changed, 'receipt', order).some(r => r.warehouseCode === toCode), false, 'new destination has no receipt before original warehouse receives')
          const received = await receive(page, from, order, originalTransfer, true)
          assert.equal(received.physical.revision, changed.physical.revision + 1, 'old receipt + new transfer + stock in one commit')
          assert.equal(rows(received, 'change', order)[0].status, '待仓间调拨')
          onward = rows(received, 'transfer', order).find(t => t.kind === 'SITE_REASSIGN')
        } else onward = rows(changed, 'transfer', order).find(t => t.kind === 'SITE_REASSIGN')
        assert.ok(onward); assert.equal(onward.fromWarehouse, fromCode); assert.equal(onward.toWarehouse, toCode)
        assert.equal(onward.sourceTransferId, originalTransfer.id)
        assert.deepEqual(onward.lines.map((l: any) => [l.materialSku, l.qty, l.unit]), originalTransfer.lines.map((l: any) => [l.materialSku, l.qty, l.unit]))
        const waiting = await facts(page); conserved(waiting, key)
        assert.equal(stocks(waiting, key).filter(s => s.warehouseCode === toCode).length, 0, 'creating transfer never creates destination stock')
        await query(page, to, 'receipts', order)
        await expect(page.locator(`[data-accessory-transfer-action="receive"][data-id="${rows(waiting, 'receipt', order).find(r => r.transferId === onward.id).id}"]`)).toBeDisabled()
        await dispatch(page, from, order, onward.id)
        const transit = await facts(page); conserved(transit, key)
        assert.ok(stocks(transit, key).filter(s => s.warehouseCode === fromCode).every(s => s.onHandQty === 0))
        await receive(page, to, order, onward)
      }
      const final = await facts(page); conserved(final, key)
      assert.ok(rows(final, 'transfer', order).every(t => t.status === '已收货'))
      assert.ok(rows(final, 'receipt', order).filter(r => r.status !== '已取消').every(r => r.status === '已收货'))
      const durable = final.physical
      await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
      assert.deepEqual((await facts(page)).physical, durable)
      const next = await context.newPage(); await next.goto(`${base}/wls/accessory-warehouses/${to}/stock`)
      await next.locator('[data-accessory-transfer-root]').waitFor()
      assert.deepEqual((await facts(next)).physical, durable, 'downstream direct entry independently reads same saved state')
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `${output}/${key}-received.png`, fullPage: true })
      results.push({ key, passed: true, before, changed, final })
    } catch (error) {
      results.push({ key, passed: false, error: String(error), state: await facts(page).catch(() => null), text: await page.locator('body').innerText() })
      await page.screenshot({ path: `${output}/${key}-failure.png`, fullPage: true }); throw error
    } finally { await context.close() }
  })
}

test('AC-01/03～06/10 六张已改厂静态单直达可见，三视口图片完整并可继续原仓收货/仓间全流程', { timeout: 180000 }, async () => {
  for (const width of [1366, 1280, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 768 }, timezoneId: 'Asia/Shanghai' })
    const page = await context.newPage()
    await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    try {
      for (const route of ['gtp/preparation', 'gtp/transfers', 'hilon/receipts', 'hilon/transfers', 'mahameru/receipts', 'mahameru/transfers']) {
        await page.goto(`${base}/wls/accessory-warehouses/${route}`)
        await expect(page.locator('main table').first()).toBeVisible()
        const example = route === 'gtp/preparation' ? 'H11' : route === 'gtp/transfers' ? 'H10' : route.startsWith('hilon') ? (route.endsWith('receipts') ? 'H11' : 'H12') : (route.endsWith('receipts') ? 'M11' : 'M12')
        const field = route === 'gtp/preparation' ? 'accessory' : 'accessory-transfer'
        await page.locator(`[data-${field}-field="keyword"]`).fill(`PO-AW-202610-${example}`)
        await page.locator(`[data-${field}-action="query"]`).click()
        if (field === 'accessory') await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(1)
        else await expect(page.locator('main tbody tr')).toHaveCount(1)
        await expect(page.locator('main')).toContainText(`PO-AW-202610-${example}`)
        await expect(page.locator('main')).toContainText('已改厂')
        const images = await page.locator('main img').evaluateAll(async (nodes: HTMLImageElement[]) => {
          nodes.forEach(img => { img.loading = 'eager' }); await Promise.all(nodes.map(img => img.decode()))
          return nodes.map(img => ({ src: img.getAttribute('src'), valid: img.naturalWidth > 0 }))
        })
        assert.ok(images.length > 0 && images.every(img => img.valid))
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        assert.equal((await facts(page)).physical.records.length, 0)
        await page.screenshot({ path: `${output}/${width}-${route.replaceAll('/', '-')}.png`, fullPage: true })
      }
      if (width !== 1366) continue
      for (const original of ['H', 'M']) for (const stage of [10, 11, 12]) {
        const key = `${original}${stage}`, order = `PO-AW-202610-${key}`, from = original === 'H' ? 'hilon' : 'mahameru', to = original === 'H' ? 'mahameru' : 'hilon'
        const initial = await facts(page), transfer = rows(initial, 'transfer', order).find(t => t.kind === 'GTP_TO_SITE')
        let onward: any
        if (stage === 10) {
          await dispatch(page, 'gtp', order, transfer.id); await receive(page, to, order, transfer)
        } else {
          if (stage === 11) {
            assert.equal(rows(initial, 'change', order)[0].status, '等待原仓收货')
            assert.equal(rows(initial, 'transfer', order).length, 1)
            const received = await receive(page, from, order, transfer)
            onward = rows(received, 'transfer', order).find(t => t.kind === 'SITE_REASSIGN')
          } else onward = rows(initial, 'transfer', order).find(t => t.kind === 'SITE_REASSIGN')
          assert.ok(onward); await dispatch(page, from, order, onward.id); await receive(page, to, order, onward)
        }
        const final = await facts(page); conserved(final, key)
        assert.ok(rows(final, 'transfer', order).every(t => t.status === '已收货'))
        await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
        assert.deepEqual((await facts(page)).physical, final.physical)
        results.push({ key, passed: true, initial, final })
      }
    } finally { await context.close() }
  }
})

test('AC-08 已有车缝实交/后道发出的固定样例仍阻断整包改厂，任务和原历史不变', { timeout: 60000 }, async () => {
  const context = await browser.newContext(), page = await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try { await reassign(page, 'H05', 'SEA-CUTTING-002', false, true); assert.deepEqual(errors, []) } finally { await context.close() }
})
