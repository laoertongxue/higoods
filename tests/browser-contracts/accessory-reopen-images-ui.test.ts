import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type BrowserContext, type Page, type Locator } from '@playwright/test'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

// Test initial states only. Persistent profile is private and removed after the
// actual browser exit/reopen assertion. No user's profile or records are used.
const output = resolve('output/verification/accessory-read-images')
let server: ViteDevServer, browser: Browser, base = '', runOutput = ''
const evidence: Record<string, any> = {}
const tracked = ['src/pages/pda-handover.ts', 'src/pages/wls/accessory-warehouses/pickups.ts', 'src/pages/process-factory/post-finishing/material-transfers.ts', 'src/components/ui/pda-image-preview.ts', 'src/pages/wls/accessory-warehouses/shared.ts']
let sourceBefore: Record<string, string>
const hashes = async () => Object.fromEntries(await Promise.all(tracked.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])) )
before(async () => {
  runOutput = resolve(output, new Date().toISOString().replace(/[:.]/g, '-')); await mkdir(runOutput, { recursive: true }); sourceBefore = await hashes()
  server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } } }); await server.listen()
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`; browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close(); await server?.close()
  const report = { capturedAt: new Date().toISOString(), base, environment: 'actual main, fresh Vite watch ignored; isolated Chromium contexts and private persistent profile', fixtureBoundary: 'Existing saved-record fixtures only model initial state; no upstream actual-operation claim. AC39 save uses a trusted actual business button.', productionPerformanceAccepted: false, productAcceptanceClaimed: false, sourceBefore, sourceAfter: await hashes(), evidenceDirectory: runOutput,
    inheritedEvidence: ['output/playwright/accessory-warehouse/stage1/diagnostic-results.json', 'output/playwright/accessory-warehouse/stage2-transfer-ui/results.json', 'output/verification/accessory-upstream-transfer/results.json', 'output/playwright/accessory-warehouse/post-finishing/results.json'],
    stylePolicy: 'U9 allows demo style-image/name mismatch; every required style image must exist/load. Material image mapping follows existing accepted SKU assets; no new assets selected.', evidence }
  await writeFile(resolve(runOutput, 'results.json'), JSON.stringify(report, null, 2)); await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2))
})
async function attach(page: Page, name: string) {
  page.setDefaultTimeout(20000); const errors: string[] = [], events: unknown[] = []
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => { events.push({ browserDialog: dialog.type(), message: dialog.message() }); await dialog.accept() })
  await page.exposeFunction('__imageEvidenceEvent', (entry: unknown) => { events.push({ url: page.url(), entry }) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    document.addEventListener('click', event => { const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-accessory-action],[data-accessory-pickup-action],[data-post-finishing-material-transfers-action],[data-pda-image-preview-url],[data-pda-image-preview-close],[data-pda-handover-action]') : null; if (target) void (globalThis as any).__imageEvidenceEvent({ trusted: event.isTrusted, dataset: { ...target.dataset }, text: target.textContent?.trim().slice(0, 80) }) }, true)
  })
  return { errors, events, async finish() { await writeFile(resolve(runOutput, `${name}-events.json`), JSON.stringify({ errors, events }, null, 2)); assert.deepEqual(errors, []) } }
}
async function installFixture(page: Page, fixture: any) {
  await page.route('**/__image-fixture-install', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })); await page.goto(base + '/__image-fixture-install')
  await page.evaluate(async fixture => {
    function decode(value: any): any { if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type }); if (Array.isArray(value)) return value.map(decode); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)])); return value }
    if ((await indexedDB.databases()).length) throw new Error('fixture installation requires an isolated empty context')
    for (const info of fixture.databases) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(info.name, info.version); r.onupgradeneeded = () => { for (const s of info.stores) { const store = r.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const i of s.indexes || []) store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }) } }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      const tx = db.transaction(info.stores.map((s: any) => s.name), 'readwrite'), done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
      for (const s of info.stores) for (const row of s.rows) { const store = tx.objectStore(s.name); store.keyPath === null ? store.put(decode(row.value), decode(row.key)) : store.put(decode(row.value)) }; await done; db.close()
    }
    for (const [key, value] of Object.entries(fixture.localStorage || {})) localStorage.setItem(key, String(value))
  }, fixture)
}
async function raw(page: Page) {
  return page.evaluate(async () => {
    const data: any[] = []
    for (const info of (await indexedDB.databases()).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(info.name!, info.version); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const stores: Record<string, unknown> = {}
      for (const name of db.objectStoreNames) { const tx = db.transaction(name, 'readonly'), request = tx.objectStore(name).getAll(), done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); const values = await new Promise<any[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); await done; stores[name] = values }
      data.push({ name: db.name, version: db.version, stores }); db.close()
    }
    return data
  })
}
async function unchangedBusinessRecords(page: Page, before: Awaited<ReturnType<typeof raw>>) {
  const after = await raw(page)
  for (const existing of before) assert.deepEqual(after.find(row => row.name === existing.name), existing)
  const addedEmptyDatabases = after.filter(row => !before.some(existing => existing.name === row.name))
  for (const database of addedEmptyDatabases) for (const rows of Object.values(database.stores)) assert.deepEqual(rows, [])
  return { existingDatabaseRecordsUnchanged: true, addedEmptyDatabaseSchemas: addedEmptyDatabases }
}
async function layout(page: Page) { const value = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })); assert.ok(value.document <= value.viewport + 1, JSON.stringify(value)); return value }
async function thumbnails(scope: Locator) {
  const items = scope.locator('button[data-accessory-action="image"],button[data-pda-image-preview-url]'), result = []
  assert.ok(await items.count() > 0, 'required image controls must exist')
  for (let i = 0; i < await items.count(); i++) { const item = items.nth(i); await item.scrollIntoViewIfNeeded(); const img = item.locator('img'); await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0); result.push(await item.evaluate(el => { const img = el.querySelector('img')!; return { label: el.getAttribute('aria-label') || el.getAttribute('data-label') || el.getAttribute('data-pda-image-preview-title'), image: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: getComputedStyle(img).objectFit } })) }
  return result
}
async function imageDialogFor(page: Page, button: Locator, pda: boolean) {
  const label = await button.getAttribute(pda ? 'data-pda-image-preview-title' : 'data-label')
  assert.ok(label, 'image control must name its object')
  return page.getByRole('dialog', { name: pda ? `${label}大图预览` : label, exact: true })
}
async function enlarge(page: Page, button: Locator, close: 'escape' | 'button' | 'backdrop', pda = false) {
  await button.scrollIntoViewIfNeeded(); const imageDialog = await imageDialogFor(page, button, pda); await button.click(); await expect(imageDialog).toBeVisible(); const img = imageDialog.locator('img')
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  const dimensions = await img.evaluate((el: HTMLImageElement) => { const box = el.getBoundingClientRect(); return { width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, fit: getComputedStyle(el).objectFit } })
  assert.ok(dimensions.width <= dimensions.viewportWidth && dimensions.height <= dimensions.viewportHeight && dimensions.left >= -1 && dimensions.right <= dimensions.viewportWidth + 1, JSON.stringify(dimensions)); assert.equal(dimensions.fit, 'contain')
  if (close === 'escape') await page.keyboard.press('Escape')
  else if (close === 'button') await imageDialog.getByRole('button', { name: '关闭', exact: true }).click()
  else if (pda) await imageDialog.locator('[data-pda-image-preview-close]').first().click({ position: { x: 2, y: 2 } })
  else await imageDialog.locator('xpath=..').locator(':scope > button[aria-label="关闭窗口"]').click({ position: { x: 2, y: 2 } })
  await expect(imageDialog).toHaveCount(0); return { close, dimensions }
}
async function failureRecovery(page: Page, button: Locator, label: string, pda = false) {
  const image = await button.locator('img').getAttribute('src'), path = new URL(image!, base).pathname, match = (url: URL) => url.pathname === path
  await page.route(match, route => route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: 'AC42 image fault injection' }))
  const failed = await imageDialogFor(page, button, pda); await button.click(); await expect(failed.getByText(/图片加载失败/)).toBeVisible(); await layout(page); await page.screenshot({ path: resolve(runOutput, `${label}-image-failure.png`), fullPage: true }); await page.keyboard.press('Escape'); await expect(failed).toHaveCount(0)
  await page.unroute(match); const recovered = await enlarge(page, button, 'button', pda); return { image, faultShown: true, escapeClosed: true, retryLoaded: true, recovered }
}
async function imageMatrix(page: Page, parent: Locator, label: string, pda = false) {
  await expect(parent).toBeVisible()
  try {
  const images = await thumbnails(parent), controls = parent.locator(pda ? 'button[data-pda-image-preview-url]' : 'button[data-accessory-action="image"]'), opened = []
  for (let index = 0; index < await controls.count(); index++) opened.push(await enlarge(page, controls.nth(index), (['escape', 'button', 'backdrop'] as const)[index % 3], pda))
  const failure = []
  for (const index of [0, Math.min(1, await controls.count() - 1)]) failure.push(await failureRecovery(page, controls.nth(index), `${label}-${index}`, pda))
  const dimensions = await layout(page); await page.screenshot({ path: resolve(runOutput, `${label}-ready.png`), fullPage: true }); return { images, opened, failure, layout: dimensions }
  } catch (error) {
    await page.screenshot({ path: resolve(runOutput, `${label}-blocked.png`), fullPage: true })
    await writeFile(resolve(runOutput, `${label}-blocked.json`), JSON.stringify({ message: String(error), url: page.url(), layout: await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })), dialogs: await page.getByRole('dialog').evaluateAll(nodes => nodes.map(node => node.outerHTML)) }, null, 2))
    throw error
  }
}
async function browserPid(context: BrowserContext) { const browser = context.browser(); assert.ok(browser); const session = await browser.newBrowserCDPSession(); const info = await session.send('SystemInfo.getProcessInfo'); await session.detach(); const id = info.processInfo.find((row: any) => row.type === 'browser')?.id; assert.ok(id); return Number(id) }

test('AC39真实浏览器进程退出重开：实际后道收货按钮保存后，同一私有profile冷直达下游持久回读', { timeout: 120000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), 'higoods-ac39-private-')); let context: BrowserContext | undefined
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1024, height: 768 } }); let page = await context.newPage(), log = await attach(page, 'process-first')
    await installFixture(page, JSON.parse(await readFile('tests/fixtures/accessory-warehouse/post.json', 'utf8')))
    await page.goto(base + '/fcs/craft/post-finishing/material-transfers'); await page.locator('[data-post-material-workspace]').waitFor(); await page.locator('[data-post-material-query] [name="keyword"]').fill('PO-AW-202610-F01'); await page.locator('[data-post-finishing-material-transfers-action="query"]').click(); await page.locator('[data-post-finishing-material-transfers-action="detail"][data-id="POST-UI-1"]').click()
    const dialog = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true }); for (const [i, quantity] of [10, 20].entries()) { await dialog.locator('[data-post-material-qty]').nth(i).fill(String(quantity)); await dialog.locator('[data-post-material-location]').nth(i).selectOption({ label: 'PF-MAT-A01-01' }) }
    await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click(); await expect(dialog).toHaveCount(0)
    const saved = await raw(page), firstPid = await browserPid(context); await page.screenshot({ path: resolve(runOutput, 'process-saved-before-exit.png'), fullPage: true }); await log.finish(); const firstBrowser = context.browser()!; await context.close(); context = undefined; assert.equal(firstBrowser.isConnected(), false)
    await expect.poll(() => { try { process.kill(firstPid, 0); return false } catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' } }).toBe(true)
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1024, height: 768 } }); page = await context.newPage(); log = await attach(page, 'process-reopened'); const secondPid = await browserPid(context); assert.notEqual(secondPid, firstPid)
    await page.goto(base + '/fcs/craft/post-finishing/wait-process-warehouse?tab=materials'); await expect(page.locator('main')).toContainText('PO-AW-202610-F01'); await expect(page.locator('main')).toContainText('10 条'); await expect(page.locator('main')).toContainText('20 粒')
    const reopened = await raw(page); assert.deepEqual(reopened, saved); await page.screenshot({ path: resolve(runOutput, 'process-reopened-stock-direct.png'), fullPage: true }); await log.finish(); await writeFile(resolve(runOutput, 'process-durable.json'), JSON.stringify({ saved, reopened }, null, 2))
    evidence.actualProcessReopen = { passed: true, firstBrowserPid: firstPid, firstBrowserDisconnected: true, firstPidExited: true, secondBrowserPid: secondPid, samePrivateProfile: true, actualBusinessSave: 'Web 确认收货并上架10条/20粒', directDownstreamAfterRelaunch: true, allRawDatabaseRecordsEqual: true }
  } finally { await context?.close(); await rm(profile, { recursive: true, force: true }) }
})

test('AC42 HILON与Mahameru领料：1366/1280/1024全部款物图加载、大图关闭/遮罩/Esc、失败恢复和无横溢出', { timeout: 240000 }, async () => {
  const cases = []
  for (const site of ['hilon', 'mahameru'] as const) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), log = await attach(page, `pickup-${site}`)
    try {
      await page.goto(base + '/wls/accessory-warehouses/gtp/preparation'); await page.locator('[data-accessory-preparation-root]').waitFor(); const fixture = await seedAccessorySewingFixture(page, false, site); assert.ok(!('error' in fixture))
      await page.goto(base + `/wls/accessory-warehouses/${site}/pickups`); await page.locator('[data-accessory-pickup-action="create"]').click(); await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立'); const before = await raw(page)
      for (const [width, height] of [[1366, 768], [1280, 720], [1024, 768]]) {
        await page.setViewportSize({ width, height }); await page.goto(base + `/wls/accessory-warehouses/${site}/pickups`); await page.locator('[data-accessory-pickup-root]').waitFor(); const listImages = await thumbnails(page.locator('[data-accessory-pickup-root]'))
        await page.locator('[data-accessory-pickup-action="detail"]').first().click(); const parent = page.getByRole('dialog', { name: '车缝领料清单和历史', exact: true }); await expect(parent).toBeVisible(); const result = await imageMatrix(page, parent, `${site}-${width}`); assert.equal(result.images.length, 5); assert.equal(listImages.length, 2); const durable = await unchangedBusinessRecords(page, before)
        cases.push({ site, viewport: { width, height }, durable, expectedMaterials: ['价格吊牌', '品牌吊牌', '吊粒', '车缝线'], listImages, ...result })
      }
      await log.finish()
    } finally { await context.close() }
  }
  evidence.pickupDevices = { passed: true, combinations: 6, cases }
})

test('AC42后道Web三视口及PDA390：3张款物图/大图失败恢复/原收货主动作，图片操作不改变业务', { timeout: 180000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), log = await attach(page, 'post-devices')
  try {
    await installFixture(page, JSON.parse(await readFile('tests/fixtures/accessory-warehouse/post.json', 'utf8'))); const before = await raw(page), cases = []
    for (const [width, height] of [[1366, 768], [1280, 720], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await page.goto(base + '/fcs/craft/post-finishing/material-transfers'); await page.locator('[data-post-material-workspace]').waitFor(); await page.locator('[data-post-material-query] [name="keyword"]').fill('PO-AW-202610-F01'); await page.locator('[data-post-finishing-material-transfers-action="query"]').click(); await page.locator('[data-post-finishing-material-transfers-action="detail"][data-id="POST-UI-1"]').click()
      const parent = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true }); const result = await imageMatrix(page, parent, `post-web-${width}`); assert.equal(result.images.length, 3); const durable = await unchangedBusinessRecords(page, before); cases.push({ durable, viewport: { width, height }, ...result })
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/fcs/pda/handover?tab=pickup&materialOrderNo=POST-UI-1'); const pda = page.locator('[data-managed-accessory-post-root]'); await pda.waitFor(); const result = await imageMatrix(page, pda, 'post-pda-390', true); assert.equal(result.images.length, 3, 'PDA requires one same-source style image plus two material images'); const durable = await unchangedBusinessRecords(page, before)
    await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toBeVisible(); for (const [i, quantity] of [10, 20].entries()) { await page.locator('[data-pda-post-qty]').nth(i).fill(String(quantity)); await page.locator('[data-pda-post-location]').nth(i).selectOption({ label: 'PF-MAT-A01-01' }) }; await page.locator('[data-pda-handover-action="confirm-material-inbound"]').click(); await expect(pda).toContainText('辅料已收货上架')
    await page.screenshot({ path: resolve(runOutput, 'post-pda-after-style-and-receipt-390.png'), fullPage: true }); evidence.postDevices = { passed: true, webCombinations: 3, web: cases, pda: { durable, viewport: { width: 390, height: 844 }, ...result, sameSourceStyleImageAndTwoMaterials: true, originalReceiptActionStillSaved: true }, imageOperationsReadOnly: true }; await log.finish()
  } finally { await context.close() }
})
