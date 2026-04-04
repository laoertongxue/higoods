import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布详情与编辑页展示 5 个 tabs、卷记录 plan unit 绑定和保存闭环', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '查看详情' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)
  await expect(page.getByText('总实际铺布长度（m）').first()).toBeVisible()
  await expect(page.getByText('总可用长度（m）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.locator('.font-mono').filter({ hasText: '=' }).first()).toBeVisible()

  await page.getByRole('button', { name: '去编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page.getByTestId('cutting-spreading-edit-page')).toBeVisible()

  const tabShell = page.locator('[data-cutting-spreading-edit-tab-shell]')
  await expect(tabShell).toBeVisible()
  await expect(tabShell.getByRole('button')).toHaveText([
    '执行摘要',
    '卷记录',
    '换班与人员',
    '差异与补料',
    '完成与后续',
  ])

  await tabShell.getByRole('button', { name: '卷记录' }).click()
  const planUnitSelects = page.locator('[data-cutting-spreading-roll-field="planUnitId"]')
  const beforeCount = await planUnitSelects.count()
  await page.getByRole('button', { name: '新增卷记录' }).click()
  await expect(page.locator('[data-cutting-spreading-roll-field="planUnitId"]')).toHaveCount(beforeCount + 1)
  await expect(page.locator('[data-cutting-spreading-roll-field="planUnitId"]').last()).not.toHaveValue('')

  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page.getByText(/已保存。/)).toBeVisible()

  await tabShell.getByRole('button', { name: '完成与后续' }).click()
  await expect(page.getByText('当前 next step').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
