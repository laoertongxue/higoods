import { expect, test, type Page } from '@playwright/test'

function attachPageErrorCollector(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoRuntimeErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

test('已发布技术包需求才能进入正式生成链', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/production/orders')
  await expect(page.locator('body')).toContainText('生产单管理')
  await page.getByRole('button', { name: '从需求生成' }).click()

  const dialog = page.locator('[data-dialog-panel="true"]').last()
  await expect(dialog).toContainText('仅支持已发布技术包且状态为待转单的需求')
  await expect(dialog).toContainText('DEM-202603-0001')
  await expect(dialog).not.toContainText('DEM-202603-0002')

  await expectNoRuntimeErrors(errors)
})

test('合法 production order 详情可展示真实需求快照与技术包快照', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/production/orders/PO-202603-081')
  await expect(page.locator('body')).toContainText('生产单管理')
  await expect(page.locator('body')).toContainText('PO-202603-081')

  await page.getByRole('button', { name: '需求快照' }).click()
  await expect(page.locator('body')).toContainText('需求编号')
  await expect(page.locator('body')).toContainText('DEM-202603-0081')
  await expect(page.locator('body')).toContainText('SPU-TSHIRT-081')

  await page.getByRole('button', { name: '技术包', exact: true }).click()
  await expect(page.locator('body')).toContainText('快照信息')
  await expect(page.locator('body')).toContainText('版本')

  await expectNoRuntimeErrors(errors)
})

test('production order 对应的原始裁片单可正常渲染', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/craft/cutting/original-orders?productionOrderId=PO-202603-081')
  await expect(page.locator('body')).toContainText('原始裁片单主表')
  await expect(page.locator('body')).toContainText('PO-202603-081')
  await expect(page.locator('body')).toContainText('CUT-')
  await expect(page.locator('body')).not.toContainText('暂无数据')

  await expectNoRuntimeErrors(errors)
})

test('可裁排产页在上游链重构后仍能正常打开', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await expect(page.locator('body')).toContainText('返回生产单进度')
  await expect(page.locator('body')).toContainText('去合并裁剪批次')
  await expect(page.locator('body')).toContainText('CUT-')

  await expectNoRuntimeErrors(errors)
})

test('脏 seed 不会再被当成正式 production order 保活', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/production/orders')
  await expect(page.locator('body')).not.toContainText('PO-202603-0011')
  await expect(page.locator('body')).not.toContainText('PO-202603-0012')
  await expect(page.locator('body')).not.toContainText('PO-202603-0013')

  await page.getByRole('button', { name: '从需求生成' }).click()
  const dialog = page.locator('[data-dialog-panel="true"]').last()
  await expect(dialog).not.toContainText('DEM-202603-0002')

  await expectNoRuntimeErrors(errors)
})
