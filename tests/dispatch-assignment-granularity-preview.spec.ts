import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type Locator } from '@playwright/test'

// Run with the production preview and a separate source server for isolated fixture creation.
// Fixtures are created through the current business save actions, then copied into a fresh browser context.
const fixtureURL = process.env.DISPATCH_FIXTURE_BASE_URL || 'http://127.0.0.1:43234'
const evidenceDir = path.resolve('output/playwright/dispatch-assignment-granularity-20261010')
const fixtures: { taskId: string; rootNo: string; database: any }[] = []
let quoteFixture: { database: any; session: string; taskId: string } | null = null
const samples: { action: string; scenario: string; durationMs: number }[] = []
const dialog = (page: Page) => page.locator('[data-unified-dispatch-overlay] section').first()

async function captureDatabase(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('higood-cutting-records-v1'); request.onsuccess = () => resolve(request.result) })
    const stores = []
    for (const name of db.objectStoreNames) {
      const store = db.transaction(name).objectStore(name)
      const values = await new Promise(resolve => { const request = store.getAll(); request.onsuccess = () => resolve(request.result) })
      stores.push({ name, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: [...store.indexNames].map(name => { const index = store.index(name); return { name, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry } }), values })
    }
    const result = { name: db.name, version: db.version, stores }; db.close(); return result
  })
}

async function seedDatabase(page: Page, database: any, session?: string) {
  await page.route('**/dispatch-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>隔离验收数据准备</title>' }))
  await page.goto('/dispatch-fixture.html')
  await page.evaluate(async ({ fixture, session }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(fixture.name, fixture.version)
      request.onupgradeneeded = () => { for (const s of fixture.stores) { const store = request.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const i of s.indexes) store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }) } }
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    const tx = db.transaction(fixture.stores.map((s: any) => s.name), 'readwrite')
    for (const store of fixture.stores) for (const value of store.values) tx.objectStore(store.name).put(value)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    db.close()
    if (session) localStorage.setItem('fcs_pda_session', session)
  }, { fixture: database, session })
}

async function readRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-cutting-records-v1')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('records').objectStore('records').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return rows
  })
}

async function painted(page: Page) {
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('img')].filter(img => !img.hidden && img.getClientRects().length).map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('识别图片未就绪') }))
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

async function navigationSample(page: Page, action: string, scenario: string) {
  await expect.poll(() => page.evaluate(() => (window as any).__dispatchNavigationPaintedAt)).toBeGreaterThan(0)
  const durationMs = await page.evaluate(() => (window as any).__dispatchNavigationPaintedAt)
  samples.push({ action, scenario, durationMs })
  expect(durationMs, `${action} ${scenario}`).toBeLessThanOrEqual(1000)
}

async function clickSample(page: Page, target: Locator, action: string, scenario: string, complete: () => Promise<void>, persisted = false) {
  await page.evaluate(() => document.addEventListener('click', () => { (window as any).__dispatchClickStarted = performance.now() }, { capture: true, once: true }))
  await target.click()
  await complete()
  if (persisted) await readRecords(page)
  await painted(page)
  const durationMs = await page.evaluate(() => performance.now() - (window as any).__dispatchClickStarted)
  samples.push({ action, scenario, durationMs })
  expect(durationMs, `${action} ${scenario}`).toBeLessThanOrEqual(1000)
}

async function quoteInputSample(page: Page, target: Locator, value: string, action: string, scenario: string, complete: () => Promise<void>) {
  await page.evaluate(() => document.addEventListener('input', () => { (window as any).__quoteInputStarted = performance.now() }, { capture: true, once: true }))
  await target.fill(value)
  await complete()
  await painted(page)
  const durationMs = await page.evaluate(() => performance.now() - (window as any).__quoteInputStarted)
  samples.push({ action, scenario, durationMs })
  expect(durationMs, `${action} ${scenario}`).toBeLessThanOrEqual(1000)
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true })
  for (const merged of [false, true]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${fixtureURL}/fcs/dispatch/workbench`)
    await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
    const taskId = await page.evaluate(async merged => {
      const release = await import('/src/data/fcs/cut-piece-release.ts')
      const result = await release.saveCutPieceReleaseAvailableQtyAction({ productionOrderId: 'PO-202603-0002', basisMatrixVersion: release.getCutPieceReleaseSummaryForProductionOrder('PO-202603-0002')!.latestMatrixVersion, basisTargetVersion: release.listCutPieceReleaseTargetSnapshots('PO-202603-0002').at(-1)!.matrixVersion,
        releaseQtyByColorSize: { 'Grey::S': 500, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 }, riskReason: '隔离生产预览验收夹具', confirmedBy: '验收裁床主管', confirmedAt: '2026-10-10 08:00:00' })
      if (!result.ok) throw new Error(result.message)
      if (!merged) return 'TASKGEN-202603-0002-002__ORDER'
      const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
      const { saveProductionSourceAction } = await import('/src/data/fcs/production-context-actions.ts')
      return saveProductionSourceAction({ id: 'TEST-PREVIEW-MERGE', intent: '隔离生产预览合并夹具', action: () => runtime.createFixedMergedTask(['TASKGEN-202603-0002-002__ORDER', 'TASKGEN-202603-0002-009__ORDER'], '隔离验收')!.taskId })
    }, merged)
    const database = await captureDatabase(page)
    const rootNo = await page.evaluate(async id => {
      const { getRuntimeTaskById } = await import('/src/data/fcs/runtime-process-tasks.ts')
      const task = getRuntimeTaskById(id)!
      return task.rootTaskNo || task.taskNo || task.taskId
    }, taskId)
    fixtures.push({ taskId, rootNo, database })
    if (!merged) {
      await page.goto(`${fixtureURL}/fcs/dispatch/workbench?keyword=${encodeURIComponent(rootNo)}`)
      await page.locator(`[data-unified-action="open-bidding"][data-task-id="${taskId}"]`).click()
      for (const code of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await dialog(page).locator(`[data-unified-sku="${code}"]`).uncheck()
      await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200')
      await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2099-10-10T18:00')
      await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
      await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
      await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0)
      const session = await page.evaluate(async () => {
        const { listRuntimeTaskTenderRecords } = await import('/src/data/fcs/runtime-task-tenders.ts')
        const pda = await import('/src/data/fcs/store-domain-pda.ts')
        const tender = listRuntimeTaskTenderRecords().find(t => t.taskSnapshot.productionOrderId === 'PO-202603-0002')!
        const factory = tender.factoryPool[0]!
        pda.ensureFactoryPdaSeed(factory.factoryId, factory.factoryName)
        const user = pda.listFactoryPdaUsers(factory.factoryId).find(u => u.roleId === 'ROLE_ADMIN') || pda.listFactoryPdaUsers(factory.factoryId)[0]!
        pda.setPdaSession(pda.createPdaSessionFromUser(user))
        return { session: localStorage.getItem('fcs_pda_session')!, taskId: tender.taskId }
      })
      quoteFixture = { ...session, database: await captureDatabase(page) }
    }
    await context.close()
  }
  fs.writeFileSync(path.join(evidenceDir, 'production-preview-environment.json'), JSON.stringify({ browser: browser.version(), baseURL: process.env.PLAYWRIGHT_BASE_URL, fixtureURL, worktree: process.cwd(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, fixtures: fixtures.map(f => ({ taskId: f.taskId, stores: f.database.stores.map((s: any) => ({ name: s.name, records: s.values.length })) })) }, null, 2))
})

test.afterAll(() => fs.writeFileSync(path.join(evidenceDir, `production-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(samples, null, 2)))

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if ((window as any).__dispatchNavigationMeasuring || !document.querySelector('[data-unified-dispatch-page] tbody tr')) return
      ;(window as any).__dispatchNavigationMeasuring = true
      void (async () => {
        await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-unified-dispatch-page] img')].map(img => img.decode()))
        // Re-read the persisted records in the browser, without automation polling in the timed path.
        const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('higood-cutting-records-v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        await new Promise<void>((resolve, reject) => { const r = db.transaction('records').objectStore('records').getAll(); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) })
        db.close()
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        ;(window as any).__dispatchNavigationPaintedAt = performance.now()
      })()
    })
    observer.observe(document, { childList: true, subtree: true })
  })
})

for (const mode of ['DIRECT', 'BIDDING'] as const) for (let run = 0; run < 5; run++) test(`生产预览 ${mode}-${run + 1} 完整响应及刷新回读`, async ({ page }) => {
  const fixture = fixtures[run % 2]!
  const scenario = `${mode}-${run % 2 ? 'merged' : 'sewing'}-${run + 1}`
  await page.setViewportSize(run === 4 ? { width: 1024, height: 768 } : run === 3 ? { width: 1280, height: 720 } : { width: 1366, height: 768 })
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
  await navigationSample(page, 'first-visit-empty-user-store', scenario)
  await seedDatabase(page, fixture.database)
  const prefix = fixture.rootNo
  await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(fixture.taskId.replace('__ORDER', ''))}`)
  const open = page.locator(`[data-unified-action="${mode === 'DIRECT' ? 'open-direct' : 'open-bidding'}"][data-task-id="${fixture.taskId}"]`)
  await expect(open).toBeVisible()
  await navigationSample(page, 'filtered-navigation-existing-records', scenario)
  await clickSample(page, open, `open-${mode}`, scenario, async () => { await expect(dialog(page)).toBeVisible() })
  if (mode === 'DIRECT') await dialog(page).locator('[data-unified-field="distributionMode"][value="FREE"]').check()
  for (const sku of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await clickSample(page, dialog(page).locator(`[data-unified-sku="${sku}"]`), 'select-sku', scenario, async () => { await expect(dialog(page).locator(`[data-unified-sku="${sku}"]`)).not.toBeChecked() })
  if (mode === 'DIRECT') await dialog(page).locator('[data-unified-field="factoryId"]').selectOption({ index: 1 })
  else { await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200'); await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2099-10-10T18:00') }
  await clickSample(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), `confirm-${mode}`, scenario, async () => { await expect(dialog(page)).toContainText(mode === 'DIRECT' ? '二次确认派单价格' : '二次确认发起竞价') })
  await expect(dialog(page)).toContainText('500件')
  if (run < 2) await dialog(page).screenshot({ path: path.join(evidenceDir, `production-${scenario}-confirmed.png`) })
  await clickSample(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), `save-${mode}`, scenario, async () => { await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0) }, true)
  const records = await readRecords(page)
  if (fixture.rootNo !== fixture.taskId.replace('__ORDER', '')) {
    await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(prefix)}`)
    await expect(page.locator('tbody tr').filter({ hasText: `${prefix}-A01` })).toBeVisible()
  }
  await page.reload()
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
  expect(await readRecords(page)).toEqual(records)
  await navigationSample(page, 'refresh-persisted-results', scenario)
  await expect(page.locator('tbody tr').filter({ hasText: `${prefix}-A01` })).toContainText('500件')
  await expect(page.locator('tbody tr').filter({ hasText: `${prefix}-R02` })).toContainText('2,000件')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (let run = 0; run < 5; run++) test(`生产预览 PDA 报价-${run + 1} 事务中止、重试与刷新`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = quoteFixture!
  await seedDatabase(page, fixture.database, fixture.session)
  await page.goto('/fcs/pda/task-receive?tab=pending-quote')
  const card = page.locator('article').filter({ hasText: fixture.taskId }).first()
  await card.getByRole('button', { name: '立即报价', exact: true }).click()
  const quote = page.getByRole('heading', { name: '立即报价' }).locator('xpath=ancestor::article[1]')
  await expect(quote).toContainText('1 个 SKU，共 500 件')
  await quote.evaluate(node => { (window as any).__quoteBeforeInput = node })
  await quoteInputSample(page, quote.locator('[data-pda-tr-field="quoteAmount"]'), '1200', 'quote-input-amount', `pda-${run + 1}`, async () => { await expect(quote.getByRole('button', { name: '确认提交报价' })).toBeEnabled() })
  await quoteInputSample(page, quote.locator('[data-pda-tr-field="deliveryDays"]'), '9', 'quote-input-days', `pda-${run + 1}`, async () => { await expect(quote.locator('[data-pda-tr-field="deliveryDays"]')).toHaveValue('9') })
  await quoteInputSample(page, quote.locator('[data-pda-tr-field="quoteRemark"]'), '报价验收', 'quote-input-remark', `pda-${run + 1}`, async () => { await expect(quote.locator('[data-pda-tr-field="quoteRemark"]')).toHaveValue('报价验收') })
  await expect(quote.locator('[data-pda-tr-field="quoteAmount"]')).toHaveValue('1200')
  expect(await page.evaluate(() => (window as any).__quoteBeforeInput.isConnected)).toBe(true)
  if (run === 0) await quote.screenshot({ path: path.join(evidenceDir, 'production-pda-quote.png') })
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    ;(window as any).__restoreQuote = () => { IDBDatabase.prototype.transaction = original }
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) { const tx = Reflect.apply(original, this, args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx }
  })
  await clickSample(page, quote.getByRole('button', { name: '确认提交报价' }), 'quote-abort', `pda-${run + 1}`, async () => { await expect(page.locator('#pda-task-receive-toast-root')).toContainText(/未保存|中止|失败/); await expect(quote.locator('[data-pda-tr-field="quoteAmount"]')).toHaveValue('1200') }, true)
  expect(await readRecords(page)).toEqual(fixture.database.stores.find((s: any) => s.name === 'records').values)
  await page.evaluate(() => (window as any).__restoreQuote())
  await clickSample(page, quote.getByRole('button', { name: '确认提交报价' }), 'quote-save', `pda-${run + 1}`, async () => { await expect(page.locator('#pda-task-receive-toast-root')).toContainText('报价提交成功') }, true)
  const records = await readRecords(page)
  await page.reload()
  await expect(page.getByRole('button', { name: /已报价招标单/ })).toBeVisible()
  expect(await readRecords(page)).toEqual(records)
  await page.getByRole('button', { name: /已报价招标单/ }).click()
  await expect(page.locator('article').filter({ hasText: fixture.taskId }).first()).toContainText('1,200 IDR/件')
})

for (let run = 0; run < 5; run++) test(`生产预览竞价中止恢复-${run + 1}`, async ({ page }) => {
  const fixture = fixtures[1]!
  await seedDatabase(page, fixture.database)
  await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(fixture.taskId)}`)
  await page.locator(`[data-unified-action="open-bidding"][data-task-id="${fixture.taskId}"]`).click()
  for (const code of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await dialog(page).locator(`[data-unified-sku="${code}"]`).uncheck()
  await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200')
  await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2099-10-10T18:00')
  await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
  const recordsBefore = await readRecords(page)
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    ;(window as any).__restoreTender = () => { IDBDatabase.prototype.transaction = original }
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) { const tx = Reflect.apply(original, this, args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx }
  })
  await clickSample(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), 'tender-abort', `merged-${run + 1}`, async () => {
    await expect(dialog(page)).toContainText(/未保存|中止|失败/)
    await expect(dialog(page)).toContainText('500件')
  }, true)
  expect(await readRecords(page)).toEqual(recordsBefore)
  await page.evaluate(() => (window as any).__restoreTender())
  await clickSample(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), 'save-BIDDING-after-abort', `merged-${run + 1}`, async () => {
    await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0)
  }, true)
  const recordsAfter = await readRecords(page)
  await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(fixture.rootNo)}`)
  await expect(page.locator('tbody tr').filter({ hasText: `${fixture.rootNo}-A01` })).toContainText('500件')
  await expect(page.locator('tbody tr').filter({ hasText: `${fixture.rootNo}-R02` })).toContainText('2,000件')
  expect(await readRecords(page)).toEqual(recordsAfter)
})
