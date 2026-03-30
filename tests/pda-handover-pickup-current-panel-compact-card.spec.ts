import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('待领料当前处理区压成单张主卡并保留关键动作', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover/PKH-MOCK-SEW-400')

  const currentRecordSection = page.locator('article').filter({
    has: page.getByRole('heading', { name: '当前记录处理区' }),
  }).first()
  await expect(currentRecordSection).toBeVisible()

  const currentPanelCard = currentRecordSection.getByTestId('pickup-current-panel-card')
  await expect(currentPanelCard).toBeVisible()
  await expect(currentRecordSection.getByTestId('pickup-current-panel-card')).toHaveCount(1)

  await expect(currentPanelCard.getByText('PKH-MOCK-SEW-400-003')).toBeVisible()
  await expect(currentPanelCard.getByText(/待工厂确认|已确认领料|差异处理中|已发起差异|已处理|待仓库发出|待工厂自提/).first()).toBeVisible()
  await expect(currentPanelCard.getByText('仓库交付数量').first()).toBeVisible()
  await expect(currentPanelCard.getByText('仓库交付时间').first()).toBeVisible()
  await expect(currentPanelCard.getByRole('button', { name: /确认本次领料|数量有差异|去异常定位与处理/ }).first()).toBeVisible()

  await expect(currentRecordSection.getByText('当前可执行动作')).toHaveCount(0)

  await expect(currentPanelCard.getByRole('button', { name: '确认本次领料', exact: true })).toBeVisible()
  await expect(currentPanelCard.getByRole('button', { name: '数量有差异', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})
