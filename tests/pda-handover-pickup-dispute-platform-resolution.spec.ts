import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const HANDOVER_ID = 'PKH-MOCK-SEW-400'
const RECORD_ID = 'PKH-MOCK-SEW-400-005'
const CASE_ID = 'EX-PDA-PICK-SEW-001'
const RESOLVED_QTY = '41'
const RESOLVED_NOTE = '平台复点后确认本次领料应按 41 件入账。'

test('平台可处理待领料数量差异并回写最终数量到 PDA 领料详情', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto(`/fcs/pda/handover/${HANDOVER_ID}`)
  await page.locator(`[data-pda-handoverd-action="select-pickup-record"][data-record-id="${RECORD_ID}"]`).click()
  await expect(page.getByRole('button', { name: '去异常定位与处理', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '去异常定位与处理', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/progress/exceptions\\?caseId=${CASE_ID}$`))
  await expect(page.getByRole('heading', { name: '异常定位与处理', exact: true })).toBeVisible()
  await expect(page.getByText(`异常详情 - ${CASE_ID}`)).toBeVisible()
  await expect(page.getByText('待领料数量差异处理区')).toBeVisible()

  await page.locator('[data-pe-field="pickupDisputeHandleStatus"]').selectOption('RESOLVED')
  await page.locator('[data-pe-field="pickupDisputeHandleResolvedQty"]').fill(RESOLVED_QTY)
  await page.locator('[data-pe-field="pickupDisputeHandleNote"]').fill(RESOLVED_NOTE)
  await page.getByRole('button', { name: '保存处理结果', exact: true }).click()

  await expect(page.getByRole('button', { name: '去移动端查看', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '去移动端查看', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${HANDOVER_ID}$`))

  await page.locator(`[data-pda-handoverd-action="select-pickup-record"][data-record-id="${RECORD_ID}"]`).click()
  await expect(page.getByText(`平台最终确认数量：${RESOLVED_QTY} 件`)).toBeVisible()
  await expect(page.getByText(`平台处理说明：${RESOLVED_NOTE}`).first()).toBeVisible()
  await expect(page.getByText(`异常单号：${CASE_ID}`).first()).toBeVisible()

  await expectNoPageErrors(errors)
})
