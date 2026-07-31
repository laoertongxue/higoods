import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋详情按事实分区，不再保留旧三步操作卡', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible({
    timeout: 120_000,
  })

  const currentTab = page.getByRole('tab', { name: '基本信息', exact: true })
  await expect(currentTab).toBeVisible()
  await expect(currentTab).toHaveAttribute('aria-selected', 'true')

  const body = page.locator('body')
  await expect(body).toContainText('当前状态')
  await expect(body).toContainText('当前流转阶段')
  await expect(body).toContainText('当前使用周期')

  await expect(body).not.toContainText('步骤 1：选择口袋')
  await expect(body).not.toContainText('请选择口袋')
  await expect(body).not.toContainText('绑定任务')
  await expect(body).not.toContainText('签收')
  await expect(body).not.toContainText('输入或扫描中转袋码')

  await expect(page.locator('[data-bagging-step]')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '入仓记录', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '袋级交出', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '物理回收', exact: true })).toBeVisible()

  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
