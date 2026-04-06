import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产把原始裁片单当前情况改成现场可读的人话说明', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await expect(page.getByText('当前情况', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('还没配好料').first()).toBeVisible()
  await expect(page.getByText('只配好一部分料').first()).toBeVisible()
  await expect(page.getByText('还没领料').first()).toBeVisible()
  await expect(page.getByText('只领到一部分料').first()).toBeVisible()
  await expect(page.getByText('领料数量不一致，先核对').first()).toBeVisible()
  await expect(page.getByText(/已加入合并裁剪批次/).first()).toBeVisible()
  await expect(page.getByText('这张单已经开始裁了，不能重复加入').first()).toBeVisible()
  await expect(page.getByText('阻塞原因 / 批次占用', { exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})
