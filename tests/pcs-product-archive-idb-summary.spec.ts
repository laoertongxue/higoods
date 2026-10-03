import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

// Standalone Vite browser regression. The fixture is confined to a fresh context.
const baseURL = process.env.PCS_CHECK_URL || 'http://127.0.0.1:5173'
const output = path.resolve('output/playwright/pcs-consistency/archive-idb-summary')
fs.mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const evidence: any[] = [], errors: string[] = []
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await context.addInitScript('globalThis.__name = (value) => value')
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${baseURL}/pcs/products/styles`)
  await page.locator('[data-pcs-product-archive-field="style-list-search"]').waitFor()
  const fixture = await page.evaluate(async () => {
    // @ts-ignore Test-only Vite fixture setup; application actions are not called through hidden APIs.
    const rt = await import('/src/data/pcs-record-runtime.ts')
    // @ts-ignore Vite module.
    const sku = await import('/src/data/pcs-sku-archive-repository.ts')
    // @ts-ignore Vite module.
    const style = await import('/src/data/pcs-style-archive-repository.ts')
    await rt.ensurePcsRecordState()
    const original = sku.listSkuArchives().find((item: any) => item.styleId === 'style_demand_SPU_QC_001')!
    if (!original) throw new Error('Expected static SKU fixture is missing')
    await rt.runPcsRecordCommand(() => {
      sku.updateSkuArchive(original.skuId, { mappingHealth: 'CONFLICT' })
      sku.createSkuArchive({ ...original, skuId: 'QA-IDB-SUMMARY-EXTRA', skuCode: 'QA-IDB-SUMMARY-EXTRA', mappingHealth: 'MISSING' })
      // Explicitly model an older cached aggregate that no longer matches the SKU facts.
      style.updateStyleArchive(original.styleId, { specificationCount: 777 })
    })
    if (localStorage.getItem('higood-pcs-sku-archive-store-v1') !== null) throw new Error('Fixture unexpectedly wrote the retired SKU key')
    return { styleId: original.styleId, styleCode: original.styleCode, expectedCount: sku.listSkuArchivesByStyleId(original.styleId).length, staleStyleCount: 777 }
  })
  for (const blocked of [false, true]) {
    if (blocked) await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked for regression test', 'SecurityError') } })
    })
    await page.reload()
    try { await page.locator('[data-pcs-product-archive-field="style-list-search"]').waitFor({ timeout: 10000 }) } catch (error) { evidence.push({ localStorageBlocked: blocked, failure: String(error), body: await page.locator('body').innerText() }); await page.screenshot({ path: path.join(output, 'blocked-failure.png') }); throw error }
    const row = page.locator('main tbody tr').filter({ has: page.locator(`[data-nav="/pcs/products/styles/${fixture.styleId}"]`) }).first()
    await row.waitFor()
    const headers = await page.locator('main thead th').allTextContents()
    const countIndex = headers.findIndex(text => text.trim() === '规格数')
    assert.ok(countIndex >= 0)
    const count = (await row.locator('td').nth(countIndex).innerText()).trim()
    const text = await row.innerText()
    assert.equal(count, String(fixture.expectedCount), 'Style list must count the current SKU records, not the stale style aggregate')
    assert.ok(text.includes('冲突'), 'Style list must reflect persisted SKU mapping conflicts after legacy-key removal')
    evidence.push({ localStorageBlocked: blocked, ...fixture, renderedCount: count, renderedMappingConflict: text.includes('冲突') })
    await page.screenshot({ path: path.join(output, blocked ? 'local-storage-blocked.png' : 'legacy-key-empty.png') })
  }
  assert.equal(errors.length, 0, errors.join('\n'))
  await context.close()
  console.log('PCS款式列表：SKU旧键为空、IDB数量与映射汇总、localStorage禁用读取均通过')
} finally {
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ baseURL, evidence, errors }, null, 2))
  await browser.close()
}
