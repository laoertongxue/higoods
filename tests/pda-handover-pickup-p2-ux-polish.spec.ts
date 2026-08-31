import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test.use({ viewport: { width: 360, height: 640 } })

test('确认接收在 360×640 下无横向溢出且首屏聚焦当前动作', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')
  await expect(page.getByTestId('pda-pickup-summary')).toBeVisible()
  await expect(page.getByTestId('pickup-current-panel-card')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认本次接收', exact: true })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.locator('body')).not.toContainText('来源与追溯信息')
  await expectNoPageErrors(errors)
})
