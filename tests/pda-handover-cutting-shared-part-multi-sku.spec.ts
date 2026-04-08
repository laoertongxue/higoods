import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('CUTTING handout 详情按部位分组并在同一部位下展示多个 SKU 子项', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover/HOH-MOCK-CUT-093', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交出详情'), undefined, { timeout: 30_000 })

  const collarGroup = page.locator('[data-testid="cut-piece-part-group"]').filter({ hasText: '罗纹领口' }).first()
  await expect(collarGroup).toBeVisible()
  await expect(collarGroup).toContainText('本次交出裁片片数（片）：80 片')
  await expect(collarGroup).toContainText('可折算成衣件数（件）：40 件')
  await expect(collarGroup.locator('[data-testid="cut-piece-sku-line"]')).toHaveCount(2)
  await expect(collarGroup).toContainText('SKU 编码')
  await expect(collarGroup).toContainText('CPO-20260319-G')
  await expect(collarGroup).toContainText('CPO-20260319-H')
  await expect(collarGroup).toContainText('石灰蓝 / M')
  await expect(collarGroup).toContainText('石灰蓝 / L')
  await expect(collarGroup).toContainText('40 片')
  await expect(collarGroup).toContainText('20 件')

  await expectNoPageErrors(errors)
})
