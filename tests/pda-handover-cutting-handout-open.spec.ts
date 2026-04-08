import { expect, test } from '@playwright/test'

import { getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const cuttingOpenHead = getPdaHandoutHeads('ID-F001').find((head) => head.processName === '裁片')

test('待交出中的裁片 handout 留在交接详情页内展示', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(cuttingOpenHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover?tab=handout', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交接'), undefined, { timeout: 30_000 })

  const card = page.locator('[data-testid="handout-head-card"]').filter({ hasText: cuttingOpenHead!.handoverId }).first()
  await card.waitFor({ timeout: 30_000 })
  await expect(card).toContainText('裁片')
  await expect(card).toContainText('交出物类型：裁片')

  await card.getByRole('button', { name: '查看交出详情', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${cuttingOpenHead!.handoverId}$`))
  await expect(page).not.toHaveURL(/\/fcs\/pda\/cutting\//)
  await page.waitForFunction(() => document.body.innerText.includes('交出详情'), undefined, { timeout: 30_000 })
  await expect(page.locator('[data-testid="handout-head-qr"] svg')).toBeVisible()
  await expect(page.locator('body')).toContainText('交出物类型：裁片')
  await expect(page.locator('body')).toContainText('计划交出裁片片数（片）')

  await expectNoPageErrors(errors)
})
