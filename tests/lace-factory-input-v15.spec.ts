import { expect, test } from '@playwright/test'

const PURCHASE_DEMANDS = '/fcs/craft/accessory/lace/purchase-demands'
const WORK_ORDERS = '/fcs/craft/accessory/lace/work-orders'
const WAITING_WORK_ORDER = '/fcs/craft/accessory/lace/work-orders/LWO-RJ-260808-001'

test('采购需求默认投入已补齐，不再产生自动生成异常', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(PURCHASE_DEMANDS)

  await expect(page.locator('[data-lace-generation-failures]')).toHaveCount(0)
  const failureRow = page.locator('tbody tr').filter({ hasText: '自动生成异常' })
  await expect(failureRow).toHaveCount(0)
  await expect(page.locator('main, [data-page-content-root]').first()).not.toContainText('自动生成异常 1 条\n采购信息补齐后')
  await page.screenshot({ path: '/private/tmp/lace-v15-purchase-demands.png', fullPage: true })
})

test('生产单列表以六个 Tab 展示并在操作栏显式列出当前动作', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(WORK_ORDERS)

  const tabs = page.locator('[data-lace-work-orders-action^="task-tab:"]')
  await expect(tabs).toHaveCount(6)
  for (const label of ['全部', '采购变更待查看', '待接收', '加工中', '已完结', '已取消']) {
    await expect(tabs.filter({ hasText: label })).toHaveCount(1)
  }

  const firstActionCell = page.locator('[data-lace-work-order-actions="LWO-RJ-260808-001"]')
  await expect(firstActionCell).toContainText('查看详情')
  await expect(firstActionCell).toContainText('查看采购变更')
  await expect(firstActionCell).toContainText('确认接收')
  await expect(firstActionCell).not.toContainText(/维护投入|修改加工投入|查看\s*\/\s*操作/)
  await expect(page.locator('tbody')).toContainText('单位用量 0.02 KG/Yard')
  await expect(page.locator('tbody')).toContainText('计划 12 KG')

  await page.locator('[data-lace-work-orders-action="task-tab:purchase-change"]').click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await expect(page.locator('tbody tr')).toContainText(['采购已变更', '待查看'])

  const firstImage = page.locator('[data-lace-common-action="open-image"]').first()
  await firstImage.locator('img').evaluate((image: HTMLImageElement) => { image.src = '/materials/not-found-v15.jpg' })
  await expect(firstImage.locator('[data-lace-image-error]')).toBeVisible()
  await firstImage.click()
  await expect(firstImage.locator('img')).toBeVisible()
  await expect.poll(() => firstImage.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await firstImage.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    tableScrollers: [...document.querySelectorAll<HTMLElement>('.overflow-x-auto')].filter((node) => node.scrollWidth > node.clientWidth).length,
  }))
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport + 1)
  expect(overflow.tableScrollers).toBeGreaterThan(0)
  await page.screenshot({ path: '/private/tmp/lace-v15-work-orders-1280.png', fullPage: true })
})

test('详情只保留三个内容 Tab，投入修改仅含 SKU 和单位用量', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(WAITING_WORK_ORDER)

  await expect(page.locator('[data-lace-detail-action^="content-tab:"]')).toHaveCount(3)
  for (const label of ['生产信息', '完工与交出', '操作日志']) {
    await expect(page.locator('[data-lace-detail-action^="content-tab:"]').filter({ hasText: label })).toHaveCount(1)
  }
  const inputSection = page.locator('[data-lace-detail-section="processing-input"]')
  await expect(inputSection).toContainText('加工投入')
  await expect(inputSection).toContainText('单位用量')
  await expect(inputSection).toContainText('600 Yard × 0.02 = 12 KG')
  await expect(page.locator('header').first()).not.toContainText('修改加工投入')

  await inputSection.getByRole('button', { name: '修改加工投入' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: '修改加工投入' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-lace-input-row]')).toHaveCount(2)
  await expect(dialog.locator('[data-lace-input-material]')).toHaveCount(2)
  await expect(dialog.locator('[data-lace-input-unit-usage]')).toHaveCount(2)
  await expect(dialog).toContainText('修改原因')
  await expect(dialog).not.toContainText(/实际投入|来源|批次|领料|发料|退料|新增投入|删除投入/)
  await expect(dialog.locator('[data-lace-common-action="open-image"]')).toHaveCount(5)

  const firstInputRow = dialog.locator('[data-lace-input-row]').first()
  await firstInputRow.locator('[data-lace-input-material]').selectOption('MAT-RJ-YARN-002')
  await firstInputRow.locator('[data-lace-input-unit-usage]').fill('0.025')
  await dialog.locator('[data-lace-detail-field="inputReason"]').fill('样品确认后调整投入 SKU 与单位用量')
  await dialog.getByRole('button', { name: '保存修改' }).click()

  await expect(page.locator('[data-lace-detail-feedback]')).toContainText('SKU 与单位用量已保存')
  await expect(inputSection).toContainText('RJ-YARN-LACE-150D')
  await expect(inputSection).toContainText('0.025 KG/Yard')
  await expect(inputSection).toContainText('15 KG')
  await expect.poll(() => inputSection.locator('img').evaluateAll((images: HTMLImageElement[]) => images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true)
  await expect(page.getByText('待接收', { exact: true }).first()).toBeVisible()

  await page.locator('[data-lace-detail-action="content-tab:fulfillment"]').click()
  await expect(page.locator('[data-lace-detail-tab-content]')).toContainText('加工填报记录')
  await expect(page.locator('[data-lace-detail-tab-content]')).not.toContainText('需求来源')
  await page.locator('[data-lace-detail-action="content-tab:logs"]').click()
  await expect(page.locator('[data-lace-detail-tab-content]')).toContainText('修改加工投入')
  await page.locator('[data-lace-detail-action="content-tab:production"]').click()
  await expect(page.locator('[data-lace-detail-tab-content]')).toContainText('加工投入')

  const detailOverflow = await page.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }))
  expect(detailOverflow.documentWidth).toBeLessThanOrEqual(detailOverflow.viewport + 1)
  await page.screenshot({ path: '/private/tmp/lace-v15-work-order-detail-1024.png', fullPage: true })
})

test('确认接收、加工填报、完成与撤销完成不依赖实际投入', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(WAITING_WORK_ORDER)

  await page.getByRole('button', { name: '确认接收' }).click()
  await expect(page.locator('[data-lace-detail-feedback]')).toContainText('进入加工中')
  await expect(page.locator('[data-lace-detail-section="processing-input"]')).toContainText('修改加工投入')

  await page.getByRole('button', { name: '加工填报' }).click()
  await page.locator('[data-lace-detail-field="reportQty"]').fill('600')
  await page.locator('[data-lace-detail-field="reportNote"]').fill('一次完工')
  await page.getByRole('dialog').filter({ hasText: '加工填报' }).getByRole('button', { name: '保存加工填报' }).click()
  await expect(page.locator('[data-lace-detail-feedback]')).toContainText('本次加工填报已保存')

  await page.getByRole('button', { name: '完成加工单' }).click()
  await page.locator('[data-lace-detail-field="completeReason"]').fill('人员确认完成')
  await page.getByRole('dialog').filter({ hasText: '完成加工单' }).getByRole('button', { name: '确认完成' }).click()
  await expect(page.locator('[data-lace-detail-feedback]')).toContainText('已完结')
  await expect(page.locator('[data-lace-detail-section="processing-input"]')).not.toContainText('修改加工投入')
  await expect(page.locator('[data-lace-detail-section="processing-input"]')).toContainText('不可修改')

  await expect(page.locator('[data-lace-detail-field="actorRole"]')).toHaveCount(0)
  await page.getByRole('button', { name: '撤销完成' }).click()
  await page.locator('[data-lace-detail-field="undoReason"]').fill('继续补产')
  await page.getByRole('dialog').filter({ hasText: '撤销完成' }).getByRole('button', { name: '确认撤销' }).click()
  await expect(page.locator('[data-lace-detail-feedback]')).toContainText('回到加工中')
  await expect(page.locator('[data-lace-detail-section="processing-input"]')).toContainText('修改加工投入')

  await page.locator('[data-lace-detail-action="content-tab:logs"]').click()
  const logs = page.locator('[data-lace-detail-section="operation-logs"]')
  for (const action of ['确认接收', '加工填报', '完成加工单', '撤销完成']) await expect(logs).toContainText(action)
  await expect(logs).not.toContainText(/实际投入|投入来源|批次/)
})
