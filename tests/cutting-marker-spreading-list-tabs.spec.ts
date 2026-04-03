import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('canonical 铺布列表可打开且旧 marker-spreading 只保留兼容跳转', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list/)
  await expect(page.getByRole('heading', { name: '铺布列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建铺布' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)
  await expect(page.getByText('当前筛选范围内暂无唛架记录')).toHaveCount(0)
  await expect(page.locator('table tbody tr').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-spreading?originalCutOrderId=OC-TEST-01&originalCutOrderNo=CUT-TEST-01')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=OC-TEST-01/)
  await expect(page).toHaveURL(/originalCutOrderNo=CUT-TEST-01/)
  await expect(page.getByRole('heading', { name: '铺布列表' })).toBeVisible()

  await expectNoPageErrors(errors)
})
