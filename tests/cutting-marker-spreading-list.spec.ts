import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布单列表的查询、详情、新建与导出入口可用', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/cutting/spreading-list')

  await expect(page.getByTestId('cutting-spreading-list-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '铺布单' })).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-list-filters')).toBeVisible()
  const table = page.getByTestId('cutting-spreading-list-table')
  await expect(table).toBeVisible()
  await page.getByRole('button', { name: '新增铺布单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create(?:\?|$)/)
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()

  await page.goto('/fcs/craft/cutting/spreading-list')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出当前视图' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('铺布单-')

  await expectNoPageErrors(errors)
})
