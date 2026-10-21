import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { createServer } from 'vite'
const server = process.env.ACCESSORY_MOCK_TEST_URL ? undefined : await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
await server?.listen()
const addr = server?.httpServer?.address()
const base = process.env.ACCESSORY_MOCK_TEST_URL || `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : ''}`
const output = 'output/verification/accessory-workflow-mock'
let browser: Browser
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch() })
after(async () => { await browser?.close(); await server?.close() })
async function facts(page: Page) {
  return page.evaluate(async () => {
    const rec = await import('/src/data/wls/accessory-warehouse-records.ts')
    const source = await import('/src/data/wls/accessory-warehouse-sources.ts')
    return { physical: rec.currentAccessorySnapshot(), preps: source.listAccessoryPreparations(), issues: source.listAccessoryWarehouseSourceIssues(),
      transfers: rec.listAccessoryRecords<any>('transfer'), pickups: rec.listAccessoryRecords<any>('pickup'), stocks: rec.listAccessoryRecords<any>('stock'), handovers: rec.listAccessoryRecords<any>('sewing-handover') }
  })
}
const routes = [
  ...['preparation', 'transfers', 'stock', 'locations'].map(view => `/wls/accessory-warehouses/gtp/${view}`),
  ...['hilon', 'mahameru'].flatMap(site => ['receipts', 'pickups', 'transfers', 'stock', 'locations'].map(view => `/wls/accessory-warehouses/${site}/${view}`)),
  '/fcs/craft/post-finishing/material-transfers', '/fcs/sewing-outsourcing/tasks',
]

test('AM-01～08 首次直达16入口有完整Mock/图片，三设备不溢出，未写入静态种子', { timeout: 180000 }, async () => {
  const results: unknown[] = []
  for (const width of [1366, 1280, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 768 }, timezoneId: 'Asia/Shanghai' })
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    try {
      for (const route of routes) {
        await page.goto(base + route)
        const main = page.locator('main'); await expect(main.locator('table').first()).toBeVisible({ timeout: 30000 })
        assert.equal(await main.locator('[data-accessory-read-error]').count(), 0, route)
        assert.ok(await main.locator('tbody tr').count() > 0, route)
        const images = await main.locator('img').evaluateAll(async (nodes: HTMLImageElement[]) => {
          nodes.forEach(img => { img.loading = 'eager' })
          await Promise.all(nodes.map(img => img.decode().catch(() => {})))
          return nodes.map(img => ({ src: img.getAttribute('src'), valid: img.complete && img.naturalWidth > 0 }))
        })
        if (!route.endsWith('/locations')) assert.ok(images.length > 0, route + ' has identifying photos')
        assert.ok(images.every(img => img.valid), JSON.stringify({ route, images }))
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + ' body overflow')
        if (route.includes('pickups')) { await expect(main).toContainText('待领料'); await expect(main).toContainText('领料中'); await expect(main).toContainText('已领料'); await expect(main).toContainText('待建立清单') }
        if (route.endsWith('post-finishing/material-transfers')) {
          const identities = await page.evaluate(async () => {
            const api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
            const rows = api.listManagedAccessoryPostTransfers()
            return { count: rows.length, valid: rows.every(row => api.isManagedAccessoryPostTransfer(row.transferOrderId) && api.isManagedAccessoryPostTransfer(row.transferOrderNo)), unknown: api.isManagedAccessoryPostTransfer('HD-UNKNOWN') || api.isManagedAccessoryPostTransfer('LEGACY-UNRELATED') }
          })
          assert.equal(identities.count, 6); assert.equal(identities.valid, true); assert.equal(identities.unknown, false)
        }
        if (route.endsWith('gtp/preparation')) {
          const data = await facts(page)
          assert.equal(data.preps.filter(row => row.productionOrderId.startsWith('PO-AW')).length, 17)
          assert.equal(data.issues.filter(row => row.preparationId.includes('PO-AW')).length, 0, JSON.stringify(data.issues))
          assert.equal(data.physical.records.length, 0, 'plain reads never save Mock')
        }
        await page.screenshot({ path: `${output}/${width}-${route.split('/').slice(-2).join('-')}.png`, fullPage: true })
        results.push({ width, route, images: images.length, rows: await main.locator('tbody tr').count() })
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  await writeFile(`${output}/pages.json`, JSON.stringify({ base, results }, null, 2))
})

test('AM-03/05/07 原生页面收货、部分领料续领与刷新同源，失败保留输入，不复制其他Mock', { timeout: 120000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, timezoneId: 'Asia/Shanghai' })
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base + '/wls/accessory-warehouses/hilon/receipts')
    const row = page.locator('tbody tr').filter({ hasText: 'PO-AW-202610-H02' })
    await row.locator('[data-accessory-transfer-action="receive"]').click()
    const dialog = page.getByRole('dialog', { name: '确认收货并上架' }); await expect(dialog).toBeVisible()
    const quantities = dialog.locator('[data-aw-transfer-qty]'), locations = dialog.locator('[data-aw-transfer-location]')
    for (let i = 0; i < await quantities.count(); i++) { await quantities.nth(i).fill(String([100, 200, 100, 100, 100, 1][i])); await locations.nth(i).selectOption({ index: 1 }) }
    await quantities.first().fill('99')
    await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
    await expect(dialog.locator('[data-aw-transfer-error]')).toContainText('实收与应收')
    assert.equal((await facts(page)).physical.records.length, 0)
    await quantities.first().fill('100')
    await dialog.getByRole('button', { name: '确认收货并上架', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.reload(); await expect(page.locator('[data-accessory-transfer-root]')).toBeVisible()
    let data = await facts(page)
    assert.equal(data.transfers.find(row => row.id === 'AW-MOCK:H02:GTP')?.status, '已收货')
    assert.equal(data.physical.records.filter(row => row.collection.endsWith(':preparation')).length, 0)
    assert.ok(data.physical.records.length < 20, 'only the acted-on receipt/transfer/stocks/audit are saved')
    await page.goto(base + '/wls/accessory-warehouses/hilon/pickups')
    await page.locator('tbody tr').filter({ hasText: 'PO-AW-202610-H05' }).locator('[data-accessory-pickup-action="handover"]').click()
    const pickupDialog = page.getByRole('dialog', { name: '登记车缝领料实交' }); await expect(pickupDialog).toBeVisible()
    const inputs = pickupDialog.locator('[data-aw-pickup-qty]')
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(String([60, 60, 60, 0.6][i]))
    await inputs.first().fill('61')
    await pickupDialog.getByRole('button', { name: '确认本次实交' }).click()
    await expect(pickupDialog.locator('[data-aw-pickup-error]')).toContainText('超过剩余应领')
    await inputs.first().fill('60')
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put
      ;(globalThis as any).__awOriginalPut = original
      IDBObjectStore.prototype.put = function (...args: any[]) {
        if (this.name === 'records' && String(args[0]?.id || '').startsWith('accessory-warehouse:pickup:')) throw new DOMException('isolated quota failure', 'QuotaExceededError')
        return original.apply(this, args as any)
      }
    })
    await pickupDialog.getByRole('button', { name: '确认本次实交' }).click()
    await expect(pickupDialog.locator('[data-aw-pickup-error]')).not.toBeEmpty()
    await expect(inputs.first()).toHaveValue('60')
    data = await facts(page); assert.equal(data.pickups.find(row => row.productionOrderId.endsWith('H05'))?.status, '领料中')
    await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__awOriginalPut })
    await pickupDialog.getByRole('button', { name: '确认本次实交' }).click()
    await expect(pickupDialog).not.toBeVisible()
    await page.reload(); await expect(page.locator('[data-accessory-pickup-root]')).toBeVisible()
    data = await facts(page)
    assert.equal(data.pickups.find(row => row.productionOrderId.endsWith('H05'))?.status, '已领料')
    const events = data.handovers.filter(row => row.assignmentId.includes('H05'))
    assert.equal(events.length, 2); assert.equal(events.flatMap(row => row.lines).filter(row => row.materialName === '价格吊牌').reduce((sum, row) => sum + row.actualQty, 0), 100)
    assert.deepEqual(errors, [])
    await writeFile(`${output}/flow.json`, JSON.stringify({ base, physicalRecordCount: data.physical.records.length, handovers: events, errors }, null, 2))
  } finally { await context.close() }
})

test('AM-07 静态覆盖与删除在原库按记录保存，重开不复活，其他单据原样', { timeout: 120000 }, async () => {
  const context = await browser.newContext(), page = await context.newPage()
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base + '/wls/accessory-warehouses/hilon/stock'); await page.locator('[data-accessory-transfer-root]').waitFor()
    const ids = await page.evaluate(async () => {
      const api = await import('/src/data/wls/accessory-warehouse-records.ts')
      const stock = api.listAccessoryRecords<any>('stock').find(row => row.materialSku.includes('H04') && row.warehouseCode === 'HILON-2')!
      const target = api.listAccessoryRecords<any>('transfer').find(row => row.productionOrderId.endsWith('M01'))!
      await api.saveAccessoryWarehouseAction({ commandId: 'zero-override', intent: 'isolated-stock-adjustment', result: true, change: { puts: [api.accessoryRecord('stock', stock.id, { ...stock, onHandQty: 0, reservedQty: 0, sourceRefs: [], version: stock.version + 1 })], deletes: [api.accessoryRecord('transfer', target.id, target).id] } })
      return { stockId: stock.id, transferId: target.id }
    })
    await page.reload(); await page.locator('[data-accessory-transfer-root]').waitFor()
    const data = await facts(page)
    assert.equal(data.stocks.find(row => row.id === ids.stockId)?.onHandQty, 0)
    assert.ok(!data.transfers.some(row => row.id === ids.transferId))
    assert.equal(data.physical.records.length, 2)
    assert.ok(data.physical.records.some(row => row.collection.endsWith(':tombstone')))
    const fresh = await context.newPage(); await fresh.goto(base + '/wls/accessory-warehouses/mahameru/transfers'); await fresh.locator('[data-accessory-transfer-root]').waitFor()
    assert.ok(!(await facts(fresh)).transfers.some(row => row.id === ids.transferId))
  } finally { await context.close() }
})

test('AM-07 既有外部备份包含静态来源与用户覆盖，恢复零余额和删除标记', { timeout: 120000 }, async () => {
  const sourceContext = await browser.newContext(), targetContext = await browser.newContext()
  try {
    const page = await sourceContext.newPage()
    await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await page.goto(base + '/wls/accessory-warehouses/hilon/stock'); await page.locator('[data-accessory-transfer-root]').waitFor()
    const payload = await page.evaluate(async () => {
      const records = await import('/src/data/wls/accessory-warehouse-records.ts')
      const backup = await import('/src/data/wls/accessory-warehouse-migration.ts')
      const stock = records.listAccessoryRecords<any>('stock').find(row => row.materialSku.includes('H04') && row.warehouseCode === 'HILON-2')!
      await records.saveAccessoryWarehouseAction({ commandId: 'backup-zero', intent: 'isolated-adjustment', result: true, change: { puts: [records.accessoryRecord('stock', stock.id, { ...stock, onHandQty: 0, reservedQty: 0, sourceRefs: [], version: stock.version + 1 })] } })
      const deleted = records.listAccessoryRecords<any>('stock').find(row => row.materialSku.includes('H06') && row.warehouseCode === 'HILON-2' && row.onHandQty === 0)!
      await records.saveAccessoryWarehouseAction({ commandId: 'backup-tombstone', intent: 'isolated-deletion', result: true, change: { puts: [], deletes: [records.accessoryRecord('stock', deleted.id, deleted).id] } })
      const data = await backup.exportAccessoryWarehouseBackup()
      backup.validateAccessoryWarehouseBackup(data)
      return { stockId: stock.id, deletedId: deleted.id, backup: data }
    })
    const target = await targetContext.newPage()
    await target.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await target.goto(base + '/wls/accessory-warehouses/hilon/stock'); await target.locator('[data-accessory-transfer-root]').waitFor()
    const restored = await target.evaluate(async ({ backup, stockId, deletedId }) => {
      const migration = await import('/src/data/wls/accessory-warehouse-migration.ts'), records = await import('/src/data/wls/accessory-warehouse-records.ts')
      await migration.restoreAccessoryWarehouseBackup(backup)
      return { stock: records.findAccessoryRecord<any>('stock', stockId), deleted: records.findAccessoryRecord<any>('stock', deletedId), transfers: records.listAccessoryRecords<any>('transfer').length, pickups: records.listAccessoryRecords<any>('pickup').length }
    }, payload)
    assert.equal(restored.deleted, undefined); assert.equal(restored.stock.onHandQty, 0); assert.equal(restored.transfers, 19); assert.equal(restored.pickups, 6)
  } finally { await sourceContext.close(); await targetContext.close() }
})
