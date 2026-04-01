import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('周转口袋详情页的本次装袋情况改为步骤式操作卡片', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()

  const currentTab = page.getByRole('tab', { name: '本次装袋情况', exact: true })
  await expect(currentTab).toBeVisible()
  await expect(currentTab).toHaveAttribute('aria-selected', 'true')

  const body = page.locator('body')
  await expect(body).toContainText('绑定任务')
  await expect(body).toContainText('装袋绑定')
  await expect(body).toContainText('核对并完成装袋')
  await expect(body).toContainText('发出')
  await expect(body).toContainText('签收')

  await expect(body).not.toContainText('步骤 1：选择口袋')
  await expect(body).not.toContainText('请选择口袋')
  await expect(body).not.toContainText('输入或扫描周转口袋码')

  await expect(page.locator('[data-bagging-step]')).toHaveCount(5)
  await expect(page.locator('[data-bagging-step][open]')).toHaveCount(1)
  await expect(page.locator('[data-bagging-step="dispatch"]')).toHaveAttribute('open', '')

  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()

  await expect(page.locator('#transfer-bag-tabpanel-history')).toHaveCount(0)
  await expect(page.locator('#transfer-bag-tabpanel-recovery')).toHaveCount(0)
  await expect(page.locator('#transfer-bag-tabpanel-logs')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
