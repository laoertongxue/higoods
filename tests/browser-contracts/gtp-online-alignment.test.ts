import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.ACCESSORY_STAGE1_UI_URL || 'http://127.0.0.1:43270'
const output = resolve('output/verification/gtp-online-alignment/new-contract')
const path = '/wls/accessory-warehouses/gtp/preparation'
let browser: Browser
const results: Record<string, unknown> = {}

before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => {
  await browser?.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base,
    environment: '独立浏览器本地 Vite 契约，不作为正式部署或性能验收证据', results }, null, 2))
})

async function withPage(name: string, run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage(), errors: string[] = [], events: unknown[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) events.push({ type: 'navigation', at: new Date().toISOString(), url: frame.url() }) })
  await page.exposeFunction('__gtpCapture', (event: unknown) => { events.push(event) })
  await page.addInitScript(() => {
    ;(globalThis as any).__name = (value: unknown) => value
    for (const type of ['click', 'input', 'change', 'keydown']) document.addEventListener(type, event => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-accessory-action],[data-accessory-field],[data-aw-qty],[data-aw-location],[data-aw-actor],[data-accessory-sort-field],[data-accessory-sort-direction],[data-aw-more-filters]') : null
      if (element || event instanceof KeyboardEvent && event.key === 'Escape') void (globalThis as any).__gtpCapture({ type, trusted: event.isTrusted,
        key: event instanceof KeyboardEvent ? event.key : undefined, attributes: element ? { ...element.dataset } : {}, text: element?.textContent?.trim().slice(0, 80) })
    }, true)
  })
  try {
    await run(page)
    assert.deepEqual(errors, [], 'GTP 本轮操作没有未捕获页面异常')
    results[name] = { passed: true, ...(results[name] as object || {}), pageErrors: errors }
  } catch (error) {
    results[name] = { passed: false, error: String(error), pageErrors: errors }
    const stamp = Date.now()
    await writeFile(resolve(output, `${name}-failure-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), url: page.url(), error: String(error), pageErrors: errors }, null, 2))
    await page.screenshot({ path: resolve(output, `${name}-failure-${stamp}.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await writeFile(resolve(output, `${name}-events.json`), JSON.stringify({ url: page.url(), errors, events }, null, 2))
    await context.close()
  }
}

async function open(page: Page): Promise<void> {
  await page.goto(base + path)
  await page.locator('[data-accessory-preparation-root]').waitFor()
  await expect(page.locator('[data-aw-preparation-card]').first()).toBeVisible()
}
async function sources(page: Page) {
  return page.evaluate(async () => {
    const source = await import('/src/data/wls/accessory-warehouse-sources.ts')
    const records = await import('/src/data/wls/accessory-warehouse-records.ts')
    const stock = await import('/src/data/wls/accessory-warehouse-stock-sources.ts')
    const orders = await import('/src/data/fcs/production-orders.ts')
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    return { preparations: source.listAccessoryPreparations(), stocks: stock.listAccessoryStockSources(records.listAccessoryRecords('stock')),
      orders: orders.productionOrders.map(row => ({ id: row.productionOrderId, createdAt: row.createdAt, saleType: row.demandSnapshot.saleType, isBrokenDown: row.taskBreakdownSummary.isBrokenDown })),
      projections: prep.listMaterialPrepOrderProjections(localStorage).map(row => ({ id: row.order.prepOrderId, number: row.order.prepOrderNo, createdAt: row.order.createdAt })) }
  })
}
async function persisted(page: Page) {
  return page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot())
}
async function stats(page: Page): Promise<Record<string, number>> {
  return page.locator('[data-standard-list-stats] > div').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.querySelector('span')?.textContent?.trim() || '', Number(node.querySelector('strong')?.textContent?.replaceAll(',', ''))])))
}
async function scope(page: Page, rows: any[]): Promise<void> {
  await expect.poll(async () => (await stats(page))['配料单']).toBe(rows.length)
  await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(Math.min(10, rows.length))
  assert.deepEqual(await stats(page), { 配料单: rows.length, 待配齐: rows.filter(row => row.status !== '已配齐').length, 已配齐: rows.filter(row => row.status === '已配齐').length })
  const ids = await page.locator('[data-aw-preparation-card]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.preparationId))
  assert.ok(ids.every(id => rows.some(row => row.id === id)))
}
async function query(page: Page, keyword: string, searchField = 'all', factory = ''): Promise<void> {
  await page.locator('[data-accessory-field="keyword"]').fill(keyword)
  await page.locator('[data-accessory-field="searchField"]').selectOption(searchField)
  await page.locator('[data-accessory-field="factory"]').selectOption(factory)
  await page.locator('[data-accessory-action="query"]').click()
}
async function reset(page: Page, rows: any[]): Promise<void> {
  await page.locator('[data-accessory-action="reset"]').click()
  // 已在完整结果时总数不变，必须等控件的实际重置结果，不能用21条作为事件完成信号。
  for (const field of ['keyword', 'factory', 'status', 'pickupStatus', 'saleType', 'stockFull', 'breakdown', 'from', 'to']) await expect(page.locator(`[data-accessory-field="${field}"]`)).toHaveValue('')
  await expect(page.locator('[data-accessory-field="searchField"]')).toHaveValue('all')
  await expect(page.locator('[data-accessory-sort-field]')).toHaveValue('')
  await scope(page, rows)
}

test('GTP直接展示21张Mock与10个逐单物料块，初读不落种子且裸Esc没有异常', { timeout: 90000 }, async () => {
  await withPage('direct-mock-and-escape', async page => {
    await open(page)
    const data = await sources(page)
    assert.equal(data.preparations.length, 21)
    await scope(page, data.preparations)
    const cards = page.locator('[data-aw-preparation-card]')
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index), id = await card.getAttribute('data-preparation-id')
      const row = data.preparations.find((item: any) => item.id === id)!
      await expect(card.locator('tbody tr')).toHaveCount(row.lines.length)
      await expect(card).toContainText('配料单信息')
      await expect(card).toContainText('车缝已领数量')
      assert.equal(await card.locator('img').count(), row.lines.length + 1)
    }
    const rootText = await page.locator('[data-accessory-preparation-root]').innerText()
    assert.doesNotMatch(rootText, /本机资料|迁移并切换|演示角色|加载种子|导入演示资料/)
    assert.equal((await persisted(page)).records.length, 0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(cards).toHaveCount(10)
    assert.equal((await persisted(page)).records.length, 0)
    await page.screenshot({ path: resolve(output, 'direct-mock-1366.png'), fullPage: true })
    results['direct-mock-and-escape'] = { mockCount: 21, cards: 10, initialPersisted: 0, inlineMaterials: true }
  })
})

test('GTP查询类型、真实工厂、待分配、更多日期筛选与排序重置均同步统计范围', { timeout: 120000 }, async () => {
  await withPage('filters-dates-sort-reset', async page => {
    await open(page)
    const data = await sources(page), all = data.preparations
    const material = all.find((row: any) => row.lines.length)!.lines[0].materialName
    const materialMatches = all.filter((row: any) => row.lines.some((line: any) => `${line.materialSku} ${line.materialName}`.includes(material)))
    assert.ok(materialMatches.length > 0)
    await query(page, material, 'material'); await scope(page, materialMatches)
    await query(page, material, 'order'); await scope(page, [])
    await query(page, '', 'all', 'sea cutting2')
    const sea2 = all.filter((row: any) => row.cuttingFactoryName === 'sea cutting2')
    assert.ok(sea2.length); await scope(page, sea2)
    await query(page, '', 'all', '待分配')
    const pending = all.filter((row: any) => !row.cuttingFactoryName)
    assert.ok(pending.length); await scope(page, pending)
    for (const card of await page.locator('[data-aw-preparation-card]').all()) await expect(card).toContainText('待定')
    await reset(page, all)
    await page.locator('[data-aw-more-filters] summary').click()
    await expect(page.locator('[data-accessory-field="saleType"]')).toBeVisible()
    await expect(page.locator('[data-accessory-field="stockFull"]')).toBeVisible()
    const sale = data.orders.find((order: any) => order.saleType && all.some((row: any) => row.productionOrderId === order.id))!.saleType
    await page.locator('[data-accessory-field="saleType"]').selectOption(sale)
    await page.locator('[data-accessory-action="query"]').click()
    await scope(page, all.filter((row: any) => data.orders.find((order: any) => order.id === row.productionOrderId)?.saleType === sale))
    await reset(page, all)
    await page.locator('[data-accessory-field="stockFull"]').selectOption('no')
    await page.locator('[data-accessory-action="query"]').click()
    const shortage = all.filter((row: any) => !row.lines.every((line: any) => line.availableQty + 0.000001 >= Math.max(0, line.requiredQty - line.preparedQty)))
    await scope(page, shortage)
    await reset(page, all)
    await page.locator('[data-accessory-field="breakdown"]').selectOption('no')
    await page.locator('[data-accessory-action="query"]').click()
    await scope(page, all.filter((row: any) => !data.orders.find((order: any) => order.id === row.productionOrderId)?.isBrokenDown))
    await reset(page, all)
    const candidate = data.orders.find((order: any) => order.createdAt && all.some((row: any) => row.productionOrderId === order.id))!
    assert.ok(candidate)
    const day = candidate.createdAt.slice(0, 10)
    await page.locator('[data-accessory-field="dateField"]').selectOption('orderCreatedAt')
    await page.locator('[data-accessory-field="from"]').fill(day)
    await page.locator('[data-accessory-field="to"]').fill(day)
    await page.locator('[data-accessory-action="query"]').click()
    const dateRows = all.filter((row: any) => data.orders.find((order: any) => order.id === row.productionOrderId)?.createdAt.slice(0, 10) === day)
    await scope(page, dateRows)
    await expect(page.locator('[data-aw-more-filters]')).toHaveAttribute('open', '')
    await page.screenshot({ path: resolve(output, 'date-filter-scope-1366.png'), fullPage: true })
    await reset(page, all)
    await page.locator('[data-accessory-sort-field]').selectOption('number')
    await page.locator('[data-accessory-sort-direction]').selectOption('asc')
    const sorted = [...data.projections].filter((projection: any) => all.some((row: any) => row.id === projection.id)).sort((a: any, b: any) => a.number.localeCompare(b.number, 'zh-CN')).slice(0, 10).map((row: any) => row.id)
    await expect.poll(() => page.locator('[data-aw-preparation-card]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.preparationId))).toEqual(sorted)
    await reset(page, all)
    assert.equal(await page.locator('[data-accessory-sort-field]').inputValue(), '')
    assert.equal(await page.locator('[data-accessory-field="from"]').inputValue(), '')
    assert.equal(await page.locator('[data-accessory-field="factory"]').inputValue(), '')
    assert.equal((await persisted(page)).records.length, 0)
    results['filters-dates-sort-reset'] = { material, materialCount: materialMatches.length, sea2Count: sea2.length, pendingCount: pending.length, saleType: sale, shortageCount: shortage.length, date: day, dateCount: dateRows.length, sortedIds: sorted }
  })
})

test('GTP物料行登记只编辑该行，保存数量和库存预留并经刷新回读', { timeout: 120000 }, async () => {
  await withPage('single-line-save-readback', async page => {
    await open(page)
    const data = await sources(page)
    const before = data.preparations.find((row: any) => row.productionOrderNo === 'PO-202603-0008')!
    const line = before.lines.find((item: any) => item.preparedQty === 0 && item.availableQty >= 5)!
    assert.ok(line)
    const stock = data.stocks.find((item: any) => item.warehouseCode === 'WH-FITTING-001' && item.materialSku === line.materialSku && item.unit === line.unit)!
    assert.ok(stock)
    await query(page, before.productionOrderNo, 'order'); await scope(page, [before])
    await page.locator('[data-aw-preparation-card]').locator(`[data-accessory-action="prepare-line"][data-line-id="${line.id}"]`).click()
    const dialog = page.getByRole('dialog', { name: '登记配料', exact: true })
    await expect(dialog.locator('[data-aw-qty]')).toHaveCount(1)
    await expect(dialog.locator('[data-aw-location]')).toHaveCount(1)
    assert.equal(await dialog.locator('[data-aw-qty]').getAttribute('data-aw-qty'), line.id)
    await dialog.locator('[data-aw-qty]').fill('5')
    await dialog.locator('[data-aw-location]').selectOption(stock.locationId)
    await dialog.locator('[data-aw-actor]').fill('GTP行登记验收')
    await page.screenshot({ path: resolve(output, 'single-line-editor-1366.png'), fullPage: true })
    await dialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const saved = await sources(page), after = saved.preparations.find((row: any) => row.id === before.id)!
    assert.equal(after.lines.find((item: any) => item.id === line.id)!.preparedQty, line.preparedQty + 5)
    for (const other of before.lines.filter((item: any) => item.id !== line.id)) assert.equal(after.lines.find((item: any) => item.id === other.id)!.preparedQty, other.preparedQty)
    const changed = saved.stocks.find((item: any) => item.id === stock.id)!
    assert.equal(changed.onHandQty, stock.onHandQty)
    assert.equal(changed.reservedQty, stock.reservedQty + 5)
    await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor()
    await query(page, before.productionOrderNo, 'order')
    const reloaded = await sources(page)
    assert.equal(reloaded.preparations.find((row: any) => row.id === before.id)!.lines.find((item: any) => item.id === line.id)!.preparedQty, line.preparedQty + 5)
    assert.equal(reloaded.stocks.find((item: any) => item.id === stock.id)!.reservedQty, stock.reservedQty + 5)
    const savedRecords = (await persisted(page)).records
    assert.equal(savedRecords.filter((row: any) => row.collection === 'accessory-warehouse:preparation').length, 1)
    assert.equal(savedRecords.filter((row: any) => row.collection === 'accessory-warehouse:stock').length, 1)
    results['single-line-save-readback'] = { preparationId: before.id, lineId: line.id, before: line.preparedQty, after: line.preparedQty + 5, onHand: changed.onHandQty, reservedBefore: stock.reservedQty, reservedAfter: changed.reservedQty }
  })
})

test('GTP旧资料无需维护入口，普通保存自动转换并保留原已配量及共用面料', { timeout: 120000 }, async () => {
  await withPage('legacy-business-save', async page => {
    await page.route('**/__gtp-online-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>独立旧资料夹具</body></html>' }))
    await page.goto(base + '/__gtp-online-contract')
    const fixture = await page.evaluate(async () => {
      await (await import('/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords()
      const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const projection = prep.listMaterialPrepOrderProjections(null).find(row => row.order.prepOrderId === 'prep-order-po-202603-0004')!
      const accessory = projection.lines.find(line => line.materialType === '辅料')!, fabric = projection.lines.find(line => line.materialType === '面料')!
      const raw = JSON.stringify({ otherModuleMeta: { keep: '共用资料保留' }, prepRecords: [{
        prepOrderId: projection.order.prepOrderId, prepRecordId: 'ONLINE-OLD-MIXED', prepLineId: accessory.prepLineId, batchNo: '旧批次', recordStatus: 'CONFIRMED', preparedQty: null,
        warehouseArea: '旧库区', locationCode: 'ACC-B-001', operatorName: '原仓管', preparedAt: '2026-10-18 09:00:00', rollCount: 0,
        confirmedAt: '2026-10-18 10:00:00', confirmedBy: '原仓管', rejectedAt: '', rejectedBy: '', rejectReason: '', sourceStockEventId: '', remark: '保留原数量',
        items: [{ prepRecordItemId: 'ONLINE-OLD-ACC', prepLineId: accessory.prepLineId, preparedQty: 7, rollCount: 0, sourceUnit: accessory.unit },
          { prepRecordItemId: 'ONLINE-OLD-FAB', prepLineId: fabric.prepLineId, preparedQty: 11, rollCount: 1, sourceUnit: fabric.unit }],
      }, {
        prepOrderId: projection.order.prepOrderId, prepRecordId: 'USER-DRAFT', prepLineId: accessory.prepLineId, batchNo: '旧草稿', recordStatus: 'DRAFT', preparedQty: 2,
        warehouseArea: '旧库区', locationCode: 'ACC-B-001', operatorName: '原仓管', preparedAt: '2026-10-18 09:00:00', rollCount: 0,
        confirmedAt: '', confirmedBy: '', rejectedAt: '', rejectedBy: '', rejectReason: '', sourceStockEventId: '', remark: '必须保留',
      }], pickupRecords: [], pickupSessions: [], pickupNodeSnapshots: [], pickupReturnRecords: [], rejectRecords: [], stagingRecords: [], closedOrders: [] })
      localStorage.setItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, raw)
      return { key: prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, raw, id: projection.order.prepOrderId, orderNo: projection.order.productionOrderNo, accessoryLine: accessory.prepLineId, fabricLine: fabric.prepLineId }
    })
    await open(page)
    const before = (await sources(page)).preparations.find((row: any) => row.id === fixture.id)!
    const oldQty = before.lines.find((line: any) => line.id === fixture.accessoryLine)!.preparedQty
    const originalHistory = before.history.filter((entry: any) => entry.action === '原配料记录' && entry.at === '2026-10-18 10:00:00' && entry.by === '原仓管')
    assert.ok(oldQty >= 7)
    assert.ok(originalHistory.length > 0, '旧已确认配料历史必须存在，不能只核对数量')
    assert.equal((await persisted(page)).records.length, 0)
    assert.equal(await page.evaluate(key => localStorage.getItem(key), fixture.key), fixture.raw)
    await query(page, fixture.orderNo, 'order'); await scope(page, [before])
    await page.locator('[data-aw-preparation-card] [data-accessory-action="remark"]').click()
    const dialog = page.getByRole('dialog', { name: '配料备注', exact: true })
    await dialog.locator('[data-aw-remark]').fill('正常业务保存兼容旧资料')
    await dialog.getByRole('button', { name: '保存备注', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const after = (await sources(page)).preparations.find((row: any) => row.id === fixture.id)!
    assert.equal(after.lines.find((line: any) => line.id === fixture.accessoryLine)!.preparedQty, oldQty)
    assert.equal(after.remark, '正常业务保存兼容旧资料')
    for (const entry of originalHistory) assert.ok(after.history.some((saved: any) => JSON.stringify(saved) === JSON.stringify(entry)), '正常保存保留原confirmedAt、确认人和配料历史')
    const draftHistory = after.history.find((entry: any) => entry.action === '旧配料记录' && entry.detail.includes('待拣货') && entry.detail.includes('2 条') && entry.detail.includes('必须保留'))
    assert.ok(draftHistory, '正常备注保存不得覆盖迁移新增的USER-DRAFT历史')
    const remaining = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), fixture.key)
    assert.deepEqual(remaining.otherModuleMeta, { keep: '共用资料保留' })
    const mixed = remaining.prepRecords.find((record: any) => record.prepRecordId === 'ONLINE-OLD-MIXED')
    assert.ok(mixed)
    assert.deepEqual(mixed.items.map((item: any) => ({ id: item.prepLineId, qty: item.preparedQty })), [{ id: fixture.fabricLine, qty: 11 }])
    const snapshot = await persisted(page)
    assert.ok(snapshot.records.some((row: any) => row.collection === 'accessory-warehouse:migration'))
    const archived = snapshot.records.find((row: any) => row.collection === 'accessory-warehouse:migration' && row.value.kind === 'LEGACY_ENTRY' && row.value.entry?.prepRecordId === 'ONLINE-OLD-MIXED')!.value as any
    assert.equal(archived.entry.confirmedAt, '2026-10-18 10:00:00')
    assert.equal(archived.entry.confirmedBy, '原仓管')
    await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor()
    const reread = (await sources(page)).preparations.find((row: any) => row.id === fixture.id)!
    assert.equal(reread.lines.find((line: any) => line.id === fixture.accessoryLine)!.preparedQty, oldQty)
    assert.equal(reread.remark, '正常业务保存兼容旧资料')
    for (const entry of originalHistory) assert.ok(reread.history.some((saved: any) => JSON.stringify(saved) === JSON.stringify(entry)))
    assert.ok(reread.history.some((entry: any) => entry.action === '旧配料记录' && entry.detail.includes('待拣货') && entry.detail.includes('2 条') && entry.detail.includes('必须保留')), '刷新后仍保留旧草稿业务历史')
    await page.screenshot({ path: resolve(output, 'legacy-save-readback-1366.png'), fullPage: true })
    await query(page, fixture.orderNo, 'order'); await scope(page, [reread])
    await page.locator('[data-aw-preparation-card]').getByRole('button', { name: '查看配料流水', exact: true }).click()
    const historyDialog = page.getByRole('dialog', { name: '配料记录', exact: true })
    await expect(historyDialog).toContainText('旧配料记录')
    await expect(historyDialog).toContainText('待拣货')
    await expect(historyDialog).toContainText('2 条')
    await expect(historyDialog).toContainText('必须保留')
    await page.screenshot({ path: resolve(output, 'legacy-draft-history-visible-1366.png'), fullPage: true })
    results['legacy-business-save'] = { preparationId: fixture.id, originalPreparedPreserved: oldQty, commonFabricPreserved: 11, originalHistory, draftHistory, draftHistoryVisible: true, archivedConfirmedAt: archived.entry.confirmedAt, initialPersisted: 0, migrationRecordCount: snapshot.records.filter((row: any) => row.collection === 'accessory-warehouse:migration').length }
  })
})

test('GTP历史已配齐单通过正常入口补建唯一整单调拨和收货单，原完成事实与库存不变', { timeout: 120000 }, async () => {
  await withPage('completed-transfer-business-entry', async page => {
    const fixture = JSON.parse(await readFile(resolve('tests/fixtures/accessory-warehouse/cutover.json'), 'utf8')).snapshot
    const original = fixture.records.find((row: any) => row.collection === 'accessory-warehouse:preparation' && row.value.productionOrderNo === 'PO-AW-202610-F01').value
    const originalStocks = fixture.records.filter((row: any) => row.collection === 'accessory-warehouse:stock').sort((a: any, b: any) => a.id.localeCompare(b.id))
    await page.route('**/__gtp-completed-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>独立已配齐夹具</body></html>' }))
    await page.goto(base + '/__gtp-completed-contract')
    await page.evaluate(async (snapshot) => {
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const before = await repository.readCuttingRecords()
      if (before.records.length) throw new Error('已配齐夹具必须使用空白隔离浏览器')
      const database = await repository.openCuttingRecordDatabase()
      const tx = database.transaction(['records', 'commands', 'meta'], 'readwrite')
      const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => {} })
      for (const record of snapshot.records) tx.objectStore('records').put(record)
      for (const command of snapshot.commands) tx.objectStore('commands').put(command)
      tx.objectStore('meta').put({ id: 'revision', value: snapshot.revision })
      await done
    }, fixture)
    await open(page)
    const readOnly = await persisted(page)
    assert.equal(readOnly.revision, fixture.revision)
    assert.equal(readOnly.records.filter((row: any) => row.collection === 'accessory-warehouse:transfer').length, 0)
    assert.equal(readOnly.records.filter((row: any) => row.collection === 'accessory-warehouse:receipt').length, 0)
    await query(page, original.productionOrderNo, 'order')
    const projected = (await sources(page)).preparations.find((row: any) => row.id === original.id)!
    await scope(page, [projected])
    await page.locator('[data-aw-preparation-card]').getByRole('button', { name: '建立整单调拨', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '完成配齐', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.locator('[data-aw-actor]').fill('历史整单调拨验收')
    await page.screenshot({ path: resolve(output, 'completed-transfer-confirm-1366.png'), fullPage: true })
    await dialog.getByRole('button', { name: '确认配齐并建立调拨', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const saved = await persisted(page)
    const transferRows = saved.records.filter((row: any) => row.collection === 'accessory-warehouse:transfer')
    const receiptRows = saved.records.filter((row: any) => row.collection === 'accessory-warehouse:receipt')
    assert.equal(transferRows.length, 1)
    assert.equal(receiptRows.length, 1)
    const transfer = transferRows[0].value as any, receipt = receiptRows[0].value as any
    assert.equal(transfer.kind, 'GTP_TO_SITE')
    assert.equal(transfer.preparationId, original.id)
    assert.equal(transfer.status, '待出库')
    assert.equal(transfer.fromWarehouse, 'WH-FITTING-001')
    assert.equal(transfer.toWarehouse, 'HILON-2')
    assert.equal(receipt.transferId, transfer.id)
    assert.equal(receipt.status, '待收货')
    assert.deepEqual(transfer.lines.map((line: any) => ({ source: line.sourceLineId, qty: line.qty })), original.lines.map((line: any) => ({ source: line.id, qty: line.preparedQty })))
    const savedPreparation = saved.records.find((row: any) => row.collection === 'accessory-warehouse:preparation' && row.value.id === original.id)!.value as any
    assert.equal(savedPreparation.completedAt, original.completedAt)
    assert.equal(savedPreparation.completedBy, original.completedBy)
    assert.equal(savedPreparation.completionVersion, original.completionVersion)
    assert.deepEqual(savedPreparation.history, original.history)
    assert.deepEqual(saved.records.filter((row: any) => row.collection === 'accessory-warehouse:stock').sort((a: any, b: any) => a.id.localeCompare(b.id)), originalStocks)
    await expect(page.locator('[data-aw-preparation-card]').getByRole('button', { name: '建立整单调拨', exact: true })).toHaveCount(0)
    for (let index = 0; index < 2; index++) {
      await page.reload(); await page.locator('[data-accessory-preparation-root]').waitFor()
      await query(page, original.productionOrderNo, 'order')
      await expect(page.locator('[data-aw-preparation-card]')).toHaveCount(1)
      await expect(page.locator('[data-aw-preparation-card]').getByRole('button', { name: '建立整单调拨', exact: true })).toHaveCount(0)
      const reread = await persisted(page)
      assert.equal(reread.revision, saved.revision)
      assert.deepEqual(reread.records.filter((row: any) => row.collection === 'accessory-warehouse:transfer'), transferRows)
      assert.deepEqual(reread.records.filter((row: any) => row.collection === 'accessory-warehouse:receipt'), receiptRows)
      assert.deepEqual(reread.records.filter((row: any) => row.collection === 'accessory-warehouse:stock').sort((a: any, b: any) => a.id.localeCompare(b.id)), originalStocks)
    }
    await page.screenshot({ path: resolve(output, 'completed-transfer-readback-1366.png'), fullPage: true })
    results['completed-transfer-business-entry'] = { preparationId: original.id, transferId: transfer.id, receiptId: receipt.id, initialTransferCount: 0, finalTransferCount: 1,
      originalCompletedAt: savedPreparation.completedAt, originalCompletedBy: savedPreparation.completedBy, originalHistoryPreserved: true, stocksUnchanged: originalStocks.length, repeatedReloads: 2, revisionAfterSave: saved.revision }
  })
})
