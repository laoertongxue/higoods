import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度页统一使用工厂、原始裁片单号和下单件数文案', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()
  await expect(table.locator('thead th').nth(3)).toHaveText('下单件数')

  await table.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click()

  const drawer = page.locator('.fixed.inset-0.z-50').filter({
    has: page.getByRole('heading', { name: '生产单详情' }),
  })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('工厂')
  await expect(drawer).toContainText('下单件数')
  await expect(drawer).toContainText('原始裁片单号')
  await expect(drawer.getByText('当前协调工厂', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('来源裁片单号', { exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})
