import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const GENERIC_PICKUP_HEAD_ID = 'PKH-MOCK-SEW-400'

test('待领料详情的记录卡改成核心字段加场景补充，追溯信息默认收起', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto(`/fcs/pda/handover/${GENERIC_PICKUP_HEAD_ID}`)

  const recordListSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '仓库已生成的领料记录' }) }).first()
  const recordCard = recordListSection.locator('article').first()
  const recordCardText = await recordCard.textContent()

  expect(recordCardText).toContain('第 ')
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
  expect(recordCardText).not.toContain('备注：—')
  expect(recordCardText).not.toContain('平台处理说明：—')

  await expect(recordCard.getByText('物料主体：').first()).toBeVisible()
  await expect(recordCard.getByText(/SKU\s/).first()).toBeVisible()

  const traceability = page.locator('[data-testid="pickup-traceability"]')
  await expect(traceability).toBeVisible()
  expect(await traceability.evaluate((node) => node.hasAttribute('open'))).toBe(false)

  await traceability.locator('summary').click()
  await expect(traceability.getByText('原始任务')).toBeVisible()
  await expect(traceability.getByText('来源执行单')).toBeVisible()
  await expect(traceability.getByText('来源类型')).toBeVisible()
  await expect(traceability.getByText('执行范围')).toBeVisible()
  await expect(traceability.getByText('运行时任务')).toBeVisible()
  await expect(traceability.getByText('拆分组')).toBeVisible()
  await expect(traceability.getByText('拆分来源')).toBeVisible()

  const currentRecordSection = page.locator('article').filter({ has: page.getByRole('heading', { name: '当前记录处理区' }) }).first()
  await expect(currentRecordSection.getByRole('button', { name: /确认本次领料|发起数量差异|去异常定位与处理/ }).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
