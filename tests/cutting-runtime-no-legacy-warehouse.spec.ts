import { expect, test, type Page } from '@playwright/test'

function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoPageErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

function expectFormalObjectParams(urlString: string): void {
  const url = new URL(urlString)
  const params = url.searchParams
  expect(
    params.has('originalCutOrderId') || params.has('productionOrderId') || params.has('materialSku'),
  ).toBeTruthy()
  expect(params.has('cutPieceOrderNo')).toBeFalsy()
  expect(params.has('relatedProductionOrderNo')).toBeFalsy()
  expect(params.has('relatedCutPieceOrderNo')).toBeFalsy()
}

test('fabric warehouse 正常打开，切掉旧源后仍可渲染', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fabric-warehouse')

  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU')
  await expect(page.locator('[data-fabric-warehouse-action="open-detail"]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

test('cut-piece warehouse 正常打开，过滤和详情入口可用', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')

  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cut-piece-warehouse-field="keyword"]')).toBeVisible()
  await page.locator('[data-cut-piece-warehouse-field="keyword"]').fill('CUT-')
  await expect(page.locator('[data-cut-piece-warehouse-action="open-detail"]').first()).toBeVisible()
  await page.locator('[data-cut-piece-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('裁片仓详情')

  await expectNoPageErrors(errors)
})

test('sample warehouse 正常打开，样衣记录存在且过滤和详情入口可用', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/sample-warehouse')

  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU / 款号')
  await page.locator('[data-sample-warehouse-field="keyword"]').fill('SMP-')
  await expect(page.locator('[data-sample-warehouse-action="open-detail"]').first()).toBeVisible()
  await page.locator('[data-sample-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('样衣仓详情')
  await expect(page.locator('body')).toContainText('流转记录')

  await expectNoPageErrors(errors)
})

test('裁剪总表正式链页面正常打开，不再依赖旧 PO 宇宙', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/summary')

  await expect(page.getByRole('heading', { name: '裁剪总表', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '查看核查' }).first()).toBeVisible()
  await page.getByRole('button', { name: '查看核查' }).first().click()
  await expect(page.locator('body')).toContainText('核查详情')
  await expect(page.locator('body')).toContainText('SKU 情况')

  await expectNoPageErrors(errors)
})

test('仓务相关页 drill-down 继续传正式对象参数，不再依赖 legacy no', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fabric-warehouse')
  await page.locator('[data-fabric-warehouse-action="go-original-orders"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders\?/)
  expectFormalObjectParams(page.url())

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  await page.locator('[data-cut-piece-warehouse-action="open-detail"]').first().click()
  await page.locator('[data-cut-piece-warehouse-action="go-original-orders"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders\?/)
  expectFormalObjectParams(page.url())

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  await page.locator('[data-sample-warehouse-action="open-detail"]').first().click()
  await page.locator('[data-sample-warehouse-action="go-original-orders"]').click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders\?/)
  expectFormalObjectParams(page.url())

  await expectNoPageErrors(errors)
})
