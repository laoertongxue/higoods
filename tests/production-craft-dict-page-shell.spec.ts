import { expect, test } from '@playwright/test'

import { processCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('工序工艺字典页面顶部已收口且分页真实驱动列表', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()

  await page.goto('/fcs/production/craft-dict')

  const header = page.getByTestId('craft-dict-page-header')
  await expect(header.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()
  await expect(header.locator('[data-lucide]')).toHaveCount(0)
  await expect(page.getByText('总览页', { exact: true })).toHaveCount(0)
  await expect(page.getByText('详情侧边弹窗', { exact: true })).toHaveCount(0)
  await expect(page.getByText('列表主数据来自老系统工艺映射', { exact: false })).toHaveCount(0)
  await expect(page.getByText('准备阶段仅维护印花/染色工序字典项', { exact: false })).toHaveCount(0)

  const tableSection = page.getByTestId('craft-dict-table-section')
  const pagination = page.getByTestId('craft-dict-pagination')
  await expect(pagination).toBeVisible()
  await expect(pagination).toContainText(`共 ${processCraftDictRows.length} 条`)
  await expect(page.getByTestId('craft-dict-page-indicator')).toHaveText('1 / 3')

  const rows = tableSection.locator('tbody tr')
  await expect(rows).toHaveCount(10)

  const firstRowCodePage1 = await rows.first().locator('[data-craft-dict-action="open-detail"]').innerText()

  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.getByTestId('craft-dict-page-indicator')).toHaveText('2 / 3')
  await expect(rows).toHaveCount(10)
  const firstRowCodePage2 = await rows.first().locator('[data-craft-dict-action="open-detail"]').innerText()
  expect(firstRowCodePage2).not.toBe(firstRowCodePage1)

  await page.locator('[data-craft-dict-field="pageSize"]').selectOption('20')
  await expect(page.getByTestId('craft-dict-page-indicator')).toHaveText('1 / 2')
  await expect(rows).toHaveCount(20)

  const detailTarget = rows.nth(3)
  const detailCode = await detailTarget.locator('[data-craft-dict-action="open-detail"]').innerText()
  await detailTarget.locator('[data-craft-dict-action="open-detail"]').click()

  const sheet = page.getByTestId('craft-dict-detail-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(detailCode)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(page.getByTestId('craft-dict-page-indicator')).toHaveText('1 / 2')
  await expect(rows).toHaveCount(20)

  await expectNoPageErrors(errors)
})
