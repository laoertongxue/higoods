import { expect, test, type Page } from '@playwright/test'

async function openPage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/post-finishing/material-transfers')
  await page.locator('[data-post-material-workspace]').waitFor()
}

async function query(page: Page, keyword: string): Promise<void> {
  const form = page.locator('form[data-post-material-query]')
  await form.locator('[name="keyword"]').fill(keyword)
  await form.getByRole('button', { name: '查询', exact: true }).click()
}

async function selectRow(page: Page, text: string) {
  return page.locator('[data-post-material-workspace] tbody tr').filter({ hasText: text }).first()
}

test('人工调拨单按生产单创建：BOM/单位/排除项、中央仓同步门禁、物料列和日志', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  await page.addInitScript(() => localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-MGR'))
  await page.setViewportSize({ width: 1366, height: 768 })
  await openPage(page)
  await expect(page.getByRole('heading', { name: '后道辅料调拨单', exact: true })).toBeVisible()
  const headers = page.locator('[data-post-material-workspace] thead th')
  await expect(headers.filter({ hasText: '创建方式' })).toHaveCount(1)
  await expect(headers.filter({ hasText: '物料' })).toHaveCount(1)

  await query(page, 'DB-PF-202608-001')
  const legacy = await selectRow(page, 'DB-PF-202608-001')
  await expect(legacy).toContainText('系统自动创建')
  await expect(legacy).toContainText('吊粒')
  await expect(legacy.locator('[data-post-material-list-line]')).toHaveCount(4)
  await page.locator('form[data-post-material-query]').getByRole('button', { name: '重置', exact: true }).click()

  await page.getByRole('button', { name: '新增辅料调拨单', exact: true }).click()
  const create = page.getByRole('dialog', { name: '新增辅料调拨单', exact: true })
  await expect(create).toBeVisible()
  await expect(create).not.toContainText('创建人')
  await expect(create.locator('[data-post-material-create-actor]')).toHaveCount(0)
  await create.locator('[data-post-material-create-order]').fill('PO-AW-202610-H04')
  await create.getByRole('button', { name: '读取 BOM', exact: true }).click()
  const preview = create.locator('[data-post-material-create-preview]')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('技术包 V1')
  await expect(preview).toContainText('已排除 5 项')
  await expect(preview.locator('[data-post-material-bom-row]')).toHaveCount(2)
  const bomText = (await preview.locator('[data-post-material-bom-row]').allInnerTexts()).join('\n')
  for (const excluded of ['主身面料', '价格吊牌', '品牌吊牌', '吊粒', '车缝线']) expect(bomText).not.toContain(excluded)
  await expect(preview).toContainText('拉链')
  await expect(preview).toContainText('纽扣')
  await expect(preview).toContainText('条')
  await expect(preview).toContainText('粒')
  await create.locator('[data-post-material-create-bom-qty="AW-SCENE-H04-ZIPPER"]').fill('10')
  await create.locator('[data-post-material-create-bom-qty="AW-SCENE-H04-BUTTON"]').fill('20')

  const before = await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).listAccessoryRecords<any>('transfer').filter(row => row.creationMode === 'MANUAL').length)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    ;(globalThis as any).__manualOriginalPut = original
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'records' && String((args[0] as any)?.id || '').startsWith('accessory-warehouse:transfer:')) throw new DOMException('manual post abort', 'QuotaExceededError')
      return original.apply(this, args as any)
    }
  })
  await create.getByRole('button', { name: '确认创建', exact: true }).click()
  await expect(create.locator('[data-post-material-create-error]')).toContainText('manual post abort')
  await expect(create.locator('[data-post-material-create-bom-qty="AW-SCENE-H04-ZIPPER"]')).toHaveValue('10')
  expect(await page.evaluate(async () => (await import('/src/data/wls/accessory-warehouse-records.ts')).listAccessoryRecords<any>('transfer').filter(row => row.creationMode === 'MANUAL').length)).toBe(before)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__manualOriginalPut })
  await create.getByRole('button', { name: '确认创建', exact: true }).click()
  await expect(create).toHaveCount(0)
  await expect(page.locator('[role="status"]')).toContainText('辅料中央仓已创建调拨单并自动审核通过')

  await query(page, 'HD-PO-AW-202610-H04-M')
  const row = await selectRow(page, 'HD-PO-AW-202610-H04-M')
  await expect(row).toContainText('人工创建')
  await expect(row).toContainText('待调拨')
  await expect(row.locator('[data-post-material-list-line]')).toHaveCount(2)
  await expect(row).toContainText('拉链')
  await expect(row).toContainText('AW-SCENE-H04-ZIPPER')
  await expect(row).toContainText('10 条')
  await expect(row).toContainText('纽扣')
  await expect(row).toContainText('20 粒')
  const manual = await page.evaluate(async () => {
    const record = (await import('/src/data/wls/accessory-warehouse-records.ts')).listAccessoryRecords<any>('transfer').find(row => row.creationMode === 'MANUAL')
    return { status: record?.status, kind: record?.kind, history: record?.history?.map((item: any) => item.action), historyBy: record?.history?.map((item: any) => item.by), createdBy: record?.createdBy, lineCount: record?.lines?.length }
  })
  expect(manual).toEqual({ status: '待出库', kind: 'GTP_TO_POST', history: ['人工创建调拨单', '自动审核通过'], historyBy: ['林质检主管', '辅料中央仓系统'], createdBy: '林质检主管', lineCount: 2 })

  await row.locator('[data-post-material-list-line]').first().locator('[data-accessory-action="image"]').click()
  const image = page.getByRole('dialog', { name: '拉链', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.locator('img').evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
  await image.getByRole('button', { name: '关闭', exact: true }).click()

  await row.getByRole('button', { name: '查看日志', exact: true }).click()
  const log = page.getByRole('dialog', { name: '操作日志', exact: true })
  await expect(log).toBeVisible()
  const entries = log.locator('[data-post-material-log-entry]')
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(0)).toContainText('自动审核通过')
  await expect(entries.nth(1)).toContainText('人工创建调拨单')
  await expect(entries.nth(1)).toContainText('林质检主管')
  await log.getByRole('button', { name: '关闭', exact: true }).click()

  await row.getByRole('button', { name: '查看详情', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true })
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: '操作记录', exact: true })).toHaveCount(0)
  await expect(detail).toContainText('操作日志请从列表“查看日志”打开')
  await detail.getByRole('button', { name: '关闭', exact: true }).click()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: 'test-results/manual-material-transfer-production.png', fullPage: true })
  await testInfo.attach('manual-material-transfer-production', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('人工通用物料创建：搜索添加、单物料去重、通用调拨行和后续收货', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await openPage(page)
  await page.getByRole('button', { name: '新增辅料调拨单', exact: true }).click()
  const create = page.getByRole('dialog', { name: '新增辅料调拨单', exact: true })
  await create.getByRole('button', { name: '不按生产单（通用物料）', exact: true }).click()
  await create.locator('[data-post-material-create-search]').fill('AW-SCENE-H04-BUTTON')
  const result = create.locator('[data-post-material-general-result="AW-SCENE-H04-BUTTON"]')
  await expect(result).toBeVisible()
  await expect(result).toContainText('纽扣')
  await expect(result).toContainText('标准纽扣（演示） · 粒')
  await result.getByRole('button', { name: '添加', exact: true }).click()
  await expect(create.locator('[data-post-material-create-general-qty="AW-SCENE-H04-BUTTON"]')).toBeVisible()
  await expect(create.locator('[data-post-material-general-result="AW-SCENE-H04-BUTTON"]').getByRole('button', { name: '已添加', exact: true })).toBeDisabled()
  await create.locator('[data-post-material-create-general-qty="AW-SCENE-H04-BUTTON"]').fill('8')
  await create.getByRole('button', { name: '确认创建', exact: true }).click()
  await expect(create).toHaveCount(0)
  await expect(page.locator('[role="status"]')).toContainText('辅料中央仓已创建调拨单并自动审核通过')

  await query(page, 'HD-GEN-')
  const row = await selectRow(page, 'HD-GEN-')
  await expect(row).toContainText('通用物料调拨')
  await expect(row).toContainText('人工创建')
  await expect(row).toContainText('纽扣')
  await expect(row).toContainText('AW-SCENE-H04-BUTTON')
  await expect(row).toContainText('8 粒')
  const identity = await page.evaluate(async () => {
    const record = (await import('/src/data/wls/accessory-warehouse-records.ts')).listAccessoryRecords<any>('transfer').find(row => row.manualSource === 'GENERAL')
    return { number: record?.manualTransferNo, productionOrderId: record?.productionOrderId, status: record?.status, source: record?.manualSource }
  })
  expect(identity.productionOrderId).toBe('MANUAL-GENERAL')
  expect(identity.source).toBe('GENERAL')
  expect(identity.status).toBe('待出库')
  expect(identity.number).toMatch(/^HD-GEN-\d{4}$/)

  const dispatched = await page.evaluate(async no => {
    const records = await import('/src/data/wls/accessory-warehouse-records.ts'), commands = await import('/src/data/wls/accessory-warehouse-commands.ts'), stocks = await import('/src/data/wls/accessory-warehouse-stock-sources.ts')
    const transfer = records.listAccessoryRecords<any>('transfer').find(row => row.manualTransferNo === no)
    const result = commands.buildAccessoryDispatchChange({ transfer, stocks: stocks.listAccessoryStockSources(records.listAccessoryRecords<any>('stock')), actor: { warehouseCode: 'WH-FITTING-001', role: '仓管', name: 'GTP单元验收' }, commandId: 'MANUAL-E2E-DISPATCH', at: new Date().toISOString() })
    await records.saveAccessoryWarehouseAction({ commandId: 'MANUAL-E2E-DISPATCH', intent: 'dispatch-manual-e2e', result: result.transfer, change: result.change })
    return result.transfer.status
  }, identity.number)
  expect(dispatched).toBe('已出库待收货')
  await page.reload(); await page.locator('[data-post-material-workspace]').waitFor(); await query(page, identity.number)
  const waiting = await selectRow(page, identity.number)
  await expect(waiting).toContainText('待入库')
  await waiting.getByRole('button', { name: '查看并收货上架', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '后道辅料调拨单详情', exact: true })
  await expect(detail).toBeVisible()
  await detail.locator('[data-post-material-qty]').fill('8')
  await detail.locator('[data-post-material-location]').selectOption({ label: 'PF-MAT-A01-01' })
  await detail.locator('[data-post-material-actor]').fill('DLN单元验收')
  await detail.getByRole('button', { name: '确认收货并上架', exact: true }).click()
  await expect(detail).toHaveCount(0)
  await expect(page.locator('[role="status"]')).toContainText('整单收货上架已保存')
  await expect((await selectRow(page, identity.number))).toContainText('已入库')
  const stock = await page.evaluate(async no => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderNo === no).map(row => ({ qty: row.currentQty, unit: row.material.unit, location: row.locationCode }))
  }, identity.number)
  expect(stock).toEqual([{ qty: 8, unit: '粒', location: 'PF-MAT-A01-01' }])
  await testInfo.attach('manual-material-transfer-general', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
