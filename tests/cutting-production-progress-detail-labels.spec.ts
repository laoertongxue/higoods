import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('状态点击进入对应事实详情且详情不生成异常阻塞判断', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  const prepRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-0008' }).first()
  await expect(prepRow).toBeVisible()
  await prepRow.locator('td').nth(5).getByRole('button', { name: '未配料' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress-detail\/[^?]+\?tab=material-flow$/)
  const detail = page.getByTestId('cutting-production-progress-detail-page')
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('button', { name: '配料 / 领料' })).toHaveAttribute('aria-current', 'page')
  await expect(detail.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('风险提示', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('异常事实', { exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})
