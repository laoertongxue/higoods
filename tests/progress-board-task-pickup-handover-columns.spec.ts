import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

function normalizeHeaderTexts(values: string[]): string[] {
  return values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

async function openProgressBoard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/fcs/progress/board', { waitUntil: 'commit' })
  await expect(page.getByRole('heading', { name: '任务进度看板' })).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('[data-progress-task-list="true"]')).toBeVisible({ timeout: 120_000 })
}

test('任务维度列表新增领料情况与交出情况两列，且位于执行状态后、风险前', async ({ page }) => {
  test.slow()
  const errors = collectPageErrors(page)

  await openProgressBoard(page)

  const taskList = page.locator('[data-progress-task-list="true"]')

  const headerTexts = normalizeHeaderTexts(await taskList.locator('thead th').allTextContents())
  const executionStatusIndex = headerTexts.indexOf('执行状态')
  const pickupIndex = headerTexts.indexOf('领料情况')
  const handoverIndex = headerTexts.indexOf('交出情况')
  const riskIndex = headerTexts.indexOf('风险')

  expect(executionStatusIndex).toBeGreaterThan(-1)
  expect(pickupIndex).toBe(executionStatusIndex + 1)
  expect(handoverIndex).toBe(pickupIndex + 1)
  expect(riskIndex).toBe(handoverIndex + 1)

  const pickupCells = taskList.locator('[data-progress-task-cell="pickup"]')
  const handoverCells = taskList.locator('[data-progress-task-cell="handover"]')
  await expect(pickupCells.first()).toBeVisible()
  await expect(handoverCells.first()).toBeVisible()

  const firstRowProcessCellText = await taskList.locator('tbody tr').first().locator('td').nth(4).textContent()
  expect(firstRowProcessCellText ?? '').not.toContain('交接：')

  await expectNoPageErrors(errors)
})
