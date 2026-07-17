import { expect, test, type Page } from '@playwright/test'

async function expectNotPda(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/fcs\/pda\//)
}

test('平台侧印花加工单列表先查看平台事实，再进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('平台印花加工单', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '打开工厂端详情', exact: true }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/PWO-PRINT-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByText('移动端执行任务引用')).toBeVisible()
})

test('平台侧染色加工单列表进入 PFOS 列表查看弹窗', async ({ page }) => {
  await page.goto('/fcs/process/dye-orders')
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('平台染色加工单', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '打开工厂端详情', exact: true }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders\?dyeOrderId=DWO-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: /查看染色加工单 -/ })).toBeVisible()
  await expect(page.getByText('平台加工单号', { exact: true })).toBeVisible()
})

test('工艺工厂侧印花加工单列表进入 Web 详情', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  const detailLink = page.locator('a[data-nav^="/fcs/craft/printing/work-orders/PWO-"]').first()
  await expect(detailLink).toHaveText('查看详情', { timeout: 30_000 })
  await detailLink.click()

  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/PWO-PRINT-/)
  await expectNotPda(page)
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
})

test('工艺工厂侧染色加工单使用列表内查看、编辑和日志', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders')
  const row = page.locator('tbody tr').filter({ has: page.locator('[data-work-order-no]') }).first()
  const workOrderNo = await row.locator('[data-work-order-no]').getAttribute('data-work-order-no')
  await row.getByRole('button', { name: '查看', exact: true }).click()
  await expect(page.getByRole('heading', { name: `查看染色加工单 - ${workOrderNo}` })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()
  await row.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.getByRole('heading', { name: `编辑染色加工单 - ${workOrderNo}` })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).last().click()
  await row.getByRole('button', { name: '日志', exact: true }).click()
  await expect(page.getByRole('heading', { name: `操作日志 - ${workOrderNo}` })).toBeVisible()
  await expectNotPda(page)
})
