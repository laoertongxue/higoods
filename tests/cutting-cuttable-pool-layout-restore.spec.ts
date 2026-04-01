import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产恢复旧布局但保留快速选择与去合并裁剪批次能力', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await expect(page.getByTestId('cutting-cuttable-pool-page')).toBeVisible()
  await expect(page.getByTestId('cutting-cuttable-pool-quick-mergeable')).toHaveCount(0)
  await expect(page.getByTestId('cutting-cuttable-pool-selected-sticky-bar')).toHaveCount(0)
  await expect(page.getByTestId('cutting-cuttable-pool-selected-sidebar')).toBeVisible()
  await expect(page.getByTestId('cutting-cuttable-pool-quick-select-entry').first()).toBeVisible()
  await expect(page.getByText('面料审核', { exact: true })).toHaveCount(0)
  await expect(page.getByText('WAITING_REVIEW')).toHaveCount(0)

  await page.getByTestId('cutting-cuttable-pool-quick-select-entry').first().getByRole('button', { name: '快速选择' }).click()
  await page.getByTestId('cutting-cuttable-pool-selected-sidebar').getByRole('button', { name: '去合并裁剪批次' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches/)
  await expect(page.getByRole('heading', { name: '合并裁剪批次' })).toBeVisible()

  await expectNoPageErrors(errors)
})
