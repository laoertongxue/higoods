import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const TARGET_CYCLE_LABEL = '双周 2026-03-01 ~ 2026-03-14'
const TARGET_CYCLE_ID = 'ID-F004-BIWEEKLY-2026-03-01'
const TARGET_QC_ID = 'QC-NEW-005'

async function clearPdaFactoryStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('fcs_pda_factory_id')
    window.localStorage.removeItem('fcs_pda_session')
  })
}

async function openSettlementQualityTab(page: Page): Promise<void> {
  await page.goto('/fcs/pda/settlement')
  await expect(page.getByRole('heading', { name: '结算周期', exact: true })).toBeVisible()

  await page.locator('button').filter({ hasText: TARGET_CYCLE_LABEL }).first().click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/settlement\\?tab=overview&cycleId=${TARGET_CYCLE_ID}$`))

  await page.getByRole('button', { name: '质检扣款', exact: true }).click()
  await expect(page).toHaveURL(
    new RegExp(`/fcs/pda/settlement\\?tab=quality&cycleId=${TARGET_CYCLE_ID}&view=pending$`),
  )
  await expect(page.getByRole('heading', { name: '质检扣款处理区', exact: true })).toBeVisible()
  await expect(page.locator('article').filter({ hasText: TARGET_QC_ID }).first()).toBeVisible()
}

async function assertQualityDetailRouting(page: Page, triggerLabel: '去确认' | '查看质检详情'): Promise<void> {
  await openSettlementQualityTab(page)

  const qualityCard = page.locator('article').filter({ hasText: TARGET_QC_ID }).first()
  await qualityCard.getByRole('button', { name: triggerLabel, exact: true }).click()

  await expect(page).toHaveURL(
    new RegExp(
      `/fcs/pda/quality/${TARGET_QC_ID}\\?back=settlement&view=pending&cycleId=${TARGET_CYCLE_ID}$`,
    ),
  )
  await expect(page.getByText('未找到对应质检记录')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '返回结算', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '返回结算', exact: true }).click()
  await expect(page).toHaveURL(
    new RegExp(`/fcs/pda/settlement\\?tab=quality&view=pending&cycleId=${TARGET_CYCLE_ID}$`),
  )
  await expect(page.getByRole('heading', { name: '质检扣款处理区', exact: true })).toBeVisible()
  await expect(page.locator('article').filter({ hasText: TARGET_QC_ID }).first()).toBeVisible()
}

test('结算周期详情里点击去确认可正常进入质检详情并返回', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearPdaFactoryStorage(page)

  await assertQualityDetailRouting(page, '去确认')

  await expectNoPageErrors(errors)
})

test('结算周期详情里点击查看质检详情可正常进入质检详情并返回', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearPdaFactoryStorage(page)

  await assertQualityDetailRouting(page, '查看质检详情')

  await expectNoPageErrors(errors)
})
