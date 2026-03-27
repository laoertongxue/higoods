import { expect, test, type Page } from '@playwright/test'

async function expectCanonicalHeading(page: Page, heading: string): Promise<void> {
  await expect(page.locator('h1').first()).toContainText(heading)
}

async function ensureCuttingMenuGroupExpanded(page: Page, groupTitle: string, expectedItem: string): Promise<void> {
  const expectedItemLocator = page.locator('aside').getByText(expectedItem, { exact: true })
  if (await expectedItemLocator.isVisible().catch(() => false)) return
  await page.getByRole('button', { name: groupTitle }).click()
  await expect(expectedItemLocator).toBeVisible()
}

test('裁片主菜单已收口到三组主入口', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/production-progress')
  const sidebar = page.locator('aside').first()

  await ensureCuttingMenuGroupExpanded(page, '裁片总览', '生产单进度')
  await ensureCuttingMenuGroupExpanded(page, '裁片执行准备', '原始裁片单')
  await ensureCuttingMenuGroupExpanded(page, '裁片仓交接', '裁床仓')

  await expect(sidebar).toContainText('生产单进度')
  await expect(sidebar).toContainText('可裁排产')
  await expect(sidebar).toContainText('合并裁剪批次')
  await expect(sidebar).toContainText('原始裁片单')
  await expect(sidebar).toContainText('仓库配料领料')
  await expect(sidebar).toContainText('唛架铺布')
  await expect(sidebar).toContainText('打印菲票')
  await expect(sidebar).toContainText('裁床仓')
  await expect(sidebar).toContainText('裁片仓')
  await expect(sidebar).toContainText('样衣仓')
  await expect(sidebar).toContainText('周转口袋车缝交接')

  await expect(sidebar).not.toContainText('裁片后续管理')
  await expect(sidebar).not.toContainText('裁片结算评分')
  await expect(sidebar).not.toContainText('裁剪总表')
})

test('裁片 alias 路由会自动跳到 canonical 路由', async ({ page }) => {
  await page.goto('/fcs/craft/cutting')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)
  await expectCanonicalHeading(page, '生产单进度')

  await page.goto('/fcs/craft/cutting/order-progress')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)
  await expectCanonicalHeading(page, '生产单进度')

  await page.goto('/fcs/craft/cutting/cut-piece-orders')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders$/)
  await expectCanonicalHeading(page, '原始裁片单')

  await page.goto('/fcs/craft/cutting/warehouse-management')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)
  await expectCanonicalHeading(page, '裁床仓')
})

test('平台侧入口文案和跳转已切到 canonical', async ({ page }) => {
  await page.goto('/fcs/progress/cutting-overview')

  await expect(page.getByRole('button', { name: '去生产单进度' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去原始裁片单' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去裁床仓' }).first()).toBeVisible()

  await page.getByRole('button', { name: '去生产单进度' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)
  await page.goBack()

  await page.getByRole('button', { name: '去原始裁片单' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders$/)
  await page.goBack()

  await page.getByRole('button', { name: '去裁床仓' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)

  await page.goto('/fcs/progress/cutting-overview')
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/progress\/cutting-overview\/.+$/)
  await expect(page.getByRole('button', { name: '去生产单进度' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去原始裁片单' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去裁床仓' }).first()).toBeVisible()

  await page.getByRole('button', { name: '去生产单进度' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)

  await page.goto('/fcs/progress/cutting-exception-center')
  await expect(page.getByRole('button', { name: '去生产单进度' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去原始裁片单' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去裁床仓' }).first()).toBeVisible()

  await page.getByRole('button', { name: '去裁床仓' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)
})

test('旧仓库总页已死亡，页面入口不再带回 warehouse-management', async ({ page }) => {
  await page.goto('/fcs/progress/cutting-overview')
  await expect(page.locator('body')).not.toContainText('去仓库管理')
  await expect(page.locator('body')).not.toContainText('/fcs/craft/cutting/warehouse-management')

  await page.goto('/fcs/progress/cutting-exception-center')
  await expect(page.locator('body')).not.toContainText('去仓库管理')
  await expect(page.locator('body')).not.toContainText('/fcs/craft/cutting/warehouse-management')
})
