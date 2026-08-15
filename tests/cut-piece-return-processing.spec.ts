import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const route = '/fcs/craft/cutting/cut-piece-return-processing'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.addInitScript(() => {
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v1')
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v2')
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v3')
    localStorage.removeItem('higood:list-page:/fcs/craft/cutting/cut-piece-return-processing')
    localStorage.removeItem('higood:list-page:/fcs/craft/cutting/supplement-management')
    localStorage.removeItem('higood:list-page:/fcs/craft/cutting/cut-orders')
  })
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: [document.body.scrollWidth, document.body.clientWidth],
    document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
  }))
  expect(overflow.body[0]).toBe(overflow.body[1])
  expect(overflow.document[0]).toBe(overflow.document[1])
}

async function closeReturnDialog(page: Page): Promise<void> {
  const dialog = page.locator('[data-cut-piece-return-dialog]')
  await dialog.locator('header').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

test('裁片退仓从发起到补料来源、原裁片单关联和大菲票形成完整可见闭环', async ({ page }) => {
  test.setTimeout(180_000)
  mkdirSync('output/playwright', { recursive: true })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(route)

  await expect(page.getByRole('heading', { name: '裁片退仓处理' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await expect(page.locator('[data-standard-list-table-section] table')).toBeVisible()
  await expect(page.locator('[data-cut-piece-return-pagination]')).toContainText(/共 \d+ 条/)
  const menuItem = page.getByRole('complementary').getByRole('button', { name: '裁片退仓处理', exact: true })
  await expect(menuItem).toBeVisible()
  await expect(menuItem.locator('svg')).toHaveCount(1)
  const warehouseActionBox = await page.locator('[data-nav="/fcs/craft/cutting/warehouse-management/wait-handover"]', { hasText: '查看退裁片库区' }).boundingBox()
  const createActionBox = await page.getByRole('button', { name: '新增退仓', exact: true }).boundingBox()
  expect(warehouseActionBox).not.toBeNull()
  expect(createActionBox).not.toBeNull()
  expect(createActionBox!.x).toBeGreaterThan(warehouseActionBox!.x)
  await expectNoPageOverflow(page)

  const visibleImages = page.locator('[data-cut-piece-return-page] img:visible')
  await expect(visibleImages.first()).toBeVisible()
  await expect.poll(() => visibleImages.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  const firstImageButton = page.locator('[data-cut-piece-return-action="preview-image"]').first()
  await firstImageButton.click()
  await expect(page.locator('[data-cut-piece-return-image-preview]')).toBeVisible()
  await expect.poll(() => page.locator('[data-cut-piece-return-image-preview] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-cut-piece-return-image-preview]')).toHaveCount(0)

  const imageUnderFailureTest = page.locator('[data-cut-piece-return-page] img').first()
  await imageUnderFailureTest.evaluate((image: HTMLImageElement) => { image.src = '/materials/does-not-exist-for-return-test.png' })
  await expect(page.getByText('图片加载失败', { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '裁片退仓处理' })).toBeVisible({ timeout: 60_000 })

  await page.getByRole('button', { name: '新增退仓' }).click()
  const createDialog = page.locator('[data-cut-piece-return-dialog]')
  await expect(createDialog.getByRole('heading', { name: '新增裁片退仓' })).toBeVisible()
  await expect(createDialog.getByText('请先精确查找车缝任务，不展示全量交出候选。')).toBeVisible()
  await expect(createDialog.locator('input[name="cut-piece-return-candidate"]')).toHaveCount(0)

  await createDialog.getByRole('button', { name: '生产单 + 车缝工厂' }).click()
  await createDialog.locator('[data-cut-piece-return-form="lookupProductionOrderNo"]').fill('PO-202603-0101')
  await createDialog.getByRole('button', { name: '查询承接工厂' }).click()
  await expect(createDialog.locator('[data-cut-piece-return-form="lookupFactoryId"]')).toContainText('PT Indo Sewing Center')
  await createDialog.getByRole('button', { name: '查找车缝任务' }).click()
  await expect(createDialog.getByText('任务 ST-260324-001 · PO-202603-0101')).toBeVisible()

  await createDialog.getByRole('button', { name: '菲票号' }).click()
  await createDialog.locator('[data-cut-piece-return-form="lookupFeiTicketNo"]').fill('FT-260324-001')
  await createDialog.getByRole('button', { name: '查找车缝任务' }).click()
  await expect(createDialog.getByText('通过菲票 FT-260324-001 找到任务；该查找不代表本次实物票在场。')).toBeVisible()

  await createDialog.getByRole('button', { name: '车缝任务单号' }).click()
  await createDialog.locator('[data-cut-piece-return-form="lookupSewingTaskNo"]').fill('ST-260324-001')
  await createDialog.getByRole('button', { name: '查找车缝任务' }).click()
  await expect(createDialog.locator('input[name="cut-piece-return-candidate"]:checked')).toHaveCount(1)
  await expect(createDialog.getByText('首次责任 200 件 · 历史退件 12 件 · 当前可退 188 件')).toBeVisible()
  await expect.poll(() => createDialog.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await page.screenshot({ path: 'output/playwright/cut-piece-return-exact-source-and-limits.png', fullPage: true })

  const initialCaseCount = await page.evaluate(async () => (await import('/src/data/fcs/cutting/cut-piece-return-domain.ts')).listCutPieceReturnCases().length)
  const returnedGarmentInput = createDialog.locator('[data-cut-piece-return-form="createReturnedGarmentQty"]')
  const receiveRows = createDialog.locator('[data-cut-piece-return-create-row]')
  const receiveRowCount = await receiveRows.count()
  expect(receiveRowCount).toBeGreaterThan(0)
  await returnedGarmentInput.fill('189')
  await createDialog.getByRole('button', { name: '确认退件并入退裁片库区' }).click()
  await expect(createDialog.getByRole('status')).toContainText('超过当前应回 188 件')
  expect(await page.evaluate(async () => (await import('/src/data/fcs/cutting/cut-piece-return-domain.ts')).listCutPieceReturnCases().length)).toBe(initialCaseCount)

  await returnedGarmentInput.fill('2')
  const firstPartInput = receiveRows.first().locator('[data-cut-piece-return-part-count]')
  const firstPartMaximum = Number(await firstPartInput.getAttribute('max'))
  await firstPartInput.fill(String(firstPartMaximum + 1))
  await createDialog.getByRole('button', { name: '确认退件并入退裁片库区' }).click()
  await expect(createDialog.getByRole('status')).toContainText(`超过当前可退 ${firstPartMaximum} 片`)
  expect(await page.evaluate(async () => (await import('/src/data/fcs/cutting/cut-piece-return-domain.ts')).listCutPieceReturnCases().length)).toBe(initialCaseCount)

  for (let index = 0; index < receiveRowCount; index += 1) {
    await receiveRows.nth(index).locator('[data-cut-piece-return-part-count]').fill(index === 1 ? '1' : '2')
  }
  await receiveRows.first().locator('[data-cut-piece-return-evidence-mode]').selectOption('SCAN')
  await receiveRows.first().locator('[data-cut-piece-return-scanned-ticket]').fill('TI-WRONG')
  if (receiveRowCount > 1) await receiveRows.nth(1).locator('[data-cut-piece-return-evidence-mode]').selectOption('MANUAL_UNREADABLE')
  await createDialog.getByRole('button', { name: '确认退件并入退裁片库区' }).click()
  await expect(createDialog.getByRole('status')).toContainText('与冻结来源不匹配')
  expect(await page.evaluate(async () => (await import('/src/data/fcs/cutting/cut-piece-return-domain.ts')).listCutPieceReturnCases().length)).toBe(initialCaseCount)
  const expectedTicketNo = await receiveRows.first().locator('[data-cut-piece-return-scanned-ticket]').getAttribute('placeholder')
  expect(expectedTicketNo).toBeTruthy()
  await receiveRows.first().locator('[data-cut-piece-return-scanned-ticket]').fill(expectedTicketNo || '')
  await expect(receiveRows.first().locator('[data-cut-piece-return-scanned-ticket]')).toHaveValue(expectedTicketNo || '')
  await createDialog.getByRole('button', { name: '关闭提示' }).click()
  await expect(createDialog.getByRole('status')).toHaveCount(0)
  await createDialog.getByRole('button', { name: '确认退件并入退裁片库区' }).click()

  const createFeedback = await createDialog.getByRole('status').innerText()
  const returnOrderNo = createFeedback.match(/TH-\d{6}-\d{3}/)?.[0] || ''
  expect(returnOrderNo).not.toBe('')
  expect(await page.evaluate(async () => (await import('/src/data/fcs/cutting/cut-piece-return-domain.ts')).listCutPieceReturnCases().length)).toBe(initialCaseCount + 1)
  await expect(page.getByRole('heading', { name: new RegExp(returnOrderNo) })).toBeVisible()
  await expect(page.getByText(`已扫码 · ${expectedTicketNo}`, { exact: true })).toBeVisible()
  if (receiveRowCount > 1) await expect(page.getByText('票据不可识别 · 手动选部位', { exact: true })).toBeVisible()
  await expect(page.getByText(/按件确认 2 件/).first()).toBeVisible()
  await page.screenshot({ path: 'output/playwright/cut-piece-return-atomic-confirmed.png', fullPage: true })
  await closeReturnDialog(page)

  const receivedRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: returnOrderNo })
  await receivedRow.getByRole('button', { name: '快速打大菲票' }).click()
  const ticketDialog = page.locator('[data-cut-piece-return-dialog]')
  await expect(ticketDialog.getByRole('heading', { name: '快速确认部位并生成退裁片大菲票' })).toBeVisible()
  await expect(ticketDialog.getByText('旧实物菲票缺失是正常现场场景')).toBeVisible()
  await ticketDialog.getByRole('button', { name: '全选可用部位' }).click()
  await expect(ticketDialog.locator('[data-cut-piece-return-ticket-part]:checked')).toHaveCount(receiveRowCount)
  await ticketDialog.getByRole('button', { name: '生成大菲票' }).click()

  const printSheet = page.locator('[data-cut-piece-return-print-sheet]')
  await expect(printSheet).toBeVisible()
  await expect(page.getByText('固定 100mm × 100mm')).toBeVisible()
  const printSize = await printSheet.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  expect(Math.abs(printSize.width - printSize.height)).toBeLessThanOrEqual(1)
  expect(printSize.width).toBeGreaterThan(370)
  expect(printSize.width).toBeLessThan(385)
  await expect(printSheet.locator('[data-real-qr] svg[role="img"]')).toBeVisible()
  await page.screenshot({ path: 'output/playwright/cut-piece-return-large-ticket-100mm.png', fullPage: true })
  await closeReturnDialog(page)

  await page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: returnOrderNo }).getByRole('button', { name: '详情' }).click()
  const detailDialog = page.locator('[data-cut-piece-return-dialog]')
  await detailDialog.getByRole('button', { name: '创建补料并结算' }).click()
  const supplementDialog = page.locator('[data-cut-piece-return-dialog]')
  await expect(supplementDialog.getByRole('heading', { name: '创建车缝退仓补料' })).toBeVisible()
  await expect(supplementDialog.getByText('不受之前清点数量限制')).toBeVisible()
  await supplementDialog.locator('[data-cut-piece-return-form="finalMakeupGarmentQty"]').fill('25')
  const supplementCounts = supplementDialog.locator('[data-cut-piece-return-supplement-count]')
  for (let index = 0; index < await supplementCounts.count(); index += 1) {
    await supplementCounts.nth(index).fill(String(7 + index))
  }
  await supplementDialog.getByRole('button', { name: '创建补料单并结算退仓' }).click()

  await expect(detailDialog.getByRole('status')).toContainText('本退仓单已结算')
  await expect(page.getByText('退仓处理已结算')).toBeVisible()
  await expect(detailDialog.getByText(/最终补：25 件/)).toBeVisible()
  const supplementLink = page.locator('[data-cut-piece-return-dialog] a').filter({ hasText: /^SUP-RETURN-/ }).first()
  const supplementOrderNo = (await supplementLink.innerText()).split(/\s/)[0]
  expect(supplementOrderNo).toMatch(/^SUP-RETURN-/)
  await supplementLink.click()

  const supplementDetail = page.locator('[data-cutting-supplement-region="overlay"]')
  await expect(supplementDetail.getByRole('heading', { name: '补料单详情' })).toBeVisible({ timeout: 60_000 })
  await expect(supplementDetail).toContainText('业务来源')
  await expect(supplementDetail).toContainText('车缝退仓')
  await expect(supplementDetail).toContainText(returnOrderNo)
  await expect(supplementDetail).toContainText('本补料单绑定原裁片单')
  await expect(supplementDetail).toContainText('可复用裁片')
  const linkedCutOrderNo = await page.evaluate(async (recordNo) => {
    const registry = await import('/src/data/fcs/cutting/supplement-order-registry.ts')
    return registry.listSupplementOrders().find((order) => order.recordNo === recordNo)?.cutOrderNo || ''
  }, supplementOrderNo)
  expect(linkedCutOrderNo).not.toBe('')
  await page.screenshot({ path: 'output/playwright/sewing-return-supplement-detail.png', fullPage: true })
  await supplementDetail.getByRole('button', { name: '关闭', exact: true }).click()

  await page.locator('[data-cutting-supplement-field="businessSourceType"]').selectOption('SEWING_RETURN')
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  const sourceColumnIndex = await page.locator('[data-standard-list-table-section] thead th').evaluateAll((headers) =>
    headers.findIndex((header) => header.getAttribute('data-column-key') === 'businessSource'),
  )
  expect(sourceColumnIndex).toBeGreaterThanOrEqual(0)
  const supplementRows = page.locator('[data-standard-list-table-section] tbody tr')
  await expect(supplementRows).not.toHaveCount(0)
  await expect.poll(() => supplementRows.locator(`td:nth-child(${sourceColumnIndex + 1})`).evaluateAll((cells) =>
    cells.every((cell) => cell.textContent?.includes('车缝退仓')),
  )).toBe(true)

  await page.getByRole('button', { name: '裁前准备', exact: true }).click()
  await page.getByRole('complementary').getByRole('button', { name: '裁片单', exact: true }).click()
  await expect(page.getByRole('heading', { name: '裁片单', exact: true })).toBeVisible({ timeout: 60_000 })
  await page.locator('[data-cutting-piece-field="keyword"]').fill(linkedCutOrderNo)
  const cutOrderRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: linkedCutOrderNo })
  await expect(cutOrderRow).toHaveCount(1)
  await expect(cutOrderRow).toContainText('车缝退仓补料')
  await cutOrderRow.locator('button[data-cutting-piece-action="open-supplement-detail"]').filter({ hasText: '25 件' }).click()
  const cutOrderSupplementDetail = page.locator('[data-cutting-piece-supplement-detail]')
  await expect(cutOrderSupplementDetail).toContainText('业务来源')
  await expect(cutOrderSupplementDetail).toContainText('车缝退仓')
  await expect(cutOrderSupplementDetail).toContainText(returnOrderNo)
  await expect(cutOrderSupplementDetail).toContainText('来源交出记录')
  await page.screenshot({ path: 'output/playwright/cut-order-sewing-return-supplement.png', fullPage: true })

  await page.setViewportSize({ width: 1280, height: 720 })
  await expectNoPageOverflow(page)
})
