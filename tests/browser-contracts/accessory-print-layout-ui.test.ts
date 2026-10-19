import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

let server: ViteDevServer, browser: Browser, base = ''
const evidenceDir = resolve('output/verification/accessory-print-layout-ui'), pdfDir = resolve('output/pdf/accessory-warehouse')
before(async () => {
  await mkdir(evidenceDir, { recursive: true }); await mkdir(pdfDir, { recursive: true })
  server = await createServer({ root: process.cwd(), server: { port: 43247, strictPort: true, watch: { ignored: ['**/*'] } } }); await server.listen()
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`; browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })
async function images(page: Page, selector: string) {
  await expect.poll(async () => page.locator(selector).evaluateAll((nodes: HTMLImageElement[]) => nodes.length > 0 && nodes.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
  return page.locator(selector).evaluateAll((nodes: HTMLImageElement[]) => nodes.map(image => ({ alt: image.alt, src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight })))
}
async function layout(page: Page) {
  return page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }))
}
async function observeActualPrintButton(page: Page, button: ReturnType<Page['getByRole']>) {
  await page.evaluate(() => { (globalThis as any).__printButtonObserved = false; addEventListener('beforeprint', () => { (globalThis as any).__printButtonObserved = true }, { once: true }) })
  await button.click()
  await expect.poll(() => page.evaluate(() => Boolean((globalThis as any).__printButtonObserved))).toBe(true)
}
test('实际PPIC打印凭证的390预览与同二维码扫码页，以及原始PPIC/GTP打印PDF证据', { timeout: 150000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor()
    const fixture = await seedAccessorySewingFixture(page); assert.ok(!('error' in fixture))
    await page.goto(base + '/wls/accessory-warehouses/hilon/pickups'); await page.locator('[data-accessory-pickup-action="create"]').click()
    await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
    await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor()
    await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A'); await page.locator('[data-ppic-task-action="query"]').click()
    await page.locator('[data-ppic-task-page] tbody tr').filter({ hasText: 'AW-SEW-A' }).locator('[data-ppic-task-action="print-pickup"]').click()
    await expect(page).toHaveURL(/print/); await page.locator('.print-preview-root').waitFor()
    const version = await page.evaluate(async () => (await import('/src/data/fcs/sewing-pickup-slips.ts')).getCurrentSewingPickupSlip('AW-TEST-ASG-0', 'ACCESSORY')!)
    const printUrl = page.url(), printImages = await images(page, '.print-preview-root img')
    assert.equal(version.versionLabel, 'V1'); assert.equal(printImages.length, 5)
    await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)
    const qr = await page.locator('[data-real-qr]').getAttribute('data-qr-value')
    const targetRoute = new URLSearchParams(qr!).get('targetRoute')!
    assert.equal(new URLSearchParams(qr!).get('sourceId'), version.versionId)
    assert.ok(targetRoute.includes(encodeURIComponent(version.versionId)))
    const factsBeforePrint = await page.evaluate(async () => {
      const data = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
      return { records: data.records, commands: data.commands, fileIds: data.files.map(row => row.id) }
    })
    await page.screenshot({ path: resolve(evidenceDir, 'ppic-print-desktop.png'), fullPage: true })
    await observeActualPrintButton(page, page.getByRole('button', { name: '打印', exact: true }))
    await page.pdf({ path: resolve(pdfDir, 'ppic-accessory-pickup-v1.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const preview390 = await layout(page)
    await page.screenshot({ path: resolve(evidenceDir, 'ppic-preview-390.png'), fullPage: true })
    assert.ok(preview390.body <= preview390.viewport + 1, `电子预览不得扩大整页宽度：${JSON.stringify(preview390)}`)
    const previewRegion = page.getByRole('region', { name: '领料单预览，可左右滚动', exact: true })
    await expect(previewRegion).toHaveAttribute('tabindex', '0')
    await previewRegion.focus(); await previewRegion.press('ArrowRight')
    await expect.poll(() => previewRegion.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
    await previewRegion.hover(); await page.mouse.wheel(800, 0)
    await expect.poll(() => page.locator('[data-real-qr]').evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(391)
    await page.screenshot({ path: resolve(evidenceDir, 'ppic-preview-390-right.png'), fullPage: true })
    await page.evaluate(async () => {
      const pda = await import('/src/data/fcs/store-domain-pda.ts'), user = pda.listFactoryPdaUsers('ID-F004').find(row => row.roleId === 'ROLE_ADMIN')!
      pda.setPdaSession(pda.createPdaSessionFromUser(user))
    })
    await page.goto(base + targetRoute)
    const link = page.getByRole('link', { name: /办理车缝领料/ }); await expect(link).toBeVisible()
    await expect(page.locator('main')).toContainText(version.slipNo); await expect(page.locator('main')).toContainText('V1')
    const scan390 = await layout(page); await page.screenshot({ path: resolve(evidenceDir, 'ppic-qr-scan-390.png'), fullPage: true })
    await link.click(); await page.getByRole('dialog', { name: '登记车缝领料实交', exact: true }).waitFor()
    const destinationImages = await images(page, '[data-aw-pickup-modal] img')
    const destination390 = await layout(page); await page.screenshot({ path: resolve(evidenceDir, 'qr-to-warehouse-390.png'), fullPage: true })
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor()
    await page.locator('[data-accessory-field="keyword"]').fill(fixture.productionOrderId!); await page.locator('[data-accessory-action="query"]').click()
    await page.locator(`[data-accessory-action="print"][data-id="${fixture.preparationId}"]`).click()
    const gtp = page.getByRole('dialog', { name: '配料凭证', exact: true }); await expect(gtp).toBeVisible()
    const gtpImages = await images(page, '[data-aw-print] img'), gtpText = await page.locator('[data-aw-print]').innerText()
    assert.equal(gtpImages.length, 6); assert.match(gtpText, /配料版本/); assert.match(gtpText, /公斤/)
    await page.screenshot({ path: resolve(evidenceDir, 'gtp-print-desktop.png'), fullPage: true })
    await observeActualPrintButton(page, gtp.getByRole('button', { name: '打印配料凭证', exact: true }))
    await page.pdf({ path: resolve(pdfDir, 'gtp-preparation.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
    await expect(page.locator('[data-aw-print-document]')).toHaveCount(0)
    await expect(gtp).toBeVisible(); await expect(gtp.locator('[data-aw-print] tbody tr')).toHaveCount(6)
    const factsAfterPrint = await page.evaluate(async () => {
      const data = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
      return { records: data.records, commands: data.commands, fileIds: data.files.map(row => row.id) }
    })
    assert.deepEqual(factsAfterPrint, factsBeforePrint)
    const metadata = { at: new Date().toISOString(), base, fixture, version, printUrl, qr, targetRoute, printImages, preview390, scan390, destination390, destinationImages, gtpImages, gtpText, actualPpicPrintButtonBeforeprint: true, actualGtpPrintButtonBeforeprint: true, afterprintCloneRemoved: true, printDidNotChangeRecordsCommandsOrFiles: true, pageErrors: errors, pdfBoundary: '真实按钮触发原生beforeprint，再使用Chromium headless page.pdf；未使用实体打印机。PDF使用产品print媒体样式，不在测试注入修正版式。' }
    await writeFile(resolve(evidenceDir, 'print-layout.json'), JSON.stringify(metadata, null, 2))
    assert.deepEqual(errors, [])
  } catch (error) { await page.screenshot({ path: resolve(evidenceDir, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(evidenceDir, 'failure.json'), JSON.stringify({ at: new Date().toISOString(), error: String(error), pageErrors: errors, url: page.url() }, null, 2)); throw error }
  finally { await context.close() }
})

test('GTP真实打印等待期间关闭与站内换仓取消旧任务，晚到失败不污染新凭证且不清除新打印去重', { timeout: 90000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  const flush = () => page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
  const count = () => page.evaluate(() => ({ prints: (globalThis as any).__gtpPrintEvents, nativePrintCalls: (globalThis as any).__gtpNativePrintCalls, decodes: (globalThis as any).__gtpDecodeCalls, pending: (globalThis as any).__gtpPendingDecodes.length }))
  try {
    await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor()
    const fixture = await seedAccessorySewingFixture(page); assert.ok(!('error' in fixture))
    const facts = () => page.evaluate(async () => {
      const data = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
      return { records: data.records, commands: data.commands, fileIds: data.files.map(row => row.id) }
    })
    const before = await facts()
    const open = async () => {
      await page.locator('[data-accessory-field="keyword"]').fill(fixture.productionOrderId!); await page.locator('[data-accessory-action="query"]').click()
      await page.locator(`[data-accessory-action="print"][data-id="${fixture.preparationId}"]`).click()
      const dialog = page.getByRole('dialog', { name: '配料凭证', exact: true }); await expect(dialog).toBeVisible(); await images(page, '[data-aw-print] img'); return dialog
    }
    let dialog = await open()
    await page.evaluate(() => {
      const state = globalThis as any; state.__gtpOriginalDecode = HTMLImageElement.prototype.decode
      state.__gtpPendingDecodes = []; state.__gtpDecodeCalls = 0; state.__gtpHoldNext = false; state.__gtpPrintEvents = 0; state.__gtpNativePrintCalls = 0
      const nativePrint = window.print.bind(window)
      window.print = () => { state.__gtpNativePrintCalls++; nativePrint() }
      addEventListener('beforeprint', () => { state.__gtpPrintEvents++ })
      HTMLImageElement.prototype.decode = function () {
        if (this.closest('[data-aw-print]')) {
          state.__gtpDecodeCalls++
          if (state.__gtpHoldNext) {
            state.__gtpHoldNext = false
            return new Promise<void>((resolve, reject) => state.__gtpPendingDecodes.push({ resolve, reject }))
          }
        }
        return state.__gtpOriginalDecode.call(this)
      }
    })
    await page.evaluate(() => { (globalThis as any).__gtpHoldNext = true })
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click()
    await expect.poll(async () => (await count()).pending).toBe(1)
    const firstWait = await count(); assert.equal(firstWait.decodes, 6); assert.equal(firstWait.prints, 0); assert.equal(firstWait.nativePrintCalls, 0)
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click(); assert.deepEqual(await count(), firstWait)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('complementary').locator('[data-tab-key="wls-accessory-hilon-pickups"]').click()
    await page.locator('[data-accessory-pickup-root]').waitFor(); await expect(page).toHaveURL(/hilon\/pickups$/)
    await page.evaluate(() => { (globalThis as any).__gtpPendingDecodes[0].resolve() }); await flush()
    assert.equal((await count()).prints, 0); assert.equal((await count()).nativePrintCalls, 0); await expect(page.locator('[data-aw-print-document]')).toHaveCount(0)
    assert.deepEqual(await facts(), before)
    await page.screenshot({ path: resolve(evidenceDir, 'cancelled-print-after-site-navigation.png'), fullPage: true })
    await page.getByRole('complementary').locator('[data-tab-key="wls-accessory-gtp-preparation"]').click()
    await page.locator('[data-accessory-preparation-root]').waitFor(); dialog = await open()
    await page.evaluate(() => { (globalThis as any).__gtpHoldNext = true })
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click()
    await expect.poll(async () => (await count()).pending).toBe(2)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    dialog = await open()
    await page.evaluate(() => { (globalThis as any).__gtpHoldNext = true })
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click()
    await expect.poll(async () => (await count()).pending).toBe(3)
    const newWait = await count(); assert.equal(newWait.prints, 0); assert.equal(newWait.decodes, 18)
    await page.evaluate(() => { (globalThis as any).__gtpPendingDecodes[1].reject(new Error('delayed stale decode failure')) }); await flush()
    await expect(dialog.locator('[data-aw-modal-error]')).toHaveText(''); assert.equal((await count()).prints, 0); assert.equal((await count()).nativePrintCalls, 0)
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click()
    assert.deepEqual(await count(), newWait)
    await page.screenshot({ path: resolve(evidenceDir, 'stale-print-failure-new-dialog-clean.png'), fullPage: true })
    await page.evaluate(() => { (globalThis as any).__gtpPendingDecodes[2].resolve() }); await flush()
    await expect.poll(async () => (await count()).prints).toBe(1)
    assert.equal((await count()).nativePrintCalls, 1)
    await expect(dialog.locator('[data-aw-modal-error]')).toHaveText(''); await expect(page.locator('[data-aw-print-document]')).toHaveCount(0)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click(); dialog = await open()
    await dialog.getByRole('button', { name: '打印配料凭证', exact: true }).click()
    await expect.poll(async () => (await count()).nativePrintCalls).toBe(2)
    await expect(dialog.locator('[data-aw-modal-error]')).toHaveText(''); assert.deepEqual(await facts(), before); assert.deepEqual(errors, [])
    await writeFile(resolve(evidenceDir, 'gtp-print-await-guard.json'), JSON.stringify({ at: new Date().toISOString(), base, fixture, firstWait, newWait, final: await count(), closeThenRealMenuNavigationCancelsPrint: true, sameSourceDoubleClickDeduplicated: true, staleFailureDidNotPolluteNewDialog: true, staleFinallyDidNotClearNewSourceDeduplication: true, freshCredentialCanPrint: true, recordsCommandsFilesUnchanged: true, pageErrors: errors }, null, 2))
  } catch (error) { await page.screenshot({ path: resolve(evidenceDir, 'await-guard-failure.png'), fullPage: true }).catch(() => {}); const debug = await page.evaluate(() => ({ prints: (globalThis as any).__gtpPrintEvents, calls: (globalThis as any).__gtpDecodeCalls, pending: (globalThis as any).__gtpPendingDecodes?.length, armed: (globalThis as any).__gtpHoldNext, decode: String(HTMLImageElement.prototype.decode), source: Boolean(document.querySelector('[data-aw-print]')), error: document.querySelector('[data-aw-modal-error]')?.textContent })); await writeFile(resolve(evidenceDir, 'await-guard-failure.json'), JSON.stringify({ error: String(error), errors, url: page.url(), debug }, null, 2)); throw error }
  finally { await context.close() }
})
