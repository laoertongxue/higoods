import { expect, test } from '@playwright/test'

import { getPdaCompletedHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const cuttingDoneHead = getPdaCompletedHeads('ID-F001').find((head) => head.handoverId === 'HOH-MOCK-CUT-094')

test('已完成里的 CUTTING handout 支持多部位与仓库回写总量展示', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(cuttingDoneHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover?tab=done', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交接'), undefined, { timeout: 30_000 })

  const card = page.locator('[data-testid="handout-head-card"]').filter({ hasText: cuttingDoneHead!.handoverId }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('涉及部位：3 种')
  await expect(card).toContainText('涉及 SKU：2 个')
  await expect(card).toContainText('计划交出裁片片数（片）：320 片')
  await expect(card).toContainText('仓库回写裁片片数（片）：320 片')
  await expect(card).toContainText('可折算成衣件数（件）：160 件')

  await expectNoPageErrors(errors)
})
