import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function clickMarkerPlanTab(page: import('@playwright/test').Page, tabKey: string) {
  await page.locator(`[data-marker-plan-tab-trigger="${tabKey}"]`).evaluate((node: HTMLElement) => node.click())
}

async function openCreateFromOriginalContext(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '从原始裁片单新建' }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '进入新增' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()
}

test('唛架新增页字段控件类型准确，详情页保持只读呈现', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreateFromOriginalContext(page)
  const createPage = page.getByTestId('cutting-marker-plan-create-page')
  const basicTab = page.getByTestId('marker-plan-basic-tab')
  await expect(basicTab.locator('label:has-text("唛架编号") input[type="text"]')).toBeVisible()
  await expect(basicTab.locator('label:has-text("唛架模式") select')).toBeVisible()
  await expect(basicTab.locator('label:has-text("计划铺布层数（层）") input[type="number"]')).toBeVisible()
  await expect(basicTab.locator('label:has-text("唛架净长度（m）") input[type="number"]')).toBeVisible()
  await expect(basicTab.locator('[data-marker-plan-control-type="readonly"]').filter({ hasText: '唛架成衣件数（件）' })).toBeVisible()
  await expect(basicTab.locator('input[data-marker-plan-basic-field="manualUnitUsage"][type="number"]')).toBeVisible()
  await expect(basicTab.locator('label:has-text("备注") textarea')).toBeVisible()

  await clickMarkerPlanTab(page, 'allocation')
  const allocationTab = page.getByTestId('marker-plan-allocation-tab')
  const allocationRow = allocationTab.locator('tbody tr').nth(0)
  await expect(allocationRow.locator('select[data-marker-plan-allocation-field="sourceCutOrderId"]')).toBeVisible()
  await expect(allocationRow.locator('select[data-marker-plan-allocation-field="sizeCode"]')).toBeVisible()
  await expect(allocationRow.locator('input[data-marker-plan-allocation-field="garmentQty"][type="number"]')).toBeVisible()
  await expect(allocationRow.locator('select[data-marker-plan-allocation-field="specialFlags"]')).toBeVisible()
  await expect(allocationRow.locator('input[data-marker-plan-allocation-field="note"][type="text"]')).toBeVisible()

  await clickMarkerPlanTab(page, 'layout')
  await expect(createPage.locator('input[data-marker-plan-layout-field="markerLength"][type="number"]').first()).toBeVisible()
  await expect(createPage.locator('input[data-marker-plan-layout-field="layoutCode"][type="text"]').first()).toBeVisible()

  await page.getByRole('button', { name: '保存并查看详情' }).click()
  const detailPage = page.getByTestId('cutting-marker-plan-detail-page')
  await expect(detailPage).toBeVisible()
  await expect(detailPage.locator('input')).toHaveCount(0)
  await expect(detailPage.locator('textarea')).toHaveCount(0)
  await expect(detailPage.locator('select')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
