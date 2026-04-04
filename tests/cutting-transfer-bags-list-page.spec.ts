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
  await expect(page.getByRole('columnheader', { name: '车缝工厂 / 款号', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '当前车缝厂 / 款号摘要', exact: true })).toHaveCount(0)

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

test('待装袋铺布 session 可进入装袋页，并按来源铺布 session 预筛', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page
    .getByTestId('cutting-spreading-stage-tabs')
    .getByRole('button', { name: /^待装袋（/ })
    .click()

  const stageRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(stageRow).toBeVisible()

  await stageRow.getByRole('button', { name: '去装袋' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/transfer-bag/)
  await expect(page).toHaveURL(/spreadingSessionId=/)
  const currentUrl = new URL(page.url())
  const expectedSessionNo = currentUrl.searchParams.get('spreadingSessionNo') || ''
  const expectedSessionId = currentUrl.searchParams.get('spreadingSessionId') || ''
  expect(expectedSessionNo || expectedSessionId).not.toBe('')
  await expect(page.getByRole('heading', { name: '周转口袋流转', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('铺布：')
  await expect(page.locator('body')).toContainText(expectedSessionNo || expectedSessionId)

  await expectNoPageErrors(errors)
})
