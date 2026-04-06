import { expect, test } from '@playwright/test'

import { buildCuttingSpreadingFlowMatrix } from '../src/data/fcs/cutting/marker-spreading-ledger.ts'
import { buildReplenishmentFlowTraceMatrix } from '../src/data/fcs/cutting/replenishment.ts'
import { buildSpreadingDrivenFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import {
  buildCuttingTraceabilityProjectionContext,
  buildSpreadingBagWarehouseTraceProjection,
} from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布完成后可追溯到打印菲票、装袋与裁片仓，且 PDA 来源沿链保留', async ({ page }) => {
  const errors = collectPageErrors(page)
  const flowRows = buildCuttingSpreadingFlowMatrix()
  const replenishmentTraceRows = buildReplenishmentFlowTraceMatrix()
  const feiTraceRows = buildSpreadingDrivenFeiTicketTraceMatrix()
  const feiProjection = buildFeiTicketPrintProjection()
  const printableUnit =
    feiProjection.printableViewModel.units.find((item) => item.sourceSpreadingSessionIds.length > 0) || null

  expect(printableUnit).toBeTruthy()
  expect(printableUnit!.ticketCountBasisType).toBe('SPREADING_RESULT')
  expect(printableUnit!.sourceSpreadingSessionIds[0]).not.toBe('')
  expect(feiTraceRows.filter((row) => row.sourceSpreadingSessionId).every((row) => row.sourceTraceCompleteness === 'COMPLETE')).toBeTruthy()
  expect(feiTraceRows.some((row) => row.sourceSpreadingSessionId === printableUnit!.sourceSpreadingSessionIds[0])).toBeTruthy()
  expect(replenishmentTraceRows.filter((row) => row.pendingPrepFollowupId).every((row) => row.sourceSpreadingSessionId)).toBeTruthy()

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
  expect(traceRows.every((row) => Boolean(row.spreadingSessionId))).toBeTruthy()

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
  expect(flowRows.some((row) => row.spreadingSessionId === targetRow.spreadingSessionId)).toBeTruthy()

  await page.goto(
    `/fcs/craft/cutting/transfer-bag-detail?bagId=${encodeURIComponent(usage.bagId)}&usageId=${encodeURIComponent(usage.usageId)}`,
  )
  await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('必须先扫口袋码，再扫菲票子码')
  await expect(page.locator('body')).toContainText('来源铺布')
  await expect(page.locator('body')).toContainText('来源唛架')
  await expect(page.locator('body')).toContainText('来源原始裁片单')
  await expect(page.locator('body')).toContainText('来源合并裁剪批次')
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
  await expect(page.locator('body')).toContainText('先装袋后入仓规则')
  await expect(page.locator('body')).toContainText('来源唛架')
  await expect(page.locator('body')).toContainText('来源原始裁片单')
  await expect(page.locator('body')).toContainText('来源合并裁剪批次')
  await expect(page.locator('body')).toContainText(targetRow.spreadingSessionNo || targetRow.spreadingSessionId)
  await expect(page.locator('body')).toContainText(targetRow.bagCode)
  if (usage.spreadingSourceWritebackId) {
    await expect(page.locator('body')).toContainText(usage.spreadingSourceWritebackId)
  }

  await expectNoPageErrors(errors)
})

test('traceability 主锚点以铺布 session 与装袋周期为准，不再以 legacy cutPieceOrderNo 作为主链', async () => {
  const flowRows = buildCuttingSpreadingFlowMatrix()
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
  expect(
    flowRows.some(
      (row) =>
        row.spreadingSessionId === targetRow.spreadingSessionId &&
        (row.bagId !== '' || row.availableBagIds.length > 0),
    ),
  ).toBeTruthy()
})
