import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test('后道阶段字典、实际工序单与质检单统一使用烫包', async ({ page }) => {
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  await page.locator('[data-craft-dict-field="keyword"]').fill('烫包')
  const craftRows = page.locator('tbody tr').filter({ hasText: '烫包' })
  await expect(craftRows).toHaveCount(1)
  await expect(craftRows.first()).toContainText('后道阶段')
  await expect(craftRows.first()).toContainText('成衣')

  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.getByRole('heading', { name: '实际工序单', exact: true })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: '烫包' }).first()).toBeVisible()

  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '创建质检单', exact: true }).nth(1).click()
  const qcSkuRow = page.locator('[data-qc-quick-source-row]').first()
  const buttonhole = qcSkuRow.locator('[data-qc-quick-post-project][value="开扣眼"]')
  const ironPack = qcSkuRow.locator('[data-qc-quick-post-project][value="烫包"]')
  await expect(ironPack).toBeVisible()
  await buttonhole.check()
  await expect(ironPack).toBeChecked()
  await expect(ironPack).toBeDisabled()
})
