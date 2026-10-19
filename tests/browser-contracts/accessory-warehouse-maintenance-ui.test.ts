import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium, expect, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.ACCESSORY_MAINTENANCE_UI_URL || 'http://127.0.0.1:43241'
const route = '/wls/accessory-warehouses/gtp/preparation'
const evidenceDir = resolve('output/verification/accessory-warehouse-maintenance-ui')

async function initializeLegacyFixture(page: Page) {
  return page.evaluate(async () => {
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const row = prep.listMaterialPrepOrderProjections(null).find(row => row.order.prepOrderId === 'prep-order-po-202603-0004')!
    const accessory = row.lines.find(line => line.materialType === '辅料')!, fabric = row.lines.find(line => line.materialType === '面料')!
    const common = { prepOrderId: row.order.prepOrderId, batchNo: 'UI旧配料001', warehouseArea: '原库区', locationCode: 'ACC-B-001',
      operatorName: '原仓管', preparedAt: '2026-10-18 09:00:00', rollCount: 0, confirmedAt: '2026-10-18 10:00:00', confirmedBy: '原仓管',
      rejectedAt: '', rejectedBy: '', rejectReason: '', sourceStockEventId: '', remark: 'UI验收：保留原批次' }
    const old = { independentMeta: { keep: '其他工艺元数据' }, prepRecords: [
      { ...common, prepRecordId: 'UI-MIXED', prepLineId: accessory.prepLineId, recordStatus: 'CONFIRMED', preparedQty: null, items: [
        { prepRecordItemId: 'UI-ACC-ITEM', prepLineId: accessory.prepLineId, preparedQty: 7, rollCount: 0, sourceUnit: accessory.unit },
        { prepRecordItemId: 'UI-FAB-ITEM', prepLineId: fabric.prepLineId, preparedQty: 11, rollCount: 1, sourceUnit: fabric.unit },
      ] },
      { ...common, prepRecordId: 'UI-DRAFT', prepLineId: accessory.prepLineId, recordStatus: 'DRAFT', preparedQty: 2, remark: 'UI验收：待拣货数量保留' },
    ], pickupRecords: [], pickupSessions: [], pickupNodeSnapshots: [], pickupReturnRecords: [], rejectRecords: [],
      stagingRecords: [{ stagingRecordId: 'UI-STAGING', prepOrderId: row.order.prepOrderId, prepRecordId: 'UI-MIXED', status: '已确认' }], closedOrders: [] }
    const raw = JSON.stringify(old)
    localStorage.setItem(prep.PRODUCTION_MATERIAL_PREP_STORAGE_KEY, raw)
    return { preparationId: row.order.prepOrderId, orderNo: row.order.productionOrderNo, lineId: accessory.prepLineId,
      fabricLineId: fabric.prepLineId, expectedQty: accessory.confirmedPrepQty + 7, unit: accessory.unit, raw }
  })
}
async function openData(page: Page) {
  await page.locator('[data-accessory-action="data"]').click()
  const dialog = page.getByRole('dialog', { name: '辅料仓本机资料', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: /原配料资料：/ })).toBeVisible()
  return dialog
}
async function closeData(page: Page) { await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }
async function showPreparationQuantity(page: Page, fixture: Awaited<ReturnType<typeof initializeLegacyFixture>>) {
  await page.locator('[data-accessory-field="keyword"]').fill(fixture.orderNo)
  await page.locator('[data-accessory-action="query"]').click()
  await page.locator(`[data-accessory-action="prepare"][data-id="${fixture.preparationId}"]`).click()
  // 名称由页面标题确定，物料行用实际输入身份核对。
  const input = page.locator(`[data-aw-qty="${fixture.lineId}"]`)
  await expect(input).toBeVisible()
  const row = input.locator('xpath=ancestor::tr')
  const cells = row.locator('td')
  const quantityText = await cells.nth(1).innerText()
  assert.ok(quantityText.includes(`${fixture.expectedQty} ${fixture.unit}`), quantityText)
  return { quantityText, modalText: await page.getByRole('dialog').innerText() }
}

test('GTP真实UI：本机资料迁移、下载备份、隔离空环境选文件恢复与失败保留', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('dialog', dialog => dialog.accept())
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  let restoredContext: Awaited<ReturnType<typeof browser.newContext>> | undefined
  try {
    await page.goto(base + route)
    await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    const fixture = await initializeLegacyFixture(page)
    await page.reload(); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    let dialog = await openData(page)
    await expect(dialog).toContainText('原配料资料：待迁移')
    await dialog.locator('[data-aw-actor]').fill('UI验收仓管')
    await dialog.getByRole('button', { name: '迁移并切换原配料资料', exact: true }).click()
    await expect(dialog).toContainText('原配料资料：已完成')
    const afterMigration = await page.evaluate(async () => {
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      return { raw: JSON.parse(localStorage.getItem('productionMaterialPrepWorkflow')!), stored: (await records.readAccessoryRecordSnapshot()).records }
    })
    assert.equal(afterMigration.raw.prepRecords.length, 1)
    assert.equal(afterMigration.raw.prepRecords[0].items.length, 1)
    assert.equal(afterMigration.raw.prepRecords[0].items[0].prepLineId, fixture.fabricLineId)
    assert.deepEqual(afterMigration.raw.independentMeta, { keep: '其他工艺元数据' })
    assert.equal(afterMigration.raw.stagingRecords[0].stagingRecordId, 'UI-STAGING')
    await mkdir(evidenceDir, { recursive: true })
    await page.screenshot({ path: resolve(evidenceDir, 'migration-complete-dialog.png'), fullPage: true })
    const downloadEvent = page.waitForEvent('download')
    await dialog.getByRole('button', { name: '导出辅料仓备份', exact: true }).click()
    const download = await downloadEvent, path = await download.path()
    assert.ok(path)
    const backup = await readFile(path!)
    assert.match(download.suggestedFilename(), /^辅料仓备份-.*\.json$/)
    const parsed = JSON.parse(backup.toString('utf8'))
    assert.equal(parsed.format, 'higood-accessory-warehouse-backup')
    assert.ok(parsed.records.some((record: any) => record.collection === 'accessory-warehouse:preparation'))
    await closeData(page)
    const sourceQuantity = await showPreparationQuantity(page, fixture)
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await page.locator(`[data-accessory-action="history"][data-id="${fixture.preparationId}"]`).click()
    await expect(page.getByRole('dialog')).toContainText('UI旧配料001')
    await expect(page.getByRole('dialog')).toContainText('待拣货')
    const history = await page.getByRole('dialog').innerText()
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    await page.reload(); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    const afterReload = await showPreparationQuantity(page, fixture)
    assert.equal(afterReload.quantityText, sourceQuantity.quantityText)
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    // 非空恢复与坏文件均从真实文件输入、确认按钮执行。
    dialog = await openData(page)
    await dialog.locator('[data-aw-actor]').fill('失败输入保留')
    await dialog.locator('[data-aw-backup]').setInputFiles({ name: '原备份.json', mimeType: 'application/json', buffer: backup })
    await expect(dialog).toContainText('已选择：原备份.json')
    await dialog.getByRole('button', { name: '恢复本范围资料', exact: true }).click()
    await expect(dialog.locator('[data-aw-modal-error]')).toContainText('非空')
    await expect(dialog).toContainText('已选择：原备份.json')
    await expect(dialog.locator('[data-aw-actor]')).toHaveValue('失败输入保留')
    const beforeBad = await page.evaluate(async () => JSON.stringify(await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()))
    await dialog.locator('[data-aw-backup]').setInputFiles({ name: '损坏备份.json', mimeType: 'application/json', buffer: Buffer.from('{bad') })
    await dialog.getByRole('button', { name: '恢复本范围资料', exact: true }).click()
    await expect(dialog.locator('[data-aw-modal-error]')).toContainText('无法解析')
    await expect(dialog).toContainText('已选择：损坏备份.json')
    await expect(dialog.locator('[data-aw-actor]')).toHaveValue('失败输入保留')
    const afterBad = await page.evaluate(async () => JSON.stringify(await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()))
    assert.equal(afterBad, beforeBad)
    await page.screenshot({ path: resolve(evidenceDir, 'bad-file-input-retained.png'), fullPage: true })
    // 新的浏览器上下文，整个本地数据库为空；只能通过UI恢复按钮落盘。
    restoredContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const restoredPage = await restoredContext.newPage(), restoredErrors: string[] = []
    restoredPage.on('pageerror', error => restoredErrors.push(String(error)))
    await restoredPage.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await restoredPage.goto(base + route); await expect(restoredPage.locator('[data-accessory-preparation-root]')).toBeVisible()
    const restoreDialog = await openData(restoredPage)
    await restoreDialog.locator('[data-aw-backup]').setInputFiles({ name: '原备份.json', mimeType: 'application/json', buffer: backup })
    await restoreDialog.getByRole('button', { name: '恢复本范围资料', exact: true }).click()
    await expect(restoreDialog.locator('[data-aw-modal-error]')).toHaveText('')
    await expect(restoreDialog).toContainText('原配料资料：已完成')
    await closeData(restoredPage)
    const restoredQuantity = await showPreparationQuantity(restoredPage, fixture)
    assert.equal(restoredQuantity.quantityText, sourceQuantity.quantityText)
    await restoredPage.screenshot({ path: resolve(evidenceDir, 'restored-preparation-quantity.png'), fullPage: true })
    const restoredLegacy = await restoredPage.evaluate(() => localStorage.getItem('productionMaterialPrepWorkflow'))
    assert.equal(restoredLegacy, null)
    assert.deepEqual(errors, []); assert.deepEqual(restoredErrors, [])
    await writeFile(resolve(evidenceDir, 'maintenance-ui.json'), JSON.stringify({ base, route, capturedAt: new Date().toISOString(),
      fixture: { ...fixture, raw: undefined }, migrated: { preparationRecords: afterMigration.stored.filter(record => record.collection === 'accessory-warehouse:preparation').length,
        commonItemsRetained: true, commonMetaRetained: true }, sourceQuantity, afterReload, restoredQuantity, restoredLegacy,
      download: { filename: download.suggestedFilename(), size: backup.byteLength }, history, failureKeptRecordsAndInput: beforeBad === afterBad,
      pageErrors: errors, restoredErrors }, null, 2))
  } finally { await restoredContext?.close(); await context.close(); await browser.close() }
})

test('GTP真实UI：原配料源损坏时错误页仍能打开本机资料并保留原源', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base + route); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    await page.evaluate(() => localStorage.setItem('productionMaterialPrepWorkflow', '{broken-legacy'))
    await page.reload()
    await expect(page.locator('[data-accessory-read-error]')).toBeVisible()
    await expect(page.locator('[data-accessory-read-error]')).toContainText('原配料资料格式损坏')
    const dialog = await openData(page)
    await expect(dialog).toContainText('原配料资料：已阻塞')
    await expect(dialog.locator('[data-aw-backup]')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '导出辅料仓备份', exact: true })).toBeVisible()
    assert.equal(await page.evaluate(() => localStorage.getItem('productionMaterialPrepWorkflow')), '{broken-legacy')
    assert.deepEqual(errors, [])
    await mkdir(evidenceDir, { recursive: true })
    await page.screenshot({ path: resolve(evidenceDir, 'read-error-maintenance-entry.png'), fullPage: true })
    await writeFile(resolve(evidenceDir, 'read-error-entry.json'), JSON.stringify({ base, route, capturedAt: new Date().toISOString(),
      modal: await dialog.innerText(), originalSourceRetained: true, pageErrors: errors }, null, 2))
  } finally { await context.close(); await browser.close() }
})

test('GTP真实UI：迁移完成后旧标签再次写入辅料必须识别冲突并保留可导出的冲突事实', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true }), page = await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(String(error))); page.on('dialog', dialog => dialog.accept())
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base + route); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    const fixture = await initializeLegacyFixture(page)
    await page.reload(); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    let dialog = await openData(page)
    await dialog.getByRole('button', { name: '迁移并切换原配料资料', exact: true }).click()
    await expect(dialog).toContainText('原配料资料：已完成')
    await closeData(page)
    const beforeLate = await page.evaluate(async () => JSON.stringify((await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()).records))
    const lateRaw = await page.evaluate(({ preparationId, lineId }) => {
      const original = JSON.parse(localStorage.getItem('productionMaterialPrepWorkflow')!)
      original.prepRecords.push({ prepRecordId: 'OLD-TAB-LATE', prepOrderId: preparationId, prepLineId: lineId,
        recordStatus: 'CONFIRMED', preparedQty: 3, rollCount: 0, preparedAt: '2026-10-19 11:00:00', operatorName: '旧标签仓管',
        confirmedAt: '2026-10-19 11:01:00', confirmedBy: '旧标签仓管', remark: '迁移后新增，不能静默忽略', warehouseArea: '原库区', locationCode: 'ACC-B-001' })
      const raw = JSON.stringify(original); localStorage.setItem('productionMaterialPrepWorkflow', raw); return raw
    }, fixture)
    await page.reload(); await expect(page.locator('[data-accessory-preparation-root]')).toBeVisible()
    dialog = await openData(page)
    const status = await dialog.getByRole('heading', { name: /原配料资料：/ }).innerText(), modal = await dialog.innerText()
    const downloadEvent = page.waitForEvent('download', { timeout: 7000 }).catch(() => null)
    await dialog.getByRole('button', { name: '导出辅料仓备份', exact: true }).click()
    const download = await downloadEvent
    const path = await download?.path(), exportedText = path ? await readFile(path, 'utf8') : ''
    const actual = await page.evaluate(async () => {
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      return { canonical: JSON.stringify((await records.readAccessoryRecordSnapshot()).records), raw: localStorage.getItem('productionMaterialPrepWorkflow') }
    })
    const evidence = { base, route, capturedAt: new Date().toISOString(), status, modal,
      conflictSourceRetained: actual.raw === lateRaw, canonicalUnchanged: actual.canonical === beforeLate,
      downloadExists: Boolean(download), exportedConflictIncluded: exportedText.includes('OLD-TAB-LATE'), pageErrors: errors }
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(resolve(evidenceDir, 'late-legacy-conflict.json'), JSON.stringify(evidence, null, 2))
    await page.screenshot({ path: resolve(evidenceDir, 'late-legacy-conflict.png'), fullPage: true })
    assert.equal(evidence.conflictSourceRetained, true)
    assert.equal(evidence.canonicalUnchanged, true)
    assert.match(status, /已阻塞|冲突/)
    assert.equal(evidence.exportedConflictIncluded, true, '备份应包含冲突旧记录以供核对，不得静默漏出')
    await closeData(page)
    await page.locator('[data-accessory-field="keyword"]').fill(fixture.orderNo)
    await page.locator('[data-accessory-action="query"]').click()
    await page.locator(`[data-accessory-action="remark"][data-id="${fixture.preparationId}"]`).click()
    await page.locator('[data-aw-remark]').fill('冲突期间的新输入应保留')
    await page.locator('[data-accessory-action="save-remark"]').click()
    await expect(page.locator('[data-aw-modal-error]')).toContainText(/冲突|旧资料|阻塞/)
    await expect(page.locator('[data-aw-remark]')).toHaveValue('冲突期间的新输入应保留')
    const blockedSave = await page.locator('[data-aw-modal-error]').innerText()
    const afterBlockedSave = await page.evaluate(async () => JSON.stringify((await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()).records))
    assert.equal(afterBlockedSave, beforeLate)
    await page.screenshot({ path: resolve(evidenceDir, 'late-legacy-new-action-blocked.png'), fullPage: true })
    const restoreContext = await browser.newContext({ viewport: { width: 1366, height: 768 } }), restorePage = await restoreContext.newPage()
    await restorePage.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await restorePage.goto(base + route); await expect(restorePage.locator('[data-accessory-preparation-root]')).toBeVisible()
    const restoreDialog = await openData(restorePage)
    const beforeConflictRestore = await restorePage.evaluate(async () => JSON.stringify(await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()))
    await restoreDialog.locator('[data-aw-backup]').setInputFiles({ name: '冲突备份.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
    await restoreDialog.getByRole('button', { name: '恢复本范围资料', exact: true }).click()
    await expect(restoreDialog.locator('[data-aw-modal-error]')).toContainText('未解决的旧页面写入冲突')
    await expect(restoreDialog).toContainText('已选择：冲突备份.json')
    const conflictRestoreError = await restoreDialog.locator('[data-aw-modal-error]').innerText()
    const afterConflictRestore = await restorePage.evaluate(async () => JSON.stringify(await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()))
    assert.equal(afterConflictRestore, beforeConflictRestore)
    await restorePage.screenshot({ path: resolve(evidenceDir, 'unresolved-conflict-restore-refused.png'), fullPage: true })
    await restoreContext.close()
    await writeFile(resolve(evidenceDir, 'late-legacy-conflict.json'), JSON.stringify({ ...evidence,
      blockedSave, blockedSaveInputRetained: true, canonicalAfterBlockedSaveUnchanged: afterBlockedSave === beforeLate,
      conflictRestoreError, emptyRestoreTargetUnchanged: afterConflictRestore === beforeConflictRestore }, null, 2))
    assert.deepEqual(errors, [])
  } finally { await context.close(); await browser.close() }
})
