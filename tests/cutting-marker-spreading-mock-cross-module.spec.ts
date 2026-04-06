import { expect, test } from '@playwright/test'

import { buildCuttingTraceabilityProjectionContext } from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import { buildCuttingSpreadingFlowMatrix, readMarkerSpreadingPrototypeData } from '../src/data/fcs/cutting/marker-spreading-ledger.ts'
import { buildReplenishmentFlowTraceMatrix } from '../src/data/fcs/cutting/replenishment.ts'
import { buildSpreadingDrivenFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布 mock 已扩成完整流程矩阵，关键状态与下游锚点不再是孤儿数据', async () => {
  const prototypeData = readMarkerSpreadingPrototypeData()
  const flowRows = buildCuttingSpreadingFlowMatrix()
  const feiProjection = buildFeiTicketPrintProjection()
  const replenishmentTraceRows = buildReplenishmentFlowTraceMatrix()
  const feiTraceRows = buildSpreadingDrivenFeiTicketTraceMatrix()

  expect(prototypeData.store.sessions.length).toBeGreaterThanOrEqual(18)

  const statusCount = flowRows.reduce<Record<string, number>>((accumulator, row) => {
    const stageKey = row.stageKey
    accumulator[stageKey] = (accumulator[stageKey] || 0) + 1
    return accumulator
  }, {})
  expect(statusCount.WAITING_REPLENISHMENT || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_FEI_TICKET || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_BAGGING || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_WAREHOUSE || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.DONE || 0).toBeGreaterThanOrEqual(3)

  const modeCount = prototypeData.store.sessions.reduce<Record<string, number>>((accumulator, session) => {
    accumulator[session.spreadingMode] = (accumulator[session.spreadingMode] || 0) + 1
    return accumulator
  }, {})
  expect(modeCount.normal || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.high_low || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.fold_normal || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.fold_high_low || 0).toBeGreaterThanOrEqual(2)

  expect(flowRows.filter((row) => row.contextType === 'merge-batch').length).toBeGreaterThanOrEqual(3)
  expect(flowRows.filter((row) => row.sourceChannel === 'PDA_WRITEBACK' || Boolean(row.sourceWritebackId)).length).toBeGreaterThanOrEqual(3)

  const waitingReplenishmentRows = flowRows.filter((row) => row.stageKey === 'WAITING_REPLENISHMENT')
  waitingReplenishmentRows.slice(0, 2).forEach((row) => {
    expect(row.replenishmentRequestId).not.toBe('')
    expect(row.spreadingSessionId).not.toBe('')
  })

  const pendingPrepRows = replenishmentTraceRows.filter((row) => Boolean(row.pendingPrepFollowupId))
  expect(pendingPrepRows.length).toBeGreaterThanOrEqual(1)
  pendingPrepRows.forEach((row) => {
    expect(row.sourceSpreadingSessionId).not.toBe('')
    expect(row.sourceMarkerId || row.sourceMarkerNo).not.toBe('')
  })

  const waitingFeiRows = flowRows.filter((row) => row.stageKey === 'WAITING_FEI_TICKET')
  waitingFeiRows.slice(0, 2).forEach((row) => {
    expect(row.availableFeiTicketIds.length).toBeGreaterThan(0)
    expect(feiProjection.printableViewModel.units.some((unit) => unit.sourceSpreadingSessionIds.includes(row.spreadingSessionId))).toBeTruthy()
    expect(feiTraceRows.some((item) => item.sourceSpreadingSessionId === row.spreadingSessionId)).toBeTruthy()
  })

  const waitingWarehouseRows = flowRows.filter((row) => row.stageKey === 'WAITING_WAREHOUSE')
  expect(waitingWarehouseRows.filter((row) => row.bagId && row.transferBatchId).length).toBeGreaterThanOrEqual(1)

  const doneWithWarehouse = flowRows.filter((row) => row.stageKey === 'DONE' && row.warehouseRecordId)
  expect(doneWithWarehouse.length).toBeGreaterThanOrEqual(3)

  const pdaFlowRows = flowRows.filter((row) => row.sourceWritebackId)
  expect(pdaFlowRows.filter((row) => row.planUnitId && row.rollRecordId && row.operatorRecordId).length).toBeGreaterThanOrEqual(3)
})

test('铺布 mock 覆盖原始裁片单上下文的 PDA -> 装袋 -> 入裁片仓链路', async ({ page }) => {
  const errors = collectPageErrors(page)
  const flowRows = buildCuttingSpreadingFlowMatrix()
  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })

  const originalSession =
    flowRows.find(
      (row) =>
        row.contextType === 'original-order' &&
        row.stageKey === 'DONE' &&
        Boolean(row.sourceWritebackId) &&
        traceabilityContext.transferBagViewModel.usages.some((item) => item.spreadingSessionId === row.spreadingSessionId) &&
        warehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === row.spreadingSessionId),
    ) ||
    flowRows.find(
      (row) =>
        row.contextType === 'original-order' &&
        row.stageKey === 'DONE' &&
        traceabilityContext.transferBagViewModel.usages.some((item) => item.spreadingSessionId === row.spreadingSessionId) &&
        warehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === row.spreadingSessionId),
    )

  expect(originalSession).toBeTruthy()

  const usage = traceabilityContext.transferBagViewModel.usages.find(
    (item) =>
      item.spreadingSessionId === originalSession!.spreadingSessionId &&
      item.originalCutOrderNos.some((orderNo) => originalSession!.originalCutOrderNos.includes(orderNo)),
  )
  expect(usage).toBeTruthy()

  const warehouseItem = warehouseProjection.viewModel.items.find(
    (item) =>
      item.spreadingSessionId === originalSession!.spreadingSessionId &&
      item.bagUsageId === usage!.usageId,
  )
  expect(warehouseItem).toBeTruthy()

  await page.goto(
    `/fcs/craft/cutting/transfer-bag-detail?bagId=${encodeURIComponent(usage!.bagId)}&usageId=${encodeURIComponent(usage!.usageId)}`,
  )
  await expect(page.locator('body')).toContainText('来源铺布')
  await expect(page.locator('body')).toContainText(originalSession!.sessionNo || originalSession!.spreadingSessionId)

  await page.goto(`/fcs/craft/cutting/cut-piece-warehouse?originalCutOrderId=${encodeURIComponent(warehouseItem!.originalCutOrderId)}`)
  const warehouseRow = page.locator('table tbody tr').filter({ hasText: warehouseItem!.originalCutOrderNo }).first()
  await expect(warehouseRow).toBeVisible()
  await warehouseRow.getByRole('button', { name: '查看详情', exact: true }).click({ force: true })
  await expect(page.locator('body')).toContainText(warehouseItem!.bagCode)
  await expect(page.locator('body')).toContainText('先装袋，再入裁片仓')

  await expectNoPageErrors(errors)
})

test('铺布 mock 覆盖合并裁剪批次上下文的完成 -> 补料 -> 装袋链路', async () => {
  const flowRows = buildCuttingSpreadingFlowMatrix()
  const traceabilityContext = buildCuttingTraceabilityProjectionContext()

  const mergeBatchSession =
    flowRows.find((row) => {
      if (row.contextType !== 'merge-batch') return false
      if (!['WAITING_BAGGING', 'WAITING_WAREHOUSE', 'DONE'].includes(row.stageKey)) return false
      return traceabilityContext.transferBagViewModel.usages.some(
        (item) =>
          item.spreadingSessionId === row.spreadingSessionId &&
          item.mergeBatchNos.includes(row.mergeBatchNo),
      )
    }) ||
    flowRows.find((row) => row.contextType === 'merge-batch' && row.stageKey === 'DONE')

  expect(mergeBatchSession).toBeTruthy()
  expect(mergeBatchSession!.mergeBatchNo).not.toBe('')

  const usage = traceabilityContext.transferBagViewModel.usages.find(
    (item) =>
      item.spreadingSessionId === mergeBatchSession!.spreadingSessionId &&
      item.mergeBatchNos.includes(mergeBatchSession!.mergeBatchNo),
  )

  expect(usage).toBeTruthy()
  expect(usage!.bagFirstSatisfied).toBe(true)
  expect(usage!.bagFirstRuleLabel).toContain('必须先扫口袋码，再扫菲票子码')
})
