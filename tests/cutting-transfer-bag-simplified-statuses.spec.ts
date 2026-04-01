import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('周转口袋流转只展示简化后的主状态与 3 步主流程', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋流转', exact: true })).toBeVisible()

  const body = page.locator('body')
  await expect(page.getByRole('button', { name: /周转口袋总数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /空闲口袋数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /使用中口袋数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /待交出口袋数/ })).toBeVisible()

  await expect(body).not.toContainText('待发出口袋数')
  await expect(body).not.toContainText('已签收')
  await expect(body).not.toContainText('待签收')
  await expect(body).not.toContainText('待回仓')
  await expect(body).not.toContainText('回仓验收中')
  await expect(body).not.toContainText('待维修')
  await expect(body).not.toContainText('待清洁')

  const statusSelect = page.locator('select[data-transfer-bags-master-field="status"]')
  await expect(statusSelect).toContainText('全部')
  await expect(statusSelect).toContainText('空闲')
  await expect(statusSelect).toContainText('使用中')
  await expect(statusSelect).toContainText('待交出')
  await expect(statusSelect).toContainText('已交出')
  await expect(statusSelect).not.toContainText('待发出')
  await expect(statusSelect).not.toContainText('已签收')

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')
  await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()

  await expect(body).toContainText('扫码装袋')
  await expect(body).toContainText('核对完成')
  await expect(body).toContainText('交出')
  await expect(body).not.toContainText('绑定任务')
  await expect(body).not.toContainText('签收')
  await expect(page.locator('[data-bagging-step]')).toHaveCount(3)

  const summaryStrip = page.locator('[data-transfer-bag-summary-strip]')
  await expect(summaryStrip).toContainText('待交出')
  await expect(summaryStrip).not.toContainText('待签收')
  await expect(summaryStrip).not.toContainText('回仓验收中')

  await expectNoPageErrors(errors)
})
