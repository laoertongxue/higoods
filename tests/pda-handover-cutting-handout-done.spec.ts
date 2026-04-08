import { expect, test } from '@playwright/test'

import { getPdaCompletedHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const cuttingDoneHead = getPdaCompletedHeads('ID-F001').find(
  (head) => head.headType === 'HANDOUT' && head.processName === '裁片',
)

test('已完成中的裁片 handout 继续在交接详情页展示', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(cuttingDoneHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover?tab=done', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交接'), undefined, { timeout: 30_000 })

  const card = page.locator('[data-testid="handout-head-card"]').filter({ hasText: cuttingDoneHead!.handoverId }).first()
  await card.waitFor({ timeout: 30_000 })
  await expect(card).toContainText('裁片')

  await card.click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${cuttingDoneHead!.handoverId}$`))
  await expect(page).not.toHaveURL(/\/fcs\/pda\/cutting\//)
  await page.waitForFunction(() => document.body.innerText.includes('交出详情'), undefined, { timeout: 30_000 })
  await expect(page.locator('[data-testid="handout-head-qr"] svg')).toBeVisible()
  await expect(page.locator('body')).toContainText('仓库回写裁片片数（片）')
  await expect(page.locator('body')).toContainText('可折算成衣件数（件）：')

  await expectNoPageErrors(errors)
})
