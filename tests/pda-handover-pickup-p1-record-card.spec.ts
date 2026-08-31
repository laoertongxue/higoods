import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('接收记录默认折叠，展开后只显示结果字段', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  const history = page.getByTestId('pickup-record-history')
  await expect(history).toBeVisible()
  await expect(history).not.toHaveAttribute('open', '')
  await history.locator('summary').click()
  const record = history.getByTestId('pickup-record-card').first()
  await expect(record).toBeVisible()
  await expect(record).toContainText('应收')
  await expect(record).toContainText('实收')
  await expect(record).toContainText('差异')
  await expect(record).not.toContainText('接收记录二维码')
  await expect(record).not.toContainText('入库记录')
  await expectNoPageErrors(errors)
})
