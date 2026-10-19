import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { seedAccessorySewingFixture } from './helpers/accessory-sewing-fixture.ts'

let server: ViteDevServer, browser: Browser, base = ''
const output = resolve('output/verification/accessory-full-backup-ui')
const gtpPath = '/wls/accessory-warehouses/gtp/preparation'
before(async () => {
  await mkdir(output, { recursive: true })
  server = await createServer({ root: process.cwd(), server: { port: 0, watch: { ignored: ['**/*'] } } })
  await server.listen(); base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })
async function initialize(page: Page) {
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.goto(base + gtpPath); await page.locator('[data-accessory-preparation-root]').waitFor()
}
async function createPickups(page: Page) {
  await page.goto(base + '/wls/accessory-warehouses/hilon/pickups')
  await page.locator('[data-accessory-pickup-action="create"]').click()
  await expect(page.getByRole('status')).toContainText('已按有效车缝任务建立')
}
async function printA(page: Page) {
  await page.goto(base + '/fcs/sewing-outsourcing/tasks'); await page.locator('[data-ppic-task-page]').waitFor()
  await page.locator('[data-ppic-task-field="keyword"]').fill('AW-SEW-A')
  await page.locator('[data-ppic-task-action="query"]').click()
  const row = page.locator('[data-ppic-task-page] tbody tr').filter({ hasText: 'AW-SEW-A' })
  await expect(row).toHaveCount(1); await row.locator('[data-ppic-task-action="print-pickup"]').click()
  await expect(page).toHaveURL(/print/); await page.locator('.print-preview-root').waitFor()
  return page.evaluate(async () => (await import('/src/data/fcs/sewing-pickup-slips.ts')).getCurrentSewingPickupSlip('AW-TEST-ASG-0', 'ACCESSORY')!)
}
async function database(page: Page) {
  return page.evaluate(async () => {
    const data = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
    return { ...data, files: await Promise.all(data.files.map(async file => ({ id: file.id, type: file.blob.type, bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())) }))) }
  })
}
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
async function openData(page: Page) {
  await page.goto(base + gtpPath); await page.locator('[data-accessory-preparation-root]').waitFor()
  await page.locator('[data-accessory-action="data"]').click()
  const dialog = page.getByRole('dialog', { name: '辅料仓本机资料', exact: true })
  await expect(dialog).toBeVisible(); return dialog
}

test('AC48 完整办理事实由真实UI下载，再在空context选文件恢复全部库存、凭证版本、实交、后道收货与命令', { timeout: 180000 }, async () => {
  const sourceContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const restoredContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const source = await sourceContext.newPage(), restored = await restoredContext.newPage(), errors: string[] = []
  source.on('pageerror', error => errors.push(`source: ${error.message}`)); restored.on('pageerror', error => errors.push(`restored: ${error.message}`))
  try {
    await initialize(source); const fixture = await seedAccessorySewingFixture(source); assert.ok(!('error' in fixture))
    await createPickups(source)
    const first = await printA(source)
    const pickup = await source.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-sewing.ts')).listAccessorySewingPickups().find(row => row.assignmentId === 'AW-TEST-ASG-0')!)
    await source.goto(base + `/wls/accessory-warehouses/hilon/pickups?pickupId=${encodeURIComponent(pickup.id)}&versionId=${encodeURIComponent(first.versionId)}`)
    await source.getByRole('dialog', { name: '登记车缝领料实交' }).waitFor()
    await source.getByLabel('价格吊牌本次实交', { exact: true }).fill('7')
    await source.getByRole('button', { name: '确认本次实交', exact: true }).click()
    await expect(source.getByRole('status')).toContainText('本次车缝领料已保存')
    const second = await printA(source); assert.equal(second.versionNo, 2)
    const post = await source.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).listAccessoryRecords<any>('transfer').find(row => row.kind === 'SITE_TO_POST' && row.responsibilityKey.includes('AW-TEST-ASG-0'))!)
    assert.ok(post)
    await source.goto(base + '/wls/accessory-warehouses/hilon/transfers')
    await source.locator(`[data-accessory-transfer-action="dispatch"][data-id="${post.id}"]`).click()
    await source.getByRole('dialog', { name: '整单确认出库', exact: true }).getByRole('button', { name: '整单确认出库', exact: true }).click()
    await expect(source.getByRole('dialog')).toHaveCount(0)
    await source.goto(base + '/fcs/craft/post-finishing/material-transfers')
    await source.locator('[data-post-material-query] [name="keyword"]').fill(fixture.productionOrderId!)
    await source.locator('[data-post-finishing-material-transfers-action="query"]').click()
    await source.locator(`[data-post-finishing-material-transfers-action="detail"][data-id="${post.id}"]`).click()
    const receive = source.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true })
    for (let index = 0; index < post.lines.length; index++) {
      await receive.locator('[data-post-material-qty]').nth(index).fill(String(post.lines[index].qty))
      await receive.locator('[data-post-material-location]').nth(index).selectOption({ label: 'PF-MAT-A01-01' })
    }
    await receive.getByRole('button', { name: '确认收货并上架', exact: true }).click(); await expect(receive).toHaveCount(0)
    const before = await database(source)
    const rowKinds = before.records.filter(row => row.collection.startsWith('accessory-warehouse:')).reduce<Record<string, number>>((result, row) => { result[row.collection] = (result[row.collection] || 0) + 1; return result }, {})
    for (const kind of ['pickup', 'sewing-slip', 'sewing-context', 'sewing-handover', 'sewing-result', 'transfer', 'receipt', 'stock']) assert.ok(rowKinds[`accessory-warehouse:${kind}`], kind)
    const dialog = await openData(source), downloadEvent = source.waitForEvent('download')
    await dialog.getByRole('button', { name: '导出辅料仓备份', exact: true }).click()
    const download = await downloadEvent, backupBytes = await readFile((await download.path())!), backup = JSON.parse(backupBytes.toString('utf8'))
    assert.equal(backup.format, 'higood-accessory-warehouse-backup'); assert.equal(backup.conflicts.length, 0); assert.equal(backup.sewingConflicts.length, 0)
    assert.equal(backup.records.length, before.records.filter(row => row.collection.startsWith('accessory-warehouse:')).length)
    assert.equal(backup.records.filter((row: any) => row.collection === 'accessory-warehouse:sewing-slip').length, 2)
    assert.equal(backup.records.find((row: any) => row.value.id === post.id).value.status, '已收货')
    await initialize(restored); const empty = await database(restored)
    assert.equal(empty.records.length, 0); assert.equal(empty.commands.length, 0); assert.equal(empty.files.length, 0)
    const restore = await openData(restored)
    await restore.locator('[data-aw-backup]').setInputFiles({ name: '完整辅料仓备份.json', mimeType: 'application/json', buffer: backupBytes })
    await restore.getByRole('button', { name: '恢复本范围资料', exact: true }).click()
    await expect(restore.locator('[data-aw-modal-error]')).toHaveText('')
    await expect.poll(async () => (await database(restored)).records.length).toBe(backup.records.length + backup.dependencies.length)
    await expect(restore.getByRole('button', { name: '恢复本范围资料', exact: true })).toHaveCount(0)
    await expect(restore.locator('[data-aw-modal-error]')).toHaveText('')
    const after = await database(restored)
    assert.deepEqual(sorted(after.records), sorted([...backup.records, ...backup.dependencies]))
    assert.deepEqual(sorted(after.commands), sorted(backup.commands)); assert.deepEqual(sorted(after.files), sorted(backup.files))
    assert.ok(backup.commands.length > 5); assert.ok(backup.dependencies.length > 0)
    await restore.getByRole('button', { name: '关闭', exact: true }).click()
    await restored.goto(base + '/fcs/sewing-outsourcing/material-handover?assignmentId=AW-TEST-ASG-0')
    await expect(restored.locator('[data-sewing-material-page]')).toContainText('7 张')
    await restored.reload(); await expect(restored.locator('[data-sewing-material-page]')).toContainText('7 张')
    const projection = await restored.evaluate(async () => {
      const slips = await import('/src/data/fcs/sewing-pickup-slips.ts'), flow = await import('/src/data/fcs/post-finishing-full-flow.ts'), api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
      await api.prepareAccessoryPostFinishing()
      return { current: slips.getCurrentSewingPickupSlip('AW-TEST-ASG-0', 'ACCESSORY'), versions: [slips.getSewingPickupSlipVersion('PPIC-PICKUP-AW-TEST-ASG-0-ACCESSORY-V1'), slips.getSewingPickupSlipVersion('PPIC-PICKUP-AW-TEST-ASG-0-ACCESSORY-V2')].filter(Boolean), postStocks: flow.listPostFinishingMaterialStocks().filter(row => row.productionOrderNo === 'PO-AW-SEW-CONTRACT'), legacy: localStorage.getItem('higood:ppic:sewing-pickup-slips:v1') }
    })
    assert.equal(projection.current?.versionId, second.versionId); assert.equal(projection.versions.find(row => row.versionId === first.versionId)?.status, 'VOIDED')
    assert.deepEqual(projection.postStocks.map(row => row.currentQty).sort((a, b) => a - b), [40, 80]); assert.equal(projection.legacy, null)
    await restored.goto(base + '/wls/accessory-warehouses/hilon/stock'); await restored.locator('[data-accessory-transfer-root]').waitFor()
    await restored.screenshot({ path: resolve(output, 'restored-site-stock.png'), fullPage: true })
    assert.deepEqual(sorted((await database(restored)).records), sorted(after.records)); assert.deepEqual(errors, [])
    await writeFile(resolve(output, 'full-backup-ui.json'), JSON.stringify({ at: new Date().toISOString(), base, fixture, rowKinds, download: { filename: download.suggestedFilename(), bytes: backupBytes.length }, backup: { records: backup.records.length, dependencies: backup.dependencies.length, commands: backup.commands.length, files: backup.files.length }, allRecordValuesEqual: true, commandIdsIntentsResultsEqual: true, allPresentBlobBytesEqual: true, attachmentBoundary: '当前正常业务路径无上传附件，files=0；本例不声称完成非空附件恢复验收。', firstVersion: first.versionId, currentVersion: second.versionId, projection, pageErrors: errors }, null, 2))
  } catch (error) { await source.screenshot({ path: resolve(output, 'source-failure.png'), fullPage: true }).catch(() => {}); await restored.screenshot({ path: resolve(output, 'restore-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await sourceContext.close(); await restoredContext.close() }
})

test('AC24 车缝加烫包实际有效任务scope按各SKU建全辅料领料清单，零后道调拨与DLN收货事项', { timeout: 90000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), page = await context.newPage()
  try {
    await initialize(page); const fixture = await seedAccessorySewingFixture(page, 'SEWING_IRONING_PACKING')
    await createPickups(page)
    const result = await page.evaluate(async () => {
      const rec = await import('/src/data/wls/accessory-warehouse-records.ts'), api = await import('/src/data/wls/accessory-warehouse-sewing.ts')
      return { pickups: api.listAccessorySewingPickups(), transfers: rec.listAccessoryRecords<any>('transfer'), receipts: rec.listAccessoryRecords<any>('receipt') }
    })
    assert.equal(result.pickups.length, 2)
    for (const [index, factor] of [0.4, 0.6].entries()) {
      const pickup = result.pickups.find(row => row.assignmentId === `AW-TEST-ASG-${index}`)!
      assert.ok(pickup); assert.equal(pickup.lines.length, 6)
      assert.deepEqual(Object.fromEntries(pickup.lines.map(row => [row.materialSku, row.requiredQty])), { 'AW-DEMO-ZIPPER': 100 * factor, 'AW-DEMO-BUTTON': 200 * factor, 'AW-DEMO-PRICE-TAG': 100 * factor, 'AW-DEMO-BRAND-TAG': 100 * factor, 'AW-DEMO-TAG-FASTENER': 100 * factor, 'AW-DEMO-SEWING-THREAD': factor })
      assert.match(pickup.taskVersion, /SEWING_IRONING_PACKING/)
    }
    assert.equal(result.transfers.filter(row => row.kind === 'SITE_TO_POST').length, 0); assert.equal(result.receipts.filter(row => row.warehouseCode === 'DLN').length, 0)
    await page.screenshot({ path: resolve(output, 'sewing-iron-pickups-1024.png'), fullPage: true })
    await writeFile(resolve(output, 'sewing-iron-pickups.json'), JSON.stringify({ at: new Date().toISOString(), base, fixture, result, actualCreateButton: true, noSiteToPost: true, noDlnReceipt: true }, null, 2))
  } catch (error) { await page.screenshot({ path: resolve(output, 'sewing-iron-failure.png'), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
})
