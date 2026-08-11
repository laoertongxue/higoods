import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const LIST_PATH = '/fcs/craft/printing/work-orders'
const DETAIL_PATH = '/fcs/craft/printing/work-orders/PWO-25336'
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

test('印花加工单列表完整保留线上信息并按投入、来源、产出和双状态重组', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(LIST_PATH)
  const root = page.locator('[data-printing-work-orders-root]')
  await expect(root).toBeVisible()
  await expect(page.getByRole('heading', { name: '印花加工单', exact: true })).toBeVisible()

  for (const text of [
    '综合查询', '加工状态', '交出状态', '需求来源', '历史状态', '售卖类型', '加工厂', '工艺', '接收人',
    '物料类型', '是否换料', '是否历史补料', '创建方式', '差异/异议', '时间类型',
  ]) await expect(root.getByText(text, { exact: true }).first()).toBeVisible()
  const stats = root.locator('[data-printing-work-orders-stats-surface]')
  for (const text of ['印花加工单数量', '计划投入', '实际使用', '完成', '已交出', '已接收']) {
    await expect(stats.getByText(text, { exact: true })).toBeVisible()
  }
  const summaryItems = stats.locator('[data-printing-summary-item]')
  await expect(summaryItems).toHaveCount(6)
  const summaryItemTops = await summaryItems.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)))
  expect(new Set(summaryItemTops).size).toBe(1)

  for (const header of ['印花加工单', '商品信息', '需求来源', '加工投入', '印花要求', '加工产出', '数量进度', '加工厂/时间', '加工状态', '交出状态', '打印信息', '备注', '操作']) {
    await expect(root.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible()
  }
  await expect(root).not.toContainText('采购单数量')
  await expect(root).not.toContainText('待回写')
  await expect(root.getByRole('button', { name: '印花信息单', exact: true }).first()).toBeVisible()
  await expect(root.getByRole('button', { name: '印花确认单', exact: true }).first()).toBeVisible()
  await expect(root.getByRole('button', { name: '产出卷条码', exact: true }).first()).toBeVisible()
  await expect(root).not.toContainText('打印任务流转卡')

  const scrollSurface = root.locator('[data-standard-list-scroll]')
  const orderHeader = root.locator('th[data-column-key="order"]')
  const inputHeader = root.locator('th[data-column-key="input"]')
  const outputHeader = root.locator('th[data-column-key="output"]')
  const actionsHeader = root.locator('th[data-column-key="actions"]')
  await expect(orderHeader).toHaveCSS('position', 'sticky')
  await expect(actionsHeader).toHaveCSS('position', 'sticky')
  await expect(inputHeader).not.toHaveCSS('position', 'sticky')
  await expect(outputHeader).not.toHaveCSS('position', 'sticky')
  const actionHeaderBox = await actionsHeader.boundingBox()
  expect(actionHeaderBox).toBeTruthy()
  expect(actionHeaderBox!.width).toBeLessThanOrEqual(191)

  const positionsBeforeScroll = await Promise.all([orderHeader, inputHeader, actionsHeader].map(async (header) => (await header.boundingBox())!.x))
  await scrollSurface.evaluate((element) => {
    element.scrollLeft = 700
    element.dispatchEvent(new Event('scroll'))
  })
  const positionsAfterScroll = await Promise.all([orderHeader, inputHeader, actionsHeader].map(async (header) => (await header.boundingBox())!.x))
  expect(Math.abs(positionsAfterScroll[0] - positionsBeforeScroll[0])).toBeLessThanOrEqual(1)
  expect(positionsAfterScroll[1]).toBeLessThan(positionsBeforeScroll[1] - 500)
  expect(Math.abs(positionsAfterScroll[2] - positionsBeforeScroll[2])).toBeLessThanOrEqual(1)

  const firstRowActions = root.locator('[data-printing-row-actions]').first()
  await expect(firstRowActions).toHaveCSS('display', 'grid')
  const actionGridColumns = await firstRowActions.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length)
  expect(actionGridColumns).toBe(2)
  const rowActionButtons = firstRowActions.locator('[data-printing-row-action]')
  expect(await rowActionButtons.count()).toBeGreaterThanOrEqual(4)
  const actionRows = await rowActionButtons.evaluateAll((items) => items.reduce<Record<string, number>>((groups, item) => {
    const top = String(Math.round(item.getBoundingClientRect().top))
    groups[top] = (groups[top] || 0) + 1
    return groups
  }, {}))
  expect(Math.max(...Object.values(actionRows))).toBeLessThanOrEqual(2)
  for (const action of await rowActionButtons.all()) await expect(action).toHaveCSS('border-top-width', '0px')

  await root.locator('[data-printing-work-orders-field="demandSource"]').selectOption('PURCHASE')
  await root.getByRole('button', { name: '查询', exact: true }).click()
  const filteredRows = root.locator('[data-standard-list-table-section] tbody tr')
  await expect(filteredRows).toHaveCount(1)
  await expect(filteredRows.first()).toContainText('采购')
  await root.getByRole('button', { name: '重置', exact: true }).click()
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(6)

  const openStartedAt = await page.evaluate(() => performance.now())
  await root.locator('[data-printing-action="preview-image"]').first().click()
  const imageOverlay = page.locator('[data-printing-image-preview]')
  await expect(imageOverlay).toBeVisible()
  const openElapsed = await page.evaluate((startedAt) => performance.now() - startedAt, openStartedAt)
  expect(openElapsed).toBeLessThan(200)
  const largeImage = imageOverlay.locator('img')
  await expect(largeImage).toBeVisible()
  await expect.poll(() => largeImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  const imageBox = await largeImage.boundingBox()
  expect(imageBox).toBeTruthy()
  expect(imageBox!.width).toBeLessThanOrEqual(1366)
  expect(imageBox!.height).toBeLessThanOrEqual(768)
  await page.keyboard.press('Escape')
  await expect(imageOverlay).toHaveCount(0)
  await expect(root).toBeVisible()

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(pageOverflow).toBeLessThanOrEqual(1)
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-printing-list-1366.png`, fullPage: true })
  expect(runtimeErrors).toEqual([])
})

test('加工投入调整保留单位用量、阻断跨规格漏填，并保持产出 SKU 不变', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(DETAIL_PATH)
  const root = page.locator('[data-printing-work-order-detail-root]')
  await expect(root).toBeVisible()
  await expect(page.getByRole('heading', { name: '印花加工单 YH25336', exact: true })).toBeVisible()

  for (const section of [
    '1. 需求来源', '2. 用量依据', '3. 计划加工投入与实际加工投入', '4. 投入调整历史',
    '5. 印花要求', '6. 固定加工产出', '7. 数量与卷数', '8. 加工厂与执行时间',
    '9. 交出与接收', '10. 加工产出卷条码', '11. 打印历史', '12. 操作日志与备注',
  ]) await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()

  const outputSku = 'CNIDML009-ge001103'
  await expect(root).toContainText(outputSku)
  await root.getByRole('button', { name: '调整加工投入', exact: true }).first().click()
  const changeDialog = page.getByRole('dialog', { name: '调整加工投入' })
  await expect(changeDialog).toBeVisible()
  for (const label of ['对象类型', '新投入 SKU', '新面料名称', '面料图片', '克重（g/㎡）', '幅宽（cm）', '标准单位用量', '加工单单位用量', '直接计划投入（Yard）', '变更原因']) {
    await expect(changeDialog.getByText(label, { exact: true })).toBeVisible()
  }

  await changeDialog.locator('[data-printing-dialog-field="newSku"]').fill('CNIDML009-REPLACE-220G')
  await changeDialog.locator('[data-printing-dialog-field="newMaterialName"]').fill('替代规格白胚面料 220g')
  await changeDialog.locator('[data-printing-dialog-field="newImageUrl"]').selectOption('/materials/fabric-lining.jpg')
  await changeDialog.locator('[data-printing-dialog-field="newGsm"]').fill('240')
  await changeDialog.locator('[data-printing-dialog-field="newWidthCm"]').fill('170')
  await changeDialog.locator('[data-printing-dialog-field="newStandardUnitUsage"]').fill('1.4800')
  await changeDialog.locator('[data-printing-dialog-field="newOrderUnitUsage"]').fill('')
  await changeDialog.locator('[data-printing-dialog-field="reason"]').fill('现场跨规格换料验收')
  await changeDialog.getByRole('button', { name: '确认调整', exact: true }).click()
  await expect(page.getByText('跨规格换料必须重新确认加工单单位用量', { exact: true })).toBeVisible()
  await expect(changeDialog).toBeVisible()

  await changeDialog.locator('[data-printing-dialog-field="newOrderUnitUsage"]').fill('1.5000')
  await changeDialog.getByRole('button', { name: '确认调整', exact: true }).click()
  await expect(changeDialog).toHaveCount(0)
  await expect(root).toContainText('CNIDML009-REPLACE-220G')
  await expect(root).toContainText('实际 SKU：未接收')
  await expect(root).toContainText(outputSku)
  await expect(root).toContainText('投入已变更，信息单/确认单需重印')
  await expect(root).toContainText('跨规格')
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-printing-input-changed.png`, fullPage: true })

  await root.getByRole('button', { name: '接收加工投入', exact: true }).click()
  const receiveDialog = page.getByRole('dialog', { name: '接收加工投入' })
  await expect(receiveDialog.locator('[data-printing-dialog-field="actualSku"]')).toHaveValue('CNIDML009-REPLACE-220G')
  await expect(receiveDialog.locator('[data-printing-dialog-field="receivedQty"]')).not.toHaveValue('0.00')
  await receiveDialog.locator('[data-printing-dialog-field="receivedRollCount"]').fill('3')
  await receiveDialog.getByRole('button', { name: '确认接收', exact: true }).click()
  await expect(root).toContainText('加工中')

  await root.getByRole('button', { name: '填报加工完成', exact: true }).click()
  const completeDialog = page.getByRole('dialog', { name: '填报加工完成' })
  for (const label of ['累计实际使用（Yard）', '实际使用卷数', '完成数量（Yard）', '完成卷数', '打印机']) {
    await expect(completeDialog.getByText(label, { exact: true })).toBeVisible()
  }
  await completeDialog.locator('[data-printing-dialog-field="usedRollCount"]').fill('3')
  await completeDialog.locator('[data-printing-dialog-field="completedRollCount"]').fill('3')
  await completeDialog.getByRole('button', { name: '确认加工完成', exact: true }).click()
  await expect(root).toContainText('加工完成')
  await expect(root).toContainText('待交出')

  await root.locator('[data-printing-action="open-barcodes"]').first().click()
  const barcodeDialog = page.getByRole('dialog', { name: '加工产出卷条码' })
  await expect(barcodeDialog).toBeVisible()
  for (const header of ['条码', '关联单号', 'SKU', '状态', '卷号', '卷长(Y)', '重量(KG)', '克重', '幅宽', '入库仓库/状态', '入库时间', '打印人/时间', '操作']) {
    await expect(barcodeDialog.getByRole('columnheader', { name: header, exact: true })).toBeVisible()
  }
  await expect(barcodeDialog.locator('tbody tr')).toHaveCount(3)
  await barcodeDialog.getByRole('button', { name: '编辑', exact: true }).first().click()
  const editDialog = page.getByRole('dialog', { name: '编辑卷属性' })
  await expect(editDialog.locator('[data-printing-dialog-field="weightKg"]')).toHaveAttribute('step', '0.001')
  await expect(editDialog.locator('[data-printing-dialog-field="weightKg"]')).toHaveValue(/^\d+\.\d{3}$/)
  await editDialog.locator('[data-printing-dialog-field="lengthY"]').fill('')
  await editDialog.locator('[data-printing-dialog-field="meters"]').fill('10')
  await editDialog.locator('[data-printing-dialog-field="weightKg"]').fill('')
  await editDialog.locator('[data-printing-dialog-field="vatNo"]').fill('VAT-ACCEPT-001')
  await editDialog.getByRole('button', { name: '确定', exact: true }).click()
  const returnedBarcodeDialog = page.getByRole('dialog', { name: '加工产出卷条码' })
  await returnedBarcodeDialog.getByRole('button', { name: '编辑', exact: true }).first().click()
  await expect(page.getByRole('dialog', { name: '编辑卷属性' }).locator('[data-printing-dialog-field="vatNo"]')).toHaveValue('VAT-ACCEPT-001')
  await page.screenshot({ path: `${EVIDENCE_DIR}/03-printing-roll-barcodes.png`, fullPage: true })
  expect(runtimeErrors).toEqual([])
})

test('印花信息单、印花确认单、批量确认单和加工产出卷条码均可预览打印', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto(printPreviewPath('PRINTING_INFO_SHEET', 'PRINTING_WORK_ORDER', 'PWO-25336'))
  await expect(page.getByText('印花信息单', { exact: true }).first()).toBeVisible()
  for (const text of ['需求来源', '用量依据', '加工投入', '印花要求与加工产出', '加工产出 SKU']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByText(/打印版本：V1/)).toBeVisible()
  await expect(page.getByRole('button', { name: '下载 PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '打印', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: `${EVIDENCE_DIR}/04-printing-info-sheet.png`, fullPage: true })

  await page.goto(printPreviewPath('PRINTING_CONFIRMATION', 'PRINTING_WORK_ORDER', 'PWO-24013'))
  for (const text of ['Print confirmation', 'Pattern transfer confirmation', 'Storage / Gudang', 'Remark', '加工投入 SKU', '加工产出 SKU']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  }
  await expect(page.locator('body')).not.toContainText('Edit confirmation')
  await page.screenshot({ path: `${EVIDENCE_DIR}/05-printing-confirmation.png`, fullPage: true })

  await page.goto(printPreviewPath('PRINTING_CONFIRMATION', 'PRINTING_WORK_ORDER', 'PWO-25336,PWO-25337'))
  await expect(page.locator('body')).toContainText('YH25336')
  await expect(page.locator('body')).toContainText('YH25337')
  await expect(page.locator('article')).toHaveCount(2)

  await page.goto(printPreviewPath('PRINTING_ROLL_LABEL', 'PRINTING_ROLL_RECORD', 'PWO-24013:ROLL-YH24013-0001'))
  await expect(page.getByRole('heading', { name: '加工产出卷条码打印预览', exact: true })).toBeVisible()
  await expect(page.getByText('印花加工产出卷', { exact: true }).first()).toBeVisible()
  for (const text of ['产出 SKU', '卷长', '重量', '克重/幅宽', '缸号', '入库仓库', '备注']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  }
  await expect(page.locator('body')).toContainText(/\d+\.\d{3} KG/)
  await page.screenshot({ path: `${EVIDENCE_DIR}/06-printing-roll-label.png`, fullPage: true })
  expect(runtimeErrors).toEqual([])
})
