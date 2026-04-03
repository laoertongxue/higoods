import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const UNBALANCED_PLAN_ID = 'seed-marker-plan-original-cut-order-cut-260302-001-01-fold_normal-unbalanced-9'
const READY_PLAN_ID = 'seed-marker-plan-original-cut-order-cut-260303-002-01-fold_normal-ready-11'
const REFERENCED_PLAN_ID = 'seed-marker-plan-merge-batch-seed-mb-260403-081-lining-high_low-mapping-3'

async function clickMarkerPlanTab(page: import('@playwright/test').Page, tabKey: string) {
  await page.locator(`[data-marker-plan-tab-trigger="${tabKey}"]`).evaluate((node: HTMLElement) => node.click())
}

test('编辑页会默认落到问题 tab，并支持保存草稿、保存并留在当前页、完成计划、返回详情', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto(`/fcs/craft/cutting/marker-edit/${UNBALANCED_PLAN_ID}`)
  await expect(page.getByTestId('cutting-marker-plan-edit-page')).toBeVisible()
  await expect(page.getByTestId('marker-plan-allocation-tab')).toBeVisible()
  await expect(page.getByRole('button', { name: '返回详情' })).toBeVisible()

  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText(/已保存草稿/)).toBeVisible()

  await page.goto(`/fcs/craft/cutting/marker-edit/${READY_PLAN_ID}`)
  await expect(page.getByTestId('marker-plan-basic-tab')).toBeVisible()
  await expect(page.getByTestId('marker-plan-top-info').getByText(/m\/件 =/).first()).toBeVisible()

  await page.getByRole('button', { name: '保存并留在当前页' }).click()
  await expect(page.getByText(/已保存修改/)).toBeVisible()

  await page.getByRole('button', { name: '完成计划' }).click()
  await expect(page.getByText(/已完成唛架计划/)).toBeVisible()

  await page.getByRole('button', { name: '返回详情' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/craft/cutting/marker-detail/${READY_PLAN_ID}`))

  await expectNoPageErrors(errors)
})

test('已被铺布引用的唛架会显示页内 warning，结构性修改前需要确认，模式切换会清空不兼容排版', async ({ page }) => {
  const errors = collectPageErrors(page)

  const dialogs: string[] = []
  const dialogHandler = async (dialog: { message(): string; accept(): Promise<void> }) => {
    dialogs.push(dialog.message())
    await dialog.accept()
  }
  page.on('dialog', dialogHandler)

  await page.goto(`/fcs/craft/cutting/marker-edit/${REFERENCED_PLAN_ID}`)
  await expect(page.getByText('当前唛架已被铺布引用。若修改配比、分配、排版结构，建议复制为新唛架。')).toBeVisible()
  await expect(page.getByTestId('marker-plan-explosion-tab')).toBeVisible()

  await clickMarkerPlanTab(page, 'basic')
  const sizeRatioInput = page.locator('[data-marker-plan-action="change-size-ratio"][data-size-code="S"]')
  const originalSizeRatio = await sizeRatioInput.inputValue()
  await sizeRatioInput.fill(String((Number.parseInt(originalSizeRatio || '0', 10) || 0) + 1))
  await expect.poll(() => dialogs.length).toBeGreaterThan(0)

  await clickMarkerPlanTab(page, 'layout')
  await page.getByRole('button', { name: '新增模式明细' }).click()
  await clickMarkerPlanTab(page, 'basic')
  const markerModeSelect = page.locator('[data-marker-plan-basic-field="markerMode"]')
  await markerModeSelect.selectOption('normal')
  await expect(markerModeSelect).toHaveValue('normal')

  page.off('dialog', dialogHandler)
  await expectNoPageErrors(errors)
})

test('编辑页支持交给铺布、复制为新唛架和作废', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto(`/fcs/craft/cutting/marker-edit/${READY_PLAN_ID}`)
  await expect(page.getByRole('button', { name: '交给铺布' })).toBeVisible()
  await page.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list/)

  await page.goto(`/fcs/craft/cutting/marker-edit/${READY_PLAN_ID}`)
  await page.getByRole('button', { name: '复制为新唛架' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-create\?copyFrom=/)

  await page.goto(`/fcs/craft/cutting/marker-edit/${READY_PLAN_ID}`)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '作废' }).click()
  await expect(page.getByText(/已作废唛架/)).toBeVisible()
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('已作废')

  await expectNoPageErrors(errors)
})
