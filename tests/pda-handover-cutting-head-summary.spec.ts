import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('CUTTING handout 头信息卡显示涉及部位、涉及 SKU 与总量字段', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/handover/HOH-MOCK-CUT-093', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交出详情'), undefined, { timeout: 30_000 })

  const headCard = page.locator('[data-testid="handout-head-object-profile"]').first()
  await expect(headCard).toBeVisible()
  await expect(headCard).toContainText('交出物类型：裁片')
  await expect(headCard).toContainText('涉及部位：3 种')
  await expect(headCard).toContainText('涉及 SKU：2 个')
  await expect(headCard).toContainText('涉及部位裁片：')
  await expect(headCard).toContainText('前片')
  await expect(headCard).toContainText('后片')
  await expect(headCard).toContainText('罗纹领口')
  await expect(headCard).toContainText('计划交出裁片片数（片）：')
  await expect(headCard).toContainText('320 片')
  await expect(headCard).toContainText('仓库回写裁片片数（片）：')
  await expect(headCard).toContainText('240 片')
  await expect(headCard).toContainText('待回写裁片片数（片）：')
  await expect(headCard).toContainText('80 片')
  await expect(headCard).toContainText('可折算成衣件数（件）：160 件')

  await expectNoPageErrors(errors)
})
