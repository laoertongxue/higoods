import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('唛架列表页支持待建上下文、已建唛架、异常待处理三个页签切换', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')

  await expect(page.getByTestId('cutting-marker-plan-list-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: '唛架列表' })).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-tabs')).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-stats')).toBeVisible()
  await expect(page.getByRole('button', { name: '待建上下文', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '已建唛架', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '异常待处理', exact: true })).toBeVisible()
  await expect(page.getByLabel('搜索')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="status"]')).toBeVisible()
  await page.getByLabel('搜索').fill('CUT-')
  await expect(page.getByTestId('marker-plan-list-state-bar')).toBeVisible()
  await page.getByTestId('marker-plan-more-filters').locator('summary').click()
  await expect(page.locator('[data-marker-plan-filter-field="contextType"]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="mode"]')).toBeVisible()
  await expect(page.locator('[data-marker-plan-filter-field="ready"]')).toBeVisible()

  await expect(page.getByTestId('marker-plan-pending-contexts')).toBeVisible()
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)
  const tabsBox = await page.getByTestId('marker-plan-list-tabs').boundingBox()
  expect(tabsBox?.height ?? 0).toBeLessThan(90)

  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  await expect(page.getByTestId('marker-plan-list-table')).toBeVisible()
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)
  await expect(page.getByTestId('marker-plan-list-table')).toContainText('唛架成衣件数（件）')
  await expect(page.getByTestId('marker-plan-list-table')).toContainText('最终单件成衣用量（m/件）')
  await expect(page.getByTestId('marker-plan-list-table')).toContainText('计划铺布总长度（m）')

  await page.getByRole('button', { name: '异常待处理', exact: true }).click()
  await expect(page.getByTestId('marker-plan-exception-list')).toBeVisible()
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)

  await page.getByRole('button', { name: '待建上下文', exact: true }).click()
  await expect(page.getByTestId('marker-plan-pending-contexts')).toBeVisible()
  await expect(page.getByTestId('marker-plan-pending-contexts')).toContainText('技术包状态')
  await expect(page.getByTestId('marker-plan-pending-contexts')).toContainText('当前配料 / 领料摘要')

  await expectNoPageErrors(errors)
})
