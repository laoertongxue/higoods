import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度页只提供有来源的事实状态筛选', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()

  await expect(page.locator('select[data-cutting-progress-field="ship-delta"]')).toHaveCount(0)
  await expect(page.getByText(/AA 紧急|A 紧急|B 紧急|C 优先|D 常规|待补日期/)).toHaveCount(0)
  await expect(page.getByText(/距计划发货|已超计划发货|计划发货日期待补/)).toHaveCount(0)

  const factFilterOptions = {
    printing: ['未开始', '印花中', '印花完成', '无需印花'],
    dyeing: ['未开始', '染色中', '染色完成', '无需染色'],
    materialPrep: ['未配料', '部分配料', '配料完成'],
    acceptance: ['未接单', '已经接单'],
    pickup: ['未领取', '部分领取', '领取完成'],
  } as const
  for (const [field, expectedOptions] of Object.entries(factFilterOptions)) {
    const inputs = page.locator(`input[data-cutting-overview-filter="${field}"]`)
    await expect(inputs).toHaveCount(expectedOptions.length)
    expect(await inputs.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))).toEqual([...expectedOptions])
  }

  await expectNoPageErrors(errors)
})
