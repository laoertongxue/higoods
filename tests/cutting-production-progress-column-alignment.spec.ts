import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const expectedHeaders = [
  '紧急程度',
  '生产单号',
  '款号 / SPU',
  '下单件数',
  '计划发货日期',
  '配料进展',
  '领料进展',
  '原始裁片单数',
  '当前进展',
  '部位差异',
  '风险提示',
  '操作',
] as const

test('裁片生产单进度主表的表头和数据列保持 12 列对齐', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  const headers = await table.locator('thead th').evaluateAll((elements) =>
    elements.map((element) => element.textContent?.trim() ?? ''),
  )
  expect(headers).toEqual(expectedHeaders)

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await expect(firstRow.locator('td')).toHaveCount(expectedHeaders.length)

  await expect(table.locator('thead th').nth(5)).toHaveText('配料进展')
  await expect(table.locator('thead th').nth(6)).toHaveText('领料进展')
  await expect(table.locator('thead th').nth(7)).toHaveText('原始裁片单数')
  await expect(table.locator('thead th').nth(8)).toHaveText('当前进展')
  await expect(table.locator('thead th').nth(10)).toHaveText('风险提示')

  await expectNoPageErrors(errors)
})
