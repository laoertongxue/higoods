import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const PICKUP_HEAD_ID = 'PKH-MOCK-SEW-400'

test('待领料记录卡压成单主卡并保留关键字段与结果区', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto(`/fcs/pda/handover/${PICKUP_HEAD_ID}`)

  const recordListSection = page.locator('article').filter({
    has: page.getByRole('heading', { name: '仓库已生成的领料记录' }),
  }).first()
  await expect(recordListSection).toBeVisible()

  const pendingConfirmCard = recordListSection.getByTestId('pickup-record-card').filter({
    hasText: `${PICKUP_HEAD_ID}-003`,
  }).first()
  await expect(pendingConfirmCard).toBeVisible()
  await expect(pendingConfirmCard.getByText(`${PICKUP_HEAD_ID}-003`).first()).toBeVisible()
  await expect(pendingConfirmCard.getByText('领料方式')).toBeVisible()
  await expect(pendingConfirmCard.getByText('本次应领数量')).toBeVisible()
  await expect(pendingConfirmCard.getByText('仓库交付数量')).toBeVisible()
  await expect(pendingConfirmCard.getByText('领料记录二维码')).toBeVisible()
  await expect(pendingConfirmCard.getByTestId('pickup-record-qr')).toBeVisible()
  await expect(pendingConfirmCard.locator('div.rounded-md.border')).toHaveCount(0)

  const resolvedCard = recordListSection.getByTestId('pickup-record-card').filter({
    hasText: `${PICKUP_HEAD_ID}-006`,
  }).first()
  await expect(resolvedCard).toBeVisible()
  await expect(resolvedCard.getByText('最终确认数量：').first()).toBeVisible()
  await expect(resolvedCard.getByText('异常单号：').first()).toBeVisible()
  await expect(resolvedCard.getByTestId('pickup-record-result')).toBeVisible()
  await expect(resolvedCard.getByText('平台处理结果')).toBeVisible()
  await expect(resolvedCard.getByText('处理说明')).toBeVisible()
  await expect(resolvedCard.locator('div.rounded-md.border')).toHaveCount(1)

  await expect(recordListSection.getByText('物料主体：').first()).toBeVisible()
  await expect(recordListSection.getByText(/SKU\s|颜色\s|尺码\s|裁片\s/).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
