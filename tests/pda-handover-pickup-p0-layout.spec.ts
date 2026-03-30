import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const GENERIC_PICKUP_HEAD_ID = 'PKH-MOCK-SEW-400'

test('待领料列表与详情页完成 P0 信息收口', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '交接', exact: true })).toBeVisible()
  await expect(page.getByText(/仓库回写生成领料记录/)).toBeVisible()
  await expect(page.getByText(/确认数量或发起差异/)).toBeVisible()

  const headCard = page.locator('article').filter({ hasText: GENERIC_PICKUP_HEAD_ID }).first()
  await expect(headCard).toBeVisible()
  await expect(headCard.getByRole('button', { name: '去领料', exact: true })).toBeVisible()

  const cardText = await headCard.textContent()
  expect(cardText).toContain('任务编号')
  expect(cardText).toContain('生产单号')
  expect(cardText).toContain('当前工序')
  expect(cardText).toContain('来源仓库')
  expect(cardText).toContain('领料工厂')
  expect(cardText).not.toContain('原始任务')
  expect(cardText).not.toContain('拆分组')
  expect(cardText).not.toContain('执行方式')
  expect(cardText).not.toContain('执行范围')
  expect(cardText).not.toContain('来源单号')

  await headCard.getByRole('button', { name: '去领料', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${GENERIC_PICKUP_HEAD_ID}$`))

  const sectionHeaders = page.locator('article header h2')
  await expect(sectionHeaders.nth(0)).toHaveText('领料信息（领料头）')
  await expect(sectionHeaders.nth(1)).toHaveText('当前记录处理区')
  await expect(sectionHeaders.nth(2)).toHaveText('仓库已生成的领料记录')

  const headSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '领料信息（领料头）' }) }).first()
  const headSectionText = await headSection.textContent()
  expect(headSectionText).toContain('任务编号')
  expect(headSectionText).toContain('生产单号')
  expect(headSectionText).toContain('当前工序')
  expect(headSectionText).toContain('来源仓库')
  expect(headSectionText).toContain('领料工厂')
  expect(headSectionText).toContain('累计领料记录')
  expect(headSectionText).toContain('待处理记录')
  expect(headSectionText).toContain('应领总量')
  expect(headSectionText).toContain('累计最终确认总量')
  expect(headSectionText).not.toContain('原始任务')
  expect(headSectionText).not.toContain('来源执行单')
  expect(headSectionText).not.toContain('来源类型')
  expect(headSectionText).not.toContain('执行范围')
  expect(headSectionText).not.toContain('运行时任务')
  expect(headSectionText).not.toContain('拆分组')
  expect(headSectionText).not.toContain('拆分来源')

  await expect(page.locator('[data-testid=\"pickup-traceability\"]')).toBeVisible()
  await expect(page.getByText('来源与追溯信息')).toBeVisible()

  const currentRecordSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '当前记录处理区' }) }).first()
  await expect(currentRecordSection).toBeVisible()
  await expect(currentRecordSection.getByRole('button', { name: /确认本次领料|发起数量差异|去异常定位与处理/ }).first()).toBeVisible()

  const recordListSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '仓库已生成的领料记录' }) }).first()
  const recordCard = recordListSection.locator('article').first()
  const recordCardText = await recordCard.textContent()
  expect(recordCardText).toContain('领料记录二维码')
  expect(recordCardText).not.toContain('物料名称：—')
  expect(recordCardText).not.toContain('物料规格：—')
  expect(recordCardText).not.toContain('SKU：—')
  expect(recordCardText).not.toContain('裁片：—')
  expect(recordCardText).not.toContain('备注：—')

  await expectNoPageErrors(errors)
})
