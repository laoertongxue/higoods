import { expect, test } from '@playwright/test'

import { buildCuttingTraceabilityProjectionContext } from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import { buildGeneratedFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

function resolveSupervisorStageKey(row: ReturnType<typeof buildSpreadingRows>[number]) {
  const lifecycle = row.session.prototypeLifecycleOverrides
  if (row.statusKey === 'DRAFT' || row.statusKey === 'TO_FILL') return 'WAITING_START'
  if (row.statusKey === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (lifecycle?.replenishmentStatusLabel === '待补料确认') return 'WAITING_REPLENISHMENT'
  if (lifecycle?.feiTicketStatusLabel === '待打印菲票') return 'WAITING_FEI_TICKET'
  if (lifecycle?.baggingStatusLabel === '待装袋') return 'WAITING_BAGGING'
  if (lifecycle?.warehouseStatusLabel === '待入仓') return 'WAITING_WAREHOUSE'
  return 'DONE'
}

function buildSpreadingRows() {
  const context = buildCuttingTraceabilityProjectionContext()
  return buildSpreadingListViewModel({
    spreadingSessions: context.spreadingStore.sessions,
    rowsById: Object.fromEntries(context.materialPrepRows.map((row) => [row.originalCutOrderId, row])),
    mergeBatches: context.mergeBatches,
    markerRecords: context.spreadingStore.markers,
  })
}

test('铺布 mock 已扩成完整流程矩阵，关键状态与下游锚点不再是孤儿数据', async () => {
  const prototypeData = readMarkerSpreadingPrototypeData()
  const spreadingRows = buildSpreadingRows()
  const feiTraceRows = buildGeneratedFeiTicketTraceMatrix()
  const feiProjection = buildFeiTicketPrintProjection()
  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })

  expect(prototypeData.store.sessions.length).toBeGreaterThanOrEqual(18)

  const statusCount = spreadingRows.reduce<Record<string, number>>((accumulator, row) => {
    const stageKey = resolveSupervisorStageKey(row)
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

  expect(spreadingRows.filter((row) => row.contextType === 'merge-batch').length).toBeGreaterThanOrEqual(3)
  expect(spreadingRows.filter((row) => row.session.sourceChannel === 'PDA_WRITEBACK' || Boolean(row.session.sourceWritebackId)).length).toBeGreaterThanOrEqual(3)

  const waitingFeiSessions = spreadingRows.filter((row) => resolveSupervisorStageKey(row) === 'WAITING_FEI_TICKET')
  waitingFeiSessions.slice(0, 2).forEach((row) => {
    const relatedFeiRows = feiTraceRows.filter((item) => item.sourceSpreadingSessionId === row.spreadingSessionId)
    expect(relatedFeiRows.length).toBeGreaterThan(0)
    expect(relatedFeiRows.every((item) => item.originalCutOrderId && item.color && item.size)).toBeTruthy()
    expect(feiProjection.printableViewModel.units.some((unit) => unit.sourceSpreadingSessionIds.includes(row.spreadingSessionId))).toBeTruthy()
  })

  const waitingWarehouseSessions = spreadingRows.filter((row) => resolveSupervisorStageKey(row) === 'WAITING_WAREHOUSE')
  const waitingWarehouseTracedSessions = waitingWarehouseSessions.filter((row) => {
    const bagUsage = traceabilityContext.transferBagViewModel.usages.find((item) => item.spreadingSessionId === row.spreadingSessionId)
    const warehouseItem = warehouseProjection.viewModel.items.find((item) => item.spreadingSessionId === row.spreadingSessionId)
    return Boolean(bagUsage && warehouseItem)
  })
  expect(waitingWarehouseTracedSessions.length).toBeGreaterThanOrEqual(1)

  const doneWithWarehouse = spreadingRows.filter(
    (row) =>
      row.statusKey === 'DONE' &&
      resolveSupervisorStageKey(row) === 'DONE' &&
      warehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === row.spreadingSessionId),
  )
  expect(doneWithWarehouse.length).toBeGreaterThanOrEqual(3)
})

test('铺布 mock 覆盖原始裁片单上下文的 PDA -> 装袋 -> 入裁片仓链路', async ({ page }) => {
  const errors = collectPageErrors(page)
  const spreadingRows = buildSpreadingRows()
  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })

  const originalSession =
    spreadingRows.find(
      (row) =>
        row.contextType === 'original-order' &&
        resolveSupervisorStageKey(row) === 'DONE' &&
        Boolean(row.session.sourceWritebackId) &&
        traceabilityContext.transferBagViewModel.usages.some((item) => item.spreadingSessionId === row.spreadingSessionId) &&
        warehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === row.spreadingSessionId),
    ) ||
    spreadingRows.find(
      (row) =>
        row.contextType === 'original-order' &&
        resolveSupervisorStageKey(row) === 'DONE' &&
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
  await expect(page.locator('body')).toContainText('来源铺布 session')
  await expect(page.locator('body')).toContainText(originalSession!.sessionNo || originalSession!.spreadingSessionId)

  await page.goto(`/fcs/craft/cutting/cut-piece-warehouse?originalCutOrderId=${encodeURIComponent(warehouseItem!.originalCutOrderId)}`)
  const warehouseRow = page.locator('table tbody tr').filter({ hasText: warehouseItem!.originalCutOrderNo }).first()
  await expect(warehouseRow).toBeVisible()
  await warehouseRow.getByRole('button', { name: '查看详情', exact: true }).click({ force: true })
  await expect(page.locator('body')).toContainText(warehouseItem!.bagCode)
  await expect(page.locator('body')).toContainText('先装袋，再入裁片仓')

  await expectNoPageErrors(errors)
})

test('铺布 mock 覆盖合并批次上下文的完成 -> 补料 -> 装袋链路', async () => {
  const spreadingRows = buildSpreadingRows()
  const traceabilityContext = buildCuttingTraceabilityProjectionContext()

  const mergeBatchSession =
    spreadingRows.find((row) => {
      if (row.contextType !== 'merge-batch') return false
      if (!['WAITING_BAGGING', 'WAITING_WAREHOUSE', 'DONE'].includes(resolveSupervisorStageKey(row))) return false
      return traceabilityContext.transferBagViewModel.usages.some(
        (item) =>
          item.spreadingSessionId === row.spreadingSessionId &&
          item.mergeBatchNos.includes(row.mergeBatchNo),
      )
    }) ||
    spreadingRows.find((row) => row.contextType === 'merge-batch' && resolveSupervisorStageKey(row) === 'DONE')

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
