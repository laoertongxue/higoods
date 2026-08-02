import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('唛架方案列表页展示当前筛选、统计、方案表格与新建入口', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')

  await expect(page.getByTestId('cutting-marker-plan-list-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '唛架方案' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建唛架方案' })).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-filters')).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-stats')).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-table')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="keyword"]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="status"]')).toBeVisible()
  const keywordFilter = page.locator('[data-marker-plan-filter-field="keyword"]')
  await keywordFilter.fill('CUT-')
  await expect(keywordFilter).toHaveValue('CUT-')
  await page.locator('[data-marker-plan-filter-field="status"]').selectOption('WAITING_LAYOUT')
  await expect(page.getByTestId('marker-plan-list-state-bar')).toContainText('关键词：CUT-')
  await expect(page.getByTestId('marker-plan-list-state-bar')).toContainText('主状态：待补唛架')
  await page.getByTestId('marker-plan-more-filters').locator('summary').click()
  await expect(page.locator('[data-marker-plan-filter-field="mode"]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="ready"]')).toBeVisible()

  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)
  const table = page.getByTestId('marker-plan-list-table')
  await expect(table).toContainText('唛架方案')
  await expect(table).toContainText('执行去向')
  await expect(table).toContainText('计划数量 / 用量')
  await expect(table).toContainText('风险提示')

  await expect(page.getByTestId('marker-plan-list-tabs')).toHaveCount(0)
  await expect(page.getByTestId('marker-plan-pending-contexts')).toHaveCount(0)
  await expect(page.getByTestId('marker-plan-exception-list')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
