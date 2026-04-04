import { expect, test } from '@playwright/test'

import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import {
  buildCuttingTraceabilityProjectionContext,
  buildSpreadingBagWarehouseTraceProjection,
} from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布完成后可追溯到打印菲票、装袋与裁片仓，且 PDA 来源沿链保留', async ({ page }) => {
  const errors = collectPageErrors(page)
  const feiProjection = buildFeiTicketPrintProjection()
  const printableUnit =
    feiProjection.printableViewModel.units.find((item) => item.sourceSpreadingSessionIds.length > 0) || null

  expect(printableUnit).toBeTruthy()
  expect(printableUnit!.sourceSpreadingSessionIds[0]).not.toBe('')

  await page.goto(
    `/fcs/craft/cutting/fei-tickets?spreadingSessionId=${encodeURIComponent(printableUnit!.sourceSpreadingSessionIds[0])}&spreadingSessionNo=${encodeURIComponent(printableUnit!.sourceSpreadingSessionNos[0] || printableUnit!.sourceSpreadingSessionIds[0])}`,
  )
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('来源铺布')
  await expect(page.locator('body')).toContainText(
    printableUnit!.sourceSpreadingSessionNos[0] || printableUnit!.sourceSpreadingSessionIds[0],
  )

  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })
  const traceRows = buildSpreadingBagWarehouseTraceProjection({
    transferBagViewModel: traceabilityContext.transferBagViewModel,
    warehouseItems: warehouseProjection.viewModel.items,
  })

  expect(traceRows.length).toBeGreaterThan(0)

  const targetRow =
    traceRows.find((item) => item.bagFirstSatisfied && item.sourceWritebackId) ||
    traceRows.find((item) => item.bagFirstSatisfied) ||
    traceRows[0]

  expect(targetRow.spreadingSessionId).not.toBe('')
  expect(targetRow.bagUsageId).not.toBe('')
  expect(targetRow.warehouseItemId).not.toBe('')
  expect(Object.prototype.hasOwnProperty.call(targetRow, 'cutPieceOrderNo')).toBe(false)

  const usage = traceabilityContext.transferBagViewModel.usagesById[targetRow.bagUsageId]
  expect(usage).toBeTruthy()

  await page.goto(
    `/fcs/craft/cutting/transfer-bag-detail?bagId=${encodeURIComponent(usage.bagId)}&usageId=${encodeURIComponent(usage.usageId)}`,
  )
  await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('必须先扫口袋码，再扫菲票子码')
  await expect(page.locator('body')).toContainText('来源铺布 session')
  await expect(page.locator('body')).toContainText(targetRow.spreadingSessionNo || targetRow.spreadingSessionId)
  if (usage.spreadingSourceWritebackId) {
    await expect(page.locator('body')).toContainText(usage.spreadingSourceWritebackId)
  }

  await page.goto(`/fcs/craft/cutting/cut-piece-warehouse?originalCutOrderId=${encodeURIComponent(targetRow.originalCutOrderId)}`)
  const warehouseRow = page
    .locator('table tbody tr')
    .filter({ hasText: targetRow.originalCutOrderNo })
    .first()
  await expect(warehouseRow).toBeVisible()
  await warehouseRow.getByRole('button', { name: '查看详情', exact: true }).click({ force: true })
  await expect(page.locator('body')).toContainText('铺布 / 装袋追溯')
  await expect(page.locator('body')).toContainText('bag-first 规则')
  await expect(page.locator('body')).toContainText(targetRow.spreadingSessionNo || targetRow.spreadingSessionId)
  await expect(page.locator('body')).toContainText(targetRow.bagCode)
  if (usage.spreadingSourceWritebackId) {
    await expect(page.locator('body')).toContainText(usage.spreadingSourceWritebackId)
  }

  await expectNoPageErrors(errors)
})

test('traceability 主锚点以铺布 session 与装袋周期为准，不再以 legacy cutPieceOrderNo 作为主链', async () => {
  const feiProjection = buildFeiTicketPrintProjection()
  const tracedPrintableUnit = feiProjection.printableViewModel.units.find((item) => item.sourceSpreadingSessionIds.length > 0) || null
  expect(tracedPrintableUnit).toBeTruthy()
  expect(tracedPrintableUnit!.sourceSpreadingSessionIds.length).toBeGreaterThan(0)

  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })
  const traceRows = buildSpreadingBagWarehouseTraceProjection({
    transferBagViewModel: traceabilityContext.transferBagViewModel,
    warehouseItems: warehouseProjection.viewModel.items,
  })

  expect(traceRows.length).toBeGreaterThan(0)
  const targetRow = traceRows[0]

  expect(targetRow.primaryAnchorType).toBe('spreading-session')
  expect(targetRow.spreadingSessionId).not.toBe('')
  expect(targetRow.bagUsageId).not.toBe('')
  expect(Object.prototype.hasOwnProperty.call(targetRow, 'cutPieceOrderNo')).toBe(false)
})
