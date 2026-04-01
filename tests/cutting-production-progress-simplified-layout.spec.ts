import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度页按简化布局展示主表和筛选', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  await expect(page.getByText('颜色', { exact: true })).toHaveCount(0)
  await expect(page.getByText('尺码', { exact: true })).toHaveCount(0)
  await expect(page.getByText('部位关键词', { exact: true })).toHaveCount(0)
  await expect(page.getByText('原始裁片单号', { exact: true })).toHaveCount(0)
  await expect(page.getByText('面料 SKU', { exact: true })).toHaveCount(0)
  await expect(page.getByText('面料审核', { exact: true })).toHaveCount(0)

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow.locator('td')).toHaveCount(12)
  await expect(firstRow.locator('td').nth(5)).toContainText('/')
  await expect(firstRow.locator('td').nth(6)).toContainText('/')
  await expect(firstRow.locator('td').nth(8)).not.toBeEmpty()

  const actionCell = firstRow.locator('td').nth(11)
  await expect(actionCell.getByRole('button')).toHaveCount(1)
  await expect(actionCell.getByRole('button', { name: '查看详情' })).toBeVisible()

  const riskOptions = await page
    .locator('select[data-cutting-progress-field="risk"] option')
    .evaluateAll((options) => options.map((option) => option.textContent?.trim() ?? ''))

  expect(riskOptions).not.toContain('技术包缺失')
  expect(riskOptions).not.toContain('领料异常')
  expect(riskOptions).not.toContain('日期缺失')
  expect(riskOptions).not.toContain('状态冲突')

  await expectNoPageErrors(errors)
})
