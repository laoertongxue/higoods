import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openBuiltPlanDetail(
  page: import('@playwright/test').Page,
  rowText?: string,
  excludeText?: string,
): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const table = page.getByTestId('marker-plan-list-table')
  let row = table.locator('tbody tr')
  if (rowText) {
    row = row.filter({ hasText: rowText })
  }
  if (excludeText) {
    row = row.filter({ hasNotText: excludeText })
  }
  await expect(row.first()).toBeVisible()
  await row.first().getByRole('button', { name: '查看' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
}

test('唛架页关键系统计算字段都展示公式字符串', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openBuiltPlanDetail(page)
  const detailPage = page.getByTestId('cutting-marker-plan-detail-page')
  await expect(detailPage.getByText(/件 = .*件 \+ .*件/).first()).toBeVisible()
  await expect(detailPage.getByText(/m\/件 = .*m ÷ .*件/).first()).toBeVisible()
  await expect(detailPage.getByText(/m = .*m/).first()).toBeVisible()

  await page.locator('[data-marker-plan-tab-trigger="allocation"]').click()
  await expect(detailPage.getByText(/件 = .*件 - .*件/).first()).toBeVisible()

  await page.locator('[data-marker-plan-tab-trigger="explosion"]').click()
  await expect(detailPage.getByText(/片 = .*片\/件 × .*件/).first()).toBeVisible()

  await openBuiltPlanDetail(page, '普通模式', '对折-普通模式')
  await page.locator('[data-marker-plan-tab-trigger="layout"]').click()
  await expect(page.getByTestId('marker-plan-layout-tab-normal')).toBeVisible()
  await expect(page.getByText(/m\/件 = .*m ÷ .*件/).first()).toBeVisible()
  await expect(page.getByText(/m = \(.+m \+ .+m\) × .+/).first()).toBeVisible()

  await openBuiltPlanDetail(page, '对折-普通模式')
  await page.locator('[data-marker-plan-tab-trigger="layout"]').click()
  await expect(page.getByTestId('marker-plan-layout-tab-fold_normal')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByText(/cm = \(.+cm - .+cm\) ÷ 2/).first()).toBeVisible()

  await openBuiltPlanDetail(page, '高低层模式', '对折-高低层模式')
  await page.locator('[data-marker-plan-tab-trigger="layout"]').click()
  await expect(page.getByTestId('marker-plan-layout-tab-high_low')).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toBeVisible()
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toBeVisible()
  await expect(page.getByText(/件 = .*件 \+ .*件/).first()).toBeVisible()

  await openBuiltPlanDetail(page, '对折-高低层模式')
  await page.locator('[data-marker-plan-tab-trigger="layout"]').click()
  await expect(page.getByTestId('marker-plan-layout-tab-fold_high_low')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toBeVisible()
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toBeVisible()
  await expect(page.getByText(/cm = \(.+cm - .+cm\) ÷ 2/).first()).toBeVisible()
  await expect(page.getByText(/件 = .*件 \+ .*件/).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
