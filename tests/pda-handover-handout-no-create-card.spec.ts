import { expect, test } from '@playwright/test'

import { getPdaHandoutHeads } from '../src/data/fcs/pda-handover-events'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const openHandoutHead = getPdaHandoutHeads('ID-F001')[0]

test('交出详情不再允许工厂手工新增交出记录', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(openHandoutHead).toBeTruthy()

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto(`/fcs/pda/handover/${openHandoutHead!.handoverId}`, { waitUntil: 'commit' })
  await page.getByText('交出信息（交出头）').waitFor({ timeout: 30_000 })

  await expect(page.getByText('交出信息（交出头）')).toBeVisible()
  await expect(page.getByText('新增交出记录')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '确认新增交出记录', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('工厂仅发起交出记录')
  await expect(page.locator('body')).not.toContainText('点击上方按钮新增第一条交出记录')
  await expect(page.locator('body')).toContainText('由仓库收货后自动回写')

  await expectNoPageErrors(errors)
})
