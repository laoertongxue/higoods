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

test('真实待交出工作台以生产 handler 完成三格入仓、一次汇总和整袋释放', async ({ page }) => {
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

  const transferBagCode = await page.evaluate(async ({ sourceBagCode, locationIds }) => {
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
    ledger.appendCuttingRuntimeEvent({
      eventType: '交出装袋确认', eventSource: 'WEB', eventStatus: '已同步',
      occurredAt: '2026-08-02 12:01', operatorName: '交出装袋确认员',
      refs: {
        transferBagCode: sourceBagCode, usageCycleId: snapshot.usageCycleId,
        productionOrderId: snapshot.tickets[0].productionOrderId,
        productionOrderNo: snapshot.tickets[0].productionOrderNo,
        taskId: task.pickingTaskId, feiTicketIds: snapshot.tickets.map((ticket) => ticket.feiTicketId),
        feiTicketNos: snapshot.tickets.map((ticket) => ticket.feiTicketNo),
      },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: snapshot.tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0), unit: '片' },
      payload: {
        sourceTempBagCode: sourceBagCode, targetTransferBagCode: sourceBagCode,
        pickingTaskId: task.pickingTaskId, pickingTaskNo: task.pickingTaskNo,
        sewingTaskId: task.sewingTaskId, sewingTaskNo: task.sewingTaskNo,
        receiverType: '车缝厂', receiverFactoryId: task.receiverFactoryId, receiverFactoryName: task.receiverFactoryName,
      },
    })
    const lifecycle = runtime.buildWaitHandoverLifecycleByBagCode(sourceBagCode)
    if (lifecycle.flowStage !== 'INBOUND_STORED') {
      throw new Error(`交出装袋确认后袋状态异常：${lifecycle.flowStageLabel}`)
    }
    return sourceBagCode
  }, { sourceBagCode: bagCode, locationIds: locations.map((location) => location.id) })

  await openWaitHandoverPage(page)
  await page.locator('[data-wait-handover-action="open-handover"]').click()
  const handoverDialog = page.locator('[data-wait-handover-modal="handover"]')
  await expect(handoverDialog).toBeVisible()
  const handoverSelection = handoverDialog.locator('[data-wait-handover-field="handoverSelection"]')
  const bagOption = handoverSelection.locator('option').filter({ hasText: transferBagCode })
  await expect(bagOption).toHaveCount(1)
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
