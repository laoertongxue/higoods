import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test('后道阶段保留烫包工艺且质检不再允许手工建单', async ({ page }) => {
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  await page.locator('[data-craft-dict-field="keyword"]').fill('烫包')
  const craftRows = page.locator('tbody tr').filter({ hasText: '烫包' })
  await expect(craftRows).toHaveCount(1)
  await expect(craftRows.first()).toContainText('后道阶段')
  await expect(craftRows.first()).toContainText('成衣')

  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检任务管理', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '创建质检单', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).toContainText('回货确认并送检后自动出现')
})
