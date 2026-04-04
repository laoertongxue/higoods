import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('canonical 铺布列表可打开、状态 tabs 固定、旧 marker-spreading 只保留兼容跳转', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()
  const tabs = page.getByTestId('cutting-spreading-stage-tabs')
  await expect(tabs).toBeVisible()

  for (const label of ['全部', '待开始', '铺布中', '待补料确认', '待打印菲票', '待装袋', '待入仓', '已完成']) {
    await expect(tabs.getByRole('button', { name: new RegExp(`^${label}（`) })).toBeVisible()
  }

  await tabs.getByRole('button', { name: /待开始（/ }).click()
  await expect(page.getByText('视图：待开始')).toBeVisible()

  await tabs.getByRole('button', { name: /铺布中（/ }).click()
  await expect(page.getByText('视图：铺布中')).toBeVisible()

  await tabs.getByRole('button', { name: /待补料确认（/ }).click()
  await expect(page.getByText('视图：待补料确认')).toBeVisible()

  await tabs.getByRole('button', { name: /全部（/ }).click()
  await expect(page.getByText('视图：全部')).toBeVisible()
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)

  await page.goto('/fcs/craft/cutting/marker-spreading?originalCutOrderId=OC-TEST-01&originalCutOrderNo=CUT-TEST-01')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=OC-TEST-01/)
  await expect(page).toHaveURL(/originalCutOrderNo=CUT-TEST-01/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()

  await expectNoPageErrors(errors)
})
