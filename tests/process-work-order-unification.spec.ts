import { expect, test, type Page } from '@playwright/test'

async function expectNotPda(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/fcs\/pda\//)
}

test('平台侧印花加工单列表进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await page.getByRole('button', { name: '查看详情' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/PWO-PRINT-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByText('移动端执行任务引用')).toBeVisible()
})

test('平台侧染色加工单列表进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/process/dye-orders')
  await page.getByRole('button', { name: '查看详情' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders\/DWO-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.getByText('移动端执行任务引用')).toBeVisible()
})

test('工艺工厂侧印花加工单列表进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  await page.getByRole('button', { name: '查看详情' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/PWO-PRINT-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
})

test('工艺工厂侧染色加工单列表进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders')
  await page.getByRole('button', { name: '查看详情' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders\/DWO-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
})

test('印花加工单详情支持审核与进度视图入口', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007')
  await page.getByRole('button', { name: '审核记录' }).click()
  await expect(page).toHaveURL(/tab=review/)
  await expect(page.getByRole('heading', { name: '审核记录' })).toBeVisible()

  await page.getByRole('button', { name: '执行进度' }).click()
  await expect(page).toHaveURL(/tab=progress/)
  await expect(page.getByRole('heading', { name: '执行进度' })).toBeVisible()
})

test('染色加工单详情支持染色配方视图入口', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-006')
  await page.getByRole('button', { name: '染色配方' }).click()

  await expect(page).toHaveURL(/tab=formula/)
  await expect(page.getByRole('heading', { name: '染色配方' })).toBeVisible()
})

test('详情页移动端入口明确进入 PDA 页面，列表主入口不进入 PDA', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-005')
  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\//)

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-005')
  await page.getByRole('button', { name: '打开移动端交出页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\//)

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-007')
  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\//)

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-007')
  await page.getByRole('button', { name: '打开移动端交出页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\//)
})
