import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单总览只展示业务事实宽表和多选筛选', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  await expect(page.getByText('印花状态', { exact: false })).toBeVisible()
  await expect(page.getByText('染色状态', { exact: false })).toBeVisible()
  await expect(page.getByText('配料状态', { exact: false })).toBeVisible()
  await expect(page.getByText('接单状态', { exact: false })).toBeVisible()
  await expect(page.getByText('领取状态', { exact: false })).toBeVisible()

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow.locator('td')).toHaveCount(12)
  await expect(firstRow.locator('td').nth(0)).toHaveClass(/sticky/)
  await expect(firstRow.locator('td').nth(1)).toHaveClass(/sticky/)
  await expect(firstRow.locator('td').nth(6)).not.toBeEmpty()

  await expect(page.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(page.getByText('风险提示', { exact: true })).toHaveCount(0)
  await expect(page.getByText('异常事实', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-cutting-overview-mutate]')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
