import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('KOL 交接同样删除已完成 Tab，只保留当前待交出入口', async ({ page }) => {
  const errors = collectPageErrors(page)
  const session = {
    userId: 'KOL-GOTO-001_operator', loginId: 'KOL-GOTO-001_operator', userName: 'KOL 外发操作员',
    roleId: 'ROLE_OPERATOR', factoryId: 'KOL-GOTO-001', factoryName: 'KOL-GOTO', loggedAt: '2026-09-01 09:00:00',
  }
  await seedLocalStorage(page, { fcs_pda_factory_id: 'KOL-GOTO-001', fcs_pda_session: session })
  await page.goto('/fcs/pda/handover?tab=done', { waitUntil: 'commit' })
  const tabs = page.getByTestId('pda-handover-tabs')
  await expect(tabs.getByRole('button')).toHaveCount(1)
  await expect(tabs.getByRole('button', { name: /^待交出/ })).toBeVisible()
  await expect(tabs).not.toContainText('已完成')

  await expectNoPageErrors(errors)
})
