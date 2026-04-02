import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('合并裁剪批次默认只显示列表，不默认展示待建输入区和详情', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/merge-batches')

  await expect(page.getByTestId('cutting-merge-batches-page')).toBeVisible()
  await expect(page.getByTestId('cutting-merge-batches-ledger')).toBeVisible()
  await expect(page.getByText('待建批次输入区')).toHaveCount(0)
  await expect(page.getByText('创建待裁批次')).toHaveCount(0)
  await expect(page.getByTestId('cutting-merge-batches-detail-drawer')).toHaveCount(0)
  await expect(page.getByText('批次基础信息')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
