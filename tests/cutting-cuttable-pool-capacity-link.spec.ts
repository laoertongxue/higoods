import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产可带上下文跳转到产能日历与产能约束', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool?productionOrderId=PO-202603-081&productionOrderNo=PO-202603-081')

  const headerCapacityButton = page.getByRole('button', { name: '查看产能日历' })
  await expect(headerCapacityButton).toBeVisible()
  await headerCapacityButton.click()

  await expect(page).toHaveURL(/\/fcs\/capacity\/overview\?/)
  await expect(page).toHaveURL(/source=cuttable-pool/)
  await expect(page.locator('[data-capacity-filter="overview-keyword"]')).toHaveValue('PO-202603-081')
  await expect(page.getByText('来自可裁排产')).toBeVisible()

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  const firstOrderCard = page.getByTestId('cutting-cuttable-pool-order-card').first()
  await expect(firstOrderCard.getByRole('button', { name: '查看产能约束' })).toBeVisible()
  await firstOrderCard.getByRole('button', { name: '查看产能约束' }).click()

  await expect(page).toHaveURL(/\/fcs\/capacity\/constraints\?/)
  await expect(page).toHaveURL(/source=cuttable-pool/)
  await expect(page).toHaveURL(/orderId=/)
  await expect(page.getByText('来自可裁排产')).toBeVisible()

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await page.getByTestId('cutting-cuttable-pool-quick-select-entry').first().getByRole('button', { name: '快速选择' }).click()
  const sidebar = page.getByTestId('cutting-cuttable-pool-selected-sidebar')
  await expect(sidebar).toBeVisible()
  await sidebar.getByRole('button', { name: '查看产能约束' }).last().click()

  await expect(page).toHaveURL(/\/fcs\/capacity\/constraints\?/)
  await expect(page).toHaveURL(/source=cuttable-pool/)
  await expect(page).toHaveURL(/orderId=|orderIds=/)
  await expect(page.getByText('来自可裁排产')).toBeVisible()

  await expectNoPageErrors(errors)
})
