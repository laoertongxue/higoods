import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('仓库已交付待工厂确认的记录可确认领料', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')
  await expect(page.getByText('当前记录处理区')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认本次领料', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '发起数量差异', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '确认本次领料', exact: true }).click()
  await expect(page.getByText('工厂已确认本次领料').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '确认本次领料', exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})

test('仓库已交付待工厂确认的记录可发起数量差异并生成异常单入口', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover/PKH-MOCK-IRON-403')
  await expect(page.getByRole('button', { name: '发起数量差异', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '发起数量差异', exact: true }).click()
  await page.locator('[data-pda-handoverd-field="pickupDisputeQty"]').fill('17')
  await page.locator('[data-pda-handoverd-field="pickupDisputeReason"]').fill('工厂复点少于仓库扫码交付数量')
  await page.locator('[data-pda-handoverd-field="pickupDisputeRemark"]').fill('现场复点少 1 件，申请平台核定。')
  await page.getByRole('button', { name: '提交数量差异', exact: true }).click()

  await expect(page.getByText(/异常单号：EX-/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '去异常定位与处理', exact: true })).toBeVisible()
  await expect(page.getByText('已发起数量差异').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
