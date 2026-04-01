import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度页覆盖部分完成场景且当前进展不再截断', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()
  await expect(table).not.toContainText('+1 项')
  await expect(table).not.toContainText('+2 项')
  await expect(table).not.toContainText('+3 项')

  const mixedRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-081' }).first()
  await expect(mixedRow).toBeVisible()
  await expect(mixedRow.locator('td').nth(8)).toContainText('SKU-001-M-WHT')
  await expect(mixedRow.locator('td').nth(8)).toContainText('SKU-001-L-WHT')
  await expect(mixedRow.locator('td').nth(8)).toContainText('SKU-001-M-BLK')
  await expect(mixedRow.locator('td').nth(8)).toContainText('SKU-001-L-BLK')

  await mixedRow.getByRole('button', { name: '查看详情' }).click()

  const drawer = page.locator('.fixed.inset-0.z-50').filter({
    has: page.getByRole('heading', { name: '生产单详情' }),
  })
  await expect(drawer).toBeVisible()

  const currentProgressSection = drawer.locator('section').filter({ hasText: '当前进展' }).first()
  await expect(currentProgressSection).toContainText('已齐套')
  await expect(currentProgressSection).toContainText(/待配料 \/ 待领料|裁片未齐|裁完待入仓|入仓数据待补/)

  const sourceOrderSection = drawer.locator('section').filter({ hasText: '来源裁片单' }).first()
  await expect(sourceOrderSection).toContainText('已齐套')
  await expect(sourceOrderSection).toContainText(/待配料 \/ 待领料|裁片未齐|裁完待入仓|入仓数据待补/)

  const partGapSection = drawer.locator('section').filter({ hasText: '部位差异' }).first()
  await expect(partGapSection).toContainText('已完成部位片数')
  await expect(partGapSection).toContainText('未完成部位片数')
  expect(await partGapSection.locator('tbody tr').count()).toBeGreaterThan(0)

  await expectNoPageErrors(errors)
})
