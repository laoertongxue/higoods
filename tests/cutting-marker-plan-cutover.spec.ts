import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('旧 marker-spreading 已退场唛架视图且静态旧路由会回到 canonical 唛架列表', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '铺布记录' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建铺布' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '新建唛架' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)
  await expect(page.getByText('当前筛选范围内暂无唛架记录')).toHaveCount(0)

  await page.goto('/fcs/craft/cutting/marker-detail')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list$/)

  await page.goto('/fcs/craft/cutting/marker-edit')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list$/)

  await expectNoPageErrors(errors)
})
