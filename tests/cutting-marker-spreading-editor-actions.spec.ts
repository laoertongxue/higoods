import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布编辑页状态下拉已收口，理论字段与颜色摘要只读且显示公式', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  const statusOptions = await page.locator('[data-cutting-spreading-draft-field="status"] option').allTextContents()
  expect(statusOptions).toEqual(expect.arrayContaining(['草稿', '进行中', '待补录']))
  expect(statusOptions).not.toContain('已完成')
  await expect(page.getByRole('button', { name: '完成铺布' })).toBeVisible()

  await expect(page.locator('[data-cutting-spreading-draft-field="colorSummary"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-spreading-draft-field="theoreticalSpreadTotalLength"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-spreading-draft-field="theoreticalActualCutPieceQty"]')).toHaveCount(0)

  const colorSummaryField = page.locator('[data-cutting-spreading-readonly-field="colorSummary"]')
  await expect(colorSummaryField).toBeVisible()
  await expect(colorSummaryField.locator('.font-mono')).toContainText('=')

  const theoreticalLengthField = page.locator('[data-cutting-spreading-readonly-field="theoreticalSpreadTotalLength"]')
  await expect(theoreticalLengthField).toBeVisible()
  await expect(theoreticalLengthField.locator('.font-mono')).toContainText('=')

  const theoreticalQtyField = page.locator('[data-cutting-spreading-readonly-field="theoreticalActualCutPieceQty"]')
  await expect(theoreticalQtyField).toBeVisible()
  await expect(theoreticalQtyField.locator('.font-mono')).toContainText('=')

  await expect(page.getByText('单卷可用长度（m）')).toBeVisible()
  await expect(page.getByText('单卷剩余长度（m）')).toBeVisible()
  await expect(page.getByText('单卷实际裁剪成衣件数（件）')).toBeVisible()
  await expect(page.getByText('总可用长度（m）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('差异长度（m）').first()).toBeVisible()
  await expect(page.getByText('缺口成衣件数（件）').first()).toBeVisible()

  expect(await page.locator('p.font-mono').filter({ hasText: '=' }).count()).toBeGreaterThan(8)

  await expectNoPageErrors(errors)
})
