import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('唛架方案列表与新建入口可用', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  await expect(page.getByRole('heading', { level: 1, name: '唛架方案' })).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-table')).toBeVisible()
  await page.getByRole('button', { name: '新建唛架方案' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()

  await expectNoPageErrors(errors)
})
