import { expect, test } from '@playwright/test'

import {
  APF_PDA_SESSION,
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('待交出列表使用当前动作，点击后直接进入本次交出', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=handout')

  const action = page.getByRole('button', { name: '发起交出', exact: true }).first()
  await expect(action).toBeVisible()
  await expect(page.locator('body')).not.toContainText('查看交出详情')
  await expect(page.locator('body')).not.toContainText('新增交出记录')
  await action.click()

  await expect(page.getByTestId('handout-new-record-form')).toBeVisible()
  await expect(page.getByText('本次交出', { exact: true }).first()).toBeVisible()
  await expectNoPageErrors(errors)
})
