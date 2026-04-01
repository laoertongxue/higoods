import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('周转口袋详情页顶部压缩为页头加紧凑摘要带，并补齐非当前页签 mock', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  const pageHeader = page.locator('[data-transfer-bag-page-header]')
  await expect(pageHeader).toBeVisible()
  await expect(pageHeader.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()
  await expect(pageHeader.getByRole('button', { name: '返回周转口袋流转', exact: true })).toBeVisible()
  await expect(pageHeader.getByRole('button', { name: '返回裁片仓', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '查看裁剪总表', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '打印装袋清单', exact: true })).toHaveCount(0)
  await expect(pageHeader.getByRole('button', { name: '发出', exact: true })).toHaveCount(0)

  const summaryStrip = page.locator('[data-transfer-bag-summary-strip]')
  await expect(summaryStrip).toBeVisible()
  await expect(summaryStrip).toContainText('周转口袋二维码')
  await expect(summaryStrip).toContainText('车缝工厂 / 任务')
  await expect(summaryStrip.locator('[data-real-qr] svg').first()).toBeVisible()
  await expect(page.locator('text=正式二维码')).toHaveCount(0)

  await page.getByRole('tab', { name: '过往周转记录', exact: true }).click()
  const historyRows = page.locator('#transfer-bag-tabpanel-history tbody tr')
  expect(await historyRows.count()).toBeGreaterThan(0)
  await expect(historyRows.first()).toBeVisible()

  await page.getByRole('tab', { name: '周转口袋回收', exact: true }).click()
  const recoveryPanel = page.locator('#transfer-bag-tabpanel-recovery')
  const recoveryRows = recoveryPanel.locator('tbody tr')
  expect(await recoveryRows.count()).toBeGreaterThan(0)
  await expect(recoveryPanel).toContainText('最近回收记录')
  await expect(recoveryPanel).not.toContainText('交回人')
  await expect(recoveryPanel).not.toContainText('回收菲票数量')
  await expect(recoveryPanel).not.toContainText('回收成品 / 件数摘要')
  await expect(recoveryPanel).not.toContainText('袋况')
  await expect(recoveryPanel).not.toContainText('是否可继续使用')
  await expect(recoveryPanel).not.toContainText('创建回收草稿')
  await expect(recoveryPanel).not.toContainText('关闭本次周转')
  await expect(recoveryPanel).not.toContainText('重置回收草稿')
  await expect(recoveryPanel).not.toContainText('回收摘要')

  await page.getByRole('tab', { name: '操作日志', exact: true }).click()
  const logItems = page.locator('#transfer-bag-tabpanel-logs article')
  expect(await logItems.count()).toBeGreaterThan(0)
  await expect(logItems.first()).toBeVisible()

  await expectNoPageErrors(errors)
})
