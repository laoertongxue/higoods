import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCreatePage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '新建唛架方案' }).click()
  const createPage = page.getByTestId('cutting-marker-plan-create-page')
  await expect(createPage).toBeVisible()
  const selection = page.getByTestId('marker-plan-create-cut-order-selection')
  await selection.locator('tbody input[type="checkbox"]').first().check()
  await selection.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByTestId('marker-plan-combination-rule-step')).toBeVisible()
}

async function openDetailPage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  const row = page.getByTestId('marker-plan-list-table').locator('tbody tr').first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '查看' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
}

async function openEditPage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  const editButton = page.getByTestId('marker-plan-list-table').getByRole('button', { name: '编辑' }).first()
  await expect(editButton).toBeVisible()
  await editButton.click()
  await expect(page.getByTestId('cutting-marker-plan-edit-page')).toBeVisible()
}

async function assertCreateStepLayout(page: Page, pageTestId: string): Promise<void> {
  const pageRoot = page.getByTestId(pageTestId)
  await expect(pageRoot).toBeVisible()
  const stepNav = page.getByTestId('marker-plan-create-step-nav')
  await expect(stepNav).toBeVisible()
  await expect(stepNav.locator('[data-create-step]')).toHaveText([
    /选择裁片单/,
    /确认组合规则/,
    /维护唛架编号/,
    /确认并保存/,
  ])
  const pageBox = await pageRoot.boundingBox()
  const stepBox = await stepNav.boundingBox()
  expect(pageBox).not.toBeNull()
  expect(stepBox).not.toBeNull()
  if (pageBox && stepBox) expect(stepBox.y).toBeGreaterThan(pageBox.y)
}

test('新增、编辑页使用完整四步导航，详情页使用当前七个业务页签', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreatePage(page)
  await assertCreateStepLayout(page, 'cutting-marker-plan-create-page')

  await openEditPage(page)
  await assertCreateStepLayout(page, 'cutting-marker-plan-edit-page')

  await openDetailPage(page)
  const detailTabs = page.getByTestId('marker-plan-detail-tabs')
  await expect(detailTabs).toBeVisible()
  await expect(detailTabs.getByRole('button')).toHaveText([
    /概览/,
    /来源裁片单/,
    /唛架配置/,
    /物料明细/,
    /铺布流转/,
    /需求匹配/,
    /系统日志/,
  ])

  await expectNoPageErrors(errors)
})
