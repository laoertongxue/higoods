import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布编辑页状态下拉已收口，理论字段与颜色摘要只读且显示公式', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '查看详情' }).click()
  await page.getByRole('button', { name: '去编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  await expect(page.locator('[data-cutting-spreading-draft-field="status"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成铺布' })).toBeVisible()

  await expect(page.locator('[data-cutting-spreading-draft-field="colorSummary"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-spreading-draft-field="theoreticalSpreadTotalLength"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-spreading-draft-field="theoreticalActualCutPieceQty"]')).toHaveCount(0)

  await expect(page.getByText('颜色摘要').first()).toBeVisible()
  await expect(page.getByText('计划裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('理论裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('总实际铺布长度（m）').first()).toBeVisible()
  await expect(page.getByText('总净可用长度（m）').first()).toBeVisible()

  await page.locator('[data-cutting-spreading-edit-tab-shell]').getByRole('button', { name: '卷记录' }).click()
  await expect(page.getByText('净可用长度（m）').first()).toBeVisible()
  await expect(page.getByText('剩余长度（m）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()

  await page.locator('[data-cutting-spreading-edit-tab-shell]').getByRole('button', { name: '差异与补料' }).click()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('差异长度（m）').first()).toBeVisible()
  await expect(page.getByText('缺口成衣件数（件）').first()).toBeVisible()

  expect(await page.locator('.font-mono').filter({ hasText: '=' }).count()).toBeGreaterThan(8)

  await expectNoPageErrors(errors)
})
