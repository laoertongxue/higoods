import { expect, test } from '@playwright/test'

import {
  APF_PDA_SESSION,
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

test('交出列表和详情不再展示二维码与内部追溯编号', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_factory_id: 'FAC-APF',
    fcs_pda_session: APF_PDA_SESSION,
  })

  await page.goto('/fcs/pda/handover?tab=handout')

  const card = page.getByTestId('handout-head-card').filter({
    has: page.getByRole('button', { name: '发起交出', exact: true }),
  }).first()
  await expect(card).toBeVisible()
  await expect(card.locator('[data-testid="handout-head-qr"]')).toHaveCount(0)
  await expect(card).not.toContainText('任务编号')
  await expect(card).not.toContainText('交出单号')
  await card.getByRole('button', { name: '发起交出', exact: true }).click()

  await expect(page.getByTestId('handout-new-record-form')).toBeVisible()
  await expect(page.locator('[data-testid="handout-head-qr"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('来源与追溯信息')
  await expectNoPageErrors(errors)
})
