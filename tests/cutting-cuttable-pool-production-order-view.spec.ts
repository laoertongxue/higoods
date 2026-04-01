import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产恢复旧版主布局并保留右侧已选区', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await expect(page.getByTestId('cutting-cuttable-pool-page')).toBeVisible()
  await expect(page.getByText('按同款分组', { exact: true })).toBeVisible()
  await expect(page.getByText('按生产单平铺', { exact: true })).toBeVisible()
  await expect(page.getByTestId('cutting-cuttable-pool-selected-sidebar')).toBeVisible()
  await expect(page.getByTestId('cutting-cuttable-pool-selected-sticky-bar')).toHaveCount(0)

  const styleGroup = page.getByTestId('cutting-cuttable-pool-style-group').first()
  await expect(styleGroup).toBeVisible()

  const firstCard = page.getByTestId('cutting-cuttable-pool-order-card').first()
  await expect(firstCard).toBeVisible()
  await expect(firstCard.getByTestId('cutting-cuttable-pool-original-order-table')).toBeVisible()
  await expect(firstCard.getByText('当前情况', { exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})
