import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

let server: ViteDevServer, browser: Browser, base = ''
const output = resolve('output/verification/accessory-combined-sewing')
const gtpPath = '/wls/accessory-warehouses/gtp/preparation'
before(async () => {
  await mkdir(output, { recursive: true })
  server = await createServer({ root: process.cwd(), server: { port: 0, watch: { ignored: ['**/*'] } } })
  await server.listen(); base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })
async function initialize(page: Page) {
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.goto(base + gtpPath); await page.locator('[data-accessory-preparation-root]').waitFor()
}
async function createPickups(page: Page) {
  await page.goto(base + '/wls/accessory-warehouses/hilon/pickups')
  await page.locator('[data-accessory-pickup-action="create"]').click()
  await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
}

test('AC24 车缝加烫包实际有效任务scope按各SKU建全辅料领料清单，零后道调拨与DLN收货事项', { timeout: 90000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), page = await context.newPage()
  try {
    await initialize(page); const fixture = await seedAccessorySewingFixture(page, 'SEWING_IRONING_PACKING')
    await createPickups(page)
    const result = await page.evaluate(async () => {
      const rec = await import('/src/data/wls/accessory-warehouse-records.ts'), api = await import('/src/data/wls/accessory-warehouse-sewing.ts')
      return { pickups: api.listAccessorySewingPickups(), transfers: rec.listAccessoryRecords<any>('transfer'), receipts: rec.listAccessoryRecords<any>('receipt') }
    })
    assert.equal(result.pickups.length, 2)
    for (const [index, factor] of [0.4, 0.6].entries()) {
      const pickup = result.pickups.find(row => row.assignmentId === `AW-TEST-ASG-${index}`)!
      assert.ok(pickup); assert.equal(pickup.lines.length, 6)
      assert.deepEqual(Object.fromEntries(pickup.lines.map(row => [row.materialSku, row.requiredQty])), { 'AW-DEMO-ZIPPER': 100 * factor, 'AW-DEMO-BUTTON': 200 * factor, 'AW-DEMO-PRICE-TAG': 100 * factor, 'AW-DEMO-BRAND-TAG': 100 * factor, 'AW-DEMO-TAG-FASTENER': 100 * factor, 'AW-DEMO-SEWING-THREAD': factor })
      assert.match(pickup.taskVersion, /SEWING_IRONING_PACKING/)
    }
    assert.equal(result.transfers.filter(row => row.kind === 'SITE_TO_POST').length, 0); assert.equal(result.receipts.filter(row => row.warehouseCode === 'DLN').length, 0)
    await page.screenshot({ path: resolve(output, 'sewing-iron-pickups-1024.png'), fullPage: true })
    await writeFile(resolve(output, 'sewing-iron-pickups.json'), JSON.stringify({ at: new Date().toISOString(), base, fixture, result, actualCreateButton: true, noSiteToPost: true, noDlnReceipt: true }, null, 2))
  } catch (error) { await page.screenshot({ path: resolve(output, 'sewing-iron-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
})
