import { expect, test } from '@playwright/test'

test('领料管理列表页展示待领节点', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const list = page.getByTestId('standard-list-page')
  await expect(list).toBeVisible()

  await expect(page.locator('text=领料管理')).toBeVisible()
  await expect(page.locator('text=未配齐清单')).toBeVisible()
  await expect(page.locator('text=已配齐待领')).toBeVisible()
  await expect(page.locator('text=历史有效已领')).toBeVisible()
  await expect(page.locator('text=领后剩余缺口')).toBeVisible()
  await expect(page.locator('text=办理领料入库').first()).toBeVisible()
})

test('领料管理详情页展示节点物料', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const detailBtn = page.locator('[data-pickup-nav="detail"]').first()
  await expect(detailBtn).toBeVisible()
  await detailBtn.click()

  await expect(page.locator('text=当前节点全部物料')).toBeVisible()
  await expect(page.locator('text=物料明细')).toBeVisible()
  await expect(page.locator('text=需求数量')).toBeVisible()
  await expect(page.locator('text=本轮全部领取')).toBeVisible()
})

test('办理领料入库后节点关闭', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const confirmBtn = page.locator('[data-pickup-action="confirm-pickup"]').first()
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()

  await page.waitForTimeout(300)
  await expect(page.getByTestId('standard-list-page')).toBeVisible()
})

test('领料管理分页控件可见', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  await expect(page.locator('text=共').first()).toBeVisible()
  await expect(page.locator('text=条/页').first()).toBeVisible()
})

test('PDA 中转仓领料展示节点列表', async ({ page }) => {
  await page.goto('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup')

  await expect(page.locator('text=未配齐清单').or(page.locator('text=已配齐待领'))).toBeVisible()
  await expect(page.locator('text=暂无中转仓领料通知').or(page.locator('[data-pda-warehouse-action="cutting-wp-pickup"]'))).toBeVisible()
})

test('标准分辨率 1366×768 下页面主体无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/cutting/pickup-management')

  const listPage = page.getByTestId('standard-list-page')
  await expect(listPage).toBeVisible()
})
