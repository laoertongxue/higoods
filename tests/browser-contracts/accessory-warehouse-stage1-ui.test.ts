import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

// Development diagnostics only. These real UI events and screenshots do not
// establish production-preview performance, migration, or full-stage acceptance.
const base = process.env.ACCESSORY_STAGE1_UI_URL || 'http://127.0.0.1:43241'
const output = resolve('output/playwright/accessory-warehouse/stage1')
const gtpPath = '/wls/accessory-warehouses/gtp/preparation'
let browser: Browser
const checks: Record<string, unknown> = {}

before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => {
  await browser?.close()
  await writeFile(resolve(output, 'diagnostic-results.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), base, environment: 'Vite development diagnostic',
    productionPerformanceAccepted: false,
    styleImagePolicy: '用户允许演示款图与款名不匹配，但每款必须有图；本套验证存在、加载和大图交互。',
    materialImageCorrespondenceAccepted: false,
    notPassedByThisSuite: [
      '物料图的具体对象对应关系不能以本套加载及交互成功替代；款图错配依用户确认不再阻断',
      '旧车缝配料模块及入口完整退役未在本套验收通过',
      'FCS 读取桥未在本套验收通过',
      '旧用户资料的显式迁移及失败恢复未在本套验收通过',
      '后续整单出库、两仓收货、车缝领料、后道及改厂闭环未在本套验收通过',
    ],
    checks,
  }, null, 2))
})

async function withPage(name: string, run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors: string[] = []
  const collectedEvents: unknown[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.exposeFunction('__awCaptureUiEvent', (entry: unknown) => { collectedEvents.push({ url: page.url(), entry }) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    ;(globalThis as any).__awUiEvents = []
    for (const type of ['click', 'input', 'change', 'dragstart', 'dragover', 'drop', 'dragend']) document.addEventListener(type, (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(
        '[data-accessory-action],[data-accessory-field],[data-aw-qty],[data-aw-location],[data-aw-remark],[data-aw-actor],[data-action],[data-wls-basic-warehouse-action],[data-wls-basic-zone-location-action],[data-standard-list-column-drag]',
      ) : null
      if (target) {
        const entry = { type, trusted: event.isTrusted, text: target.textContent?.trim().slice(0, 80), attributes: { ...target.dataset } }
        ;(globalThis as any).__awUiEvents.push(entry)
        void (globalThis as any).__awCaptureUiEvent(entry)
      }
    }, true)
  })
  try {
    await run(page)
    assert.deepEqual(errors, [], 'no uncaught page exceptions during this diagnostic')
  } catch (error) {
    checks[name] = { passed: false, error: String(error), pageErrors: errors }
    await writeFile(resolve(output, `${name}-failure-${Date.now()}.json`), JSON.stringify({ capturedAt: new Date().toISOString(), url: page.url(), error: String(error), pageErrors: errors }, null, 2))
    await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await writeFile(resolve(output, `${name}-events.json`), JSON.stringify({ url: page.url(), pageErrors: errors, events: collectedEvents }, null, 2))
    await context.close()
  }
}

async function openGtp(page: Page): Promise<void> {
  await page.goto(base + gtpPath)
  await page.locator('[data-accessory-preparation-root]').waitFor()
  await expect(page.locator('[data-aw-preparation-card]')).not.toHaveCount(0)
}
async function queryGtp(page: Page, keyword: string, status = ''): Promise<void> {
  await page.locator('[data-accessory-field="keyword"]').fill(keyword)
  await page.locator('[data-accessory-field="status"]').selectOption(status)
  await page.locator('[data-accessory-action="query"]').click()
  // Leaf handlers load asynchronously; wait for the actual filtered rows before
  // choosing the next row action rather than racing the previous first page.
  const matching = (await readPreparations(page)).filter((row: any) => (!keyword || row.productionOrderNo.includes(keyword)) && (!status || row.status === status))
  await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(Math.min(10, matching.length))
}
async function readPreparations(page: Page) {
  return page.evaluate(async () => {
    const sources = await import('/src/data/wls/accessory-warehouse-sources.ts')
    return sources.listAccessoryPreparations()
  })
}
async function readPersisted(page: Page) {
  return page.evaluate(async () => {
    const api = await import('/src/data/wls/accessory-warehouse-records.ts')
    return api.readAccessoryRecordSnapshot()
  })
}
async function assertLayout(page: Page, rootSelector: string) {
  const layout = await page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement | null
    const bounds = root?.getBoundingClientRect()
    return {
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      rootLeft: bounds?.left, rootRight: bounds?.right,
      tableScrolls: [...(root?.querySelectorAll<HTMLElement>('[data-standard-list-scroll]') || [])]
        .map((element) => ({ client: element.clientWidth, scroll: element.scrollWidth, overflow: getComputedStyle(element).overflowX })),
    }
  }, rootSelector)
  assert.ok(layout.documentWidth <= layout.viewport + 1, JSON.stringify(layout))
  assert.ok(layout.rootLeft !== undefined && layout.rootLeft >= -1, JSON.stringify(layout))
  assert.ok(layout.rootRight !== undefined && layout.rootRight <= layout.viewport + 1, JSON.stringify(layout))
  assert.ok(layout.tableScrolls.every((scroll) => scroll.scroll <= scroll.client + 1 || ['auto', 'scroll'].includes(scroll.overflow)))
  return layout
}

test('GTP查询、部分登记、真实保存、备注和操作记录经刷新回读保持一致', { timeout: 120000 }, async () => {
  await withPage('gtp-preparation', async (page) => {
    await openGtp(page)
    const baseline = (await readPreparations(page)).find((row: any) => row.productionOrderNo === 'PO-202603-0008')!
    const line = baseline.lines.find((row: any) => row.preparedQty === 0 && row.availableQty >= 5)!
    assert.ok(line)
    await queryGtp(page, baseline.productionOrderNo)
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(1)
    await page.locator('[data-accessory-action="prepare"]').click()
    const dialog = page.getByRole('dialog', { name: '登记配料', exact: true })
    await expect(dialog).toBeVisible()
    const quantity = dialog.locator('[data-aw-qty]').filter({ visible: true })
    const selected = dialog.locator(`[data-aw-qty="${line.id}"]`)
    await selected.fill('5')
    await dialog.locator(`[data-aw-location="${line.id}"]`).selectOption({ label: 'GTP-A-01' })
    await dialog.locator('[data-aw-actor]').fill('阶段一页面验收')
    await page.screenshot({ path: resolve(output, 'gtp-register-partial-1366.png'), fullPage: true })
    assert.ok(await quantity.count())
    await dialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const saved = (await readPreparations(page)).find((row: any) => row.id === baseline.id)!
    assert.equal(saved.lines.find((row: any) => row.id === line.id)!.preparedQty, line.preparedQty + 5)
    assert.equal(saved.lines.find((row: any) => row.id === line.id)!.availableQty, line.availableQty - 5)
    assert.equal(saved.status, '配料中')
    assert.equal((await readPersisted(page)).records.filter((row: any) => row.collection === 'accessory-warehouse:preparation').length, 1)

    await page.locator('[data-accessory-action="remark"]').click()
    await page.getByRole('dialog', { name: '配料备注', exact: true }).locator('[data-aw-remark]').fill('阶段一实际页面验收：先配 5 条，余量待配。')
    await page.getByRole('button', { name: '保存备注', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('[data-accessory-action="history"]').click()
    await expect(page.getByRole('dialog', { name: '配料记录', exact: true })).toContainText('登记配料')
    await expect(page.getByRole('dialog', { name: '配料记录', exact: true })).toContainText('修改备注')
    await page.screenshot({ path: resolve(output, 'gtp-history-1366.png'), fullPage: true })
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await page.reload()
    await page.locator('[data-accessory-preparation-root]').waitFor()
    await queryGtp(page, baseline.productionOrderNo)
    const refreshed = (await readPreparations(page)).find((row: any) => row.id === baseline.id)!
    assert.equal(refreshed.lines.find((row: any) => row.id === line.id)!.preparedQty, line.preparedQty + 5)
    assert.equal(refreshed.remark, '阶段一实际页面验收：先配 5 条，余量待配。')
    await expect(page.locator('[data-aw-preparation-card]')).toContainText(refreshed.remark)
    checks['gtp-preparation'] = { passed: true, preparationId: baseline.id, lineId: line.id, preparedBefore: line.preparedQty, preparedAfter: refreshed.lines.find((row: any) => row.id === line.id)!.preparedQty, history: refreshed.history, persisted: await readPersisted(page) }
  })
})

test('GTP可用不足与未逐行配齐均阻断，真实保存失败保留输入并可重试', { timeout: 120000 }, async () => {
  await withPage('gtp-boundaries', async (page) => {
    await openGtp(page)
    await queryGtp(page, 'PO-202603-0102')
    await page.locator('[data-accessory-action="prepare"]').click()
    const dialog = page.getByRole('dialog', { name: '登记配料', exact: true })
    await dialog.locator('[data-aw-qty]').first().fill('1')
    // 库存已按实际库位投影：此 SKU 在 A-01 有实物，B-03 没有。
    await dialog.locator('[data-aw-location]').first().selectOption({ label: 'GTP-B-03' })
    await expect(dialog.locator('[data-aw-available]').first()).toHaveText(/^0 /)
    await dialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(dialog.locator('[data-aw-modal-error]')).toContainText('可用数量不足')
    assert.equal(await dialog.locator('[data-aw-qty]').first().inputValue(), '1')
    assert.equal((await readPersisted(page)).records.length, 0)
    await page.screenshot({ path: resolve(output, 'gtp-insufficient-stock.png'), fullPage: true })
    page.once('dialog', (confirmation) => confirmation.accept())
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.locator('[data-accessory-action="complete"]')).toBeDisabled()
    assert.equal((await readPersisted(page)).records.length, 0)

    await queryGtp(page, 'PO-202603-0008')
    await page.locator('[data-accessory-action="prepare"]').click()
    const retryDialog = page.getByRole('dialog', { name: '登记配料', exact: true })
    await retryDialog.locator('[data-aw-qty]').first().fill('3')
    await retryDialog.locator('[data-aw-location]').first().selectOption({ label: 'GTP-A-01' })
    await page.evaluate(() => {
      ;(globalThis as any).__awOriginalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
        if (this.name === 'records') throw new DOMException('stage1 quota injection', 'QuotaExceededError')
        return (globalThis as any).__awOriginalPut.apply(this, args)
      }
    })
    await retryDialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(retryDialog.locator('[data-aw-modal-error]')).toContainText('stage1 quota injection')
    assert.equal(await retryDialog.locator('[data-aw-qty]').first().inputValue(), '3')
    assert.equal((await readPersisted(page)).records.length, 0)
    await page.screenshot({ path: resolve(output, 'gtp-save-failure-input-retained.png'), fullPage: true })
    await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__awOriginalPut })
    await retryDialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(retryDialog).toHaveCount(0)
    const retried = (await readPersisted(page)).records
    assert.equal(retried.filter((row: any) => row.collection === 'accessory-warehouse:preparation').length, 1)
    assert.equal(retried.filter((row: any) => row.collection === 'accessory-warehouse:stock').length, 1)
    assert.equal(retried.find((row: any) => row.collection === 'accessory-warehouse:stock').value.reservedQty, 3)
    checks['gtp-boundaries'] = { passed: true, insufficientStockBlocked: true, incompleteBlocked: true, abortInputRetained: true, genuineRetrySaved: true }
  })
})

test('GTP导出覆盖全部筛选记录，列显示与冻结保存，图片大图Esc和加载失败可关闭', { timeout: 120000 }, async () => {
  await withPage('gtp-controls', async (page) => {
    await openGtp(page)
    await queryGtp(page, 'PO-202603', '待配料')
    const expected = (await readPreparations(page)).filter((row: any) => row.status === '待配料' && row.productionOrderNo.includes('PO-202603'))
    assert.ok(expected.length > 10)
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(10)
    await page.locator('[data-accessory-action="next-page"]').click()
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(expected.length - 10)
    await page.screenshot({ path: resolve(output, 'gtp-filtered-second-page.png'), fullPage: true })
    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-accessory-action="export"]').click()
    const download = await downloadPromise
    const csvPath = resolve(output, 'gtp-filtered-export.csv')
    await download.saveAs(csvPath)
    const csv = await readFile(csvPath, 'utf8')
    assert.equal(csv.trim().split(/\r?\n/).length, expected.reduce((sum: number, row: any) => sum + row.lines.length, 0) + 1)
    assert.ok(expected.every((row: any) => csv.includes(row.productionOrderNo)))
    assert.ok(!csv.split(/\r?\n/)[0].includes('操作'))
    await page.locator('[data-accessory-action="prev-page"]').click()
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(10)

    await page.locator('[data-accessory-action="open-column-settings"]').click()
    const factorySetting = page.locator('[data-accessory-column-key="source"]')
    await factorySetting.getByRole('checkbox', { name: '显示', exact: true }).uncheck()
    await page.locator('[data-accessory-column-key="material"]').getByRole('checkbox', { name: '冻结', exact: true }).check()
    await page.locator('[data-accessory-action="close-column-settings"]').first().click()
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="source"]')).toHaveCount(0)
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="material"]').first()).toHaveClass(/sticky/)
    await page.reload()
    await page.locator('[data-accessory-preparation-root]').waitFor()
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="source"]')).toHaveCount(0)
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="material"]').first()).toHaveClass(/sticky/)

    await page.locator('[data-accessory-action="open-column-settings"]').click()
    await page.locator('[data-standard-list-column-key="required"]').dragTo(page.locator('[data-standard-list-column-key="source"]'), {
      sourcePosition: { x: 18, y: 24 }, targetPosition: { x: 60, y: 24 },
    })
    await expect.poll(async () => page.locator('[data-standard-list-column-key]').evaluateAll((nodes) => {
      const keys = nodes.map((node) => (node as HTMLElement).dataset.standardListColumnKey)
      return keys.indexOf('required') < keys.indexOf('source')
    })).toBe(true)
    const preferenceBeforeReload = await page.evaluate(() => localStorage.getItem('/wls/accessory-warehouses/gtp/preparation:list-columns'))
    await page.locator('[data-accessory-action="close-column-settings"]').first().click()
    await page.reload()
    await page.locator('[data-accessory-preparation-root]').waitFor()
    await page.locator('[data-accessory-action="open-column-settings"]').click()
    await page.locator('[data-standard-list-column-key="required"]').waitFor()
    const reordered = await page.locator('[data-standard-list-column-key]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.standardListColumnKey))
    assert.ok(reordered.indexOf('required') < reordered.indexOf('source'), JSON.stringify({ preferenceBeforeReload, preferenceAfterReload: await page.evaluate(() => localStorage.getItem('/wls/accessory-warehouses/gtp/preparation:list-columns')), reordered }))
    await page.locator('[data-accessory-action="restore-column-settings"]').click()
    await page.locator('[data-accessory-action="close-column-settings"]').first().click()
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="source"]').first()).toBeVisible()
    await expect(page.locator('[data-accessory-preparation-root] th[data-column-key="material"]').first()).toHaveClass(/sticky/)

    // Demo style images may differ from the style name per the user's explicit
    // decision. Every production-order style must still have a working image.
    await page.locator('[data-accessory-field="pageSize"]').selectOption('50')
    const allRows = await readPreparations(page)
    await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(allRows.length)
    const styleImages: Array<{ productionOrderNo: string; imageUrl: string | null }> = []
    for (let index = 0; index < allRows.length; index++) {
      const row = page.locator('[data-aw-preparation-card]').nth(index)
      const imageButton = row.locator('[data-accessory-action="image"]').first()
      await imageButton.scrollIntoViewIfNeeded()
      const imageUrl = await imageButton.getAttribute('data-image')
      assert.ok(imageUrl, `style image required for ${allRows[index].productionOrderNo}`)
      await expect.poll(() => imageButton.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await imageButton.click()
      await expect(page.locator('[data-aw-image] [role="dialog"]')).toBeVisible()
      await expect.poll(() => page.locator('[data-aw-image] img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-aw-image]')).toHaveCount(0)
      styleImages.push({ productionOrderNo: allRows[index].productionOrderNo, imageUrl })
    }

    const thumbnail = page.locator('[data-accessory-preparation-root] [data-accessory-action="image"]').first()
    await expect(thumbnail.locator('img')).toHaveJSProperty('complete', true)
    assert.ok(await thumbnail.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth > 0))
    const imageUrl = await thumbnail.getAttribute('data-image')
    await thumbnail.click()
    await expect(page.locator('[data-aw-image] [role="dialog"]')).toBeVisible()
    await expect(page.locator('[data-aw-image] img')).toHaveJSProperty('complete', true)
    assert.ok(await page.locator('[data-aw-image] img').evaluate((image) => (image as HTMLImageElement).naturalWidth > 0))
    await page.screenshot({ path: resolve(output, 'gtp-image-enlarged.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-aw-image]')).toHaveCount(0)
    assert.equal(await thumbnail.evaluate((element) => document.activeElement === element), true)

    assert.ok(imageUrl)
    const absoluteImageUrl = new URL(imageUrl!, base).href
    await page.route(absoluteImageUrl, (route) => route.abort('failed'))
    await page.reload()
    await page.locator('[data-accessory-preparation-root]').waitFor()
    const failedThumbnail = page.locator('[data-accessory-preparation-root] [data-accessory-action="image"]').first()
    await expect(failedThumbnail).toContainText('图片加载失败')
    await failedThumbnail.click()
    await expect(page.locator('[data-aw-image]')).toContainText('图片加载失败')
    await page.screenshot({ path: resolve(output, 'gtp-image-failure.png'), fullPage: true })
    await page.locator('[data-aw-image]').getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.locator('[data-aw-image]')).toHaveCount(0)
    await page.unroute(absoluteImageUrl)
    checks['gtp-controls'] = { passed: true, filteredRows: expected.length, visibleRowsAtExport: expected.length - 10, exportedRows: csv.trim().split(/\r?\n/).length - 1, paginationBothDirections: true, persistedColumns: ['factory hidden', 'order frozen', 'remark before factory'], defaultsRestored: true, styleImages, imageUrl, imageEnlargeEscapeAndFailure: true }
  })
})

test('基础仓库和库区读取三仓同源数据，18个新库位真实可查看', { timeout: 120000 }, async () => {
  await withPage('warehouse-locations', async (page) => {
    await page.goto(base + '/wls/basic/warehouse')
    await page.locator('[data-wls-basic-warehouse-root]').waitFor()
    await page.locator('[data-wls-basic-warehouse-field="attr"]').selectOption('辅料仓')
    await page.locator('[data-wls-basic-warehouse-action="apply-filter"]').click()
    await expect(page.locator('[data-wls-basic-warehouse-root] tbody tr')).toHaveCount(3)
    for (const name of ['辅料中央仓（GTP）', 'HILON辅料仓', 'Mahameru辅料仓', 'sea cutting', 'sea cutting2']) await expect(page.locator('[data-wls-basic-warehouse-root] tbody')).toContainText(name)
    assert.equal(await page.locator('[data-wls-basic-warehouse-root] tbody input[type="checkbox"]:checked').count(), 3)
    await page.screenshot({ path: resolve(output, 'basic-accessory-warehouses.png'), fullPage: true })

    await page.goto(base + '/wls/basic/zone-location')
    await page.locator('[data-wls-basic-zone-location-root]').waitFor()
    const locations: string[] = []
    for (const [name, prefix] of [['辅料中央仓（GTP）', 'GTP'], ['HILON辅料仓', 'HILON'], ['Mahameru辅料仓', 'MAHAMERU']]) {
      await page.locator('[data-wls-basic-zone-location-field="warehouse"]').selectOption(name)
      await page.locator('[data-wls-basic-zone-location-action="apply-filter"]').click()
      await expect(page.locator('[data-wls-basic-zone-location-root] tbody tr')).toHaveCount(2)
      const buttons = page.locator('[data-wls-basic-zone-location-action="view-locations"]')
      for (let index = 0; index < 2; index++) {
        await buttons.nth(index).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        const codes = (await dialog.innerText()).match(new RegExp(`${prefix}-[AB]-0[123]`, 'g')) || []
        assert.equal(codes.length, 3)
        locations.push(...codes)
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
      }
    }
    assert.equal(new Set(locations).size, 18)
    await page.screenshot({ path: resolve(output, 'basic-mahameru-zones.png'), fullPage: true })
    checks['warehouse-locations'] = { passed: true, distinctListedLocations: locations.length, locations }
  })
})

test('WLS全部菜单展开后递归节点均有SVG，分组及侧栏折叠可恢复，新增菜单顺序和选中正确', { timeout: 120000 }, async () => {
  await withPage('wls-menu-icons', async (page) => {
    await openGtp(page)
    const expected = await page.evaluate(async () => {
      const { menusBySystem } = await import('/src/data/app-shell-config.ts')
      return menusBySystem.wls.map((group: any) => ({ title: group.title, items: group.items }))
    })
    const aside = page.locator('aside').first()
    const headerNames = await aside.locator('[data-menu-group-header]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.menuGroupHeader))
    const mahameruIndex = headerNames.indexOf('新中转仓Mahameru')
    assert.deepEqual(headerNames.slice(mahameruIndex, mahameruIndex + 4), ['新中转仓Mahameru', '辅料中央仓（GTP）管理', 'HILON辅料仓管理', 'Mahameru辅料仓'])
    for (const group of expected) {
      const header = aside.locator(`[data-menu-group-header="${group.title}"]`)
      if (await header.getAttribute('aria-expanded') !== 'true') await header.click()
      await expect(header).toHaveAttribute('aria-expanded', 'true')
      for (const item of group.items) if (item.children?.length) {
        if (await aside.locator(`[data-tab-key="${item.children[0].key}"]`).count() === 0) await aside.locator(`[data-item-key="${item.key}"]`).click()
        await expect(aside.locator(`[data-tab-key="${item.children[0].key}"]`)).toHaveCount(1)
      }
    }
    const expectedItemKeys = expected.flatMap((group: any) => group.items.flatMap((item: any) => [item.key, ...(item.children || []).map((child: any) => child.key)]))
    const icons = await aside.locator('[data-menu-group-icon],[data-menu-item-icon]').evaluateAll((nodes) => nodes.map((node) => {
      const svg = node.querySelector('svg')
      const box = svg?.getBoundingClientRect()
      return { name: (node as HTMLElement).dataset.menuGroupIcon || (node as HTMLElement).dataset.menuItemIcon, svg: Boolean(svg), shapes: svg?.querySelectorAll('path,line,rect,circle,ellipse,polygon,polyline').length || 0, width: box?.width || 0, height: box?.height || 0 }
    }))
    assert.equal(icons.length, expected.length + expectedItemKeys.length)
    assert.deepEqual(icons.filter((icon) => !icon.svg || !icon.shapes || icon.width <= 0 || icon.height <= 0), [])
    for (const key of expectedItemKeys) assert.equal(await aside.locator(`[data-tab-key="${key}"] [data-menu-item-icon] svg`).count(), 1, key)
    await expect(aside.locator('[data-tab-key="wls-accessory-gtp-preparation"]')).toHaveClass(/bg-blue-50/)
    const group = aside.locator('[data-menu-group-header="HILON辅料仓管理"]')
    await group.click()
    await expect(group).toHaveAttribute('aria-expanded', 'false')
    await expect(aside.locator('[data-tab-key="wls-accessory-hilon-locations"]')).toHaveCount(0)
    await group.click()
    await expect(aside.locator('[data-tab-key="wls-accessory-hilon-locations"]')).toBeVisible()
    await aside.locator('[data-tab-key="wls-accessory-hilon-locations"]').click()
    await page.locator('[data-accessory-locations="hilon"]').waitFor()
    await expect(aside.locator('[data-tab-key="wls-accessory-hilon-locations"]')).toHaveClass(/bg-blue-50/)
    await aside.locator('[data-action="toggle-sidebar-collapsed"]').click()
    await expect(aside.locator('[data-menu-group-header]')).toHaveCount(0)
    assert.ok(await aside.locator('[data-menu-item-icon] svg').count())
    await page.screenshot({ path: resolve(output, 'wls-sidebar-collapsed.png'), fullPage: true })
    await aside.locator('[data-action="toggle-sidebar-collapsed"]').click()
    await expect(aside.locator('[data-menu-group-header]')).toHaveCount(expected.length)
    await page.screenshot({ path: resolve(output, 'wls-sidebar-expanded-selected.png'), fullPage: true })
    checks['wls-menu-icons'] = { passed: true, groups: expected.length, recursiveItems: expectedItemKeys.length, icons, requestedMenuOrder: headerNames.slice(mahameruIndex, mahameruIndex + 4), groupAndSidebarToggle: true }
  })
})

test('1366、1280、1024宽度下基础页面及三仓库位无主体横向溢出，GTP登记动作可达', { timeout: 180000 }, async () => {
  await withPage('responsive-layout', async (page) => {
    const layouts: unknown[] = []
    const routes = [
      { name: 'gtp', path: gtpPath, root: '[data-accessory-preparation-root]' },
      { name: 'warehouse', path: '/wls/basic/warehouse', root: '[data-wls-basic-warehouse-root]' },
      { name: 'zone', path: '/wls/basic/zone-location', root: '[data-wls-basic-zone-location-root]' },
      ...['gtp', 'hilon', 'mahameru'].map((key) => ({ name: `${key}-locations`, path: `/wls/accessory-warehouses/${key}/locations`, root: `[data-accessory-locations="${key}"]` })),
    ]
    for (const width of [1366, 1280, 1024]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 768 })
      for (const route of routes) {
        await page.goto(base + route.path)
        await page.locator(route.root).waitFor()
        if (route.name.endsWith('-locations')) await expect(page.locator(`${route.root} tbody tr`)).toHaveCount(6)
        layouts.push({ route: route.path, width, ...(await assertLayout(page, route.root)) })
        await page.screenshot({ path: resolve(output, `${route.name}-${width}.png`), fullPage: true })
      }
      await openGtp(page)
      await queryGtp(page, 'PO-202603-0008')
      await page.locator('[data-accessory-action="prepare"]').click()
      const dialog = page.getByRole('dialog', { name: '登记配料', exact: true })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: '保存本次配料', exact: true })).toBeInViewport()
      const box = await dialog.boundingBox()
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1)
      await page.screenshot({ path: resolve(output, `gtp-dialog-${width}.png`), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    }
    checks['responsive-layout'] = { passed: true, layouts }
  })
})
