import { useEmptyInventoryQualityFixture } from './helpers/inventory-quality-empty-fixture.ts'
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createFinishedInventorySeed } from '../src/data/wls/finished-inventory-quality-seed.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'

// 每个用例使用Playwright新建的隔离context。WLS主路径通过原页面动作保存；
// 并发用例通过公开命令制造竞争；QC前置明确为领域夹具，均不冒称QC表单或现场验收。
async function openFinishingInventoryApplication(page: Page) {
  const id = new URL(page.url()).searchParams.get('id')
  if (!id) throw new Error('缺少本次库存送检申请身份')
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(id)}`)
}

const inventoryPath = '/src/data/wls/finished-inventory-quality.ts'
const recordsPath = '/src/data/wls/finished-inventory-records.ts'
async function inventorySnapshot(page: Page) {
  return page.evaluate(async ({ inventoryPath, recordsPath }) => {
    const api = await import(inventoryPath), records = await import(recordsPath)
    await records.ensureFinishedInventoryRecords()
    return { state: records.captureFinishedInventoryState(), realtime: api.finishedInventoryRealtimeRows(), online: api.finishedInventoryOnlineRows(), locations: api.finishedInventoryLocationRows() }
  }, { inventoryPath, recordsPath })
}
async function openApplicationPreview(page: Page) {
  await page.goto('/wls/finished/stock/realtime')
  await expect(page.getByRole('heading', { name: '即时库存查询 — 成衣', exact: true })).toBeVisible()
  const row = page.locator('tr').filter({ hasText: 'SKU-GC-20001' }).first()
  await expect(row.getByRole('link', { name: '本仓本款全部送检' })).toBeVisible()
  await row.getByRole('link', { name: '本仓本款全部送检' }).click()
  await expect(page.getByRole('heading', { name: '确认整批库存送检' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认下架出库 80 件' })).toBeEnabled()
}
async function createFromUi(page: Page) {
  await openApplicationPreview(page)
  await expect(page.locator('[data-fiq-form="apply"] input[name="operator"]')).toHaveCount(0)
  await page.getByRole('button', { name: '确认下架出库 80 件' }).click()
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
}


async function assertInventoryQcImages(page: Page, app: any) {
  await page.goto(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(app.qcTaskNo)}&view=detail`)
  await expect(page.getByRole('heading', { name: '质检记录详情', exact: true })).toBeVisible()
  const task = page.locator('[data-qc-workbench-task]')
  await expect(task).toBeVisible()
  const result = []
  for (const line of app.lines) {
    const image = task.locator(`img[src="${line.imageUrl}"]`).first()
    await expect(image).toHaveCount(1)
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), { message: `${line.skuCode}正式SKU图片必须实际加载，不能以失败文字替代` }).toBe(true)
    await expect(image).toBeVisible()
    const loaded = await image.evaluate((node: HTMLImageElement) => ({ src: node.currentSrc, width: node.naturalWidth, height: node.naturalHeight, alt: node.alt }))
    expect(new URL(loaded.src).pathname).toBe(line.imageUrl)
    expect(loaded.alt).toContain(line.colorName)
    result.push({ skuId: line.skuId, skuCode: line.skuCode, formalSkuImageUrl: line.imageUrl, ...loaded })
  }
  return result
}
// 先经实际QC只读入口准备其运行时配置，不从另一个canonical模块实例伪造ready。
// 仅使用真实业务桥导出的命令准备QC前置；实际QC表单另由根专项验收。
async function completeQcFromDomainFixture(page: Page, app: any) {
  await assertInventoryQcImages(page, app)
  await page.evaluate(async app => {
    const bridgePath = '/src/data/fcs/post-finishing-inventory-bridge.ts'
    const bridge = await import(bridgePath)
    await bridge.preparePostFinishingInventoryBridge(); await bridge.ensurePostFinishingRecordState()
    // 只从真实库存业务桥取得同一领域实例的命令和事务参与者；不另造状态或回调。
    const actor = bridge.POST_FINISHING_ACCEPTANCE_ACTORS.qcSupervisor, options = { participants: [bridge.inventoryTransactionParticipant] }
    await bridge.runPostFinishingCommand(() => bridge.claimPostFinishingQcTask({ qcTaskNo: app.qcTaskNo, actor }), options)
    await bridge.runPostFinishingCommand(() => bridge.submitPostFinishingQcRound({ qcTaskId: app.qcTaskId, actor, operationId: `inventory-fixture-round-1-${app.id}`,
      lines: app.lines.map((line: any, index: number) => ({ skuId: line.skuId, passedQty: index === 0 ? 19 : 0, defectQty: index === 0 ? 2 : 0, returnQty: index === 0 ? 3 : 0, issues: index === 0 ? [{ itemId: 'garment-clean' }] : [] })) }), options)
    await bridge.runPostFinishingCommand(() => bridge.upgradePostFinishingQcInspection({ qcTaskId: app.qcTaskId, actor, nextPercent: 100, note: '库存三去向页面隔离输入，升全检补足剩余实物' }), options)
    await bridge.runPostFinishingCommand(() => bridge.submitPostFinishingQcRound({ qcTaskId: app.qcTaskId, actor, operationId: `inventory-fixture-round-2-${app.id}`,
      lines: app.lines.map((line: any, index: number) => ({ skuId: line.skuId, passedQty: line.receivedQty - (index === 0 ? 24 : 0), defectQty: 0, returnQty: 0, issues: [] })) }), options)
    await bridge.runPostFinishingCommand(() => bridge.completePostFinishingQcTask({ qcTaskId: app.qcTaskId, actor, processItems: [] }), options)
  }, app)
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(app.id)}`)
}
async function createReceivedApplication(page: Page) {
  await createFromUi(page)
  const app = (await inventorySnapshot(page)).state.applications[0]
  await openFinishingInventoryApplication(page)
  const form = page.locator('[data-fiq-form="receive"]')
  for (const line of app.lines) await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  return (await inventorySnapshot(page)).state.applications[0]
}
async function createQcCompletedApplication(page: Page) {
  const app = await createReceivedApplication(page)
  await completeQcFromDomainFixture(page, app)
  await page.reload()
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
  return (await inventorySnapshot(page)).state.applications[0]
}
async function shipCategories(page: Page, appId: string) {
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(appId)}`)
  const transfers = (await inventorySnapshot(page)).state.transfers.filter((row: any) => row.applicationId === appId && row.category !== '送后道')
  for (const transfer of transfers) {
    const form = page.locator(`[data-fiq-form="ship"][data-transfer-id="${transfer.id}"]`)
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.getByRole('button', { name: /确认整批交出/ }).click()
    await expect(form).toHaveCount(0)
  }
  return transfers
}
async function receiveCategory(page: Page, transfer: any, short = 0) {
  await page.goto(transfer.category === '返工交接' ? `/fcs/production/inventory-rework-receipts?id=${encodeURIComponent(transfer.applicationId)}` : '/wls/finished/pre-inbound')
  const form = page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${transfer.id}"]`)
  await expect(form).toBeVisible()
  for (const [index, line] of transfer.lines.entries()) await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.quantity - (index === 0 ? short : 0)))
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: /整批实收/ }).click()
  await expect(form).toHaveCount(0)
}
async function putawayCategory(page: Page, transfer: any) {
  await page.goto('/wls/finished/putaway')
  const form = page.locator(`[data-fiq-form="putaway"][data-transfer-id="${transfer.id}"]`)
  await expect(form).toBeVisible()
  const selected: Array<{ skuId: string; locationCode: string }> = []
  for (const select of await form.locator('select[name="location"]').all()) {
    const locationCode = await select.locator('option').last().getAttribute('value')
    expect(locationCode).toBeTruthy()
    selected.push({ skuId: (await select.getAttribute('data-sku-id'))!, locationCode: locationCode! })
    await select.selectOption(locationCode!)
  }
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认本类实收全部上架' }).click()
  await expect(form).toHaveCount(0)
  const saved = (await inventorySnapshot(page)).state
  const record = saved.transfers.find((row: any) => row.id === transfer.id)
  expect(record.putawayAt).toBeTruthy()
  for (const line of selected) expect(saved.lots.some((row: any) => row.skuId === line.skuId && row.warehouseId === transfer.targetId && row.locationCode === line.locationCode && row.putaway && row.quantity === record.lines.find((r: any) => r.skuId === line.skuId).receivedQty)).toBe(true)
  return selected
}
async function nativePcsSnapshot(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('higood-pcs-records')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['records', 'operations'], 'readonly')
      const result: Record<string, any[]> = {}
      for (const name of ['records', 'operations']) { const read = tx.objectStore(name).getAll(); read.onsuccess = () => { result[name] = read.result.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))) } }
      tx.onabort = () => { db.close(); reject(tx.error) }
      tx.oncomplete = () => { db.close(); resolve(result) }
    }
  }))
}
async function readStandardTable(page: Page, columnKey: string) {
  return page.locator('table').filter({ has: page.locator(`th[data-column-key="${columnKey}"]`) }).evaluate((table: HTMLTableElement) => {
    const keys = [...table.querySelectorAll<HTMLElement>('thead th[data-column-key]')].map(th => th.dataset.columnKey!)
    return [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter(tr => tr.cells.length === keys.length).map(tr => Object.fromEntries(keys.map((key, index) => [key, tr.cells[index].innerText.trim()])))
  })
}
async function filterStockPage(page: Page, route: string, heading: string, prefix: string, keyword: string) {
  await page.goto(route)
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  await page.locator(`[data-${prefix}-field="keyword"]`).fill(keyword)
  await page.locator(`[data-${prefix}-action="apply-filter"]`).click()
}
async function assertStockPagesAndChannel(page: Page, app: any, stage: string) {
  const snapshot = await inventorySnapshot(page), raw = snapshot.state
  const expected = app.lines.map((line: any) => {
    const lots = raw.lots.filter((row: any) => row.warehouseId === app.warehouseId && row.skuId === line.skuId)
    const exclusions = new Map<string, number>()
    for (const row of raw.exclusions.filter((r: any) => r.active && r.warehouseId === app.warehouseId && r.skuId === line.skuId)) exclusions.set(row.orderLineId, Math.max(exclusions.get(row.orderLineId) || 0, row.quantity))
    const normal = lots.filter((row: any) => row.quality === '正常' && row.putaway).reduce((n: number, row: any) => n + row.quantity, 0)
    return { skuId: line.skuId, sku: line.skuCode, physical: lots.reduce((n: number, row: any) => n + row.quantity, 0), normal, pending: lots.filter((row: any) => !row.putaway).reduce((n: number, row: any) => n + row.quantity, 0), available: Math.max(0, normal - [...exclusions.values()].reduce((a, b) => a + b, 0)) }
  })
  await filterStockPage(page, '/wls/finished/stock/realtime', '即时库存查询 — 成衣', 'wls-stock-realtime', app.styleNo)
  const realtime = await readStandardTable(page, 'availableStock')
  for (const row of expected) {
    const match = realtime.filter(r => r.sku.includes(row.sku) && r.warehouseName === app.warehouseName)
    expect(match).toHaveLength(1); expect(Number(match[0].spotStock)).toBe(row.normal); expect(Number(match[0].totalStock)).toBe(row.physical)
    expect(Number(match[0].availableStock)).toBe(row.available); expect(Number(match[0].pendingPutawayQuantity)).toBe(row.pending)
  }
  await filterStockPage(page, '/wls/finished/stock/location', '仓位库存查询', 'wls-finished-stock-location', app.styleNo)
  const location = await readStandardTable(page, 'quantity')
  for (const row of expected) expect(location.filter(r => r.sku.includes(row.sku) && r.warehouseName === app.warehouseName).reduce((n, r) => n + Number(r.quantity), 0)).toBe(row.physical)
  await filterStockPage(page, '/wls/online/warehouse-stock', '仓库库存管理', 'wls-online-warehouse-stock', app.styleNo)
  const online = await readStandardTable(page, 'available')
  for (const row of expected) {
    const matches = online.filter(r => r.sku.includes(row.sku) && r.warehouseName === app.warehouseName)
    expect(matches.reduce((n, r) => n + Number(r.onHand), 0)).toBe(row.physical)
    expect(matches.reduce((n, r) => n + Number(r.available), 0)).toBe(row.available)
  }
  await filterStockPage(page, '/wls/finished/stock/flow', '库存流水查询', 'wls-stock-flow', app.applicationNo)
  const flow = await readStandardTable(page, 'actionType')
  const number = (value: string) => Number(value.replace(/^\+/, ''))
  const observed = flow.map(r => [r.warehouseName, r.sku, r.actionType, number(r.inboundChange), number(r.putawayChange), number(r.outboundChange)])
  const movements = raw.movements.filter((row: any) => row.applicationId === app.id).map((r: any) => [r.warehouseName, r.skuCode, r.action, r.action === '返仓实收' ? r.quantity : 0, r.action === '返仓上架' ? r.quantity : 0, r.action === '送检出库' ? r.quantity : 0])
  const sort = (values: any[][]) => values.map(row => JSON.stringify(row)).sort()
  expect(sort(observed)).toEqual(sort(movements))
  // 两个已有正式PID共享同一精确SKU。用中间0可售阶段证明直接读取，不能仅比最终总量。
  const black = expected.find((row: any) => row.sku === 'SKU-GC-20001')!
  const channels: Array<{ id: string; displayed: string }> = []
  for (const id of ['channel-listing-wms-demo-1', 'channel-listing-wms-demo-2']) {
    await page.goto(`/pcs/products/channel-products/${id}`)
    await expect(page.locator('[data-pcs-channel-page]')).toBeVisible()
    await page.locator('[data-pcs-channel-product-list-action="tab"][data-tab="sync"]').click()
    const source = page.locator('details').filter({ has: page.getByText('WMS 共享可售来源与演示操作', { exact: true }) })
    await source.locator('summary').click()
    const row = source.locator('tbody tr').filter({ hasText: black.sku })
    await expect(row).toHaveCount(1); await expect(row.locator('td').nth(1)).toHaveText(`${black.available} 件`)
    channels.push({ id, displayed: (await row.locator('td').nth(1).innerText()).trim() })
  }
  return { stage, expected, realtime, location, online, flow, channels }
}
const sourceFingerprints = () => ['tests/finished-inventory-quality-flow.spec.ts', 'src/data/wls/finished-inventory-quality.ts', 'src/data/wls/finished-inventory-records.ts', 'src/data/fcs/post-finishing-inventory-bridge.ts', 'src/data/fcs/post-finishing-records.ts', 'src/data/fcs/post-finishing-full-flow.ts', 'src/main.ts'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }))
const evidenceSessions = new WeakMap<Page, { source: ReturnType<typeof sourceFingerprints>; moduleUrls: Set<string> }>()
test.beforeEach(async ({ page }) => {
  const evidence = { source: sourceFingerprints(), moduleUrls: new Set<string>() }
  evidenceSessions.set(page, evidence)
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/src/')) evidence.moduleUrls.add(request.url()) })
})
test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceSessions.get(page), sourceAfter = sourceFingerprints()
  await testInfo.attach('inventory-vite-diagnostic-version', { body: JSON.stringify({ diagnosticOnly: true, baseURL: testInfo.project.use.baseURL, actualUrl: page.url(), sourceBefore: evidence?.source, sourceAfter, moduleUrls: [...evidence?.moduleUrls || []].sort(), note: 'WLS真实UI与明确领域夹具；非生产preview性能证据。' }, null, 2), contentType: 'application/json' })
  expect(sourceAfter, '用例执行中相关源码发生变化，不能将跨版本HMR结果作为当前证据').toEqual(evidence?.source)
})

test('原库存页面申请：事务失败不扣库不丢输入，重试只保存一次并可刷新直达', async ({ page }, testInfo) => {
  await openApplicationPreview(page)
  const before = await inventorySnapshot(page)
  expect(before.state.applications).toHaveLength(0)
  await expect(page.locator('[data-fiq-form="apply"] input[name="operator"]')).toHaveCount(0)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    ;(window as any).__inventoryOriginalPut = put
    IDBObjectStore.prototype.put = function (value, ...rest) {
      if (this.name === 'records' && String(value?.id).startsWith('higood-finished-inventory/')) throw new DOMException('isolated inventory quota', 'QuotaExceededError')
      return put.call(this, value, ...rest)
    }
  })
  await page.getByRole('button', { name: '确认下架出库 80 件' }).click()
  await expect(page.locator('[data-fiq-feedback]')).toContainText('空间不足')
  await expect(page.locator('[data-fiq-form="apply"] input[name="operator"]')).toHaveCount(0)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__inventoryOriginalPut })
  const failed = await inventorySnapshot(page)
  expect(failed.state).toEqual(before.state)
  await page.getByRole('button', { name: '确认下架出库 80 件' }).click()
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
  const saved = await inventorySnapshot(page)
  expect(saved.state.applications).toHaveLength(1)
  expect(saved.state.transfers).toHaveLength(1)
  expect(saved.state.transfers[0].shippedAt).toBeTruthy()
  expect(saved.state.transfers[0].receivedAt).toBeUndefined()
  const app = saved.state.applications[0]
  expect(saved.state.lots.filter((r: any) => r.warehouseId === app.warehouseId && r.styleId === app.styleId && r.quality === '正常').reduce((sum: number, r: any) => sum + r.quantity, 0)).toBe(20)
  expect(saved.realtime.filter((r: any) => r.warehouseId === app.warehouseId && r.styleId === app.styleId).reduce((sum: number, r: any) => sum + r.normalAvailableQuantity, 0)).toBe(0)
  expect(saved.online.filter((r: any) => r.warehouseName === app.warehouseName && r.spu === app.styleNo).reduce((sum: number, r: any) => sum + r.available, 0)).toBe(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '库存送检流转详情' })).toBeVisible()
  expect((await inventorySnapshot(page)).state.applications).toHaveLength(1)
  await testInfo.attach('inventory-application-atomic-result', { body: JSON.stringify({ before, failed, saved }, null, 2), contentType: 'application/json' })
})

test('后道原入口整批实收79与库存QC共同保存；出80及差异1不被改写', async ({ page }, testInfo) => {
  await createFromUi(page)
  const initial = await inventorySnapshot(page), app = initial.state.applications[0]
  await openFinishingInventoryApplication(page)
  const form = page.locator('[data-fiq-form="receive"]')
  for (let index = 0; index < app.lines.length; index++) {
    const line = app.lines[index]
    await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty - (index === 0 ? 1 : 0)))
  }
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  const received = await inventorySnapshot(page), saved = received.state.applications[0]
  expect(saved.lines.reduce((sum: number, row: any) => sum + row.outboundQty, 0)).toBe(80)
  expect(saved.lines.reduce((sum: number, row: any) => sum + row.receivedQty, 0)).toBe(79)
  expect(received.state.differences).toHaveLength(1)
  expect(received.state.differences[0].quantity).toBe(-1)
  const qc = await page.evaluate(async qcTaskId => {
    const path = '/src/data/pcs-record-db.ts', db = await import(path)
    const result = await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    return result.records.find((record: any) => record.value?.qcTaskId === qcTaskId && record.collection === 'flow/qcTasks')?.value
  }, saved.qcTaskId)
  expect(qc).toBeTruthy()
  expect(qc.sourceKind).toBe('WAREHOUSE_STOCK')
  expect(qc.lines.reduce((sum: number, row: any) => sum + row.expectedQty, 0)).toBe(79)
  expect(qc.productionOrderId || '').toBe('')
  expect(qc.status).not.toBe('质检完成')
  expect(Math.ceil(79 * .3)).toBe(24)
  const qcImages = await assertInventoryQcImages(page, saved)
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(saved.id)}`)
  await page.reload()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  await testInfo.attach('inventory-receipt-qc-source', { body: JSON.stringify({ received, qc, qcImages }, null, 2), contentType: 'application/json' })
})

test('两个标签以相同仓款资格预览同时申请，仅一次扣库出库成功', async ({ page, context }, testInfo) => {
  await page.goto('/wls/finished/inventory-quality')
  const other = await context.newPage()
  await other.goto('/wls/finished/inventory-quality')
  async function prepare(tab: Page) {
    return tab.evaluate(async ({ inventoryPath, recordsPath }) => {
      const api = await import(inventoryPath), records = await import(recordsPath)
      await records.ensureFinishedInventoryRecords()
      const lot = api.listFinishedInventoryLots().find((row: any) => row.styleId === 'style_r1_wms_tee')
      ;(window as any).__inventoryPreview = api.previewFinishedInventoryQuality(lot.warehouseId, lot.styleId)
    }, { inventoryPath, recordsPath })
  }
  await prepare(page); await prepare(other)
  async function submit(tab: Page, suffix: string) {
    return tab.evaluate(async ({ inventoryPath, suffix }) => {
      const api = await import(inventoryPath)
      try {
        const result = await api.runFinishedInventoryCommand(() => api.createFinishedInventoryQualityApplication({ preview: (window as any).__inventoryPreview, operationId: `two-tabs-${suffix}`, actor: '并发隔离仓管' }), `two-tabs-${suffix}`, '仓款范围并发隔离契约')
        return { ok: true, id: result.id }
      } catch (error) { return { ok: false, error: String(error) } }
    }, { inventoryPath, suffix })
  }
  const results = await Promise.all([submit(page, 'A'), submit(other, 'B')])
  expect(results.filter(result => result.ok)).toHaveLength(1)
  const snapshot = await inventorySnapshot(page)
  expect(snapshot.state.applications).toHaveLength(1)
  expect(snapshot.state.transfers).toHaveLength(1)
  expect(snapshot.state.lots.filter((r: any) => r.warehouseId === 'WH-L1-GMT-001' && r.styleId === 'style_r1_wms_tee' && r.quality === '正常').reduce((sum: number, r: any) => sum + r.quantity, 0)).toBe(20)
  await testInfo.attach('inventory-concurrent-scope-result', { body: JSON.stringify({ results, snapshot }, null, 2), contentType: 'application/json' })
})

test('隔离QC完成输入后三去向由原入库及上架页面实办，goto实收结束且正常上架才可售', async ({ page }, testInfo) => {
  await createFromUi(page)
  const created = await inventorySnapshot(page), original = created.state.applications[0]
  await openFinishingInventoryApplication(page)
  const receiveForm = page.locator('[data-fiq-form="receive"]')
  for (const line of original.lines) await receiveForm.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
  await expect(receiveForm.locator('input[name="operator"]')).toHaveCount(0)
  await receiveForm.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  await completeQcFromDomainFixture(page, (await inventorySnapshot(page)).state.applications[0])
  await page.reload()
  const qcFinished = await inventorySnapshot(page), transfers = qcFinished.state.transfers.filter((row: any) => row.applicationId === original.id && row.category !== '送后道')
  expect(transfers).toHaveLength(3)
  expect(qcFinished.state.applications[0].completedAt).toBeUndefined()
  for (const transfer of transfers) {
    const form = page.locator(`[data-fiq-form="ship"][data-transfer-id="${transfer.id}"]`)
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.getByRole('button', { name: /确认整批交出/ }).click()
    await expect(page.locator(`[data-fiq-form="ship"][data-transfer-id="${transfer.id}"]`)).toHaveCount(0)
  }
  await page.goto('/wls/finished/pre-inbound')
  for (const transfer of transfers) {
    await page.goto(transfer.category === '返工交接' ? `/fcs/production/inventory-rework-receipts?id=${encodeURIComponent(transfer.applicationId)}` : '/wls/finished/pre-inbound');
    const form = page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${transfer.id}"]`)
    await expect(form).toBeVisible()
    for (const line of transfer.lines) await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.quantity))
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    if (transfer.category === '正常返仓') {
      // 明确的前端目标篡改负例：真实表单没有任意换仓控件，领域仍须拒绝错误目标。
      const beforeWrongTarget = await inventorySnapshot(page)
      await form.evaluate(node => { node.setAttribute('data-target-id', 'ISOLATED-WRONG-WAREHOUSE') })
      await form.getByRole('button', { name: /整批实收/ }).click()
      await expect(page.locator('[data-fiq-feedback]')).toContainText('接收仓库或返工工厂不一致')
      await expect(form.locator('input[name="operator"]')).toHaveCount(0)
      expect((await inventorySnapshot(page)).state).toEqual(beforeWrongTarget.state)
      await form.evaluate((node, targetId) => { node.setAttribute('data-target-id', targetId) }, transfer.targetId)
    }
    await form.getByRole('button', { name: /整批实收/ }).click()
    await expect(page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${transfer.id}"]`)).toHaveCount(0)
  }
  const received = await inventorySnapshot(page)
  expect(received.state.applications[0].completedAt).toBeUndefined()
  expect(received.realtime.filter((r: any) => r.styleId === original.styleId && r.warehouseId === original.warehouseId).reduce((sum: number, r: any) => sum + r.normalAvailableQuantity, 0)).toBe(0)
  expect(received.state.transfers.find((row: any) => row.category === '返工交接').receivedAt).toBeTruthy()
  await page.goto('/wls/finished/putaway')
  const putawayFaults: any[] = []
  const normal = transfers.find((row: any) => row.category === '正常返仓')!, defect = transfers.find((row: any) => row.category === '瑕疵入仓')!
  // goto已实收；只完成正常上架时，唯一尚缺的是瑕疵上架，必须仍未完成申请。
  for (const transfer of [normal, defect]) {
    const form = page.locator(`[data-fiq-form="putaway"][data-transfer-id="${transfer.id}"]`)
    await expect(form).toBeVisible()
    const selected: Array<{ skuId: string; locationCode: string }> = []
    for (const select of await form.locator('select[name="location"]').all()) {
      const locationCode = (await select.locator('option').last().getAttribute('value'))!
      selected.push({ skuId: (await select.getAttribute('data-sku-id'))!, locationCode })
      await select.selectOption(locationCode)
    }
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    if (transfer.category === '正常返仓') {
      const beforeFault = await nativePcsSnapshot(page), beforeState = await inventorySnapshot(page)
      await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put
        ;(window as any).__inventoryPutawayOriginalPut = put
        IDBObjectStore.prototype.put = function(value, ...rest) {
          if (this.name === 'records' && String(value?.id).startsWith('higood-finished-inventory/lots/')) throw new DOMException('isolated putaway abort', 'QuotaExceededError')
          return put.call(this, value, ...rest)
        }
      })
      try {
        await form.getByRole('button', { name: '确认本类实收全部上架' }).click()
        await expect(page.locator('[data-fiq-feedback]')).toContainText('空间不足')
        await expect(form.locator('input[name="operator"]')).toHaveCount(0)
        for (const item of selected) await expect(form.locator(`select[data-sku-id="${item.skuId}"]`)).toHaveValue(item.locationCode)
        expect(await nativePcsSnapshot(page)).toEqual(beforeFault)
        expect((await inventorySnapshot(page)).state).toEqual(beforeState.state)
        putawayFaults.push({ beforeFault, afterFault: await nativePcsSnapshot(page), selected, beforeState })
      } finally { await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__inventoryPutawayOriginalPut }) }
    }
    await form.getByRole('button', { name: '确认本类实收全部上架' }).click()
    await expect(form).toHaveCount(0)
    const afterPutaway = (await inventorySnapshot(page)).state
    for (const item of selected) expect(afterPutaway.lots.some((lot: any) => lot.skuId === item.skuId && lot.warehouseId === transfer.targetId && lot.locationCode === item.locationCode && lot.putaway && lot.quantity === afterPutaway.transfers.find((r: any) => r.id === transfer.id).lines.find((r: any) => r.skuId === item.skuId).receivedQty)).toBe(true)
    if (transfer.category === '正常返仓') {
      expect(afterPutaway.transfers.find((row: any) => row.id === normal.id).putawayAt).toBeTruthy()
      expect(afterPutaway.transfers.find((row: any) => row.id === defect.id).putawayAt).toBeUndefined()
      expect(afterPutaway.transfers.find((row: any) => row.category === '返工交接').receivedAt).toBeTruthy()
      expect(afterPutaway.differences).toHaveLength(0)
      expect(afterPutaway.applications[0].completedAt).toBeUndefined()
    }
  }
  const final = await inventorySnapshot(page)
  expect(final.state.applications[0].completedAt).toBeTruthy()
  expect(final.state.lots.filter((r: any) => r.warehouseId === original.warehouseId && r.styleId === original.styleId && r.quality === '正常').reduce((sum: number, r: any) => sum + r.quantity, 0)).toBe(95)
  expect(final.state.lots.filter((r: any) => r.warehouseId === 'WH-FINISHED-DEFECT-001').reduce((sum: number, r: any) => sum + r.quantity, 0)).toBe(2)
  expect(final.realtime.filter((r: any) => r.styleId === original.styleId && r.warehouseId === original.warehouseId).reduce((sum: number, r: any) => sum + r.normalAvailableQuantity, 0)).toBe(75)
  const rework = final.state.transfers.find((row: any) => row.category === '返工交接')
  expect(rework.targetId).toBe('KOL-GOTO-001')
  expect(rework.lines.reduce((sum: number, line: any) => sum + line.receivedQty, 0)).toBe(3)
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(original.id)}`)
  await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible()
  await testInfo.attach('inventory-three-destinations-wls-ui-result', { body: JSON.stringify({ qcInputKind: 'isolated public command fixture; QC UI evidence is outside this case', qcFinished, received, putawayFaults, final }, null, 2), contentType: 'application/json' })
})

test('真实WLS整批实收0不建QC，逐SKU差异确认后仍不虚构检查或完成', async ({ page }, testInfo) => {
  await createFromUi(page)
  const original = (await inventorySnapshot(page)).state.applications[0]
  await openFinishingInventoryApplication(page)
  const form = page.locator('[data-fiq-form="receive"]')
  for (const line of original.lines) await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill('0')
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByText('实收为0待核实差异', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toHaveCount(0)
  const received = await inventorySnapshot(page), app = received.state.applications[0]
  expect(app.qcTaskId).toBeUndefined(); expect(app.qcCompletedAt).toBeUndefined(); expect(app.completedAt).toBeUndefined()
  expect(app.lines.reduce((n: number, line: any) => n + line.outboundQty, 0)).toBe(80)
  expect(app.lines.reduce((n: number, line: any) => n + line.receivedQty, 0)).toBe(0)
  for (const difference of received.state.differences) {
    const differenceForm = page.locator(`[data-fiq-form="difference"][data-difference-id="${difference.id}"]`)
    await expect(differenceForm.locator('input[name="operator"]')).toHaveCount(0)
    await differenceForm.getByRole('button', { name: '确认差异处理' }).click()
    await expect(page.locator('[data-fiq-feedback]')).toContainText('真实原因')
    await expect(differenceForm.locator('input[name="operator"]')).toHaveCount(0)
    await differenceForm.locator('input[name="reason"]').fill('隔离演示：本批运输未到实物，仓管已核实')
    await differenceForm.locator('input[name="disposition"]').fill('隔离演示：保留实际0接收及缺少量，不虚构退仓或QC')
    await differenceForm.getByRole('button', { name: '确认差异处理' }).click()
    await expect(page.locator(`[data-fiq-form="difference"][data-difference-id="${difference.id}"]`)).toHaveCount(0)
  }
  await page.reload()
  const final = await inventorySnapshot(page)
  expect(final.state.applications[0].completedAt).toBeUndefined()
  expect(final.state.applications[0].qcTaskId).toBeUndefined()
  expect(final.state.transfers).toHaveLength(1)
  expect(final.state.differences.every((row: any) => row.resolvedAt && row.reason && row.disposition)).toBe(true)
  const imagePath = testInfo.outputPath('zero-receipt-difference-confirmed.png')
  await page.screenshot({ path: imagePath, fullPage: true })
  await testInfo.attach('zero-receipt-screen', { path: imagePath, contentType: 'image/png' })
  await testInfo.attach('zero-receipt-facts', { body: JSON.stringify({ received, final }, null, 2), contentType: 'application/json' })
})

test('真实WLS超收81保留原出库80及差异，确认真实原因去向不改QC实收基数', async ({ page }, testInfo) => {
  await createFromUi(page)
  const original = (await inventorySnapshot(page)).state.applications[0]
  await openFinishingInventoryApplication(page)
  const form = page.locator('[data-fiq-form="receive"]')
  for (const [index, line] of original.lines.entries()) await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty + (index === 0 ? 1 : 0)))
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  const received = await inventorySnapshot(page), app = received.state.applications[0], difference = received.state.differences[0]
  expect(app.lines.reduce((n: number, line: any) => n + line.outboundQty, 0)).toBe(80)
  expect(app.lines.reduce((n: number, line: any) => n + line.receivedQty, 0)).toBe(81)
  expect(difference.quantity).toBe(1)
  const differenceForm = page.locator(`[data-fiq-form="difference"][data-difference-id="${difference.id}"]`)
  await differenceForm.locator('input[name="reason"]').fill('隔离演示：实点比原交出登记多1件')
  await differenceForm.locator('input[name="disposition"]').fill('隔离演示：按实收81开展QC，原出库80独立保留')
  await expect(differenceForm.locator('input[name="operator"]')).toHaveCount(0)
  await differenceForm.getByRole('button', { name: '确认差异处理' }).click()
  await expect(page.locator(`[data-fiq-form="difference"][data-difference-id="${difference.id}"]`)).toHaveCount(0)
  await page.reload()
  const final = await inventorySnapshot(page), saved = final.state.applications[0]
  expect(saved.lines.reduce((n: number, line: any) => n + line.outboundQty, 0)).toBe(80)
  expect(saved.lines.reduce((n: number, line: any) => n + line.receivedQty, 0)).toBe(81)
  expect(saved.completedAt).toBeUndefined(); expect(saved.qcCompletedAt).toBeUndefined()
  expect(final.state.differences[0].quantity).toBe(1); expect(final.state.differences[0].resolvedAt).toBeTruthy()
  const qc = await page.evaluate(async qcTaskId => {
    const path = '/src/data/pcs-record-db.ts', db = await import(path), result = await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    return result.records.find((record: any) => record.value?.qcTaskId === qcTaskId && record.collection === 'flow/qcTasks')?.value
  }, saved.qcTaskId)
  expect(qc.sourceKind).toBe('WAREHOUSE_STOCK')
  expect(qc.lines.reduce((n: number, line: any) => n + line.expectedQty, 0)).toBe(81)
  const qcImages = await assertInventoryQcImages(page, saved)
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(saved.id)}`)
  const imagePath = testInfo.outputPath('over-receipt-source81.png')
  await page.screenshot({ path: imagePath, fullPage: true })
  await testInfo.attach('over-receipt-screen', { path: imagePath, contentType: 'image/png' })
  await testInfo.attach('over-receipt-qc-facts', { body: JSON.stringify({ received, final, qc, qcImages, note: 'QC开检应检25由根真实QC表单专项验证；本条实际验证N81来源' }, null, 2), contentType: 'application/json' })
})

test('本仓本款资格为0时原库存预览不可确认，不建立空申请出库或释放原订单', async ({ page }, testInfo) => {
  await createFromUi(page)
  const before = await inventorySnapshot(page)
  await page.goto('/wls/finished/stock/realtime')
  const row = page.locator('tr').filter({ hasText: 'SKU-GC-20001' }).first()
  await row.getByRole('link', { name: '本仓本款全部送检' }).click()
  await expect(page.getByRole('heading', { name: '确认整批库存送检' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认下架出库 0 件' })).toBeDisabled()
  const after = await inventorySnapshot(page)
  expect(after.state).toEqual(before.state)
  expect(after.state.applications).toHaveLength(1)
  expect(after.state.transfers).toHaveLength(1)
  expect(after.state.exclusions).toEqual(before.state.exclusions)
  await testInfo.attach('zero-eligibility-no-empty-write', { body: JSON.stringify({ before, after }, null, 2), contentType: 'application/json' })
})

test('已切换仓SKU在旧移货执行及新增入口均拒绝旧写，保留输入及统一库存事实', async ({ page }, testInfo) => {
  await page.goto('/wls/finished/stock/realtime')
  await expect(page.getByRole('heading', { name: '即时库存查询 — 成衣', exact: true })).toBeVisible()
  const before = await inventorySnapshot(page)
  await page.goto('/wls/finished/stock/transfer')
  await page.locator('[data-wls-stock-transfer-action="execute"][data-record-id="ST-0001"]').click()
  await page.locator('[data-wls-stock-transfer-action="run-confirm"]').click()
  await expect(page.locator('[data-list-feedback-host]')).toContainText('本旧移货记录来源不一致')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('[data-wls-stock-transfer-action="execute"][data-record-id="ST-0001"]')).toBeEnabled()
  await page.locator('[data-wls-stock-transfer-action="create"]').click()
  await page.locator('[data-wls-stock-transfer-edit="sku"]').fill('SKU-GC-20001')
  await page.locator('[data-wls-stock-transfer-edit="quantity"]').fill('1')
  await page.locator('[data-wls-stock-transfer-edit="sourceLocation"]').fill('隔离原库位')
  await page.locator('[data-wls-stock-transfer-edit="targetLocation"]').fill('隔离目标库位')
  await page.locator('[data-wls-stock-transfer-action="save-edit"]').click()
  await expect(page.locator('[data-list-feedback-host]')).toContainText('旧移货来源不可继续写入')
  await expect(page.locator('[data-wls-stock-transfer-edit="sku"]')).toHaveValue('SKU-GC-20001')
  await expect(page.locator('[data-wls-stock-transfer-edit="quantity"]')).toHaveValue('1')
  const after = await inventorySnapshot(page)
  expect(after.state).toEqual(before.state)
  await testInfo.attach('retired-stock-writer-rejected', { body: JSON.stringify({ before, after, legacyIdentity: 'ST-0001 has old SPU/locations and cannot author current exact warehouse+SKU stock' }, null, 2), contentType: 'application/json' })
})


test('其他分类接收上架全部完成仍等待goto实收，实际接收即完分支且不新造QC或可售', async ({ page }, testInfo) => {
  const app = await createQcCompletedApplication(page), transfers = await shipCategories(page, app.id)
  const rework = transfers.find((row: any) => row.category === '返工交接')!
  for (const transfer of transfers.filter((row: any) => row.category !== '返工交接')) { await receiveCategory(page, transfer); await putawayCategory(page, transfer) }
  const beforeGoto = await inventorySnapshot(page), beforeNative = await nativePcsSnapshot(page)
  const pending = beforeGoto.state.applications.find((row: any) => row.id === app.id)
  expect(pending.qcCompletedAt).toBeTruthy(); expect(pending.completedAt).toBeUndefined()
  expect(beforeGoto.state.differences).toHaveLength(0)
  expect(beforeGoto.state.transfers.filter((row: any) => row.applicationId === app.id && ['正常返仓', '瑕疵入仓'].includes(row.category)).every((row: any) => row.receivedAt && row.putawayAt)).toBe(true)
  expect(beforeGoto.state.transfers.find((row: any) => row.id === rework.id).receivedAt).toBeUndefined()
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(app.id)}`)
  await expect(page.getByText('待分类交接及上架', { exact: true }).first()).toBeVisible()
  await receiveCategory(page, rework)
  const afterGoto = await inventorySnapshot(page), afterNative = await nativePcsSnapshot(page)
  expect(afterGoto.state.applications.find((row: any) => row.id === app.id).completedAt).toBeTruthy()
  expect(afterGoto.state.transfers.find((row: any) => row.id === rework.id).receivedAt).toBeTruthy()
  expect(afterGoto.state.lots.some((row: any) => row.warehouseId === rework.targetId)).toBe(false)
  expect(afterGoto.state.lots).toEqual(beforeGoto.state.lots)
  // 接收goto只更改库存交接/进度，后道namespace不能衍生新的QC、复检或加工事实。
  const post = (records: any[]) => records.filter(row => row.id.startsWith('higood-fcs-post-finishing-records/') && row.collection !== 'revision')
  expect(post(afterNative.records)).toEqual(post(beforeNative.records))
  expect(afterNative.records.find((row: any) => row.id === 'higood-fcs-post-finishing-records/revision').version).toBe(beforeNative.records.find((row: any) => row.id === 'higood-fcs-post-finishing-records/revision').version + 1)
  await page.reload()
  expect((await inventorySnapshot(page)).state.applications.find((row: any) => row.id === app.id).completedAt).toBeTruthy()
  await testInfo.attach('goto-last-completion-gate', { body: JSON.stringify({ qcInputKind: 'isolated public command fixture', beforeGoto, afterGoto, beforePost: post(beforeNative.records), afterPost: post(afterNative.records) }, null, 2), contentType: 'application/json' })
})

test('QC和全部去向上架已完成时真实短收差异仍阻断，确认损耗后才完成且不改旧数量', async ({ page }, testInfo) => {
  const app = await createQcCompletedApplication(page), transfers = await shipCategories(page, app.id)
  for (const transfer of transfers) {
    await receiveCategory(page, transfer, transfer.category === '正常返仓' ? 1 : 0)
    if (transfer.category !== '返工交接') await putawayCategory(page, transfer)
  }
  const before = await inventorySnapshot(page), pending = before.state.applications.find((row: any) => row.id === app.id)
  expect(pending.qcCompletedAt).toBeTruthy(); expect(pending.completedAt).toBeUndefined()
  expect(before.state.transfers.filter((row: any) => row.applicationId === app.id && row.category !== '送后道').every((row: any) => row.receivedAt && (row.category === '返工交接' || row.putawayAt))).toBe(true)
  const differences = before.state.differences.filter((row: any) => row.applicationId === app.id)
  expect(differences).toHaveLength(1); expect(differences[0].quantity).toBe(-1); expect(differences[0].resolvedAt).toBeUndefined()
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(app.id)}`)
  const form = page.locator(`[data-fiq-form="difference"][data-difference-id="${differences[0].id}"]`)
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  await form.getByRole('button', { name: '确认差异处理' }).click()
  await expect(page.locator('[data-fiq-feedback]')).toContainText('真实原因')
  await expect(form.locator('input[name="operator"]')).toHaveCount(0)
  expect((await inventorySnapshot(page)).state).toEqual(before.state)
  await form.locator('input[name="reason"]').fill('隔离演示：返仓途中遗失1件，经逐SKU清点确认')
  await form.locator('input[name="disposition"]').fill('隔离演示：登记实际运输损耗，不补造库存或修改QC')
  await form.getByRole('button', { name: '确认差异处理' }).click()
  await expect(form).toHaveCount(0)
  const after = await inventorySnapshot(page), completed = after.state.applications.find((row: any) => row.id === app.id)
  expect(completed.completedAt).toBeTruthy()
  expect(completed.lines).toEqual(pending.lines); expect(completed.qcResults).toEqual(pending.qcResults)
  expect(after.state.transfers).toEqual(before.state.transfers); expect(after.state.lots).toEqual(before.state.lots)
  const saved = after.state.differences.find((row: any) => row.id === differences[0].id)
  expect(saved.expectedQty).toBe(differences[0].expectedQty); expect(saved.actualQty).toBe(differences[0].actualQty); expect(saved.quantity).toBe(-1)
  expect(saved.resolvedAt).toBeTruthy(); expect(saved.resolvedBy).toBe('黄回货确认员'); expect(saved.reason).toContain('遗失1件'); expect(saved.disposition).toContain('不补造库存')
  expect(after.state.lots.filter((row: any) => row.warehouseId === app.warehouseId && row.styleId === app.styleId && row.quality === '正常').reduce((n: number, row: any) => n + row.quantity, 0)).toBe(94)
  await page.reload()
  expect((await inventorySnapshot(page)).state.applications.find((row: any) => row.id === app.id).completedAt).toBeTruthy()
  await testInfo.attach('downstream-difference-completion-gate', { body: JSON.stringify({ qcInputKind: 'isolated public command fixture', before, after }, null, 2), contentType: 'application/json' })
})

test('四个原库存页面和两渠道PID直接读取同一SKU，申请下架待上架及上架后DOM数量一致', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  // 先从原库存创建真实申请；基线只读来自未保存seed，不使用产品测试API写事实。
  await openApplicationPreview(page)
  const initial = await inventorySnapshot(page), preview = await page.evaluate(async inventoryPath => {
    const api = await import(inventoryPath), lot = api.listFinishedInventoryLots().find((row: any) => row.styleId === 'style_r1_wms_tee')
    return api.previewFinishedInventoryQuality(lot.warehouseId, lot.styleId)
  }, inventoryPath)
  const beforeApp = { id: 'not-created', applicationNo: 'not-created', warehouseId: preview.warehouseId, warehouseName: preview.warehouseName, styleId: preview.styleId, styleNo: preview.styleNo, lines: preview.lines }
  // 离开尚未填写的预览可正常只读；基线四页实际可见数字和两个PID可售30。
  const stages = [await assertStockPagesAndChannel(page, beforeApp, '申请前')]
  await createFromUi(page)
  const app = (await inventorySnapshot(page)).state.applications[0]
  stages.push(await assertStockPagesAndChannel(page, app, '申请后已下架出库'))
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(app.id)}`)
  await openFinishingInventoryApplication(page)
  const receive = page.locator('[data-fiq-form="receive"]')
  for (const line of app.lines) await receive.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
  await expect(receive.locator('input[name="operator"]')).toHaveCount(0)
  await receive.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  await completeQcFromDomainFixture(page, (await inventorySnapshot(page)).state.applications[0])
  await page.reload()
  const transfers = await shipCategories(page, app.id)
  for (const transfer of transfers) await receiveCategory(page, transfer)
  stages.push(await assertStockPagesAndChannel(page, app, '正常实收待上架'))
  for (const transfer of transfers.filter((row: any) => row.category !== '返工交接')) await putawayCategory(page, transfer)
  stages.push(await assertStockPagesAndChannel(page, app, '正常及瑕疵上架后'))
  const final = await inventorySnapshot(page)
  expect(initial.state.applications).toHaveLength(0); expect(final.state.applications).toHaveLength(1)
  expect(final.state.applications[0].completedAt).toBeTruthy()
  expect(stages[0].expected.reduce((n: number, row: any) => n + row.available, 0)).toBe(80)
  expect(stages[1].expected.reduce((n: number, row: any) => n + row.available, 0)).toBe(0)
  expect(stages[2].expected.reduce((n: number, row: any) => n + row.available, 0)).toBe(0)
  expect(stages[3].expected.reduce((n: number, row: any) => n + row.available, 0)).toBe(75)
  await testInfo.attach('four-stock-pages-and-two-channel-dom', { body: JSON.stringify({ qcInputKind: 'isolated public command fixture', initial, stages, final }, null, 2), contentType: 'application/json' })
})


test('旧移货冷直达和刷新均先识别非种子持久SKU，阻止旧写并保留其他SKU旧流程', async ({ page }, testInfo) => {
  const base=createFinishedInventorySeed().lots[0], source=listSkuArchives().find(row=>row.skuId==='skuSeed_style_demand_SPU_HOODIE_082_001')!
  expect(source).toBeTruthy()
  const lot={...base,id:'FI-COLD-PERSISTED-FORMAL-SKU',skuId:source.skuId,skuCode:source.skuCode,styleId:source.styleId,styleNo:source.styleCode,styleName:source.styleName,colorName:source.colorName,sizeName:source.sizeName,imageUrl:source.skuImageUrl,barcode:source.barcode,quantity:17,sourceRef:'ISOLATED:COLD-GUARD-VERIFY'}
  expect(createFinishedInventorySeed().lots.some(row=>row.skuId===lot.skuId)).toBe(false)
  await page.route('**/__inventory-cold-guard',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated native fixture</title>'}))
  await page.goto('/__inventory-cold-guard')
  const row={id:'higood-finished-inventory/lots/'+encodeURIComponent(lot.id),collection:'higood-finished-inventory/lots',value:lot,version:1}
  await page.evaluate(async row=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('higood-pcs-records');req.onupgradeneeded=()=>{for(const name of ['records','files','operations','meta'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(row);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});db.close()
  },row)
  await page.addInitScript(()=>{(window as any).__inventoryGuardWrites=[];const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){if(String(value?.id).startsWith('higood-finished-inventory/'))(window as any).__inventoryGuardWrites.push(value.id);return put.call(this,value,...rest)}})
  for(const refresh of [false,true]){
    if(refresh)await page.reload();else await page.goto('/wls/finished/stock/transfer')
    await expect(page.getByRole('heading',{name:'移货操作',exact:true})).toBeVisible()
    await page.locator('[data-wls-stock-transfer-action="create"]').click()
    for(const [key,value] of Object.entries({sku:source.skuCode,quantity:'1',sourceLocation:lot.locationCode,targetLocation:'隔离目标库位'}))await page.locator(`[data-wls-stock-transfer-edit="${key}"]`).fill(value)
    await page.locator('[data-wls-stock-transfer-action="save-edit"]').click()
    await expect(page.locator('[data-list-feedback-host]')).toContainText('旧移货来源不可继续写入')
    await expect(page.locator('[data-wls-stock-transfer-edit="sku"]')).toHaveValue(source.skuCode)
    const native=await page.evaluate(async id=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('higood-pcs-records');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});try{return await new Promise<any>((resolve,reject)=>{const tx=db.transaction('records','readonly'),req=tx.objectStore('records').get(id);let value:any;req.onsuccess=()=>{value=req.result};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error)})}finally{db.close()}},row.id)
    expect(native).toEqual(row);expect(await page.evaluate(()=>(window as any).__inventoryGuardWrites)).toEqual([])
    await testInfo.attach(`cold-persisted-inventory-guard-${refresh?'refresh':'cold'}`,{body:JSON.stringify({row,native}),contentType:'application/json'})
  }
  await page.locator('[data-wls-stock-transfer-edit="sku"]').fill('ISOLATED-UNMANAGED-OLD-SKU')
  await page.locator('[data-wls-stock-transfer-action="save-edit"]').click()
  await expect(page.locator('[data-wls-stock-transfer-edit="sku"]')).toHaveCount(0)
  await expect(page.locator('tbody')).toContainText('ISOLATED-UNMANAGED-OLD-SKU')
  expect(await page.evaluate(()=>(window as any).__inventoryGuardWrites)).toEqual([])
})

test('审查补缺：库存统计包含待接收申请，出库80实收79与稽查及三去向同源', async ({ page }, info) => {
  // The pre-existing structured-standard one-off switch is fixture preparation, before the read-only snapshot.
  await page.goto('/fcs/quality-management/basic-standards')
  await expect(page.getByRole('heading', { name: '基本质检标准', exact: true })).toBeVisible()
  test.setTimeout(180000)
  page.setDefaultTimeout(15000)
  await page.addInitScript(() => { (window as any).__name = (value: unknown) => value })
  await createFromUi(page)
  let app = (await inventorySnapshot(page)).state.applications[0]
  const statisticsPath = '/fcs/quality-management/statistics?sourceKind=WAREHOUSE_STOCK&keyword=' + encodeURIComponent(app.applicationNo)
  const recordsPath = '/fcs/quality-management/records?sourceKind=WAREHOUSE_STOCK&keyword=' + encodeURIComponent(app.applicationNo)
  const metric = async (group: string, label: string, value: number) => {
    const section = page.locator(`[data-qm-statistics="${group}"]`)
    await expect(section).toBeVisible()
    const card = section.getByText(label, { exact: true }).locator('..')
    await expect(card).toContainText(new RegExp(`(^|\\D)${value}(\\D|$)`))
  }
  const beforePendingRead = await nativePcsSnapshot(page)
  await page.goto(statisticsPath)
  await metric('inventory-intake', '送检申请（批）', 1)
  await metric('inventory-intake', '送检出库（件）', 80)
  await metric('inventory-intake', '待后道接收（批）', 1)
  await page.goto(recordsPath)
  await expect(page.locator('table tbody tr')).toHaveCount(1)
  await expect(page.locator('table tbody tr')).toContainText(app.applicationNo)
  await expect(page.locator('table tbody tr')).toContainText('待后道实收')
  await page.getByRole('link', { name: app.applicationNo, exact: true }).click()
  await expect(page.getByRole('link', { name: '打开原业务', exact: true })).toHaveAttribute('href', `/wls/finished/inventory-quality?id=${encodeURIComponent(app.id)}`)
  await expect(page.locator('main')).toContainText('尚未形成质检单')
  expect(await nativePcsSnapshot(page)).toEqual(beforePendingRead)
  await info.attach('pending-application-center', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(app.id)}`)
  await openFinishingInventoryApplication(page)
  const receive = page.locator('[data-fiq-form="receive"]')
  for (const [index, line] of app.lines.entries()) await receive.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty - (index === 0 ? 1 : 0)))
  await expect(receive.locator('input[name="operator"]')).toHaveCount(0)
  await receive.getByRole('button', { name: '确认整批实收并形成库存QC' }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台' })).toBeVisible()
  app = (await inventorySnapshot(page)).state.applications[0]
  await page.goto(statisticsPath)
  await metric('inventory-intake', '送检申请（批）', 1)
  await metric('inventory-intake', '送检出库（件）', 80)
  await metric('inventory-intake', '后道实收（件）', 79)
  await metric('inventory-intake', '待后道接收（批）', 0)
  await page.goto(recordsPath)
  await expect(page.locator('table tbody tr')).toHaveCount(1)
  const centerRows = await readStandardTable(page, 'quantity')
  expect(centerRows).toHaveLength(1)
  expect(centerRows[0].quantity).toBe('80')
  expect(centerRows[0].receivedQty).toBe('79')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出筛选结果', exact: true }).click()
  const download = await downloadPromise
  const csv = readFileSync((await download.path())!, 'utf8').replace(/^\uFEFF/, '')
  const csvRows = csv.trim().split('\n').map(line => line.trim().split(',').map(value => value.replace(/^"|"$/g, '')))
  expect(csvRows).toHaveLength(2)
  expect(csvRows[1][csvRows[0].indexOf('送检量（件）')]).toBe('80')
  expect(csvRows[1][csvRows[0].indexOf('后道实收（件）')]).toBe('79')
  expect(csvRows[0]).not.toContain('操作')
  await info.attach('stock-sent-versus-received-filtered-export.csv', { body: csv, contentType: 'text/csv' })

  // Existing public-command QC fixture: 24 inspected (19/2/3), then upgrade to
  // full and inspect the remaining55. Claim/round UI is covered by its own suite.
  await completeQcFromDomainFixture(page, app)
  const transfers = await shipCategories(page, app.id)
  for (const transfer of transfers) {
    await receiveCategory(page, transfer)
    if (transfer.category !== '返工交接') await putawayCategory(page, transfer)
  }
  const beforeFinalRead = await nativePcsSnapshot(page)
  await page.goto(statisticsPath)
  await metric('inventory-intake', '送检申请（批）', 1)
  await metric('inventory-intake', '送检出库（件）', 80)
  await metric('inventory-intake', '后道实收（件）', 79)
  await metric('inspection-audits', '稽查触发次数', 1)
  await metric('inspection-audits', '待处理稽查', 0)
  await metric('inspection-audits', '已升检次数', 1)
  for (const [label, count] of [['正常返仓实收（件）',74],['正常已上架（件）',74],['瑕疵仓实收（件）',2],['瑕疵已上架（件）',2],['返工实收（件）',3]] as const) await metric('inventory-return', label, count)
  await page.reload()
  await metric('inventory-intake', '送检申请（批）', 1)
  await metric('inventory-return', '瑕疵仓实收（件）', 2)
  expect(await nativePcsSnapshot(page)).toEqual(beforeFinalRead)
  const final = (await inventorySnapshot(page)).state
  expect(final.applications[0].completedAt).toBeUndefined() // actual outbound/receipt difference remains unresolved
  await info.attach('statistics-after-three-destination-ui', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await info.attach('source-facts-and-readonly-equality', { body: JSON.stringify({ application: final.applications[0], transfers: final.transfers, differences: final.differences, centerReadsWroteNothing: true }), contentType: 'application/json' })
})

test('审查补缺：库存申请关联QC缺失时不伪装待接收或空统计', async ({ page }, info) => {
  // The pre-existing structured-standard one-off switch is fixture preparation, before the read-only snapshot.
  await page.goto('/fcs/quality-management/basic-standards')
  await expect(page.getByRole('heading', { name: '基本质检标准', exact: true })).toBeVisible()
  page.setDefaultTimeout(15000)
  await createFromUi(page)
  const app = (await inventorySnapshot(page)).state.applications[0]
  // Explicit corruption of one isolated stored record, never a business action
  // or a change to the user's browser. The center must preserve this source.
  await page.evaluate(async id => {
    const path = '/src/data/pcs-record-db.ts', db = await import(path)
    const rowId = `higood-finished-inventory/applications/${encodeURIComponent(id)}`
    const row = (await db.readPcsRecords(['higood-finished-inventory'])).records.find((row: any) => row.id === rowId)!
    await db.commitPcsRecords({ puts: [{ ...row, value: { ...row.value, qcTaskId: 'ISOLATED-MISSING-QC' }, expectedVersion: row.version }], deletes: [], operationId: 'r33-explicit-orphan-fixture', intent: 'isolated damaged QC-reference negative fixture' })
  }, app.id)
  const before = await nativePcsSnapshot(page)
  await page.goto('/fcs/quality-management/statistics?sourceKind=WAREHOUSE_STOCK')
  await expect(page.locator('[role="alert"]').filter({ hasText: '库存送检申请关联的质检记录缺失' })).toBeVisible()
  await expect(page.locator('[data-qm-statistics="inventory-intake"]')).toHaveCount(0)
  expect(await nativePcsSnapshot(page)).toEqual(before)
  await info.attach('missing-qc-not-replaced-by-pending', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.getByRole('button',{name:'重新读取',exact:true}).click()
  await expect(page.locator('[role="alert"]').filter({hasText:'库存送检申请关联的质检记录缺失'})).toBeVisible()
  await expect(page.locator('[data-qm-statistics="inventory-intake"]')).toHaveCount(0)
  expect(await nativePcsSnapshot(page)).toEqual(before)
  // Explicitly repair this isolated fixture through native storage, then use
  // the real retry control. Retrying the read itself must not write anything.
  await page.evaluate(async id=>{
    const path='/src/data/pcs-record-db.ts',db=await import(path)
    const rowId=`higood-finished-inventory/applications/${encodeURIComponent(id)}`
    const row=(await db.readPcsRecords(['higood-finished-inventory'])).records.find((row:any)=>row.id===rowId)!
    const value={...row.value};delete value.qcTaskId
    await db.commitPcsRecords({puts:[{...row,value,expectedVersion:row.version}],deletes:[],operationId:'r33-explicit-orphan-fixture-repair',intent:'restore original isolated application after negative read test'})
  },app.id)
  const repaired=await nativePcsSnapshot(page)
  await page.getByRole('button',{name:'重新读取',exact:true}).click()
  await expect(page.locator('[role="alert"]').filter({hasText:'库存送检申请关联的质检记录缺失'})).toHaveCount(0)
  await expect(page.locator('[data-qm-statistics="inventory-intake"]')).toContainText('80')
  await expect(page.locator('[role="alert"]').filter({hasText:'库存送检申请关联的质检记录缺失'})).toHaveCount(0)
  expect(await nativePcsSnapshot(page)).toEqual(repaired)
})

test.beforeEach(async ({page,baseURL})=>{await useEmptyInventoryQualityFixture(page,baseURL)})
