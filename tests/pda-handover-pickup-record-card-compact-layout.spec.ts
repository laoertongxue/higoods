import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('展开后的接收记录卡只保留批次、状态、数量和时间', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')
  const history = page.getByTestId('pickup-record-history')
  await history.locator('summary').click()

  const records = history.getByTestId('pickup-record-card')
  await expect(records.first()).toBeVisible()
  const text = await records.first().innerText()
  expect(text).toMatch(/第 \d+ 次接收/)
  expect(text).toContain('应收')
  expect(text).toContain('实收')
  expect(text).toContain('差异')
  expect(text).not.toContain('接收记录二维码')
  expect(text).not.toContain('记录 ID')
  expect(text).not.toContain('SKU')
  await expectNoPageErrors(errors)
})
