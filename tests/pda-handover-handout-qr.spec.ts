import { expect, test } from '@playwright/test'

import { getPdaCompletedHeads, getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const openHandoutHead = getPdaHandoutHeads('ID-F001')[0]
const doneHandoutHead = getPdaCompletedHeads('ID-F001').find((head) => head.headType === 'HANDOUT')

test('待交出、已完成和交出详情都展示真实交出头二维码', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(openHandoutHead).toBeTruthy()
  expect(doneHandoutHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await page.getByRole('button', { name: '查看交出详情', exact: true }).first().waitFor({ timeout: 30_000 })
  const openCard = page.locator('[data-testid="handout-head-card"]').filter({ hasText: openHandoutHead!.handoverId }).first()
  await expect(openCard).toBeVisible()
  await expect(openCard.locator('[data-testid="handout-head-qr"] svg')).toBeVisible()

  await openCard.getByRole('button', { name: '查看交出详情', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${openHandoutHead!.handoverId}$`))
  await expect(page.locator('[data-testid="handout-head-qr"] svg')).toBeVisible()
  await expect(page.locator('[data-testid="handout-head-qr"]')).toContainText(`交出头编号：${openHandoutHead!.handoverId}`)

  await page.goto('/fcs/pda/handover?tab=done', { waitUntil: 'commit' })
  await page.locator('[data-testid="handout-head-card"]').first().waitFor({ timeout: 30_000 })
  const doneCard = page.locator('[data-testid="handout-head-card"]').filter({ hasText: doneHandoutHead!.handoverId }).first()
  await expect(doneCard).toBeVisible()
  await expect(doneCard.locator('[data-testid="handout-head-qr"] svg')).toBeVisible()

  await expectNoPageErrors(errors)
})
