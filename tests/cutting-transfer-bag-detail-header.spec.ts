import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋详情页顶部压缩为页头加紧凑摘要带，并补齐非当前页签 mock', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  const pageHeader = page.locator('[data-transfer-bag-page-header]')
  await expect(pageHeader).toBeVisible({ timeout: 120_000 })
  await expect(pageHeader.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible()
  await expect(pageHeader.getByRole('button', { name: '返回中转袋流转', exact: true })).toBeVisible()
  await expect(pageHeader.getByRole('button', { name: '返回裁片仓', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '查看裁剪总表', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '打印装袋清单', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '发出', exact: true })).toHaveCount(0)

  const summaryStrip = page.locator('[data-transfer-bag-summary-strip]')
  await expect(summaryStrip).toBeVisible()
  await expect(summaryStrip).toContainText('中转袋二维码')
  await expect(summaryStrip).toContainText('当前状态')
  await expect(summaryStrip).toContainText('当前流转阶段')
  await expect(summaryStrip).toContainText('当前使用周期')
  await expect(summaryStrip.locator('[data-real-qr] svg').first()).toBeVisible()
  await expect(page.locator('text=正式二维码')).toHaveCount(0)

  await page.getByRole('tab', { name: '历史周期', exact: true }).click()
  const historyRows = page.locator('#transfer-bag-tabpanel-history tbody tr')
  expect(await historyRows.count()).toBeGreaterThan(0)
  await expect(historyRows.first()).toBeVisible()

  await page.getByRole('tab', { name: '报废记录', exact: true }).click()
  await expect(page.locator('#transfer-bag-tabpanel-logs')).toBeVisible()

  await expectNoPageErrors(errors)
})
