import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

async function facts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('higood-cutting-records-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const data = await new Promise<Record<string, any[]>>((resolve, reject) => {
      const tx = db.transaction(['records', 'commands', 'files'], 'readonly'), result: Record<string, any[]> = {}
      for (const name of ['records', 'commands', 'files']) { const r = tx.objectStore(name).getAll(); r.onsuccess = () => { result[name] = r.result } }
      tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error)
    }); db.close(); return data
  })
}

test('真实main面辅料实交图片：局部大图、Esc/按钮/Tab焦点、404关闭重开恢复、跨任务与重进无残留，业务库只读', { timeout: 120000 }, async () => {
  const output = resolve('output/verification/sewing-material-handover-images-ui'); await mkdir(output, { recursive: true })
  const server = await createServer({ root: process.cwd(), server: { port: 43247, strictPort: true, watch: { ignored: ['**/*'] } } }); await server.listen()
  const base = 'http://127.0.0.1:43247', browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message))
  await page.addInitScript(() => {
    const state = globalThis as any; state.__name = (value: unknown) => value; state.__handoverImageWriteTransactions = 0
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) { const tx = original.apply(this, args); if (tx.mode === 'readwrite') state.__handoverImageWriteTransactions++; return tx }
  })
  try {
    await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor(); await seedAccessorySewingFixture(page)
    await page.goto(base + '/wls/accessory-warehouses/hilon/pickups'); await page.locator('[data-accessory-pickup-action="create"]').click(); await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
    await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A'); await page.locator('[data-ppic-task-action="query"]').click(); await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1); await page.locator('[data-ppic-task-action="print-pickup"]').click(); await expect(page.locator('.print-card-title')).toHaveText('辅料领料单')
    const issued = await facts(page), pickup = issued.records.find(row => row.collection === 'accessory-warehouse:pickup' && row.value.assignmentId === 'AW-TEST-ASG-0')!.value, slip = issued.records.find(row => row.collection === 'accessory-warehouse:sewing-slip' && row.value.assignmentId === pickup.assignmentId && row.value.status === 'CURRENT')!.value
    await page.goto(base + `/wls/accessory-warehouses/hilon/pickups?pickupId=${encodeURIComponent(pickup.id)}&versionId=${encodeURIComponent(slip.versionId)}`); await page.getByRole('dialog', { name: '登记车缝领料实交', exact: true }).waitFor()
    await page.getByLabel('价格吊牌本次实交', { exact: true }).fill('7'); await page.getByRole('button', { name: '确认本次实交', exact: true }).click(); await expect(page.getByRole('status')).toContainText('本次车缝领料已保存')
    const before = await facts(page)
    await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor()
    const enter = async (task: 'A' | 'B') => {
      await page.locator('[data-ppic-task-field="keyword"]').fill(`AW-SEW-${task}`); await page.locator('[data-ppic-task-action="query"]').click()
      await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1); await expect(page.locator('[data-ppic-task-page] tbody tr')).toContainText(`AW-SEW-${task}`)
      await page.locator('[data-ppic-task-page] tbody tr').locator('a[data-nav*="/material-handover?"]').click(); await page.locator('[data-sewing-material-page]').waitFor()
    }
    await enter('A'); await expect(page.locator('[data-sewing-material-page]')).toContainText('7 张'); await expect(page.locator('[data-sewing-material-page]')).toContainText('AW-SEW-A')
    await page.locator('[data-sewing-material-page] tbody').evaluate(node => { (globalThis as any).__handoverOriginalBody = node })
    const buttons = page.locator('[data-sewing-material-action="preview-image"]'); await expect(buttons).toHaveCount(4)
    const images: unknown[] = []
    for (let index = 0; index < 4; index++) {
      const opener = buttons.nth(index); await opener.click(); const dialog = page.getByRole('dialog'), close = dialog.getByRole('button', { name: '关闭', exact: true })
      await expect(dialog).toBeVisible(); await expect.poll(() => dialog.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
      await expect(close).toBeFocused(); await page.keyboard.press('Tab'); await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused()
      images.push(await dialog.locator('img').evaluate((img: HTMLImageElement) => ({ src: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: getComputedStyle(img).objectFit })))
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(opener).toBeFocused()
    }
    assert.equal(await page.evaluate(() => (globalThis as any).__handoverOriginalBody === document.querySelector('[data-sewing-material-page] tbody')), true, 'image interactions must not rerender the table')
    const price = page.locator('[data-sewing-material-action="preview-image"][data-image-url="/materials/accessory-flow/price-tag.jpg"]')
    await page.route('**/materials/accessory-flow/price-tag.jpg', route => route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: 'test image unavailable' }))
    await price.click(); await expect(page.getByRole('dialog').getByRole('status')).toContainText('图片加载失败，关闭后可重新打开。'); await page.screenshot({ path: resolve(output, 'image-404-1024.png'), fullPage: true })
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(price).toBeFocused()
    await page.unroute('**/materials/accessory-flow/price-tag.jpg'); await price.press('Enter'); await expect.poll(() => page.getByRole('dialog').locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0); await expect(page.getByRole('dialog').getByRole('status')).toHaveText('')
    await page.setViewportSize({ width: 390, height: 844 }); const dialogBounds = await page.getByRole('dialog').locator('section').boundingBox(); assert.ok(dialogBounds && dialogBounds.x >= 0 && dialogBounds.x + dialogBounds.width <= 391)
    await page.screenshot({ path: resolve(output, 'recovered-image-390.png'), fullPage: true }); await page.keyboard.press('Escape'); await expect(price).toBeFocused(); await page.setViewportSize({ width: 1024, height: 768 })
    await price.click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.goBack(); await page.locator('[data-ppic-task-page]').waitFor(); await enter('B'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('[data-sewing-material-page]')).toContainText('AW-SEW-B')
    await page.locator('[data-sewing-material-action="preview-image"]').first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.goBack(); await page.locator('[data-ppic-task-page]').waitFor(); await enter('A'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('[data-sewing-material-page]')).toContainText('7 张')
    assert.equal(await page.evaluate(() => (globalThis as any).__handoverImageWriteTransactions), 0)
    assert.deepEqual(await facts(page), before); await page.reload(); await page.locator('[data-sewing-material-page]').waitFor(); await expect(page.locator('[data-sewing-material-page]')).toContainText('7 张'); await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.equal(await page.evaluate(() => (globalThis as any).__handoverImageWriteTransactions), 0); assert.deepEqual(await facts(page), before); assert.deepEqual(errors, [])
    await writeFile(resolve(output, 'result.json'), JSON.stringify({ at: new Date().toISOString(), base, task: 'AW-SEW-A', actualPriceTags: '7 张', images, dialogBounds390: dialogBounds, realMainTaskLinkAndImageClicks: true, escapeButtonAndKeyboardFocusPassed: true, sameTableNodeRetained: true, failedImageClosedAndReopenedRecovered: true, assignmentChangeAndSameAssignmentReentryClearOldDialog: true, readwriteTransactionsDuringImageAndReadPages: 0, recordsCommandsFilesUnchanged: true, refreshedCanonicalActualStillSeven: true, pageErrors: errors }, null, 2))
  } catch (error) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), url: page.url(), text: await page.locator('body').innerText().catch(() => ''), pageErrors: errors }, null, 2)); throw error }
  finally { await context.close(); await browser.close(); await server.close() }
})
