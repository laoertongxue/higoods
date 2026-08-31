import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('待接收详情只保留一张当前动作卡', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  const current = page.getByTestId('pickup-current-panel-card')
  await expect(current).toHaveCount(1)
  await expect(current).toContainText('仓库交付数量')
  await expect(current).toContainText('仓库交付时间')
  await expect(current.getByRole('button', { name: '确认本次接收', exact: true })).toBeVisible()
  await expect(current.getByRole('button', { name: '数量有差异', exact: true })).toBeVisible()
  await expect(current).not.toContainText('PKH-MOCK-SEW-400-003')
  await expect(page.locator('body')).not.toContainText('当前记录处理区')
  await expectNoPageErrors(errors)
})
