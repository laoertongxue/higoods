import { expect, test, type Page } from '@playwright/test'

import {
  listCutPieceFeiTickets,
  resetCutPieceFeiTicketRuntimeForTest,
} from '../src/data/fcs/cutting/fei-ticket-generation'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function clearFeiTicketRuntime(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('cuttingPerPieceFeiTickets')
  })
}

test('逐片菲票列表展示裁片实例、特殊工艺和原始裁片单归属', async ({ page }) => {
  resetCutPieceFeiTicketRuntimeForTest()
  await clearFeiTicketRuntime(page)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.getByTestId('per-piece-fei-ticket-section')).toBeVisible()
  await expect(page.locator('body')).toContainText('逐片菲票')
  await expect(page.locator('body')).toContainText('菲票归属原始裁片单')
  await expect(page.locator('body')).toContainText('合并裁剪批次仅作为执行上下文')

  const rows = page.getByTestId('per-piece-fei-ticket-row')
  await expect(rows.first()).toBeVisible()
  await expect(rows.first()).toContainText(/FT-/)
  await expect(page.locator('body')).toContainText('片序号')
  await expect(page.locator('body')).toContainText('无特殊工艺')
  await expect(page.locator('body')).toContainText('打揽')

  await rows.first().getByRole('button', { name: '详情', exact: true }).click()
  const detail = page.getByTestId('per-piece-fei-ticket-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('来源裁片实例')
  await expect(detail).toContainText('原始裁片单')
  await expect(detail).toContainText('二维码内容')
  await expect(detail.getByTestId('per-piece-fei-ticket-qr-payload')).toContainText('sourcePieceInstanceId')

  await expectNoPageErrors(errors)
})

test('原始裁片单可预览并确认逐片生成菲票，重复生成会提示', async ({ page }) => {
  resetCutPieceFeiTicketRuntimeForTest()
  await clearFeiTicketRuntime(page)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await page.getByRole('button', { name: '生成菲票', exact: true }).click()
  const preview = page.locator('[data-testid="per-piece-fei-ticket-preview"]')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect(preview).toContainText('待生成菲票数量')
  await expect(preview).toContainText('有特殊工艺菲票数量')
  await expect(page.getByTestId('per-piece-fei-ticket-message')).toContainText('本次将生成')

  await page.getByRole('button', { name: '确认生成', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-message')).toContainText('本次将生成')
  await expect(page.getByTestId('per-piece-fei-ticket-row').first()).toContainText(/FT-/)

  await page.getByRole('button', { name: '生成菲票', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-message')).toContainText('当前裁片实例已生成菲票，请勿重复生成')

  await expectNoPageErrors(errors)
})

test('菲票携带特殊工艺位置、支持筛选、补打、作废和打印预览', async ({ page }) => {
  resetCutPieceFeiTicketRuntimeForTest()
  await clearFeiTicketRuntime(page)
  const errors = collectPageErrors(page)
  const ticketWithCraft = listCutPieceFeiTickets().find((ticket) =>
    ticket.specialCrafts.some((craft) => craft.craftName === '打揽'),
  )
  expect(ticketWithCraft).toBeTruthy()

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await page.locator('[data-cutting-fei-piece-field="specialCraft"]').selectOption({ label: '打揽' })
  const filteredRows = page.getByTestId('per-piece-fei-ticket-row')
  const craftRow = filteredRows.filter({ hasText: '打揽' }).first()
  await expect(craftRow).toBeVisible()
  await expect(craftRow).toContainText(/左|右|底|面/)

  await craftRow.getByRole('button', { name: '详情', exact: true }).click()
  const detail = page.getByTestId('per-piece-fei-ticket-detail')
  await expect(detail).toContainText('特殊工艺明细')
  await expect(detail).toContainText('工艺位置')

  await detail.getByRole('button', { name: '补打', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-message')).toContainText('补打不生成新的业务菲票')
  await expect(detail).toContainText('已补打')

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请填写作废原因')
    await dialog.accept('测试作废原因')
  })
  await detail.getByRole('button', { name: '作废', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-message')).toContainText('已作废菲票')

  await page.goto(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(ticketWithCraft!.feiTicketId)}`)
  await expect(page.locator('body')).toContainText('菲票标签')
  await expect(page.locator('body')).toContainText('特殊工艺')
  await expect(page.locator('body')).toContainText('工艺位置')
  await expect(page.locator('body')).toContainText('二维码追溯')

  await expectNoPageErrors(errors)
})
