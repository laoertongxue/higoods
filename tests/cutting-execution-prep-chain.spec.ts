import { expect, test } from '@playwright/test'

test('仓库配料领料页正常打开并围绕原始裁片单展示', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/material-prep')

  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('原始裁片单号')
  await expect(page.locator('body')).toContainText('面料摘要')
  await expect(page.locator('body')).toContainText('领料异议')
})

test('唛架铺布页正常打开，详情与编辑入口仍可用', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/marker-spreading')

  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('高低层模式')
  await expect(page.locator('body')).toContainText(/对折.*模式/)
  await page.locator('[data-cutting-marker-action="set-tab"][data-tab="spreadings"]').click()

  const detailButton = page.locator('[data-cutting-marker-action="open-spreading-detail"]').first()
  await expect(detailButton).toBeVisible()
  await detailButton.click()
  await expect(page.locator('body')).toContainText('铺布详情')

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await page.locator('[data-cutting-marker-action="set-tab"][data-tab="spreadings"]').click()
  const editButton = page.locator('[data-cutting-marker-action="open-spreading-edit"]').first()
  await expect(editButton).toBeVisible()
  await editButton.click()
  await expect(page.getByRole('heading', { name: '铺布编辑', exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="save-spreading"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="save-spreading-and-view"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="cancel-spreading-edit"]')).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="guide-marker-import"]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-marker-action="show-marker-import-status"]')).toHaveCount(0)
})

test('三类仓页正常打开且不依赖旧仓库总页', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/fabric-warehouse')
  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU')

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('原始裁片单号')
  await expect(page.locator('body')).not.toContainText('仓库总页')

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU / 款号')
})

test('补料页正常打开且补料建议来自正式上下文', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/replenishment')

  await expect(page.getByRole('heading', { name: '补料管理', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-replenish-action="open-detail"]').first()).toBeVisible()
  await page.locator('[data-cutting-replenish-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('补料详情')
  await expect(page.locator('body')).toContainText('补料依据')
  await expect(page.locator('body')).toContainText('面料 SKU')
})

test('特殊工艺页正常打开且不再泛化洗水占位工艺单', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/special-processes')

  await expect(page.getByRole('heading', { name: '特殊工艺', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('捆条工艺')
  await expect(page.locator('body')).not.toContainText('SP-20260324-002')
})

test('执行准备链 UI 骨架保持稳定，没有被顺手大改', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-prep-action="go-marker-spreading-index"]')).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-marker-action="open-marker-detail"]').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { name: '补料管理', exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-replenish-action="go-marker-index"]')).toBeVisible()

  await page.goto('/fcs/craft/cutting/special-processes')
  await expect(page.getByRole('heading', { name: '特殊工艺', exact: true })).toBeVisible()
  await expect(page.locator('[data-special-process-action="go-summary-index"]')).toBeVisible()
})
