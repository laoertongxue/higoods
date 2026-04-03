import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布列表页只保留铺布视图并支持进入详情和编辑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page.getByRole('heading', { name: '铺布列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建铺布' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)
  await expect(page.getByText('当前筛选范围内暂无唛架记录')).toHaveCount(0)

  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '查看详情' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '编辑' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '新建铺布' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '去补料管理' })).toBeVisible()

  await firstRow.getByRole('button', { name: '查看详情' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  await expectNoPageErrors(errors)
})
