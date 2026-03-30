import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('待工厂确认状态下不再出现可编辑确认数量，并可直接确认仓库交付数量', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  const currentRecordSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '当前记录处理区' }) }).first()
  await expect(currentRecordSection).toBeVisible()
  await expect(currentRecordSection.getByText('请确认本次领料，或发起数量差异。')).toBeVisible()
  await expect(currentRecordSection.locator('[data-pda-handoverd-field="pickupConfirmQty"]')).toHaveCount(0)
  await expect(currentRecordSection.getByText('仓库交付数量').first()).toBeVisible()
  await expect(currentRecordSection.getByText('仓库交付时间').first()).toBeVisible()
  await expect(currentRecordSection.getByRole('button', { name: '确认本次领料', exact: true })).toBeVisible()
  await expect(currentRecordSection.getByRole('button', { name: '数量有差异', exact: true })).toBeVisible()

  await currentRecordSection.getByRole('button', { name: '确认本次领料', exact: true }).click()

  await expect(currentRecordSection.getByText('本次领料已确认完成。').first()).toBeVisible()
  await expect(currentRecordSection.getByText('已确认数量').first()).toBeVisible()
  await expect(currentRecordSection.getByText('确认时间').first()).toBeVisible()
  await expect(currentRecordSection.getByRole('button', { name: '确认本次领料', exact: true })).toHaveCount(0)
  await expect(currentRecordSection.getByRole('button', { name: '数量有差异', exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})

test('只有进入数量差异路径后，才出现工厂实际收到数量表单', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover/PKH-MOCK-IRON-403')

  const currentRecordSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '当前记录处理区' }) }).first()
  await expect(currentRecordSection.locator('[data-pda-handoverd-field="pickupDisputeQty"]')).toHaveCount(0)
  await currentRecordSection.getByRole('button', { name: '数量有差异', exact: true }).click()

  await expect(currentRecordSection.locator('[data-pda-handoverd-field="pickupDisputeQty"]')).toBeVisible()
  await expect(currentRecordSection.locator('[data-pda-handoverd-field="pickupDisputeReason"]')).toBeVisible()
  await expect(currentRecordSection.locator('[data-pda-handoverd-field="pickupDisputeRemark"]')).toBeVisible()

  await expectNoPageErrors(errors)
})
