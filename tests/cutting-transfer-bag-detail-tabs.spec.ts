import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('周转口袋详情页收敛为轻量页签，并保留真实二维码', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()

  const currentTab = page.getByRole('tab', { name: '本次装袋情况', exact: true })
  await expect(currentTab).toBeVisible()
  await expect(currentTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: '过往周转记录', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '周转口袋回收', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '操作日志', exact: true })).toBeVisible()

  const body = page.locator('body')
  await expect(body).not.toContainText('步骤 1：选择口袋')
  await expect(body).not.toContainText('动作审计')
  await expect(body).not.toContainText('回货审计')
  await expect(body).not.toContainText('异常处理')
  await expect(body).not.toContainText('复用异常')
  await expect(body).not.toContainText('回收仓 / 回收点')

  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()

  await page.getByRole('tab', { name: '操作日志', exact: true }).click()
  await expect(page).toHaveURL(/detailTab=logs/)
  await expect(page.getByRole('tab', { name: '操作日志', exact: true })).toHaveAttribute('aria-selected', 'true')

  await expectNoPageErrors(errors)
})
