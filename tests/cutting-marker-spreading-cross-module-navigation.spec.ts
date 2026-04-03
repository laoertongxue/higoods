import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('上游去铺布动作已切到 canonical spreading-list，唛架交给铺布也走新入口', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible()
  await page
    .getByTestId('cutting-original-orders-main-table')
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: '查看详情' })
    .click()
  await page.getByRole('button', { name: '去铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const readyRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list$/)

  await expectNoPageErrors(errors)
})
