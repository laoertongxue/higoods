import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'

async function openWaitHandoverPage(page: Page, suffix = ''): Promise<void> {
  await page.goto(`${WAIT_HANDOVER_PATH}${suffix}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({ timeout: 120_000 })
}

async function findCrossHierarchyLocations(map: Locator) {
  return map.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').evaluateAll((buttons) => {
    const rows = buttons.map((button) => {
      const element = button as HTMLElement
      const locationNo = element.dataset.locationNo || ''
      const match = locationNo.match(/^([A-Z])-R(\d+)-L(\d+)-P/)
      return match ? {
        id: element.dataset.locationId || '',
        no: locationNo,
        area: match[1],
        shelf: `${match[1]}-R${match[2]}`,
        level: match[3],
      } : null
    }).filter((row): row is NonNullable<typeof row> => Boolean(row?.id))
    const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values())
    for (let first = 0; first < uniqueRows.length; first += 1) {
      for (let second = first + 1; second < uniqueRows.length; second += 1) {
        for (let third = second + 1; third < uniqueRows.length; third += 1) {
          const group = [uniqueRows[first], uniqueRows[second], uniqueRows[third]]
          if (new Set(group.map((row) => row.area)).size > 1
            && new Set(group.map((row) => row.shelf)).size > 1
            && new Set(group.map((row) => row.level)).size > 1) return group
        }
      }
    }
    return []
  })
}

test('真实待交出工作台以生产事件账历史确认夹具和最终交出 handler 完成源目标换袋三格闭环', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  test.setTimeout(300_000)
  const errors = collectPageErrors(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('wait-handover-handler-e2e-initialized') === '1') return
    localStorage.removeItem('cuttingRuntimeEventLedger')
    sessionStorage.setItem('wait-handover-handler-e2e-initialized', '1')
  })
  await openWaitHandoverPage(page)

  await page.evaluate(async () => {
    const tickets = await import('/src/data/fcs/cutting/generated-fei-tickets.ts')
    const numbering = await import('/src/data/fcs/cutting/fei-ticket-numbering.ts')
    tickets.listSpreadingResultGeneratedFeiTickets()
      .filter((ticket) => ticket.ticketStatus !== 'VOIDED' && ticket.pieceSequenceRange)
      .forEach((ticket) => numbering.completeFeiTicketNumbering({
        feiTicketNoOrId: ticket.feiTicketId,
        operatorName: 'Web 验收打编号员',
        source: 'WEB',
      }))
  })

  const bagCode = `WEB-HANDLER-${Date.now()}`
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  const baggingDialog = page.locator('[data-wait-handover-modal="bagging"]')
  await expect(baggingDialog).toBeVisible()
  await baggingDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  const ticketSelect = baggingDialog.locator('[data-wait-handover-field="feiTicketId"]')
  expect(await ticketSelect.locator('option:not([disabled])').count()).toBeGreaterThan(0)
  const directSewingTicketId = await ticketSelect.evaluate(async (select) => {
    const dispatch = await import('/src/data/fcs/cutting/sewing-dispatch.ts')
    const availableIds = new Set(Array.from((select as HTMLSelectElement).options).map((option) => option.value).filter(Boolean))
    return dispatch.listAvailableFeiTicketsForSewingDispatch()
      .find((ticket) => availableIds.has(ticket.feiTicketId) && !ticket.hasSpecialCraft)?.feiTicketId || ''
  })
  expect(directSewingTicketId).not.toBe('')
  await ticketSelect.selectOption(directSewingTicketId)
  await baggingDialog.getByRole('button', { name: '确认菲票装袋', exact: true }).click()
  await expect(baggingDialog).toHaveCount(0)

  await page.locator('[data-wait-handover-action="open-inbound"]').click()
  const inboundDialog = page.locator('[data-wait-handover-modal="inbound"]')
  await expect(inboundDialog).toBeVisible()
  await inboundDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  const map = inboundDialog.locator('[data-warehouse-map-root]')
  const clearSelection = map.locator('[data-warehouse-map-action="clear-selection"]')
  if (await clearSelection.count()) await clearSelection.click()
  const locations = await findCrossHierarchyLocations(map)
  expect(locations).toHaveLength(3)
  for (const location of locations) {
    await inboundDialog.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`).click()
  }
  await expect(inboundDialog.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 3 个库位')
  await inboundDialog.getByRole('button', { name: '确认中转袋入仓', exact: true }).click()
  await expect(inboundDialog).toHaveCount(0)

  await openWaitHandoverPage(page, '?tab=locations')
  for (const location of locations) {
    await expect(page.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`)).toContainText(bagCode)
  }
  const summary = page.locator('[data-warehouse-map-summary-section]')
  await expect(summary).toContainText('1 袋')
  await expect(summary).toContainText('3 个库位')
  const summaryText = await summary.innerText()
  expect((summaryText.match(new RegExp(bagCode, 'g')) || []).length).toBe(1)

  const targetTransferBagCode = `WEB-TARGET-${Date.now()}`
  const confirmationTargets = await page.evaluate(async ({ sourceBagCode, targetBagCode, locationIds }) => {
    const runtime = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts')
    const dispatch = await import('/src/data/fcs/cutting/sewing-dispatch.ts')
    const ledger = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const mapModule = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const mapModel = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    const snapshot = runtime.resolveWaitHandoverBaggingSnapshot(sourceBagCode)
    const currentMap = mapModule.buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
    const warehouseLocations = currentMap
      ? mapModel.listWarehouseLocationMapCells(currentMap.projection).filter((cell) => locationIds.includes(cell.locationId))
      : []
    if (!snapshot?.tickets.length || warehouseLocations.length !== locationIds.length) throw new Error('缺少真实分配装袋上游事实')
    const allocation = dispatch.buildSewingTaskAllocationProjectionFromInventory(snapshot.tickets.map((ticket) => ({
      inventoryRecordId: `INV-${sourceBagCode}-${ticket.feiTicketId}`,
      feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo,
      cutOrderId: ticket.cutOrderId, cutOrderNo: ticket.cutOrderNo,
      productionOrderId: ticket.productionOrderId, productionOrderNo: ticket.productionOrderNo,
      spuCode: ticket.spuCode, color: ticket.color, size: ticket.size, partName: ticket.partName,
      pieceQty: ticket.pieceQty, pieceSequenceLabel: ticket.pieceSequenceLabel,
      hasSpecialCraft: ticket.hasSpecialCraft, specialCraftDisplay: ticket.specialCraftDisplayLabel,
      receiverFactoryDisplay: '', printStatus: '已打印', voidStatus: '有效', tempBagCode: sourceBagCode,
      warehouseArea: warehouseLocations[0].areaName, locationCode: warehouseLocations[0].locationNo,
      inboundAt: '2026-08-02 12:00', inventoryStatus: '待分配',
    })))
    const picking = dispatch.buildHandoverPickingTaskProjectionFromAllocationProjection(allocation)
    const task = picking.tasks.find((item) => item.allocatedInventoryItems.some((item) => item.tempBagCode === sourceBagCode))
    if (!task) throw new Error('生产分配/分拣投影未形成真实任务')
    const sourceEvents = ledger.listCuttingRuntimeEvents()
    const sourceBaggingEvent = sourceEvents.find((event) =>
      event.eventType === '菲票装袋' && event.refs.transferBagCode === sourceBagCode)
    const sourceInboundEvent = sourceEvents.find((event) =>
      event.eventType === '中转袋入仓' && event.refs.transferBagCode === sourceBagCode)
    if (!sourceBaggingEvent || !sourceInboundEvent) throw new Error('缺少源袋装袋或入仓历史事实')
    const baggingAtMs = Date.parse(sourceBaggingEvent.occurredAt)
    const inboundAtMs = Date.parse(sourceInboundEvent.occurredAt)
    if (!Number.isFinite(baggingAtMs) || !Number.isFinite(inboundAtMs)) {
      throw new Error('源袋装袋与入仓时间顺序异常')
    }
    const olderTargetBagCode = `${targetBagCode}-OLD`
    const extraTicketTargetBagCode = `${targetBagCode}-EXTRA`
    const appendHistoricalConfirm = (input: {
      targetCode: string
      occurredAt: string
      createdAt: string
      ticketIds: string[]
      ticketNos: string[]
      suffix: string
    }) => ledger.appendCuttingRuntimeEvent({
      eventType: '交出装袋确认', eventSource: 'WEB', eventStatus: '已同步',
      occurredAt: input.occurredAt, createdAt: input.createdAt, operatorName: `历史分拣确认员-${input.suffix}`,
      refs: {
        transferBagCode: input.targetCode,
        usageCycleId: `cycle:${input.targetCode}:1`,
        productionOrderId: snapshot.tickets[0].productionOrderId,
        productionOrderNo: snapshot.tickets[0].productionOrderNo,
        taskId: task.pickingTaskId,
        feiTicketIds: input.ticketIds,
        feiTicketNos: input.ticketNos,
      },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: snapshot.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0), unit: '片' },
      payload: {
        sourceTempBagCode: sourceBagCode,
        targetTransferBagCode: input.targetCode,
        bagUseId: `cycle:${input.targetCode}:1`,
        containedFeiTicketIds: input.ticketIds,
        pickingTaskId: task.pickingTaskId,
        pickingTaskNo: `${task.pickingTaskNo}-${input.suffix}`,
        sewingTaskId: task.sewingTaskId,
        sewingTaskNo: task.sewingTaskNo,
        receiverType: '车缝厂',
        receiverFactoryId: task.receiverFactoryId,
        receiverFactoryName: task.receiverFactoryName,
      },
    })
    const sourceTicketIds = snapshot.tickets.map((ticket) => ticket.feiTicketId)
    const sourceTicketNos = snapshot.tickets.map((ticket) => ticket.feiTicketNo)
    appendHistoricalConfirm({
      targetCode: olderTargetBagCode,
      occurredAt: sourceBaggingEvent.occurredAt,
      createdAt: '1970-01-01T00:00:00.001Z',
      ticketIds: sourceTicketIds,
      ticketNos: sourceTicketNos,
      suffix: '旧确认',
    })
    appendHistoricalConfirm({
      targetCode: extraTicketTargetBagCode,
      occurredAt: sourceBaggingEvent.occurredAt,
      createdAt: '1970-01-01T00:00:00.002Z',
      ticketIds: [...sourceTicketIds, 'FT-EXTRA-NOT-IN-SOURCE'],
      ticketNos: [...sourceTicketNos, 'FT-EXTRA-NOT-IN-SOURCE'],
      suffix: '多票确认',
    })
    const confirmedAt = new Date(Date.now() + 1_000).toISOString()
    const targetUsageCycleId = `cycle:${targetBagCode}:${confirmedAt}`
    const totalPieceQty = snapshot.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)
    ledger.appendCuttingRuntimeEvent({
      eventType: '交出装袋确认', eventSource: 'WEB', eventStatus: '已同步',
      occurredAt: confirmedAt, operatorName: '交出装袋确认员',
      refs: {
        transferBagCode: targetBagCode, usageCycleId: targetUsageCycleId,
        productionOrderId: snapshot.tickets[0].productionOrderId,
        productionOrderNo: snapshot.tickets[0].productionOrderNo,
        taskId: task.pickingTaskId, feiTicketIds: snapshot.tickets.map((ticket) => ticket.feiTicketId),
        feiTicketNos: snapshot.tickets.map((ticket) => ticket.feiTicketNo),
      },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: totalPieceQty, unit: '片' },
      payload: {
        baggingConfirmRecordId: `BCR-${targetBagCode}`,
        baggingConfirmRecordNo: `BCR-${targetBagCode}`,
        sourceTempBagCode: sourceBagCode, targetTransferBagCode: targetBagCode,
        bagUseId: targetUsageCycleId,
        pickingTaskId: task.pickingTaskId, pickingTaskNo: task.pickingTaskNo,
        sewingTaskId: task.sewingTaskId, sewingTaskNo: task.sewingTaskNo,
        receiverType: '车缝厂', receiverFactoryId: task.receiverFactoryId, receiverFactoryName: task.receiverFactoryName,
        scannedFeiTicketIds: snapshot.tickets.map((ticket) => ticket.feiTicketId),
        scannedFeiTicketNos: snapshot.tickets.map((ticket) => ticket.feiTicketNo),
        containedFeiTicketIds: snapshot.tickets.map((ticket) => ticket.feiTicketId),
        containedFeiTicketNos: snapshot.tickets.map((ticket) => ticket.feiTicketNo),
        totalPieceQty,
        pickedQty: totalPieceQty,
        unit: '片',
        scannedAt: confirmedAt,
        scannedBy: '交出装袋确认员',
        packedAt: confirmedAt,
        packedBy: '交出装袋确认员',
        checkResult: '正常',
        bagBindingRule: '一个中转袋只能绑定一个车缝任务',
      },
    })
    const targetSnapshot = runtime.resolveWaitHandoverBaggingSnapshot(targetBagCode)
    if (!targetSnapshot || targetSnapshot.usageCycleId !== targetUsageCycleId
      || targetSnapshot.tickets.length !== snapshot.tickets.length) {
      throw new Error('目标中转袋未建立独立袋内快照和使用周期')
    }
    const lifecycle = runtime.buildWaitHandoverLifecycleByBagCode(targetBagCode)
    if (lifecycle.flowStage !== 'INBOUND_STORED') {
      throw new Error(`目标中转袋交出装袋确认后状态异常：${lifecycle.flowStageLabel}`)
    }
    return { targetBagCode, olderTargetBagCode, extraTicketTargetBagCode }
  }, { sourceBagCode: bagCode, targetBagCode: targetTransferBagCode, locationIds: locations.map((location) => location.id) })
  const transferBagCode = confirmationTargets.targetBagCode

  await openWaitHandoverPage(page, '?tab=locations')
  for (const location of locations) {
    const locationCell = page.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`)
    await expect(locationCell).toContainText(transferBagCode)
    await expect(locationCell).not.toContainText(bagCode)
  }

  await openWaitHandoverPage(page)
  await page.locator('[data-wait-handover-action="open-handover"]').click()
  const handoverDialog = page.locator('[data-wait-handover-modal="handover"]')
  await expect(handoverDialog).toBeVisible()
  const handoverSelection = handoverDialog.locator('[data-wait-handover-field="handoverSelection"]')
  const bagOption = handoverSelection.locator('option').filter({ hasText: new RegExp(`^${transferBagCode} /`) })
  await expect(bagOption).toHaveCount(1)
  await expect(handoverSelection.locator('option').filter({ hasText: new RegExp(`^${confirmationTargets.olderTargetBagCode} /`) })).toHaveCount(0)
  await expect(handoverSelection.locator('option').filter({ hasText: new RegExp(`^${confirmationTargets.extraTicketTargetBagCode} /`) })).toHaveCount(0)
  await handoverSelection.selectOption(await bagOption.getAttribute('value') || '')
  let handoverAlert = ''
  page.once('dialog', async (dialog) => {
    handoverAlert = dialog.message()
    await dialog.accept()
  })
  await handoverDialog.getByRole('button', { name: '确认整袋交出', exact: true }).click()
  expect(handoverAlert).toBe('')
  await expect(handoverDialog).toHaveCount(0)

  await openWaitHandoverPage(page, '?tab=locations')
  for (const location of locations) {
    await expect(page.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`)).not.toContainText(transferBagCode)
  }
  await expect(page.locator('[data-warehouse-map-summary-section]')).toHaveCount(0)
  await expectNoPageErrors(errors)
})
