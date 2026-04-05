import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { buildGeneratedFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { buildCuttingTraceabilityProjectionContext } from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData } from '../src/pages/process-factory/cutting/marker-spreading-utils.ts'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const taskWithLinkedTarget = listPdaCuttingTaskSourceRecords()
  .flatMap((record) =>
    record.executionOrderIds.map((executionOrderId, index) => ({
      taskId: record.taskId,
      executionOrderId,
      executionOrderNo: record.executionOrderNos[index] || executionOrderId,
      detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
    })),
  )
  .find((item) => Boolean(item.detail?.spreadingTargets.find((target) => target.spreadingSessionId || target.markerId)))

test.skip(!taskWithLinkedTarget, '缺少可直接绑定 session / marker 的 PDA 铺布任务')

test('PDA mock 至少有 3 条可继续追到 supervisor、菲票、装袋、入仓的正式案例', async () => {
  const prototypeData = readMarkerSpreadingPrototypeData()
  const spreadingRows = buildSpreadingListViewModel({
    spreadingSessions: prototypeData.store.sessions,
    rowsById: prototypeData.rowsById,
    mergeBatches: prototypeData.mergeBatches,
    markerRecords: prototypeData.store.markers,
  })
  const pdaRows = spreadingRows.filter((row) => row.session.sourceChannel === 'PDA_WRITEBACK' || Boolean(row.session.sourceWritebackId))
  expect(pdaRows.length).toBeGreaterThanOrEqual(3)

  const feiTraceRows = buildGeneratedFeiTicketTraceMatrix()
  const pdaFeiSessionIds = Array.from(
    new Set(
      feiTraceRows
        .filter((item) => item.sourceWritebackId)
        .map((item) => item.sourceSpreadingSessionId)
        .filter(Boolean),
    ),
  )
  expect(pdaFeiSessionIds.length).toBeGreaterThanOrEqual(3)

  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const pdaBagSessionIds = Array.from(
    new Set(
      traceabilityContext.transferBagViewModel.usages
        .filter((item) => item.spreadingSourceWritebackId)
        .map((item) => item.spreadingSessionId)
        .filter(Boolean),
    ),
  )
  expect(pdaBagSessionIds.length).toBeGreaterThanOrEqual(3)

  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })
  const pdaWarehouseSessionIds = Array.from(
    new Set(
      warehouseProjection.viewModel.items
        .filter((item) => item.sourceWritebackId)
        .map((item) => item.spreadingSessionId)
        .filter(Boolean),
    ),
  )
  expect(pdaWarehouseSessionIds.length).toBeGreaterThanOrEqual(3)

  const downstreamCompleteSessionIds = Array.from(
    new Set(
      pdaRows
        .map((row) => row.spreadingSessionId)
        .filter(
          (sessionId): sessionId is string =>
            Boolean(sessionId) &&
            feiTraceRows.some((item) => item.sourceSpreadingSessionId === sessionId) &&
            traceabilityContext.transferBagViewModel.usages.some((item) => item.spreadingSessionId === sessionId) &&
            warehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === sessionId),
        ),
    ),
  )
  expect(downstreamCompleteSessionIds.length).toBeGreaterThanOrEqual(3)

  const downstreamCompleteWritebackIds = Array.from(
    new Set(
      pdaRows
        .map((row) => row.session.sourceWritebackId)
        .filter(
          (writebackId): writebackId is string =>
            Boolean(writebackId) &&
            feiTraceRows.some((item) => item.sourceWritebackId === writebackId) &&
            traceabilityContext.transferBagViewModel.usages.some((item) => item.spreadingSourceWritebackId === writebackId) &&
            warehouseProjection.viewModel.items.some((item) => item.sourceWritebackId === writebackId),
        ),
    ),
  )
  expect(downstreamCompleteWritebackIds.length).toBeGreaterThanOrEqual(1)
})

test('PDA 铺布写回会绑定 session、marker、roll、operator，并在 PC 端保留回写痕迹', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })

  const task = taskWithLinkedTarget!
  const executionOrderId = task.executionOrderId
  const executionOrderNo = task.executionOrderNo
  const detail = task.detail!
  const target = detail.spreadingTargets.find((item) => item.spreadingSessionId || item.markerId) || detail.spreadingTargets[0]

  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(executionOrderId)}&executionOrderNo=${encodeURIComponent(executionOrderNo)}`,
  )

  await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"]').selectOption(target.targetKey)
  const planUnitId = await page.locator('[data-pda-cut-spreading-field="planUnitId"]').evaluate((element) => {
    const select = element as HTMLSelectElement
    return select.options[1]?.value || ''
  })
  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption(planUnitId)
  await page.locator('[data-pda-cut-spreading-field="recordType"]').selectOption('中途交接')
  await page.locator('[data-pda-cut-spreading-field="handoverToAccountId"]').selectOption({ index: 1 })
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-WRITEBACK-01')
  await page.locator('[data-pda-cut-spreading-field="layerCount"]').fill('9')
  await page.locator('[data-pda-cut-spreading-field="actualLength"]').fill('39')
  await page.locator('[data-pda-cut-spreading-field="headLength"]').fill('0.4')
  await page.locator('[data-pda-cut-spreading-field="tailLength"]').fill('0.6')
  await page.locator('[data-pda-cut-spreading-field="handoverNote"]').fill('A 班交给 B 班继续')
  await page.locator('[data-pda-cut-spreading-field="note"]').fill('写回链路验证')

  await page.getByRole('button', { name: '保存铺布记录' }).click()
  await expect(page.getByText('铺布记录已保存，已清空本次录入值。')).toBeVisible()

  const storage = await page.evaluate(() => {
    return {
      inbox: JSON.parse(window.localStorage.getItem('cuttingPdaWritebackInbox') || '{"writebacks":[],"auditTrails":[]}'),
      ledger: JSON.parse(window.localStorage.getItem('cuttingMarkerSpreadingLedger') || '{"sessions":[],"markers":[]}'),
    }
  })

  const writeback = storage.inbox.writebacks[0]
  expect(writeback.spreadingSessionId).toBe(target.spreadingSessionId || '')
  expect(writeback.markerId).toBe(target.markerId || '')
  expect(writeback.markerNo).toBe(target.markerNo || '')
  expect(writeback.spreadingMode).toBe(target.spreadingMode)
  expect(writeback.recordType).toBe('中途交接')
  expect(writeback.occurredAt).toBeTruthy()
  expect(writeback.planUnits.length).toBeGreaterThan(0)
  expect(writeback.rollItems[0].rollWritebackItemId).toBeTruthy()
  expect(writeback.rollItems[0].planUnitId).toBe(planUnitId)
  expect(writeback.rollItems[0].rollNo).toBe('ROLL-WRITEBACK-01')
  expect(writeback.rollItems[0].actualSpreadLengthM).toBe(39)
  expect(writeback.rollItems[0].headLossM).toBe(0.4)
  expect(writeback.rollItems[0].tailLossM).toBe(0.6)
  expect(writeback.rollItems[0].spreadLayerCount).toBe(9)
  expect(writeback.operatorItems[0].rollWritebackItemId).toBe(writeback.rollItems[0].rollWritebackItemId)
  expect(writeback.operatorItems[0].operatorAccountId).toBe('ID-F004_prod')
  expect(writeback.operatorItems[0].actionType).toBe('中途交接')
  expect(writeback.operatorItems[0].handoverFlag).toBe(true)
  expect(writeback.operatorItems[0].handoverToAccountId).toBeTruthy()

  const appliedSessionId = writeback.appliedSessionId || writeback.spreadingSessionId
  const session = storage.ledger.sessions.find((item: { spreadingSessionId: string }) => item.spreadingSessionId === appliedSessionId)
  expect(session).toBeTruthy()

  const roll = session.rolls.find((item: { sourceWritebackId: string; rollNo: string }) => item.sourceWritebackId === writeback.writebackId && item.rollNo === 'ROLL-WRITEBACK-01')
  expect(roll).toBeTruthy()
  expect(roll.planUnitId).toBe(planUnitId)
  expect(roll.sourceChannel).toBe('PDA_WRITEBACK')
  expect(roll.updatedFromPdaAt).toBeTruthy()

  const operator = session.operators.find((item: { sourceWritebackId: string; operatorAccountId: string }) => item.sourceWritebackId === writeback.writebackId && item.operatorAccountId === 'ID-F004_prod')
  expect(operator).toBeTruthy()
  expect(operator.rollRecordId).toBe(roll.rollRecordId)
  expect(operator.handoverFlag).toBe(true)

  await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(appliedSessionId)}`)
  await page.getByRole('button', { name: '卷记录' }).click()
  await expect(page.getByText('PDA回写')).toBeVisible()
  await page.getByRole('button', { name: '换班与人员' }).click()
  await expect(page.getByText(operator.operatorName).first()).toBeVisible()
  await expect(page.getByText('A 班交给 B 班继续').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
