import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋详情按业务事实分区并分页，保留真实二维码', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')

  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible({
    timeout: 120_000,
  })

  const detailLayers = [
    ['稳定身份与二维码', 'identity'],
    ['当前状态与位置', 'current'],
    ['当前周期与菲票', 'cycle'],
    ['装袋记录', 'bagging'],
    ['入仓记录', 'inbound'],
    ['拆袋重装', 'repack'],
    ['袋级交出', 'handover'],
    ['特殊工艺回仓', 'special-craft'],
    ['物理回收', 'recovery'],
    ['报废记录', 'scrap'],
    ['历史周期', 'history'],
  ] as const
  const currentTab = page.getByRole('tab', { name: detailLayers[0][0], exact: true })
  await expect(currentTab).toBeVisible()
  await expect(currentTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab')).toHaveText(detailLayers.map(([label]) => label))

  const body = page.locator('body')
  await expect(body).not.toContainText('步骤 1：选择口袋')
  await expect(body).not.toContainText('动作审计')
  await expect(body).not.toContainText('回货审计')
  await expect(body).not.toContainText('异常处理')
  await expect(body).not.toContainText('复用异常')
  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()

  for (const [tabName, tabKey] of detailLayers) {
    await page.getByRole('tab', { name: tabName, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`detailTab=${tabKey}`))
    await expect(page.getByRole('tab', { name: tabName, exact: true })).toHaveAttribute('aria-selected', 'true')
    if (!['identity', 'current'].includes(tabKey)) {
      await expect(page.getByText(/每页 10 条/)).toBeVisible()
    }
    await expect(page.locator(`[data-transfer-bag-detail-layer="${tabKey}"]`)).toBeVisible()
  }

  await expectNoPageErrors(errors)
})
