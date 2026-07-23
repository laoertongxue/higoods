import { expect, test } from '@playwright/test'

async function loginPda(page: import('@playwright/test').Page, returnTo: string): Promise<void> {
  await page.goto(`/fcs/pda/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  await page.locator('[data-pda-login-field="loginId"]').fill('F090_operator')
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await page.waitForURL((url) => url.pathname === returnTo.split('?')[0])
}

test('领料管理列表页展示待领节点', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const list = page.locator('[data-standard-list-page]')
  await expect(list).toBeVisible()

  await expect(page.getByRole('heading', { name: '领料管理', exact: true })).toBeVisible()
  await expect(list.getByText('未配齐清单', { exact: true }).first()).toBeVisible()
  await expect(list.getByText('已配齐待领', { exact: true }).first()).toBeVisible()
  await expect(list.getByRole('columnheader', { name: /历史有效已领/ })).toBeVisible()
  await expect(list.getByRole('columnheader', { name: /领后剩余缺口/ })).toBeVisible()
  await expect(list.getByRole('button', { name: '办理领料入库' }).first()).toBeVisible()
})

test('领料管理详情页展示节点物料', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const detailBtn = page.locator('[data-nav*="/fcs/craft/cutting/pickup-management-detail"]').first()
  await expect(detailBtn).toBeVisible()
  await detailBtn.click()

  await expect(page.locator('text=当前节点全部物料')).toBeVisible()
  await expect(page.locator('text=物料明细')).toBeVisible()
  await expect(page.locator('text=需求数量')).toBeVisible()
  await expect(page.locator('text=本轮全部领取')).toBeVisible()
})

test('办理领料入库后节点关闭', async ({ page }) => {
  let errorDialog = ''
  page.on('dialog', async (dialog) => {
    errorDialog = dialog.message()
    await dialog.dismiss()
  })
  await page.goto('/fcs/craft/cutting/pickup-management')

  const activeList = page.locator('[data-standard-list-page]:visible')
  const readyRow = activeList.getByRole('row').filter({ hasText: '已配齐待领' }).first()
  const confirmBtn = readyRow.locator('[data-pickup-action="confirm-pickup"]')
  const nodeCountHeading = page.getByRole('heading', { name: /^待领节点（\d+）$/ }).first()
  await expect(confirmBtn).toBeVisible()
  const initialHeading = await nodeCountHeading.textContent()
  const activeNodeCount = Number(initialHeading?.match(/\d+/)?.[0] || 0)
  expect(activeNodeCount).toBeGreaterThan(0)
  await confirmBtn.click()
  expect(errorDialog).toBe('')

  await expect(activeList).toBeVisible()
  await page.reload()
  await expect.poll(() => page.locator('h2').allTextContents()).toContain(
    `待领节点（${activeNodeCount - 1}）`,
  )
})

test('领料管理分页控件可见', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const pagination = page.locator('[data-pickup-region="pagination"]')
  await expect(pagination.getByText(/共 \d+ 条/)).toBeVisible()
  await expect(pagination.locator('select')).toBeVisible()
})

test('PDA 中转仓领料展示节点列表', async ({ page }) => {
  const target = '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup'
  await loginPda(page, target)

  await expect(page.getByText('未配齐清单', { exact: true }).or(page.getByText('已配齐待领', { exact: true })).first()).toBeVisible()
  await expect(page.getByText('暂无中转仓领料通知', { exact: true }).or(page.locator('[data-pda-warehouse-action="cutting-wp-pickup"]')).first()).toBeVisible()
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}×${viewport.height} 下页面主体无横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/craft/cutting/pickup-management')

    const listPage = page.locator('[data-standard-list-page]')
    await expect(listPage).toBeVisible()
    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      listRight: document.querySelector('[data-standard-list-page]')?.getBoundingClientRect().right ?? 0,
    }))
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.listRight).toBeLessThanOrEqual(overflow.viewportWidth)
  })
}
