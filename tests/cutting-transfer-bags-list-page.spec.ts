import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('周转口袋流转列表页收简为 4 张联动统计卡并支持分页', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags')

  await expect(page.getByRole('heading', { name: '周转口袋流转', exact: true })).toBeVisible()

  const body = page.locator('body')
  await expect(page.getByRole('button', { name: /周转口袋总数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /空闲口袋数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /使用中口袋数/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /待交出口袋数/ })).toBeVisible()

  await expect(body).not.toContainText('待清洁口袋数')
  await expect(body).not.toContainText('待维修口袋数')
  await expect(body).not.toContainText('返回裁片仓')
  await expect(body).not.toContainText('去打印菲票')
  await expect(body).not.toContainText('查看裁剪总表')
  await expect(body).not.toContainText('待发出')
  await expect(body).not.toContainText('已签收')
  await expect(body).not.toContainText('待签收')
  await expect(body).not.toContainText('回仓验收中')

  await expect(page.getByRole('columnheader', { name: '待办动作', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: /空闲口袋数/ }).click()
  const idleStatuses = await page.locator('table tbody tr td:nth-child(2)').allTextContents()
  expect(idleStatuses.length).toBeGreaterThan(0)
  expect(idleStatuses.every((text) => text.includes('空闲'))).toBeTruthy()

  await page.getByRole('button', { name: /待交出口袋数/ }).click()
  const readyStatuses = await page.locator('table tbody tr td:nth-child(2)').allTextContents()
  expect(readyStatuses.length).toBeGreaterThan(0)
  expect(readyStatuses.every((text) => text.includes('待交出'))).toBeTruthy()

  await page.getByRole('button', { name: /周转口袋总数/ }).click()
  await expect(body).toContainText('显示 1-10 条，共 15 条，第 1 / 2 页')

  const nextPage = page.getByRole('button', { name: '下一页', exact: true })
  await expect(nextPage).toBeVisible()
  await nextPage.click()
  await expect(body).toContainText('显示 11-15 条，共 15 条，第 2 / 2 页')

  await expectNoPageErrors(errors)
})
