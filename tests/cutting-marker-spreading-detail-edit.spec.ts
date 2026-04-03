import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布详情与编辑页展示公式并支持保存闭环', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '查看详情' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)
  await expect(page.getByText('总实际铺布长度（m）').first()).toBeVisible()
  await expect(page.getByText('总可用长度（m）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.locator('p.font-mono').first()).toContainText('=')

  await page.getByRole('button', { name: '去编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  const rollRows = page.locator('[data-cutting-spreading-roll-field="rollNo"]')
  const beforeCount = await rollRows.count()
  await page.getByRole('button', { name: '新增卷' }).click()
  await expect(page.locator('[data-cutting-spreading-roll-field="rollNo"]')).toHaveCount(beforeCount + 1)

  await page.getByRole('button', { name: '标记进行中' }).click()
  await expect(page.getByText('当前铺布 session 已标记为“进行中”。')).toBeVisible()

  await page.getByRole('button', { name: '保存并返回详情' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)

  await expectNoPageErrors(errors)
})
