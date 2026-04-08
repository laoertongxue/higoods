import { expect, test } from '@playwright/test'

import { getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const cuttingOpenHead = getPdaHandoutHeads('ID-F001').find((head) => head.processName === '裁片')

test('CUTTING handout 记录展示 SKU、部位、裁片片数和折算成衣件数', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(cuttingOpenHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto(`/fcs/pda/handover/${cuttingOpenHead!.handoverId}`, { waitUntil: 'commit' })

  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${cuttingOpenHead!.handoverId}$`))
  await expect(page).not.toHaveURL(/\/fcs\/pda\/cutting\//)
  await page.waitForFunction(() => document.body.innerText.includes('交出详情'), undefined, { timeout: 30_000 })
  await expect(page.locator('[data-testid="handout-record-card"]').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('SKU 编码')
  await expect(page.locator('body')).toContainText('颜色 / 尺码')
  await expect(page.locator('body')).toContainText('部位名称')
  await expect(page.locator('body')).toContainText('计划交出裁片片数（片）')
  await expect(page.locator('body')).toContainText('仓库回写裁片片数（片）')
  await expect(page.locator('body')).toContainText('待回写裁片片数（片）')
  await expect(page.locator('body')).toContainText('可折算成衣件数（件）')

  await expectNoPageErrors(errors)
})
