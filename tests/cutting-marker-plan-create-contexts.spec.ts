import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function createFromContext(page: Page, buttonName: string): Promise<void> {
  await page.getByRole('button', { name: buttonName }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('tbody input[type="radio"]').first()).toBeVisible()
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '进入新增' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()
}

async function setSizeRatio(page: Page, sizeCode: string, qty: number): Promise<void> {
  const input = page.locator(`[data-marker-plan-action="change-size-ratio"][data-size-code="${sizeCode}"]`)
  await input.fill(String(qty))
}

test('唛架可从原始裁片单和合并批次上下文新建，并能联动计算与配平状态', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  await createFromContext(page, '从原始裁片单新建')

  await expect(page.locator('[data-marker-plan-tab-trigger="basic"]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-tab-trigger="allocation"]')).toBeVisible()

  for (const sizeCode of ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus']) {
    await setSizeRatio(page, sizeCode, 0)
  }
  await setSizeRatio(page, 'S', 3)
  await setSizeRatio(page, 'M', 5)
  await page.locator('[data-marker-plan-basic-field="netLength"]').fill('4')

  const basicTab = page.getByTestId('marker-plan-basic-tab')
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('可交接铺布')
  await page.evaluate(() => window.scrollTo({ top: 640, behavior: 'instant' }))
  const topInfoBox = await page.locator('[data-marker-plan-top-shell]').boundingBox()
  const tabShellBox = await page.locator('[data-marker-plan-tab-shell]').boundingBox()
  expect(topInfoBox).not.toBeNull()
  expect(tabShellBox).not.toBeNull()
  if (topInfoBox && tabShellBox) {
    expect(tabShellBox.y).toBeGreaterThanOrEqual(topInfoBox.y + topInfoBox.height - 1)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(basicTab.getByText('唛架成衣件数（件）', { exact: true })).toBeVisible()
  await expect(basicTab).toContainText('8')
  await expect(basicTab).toContainText('0.500')
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('否')

  await page.locator('[data-marker-plan-tab-trigger="allocation"]').evaluate((node: HTMLElement) => node.click())
  const allocationTab = page.getByTestId('marker-plan-allocation-tab')
  await expect(allocationTab).toBeVisible()
  await page.getByRole('button', { name: '清空重配' }).click()
  await expect(allocationTab.getByText('待配平', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '一键按尺码配比生成' }).click()
  await expect(allocationTab.getByText('已配平', { exact: true }).first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-list')
  await createFromContext(page, '从合并批次新建')
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('上下文类型')
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('合并裁剪批次')

  await expectNoPageErrors(errors)
})
