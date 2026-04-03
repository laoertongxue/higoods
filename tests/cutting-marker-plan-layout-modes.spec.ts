import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function clickMarkerPlanTab(page: Page, tabKey: string): Promise<void> {
  await page.locator(`[data-marker-plan-tab-trigger="${tabKey}"]`).evaluate((node: HTMLElement) => node.click())
}

async function openPlanDetailByMode(page: Page, modeLabel: string): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  let row = page
    .getByTestId('marker-plan-list-table')
    .locator('tbody tr')
    .filter({ hasText: modeLabel })

  if (modeLabel === '普通模式') {
    row = row.filter({ hasNotText: '对折-普通模式' })
  }
  if (modeLabel === '高低层模式') {
    row = row.filter({ hasNotText: '对折-高低层模式' })
  }
  row = row.first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '查看' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
  await clickMarkerPlanTab(page, 'layout')
}

test('四种唛架模式在排版计划页签中展示不同结构', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openPlanDetailByMode(page, '普通模式')
  await expect(page.getByTestId('marker-plan-layout-tab-normal')).toBeVisible()
  await expect(page.getByText('排版线', { exact: true })).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toHaveCount(0)
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toHaveCount(0)
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toHaveCount(0)

  await openPlanDetailByMode(page, '高低层模式')
  await expect(page.getByTestId('marker-plan-layout-tab-high_low')).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toBeVisible()
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toHaveCount(0)

  await openPlanDetailByMode(page, '对折-普通模式')
  await expect(page.getByTestId('marker-plan-layout-tab-fold_normal')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByText('排版线', { exact: true })).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toHaveCount(0)
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toHaveCount(0)

  await openPlanDetailByMode(page, '对折-高低层模式')
  await expect(page.getByTestId('marker-plan-layout-tab-fold_high_low')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toBeVisible()
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toBeVisible()

  await expectNoPageErrors(errors)
})
