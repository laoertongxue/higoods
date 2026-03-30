import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const GENERIC_PICKUP_HEAD_ID = 'PKH-MOCK-SEW-400'

test('待领料 P2 轻量精修保持动作聚焦和信息主次', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '交接', exact: true })).toBeVisible()
  await expect(page.getByText(/仓库回写生成领料记录/)).toBeVisible()
  await expect(page.getByText(/确认数量或发起差异/)).toBeVisible()
  await expect(page.getByText('头单完成仍由仓库侧发起')).toHaveCount(0)

  const headCard = page.locator('article').filter({ hasText: GENERIC_PICKUP_HEAD_ID }).first()
  await expect(headCard).toBeVisible()
  await expect(headCard.getByRole('button', { name: '去领料', exact: true })).toBeVisible()
  await expect(headCard.getByText(/还有 .* 条记录待处理|有 .* 条记录在处理差异|当前等待仓库完成头单/)).toBeVisible()

  await headCard.getByRole('button', { name: '去领料', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${GENERIC_PICKUP_HEAD_ID}$`))

  const sectionHeaders = page.locator('article header h2')
  await expect(sectionHeaders.nth(1)).toHaveText('当前记录处理区')
  await expect(sectionHeaders.nth(2)).toHaveText('仓库已生成的领料记录')

  const currentRecordSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '当前记录处理区' }) }).first()
  await expect(currentRecordSection.getByTestId('pickup-current-panel-card')).toBeVisible()
  await expect(currentRecordSection.getByText('PKH-MOCK-SEW-400-003')).toBeVisible()
  await expect(currentRecordSection.getByText(/请确认本次领料，或发起数量差异。|查看异常单进度与处理结果。|平台已给出最终结果。|本次领料已确认完成。|先查看记录与二维码。/)).toBeVisible()
  await expect(currentRecordSection.getByText('本次应领数量').first()).toBeVisible()
  await expect(currentRecordSection.getByText('仓库交付数量').first()).toBeVisible()
  await expect(currentRecordSection.getByRole('button', { name: /确认本次领料|发起数量差异|去异常定位与处理/ }).first()).toBeVisible()

  const recordListSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '仓库已生成的领料记录' }) }).first()
  const recordCard = recordListSection.locator('article').first()
  const recordCardText = await recordCard.textContent()

  expect(recordCardText).toContain('领料方式')
  expect(recordCardText).toContain('物料说明')
  expect(recordCardText).toContain('本次应领数量')
  expect(recordCardText).toContain('仓库交付数量')
  expect(recordCardText).toContain('领料记录二维码')
  expect(recordCardText).not.toContain('物料名称：')
  expect(recordCardText).not.toContain('物料规格：')
  expect(recordCardText).not.toContain('SKU：')
  expect(recordCardText).not.toContain('颜色/尺码：')
  expect(recordCardText).not.toContain('裁片：')

  await expect(recordListSection.getByText('物料主体：').first()).toBeVisible()
  await expect(recordListSection.getByText(/SKU\s|颜色\s|尺码\s|裁片\s/).first()).toBeVisible()
  await expect(recordListSection.getByText(/平台处理结果|数量差异处理/).first()).toBeVisible()

  const traceability = page.locator('[data-testid="pickup-traceability"]')
  await expect(traceability).toBeVisible()
  expect(await traceability.evaluate((node) => node.hasAttribute('open'))).toBe(false)
  await traceability.locator('summary').click()
  await expect(traceability.getByText('原始任务')).toBeVisible()
  await expect(traceability.getByText('来源执行单')).toBeVisible()

  await expectNoPageErrors(errors)
})
