import { expect, test, type Locator, type Page } from '@playwright/test'

const FCS_REPLACEMENT_PATH = '/fcs/craft/post-finishing/garment-spu-replacements'
const WLS_REPLACEMENT_PATH = '/wls/garment-spu-replacements'
const WLS_RELABEL_TASK_PATH = '/wls/garment-relabel-tasks'
const PRODUCTION_ORDER_PATH = '/fcs/production/orders'
const STORAGE_KEY = 'higood-fcs-garment-spu-replacement-v2'

async function openPath(page: Page, path: string, rootSelector: string): Promise<Locator> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  const root = page.locator(rootSelector)
  await expect(root).toBeVisible()
  return root
}

async function expectMenuIcon(page: Page, title: string): Promise<void> {
  const icon = page.locator(`[data-menu-item-icon="${title}"]`).first()
  await expect(icon).toBeVisible()
  await expect(icon.locator('svg')).toHaveCount(1)
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `output/playwright/${name}.png`, fullPage: true })
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    if (sessionStorage.getItem('garment-spu-replacement-e2e-initialized') === '1') return
    localStorage.removeItem(storageKey)
    localStorage.removeItem('higood-fcs-garment-spu-replacement-v1')
    Object.keys(localStorage)
      .filter((key) => key.includes('garment-spu-replacement') || key.includes('garment-relabel'))
      .forEach((key) => localStorage.removeItem(key))
    sessionStorage.setItem('garment-spu-replacement-e2e-initialized', '1')
  }, STORAGE_KEY)
})

test('成衣整色 SPU 替换从后道发起到成衣仓旧出新入形成完整闭环', async ({ page, context }) => {
  test.setTimeout(180_000)
  const consoleErrors: string[] = []
  const collectConsoleError = (message: { type(): string; text(): string }): void => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  }
  page.on('console', collectConsoleError)

  const replacementRoot = await openPath(page, FCS_REPLACEMENT_PATH, '[data-garment-spu-replacement-root]')
  await expectMenuIcon(page, '成衣 SPU 替换')
  await expectNoDocumentOverflow(page)

  // 初始 Mock 同时覆盖待换码、换码中、已完成，避免空白原型无法演示。
  await expect(replacementRoot).toContainText('成衣替换-0001')
  await expect(replacementRoot).toContainText('成衣替换-0002')
  await expect(replacementRoot).toContainText('成衣替换-0003')
  await expect(replacementRoot).toContainText('等待后道工厂和成衣仓开始换码')
  await expect(replacementRoot).toContainText('成衣仓正在按原入库批次处理')
  await expect(replacementRoot).toContainText('后道与成衣仓均已完成新条码、新吊牌和旧出新入')
  await expect(replacementRoot.getByText('换码中', { exact: true })).not.toHaveCount(0)
  await expect(replacementRoot.getByText('已完成', { exact: true })).not.toHaveCount(0)
  await screenshot(page, 'garment-spu-replacement-full-flow-01-mock-list')

  await replacementRoot.getByRole('button', { name: '发起整色替换', exact: true }).click()
  let dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()

  const productionOrderInput = dialog.getByLabel('搜索生产单')
  await expect(productionOrderInput).toHaveAttribute('list', 'garment-replacement-production-orders')
  await expect(productionOrderInput).toHaveValue('PO-202603-0001')
  await productionOrderInput.fill('PO-202603-000')
  await expect(productionOrderInput).toHaveValue('PO-202603-000')
  await productionOrderInput.fill('PO-202603-0001')

  dialog = page.getByRole('dialog').first()
  const sourceColor = dialog.locator('[data-garment-spu-replacement-field="sourceColor"]')
  await expect(sourceColor).toHaveValue('White')
  await expect(sourceColor.locator('option')).toHaveText(['White'])

  const targetSpuInput = dialog.getByLabel('搜索目标 SPU')
  await expect(targetSpuInput).toHaveAttribute('list', 'garment-replacement-target-spus')
  await targetSpuInput.fill('SPU-2024-01')
  await expect(targetSpuInput).toHaveValue('SPU-2024-01')
  await targetSpuInput.fill('SPU-2024-015')

  dialog = page.getByRole('dialog').first()
  await expect(dialog.locator('[data-garment-spu-replacement-field="targetColor"]')).toHaveValue('White')
  await expect(dialog.locator('[data-create-preview]')).toBeVisible()
  for (const businessLabel of ['已完成销售出库（历史）', '成衣仓未售成衣', '后道工厂未入仓成衣', '生产单剩余待回货']) {
    await expect(dialog).toContainText(businessLabel)
  }
  for (const obsoleteLabel of ['A 已售历史', 'B 成衣仓', 'C 后道厂', 'D 待回货']) {
    await expect(dialog).not.toContainText(obsoleteLabel)
  }
  await dialog.locator('[data-garment-spu-replacement-field="reason"]').fill('全流程验收：第二批回货发现整色质量问题，所有未售及待回货成衣统一替换')
  await dialog.locator('[data-garment-spu-replacement-field="evidence"]').setInputFiles('public/tshirt-sample.jpg')
  await screenshot(page, 'garment-spu-replacement-full-flow-02-search-linked-create')
  await dialog.getByRole('button', { name: '确认发起整色替换', exact: true }).click()

  dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('成衣替换-0004')
  await expect(dialog).toContainText('PO-202603-0001')
  await expect(dialog).toContainText('SKU-015-M-WHT')
  await expect(dialog).toContainText('瑕疵迁移与追溯')
  await expect(dialog).toContainText('tshirt-sample.jpg')
  await expect(dialog.getByRole('link', { name: '打印新条码', exact: true })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '打印新吊牌', exact: true })).toBeVisible()
  await screenshot(page, 'garment-spu-replacement-full-flow-03-created-detail')

  const barcodeHref = await dialog.getByRole('link', { name: '打印新条码', exact: true }).getAttribute('href')
  const hangtagHref = await dialog.getByRole('link', { name: '打印新吊牌', exact: true }).getAttribute('href')
  expect(barcodeHref).toContain('documentType=GARMENT_SKU_BARCODE')
  expect(hangtagHref).toContain('documentType=GARMENT_HANGTAG')

  const printPage = await context.newPage()
  printPage.on('console', collectConsoleError)
  await printPage.goto(barcodeHref || '', { waitUntil: 'domcontentloaded' })
  await expect(printPage.locator('body')).toContainText('HG 出货条码')
  await expect(printPage.locator('body')).toContainText('SKU-015-M-WHT')
  await printPage.goto(hangtagHref || '', { waitUntil: 'domcontentloaded' })
  await expect(printPage.locator('body')).toContainText('成衣吊牌打印预览')
  await expect(printPage.locator('body')).toContainText('SKU-015-M-WHT')
  await printPage.close()

  await dialog.getByRole('button', { name: '确认后道工厂在手成衣已全部换码', exact: true }).click()
  dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('后道工厂在手成衣已换码，可继续交出')

  const warehouseReplacementRoot = await openPath(page, WLS_REPLACEMENT_PATH, '[data-garment-spu-replacement-root]')
  await expectMenuIcon(page, '成衣 SPU 替换')
  await expectNoDocumentOverflow(page)
  await expect(warehouseReplacementRoot).toContainText('成衣替换-0004')

  const taskRoot = await openPath(page, WLS_RELABEL_TASK_PATH, '[data-wls-garment-relabel-root]')
  await expectMenuIcon(page, '成衣仓换码任务')
  await expectNoDocumentOverflow(page)
  await expect(taskRoot).toContainText('成衣仓换码-0001')
  await expect(taskRoot).toContainText('成衣仓换码-0002')
  await expect(taskRoot).toContainText('成衣仓换码-0003')
  await expect(taskRoot).toContainText('成衣仓换码-0004')

  const taskRow = page.locator('tr').filter({ hasText: '成衣仓换码-0004' })
  await expect(taskRow).toBeVisible()
  await taskRow.getByRole('button', { name: '详情', exact: true }).click()
  dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('成衣仓未售成衣换码')
  await expect(dialog).toContainText('旧 SKU 出库 → 打印并更换新条码和新吊牌 → 新 SKU 入库')
  await expect(dialog).toContainText('FIN-IN-PO2026030001-M-01')
  await expect(dialog).toContainText('SKU-004-M-WHT')
  await expect(dialog).toContainText('SKU-015-M-WHT')
  await expect(dialog.getByRole('link', { name: '打印新条码', exact: true })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '打印新吊牌', exact: true })).toBeVisible()
  await screenshot(page, 'garment-spu-replacement-full-flow-04-warehouse-task-pending')

  await dialog.getByRole('button', { name: '开始换码', exact: true }).click()
  dialog = page.getByRole('dialog').first()
  await expect(dialog.getByText('换码中', { exact: true })).not.toHaveCount(0)
  await dialog.getByRole('button', { name: '确认全部完成旧出新入', exact: true }).click()
  dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('旧出新入已完成')
  const movementRows = dialog.getByRole('heading', { name: '库存流水', exact: true }).locator('..').locator('tbody tr')
  await expect(movementRows).toHaveCount(8)
  await expect(movementRows.filter({ hasText: '旧 SKU 出库' })).toHaveCount(4)
  await expect(movementRows.filter({ hasText: '新 SKU 入库' })).toHaveCount(4)
  await screenshot(page, 'garment-spu-replacement-full-flow-05-warehouse-task-completed')

  const finalReplacementRoot = await openPath(page, FCS_REPLACEMENT_PATH, '[data-garment-spu-replacement-root]')
  const finalRow = page.locator('tr').filter({ hasText: '成衣替换-0004' })
  await expect(finalRow).toContainText('已完成')
  await finalRow.getByRole('button', { name: '详情', exact: true }).click()
  dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('后道工厂在手成衣已换码，可继续交出')
  await expect(finalReplacementRoot).toContainText('全流程验收：第二批回货发现整色质量问题')

  await page.goto(PRODUCTION_ORDER_PATH, { waitUntil: 'domcontentloaded' })
  await expectNoDocumentOverflow(page)
  const productionRow = page.locator('tr').filter({ hasText: 'PO-202603-0001' }).first()
  await expect(productionRow).toBeVisible()
  await expect(productionRow).toContainText('当前成衣构成（原生产需求不变）')
  await expect(productionRow).toContainText('SPU-2024-004：1,250 件历史已售')
  await expect(productionRow).toContainText('SPU-2024-015：3,750 件当前／后续成衣')
  await expect(productionRow.getByText('打印条码', { exact: true })).toBeVisible()
  await expect(productionRow.getByText('打印吊牌', { exact: true })).toBeVisible()
  await screenshot(page, 'garment-spu-replacement-full-flow-06-production-order-ledger')
  expect(consoleErrors).toEqual([])
})
