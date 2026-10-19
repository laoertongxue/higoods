import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.ACCESSORY_FCS_TEST_URL || 'http://127.0.0.1:43241'
const output = resolve('output/playwright/accessory-warehouse/fcs-readonly')
const fcsPath = '/fcs/material-prep/sewing'
const prepId = 'prep-order-po-202603-0008'
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ capturedAt: new Date().toISOString(), base, environment: 'Vite development browser contract', evidence }, null, 2)) })

async function withPage(run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  try {
    await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try { await run(page) }
    catch (error) {
      const name = `failure-${Date.now()}`
      await writeFile(resolve(output, `${name}.json`), JSON.stringify({ capturedAt: new Date().toISOString(), url: page.url(), error: String(error), pageErrors: errors }, null, 2))
      await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }).catch(() => {})
      throw error
    }
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}
async function stored(page: Page) {
  return page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot())
}

test('GTP实际保存后，全新FCS页面独立直达和刷新读取同一数量备注历史，旧弹窗URL不再提供辅料写入', { timeout: 120000 }, async () => {
  await withPage(async writer => {
    await writer.goto(base + '/wls/accessory-warehouses/gtp/preparation')
    await writer.locator('[data-accessory-preparation-root]').waitFor()
    await writer.locator('[data-accessory-field="keyword"]').fill('PO-202603-0008')
    await writer.locator('[data-accessory-action="query"]').click()
    await expect(writer.locator('[data-accessory-action="prepare"]')).toHaveCount(1)
    await writer.locator('[data-accessory-action="prepare"]').click()
    const dialog = writer.getByRole('dialog', { name: '登记配料', exact: true })
    await dialog.locator('[data-aw-qty]').first().fill('4')
    await dialog.locator('[data-aw-location]').first().selectOption({ label: 'GTP-A-01' })
    await dialog.getByRole('button', { name: '保存本次配料', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await writer.locator('[data-accessory-action="remark"]').click()
    await writer.locator('[data-aw-remark]').fill('FCS 独立直达验收备注')
    await writer.getByRole('button', { name: '保存备注', exact: true }).click()
    await expect(writer.getByRole('dialog')).toHaveCount(0)
    const before = await stored(writer)

    const reader = await writer.context().newPage()
    await reader.goto(`${base}${fcsPath}?prepOrderId=${prepId}&detailTab=records&prepModal=1`)
    const root = reader.locator(`[data-fcs-accessory-readonly="${prepId}"]`)
    await expect(root).toBeVisible()
    const zipper = root.locator('tbody tr').filter({ hasText: '拉链' })
    await expect(zipper.locator('td').nth(2)).toHaveText('4 条')
    await expect(root).toContainText('配料中')
    await expect(root).toContainText('FCS 独立直达验收备注')
    await expect(root).toContainText('登记配料')
    await expect(root).toContainText('修改备注')
    await expect(reader.locator('[data-fcs-prep-form]')).toHaveCount(0)
    await expect(root.locator('[data-fcs-material-prep-action]')).toHaveCount(0)
    await reader.locator('[data-fcs-legacy-materials] button[data-nav*="detailTab=inventory"]').click()
    await expect(reader.locator('[data-fcs-legacy-materials]')).toContainText('Green 斜纹马甲主面料')
    await expect(reader.locator('[data-fcs-legacy-materials]')).not.toContainText('主唛/洗护唛')
    assert.deepEqual(await stored(reader), before)
    await root.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await reader.screenshot({ path: resolve(output, 'direct-fcs-followup-1366.png'), fullPage: true })
    await reader.reload()
    await root.waitFor()
    await expect(root.locator('tbody tr').filter({ hasText: '拉链' }).locator('td').nth(2)).toHaveText('4 条')
    assert.deepEqual(await stored(reader), before)
    await root.locator('[data-accessory-action="image"]').first().click()
    await expect(root.getByRole('dialog')).toBeVisible()
    await reader.keyboard.press('Escape')
    await expect(root.getByRole('dialog')).toHaveCount(0)
    await root.getByRole('button', { name: '前往 GTP 办理', exact: true }).click()
    await reader.locator('[data-accessory-preparation-root]').waitFor()
    evidence.directRead = { savedRevision: before.revision, recordCount: before.records.length, preparedQty: 4, independentPageAndRefresh: true, legacyOtherMaterialsRetained: true }
  })
})

test('FCS首次直接打开不落业务种子，跟进列表查询分页及非范围原详情仍可使用', { timeout: 120000 }, async () => {
  await withPage(async page => {
    await page.goto(base + fcsPath)
    const root = page.locator('[data-fcs-accessory-readonly]')
    await root.waitFor()
    assert.equal((await stored(page)).records.length, 0)
    await expect(root.locator('tbody tr')).toHaveCount(10)
    await root.locator('[data-fcs-accessory-readonly-action="next-page"]').click()
    await expect(page).toHaveURL(/page=2/)
    await expect(root.locator('tbody tr')).toHaveCount(10)
    await page.locator('[data-fcs-material-prep-action="search-input"]').fill('PO-202603-0008')
    await page.locator('[data-fcs-material-prep-action="search-apply"]').click()
    await expect(root.locator('tbody tr')).toHaveCount(1)
    await expect(root).toContainText('绿色休闲马甲')
    await root.getByRole('button', { name: '查看跟进', exact: true }).click()
    await page.locator(`[data-fcs-accessory-readonly="${prepId}"]`).waitFor()
    assert.equal((await stored(page)).records.length, 0)
    await page.goto(`${base}${fcsPath}?prepOrderId=prep-order-po-202603-0006&detailTab=records`)
    await page.locator('[data-fcs-legacy-materials]').waitFor()
    const originalBatch = await page.evaluate(async () => (await import('/src/data/fcs/cutting/production-material-prep.ts')).getMaterialPrepOrderProjection('prep-order-po-202603-0006')!.prepRecords.find(record => record.prepRecordId === 'prep-rec-po-0006-main-001')!.batchNo)
    await expect(page.locator('[data-fcs-legacy-materials]')).toContainText(originalBatch)
    await expect(page.locator('[data-fcs-legacy-materials]')).toContainText('已确认')
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.screenshot({ path: resolve(output, 'retained-other-record-1024.png'), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    evidence.firstRead = { noBusinessSeeds: true, queryAndPagination: true, originalWoolRecordRetained: true }
  })
})

test('伪造可见旧按钮仍按真实来源阻断辅料新增/拣货/关闭，纯其他记录继续原操作路径', { timeout: 120000 }, async () => {
  await withPage(async page => {
    await page.goto(`${base}${fcsPath}?prepOrderId=${prepId}`)
    await page.locator(`[data-fcs-accessory-readonly="${prepId}"]`).waitFor()
    const setup = await page.evaluate(async id => {
      const api = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const projections = api.listMaterialPrepOrderProjections()
      const projection = projections.find(row => row.order.prepOrderId === id)!
      const line = projection.lines.find(row => api.isAccessoryWarehouseScopeLine(row, projection.order))!
      const scopedRecord = projections.flatMap(row => row.prepRecords.map(record => ({ projection: row, record })))
        .find(({ projection, record }) => api.getMaterialPrepRecordItems(record).some(item => projection.lines.some(line => line.prepLineId === item.prepLineId && api.isAccessoryWarehouseScopeLine(line, projection.order))))!
      const otherRecord = projections.flatMap(row => row.prepRecords.map(record => ({ projection: row, record })))
        .find(({ projection, record }) => api.getMaterialPrepRecordItems(record).every(item => projection.lines.some(line => line.prepLineId === item.prepLineId && !api.isAccessoryWarehouseScopeLine(line, projection.order))))!
      // These are malicious entry controls, not successful business fixtures.
      // A real click must still reach the owning handler's source-based guard.
      const form = document.createElement('section')
      form.setAttribute('data-fcs-prep-form', '')
      form.innerHTML = `<div data-prep-line-id="${line.prepLineId}"><input data-fcs-prep-line-qty value="1"></div><button id="scope-create" data-fcs-material-prep-action="create-prep-record" data-prep-order-id="${id}">旧辅料新增</button><button id="scope-pick" data-fcs-material-prep-action="pick-record" data-prep-record-id="${scopedRecord.record.prepRecordId}">旧辅料拣货</button><button id="scope-close" data-fcs-material-prep-action="close-order" data-prep-order-id="${id}">旧整单关闭</button><button id="other-pick" data-fcs-material-prep-action="pick-record" data-prep-record-id="${otherRecord.record.prepRecordId}">其他用料拣货</button>`
      document.querySelector('[data-fcs-accessory-readonly]')!.appendChild(form)
      return { legacyRaw: localStorage.getItem(api.PRODUCTION_MATERIAL_PREP_STORAGE_KEY), otherRecordId: otherRecord.record.prepRecordId }
    }, prepId)
    const before = await stored(page)
    const dialogs: { type: string; text: string }[] = []
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), text: dialog.message() })
      if (dialog.type() === 'prompt') await dialog.dismiss()
      else await dialog.accept()
    })
    const blocked: string[] = []
    for (const selector of ['#scope-create', '#scope-pick', '#scope-close']) {
      await page.locator(selector).click()
      await expect.poll(() => dialogs.length).toBe(blocked.length + 1)
      const text = dialogs.at(-1)!.text
      assert.match(text, /辅料中央仓（GTP）/)
      blocked.push(text)
    }
    await page.locator('#other-pick').click()
    await expect.poll(() => dialogs.length).toBe(4)
    const prompt = dialogs.at(-1)!
    assert.equal(prompt.type, 'prompt')
    assert.ok(!prompt.text.includes('GTP'))
    assert.deepEqual(await stored(page), before)
    assert.equal(await page.evaluate(async () => { const api = await import('/src/data/fcs/cutting/production-material-prep.ts'); return localStorage.getItem(api.PRODUCTION_MATERIAL_PREP_STORAGE_KEY) }), setup.legacyRaw)
    evidence.entryGuard = { blockedActions: blocked.length, directSourceChecked: true, otherRecordId: setup.otherRecordId, otherOperationReachedOriginalPrompt: true, originalBytesPreserved: true }
  })
})

test('混合记录只读切片保留其他行的身份单位数量，不改原对象；数据库失败不伪装空辅料列表', { timeout: 120000 }, async () => {
  await withPage(async page => {
    await page.goto(`${base}${fcsPath}?prepOrderId=${prepId}`)
    await page.locator('[data-fcs-accessory-readonly]').waitFor()
    const result = await page.evaluate(async id => {
      const data = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const view = await import('/src/pages/fcs/material-prep/accessory-preparation-readonly.ts')
      const projection = structuredClone(data.getMaterialPrepOrderProjection(id)!)
      const scoped = projection.lines.find(line => data.isAccessoryWarehouseScopeLine(line, projection.order))!
      const other = projection.lines.find(line => !data.isAccessoryWarehouseScopeLine(line, projection.order))!
      const template = data.listMaterialPrepOrderProjections().flatMap(row => row.prepRecords)[0]
      // In-memory view fixture only; never placed into a database or runtime store.
      projection.prepRecords = [{ ...template, prepOrderId: id, prepRecordId: 'mixed-view-only', prepLineId: scoped.prepLineId, items: [
        { prepRecordItemId: 'scope', prepLineId: scoped.prepLineId, preparedQty: 3, rollCount: 1, warehouseArea: 'A', locationCode: 'A', sourceStockEventId: '', remark: '' },
        { prepRecordItemId: 'other', prepLineId: other.prepLineId, preparedQty: 7, rollCount: 2, warehouseArea: 'B', locationCode: 'B', sourceStockEventId: '', remark: '' },
      ] }]
      const original = JSON.stringify(projection)
      const retained = view.retainLegacySewingProjection(projection)!
      const pureOther = data.listMaterialPrepOrderProjections().find(row => row.lines.every(line => !data.isAccessoryWarehouseScopeLine(line, row.order)))!
      return { unchanged: original === JSON.stringify(projection), scopeRemoved: retained.lines.every(line => !data.isAccessoryWarehouseScopeLine(line, projection.order)), recordId: retained.prepRecords[0].prepRecordId, items: retained.prepRecords[0].items, quantity: retained.prepRecords[0].preparedQty, units: retained.prepRecords[0].unitSummaries, originalOtherLineId: other.prepLineId, pureOtherIdentityRetained: view.retainLegacySewingProjection(pureOther) === pureOther }
    }, prepId)
    assert.equal(result.unchanged, true)
    assert.equal(result.scopeRemoved, true)
    assert.equal(result.recordId, 'mixed-view-only')
    assert.equal(result.items?.length, 1)
    assert.equal(result.items![0].prepLineId, result.originalOtherLineId)
    assert.equal(result.quantity, 7)
    assert.equal(result.units?.length, 1)
    assert.equal(result.pureOtherIdentityRetained, true)
    await page.addInitScript(() => {
      const original = IDBFactory.prototype.open
      IDBFactory.prototype.open = function (...args: Parameters<IDBFactory['open']>) {
        if (args[0] === 'higood-cutting-records-v1' && !(globalThis as any).__allowAccessoryDb) throw new DOMException('FCS read denied', 'SecurityError')
        return original.apply(this, args)
      }
    })
    await page.reload()
    await expect(page.locator('section[role="alert"]').filter({ hasText: '辅料配料资料无法读取' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-fcs-accessory-readonly]')).toHaveCount(0)
    await page.screenshot({ path: resolve(output, 'fcs-read-failure.png'), fullPage: true })
    await page.evaluate(() => { (globalThis as any).__allowAccessoryDb = true })
    await page.getByRole('button', { name: '重新读取', exact: true }).click()
    await expect(page.locator(`[data-fcs-accessory-readonly="${prepId}"]`)).toBeVisible()
    assert.equal((await stored(page)).records.length, 0)
    evidence.scopedProjectionAndFailure = { ...result, openFailureShown: true, fakeEmptyListRejected: true, explicitRetryRecovers: true }
  })
})
