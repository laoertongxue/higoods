import { expect, test } from '@playwright/test'

test('查看矩阵在新窗口打开可刷新进入的矩阵详细页', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-release', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: '查看矩阵' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')

  await expect(popup).not.toBe(page)
  await expect(popup).toHaveURL(/\/fcs\/craft\/cutting\/cut-piece-release\?productionOrderId=po-14671&productionOrderNo=PO14671$/)
  await expect(popup.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  const detailHeader = popup.locator('[data-cut-piece-release-detail-header]')
  await expect(detailHeader).toBeVisible()
  await expect(detailHeader.getByRole('link', { name: '返回裁片放行管理' })).toBeVisible()
  await expect(popup.getByRole('heading', { level: 1, name: '裁片放行矩阵详情' })).toBeVisible()
  await expect(detailHeader).toContainText('PO14671 · ASYSA26060310 · 女式基础圆领短袖')
  await expect(popup.locator('[data-testid="cut-piece-release-color-matrix"]')).toHaveCount(4)
  await expect(popup.locator('[data-testid="cut-piece-release-color-matrix"]').first()).toBeVisible()
  await expect(popup.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
  await expect(popup.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await expect(page.locator('[data-cut-piece-release-matrix-panel]')).toHaveCount(0)

  await popup.reload({ waitUntil: 'domcontentloaded' })
  await expect(popup.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await expect(popup.locator('[data-cut-piece-release-detail-header]')).toBeVisible()
  await expect(popup.getByRole('heading', { level: 1, name: '裁片放行矩阵详情' })).toBeVisible()
  await expect(popup.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()

  await popup.getByRole('link', { name: '返回裁片放行管理' }).click()
  await expect(popup).toHaveURL(/\/fcs\/craft\/cutting\/cut-piece-release$/)
  await expect(popup.getByRole('heading', { level: 1, name: '裁片放行管理' })).toBeVisible()
})

test('关闭带瞬态的矩阵窗口后可从原列表重新打开干净详情', async ({ page }) => {
  const openerErrors: string[] = []
  const popupErrors: string[] = []
  page.on('pageerror', (error) => openerErrors.push(error.message))
  page.context().on('page', (child) => {
    if (child !== page) child.on('pageerror', (error) => popupErrors.push(error.message))
  })

  await page.goto('/fcs/craft/cutting/cut-piece-release', { waitUntil: 'domcontentloaded' })
  const openerUrl = page.url()
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()

  const firstPopupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: '查看矩阵' }).click()
  const firstPopup = await firstPopupPromise
  await firstPopup.waitForLoadState('domcontentloaded')
  await expect(firstPopup.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await firstPopup.getByRole('button', { name: '重新选择目标' }).click()
  await expect(firstPopup.getByRole('button', { name: '确认目标' })).toBeVisible()
  await firstPopup.locator('[data-testid="cell-Black-M-B"]').click()
  await expect(firstPopup.locator('[data-testid="cut-piece-release-cell-drawer"]')).toBeVisible()
  await expect(page).toHaveURL(openerUrl)
  await expect(page.locator('[data-cut-piece-release-matrix-panel]')).toHaveCount(0)

  await firstPopup.close()
  expect(firstPopup.isClosed()).toBe(true)
  await expect(page).toHaveURL(openerUrl)
  const search = page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })
  await search.fill('PO14671')
  await search.press('Enter')
  await expect(page.locator('tbody tr').filter({ hasText: 'PO14671' }).first()).toBeVisible()

  const secondPopupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: '查看矩阵' }).click()
  const secondPopup = await secondPopupPromise
  await secondPopup.waitForLoadState('domcontentloaded')
  await expect(secondPopup.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await expect(secondPopup.locator('[data-testid="cut-piece-release-history-drawer"]')).toHaveCount(0)
  await expect(secondPopup.locator('[data-testid="cut-piece-release-cell-drawer"]')).toHaveCount(0)
  await expect(secondPopup.getByRole('button', { name: '重新选择目标' })).toBeVisible()
  await expect(secondPopup.getByRole('button', { name: '确认目标' })).toHaveCount(0)
  await expect(secondPopup.locator('[data-testid="cut-piece-release-target-summary"]')).toContainText('目标已保存')
  await expect(page).toHaveURL(openerUrl)
  expect(openerErrors).toEqual([])
  expect(popupErrors).toEqual([])
  await secondPopup.close()
})
