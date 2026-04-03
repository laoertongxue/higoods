import { expect, test } from '@playwright/test'

import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布页差异摘要与补料预警使用同一套成衣件数与长度公式', async ({ page }) => {
  const errors = collectPageErrors(page)
  const prototypeData = readMarkerSpreadingPrototypeData()
  const spreadingRows = buildSpreadingListViewModel({
    spreadingSessions: prototypeData.store.sessions,
    rowsById: prototypeData.rowsById,
    mergeBatches: prototypeData.mergeBatches,
    markerRecords: prototypeData.store.markers,
  })
  const targetRow = spreadingRows.find((row) => row.hasReplenishmentWarning) || spreadingRows[0]

  expect(targetRow).toBeTruthy()

  await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${targetRow.spreadingSessionId}`)

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)
  await expect(page.getByText('理论裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('缺口成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('判定依据').first()).toBeVisible()
  await expect(page.getByText('裁片件数')).toHaveCount(0)

  const formulaCount = await page.locator('.font-mono').filter({ hasText: '=' }).count()
  expect(formulaCount).toBeGreaterThan(8)

  await page.getByRole('button', { name: '去补料管理' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/replenishment/)
  await expect(page.getByText('补料明细建议')).toBeVisible()
  await expect(page.getByText('理论裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('缺口成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('判定依据').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
