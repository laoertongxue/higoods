import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openWaitingLayoutTable(page: import('@playwright/test').Page) {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.locator('[data-marker-plan-filter-field="status"]').selectOption('WAITING_LAYOUT')
  await expect(page.getByTestId('marker-plan-list-state-bar')).toContainText('待补唛架')
  return page.getByTestId('marker-plan-list-table')
}

test('主状态筛选后的方案可通过普通表格进入详情和编辑页', async ({ page }) => {
  const errors = collectPageErrors(page)

  let table = await openWaitingLayoutTable(page)
  const detailButton = table.locator('[data-marker-plan-action="go-detail"]').first()
  await expect(detailButton).toBeVisible()
  await expect(detailButton).not.toHaveAttribute('data-tab-key')
  await detailButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\/[^?]+$/)
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()

  table = await openWaitingLayoutTable(page)
  const editButton = table.locator('[data-marker-plan-action="go-edit"]').first()
  await expect(editButton).toBeVisible()
  await expect(editButton).not.toHaveAttribute('data-tab-key')
  await editButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\/[^?]+$/)
  await expect(page.getByTestId('cutting-marker-plan-edit-page')).toBeVisible()

  await expectNoPageErrors(errors)
})
