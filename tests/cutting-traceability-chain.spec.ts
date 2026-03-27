import { expect, test, type Page } from '@playwright/test'

async function openFeiTickets(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
}

async function printFirstFeiUnit(page: Page): Promise<{ ticketNo: string }> {
  await openFeiTickets(page)

  await page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('当前打印单元基础信息')
  await page.getByRole('button', { name: '确认首次打印', exact: true }).click()

  await expect(page.getByRole('heading', { name: '已打印菲票', exact: true, level: 1 })).toBeVisible()
  await expect(page.locator('body')).toContainText('打印记录')

  const firstTicketCell = page.locator('table tbody tr td').first()
  await expect(firstTicketCell).toBeVisible()
  const ticketNo = (await firstTicketCell.textContent())?.trim() ?? ''
  expect(ticketNo).not.toBe('')
  return { ticketNo }
}

test('菲票列表与详情正常打开，并显示正式归属信息', async ({ page }) => {
  await openFeiTickets(page)
  await expect(page.locator('body')).toContainText('面料 SKU')

  await page.getByRole('button', { name: '查看详情', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('菲票拆分明细')
  await expect(page.locator('body')).toContainText('来源生产单数')
  await expect(page.locator('body')).toContainText('面料 SKU')
  await expect(page.locator('body')).toContainText('来源原始裁片单号')
})

test('菲票打印链正常，打印对象来自正式菲票并形成正式打印记录', async ({ page }) => {
  await printFirstFeiUnit(page)
  await expect(page.locator('body')).toContainText('已打印菲票')
  await expect(page.locator('body')).toContainText('查看打印预览')
  await expect(page.locator('body')).toContainText('打印记录')
  await expect(page.locator('body')).toContainText('面料 SKU')
})

test('周转口袋页正常打开，载具对象来自正式载具周期', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/transfer-bags')

  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('步骤 1：扫周转口袋码')
  await expect(page.locator('body')).toContainText('步骤 2：扫菲票码')
  await expect(page.locator('[data-transfer-bags-action="use-master"]').first()).toBeVisible()
})

test('装袋流程遵循先扫口袋码再扫菲票子码，并建立父子映射', async ({ page }) => {
  const { ticketNo } = await printFirstFeiUnit(page)

  await page.goto(`/fcs/craft/cutting/transfer-bags?ticketNo=${encodeURIComponent(ticketNo)}`)
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()

  await page.locator('[data-transfer-bags-action="bind-ticket"]').click()
  await expect(page.locator('body')).toContainText('必须先扫口袋码，再扫菲票子码')

  const useMasterButton = page.locator('[data-transfer-bags-action="use-master"]').first()
  await expect(useMasterButton).toBeVisible()
  await useMasterButton.click()

  if (await page.getByText('当前尚未选中使用周期。').count()) {
    const sewingTaskSelect = page.locator('[data-transfer-bags-workbench-field="sewingTaskId"]')
    if ((await sewingTaskSelect.locator('option').count()) > 1) {
      await sewingTaskSelect.selectOption({ index: 1 })
    }
    await page.locator('[data-transfer-bags-action="create-usage"]').click()
  }

  const ticketChip = page.locator('[data-transfer-bags-action="set-ticket-input"]').first()
  await expect(ticketChip).toBeVisible()
  await ticketChip.click()
  await page.locator('[data-transfer-bags-action="bind-ticket"]').click()

  await expect(page.locator('body')).toContainText('袋内菲票明细')
  await expect(page.locator('body')).toContainText(ticketNo)
  await expect(page.locator('body')).toContainText('打印装袋清单')
})

test('工艺扫码追溯可用，二维码链上能看到工艺信息和顺序校验', async ({ page }) => {
  await printFirstFeiUnit(page)

  await page.getByRole('button', { name: '查看打印预览', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('打印预览')
  await expect(page.locator('body')).toContainText('工艺顺序')
  await expect(page.locator('body')).toContainText('顺序校验 / 载具绑定')
  await expect(page.locator('body')).toContainText('原始裁片单 / 生产单')
})

test('追溯链 UI 骨架保持稳定，没有被顺手大改', async ({ page }) => {
  await openFeiTickets(page)
  await expect(page.getByRole('button', { name: '查看详情', exact: true }).first()).toBeVisible()
  await expect(page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-transfer-bags-action="create-usage"]')).toBeVisible()
  await expect(page.locator('[data-transfer-bags-action="bind-ticket"]')).toBeVisible()
})
