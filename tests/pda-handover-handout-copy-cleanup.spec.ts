import { expect, test } from '@playwright/test'

import { getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const openHandoutHead = getPdaHandoutHeads('ID-F001')[0]

test('handout 页面清掉误导性文案并统一主按钮为查看交出详情', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(openHandoutHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await page.getByRole('button', { name: '查看交出详情', exact: true }).first().waitFor({ timeout: 30_000 })

  await expect(page.locator('body')).not.toContainText('去交出')
  await expect(page.locator('body')).not.toContainText('新增交出记录')
  await expect(page.getByRole('button', { name: '查看交出详情', exact: true }).first()).toBeVisible()

  const openCard = page.locator('[data-testid="handout-head-card"]').filter({ hasText: openHandoutHead!.handoverId }).first()
  await openCard.getByRole('button', { name: '查看交出详情', exact: true }).click()
  await expect(page.locator('body')).not.toContainText('确认新增交出记录')
  await expect(page.locator('body')).toContainText('由仓库收货后自动回写')

  await expectNoPageErrors(errors)
})
