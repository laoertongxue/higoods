import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度页展示紧急程度等级并提供与计划发货相比筛选', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  const urgencyCell = table.locator('tbody tr').first().locator('td').nth(0)
  await expect(urgencyCell).toContainText(/AA 紧急|A 紧急|B 紧急|C 优先|D 常规|待补日期/)
  await expect(urgencyCell).toContainText(/距计划发货|已超计划发货|计划发货日期待补/)

  const shipDeltaSelect = page.locator('select[data-cutting-progress-field="ship-delta"]')
  await expect(shipDeltaSelect).toBeVisible()

  const options = await shipDeltaSelect.locator('option').evaluateAll((elements) =>
    elements.map((element) => element.textContent?.trim() ?? ''),
  )

  expect(options).toContain('距计划发货 0~3 天')
  expect(options).toContain('距计划发货 4~6 天')
  expect(options).toContain('超计划发货 0~3 天')
  expect(options).toContain('超计划发货 4~6 天')

  await expectNoPageErrors(errors)
})
