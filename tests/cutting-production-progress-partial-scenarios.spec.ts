import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单总览展示汇总状态且工厂事实逐行对齐', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  const progressingRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-088' }).first()
  await expect(progressingRow).toBeVisible()
  await expect(progressingRow.locator('td').nth(3)).toContainText('进行中')

  const assignedRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-0002' }).first()
  await expect(assignedRow).toBeVisible()
  const factoryLines = assignedRow.locator('[data-cutting-overview-factory-line]')
  await expect(factoryLines).toHaveCount(2)
  await expect(assignedRow).toContainText('中央工厂')
  await expect(assignedRow).toContainText('第三方工厂')
  await expect(assignedRow).toContainText(/未接单|已接单/)
  await expect(assignedRow).toContainText(/未领取|部分领取|领取完成/)

  await expectNoPageErrors(errors)
})
