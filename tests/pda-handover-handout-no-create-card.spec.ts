import { expect, test } from '@playwright/test'

import {
  APF_PDA_SESSION,
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('交出详情允许按扫码和数量新增一笔部分交出', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=handout')
  await page.getByRole('button', { name: '发起交出', exact: true }).first().click()

  const form = page.getByTestId('handout-new-record-form')
  await expect(form).toBeVisible()
  await expect(form.locator('[data-pda-handoverd-field="newRecordScanCode"]')).toBeVisible()
  await expect(form.locator('[data-pda-handoverd-field="newRecordQty"]')).toBeVisible()
  await expect(form.getByRole('button', { name: '确认交出', exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('交出信息（交出头）')
  await expectNoPageErrors(errors)
})
