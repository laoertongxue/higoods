import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('合并裁剪批次点击后从右侧打开详情侧边栏且不再展示计划卡片', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await page.getByTestId('cutting-cuttable-pool-quick-select-entry').first().getByRole('button', { name: '快速选择' }).click()
  await page.getByTestId('cutting-cuttable-pool-selected-sidebar').getByRole('button', { name: '创建裁剪批次' }).click()
  await expect(page).toHaveURL(/focusBatchId=/)

  await page.goto('/fcs/craft/cutting/merge-batches')

  await expect(page.getByTestId('cutting-merge-batches-detail-drawer')).toHaveCount(0)
  await page.getByRole('button', { name: '查看详情' }).first().click()

  const drawer = page.getByTestId('cutting-merge-batches-detail-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('批次基础信息')).toBeVisible()
  await expect(drawer.getByRole('heading', { name: '来源生产单' })).toBeVisible()
  await expect(drawer.getByText('原始裁片单明细')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '查看原始裁片单' }).first()).toBeVisible()
  await expect(drawer.getByText('批次计划信息')).toHaveCount(0)
  await expect(drawer.getByText('计划裁床组', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('计划裁剪日期', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('备注', { exact: true })).toHaveCount(0)

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await page.getByTestId('cutting-cuttable-pool-quick-select-entry').first().getByRole('button', { name: '快速选择' }).click()
  await page.getByTestId('cutting-cuttable-pool-selected-sidebar').getByRole('button', { name: '创建裁剪批次' }).click()
  await expect(page).toHaveURL(/focusBatchId=/)
  await expect(page.getByTestId('cutting-merge-batches-detail-drawer')).toBeVisible()

  await expectNoPageErrors(errors)
})
