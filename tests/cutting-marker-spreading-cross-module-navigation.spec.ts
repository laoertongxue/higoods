import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('上游页面的去铺布入口都切到 canonical spreading-list，菜单 IA 也已收口', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible()
  await page
    .getByTestId('cutting-original-orders-main-table')
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: '查看详情' })
    .click()
  await page.getByRole('button', { name: '去铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/material-prep')
  await page.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click()
  await page.getByRole('button', { name: '去铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/merge-batches')
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await page
    .locator('[data-merge-batches-action="go-marker-spreading"]:not([disabled])')
    .last()
    .evaluate((node: HTMLElement) => node.click())
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/mergeBatchId=/)

  await page.goto('/fcs/craft/cutting/production-progress')
  await page.getByTestId('cutting-production-progress-main-table').locator('tbody tr').first().getByRole('button', { name: '去铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list\?/)
  await expect(page).toHaveURL(/productionOrderId=/)

  await page.goto('/fcs/craft/cutting/spreading-list')
  for (const groupLabel of ['裁片执行准备', '裁片执行中', '裁后处理']) {
    const toggle = page.locator('aside').getByText(groupLabel, { exact: true }).first()
    if (await toggle.isVisible()) {
      await toggle.click()
    }
  }
  const sidebarText = (await page.locator('aside').innerText()).replace(/\s+/g, ' ')
  const prepStart = sidebarText.indexOf('裁片执行准备')
  const inProgressStart = sidebarText.indexOf('裁片执行中')
  const closedLoopStart = sidebarText.indexOf('裁后处理')
  expect(prepStart).toBeGreaterThanOrEqual(0)
  expect(inProgressStart).toBeGreaterThan(prepStart)
  expect(closedLoopStart).toBeGreaterThan(inProgressStart)
  const prepSegment = sidebarText.slice(prepStart, inProgressStart)
  const inProgressSegment = sidebarText.slice(inProgressStart, closedLoopStart)
  const closedLoopSegment = sidebarText.slice(closedLoopStart)
  expect(prepSegment).toContain('原始裁片单')
  expect(prepSegment).toContain('仓库配料领料')
  expect(prepSegment).toContain('唛架列表')
  expect(prepSegment).not.toContain('打印菲票')
  expect(inProgressSegment).toContain('铺布列表')
  expect(closedLoopSegment).toContain('补料管理')
  expect(closedLoopSegment).toContain('打印菲票')

  await expectNoPageErrors(errors)
})
