import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const GENERIC_PICKUP_HEAD_ID = 'PKH-MOCK-SEW-400'

test('待领料列表保留去领料 CTA，进入详情后不再出现新增领料记录区块', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '交接', exact: true })).toBeVisible()
  await expect(page.getByText('领料记录由仓库配料回写后生成')).toBeVisible()

  const headCard = page.locator('article').filter({ hasText: GENERIC_PICKUP_HEAD_ID }).first()
  await expect(headCard).toBeVisible()
  await expect(headCard.getByRole('button', { name: '去领料', exact: true })).toBeVisible()

  await headCard.getByRole('button', { name: '去领料', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${GENERIC_PICKUP_HEAD_ID}$`))
  await expect(page.getByText('新增领料记录')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '确认新增领料记录', exact: true })).toHaveCount(0)
  await expect(page.getByText('仓库已生成的领料记录')).toBeVisible()
  await expect(page.getByText('领料记录二维码').first()).toBeVisible()
  await expect(page.getByText('PICKUP-RECORD:').first()).toBeVisible()

  await page.goto('/fcs/pda/handover?tab=pickup')
  const reopenedCard = page.locator('article').filter({ hasText: GENERIC_PICKUP_HEAD_ID }).first()
  await reopenedCard.click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${GENERIC_PICKUP_HEAD_ID}$`))

  await expectNoPageErrors(errors)
})
