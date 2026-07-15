import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const expectedHeaders = [
  '生产单',
  '款式',
  '印花',
  '染色',
  '拆解',
  '配料',
  '派单工厂 / 接单 / 领取',
  '唛架',
  '铺布',
  '裁剪',
  '入仓',
  '发货 / 接收工厂',
] as const

test('裁片生产单进度主表的表头和数据列保持 12 列对齐', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  await expect(table.locator('thead tr')).toHaveCount(2)
  const groupHeaders = await table.locator('thead tr').first().locator('th').evaluateAll((elements) =>
    elements.map((element) => element.textContent?.trim() ?? ''),
  )
  expect(groupHeaders).toEqual(['下单', '印染', '中转仓', '裁床厂'])

  const headers = await table.locator('thead tr').nth(1).locator('th').evaluateAll((elements) =>
    elements.map((element) => element.textContent?.trim() ?? ''),
  )
  expect(headers).toEqual(expectedHeaders)

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await expect(firstRow.locator('td')).toHaveCount(expectedHeaders.length)

  await expect(table.locator('thead tr').first().locator('th').nth(0)).toHaveAttribute('colspan', '2')
  await expect(table.locator('thead tr').first().locator('th').nth(1)).toHaveAttribute('colspan', '2')
  await expect(table.locator('thead tr').first().locator('th').nth(2)).toHaveAttribute('colspan', '3')
  await expect(table.locator('thead tr').first().locator('th').nth(3)).toHaveAttribute('colspan', '5')

  await expectNoPageErrors(errors)
})
