import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

let server: ViteDevServer, browser: Browser, base = ''
const output = resolve('output/verification/accessory-pickup-print-images-ui')
before(async () => {
  await mkdir(output, { recursive: true })
  server = await createServer({ root: process.cwd(), server: { port: 43247, strictPort: true, watch: { ignored: ['**/*'] } } }); await server.listen()
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`; browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })

async function issue(page: Page, mixed = false) {
  await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor()
  const fixture = await seedAccessorySewingFixture(page, mixed); assert.ok(!('error' in fixture))
  await page.goto(base + '/wls/accessory-warehouses/hilon/pickups'); await page.locator('[data-accessory-pickup-action="create"]').click()
  await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
  await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor()
  await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A'); await page.locator('[data-ppic-task-action="query"]').click()
  await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1)
  await page.locator('[data-ppic-task-action="print-pickup"]').click()
  await expect(page.locator('.print-card-title')).toHaveText(mixed ? '面辅料领料单' : '辅料领料单')
  return page.url()
}
async function facts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('higood-cutting-records-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const data = await new Promise<Record<string, unknown[]>>((resolve, reject) => {
      const tx = db.transaction(['records', 'commands', 'files'], 'readonly'), rows: Record<string, unknown[]> = {}
      for (const name of ['records', 'commands', 'files']) { const r = tx.objectStore(name).getAll(); r.onsuccess = () => { rows[name] = r.result } }
      tx.oncomplete = () => resolve(rows); tx.onabort = () => reject(tx.error)
    }); db.close(); return data
  })
}
async function loaded(page: Page) {
  await expect.poll(() => page.locator('[data-pickup-slip-preview] img[data-print-image]').evaluateAll((nodes: HTMLImageElement[]) => nodes.length > 0 && nodes.every(img => img.complete && img.naturalWidth > 0))).toBe(true)
  await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)
}

test('PPIC普通5图与混合8图逐图真实大图；缩略图和大图404可重试、Esc关闭，A4图数和比例保留', { timeout: 120000 }, async () => {
  const results: unknown[] = []
  for (const mixed of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.stack || error.message)); await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    try {
      let failPrice = !mixed
      await page.route('**/materials/accessory-flow/price-tag.jpg', route => failPrice ? route.fulfill({ status: 404, body: 'test image unavailable' }) : route.continue())
      await issue(page, mixed)
      const expected = mixed ? 8 : 5, imageButtons = page.locator('[data-pickup-slip-preview] [data-print-image-url]')
      await expect(imageButtons).toHaveCount(expected)
      await expect(page.locator('[data-pickup-slip-preview] img[data-print-image]')).toHaveCount(expected)
      const before = await facts(page)
      if (!mixed) {
        const price = page.locator('[data-print-image-frame]').filter({ has: page.locator('[data-print-image-url="/materials/accessory-flow/price-tag.jpg"]') })
        await expect(price.locator('[data-print-image-error]')).toBeVisible()
        await page.getByRole('button', { name: '打印', exact: true }).click()
        await expect(page.locator('[data-print-ready-feedback]')).toContainText('打印未开始')
        await price.locator('[data-print-image-url]').click()
        const dialog = page.getByRole('dialog'); await expect(dialog.locator('[data-print-large-image-status]')).toContainText('图片加载失败')
        await expect(dialog.getByRole('button', { name: '重试图片', exact: true })).toBeVisible()
        await page.screenshot({ path: resolve(output, 'large-image-404.png'), fullPage: true })
        failPrice = false
        await dialog.getByRole('button', { name: '重试图片', exact: true }).click()
        await expect.poll(() => dialog.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
        await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
        await price.getByRole('button', { name: '重试图片', exact: true }).click()
        await expect(price).toHaveAttribute('data-print-image-state', 'loaded'); await expect(price.locator('[data-print-image-error]')).toBeHidden()
      }
      await loaded(page)
      const seen: unknown[] = []
      for (let index = 0; index < expected; index++) {
        const button = imageButtons.nth(index), url = await button.getAttribute('data-print-image-url')
        await button.click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible()
        await expect.poll(() => dialog.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
        assert.equal(await dialog.locator('img').getAttribute('src'), url)
        const dimensions = await dialog.locator('img').evaluate((img: HTMLImageElement) => ({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: getComputedStyle(img).objectFit, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height }))
        assert.equal(dimensions.objectFit, 'contain'); assert.ok(dimensions.width <= 390 && dimensions.height <= 844)
        seen.push({ url, ...dimensions }); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      const layout = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }))
      assert.ok(layout.body <= layout.viewport + 1)
      await page.screenshot({ path: resolve(output, mixed ? 'mixed-eight-images-390.png' : 'accessory-five-images-390.png'), fullPage: true })
      if (mixed) await page.pdf({ path: resolve(output, 'mixed-pickup-interactive-images.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
      assert.deepEqual(await facts(page), before); assert.deepEqual(errors, [])
      results.push({ mixed, expectedImages: expected, openedActualImages: seen, layout, pageErrors: errors, recordsCommandsFilesUnchanged: true })
    } catch (error) { await page.screenshot({ path: resolve(output, mixed ? 'mixed-failure.png' : 'accessory-failure.png'), fullPage: true }).catch(() => {}); throw error }
    finally { await context.close() }
  }
  await writeFile(resolve(output, 'image-interactions.json'), JSON.stringify({ at: new Date().toISOString(), base, results }, null, 2))
})

test('持久PPIC凭证冷直达真实打印等待decode、字体和二维码；重复点击去重、离开取消与旧失败不污染新页', { timeout: 120000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), initial = await context.newPage()
  await initial.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  let page: Page = initial
  const errors: string[] = []
  try {
    const printUrl = await issue(initial), before = await facts(initial); await initial.close()
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.stack || error.message))
    await page.addInitScript(() => {
      const state = globalThis as any; state.__name = (value: unknown) => value; state.__pickupPrintCalls = 0; state.__pickupBeforeprint = 0; state.__pickupPending = []; state.__pickupHoldNext = false
      const native = window.print.bind(window); window.print = () => { state.__pickupPrintCalls++; native() }; addEventListener('beforeprint', () => state.__pickupBeforeprint++)
      const decode = HTMLImageElement.prototype.decode
      HTMLImageElement.prototype.decode = function () { const ready = decode.call(this); if (this.closest('[data-pickup-slip-preview]') && state.__pickupHoldNext) { state.__pickupHoldNext = false; return ready.then(() => new Promise<void>((resolve, reject) => state.__pickupPending.push({ resolve, reject }))) } return ready }
      const fonts = document.fonts.ready; Object.defineProperty(document.fonts, 'ready', { get: () => state.__pickupHoldFonts ? new Promise<void>(resolve => { state.__pickupReleaseFonts = () => fonts.then(() => resolve()) }) : fonts })
    })
    await page.goto(printUrl); await expect(page.locator('.print-card-title')).toHaveText('辅料领料单'); await loaded(page)
    const count = () => page.evaluate(() => ({ prints: (globalThis as any).__pickupPrintCalls, beforeprint: (globalThis as any).__pickupBeforeprint, pending: (globalThis as any).__pickupPending.length }))
    const flush = () => page.evaluate(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
    await page.evaluate(() => { const s = globalThis as any; s.__pickupHoldNext = true; s.__pickupHoldFonts = true; s.__pickupQr = document.querySelector('[data-real-qr] svg'); s.__pickupQr.remove() })
    await page.getByRole('button', { name: '打印', exact: true }).click()
    await expect.poll(async () => (await count()).pending).toBe(1); await expect(page.getByRole('button', { name: '打印', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '打印', exact: true }).click({ force: true }); assert.equal((await count()).prints, 0)
    await page.evaluate(() => { (globalThis as any).__pickupPending[0].resolve() }); await expect.poll(() => page.evaluate(() => typeof (globalThis as any).__pickupReleaseFonts)).toBe('function'); assert.equal((await count()).prints, 0)
    await page.evaluate(() => { const s = globalThis as any; s.__pickupHoldFonts = false; s.__pickupReleaseFonts() }); await flush(); assert.equal((await count()).prints, 0)
    await page.evaluate(() => document.querySelector('[data-real-qr]')!.append((globalThis as any).__pickupQr))
    await expect.poll(async () => (await count()).prints).toBe(1); await expect.poll(async () => (await count()).beforeprint).toBe(1)
    await expect(page.getByRole('button', { name: '打印', exact: true })).toBeEnabled()
    await page.evaluate(() => { (globalThis as any).__pickupHoldNext = true })
    await page.getByRole('button', { name: '打印', exact: true }).click(); await expect.poll(async () => (await count()).pending).toBe(2)
    await page.getByRole('button', { name: '返回业务单据', exact: true }).click(); await page.locator('[data-ppic-task-page]').waitFor()
    await page.evaluate(() => { (globalThis as any).__pickupPending[1].resolve() }); await flush(); assert.equal((await count()).prints, 1)
    await page.goBack(); await expect(page.locator('.print-card-title')).toHaveText('辅料领料单'); await loaded(page)
    await page.evaluate(() => { (globalThis as any).__pickupHoldNext = true })
    await page.getByRole('button', { name: '打印', exact: true }).click(); await expect.poll(async () => (await count()).pending).toBe(3)
    await page.getByRole('button', { name: '返回业务单据', exact: true }).click(); await page.locator('[data-ppic-task-page]').waitFor()
    await page.goBack(); await expect(page.locator('.print-card-title')).toHaveText('辅料领料单'); await loaded(page)
    await page.evaluate(() => { (globalThis as any).__pickupHoldNext = true })
    await page.getByRole('button', { name: '打印', exact: true }).click(); await expect.poll(async () => (await count()).pending).toBe(4)
    await page.evaluate(() => { (globalThis as any).__pickupPending[2].reject(new Error('late old page decode failure')) }); await flush()
    await expect(page.locator('[data-print-ready-feedback]')).toHaveText('正在准备图片和二维码…'); await expect(page.getByRole('button', { name: '打印', exact: true })).toBeDisabled()
    assert.equal((await count()).prints, 1)
    await page.evaluate(() => { (globalThis as any).__pickupPending[3].resolve() }); await expect.poll(async () => (await count()).prints).toBe(2)
    await expect(page.getByRole('button', { name: '打印', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '下载 PDF', exact: true }).click(); await expect.poll(async () => (await count()).prints).toBe(3)
    assert.deepEqual(await facts(page), before); assert.deepEqual(errors, [])
    await writeFile(resolve(output, 'cold-print-wait-guard.json'), JSON.stringify({ at: new Date().toISOString(), base, printUrl, coldPageUsedExistingPersistentCredential: true, nativePrintWrapperInvokedOriginal: true, decodeFontsAndActualQrWaited: true, repeatedPointerClickWhileDisabledDeduplicated: true, realReturnToBusinessButtonCancelsLatePrint: true, lateFailureDidNotPolluteNewPageOrClearItsLock: true, freshPageAndPdfCanPrint: true, recordsCommandsFilesUnchanged: true, final: await count(), pageErrors: errors }, null, 2))
  } catch (error) { await page.screenshot({ path: resolve(output, 'cold-print-wait-failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, 'cold-print-wait-failure.json'), JSON.stringify({ error: String(error), url: page.url(), text: await page.locator('body').innerText().catch(() => ''), pageErrors: errors }, null, 2)); throw error }
  finally { await context.close() }
})
