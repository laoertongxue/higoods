import { expect, test } from '@playwright/test'

import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const expectedModeLabels: Record<string, string> = {
  normal: '普通模式',
  high_low: '高低层模式',
  fold_normal: '对折-普通模式',
  fold_high_low: '对折-高低层模式',
}

test('铺布详情与编辑页公式可见，且 4 模式显示正确', async ({ page }) => {
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
  expect(await page.locator('.font-mono').filter({ hasText: '=' }).count()).toBeGreaterThan(8)

  await page.getByRole('button', { name: '去编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  const tabShell = page.locator('[data-cutting-spreading-edit-tab-shell]')
  await tabShell.getByRole('button', { name: '执行摘要' }).click()
  await expect(page.getByText('计划裁剪成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('总净可用长度（m）').first()).toBeVisible()

  await tabShell.getByRole('button', { name: '卷记录' }).click()
  await expect(page.getByText('净可用长度（m）').first()).toBeVisible()
  await expect(page.getByText('实际裁剪成衣件数（件）').first()).toBeVisible()

  await tabShell.getByRole('button', { name: '差异与补料' }).click()
  await expect(page.getByText('缺口成衣件数（件）').first()).toBeVisible()
  await expect(page.getByText('差异长度（m）').first()).toBeVisible()
  expect(await page.locator('.font-mono').filter({ hasText: '=' }).count()).toBeGreaterThan(12)

  const modeRows = new Map<string, (typeof spreadingRows)[number]>()
  for (const row of spreadingRows) {
    if (!modeRows.has(row.spreadingMode)) {
      modeRows.set(row.spreadingMode, row)
    }
  }

  expect(modeRows.size).toBeGreaterThanOrEqual(4)

  for (const [mode, row] of modeRows.entries()) {
    await page.goto(`/fcs/craft/cutting/spreading-edit?sessionId=${row.spreadingSessionId}`)
    await expect(page.getByTestId('cutting-spreading-edit-page')).toBeVisible()
    await expect(page.locator('[data-testid="cutting-spreading-edit-page"]')).toContainText(expectedModeLabels[mode] || mode)
  }

  await expectNoPageErrors(errors)
})
