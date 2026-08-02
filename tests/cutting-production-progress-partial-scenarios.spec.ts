import { expect, test } from '@playwright/test'

import { buildProductionOrderOverviewRows } from '../src/pages/process-factory/cutting/production-order-overview-projection'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单总览展示汇总状态且工厂事实逐行对齐', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  const overviewRows = buildProductionOrderOverviewRows()
  const progressingProjection = overviewRows.find((row) => row.productionOrderId === 'PO-202603-088')
  expect(progressingProjection).toBeDefined()
  const progressingRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-088' }).first()
  await expect(progressingRow).toBeVisible()
  await expect(progressingRow.locator('td').nth(3)).toHaveText(progressingProjection!.dyeingStatus)

  const assignedProjection = overviewRows.find((row) => row.productionOrderId === 'PO-202603-0002')
  expect(assignedProjection).toBeDefined()
  const assignedRow = table.locator('tbody tr').filter({ hasText: 'PO-202603-0002' }).first()
  await expect(assignedRow).toBeVisible()
  const factoryLines = assignedRow.locator('[data-cutting-overview-factory-line]')
  await expect(factoryLines).toHaveCount(assignedProjection!.factoryLines.length)
  for (const [index, factoryLine] of assignedProjection!.factoryLines.entries()) {
    await expect(factoryLines.nth(index)).toContainText(factoryLine.factoryName)
    await expect(factoryLines.nth(index)).toContainText(factoryLine.factoryTypeLabel)
    await expect(factoryLines.nth(index)).toContainText(factoryLine.acceptanceLabel)
    await expect(factoryLines.nth(index)).toContainText(factoryLine.pickupLabel)
  }

  await expectNoPageErrors(errors)
})
