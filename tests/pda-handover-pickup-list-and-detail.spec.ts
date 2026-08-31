import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('待接收列表使用紧凑卡片，点击后进入确认接收详情', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByTestId('pda-handover-tabs')).toBeVisible()
  const card = page.getByTestId('pickup-head-card').first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('应收')
  await expect(card).toContainText('已收')
  await expect(card).toContainText('待收')
  await expect(card).not.toContainText('任务编号')
  await card.click()

  await expect(page.getByTestId('pda-pickup-summary')).toBeVisible()
  await expect(page.getByTestId('pickup-current-panel-card')).toBeVisible()
  await expect(page.getByTestId('pickup-record-history')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('接收记录二维码')
  await expectNoPageErrors(errors)
})
