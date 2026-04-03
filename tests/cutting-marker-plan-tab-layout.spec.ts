import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const EDIT_PLAN_ID = 'seed-marker-plan-original-cut-order-cut-260302-001-01-fold_normal-unbalanced-9'

async function openCreatePage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '从原始裁片单新建' }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '进入新增' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()
}

async function openDetailPage(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const row = page.getByTestId('marker-plan-list-table').locator('tbody tr').first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '查看' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
}

async function assertTabLayout(page: Page, pageTestId: string, activeTabKey: string, activeTabTestId: string): Promise<void> {
  const pageRoot = page.getByTestId(pageTestId)
  await expect(pageRoot).toBeVisible()
  await expect(page.locator('[data-marker-plan-top-shell]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-tab-shell]')).toBeVisible()
  await expect(page.getByTestId('marker-plan-top-info')).toBeVisible()

  const tabLabels = await page.locator('[data-marker-plan-tab-trigger]').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim() || ''),
  )
  expect(tabLabels).toEqual(['基础与配比', '来源分配', '裁片拆解', '排版计划', '图片与变更'])

  await page.locator(`[data-marker-plan-tab-trigger="${activeTabKey}"]`).evaluate((node: HTMLElement) => node.click())
  const content = page.getByTestId(activeTabTestId)
  await expect(content).toBeVisible()

  const topInfoBox = await page.locator('[data-marker-plan-top-shell]').boundingBox()
  const tabShellBox = await page.locator('[data-marker-plan-tab-shell]').boundingBox()
  const contentBox = await content.boundingBox()

  expect(topInfoBox).not.toBeNull()
  expect(tabShellBox).not.toBeNull()
  expect(contentBox).not.toBeNull()

  if (topInfoBox && tabShellBox && contentBox) {
    expect(tabShellBox.y).toBeGreaterThanOrEqual(topInfoBox.y + topInfoBox.height - 1)
    expect(contentBox.y).toBeGreaterThanOrEqual(tabShellBox.y + tabShellBox.height - 1)
  }
}

test('新增、编辑、详情三页的页签导航条都完整位于顶部信息区下方', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreatePage(page)
  await assertTabLayout(page, 'cutting-marker-plan-create-page', 'basic', 'marker-plan-basic-tab')

  await page.goto(`/fcs/craft/cutting/marker-edit/${EDIT_PLAN_ID}`)
  await assertTabLayout(page, 'cutting-marker-plan-edit-page', 'allocation', 'marker-plan-allocation-tab')

  await openDetailPage(page)
  await assertTabLayout(page, 'cutting-marker-plan-detail-page', 'basic', 'marker-plan-basic-detail-tab')

  await expectNoPageErrors(errors)
})
