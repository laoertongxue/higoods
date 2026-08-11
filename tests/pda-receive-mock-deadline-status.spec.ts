import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('待接单任务列表同时展示正常和即将逾期状态', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'ID-F001',
    fcs_pda_session: {
      userId: 'ID-F001_operator',
      loginId: 'ID-F001_operator',
      userName: 'PT Sinar Garment Indonesia_操作工',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'ID-F001',
      factoryName: 'PT Sinar Garment Indonesia',
      loggedAt: '2026-08-11 09:00:00',
    },
  })

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('button', { name: /待接单任务/ })).toBeVisible()

  const pendingCards = page.locator('article')
  await expect(pendingCards.first()).toBeVisible()
  await expect(pendingCards.filter({ hasText: '正常' }).first()).toBeVisible()
  await expect(pendingCards.filter({ hasText: '即将逾期' }).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
