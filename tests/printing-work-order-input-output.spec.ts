import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const LIST_PATH = '/fcs/craft/printing/work-orders'
const DETAIL_PATH = '/fcs/craft/printing/work-orders/PWO-PRINT-002'
const EVIDENCE_DIR = '/private/tmp/higoods-printing-acceptance'

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text())
  })
  return errors
}

function printPreviewPath(documentType: string, sourceType: string, sourceId: string): string {
  return `/fcs/print/preview?${new URLSearchParams({ documentType, sourceType, sourceId }).toString()}`
}

test.beforeAll(() => mkdirSync(EVIDENCE_DIR, { recursive: true }))

test('印花加工单列表显示来源、投入产出与状态，并保持筛选和图片操作可用', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(LIST_PATH)
  const root = page.locator('[data-printing-work-orders-root]')
  await expect(root).toBeVisible({ timeout: 30_000 })
  for (const name of ['综合查询', '接收状态', '加工状态', '交出状态', '加工厂']) {
    await expect(root.getByText(name, { exact: true }).first()).toBeVisible()
  }
  for (const key of ['selection', 'order', 'input', 'requirement', 'progress', 'output', 'time', 'quantity', 'actions']) {
    await expect(root.locator(`th[data-column-key="${key}"]`)).toBeVisible()
  }
  await expect(root.locator('tbody tr')).toHaveCount(10)
  await expect(root).toContainText('需求来源：')
  await expect(root).toContainText('加工产出')
  await expect(root.locator('th[data-column-key="order"]')).toHaveCSS('position', 'sticky')
  await expect(root.locator('th[data-column-key="actions"]')).toHaveCSS('position', 'sticky')

  await root.getByRole('button', { name: '更多筛选' }).click()
  const demandSource = root.locator('[data-printing-work-orders-field="demandSource"]')
  await expect(demandSource).toBeVisible()
  await demandSource.selectOption('STOCK')
  await root.getByRole('button', { name: '查询', exact: true }).click()
  const stockRows = root.locator('tbody tr')
  expect(await stockRows.count()).toBeGreaterThan(0)
  for (const row of await stockRows.all()) await expect(row).toContainText('备货')
  await root.getByRole('button', { name: '重置', exact: true }).click()
  await expect(root.locator('tbody tr')).toHaveCount(10)

  await root.getByRole('button', { name: '列设置', exact: true }).click()
  await expect(root.locator('[data-standard-list-column-key="selection"]')).toBeVisible()
  await root.getByRole('button', { name: '关闭', exact: true }).click()

  await root.locator('[data-pda-image-preview-url]').first().click()
  const imageOverlay = page.locator('[data-pda-image-preview-root] [role="dialog"]')
  await expect(imageOverlay).toBeVisible()
  const largeImage = imageOverlay.locator('img')
  await expect.poll(() => largeImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(imageOverlay).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-printing-list-1366.png`, fullPage: true })
  expect(runtimeErrors).toEqual([])
})

test('直接数量加工投入调整保留产出 SKU，并引导到待接收页', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(DETAIL_PATH)
  const root = page.locator('[data-printing-work-order-detail-root]')
  await expect(root).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: '印花加工单 PH-20260328-002', exact: true })).toBeVisible()

  for (const section of [
    '1. 基本信息', '2. 加工投入／上游', '3. 加工要求',
    '4. 加工记录', '5. 加工产出／下游', '6. 日志与单据',
  ]) await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()

  const outputSku = 'FAB-P200-BLUE-FLORAL'
  await expect(root).toContainText(outputSku)
  await root.getByRole('button', { name: '调整加工投入', exact: true }).first().click()
  const changeDialog = page.getByRole('dialog', { name: '调整加工投入' })
  await expect(changeDialog).toBeVisible()
  for (const label of ['对象类型', '新投入 SKU', '新面料名称', '面料图片', '克重（g/㎡）', '幅宽（cm）', '标准单位用量', '加工单单位用量', '变更原因']) {
    await expect(changeDialog.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(changeDialog.locator('[data-printing-dialog-field="newPlannedQty"]')).toBeVisible()

  await expect(changeDialog).toContainText('直接数量模式不使用单位用量')
  await changeDialog.locator('[data-printing-dialog-field="newSku"]').fill('FAB-P200-WHITE')
  await changeDialog.locator('[data-printing-dialog-field="newMaterialName"]').fill('本白棉府绸')
  await changeDialog.locator('[data-printing-dialog-field="newGsm"]').fill('90')
  await changeDialog.locator('[data-printing-dialog-field="newWidthCm"]').fill('155')
  await changeDialog.locator('[data-printing-dialog-field="newPlannedQty"]').fill('110')
  await changeDialog.locator('[data-printing-dialog-field="reason"]').fill('现场跨规格换料验收')
  await changeDialog.getByRole('button', { name: '确认调整', exact: true }).click()
  await expect(changeDialog).toHaveCount(0)
  await expect(root).toContainText('110.00 Yard')
  await expect(root).toContainText('实际 SKU：尚未接收')
  await expect(root).toContainText(outputSku)
  await expect(root).toContainText('加工资料已变更，信息单/确认单需重印')
  await expect(root).toContainText('跨规格')
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-printing-input-changed.png`, fullPage: true })

  await root.getByRole('button', { name: '查看待接收', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/pending-receipts\?workOrderId=PWO-PRINT-002/)
  expect(runtimeErrors).toEqual([])
})

test('下游组织与目标仓库缺失时交出列表阻断建单', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-005')
  const root = page.locator('[data-printing-work-order-detail-root]')
  await expect(root).toBeVisible({ timeout: 30_000 })
  await root.locator('[data-printing-action="handover"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/pending-handover\?workOrderId=PWO-PRINT-005/)
  await expect(page.getByRole('heading', { name: '印花待交出列表' })).toBeVisible()
  await expect(page.getByText('请先补齐下游组织与目标仓库')).toBeVisible()
  await expect(page.getByRole('button', { name: '批量生成交出单' })).toBeDisabled()
  expect(runtimeErrors).toEqual([])
})

test('印花信息单、印花确认单、批量确认单和加工产出卷条码均可预览打印', async ({ page }) => {
  test.setTimeout(120_000)
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto(printPreviewPath('PRINTING_INFO_SHEET', 'PRINTING_WORK_ORDER', 'PWO-PRINT-002'))
  await expect(page.getByRole('heading', { name: '印花信息单打印预览' })).toBeVisible({ timeout: 30_000 })
  for (const text of ['Printing order', 'Requirement / Need', 'Fabric', 'Fabric SKU', 'Purchase Order (PO)', 'PO14673']) {
    await expect(page.locator('[data-printing-info="PWO-PRINT-002"]')).toContainText(text)
  }
  await expect(page.getByRole('button', { name: '下载 PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '打印', exact: true })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE_DIR}/04-printing-info-sheet.png`, fullPage: true })

  await page.goto(printPreviewPath('PRINTING_CONFIRMATION', 'PRINTING_WORK_ORDER', 'PWO-PRINT-008'))
  await expect(page.getByRole('heading', { name: '印花确认单打印预览' })).toBeVisible({ timeout: 30_000 })
  for (const text of ['Print confirmation', 'Pattern transfer', 'Storage time', 'Remark', '面料 SKU']) {
    await expect(page.locator('[data-printing-confirmation="PWO-PRINT-008"]')).toContainText(text)
  }
  await expect(page.locator('[data-printing-confirmation="PWO-PRINT-008"]')).toContainText('Edit confirmation')
  await page.screenshot({ path: `${EVIDENCE_DIR}/05-printing-confirmation.png`, fullPage: true })

  await page.goto(printPreviewPath('PRINTING_CONFIRMATION', 'PRINTING_WORK_ORDER', 'PWO-PRINT-001,PWO-PRINT-002'))
  await expect(page.locator('body')).toContainText('PH-20260328-001', { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('PH-20260328-002')
  await expect(page.locator('article')).toHaveCount(2)

  await page.goto(printPreviewPath('PRINTING_ROLL_LABEL', 'PRINTING_ROLL_RECORD', 'PWO-PRINT-008:ROLL-PH-20260329-008-0001'))
  await expect(page.getByRole('heading', { name: '加工产出卷条码打印预览', exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('印花加工产出卷', { exact: true }).first()).toBeVisible()
  for (const text of ['产出 SKU', '数量', '理论重量', '克重/幅宽', '缸号', '入库仓库', '备注']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  }
  await expect(page.locator('body')).toContainText(/\d+\.\d{2} 米/)
  await expect(page.locator('body')).toContainText(/\d+\.\d{3} KG/)
  await page.screenshot({ path: `${EVIDENCE_DIR}/06-printing-roll-label.png`, fullPage: true })
  expect(runtimeErrors).toEqual([])
})
