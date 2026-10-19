import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
const base = process.env.ACCESSORY_POST_TEST_URL || 'http://127.0.0.1:43241'
const output = resolve('output/playwright/accessory-warehouse/post-finishing')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, environment: 'isolated real IndexedDB and exported Web UI', pdaMainDiagnosticAccepted: Boolean((evidence.pdaMain as { passed?: boolean } | undefined)?.passed), formalPreviewPerformanceAccepted: false, evidence }, null, 2)) })
async function run(fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, acceptDownloads: true }), page = await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.stack || error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__post-harness*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  try { await page.goto(base + '/__post-harness'); await fn(page); assert.deepEqual(errors, []) }
  catch (error) { const id = `failure-${Date.now()}`; await writeFile(resolve(output, `${id}.json`), JSON.stringify({ error: String(error), errors, url: page.url() }, null, 2)); await page.screenshot({ path: resolve(output, `${id}.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}
async function canonicalFixture(page: Page) {
  return page.evaluate(async () => {
    const adapter = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
    const sources = await import('/src/data/wls/accessory-warehouse-sources.ts')
    const records = await import('/src/data/wls/accessory-warehouse-records.ts')
    const flow = await import('/src/data/wls/accessory-warehouse-flow.ts')
    await adapter.prepareAccessoryPostFinishing()
    const prep = sources.listAccessoryPreparations().find(row => row.productionOrderId === 'PO-AW-202610-F01')!
    const source = { id: 'POST-UI-SOURCE', preparationId: prep.id, productionOrderId: prep.productionOrderId, kind: 'GTP_TO_SITE', fromWarehouse: 'WH-FITTING-001', toWarehouse: 'HILON-2', status: '已收货', version: 1, createdAt: '2026-10-19T09:00:00.000Z', createdBy: '演示仓管', history: [], lines: prep.lines.map(line => ({ ...line, qty: line.requiredQty, fromLocationId: 'GTP-SOURCE', toLocationId: 'HILON-SOURCE' })) }
    const split = flow.splitAccessoryLinesForTask(source.lines as any, 'SEWING')
    const transfer = flow.createAccessoryPostTransfer(source as any, { id: 'POST-UI-1', taskType: 'SEWING', responsibilityKey: 'TASK-UI-V1', at: source.createdAt, by: '演示仓管', quantitiesByLine: Object.fromEntries(split.postLines.map((line, index) => [line.id, index === 0 ? 10 : 20])) })
    transfer.status = '已出库待收货'; transfer.dispatchedAt = source.createdAt; transfer.dispatchedBy = 'HILON演示仓管'
    transfer.history.push({ action: '整单出库', at: source.createdAt, by: 'HILON演示仓管', detail: '隔离浏览器中已保存的后道在途记录。' })
    const receipt = { id: 'POST-UI-RECEIPT', transferId: transfer.id, warehouseCode: 'DLN', status: '待收货', version: 1, lines: [] }
    await records.saveAccessoryWarehouseAction({ commandId: 'POST-UI-FIXTURE', intent: 'post isolated canonical fixture', result: transfer.id, change: { puts: [records.accessoryRecord('preparation', prep.id, prep), records.accessoryRecord('transfer', transfer.id, transfer), records.accessoryRecord('receipt', receipt.id, receipt)] } })
    await adapter.prepareAccessoryPostFinishing()
    return { id: transfer.id, productionOrderNo: prep.productionOrderNo, names: transfer.lines.map(line => line.materialName), lineIds: transfer.lines.map(line => line.id), quantities: transfer.lines.map(line => line.qty) }
  })
}
async function snapshot(page: Page) { return page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()) }
async function pcsSnapshot(page: Page) { return page.evaluate(async () => (await import('/src/data/pcs-record-db.ts')).readPcsRecords(['higood-fcs-post-finishing-records'])) }
async function mount(page: Page) {
  await page.evaluate(async () => {
    const ui = await import('/src/pages/process-factory/post-finishing/material-transfers.ts')
    document.body.innerHTML = await ui.renderPostFinishingMaterialTransfersPage()
    if (!(globalThis as any).__postBound) { for (const type of ['click', 'input', 'change']) document.body.addEventListener(type, event => { if (event.target instanceof HTMLElement) ui.handlePostFinishingMaterialTransfersEvent(event.target, event) }); (globalThis as any).__postBound = true }
  })
}

test('首次直接准备不写种子；原ID投影、四类排除、旧receive拒写，后道库存与齐套同源', { timeout: 120000 }, async () => run(async page => {
  await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing())
  assert.equal((await snapshot(page)).records.length, 0)
  const fixture = await canonicalFixture(page), before = await pcsSnapshot(page)
  assert.deepEqual(fixture.names.sort(), ['拉链', '纽扣'].sort())
  const read = await page.evaluate(async id => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const adapter = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
    const row = flow.getPostFinishingMaterialTransferOrder(id)!
    let blocked = ''
    try { const records = await import('/src/data/fcs/post-finishing-records.ts'); await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({ transferOrderNo: row.transferOrderNo, actor: { actorId: 'test', actorName: '旧接收', roleName: '仓管' } })) } catch (error) { blocked = String(error) }
    return { id: row.transferOrderId, count: flow.listPostFinishingMaterialTransferOrders().filter(item => item.transferOrderId === id).length, status: row.status, stocks: flow.listPostFinishingMaterialStocks().filter(item => item.transferOrderId === id), managed: adapter.isManagedAccessoryPostTransfer(row.transferOrderNo), blocked, readiness: flow.getPostFinishingMaterialReadiness(row.productionOrderNo) }
  }, fixture.id)
  assert.equal(read.id, fixture.id); assert.equal(read.count, 1); assert.equal(read.status, '待入库'); assert.equal(read.managed, true); assert.match(read.blocked, /原整单入库入口不可/); assert.equal(read.stocks.length, 0); assert.equal(read.readiness.status, '待入库')
  assert.deepEqual(await pcsSnapshot(page), before)
  evidence.coldProjection = { ...read, noSeeds: true, pscUnchanged: true }
}))

test('Web后道实收上架1024可操作，PPIC/差异/事务中止阻断，原命令重试后库存与下游回读一致', { timeout: 120000 }, async () => run(async page => {
  const fixture = await canonicalFixture(page), pcsBefore = await pcsSnapshot(page)
  await mount(page)
  await page.locator('[data-post-material-query] [name="keyword"]').fill(fixture.productionOrderNo)
  await page.locator('[data-post-finishing-material-transfers-action="query"]').click()
  await expect(page.locator('[data-post-material-workspace] tbody tr')).toHaveCount(1)
  await expect(page.locator('[data-standard-list-stats]').first()).toContainText('1')
  await page.locator('[data-post-finishing-material-transfers-action="detail"]').click()
  const dialog = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true })
  await dialog.locator('[data-post-material-role]').selectOption('PPIC')
  await expect(dialog.locator('[data-post-finishing-material-transfers-action="receive"]')).toBeDisabled()
  await dialog.locator('[data-post-material-role]').selectOption('仓管')
  await dialog.locator('[data-accessory-action="image"]').last().click()
  const image = page.getByRole('dialog', { name: '纽扣', exact: true })
  await expect(image).toBeVisible(); await expect.poll(() => image.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape'); await expect(image).toHaveCount(0)
  await dialog.locator('[data-post-material-qty]').nth(0).fill('9')
  await dialog.locator('[data-post-material-qty]').nth(1).fill('20')
  for (let index = 0; index < 2; index++) await dialog.locator('[data-post-material-location]').nth(index).selectOption({ label: 'PF-MAT-A01-01' })
  const before = await snapshot(page)
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-post-material-error]')).toContainText('整单')
  assert.deepEqual(await snapshot(page), before)
  await dialog.locator('[data-post-material-qty]').nth(0).fill('10')
  await page.evaluate(() => { (globalThis as any).__postPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) { if (this.name === 'records') throw new DOMException('post abort injection', 'QuotaExceededError'); return (globalThis as any).__postPut.apply(this, args) } })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog.locator('[data-post-material-error]')).toContainText('post abort injection')
  assert.equal(await dialog.locator('[data-post-material-qty]').nth(0).inputValue(), '10'); assert.deepEqual(await snapshot(page), before)
  await page.screenshot({ path: resolve(output, 'post-receive-failure-1024.png'), fullPage: true })
  await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__postPut })
  await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const after = await snapshot(page)
  const downstream = await page.evaluate(async no => { const flow = await import('/src/data/fcs/post-finishing-full-flow.ts'); return { stocks: flow.listPostFinishingMaterialStocks().filter(row => row.productionOrderNo === no), readiness: flow.getPostFinishingMaterialReadiness(no) } }, fixture.productionOrderNo)
  assert.equal(downstream.stocks.length, 2); assert.deepEqual(downstream.stocks.map(row => row.currentQty).sort((a, b) => a - b), [10, 20]); assert.equal(downstream.readiness.status, '已入库')
  assert.deepEqual(await pcsSnapshot(page), pcsBefore)
  await page.reload(); await mount(page)
  assert.deepEqual(await snapshot(page), after)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: resolve(output, 'post-received-list-1024.png'), fullPage: true })
  evidence.webReceipt = { passed: true, originalId: fixture.id, ppicReadOnly: true, differenceBlocked: true, realAbortInputRetained: true, retrySaved: true, pscUntouched: true, downstream, reloadMatches: true, layout1024: true }
}))

async function legacyFixture(page: Page, ambiguous = false) {
  await page.evaluate(async ambiguous => {
    const adapter = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), source = await import('/src/data/wls/accessory-warehouse-sources.ts'), db = await import('/src/data/pcs-record-db.ts')
    await adapter.prepareAccessoryPostFinishing()
    const prep = source.listAccessoryPreparations().find(row => row.productionOrderId === 'PO-AW-202610-F01')!, material = prep.lines.find(row => row.materialSku === 'AW-DEMO-ZIPPER')!
    const actor = { actorId: 'OLD-POST', actorName: '原后道仓管', roleName: '仓管' }
    const line = { transferLineId: 'OLD-POST-L1', materialName: material.materialName, materialCode: ambiguous ? 'UNKNOWN-SKU' : material.materialSku, materialSpuCode: '', specification: material.spec, unit: material.unit, requestedQty: 10, preparedQty: 10, imageUrl: 'pcs-file:POST-OWN-FILE' }
    const old = { transferOrderId: 'OLD-POST-1', transferOrderNo: 'OLD-HD-001', productionOrderId: prep.productionOrderId, productionOrderNo: prep.productionOrderNo, styleNo: '', styleName: prep.styleName, styleImageUrl: prep.styleImageUrl, sewingTaskNo: '', responsibility: { sewingTaskType: 'INDEPENDENT_SEWING', taskTypeLabel: '仅车缝', responsibilityMode: 'POST_FACTORY', responsibilityLabel: '后道工厂负责', source: 'PPIC任务分配', frozenAt: '2026-10-01T00:00:00Z', defaultProcessItems: [], processItemsEditable: false }, sourceWarehouseName: ambiguous ? '辅料仓' : 'HILON辅料仓', targetWarehouseName: '后道待加工仓', targetAreaName: '后道辅料暂存区', targetLocationCode: 'PF-MAT-A01-01', status: '已入库', lines: [line], statusHistory: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T01:00:00Z', inboundAt: '2026-10-01T01:00:00Z', inboundBy: actor }
    const oldStock = { stockId: 'OLD-POST-STOCK-1', transferOrderId: old.transferOrderId, transferOrderNo: old.transferOrderNo, productionOrderNo: old.productionOrderNo, material: line, currentQty: 7, inboundQty: 10, areaName: old.targetAreaName, locationCode: old.targetLocationCode, inboundAt: old.inboundAt, inboundBy: actor }
    const prefix = 'higood-fcs-post-finishing-records/flow/'
    await db.commitPcsRecords({ operationId: 'POST-LEGACY-FIXTURE', intent: 'isolated legacy source fixture', puts: [{ id: `${prefix}materialTransferOrders/OLD-POST-1`, collection: 'flow/materialTransferOrders', value: old, expectedVersion: 0 }, { id: `${prefix}materialStocks/OLD-POST-STOCK-1`, collection: 'flow/materialStocks', value: oldStock, expectedVersion: 0 }, { id: `${prefix}qcTasks/UNRELATED-QC`, collection: 'flow/qcTasks', value: { qcTaskId: 'UNRELATED-QC', productionOrderNo: 'UNRELATED', status: '待质检' }, expectedVersion: 0 }], deletes: [], files: [{ id: 'POST-OWN-FILE', blob: new Blob(['original scope attachment bytes'], { type: 'image/png' }) }] })
    await adapter.prepareAccessoryPostFinishing()
  }, ambiguous)
}

test('相交旧PCS辅料归档和精确转换保留原ID/实存/附件；中断可续，原源及其他QC字节不变', { timeout: 120000 }, async () => run(async page => {
  await legacyFixture(page)
  const originalPcs = await pcsSnapshot(page)
  assert.equal(await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).inspectLegacyAccessoryPostMigration().state), '待迁移')
  await page.evaluate(() => { (globalThis as any).__migrationPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value: any, ...args: any[]) { if (this.name === 'records' && value.value?.kind === 'post-legacy-batch' && value.value?.phase === 'COMPLETE') throw new DOMException('verify stage interruption', 'QuotaExceededError'); return (globalThis as any).__migrationPut.call(this, value, ...args) } })
  const interrupted = await page.evaluate(async () => { try { await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).migrateLegacyAccessoryPost({ commandId: 'MIGRATE-POST-1', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }); return '' } catch (error) { return String(error) } })
  assert.match(interrupted, /verify stage interruption/)
  const partial = await snapshot(page)
  assert.equal(partial.records.filter(row => row.collection === 'accessory-warehouse:migration' && (row.value as any).kind === 'post-legacy-archive').length, 2)
  assert.equal(await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).listManagedAccessoryPostTransfers().length), 0)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__migrationPut })
  const result = await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).migrateLegacyAccessoryPost({ commandId: 'MIGRATE-POST-RETRY', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }))
  assert.equal(result.state, '已完成'); assert.equal(result.retainedOriginal, true)
  const migrated = await page.evaluate(async () => { const flow = await import('/src/data/fcs/post-finishing-full-flow.ts'), repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts'); return { transfer: flow.getPostFinishingMaterialTransferOrder('OLD-POST-1'), stocks: flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderId === 'OLD-POST-1'), file: await (await repository.readCuttingRecordFile('AW-POST-LEGACY-FILE:POST-OWN-FILE'))!.text() } })
  assert.equal(migrated.transfer?.transferOrderId, 'OLD-POST-1'); assert.equal(migrated.stocks[0].currentQty, 7); assert.equal(migrated.stocks[0].inboundQty, 10); assert.equal(migrated.file, 'original scope attachment bytes')
  assert.deepEqual(await pcsSnapshot(page), originalPcs)
  const beforeRepeat = await snapshot(page)
  await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).migrateLegacyAccessoryPost({ commandId: 'MIGRATE-POST-NOOP', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }))
  assert.deepEqual(await snapshot(page), beforeRepeat)
  evidence.migration = { passed: true, copiedThenVerified: true, interruptedResume: true, originalIdRetained: true, currentQty: 7, historicalInboundQty: 10, originalAttachmentBytesPreserved: true, pscAndUnrelatedQcUntouched: true, repeatedNoop: true }
}))

test('旧SKU/来源不能确定时阻断且可导出含原附件备份，不能假定空数据或伪造后道库存', { timeout: 120000 }, async () => run(async page => {
  await legacyFixture(page, true)
  const before = await snapshot(page), old = await pcsSnapshot(page)
  const result = await page.evaluate(async () => {
    const adapter = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), inspection = adapter.inspectLegacyAccessoryPostMigration()
    let error = ''; try { await adapter.migrateLegacyAccessoryPost({ commandId: 'BLOCKED-MIGRATION', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }) } catch (value) { error = String(value) }
    const backup = JSON.parse(await (await adapter.exportLegacyAccessoryPostBackup()).text())
    return { inspection, error, fileCount: backup.files.length, fileText: new TextDecoder().decode(new Uint8Array(backup.files[0].bytes)), sourceCount: backup.sources.length }
  })
  assert.equal(result.inspection.state, '待核对'); assert.match(result.error, /SKU/); assert.equal(result.fileCount, 1); assert.equal(result.fileText, 'original scope attachment bytes'); assert.equal(result.sourceCount, 2)
  assert.deepEqual(await snapshot(page), before); assert.deepEqual(await pcsSnapshot(page), old)
  evidence.blockedMigration = { passed: true, originalSourcesRetained: true, backupContainsAttachmentBytes: true, noCanonicalInventoryInvented: true }
}))

test('两张旧单共用SKU库位仅生成一笔聚合实存；孤立库存必须阻断而非静默归档', { timeout: 120000 }, async () => {
  await run(async page => {
    await legacyFixture(page)
    await page.evaluate(async () => {
      const db = await import('/src/data/pcs-record-db.ts'), prefix = 'higood-fcs-post-finishing-records/flow/'
      const rows = await db.readPcsRecords([`${prefix}materialTransferOrders`, `${prefix}materialStocks`])
      const old = structuredClone(rows.records.find(row => row.collection === 'flow/materialTransferOrders')!.value) as any
      const stock = structuredClone(rows.records.find(row => row.collection === 'flow/materialStocks')!.value) as any
      old.transferOrderId = 'OLD-POST-2'; old.transferOrderNo = 'OLD-HD-002'; old.lines[0].transferLineId = 'OLD-POST-L2'; old.lines[0].preparedQty = 6; old.lines[0].requestedQty = 6
      stock.stockId = 'OLD-POST-STOCK-2'; stock.transferOrderId = old.transferOrderId; stock.transferOrderNo = old.transferOrderNo; stock.material = old.lines[0]; stock.currentQty = 4; stock.inboundQty = 6
      await db.commitPcsRecords({ operationId: 'POST-SECOND-LEGACY', intent: 'second isolated physical stock share', puts: [{ id: `${prefix}materialTransferOrders/OLD-POST-2`, collection: 'flow/materialTransferOrders', value: old, expectedVersion: 0 }, { id: `${prefix}materialStocks/OLD-POST-STOCK-2`, collection: 'flow/materialStocks', value: stock, expectedVersion: 0 }], deletes: [] })
      await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing()
    })
    const before = await pcsSnapshot(page)
    await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).migrateLegacyAccessoryPost({ commandId: 'MIGRATE-TWO-POSTS', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }))
    const stocks = (await snapshot(page)).records.filter(row => row.collection === 'accessory-warehouse:stock')
    assert.equal(stocks.length, 1); assert.equal((stocks[0].value as any).onHandQty, 11); assert.equal((stocks[0].value as any).sourceRefs.length, 2)
    const visible = await page.evaluate(async () => (await import('/src/data/fcs/post-finishing-full-flow.ts')).listPostFinishingMaterialStocks().filter(row => row.stockId.startsWith('ACCESSORY-STOCK:')))
    assert.equal(visible.length, 1); assert.equal(visible[0].currentQty, 11); assert.equal(visible[0].inboundQty, 16)
    assert.deepEqual(await pcsSnapshot(page), before)
  })
  await run(async page => {
    await legacyFixture(page)
    await page.evaluate(async () => {
      const db = await import('/src/data/pcs-record-db.ts'), prefix = 'higood-fcs-post-finishing-records/flow/'
      const rows = await db.readPcsRecords([`${prefix}materialStocks`]), stock = structuredClone(rows.records[0].value) as any
      stock.stockId = 'ORPHAN-STOCK'; stock.transferOrderId = 'MISSING-TRANSFER'
      await db.commitPcsRecords({ operationId: 'POST-ORPHAN-LEGACY', intent: 'isolated orphan stock', puts: [{ id: `${prefix}materialStocks/ORPHAN-STOCK`, collection: 'flow/materialStocks', value: stock, expectedVersion: 0 }], deletes: [] })
      await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing()
    })
    const before = await snapshot(page)
    const state = await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).inspectLegacyAccessoryPostMigration())
    assert.equal(state.state, '待核对'); assert.ok(state.issues.some(issue => issue.includes('缺少一致的原调拨明细')))
    assert.deepEqual(await snapshot(page), before)
  })
  evidence.adversarialMigration = { passed: true, sharedPhysicalStockRows: 1, currentQty: 11, historicalInboundQty: 16, distinctTransferRefs: 2, orphanRejected: true }
})

test('PDA390真实main：ROLE_VIEWER只读，差量与事务abort不入库，原按钮重试和冷开库存一致', { timeout: 120000 }, async () => run(async page => {
  const fixture = await canonicalFixture(page), original = await snapshot(page)
  const userId = await page.evaluate(async () => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts'), user = pda.listFactoryPdaUsers('ID-F002').find(row => row.roleId === 'ROLE_ADMIN')!
    pda.setPdaSession(pda.createPdaSessionFromUser(user)); pda.setFactoryPdaUserRole(user.userId, 'ROLE_VIEWER'); return user.userId
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/fcs/pda/handover?tab=pickup&materialOrderNo=${fixture.id}`)
  await page.locator('[data-managed-accessory-post-root]').waitFor()
  await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-post-qty]').first()).toBeDisabled()
  assert.deepEqual(await snapshot(page), original)
  await page.evaluate(async id => (await import('/src/data/fcs/store-domain-pda.ts')).setFactoryPdaUserRole(id, 'ROLE_ADMIN'), userId)
  await page.reload(); await page.locator('[data-pda-post-qty]').first().waitFor()
  await page.locator('[data-pda-image-preview-url]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.getByRole('dialog').locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
  for (let index = 0; index < 2; index++) { await page.locator('[data-pda-post-qty]').nth(index).fill(String(index === 0 ? 9 : 20)); await page.locator('[data-pda-post-location]').nth(index).selectOption({ label: 'PF-MAT-A01-01' }) }
  page.once('dialog', confirmation => confirmation.accept())
  await page.locator('[data-pda-handover-action="confirm-material-inbound"]').click()
  await expect(page.locator('[data-pda-post-error]')).toContainText('整单')
  assert.deepEqual(await snapshot(page), original)
  await page.locator('[data-pda-post-qty]').first().fill('10')
  await page.evaluate(() => {
    ;(globalThis as any).__postPdaPut = IDBObjectStore.prototype.put
    ;(globalThis as any).__postPdaUuid = crypto.randomUUID.bind(crypto); (globalThis as any).__postPdaUuidCount = 0
    crypto.randomUUID = () => { (globalThis as any).__postPdaUuidCount++; return (globalThis as any).__postPdaUuid() }
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) { if (this.name === 'records') throw new DOMException('PDA post abort', 'QuotaExceededError'); return (globalThis as any).__postPdaPut.apply(this, args) }
  })
  page.once('dialog', confirmation => confirmation.accept())
  await page.locator('[data-pda-handover-action="confirm-material-inbound"]').click()
  await expect(page.locator('[data-pda-post-error]')).toContainText('PDA post abort')
  assert.equal(await page.locator('[data-pda-post-qty]').first().inputValue(), '10')
  assert.equal(await page.locator('[data-pda-post-qty]').nth(1).inputValue(), '20')
  assert.ok(await page.locator('[data-pda-post-location]').first().inputValue())
  assert.deepEqual(await snapshot(page), original)
  await page.screenshot({ path: resolve(output, 'pda-abort-retained-390.png'), fullPage: true })
  const count = await page.evaluate(() => (globalThis as any).__postPdaUuidCount)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__postPdaPut })
  await page.locator('[data-pda-handover-action="confirm-material-inbound"]').click()
  await expect(page.locator('[data-managed-accessory-post-root]')).toContainText('辅料已收货上架')
  assert.equal(await page.evaluate(() => (globalThis as any).__postPdaUuidCount), count)
  const saved = await snapshot(page)
  await page.reload(); await expect(page.locator('[data-managed-accessory-post-root]')).toContainText('辅料已收货上架')
  assert.deepEqual(await snapshot(page), saved)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: resolve(output, 'pda-received-390.png'), fullPage: true })
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(`${base}/fcs/craft/post-finishing/wait-process-warehouse?tab=materials`)
  await expect(page.locator('main')).toContainText('PO-AW-202610-F01')
  await expect(page.locator('main')).toContainText('10 条'); await expect(page.locator('main')).toContainText('20 粒')
  assert.deepEqual(await snapshot(page), saved)
  evidence.pdaMain = { passed: true, width: 390, roleViewerReadOnly: true, differenceBlocked: true, actualTransactionAbortInputRetained: true, sameCommandRetry: true, reloadedNoDuplicate: true, imageLoadEsc: true, stockColdDirect1024: true, unchangedSnapshotOnReads: true }
}))

test('PDA390受管后道单直达：别厂账号只读阻断并可返回本厂原交接入口', { timeout: 90000 }, async () => run(async page => {
  const fixture = await canonicalFixture(page), original = await snapshot(page)
  const account = await page.evaluate(async () => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts'), user = pda.listFactoryPdaUsers('ID-F004').find(row => row.roleId === 'ROLE_ADMIN')!
    pda.setPdaSession(pda.createPdaSessionFromUser(user)); return { userId: user.userId, factoryId: user.factoryId }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/fcs/pda/handover?tab=pickup&materialOrderNo=${fixture.id}`)
  await expect(page.locator('[data-managed-accessory-post-access-blocked]')).toContainText('当前账号不属于后道工厂')
  await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-post-qty]')).toHaveCount(0)
  const link = page.getByRole('link', { name: '返回本厂交接', exact: true })
  await expect(link).toHaveAttribute('href', '/fcs/pda/handover?tab=pickup')
  assert.deepEqual(await snapshot(page), original)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: resolve(output, 'wrong-factory-managed-post-390.png'), fullPage: true })
  await link.click(); await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup$/)
  await expect(page.locator('[data-managed-accessory-post-access-blocked]')).toHaveCount(0)
  await expect(page.locator('[data-pda-handover-action="confirm-material-inbound"]')).toHaveCount(0)
  assert.deepEqual(await snapshot(page), original)
  evidence.wrongFactory = { passed: true, account, noReceiveFields: true, noReceiveAction: true, originalPickupLinkWorks: true, managedSnapshotUnchanged: true }
}))


test('旧后道整包转换不能绕过受管辅料退出边界：归档前后均保留原源、不写回退休事实', { timeout: 120000 }, async () => run(async page => {
  await legacyFixture(page)
  const raw = await page.evaluate(async () => {
    const db = await import('/src/data/pcs-record-db.ts'), read = await db.readPcsRecords(['higood-fcs-post-finishing-records/flow/materialTransferOrders', 'higood-fcs-post-finishing-records/flow/materialStocks'])
    const value = { materialTransferOrders: read.records.filter(row => row.collection === 'flow/materialTransferOrders').map(row => row.value), materialStocks: read.records.filter(row => row.collection === 'flow/materialStocks').map(row => row.value) }
    const raw = JSON.stringify(value); localStorage.setItem('higood-fcs-post-finishing-full-flow-v1', raw)
    await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing(); return raw
  })
  const before = await pcsSnapshot(page), accessoryBefore = await snapshot(page)
  async function attempt() { return page.evaluate(async () => { try { await (await import('/src/data/fcs/post-finishing-records.ts')).migratePostFinishingLegacyData(); return '' } catch (error) { return String(error) } }) }
  assert.match(await attempt(), /本范围后道辅料.*整包转换/)
  assert.deepEqual(await pcsSnapshot(page), before); assert.deepEqual(await snapshot(page), accessoryBefore)
  assert.equal(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-full-flow-v1')), raw)
  await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).migrateLegacyAccessoryPost({ commandId: 'MIGRATE-LS-AND-PCS', at: '2026-10-19T09:00:00Z', actor: '演示管理员' }))
  const copied = await snapshot(page)
  assert.match(await attempt(), /本范围后道辅料.*整包转换/)
  assert.deepEqual(await pcsSnapshot(page), before); assert.deepEqual(await snapshot(page), copied)
  assert.equal(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-full-flow-v1')), raw)
  evidence.genericMigrationGuard = { passed: true, beforeAndAfterArchiveRejected: true, originalLocalStorageRetained: true, pscAuxAndOtherQcUnchanged: true, noRetiredFactRewritten: true }
}))
