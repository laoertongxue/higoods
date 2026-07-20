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
  await expect(popup.locator('[data-testid="cut-piece-release-color-matrix"]')).toBeVisible()
  await expect(popup.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
  await expect(popup.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await expect(page.locator('[data-cut-piece-release-matrix-panel]')).toHaveCount(0)

  await popup.reload({ waitUntil: 'domcontentloaded' })
  await expect(popup.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await expect(popup.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
})
