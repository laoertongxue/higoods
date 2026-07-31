import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋详情按业务事实分区并分页，保留真实二维码', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible({
    timeout: 120_000,
  })

  const currentTab = page.getByRole('tab', { name: '基本信息', exact: true })
  await expect(currentTab).toBeVisible()
  await expect(currentTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: '当前使用', exact: true })).toBeVisible()
  for (const tabName of [
    '袋内菲票',
    '入仓记录',
    '袋级交出',
    '特殊工艺回仓',
    '接收与回写',
    '物理回收',
    '报废记录',
    '业务差异',
    '历史周期',
  ]) {
    await expect(page.getByRole('tab', { name: tabName, exact: true })).toBeVisible()
  }

  const body = page.locator('body')
  await expect(body).not.toContainText('步骤 1：选择口袋')
  await expect(body).not.toContainText('动作审计')
  await expect(body).not.toContainText('回货审计')
  await expect(body).not.toContainText('异常处理')
  await expect(body).not.toContainText('复用异常')
  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()

  for (const [tabName, tabKey] of [
    ['袋内菲票', 'items'],
    ['入仓记录', 'inbound'],
    ['袋级交出', 'handover'],
    ['特殊工艺回仓', 'special-craft'],
    ['接收与回写', 'downstream'],
    ['物理回收', 'recovery'],
    ['报废记录', 'logs'],
    ['业务差异', 'differences'],
    ['历史周期', 'history'],
  ] as const) {
    await page.getByRole('tab', { name: tabName, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`detailTab=${tabKey}`))
    await expect(page.getByRole('tab', { name: tabName, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText(/每页 10 条/)).toBeVisible()
  }

  await expectNoPageErrors(errors)
})
