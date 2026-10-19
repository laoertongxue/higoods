import assert from 'node:assert/strict'
import test from 'node:test'
import { preview } from 'vite'
import { chromium, expect, type Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const output = resolve('output/verification/accessory-mixed-print-ui')
async function readDatabase(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('higood-cutting-records-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const result = await new Promise<Record<string, unknown[]>>((resolve, reject) => {
      const tx = db.transaction(['records', 'commands', 'meta'], 'readonly'), values: Record<string, unknown[]> = {}
      for (const name of ['records', 'commands', 'meta']) { const request = tx.objectStore(name).getAll(); request.onsuccess = () => { values[name] = request.result } }
      tx.oncomplete = () => resolve(values); tx.onabort = () => reject(tx.error)
    }); db.close(); return result
  })
}

test('固定dist有效含烫包夹具加后道PDA session：真实PPIC打印必须为7明细、款图面料与6辅料图、有效QR版本', { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true }); await mkdir(resolve('output/pdf/accessory-warehouse'), { recursive: true })
  const snapshotRoot = await mkdtemp(join(tmpdir(), 'aw-mixed-print-dist-'))
  await cp(resolve('dist'), join(snapshotRoot, 'dist'), { recursive: true })
  const index = await readFile(join(snapshotRoot, 'dist/index.html')), indexSha256 = createHash('sha256').update(index).digest('hex')
  const server = await preview({ configFile: false, root: snapshotRoot, build: { outDir: 'dist' }, preview: { port: 43247, strictPort: true, host: '127.0.0.1' } })
  const base = 'http://127.0.0.1:43247', browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jakarta' }), page = await context.newPage()
  const errors: string[] = [], consoleErrors: string[] = []
  page.on('pageerror', error => errors.push(error.stack || error.message)); page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  let rootReadySnapshot: unknown
  try {
    const fixture = JSON.parse(await readFile(resolve('tests/fixtures/accessory-warehouse/mixed.json'), 'utf8'))
    const post = JSON.parse(await readFile(resolve('tests/fixtures/accessory-warehouse/post.json'), 'utf8'))
    fixture.localStorage = { ...fixture.localStorage, ...Object.fromEntries(Object.entries(post.localStorage).filter(([key]) => /pda/.test(key))) }
    await page.route('**/__mixed-fixture-setup', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated fixed fixture setup</title>' }))
    await page.goto(base + '/__mixed-fixture-setup')
    await page.evaluate(async fixture => {
      for (const [key, value] of Object.entries(fixture.localStorage)) if (key !== 'higood-tabs') localStorage.setItem(key, String(value))
      for (const source of fixture.databases) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(source.name, source.version)
          request.onupgradeneeded = () => { for (const name of Object.keys(source.stores)) request.result.createObjectStore(name, { keyPath: 'id' }) }
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
        })
        await new Promise<void>((resolve, reject) => { const tx = db.transaction(Object.keys(source.stores), 'readwrite'); for (const [name, rows] of Object.entries(source.stores)) for (const row of rows as any[]) tx.objectStore(name).put(row); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
      }
    }, fixture)
    await page.unroute('**/__mixed-fixture-setup')
    await page.goto(base + '/wls/accessory-warehouses/hilon/pickups'); await page.locator('[data-accessory-pickup-root]').waitFor()
    await page.locator('[data-accessory-pickup-action="create"]').click(); await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
    await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor()
    await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A'); await page.locator('[data-ppic-task-action="query"]').click()
    await expect(page.locator('[data-ppic-task-page] tbody tr')).toHaveCount(1)
    await page.locator('[data-ppic-task-action="print-pickup"]').click(); await page.locator('.print-preview-root').waitFor()
    rootReadySnapshot = await page.locator('.print-preview-root').evaluate(node => ({ text: node.textContent, imageCount: node.querySelectorAll('img').length }))
    await expect(page.locator('.print-card-title')).toHaveText('面辅料领料单')
    await expect(page.locator('.print-table tbody tr')).toHaveCount(7)
    await expect(page.locator('.print-preview-root img')).toHaveCount(8)
    await expect.poll(() => page.locator('.print-preview-root img').evaluateAll((nodes: HTMLImageElement[]) => nodes.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    await expect(page.locator('[data-real-qr] svg')).toHaveCount(1)
    const data = await readDatabase(page), slip = (data.records as any[]).find(row => row.collection === 'accessory-warehouse:sewing-slip' && row.value.status === 'CURRENT')!.value
    assert.equal(slip.versionLabel, 'V1'); assert.equal(slip.lines.length, 7); assert.equal(slip.lines.filter((line: any) => line.objectType === '面料').length, 1)
    const qr = await page.locator('[data-real-qr]').getAttribute('data-qr-value'); assert.equal(new URLSearchParams(qr!).get('sourceId'), slip.versionId)
    await page.screenshot({ path: resolve(output, 'mixed-preview-390.png'), fullPage: true })
    await page.pdf({ path: resolve('output/pdf/accessory-warehouse/mixed-material-pickup-v1.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
    await writeFile(resolve(output, 'result.json'), JSON.stringify({ at: new Date().toISOString(), base, indexSha256, result: '通过', rootReadySnapshot, slip, imageCount: 8, tableRows: 7, qr, pageErrors: errors, consoleErrors }, null, 2))
    assert.deepEqual(errors, [])
  } catch (error) {
    await page.screenshot({ path: resolve(output, 'mixed-print-failure.png'), fullPage: true }).catch(() => {})
    await writeFile(resolve(output, 'failure.json'), JSON.stringify({ at: new Date().toISOString(), base, indexSha256, error: String(error), rootReadySnapshot, text: await page.locator('body').innerText(), database: await readDatabase(page), pageErrors: errors, consoleErrors }, null, 2))
    throw error
  } finally { await browser.close(); await new Promise<void>(resolve => server.httpServer.close(() => resolve())); await rm(snapshotRoot, { recursive: true, force: true }) }
})
