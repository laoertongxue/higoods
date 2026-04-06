import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('原始裁片单页按简化口径展示件数、日期信息、当前阶段和可裁状态', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/original-orders')

  const pageRoot = page.getByTestId('cutting-original-orders-page')
  const tableSection = page.getByTestId('cutting-original-orders-main-table')
  const table = tableSection.locator('table')

  await expect(pageRoot).toBeVisible()
  await expect(table).toBeVisible()

  await expect(table.locator('thead th')).toContainText([
    '需求成衣件数（件）',
    '日期信息',
    '当前阶段',
    '可裁状态',
  ])
  await expect(pageRoot.getByText('数量 / 卖价', { exact: true })).toHaveCount(0)

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()

  const quantityCell = firstRow.locator('td').nth(6)
  await expect(quantityCell).not.toContainText('卖价')
  await expect(quantityCell).not.toContainText('货针')
  await expect(quantityCell).not.toContainText('特补')

  const dateCell = firstRow.locator('td').nth(7)
  await expect(dateCell).toContainText('需求：')
  await expect(dateCell).toContainText('下单：')
  await expect(dateCell).toContainText('回货：')

  const stageCell = firstRow.locator('td').nth(8)
  await expect(stageCell).not.toContainText('/')

  const cuttableOptions = (await page
    .locator('select[data-cutting-piece-field="cuttableState"] option')
    .allTextContents())
    .map((value) => value.trim())
  expect(cuttableOptions).toEqual(['全部', '可裁', '不可裁'])

  const cuttableStatusTexts = (await table.locator('tbody tr td:nth-child(10)').allTextContents()).map((value) =>
    value.trim(),
  )
  expect(cuttableStatusTexts.length).toBeGreaterThan(0)
  expect(cuttableStatusTexts.every((value) => value === '可裁' || value === '不可裁')).toBe(true)

  await expectNoPageErrors(errors)
})
