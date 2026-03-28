import { expect, test } from '@playwright/test'

import {
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('待接单任务列表同时展示正常和即将逾期状态', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()

  const pendingCards = page.locator('main article')
  await expect(pendingCards.first()).toBeVisible()
  await expect(pendingCards.filter({ hasText: '正常' }).first()).toBeVisible()
  await expect(pendingCards.filter({ hasText: '即将逾期' }).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
