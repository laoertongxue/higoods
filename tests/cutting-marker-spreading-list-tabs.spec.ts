import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('canonical 铺布单列表可打开、状态筛选固定、旧 marker-spreading 只保留兼容跳转', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布单' })).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-stage-tabs')).toHaveCount(0)
  const stageFilter = page.locator('[data-cutting-spreading-list-field="main-stage"]')
  await expect(stageFilter).toBeVisible()
  await expect(stageFilter.locator('option')).toHaveText(['全部', '待铺布', '铺布中', '已铺布'])

  await stageFilter.selectOption('WAITING_START')
  await expect(page.locator('[data-cutting-spreading-list-field="main-stage"]')).toHaveValue('WAITING_START')
  await stageFilter.selectOption('IN_PROGRESS')
  await expect(page.locator('[data-cutting-spreading-list-field="main-stage"]')).toHaveValue('IN_PROGRESS')
  await stageFilter.selectOption('ALL')
  await expect(page.locator('[data-cutting-spreading-list-field="main-stage"]')).toHaveValue('ALL')
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)

  await page.goto('/fcs/craft/cutting/marker-spreading?cutOrderId=OC-TEST-01&cutOrderNo=CUT-TEST-01')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/cutOrderId=OC-TEST-01/)
  await expect(page).toHaveURL(/cutOrderNo=CUT-TEST-01/)
  await expect(page.getByRole('heading', { level: 1, name: '铺布单' })).toBeVisible()

  await expectNoPageErrors(errors)
})
