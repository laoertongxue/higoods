import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  GENERIC_PDA_SESSION,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('数量差异由主管端处理，PDA 只展示等待状态', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'ID-F001',
    fcs_pda_session: GENERIC_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')
  const history = page.getByTestId('pickup-record-history')
  await history.locator('summary').click()
  await history.locator('[data-pda-handoverd-action="select-pickup-record"][data-record-id="PKH-MOCK-SEW-400-005"]').click()

  const current = page.getByTestId('pickup-current-panel-card')
  await expect(current).toContainText('差异处理中')
  await expect(current).toContainText('等待主管处理，结果会自动更新。')
  await expect(current.getByRole('button', { name: '去异常定位与处理', exact: true })).toHaveCount(0)
  await expect(current).not.toContainText('异常单号')
  await expectNoPageErrors(errors)
})
