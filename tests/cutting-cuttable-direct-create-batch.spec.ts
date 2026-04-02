import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产可直接创建裁剪批次并自动打开对应详情', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await page.getByTestId('cutting-cuttable-pool-quick-select-entry').first().getByRole('button', { name: '快速选择' }).click()
  await page.getByTestId('cutting-cuttable-pool-selected-sidebar').getByRole('button', { name: '创建裁剪批次' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches\?/)
  await expect(page).toHaveURL(/focusBatchId=/)
  await expect(page).toHaveURL(/createdBatchNo=/)
  await expect(page.getByRole('heading', { name: '合并裁剪批次' })).toBeVisible()
  await expect(page.getByText('待建批次输入区')).toHaveCount(0)
  await expect(page.getByText('创建待裁批次')).toHaveCount(0)

  const drawer = page.getByTestId('cutting-merge-batches-detail-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('批次基础信息')).toBeVisible()
  await expect(drawer.getByText('批次计划信息')).toBeVisible()
  await expect(drawer.getByText(/CUT-MB-/)).toBeVisible()

  await expectNoPageErrors(errors)
})
