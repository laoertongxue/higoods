import { expect, test } from '@playwright/test'

import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('补料建议已细到原始裁片单 × 面料 SKU × 颜色粒度，并支持从铺布编辑页逐行发起', async ({ page }) => {
  const errors = collectPageErrors(page)
  const prototypeData = readMarkerSpreadingPrototypeData()
  const spreadingRows = buildSpreadingListViewModel({
    spreadingSessions: prototypeData.store.sessions,
    rowsById: prototypeData.rowsById,
    mergeBatches: prototypeData.mergeBatches,
    markerRecords: prototypeData.store.markers,
  })
  const targetRow =
    spreadingRows.find((row) => row.hasReplenishmentWarning && row.replenishmentWarning?.lines.some((line) => line.originalCutOrderId && line.color)) ||
    spreadingRows.find((row) => row.hasReplenishmentWarning && row.replenishmentWarning?.lines.some((line) => line.originalCutOrderId)) ||
    spreadingRows.find((row) => row.hasReplenishmentWarning) ||
    spreadingRows[0]

  expect(targetRow).toBeTruthy()

  await page.goto(`/fcs/craft/cutting/spreading-edit?sessionId=${targetRow.spreadingSessionId}`)
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await page.locator('[data-cutting-spreading-edit-tab-shell]').getByRole('button', { name: '差异与补料' }).click()

  const lineTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: '原始裁片单' }) }).last()
  await expect(lineTable.getByRole('columnheader', { name: '原始裁片单' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '面料 SKU' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '颜色' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '缺口成衣件数（件）' })).toBeVisible()
  expect(await lineTable.locator('tbody tr').count()).toBeGreaterThan(0)

  const lineFormulaCount = await lineTable.locator('.font-mono').filter({ hasText: '=' }).count()
  expect(lineFormulaCount).toBeGreaterThan(2)

  const firstLaunch = lineTable.getByRole('button', { name: '发起补料' }).first()
  await firstLaunch.click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/replenishment/)
  await expect(page.getByText('补料明细建议')).toBeVisible()
  await expect(page.getByRole('button', { name: /颜色：/ }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('去印花工单')
  await expect(page.locator('body')).not.toContainText('去染色工单')
  await expect(page.locator('body')).not.toContainText('印花补料')
  await expect(page.locator('body')).not.toContainText('染色补料')
  await expect(page.locator('body')).not.toContainText('净色补料')
  await expect(page.locator('body')).not.toContainText('印花面料')
  await expect(page.locator('body')).not.toContainText('染色面料')
  await expect(page.locator('body')).not.toContainText('净色面料')

  const replenishmentLineTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: '原始裁片单' }) }).last()
  await expect(replenishmentLineTable.getByRole('columnheader', { name: '原始裁片单' })).toBeVisible()
  await expect(replenishmentLineTable.getByRole('columnheader', { name: '面料 SKU' })).toBeVisible()
  await expect(replenishmentLineTable.getByRole('columnheader', { name: '颜色' })).toBeVisible()
  await expect(replenishmentLineTable.getByRole('columnheader', { name: '缺口成衣件数（件）' })).toBeVisible()
  expect(await replenishmentLineTable.locator('tbody tr').count()).toBeGreaterThan(0)

  await expectNoPageErrors(errors)
})
