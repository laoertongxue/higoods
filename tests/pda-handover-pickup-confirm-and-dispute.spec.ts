import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

const PICKUP_PATH = '/fcs/pda/handover/PKH-MOCK-SEW-400'

test('仓库已交付待工厂确认的记录可直接确认接收', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto(PICKUP_PATH)
  const current = page.getByTestId('pickup-current-panel-card')
  await expect(current).toBeVisible()
  await expect(current.getByRole('button', { name: '确认本次接收', exact: true })).toBeVisible()
  await expect(current.getByRole('button', { name: '数量有差异', exact: true })).toBeVisible()
  await current.getByRole('button', { name: '确认本次接收', exact: true }).click()

  await expect(current.getByText('本次接收已确认完成。').first()).toBeVisible()
  await expect(current.getByRole('button', { name: '确认本次接收', exact: true })).toHaveCount(0)
  await expectNoPageErrors(errors)
})

test('数量差异只在当前接收动作中展开填写', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto(PICKUP_PATH)
  const current = page.getByTestId('pickup-current-panel-card')
  await current.getByRole('button', { name: '数量有差异', exact: true }).click()

  await expect(current.locator('[data-pda-handoverd-field="pickupDisputeQty"]')).toBeVisible()
  await expect(current.locator('[data-pda-handoverd-field="pickupDisputeReason"]')).toBeVisible()
  await expect(current.locator('[data-pda-handoverd-field="pickupDisputeRemark"]')).toBeVisible()
  await expectNoPageErrors(errors)
})
