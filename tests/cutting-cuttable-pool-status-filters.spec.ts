import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('可裁排产只保留基础概览，并把状态筛选收成裁片单状态和生产单状态', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cuttable-pool')

  const pageText = await page.getByTestId('cutting-cuttable-pool-page').textContent()
  expect(pageText).not.toMatch(/整单可裁\s*\d+\s*个/)
  expect(pageText).not.toMatch(/部分可裁\s*\d+\s*个/)
  expect(pageText).not.toMatch(/整单不可裁\s*\d+\s*个/)

  const cuttableOptions = await page.locator('[data-cuttable-pool-field="cuttable"] option').allTextContents()
  expect(cuttableOptions).toEqual(['全部', '可裁', '不可裁'])

  const coverageOptions = await page.locator('[data-cuttable-pool-field="coverage"] option').allTextContents()
  expect(coverageOptions).toEqual(['全部', '整单可裁', '部分可裁', '整单不可裁'])

  await expect(page.locator('label', { hasText: '裁片单状态' }).first()).toBeVisible()
  await expect(page.locator('label', { hasText: '生产单状态' }).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
