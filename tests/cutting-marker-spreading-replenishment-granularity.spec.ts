import { expect, test } from '@playwright/test'

import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('补料建议已细到原始裁片单 × 面料 SKU × 颜色粒度', async ({ page }) => {
  const errors = collectPageErrors(page)
  const prototypeData = readMarkerSpreadingPrototypeData()
  const spreadingRows = buildSpreadingListViewModel({
    spreadingSessions: prototypeData.store.sessions,
    rowsById: prototypeData.rowsById,
    mergeBatches: prototypeData.mergeBatches,
    markerRecords: prototypeData.store.markers,
  })
  const targetRow = spreadingRows.find((row) => row.hasReplenishmentWarning && row.replenishmentPayload.originalCutOrderId) || spreadingRows.find((row) => row.hasReplenishmentWarning) || spreadingRows[0]

  expect(targetRow).toBeTruthy()

  await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${targetRow.spreadingSessionId}`)
  await page.getByRole('button', { name: '去补料管理' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/replenishment/)
  await expect(page.getByText('补料明细建议')).toBeVisible()

  const lineTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: '原始裁片单' }) }).last()
  await expect(lineTable.getByRole('columnheader', { name: '原始裁片单' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '面料 SKU' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '颜色' })).toBeVisible()
  await expect(lineTable.getByRole('columnheader', { name: '缺口成衣件数（件）' })).toBeVisible()
  expect(await lineTable.locator('tbody tr').count()).toBeGreaterThan(0)

  const lineFormulaCount = await lineTable.locator('.font-mono').filter({ hasText: '=' }).count()
  expect(lineFormulaCount).toBeGreaterThan(2)

  await expect(page.getByText('颜色：')).toBeVisible()
  await expectNoPageErrors(errors)
})
