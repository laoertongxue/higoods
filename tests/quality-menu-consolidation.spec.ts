import { expect, test } from '@playwright/test'

test.describe('质检记录菜单合并', () => {
  test('FCS 只保留质检记录汇总入口，扣款记录归入对账与结算', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/fcs/workbench/overview')
    await expect(page.locator('body')).toContainText('平台运营系统')

    await page.getByRole('button', { name: '质检管理' }).click()
    await expect(page.getByRole('button', { name: '质检记录汇总' })).toBeVisible()
    const additionalMenu = page.getByRole('button', { name: '附加质检标准' })
    await expect(additionalMenu).toBeVisible()
    await expect(additionalMenu.locator('[data-menu-item-icon] svg')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '质量与扣款' })).toHaveCount(0)

    await page.getByRole('button', { name: '对账与结算' }).click()
    await expect(page.getByRole('button', { name: '扣款记录' })).toBeVisible()

    await page.goto('/fcs/quality-management/records')
    await expect(page.locator('h1').first()).toContainText('质检记录汇总')
    const viewTabs = page.locator('nav[aria-label="质检记录视图"]')
    await expect(viewTabs.getByRole('button', { name: '平台质检工作台' })).toBeVisible()

    await viewTabs.getByRole('button', { name: '平台质检工作台' }).click()
    await expect(page).toHaveURL(/\/fcs\/quality\/qc-records/)
    await expect(page.locator('h1').first()).toContainText('平台质检工作台')
    await expect(page.locator('[data-action="activate-tab"]', { hasText: '平台质检工作台' })).toBeVisible()
    await expect(page.locator('nav[aria-label="质检记录视图"]').getByRole('button', { name: '质检记录汇总' })).toBeVisible()
    await expect(page.getByRole('button', { name: '质量与扣款' })).toHaveCount(0)

    await page.locator('nav[aria-label="质检记录视图"]').getByRole('button', { name: '质检记录汇总' }).click()
    await expect(page).toHaveURL(/\/fcs\/quality-management\/records/)
    await expect(page.locator('h1').first()).toContainText('质检记录汇总')

    await page.goto('/fcs/quality/deduction-analysis')
    await expect(page.locator('h1').first()).toContainText('扣款记录')

    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/fcs/quality-management/records')
    await expect(page.locator('nav[aria-label="质检记录视图"]').getByRole('button', { name: '平台质检工作台' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
})
