import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCreateLayout(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '新建唛架方案' }).click()
  const selection = page.getByTestId('marker-plan-create-cut-order-selection')
  await selection.locator('tbody input[type="checkbox"]').first().check()
  await selection.getByRole('button', { name: '下一步' }).click()
  await page.getByTestId('marker-plan-create-step-nav').locator('[data-create-step="layout"]').click()
  await expect(page.getByTestId('marker-plan-layout-tab-normal')).toBeVisible()
}

async function switchMode(page: Page, mode: string, expectedTestId: string): Promise<void> {
  await page.locator('select[data-marker-plan-bed-field="bedMode"]').first().selectOption(mode)
  await expect(page.getByTestId(expectedTestId)).toBeVisible()
}

test('四种唛架模式在排版计划页签中展示不同结构', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreateLayout(page)
  await expect(page.getByTestId('marker-plan-layout-tab-normal')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: '阶梯编号' })).toHaveCount(0)
  await expect(page.locator('[data-marker-plan-matrix-row-length]')).toHaveCount(0)

  await switchMode(page, 'high_low', 'marker-plan-layout-tab-high_low')
  await expect(page.getByTestId('marker-plan-layout-tab-high_low')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '阶梯编号' })).toBeVisible()
  await expect(page.locator('[data-marker-plan-matrix-row-length]').first()).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toHaveCount(0)

  await switchMode(page, 'fold_normal', 'marker-plan-layout-tab-fold_normal')
  await expect(page.getByTestId('marker-plan-layout-tab-fold_normal')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '阶梯编号' })).toHaveCount(0)
  await expect(page.locator('[data-marker-plan-matrix-row-length]')).toHaveCount(0)

  await switchMode(page, 'fold_high_low', 'marker-plan-layout-tab-fold_high_low')
  await expect(page.getByTestId('marker-plan-layout-tab-fold_high_low')).toBeVisible()
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '阶梯编号' })).toBeVisible()
  await expect(page.locator('[data-marker-plan-matrix-row-length]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
