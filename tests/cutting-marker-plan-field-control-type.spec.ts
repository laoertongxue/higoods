import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCreatePage(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '新建唛架方案' }).click()
  const createPage = page.getByTestId('cutting-marker-plan-create-page')
  await expect(createPage).toBeVisible()
  const selection = page.getByTestId('marker-plan-create-cut-order-selection')
  await selection.locator('tbody input[type="checkbox"]').first().check()
  await selection.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByTestId('marker-plan-combination-rule-step')).toBeVisible()
}

test('唛架新建四步流程的字段控件类型准确，详情页保持只读呈现', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreatePage(page)
  const createPage = page.getByTestId('cutting-marker-plan-create-page')
  const combinationStep = page.getByTestId('marker-plan-combination-rule-step')
  await expect(combinationStep.locator('[data-marker-plan-control-type="readonly"]')).toHaveCount(6)

  await page.getByTestId('marker-plan-create-step-nav').locator('[data-create-step="layout"]').click()
  const layoutTab = page.getByTestId('marker-plan-layout-tab-normal')
  await expect(layoutTab.locator('input[data-marker-plan-basic-field="singleSpreadFixedLoss"][type="number"]')).toBeVisible()
  await expect(layoutTab.locator('input[data-marker-plan-basic-field="manualUnitUsage"][type="number"]')).toBeVisible()
  await expect(layoutTab.locator('input[data-marker-plan-bed-field="bedNo"][type="text"]')).toBeVisible()
  await expect(layoutTab.locator('select[data-marker-plan-bed-field="bedMode"]')).toBeVisible()
  await expect(layoutTab.locator('input[data-marker-plan-bed-field="remark"][type="text"]')).toBeVisible()
  await expect(layoutTab.locator('input[data-marker-plan-bed-field="markerLength"][type="number"]')).toBeVisible()
  await expect(layoutTab.locator('[data-marker-plan-control-type="readonly"]')).not.toHaveCount(0)

  await page.goto('/fcs/craft/cutting/marker-list')
  const row = page.getByTestId('marker-plan-list-table').locator('tbody tr').first()
  await row.getByRole('button', { name: '查看' }).click()
  const detailPage = page.getByTestId('cutting-marker-plan-detail-page')
  await expect(detailPage).toBeVisible()
  await expect(detailPage.locator('input')).toHaveCount(0)
  await expect(detailPage.locator('textarea')).toHaveCount(0)
  await expect(detailPage.locator('select')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
