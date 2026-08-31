import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('确认接收详情完成小屏信息收口', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  const summary = page.getByTestId('pda-pickup-summary')
  await expect(summary).toContainText('应收')
  await expect(summary).toContainText('已收')
  await expect(summary).toContainText('待收')
  await expect(page.getByTestId('pickup-current-panel-card')).toBeVisible()
  await expect(page.getByTestId('pickup-record-history')).toBeVisible()
  for (const hiddenLabel of ['任务编号', '原始任务', '来源类型', '交接范围', '来源与追溯信息', '接收记录二维码']) {
    await expect(page.locator('body')).not.toContainText(hiddenLabel)
  }
  await expectNoPageErrors(errors)
})
