import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openBuiltPlanDetail(page: import('@playwright/test').Page, rowText?: string): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const table = page.getByTestId('marker-plan-list-table')
  let row = table.locator('tbody tr')
  if (rowText) {
    row = row.filter({ hasText: rowText })
  }
  await expect(row.first()).toBeVisible()
  await row.first().getByRole('button', { name: '查看' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
}

test('唛架详情页使用只读信息块，不再展示 disabled input 大表单，且头部按钮可导航', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openBuiltPlanDetail(page)
  const detailPage = page.getByTestId('cutting-marker-plan-detail-page')
  await expect(detailPage).toBeVisible()
  await expect(detailPage.locator('[data-marker-plan-tab-trigger="basic"]')).toBeVisible()
  await expect(detailPage.locator('[data-marker-plan-tab-trigger="allocation"]')).toBeVisible()
  await expect(detailPage.locator('[data-marker-plan-tab-trigger="explosion"]')).toBeVisible()
  await expect(detailPage.locator('[data-marker-plan-tab-trigger="layout"]')).toBeVisible()
  await expect(detailPage.locator('[data-marker-plan-tab-trigger="images"]')).toBeVisible()

  await expect(detailPage.locator('input')).toHaveCount(0)
  await expect(detailPage.locator('textarea')).toHaveCount(0)
  await expect(detailPage.locator('select')).toHaveCount(0)
  await expect(detailPage.getByText('身份信息')).toBeVisible()
  await expect(detailPage.getByText('计划概况')).toBeVisible()
  await expect(detailPage.getByText('状态信息')).toBeVisible()

  await expect(detailPage.getByRole('button', { name: '返回列表' })).toBeVisible()
  await expect(detailPage.getByRole('button', { name: '去编辑' })).toBeVisible()
  await expect(detailPage.getByRole('button', { name: '复制为新唛架' })).toBeVisible()
  await expect(detailPage.getByRole('button', { name: '去原始裁片单' })).toBeVisible()

  await detailPage.locator('[data-marker-plan-tab-trigger="explosion"]').evaluate((node: HTMLElement) => node.click())
  await expect(detailPage.locator('input')).toHaveCount(0)
  await expect(detailPage.locator('textarea')).toHaveCount(0)
  await expect(detailPage.locator('select')).toHaveCount(0)
  await expect(detailPage.getByText('部位明细表')).toBeVisible()

  await detailPage.getByRole('button', { name: '返回列表' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list/)

  await openBuiltPlanDetail(page)
  await page.getByTestId('cutting-marker-plan-detail-page').getByRole('button', { name: '去编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\//)

  await openBuiltPlanDetail(page)
  await page.getByTestId('cutting-marker-plan-detail-page').getByRole('button', { name: '复制为新唛架' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-create\?copyFrom=/)

  await openBuiltPlanDetail(page)
  await page.getByTestId('cutting-marker-plan-detail-page').getByRole('button', { name: '去原始裁片单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)

  await openBuiltPlanDetail(page, '合并裁剪批次')
  await expect(page.getByTestId('cutting-marker-plan-detail-page').getByRole('button', { name: '去合并裁剪批次' })).toBeVisible()
  await page.getByTestId('cutting-marker-plan-detail-page').getByRole('button', { name: '去合并裁剪批次' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches/)

  await expectNoPageErrors(errors)
})
