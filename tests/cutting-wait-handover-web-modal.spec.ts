import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'

async function openModalAndMeasure(
  page: Page,
  action: 'bagging' | 'inbound' | 'repack' | 'handover' | 'recovery' | 'scrap',
): Promise<number> {
  return page.evaluate(async (actionName) => {
    const trigger = document.querySelector<HTMLButtonElement>(
      `[data-wait-handover-action="open-${actionName}"]`,
    )
    if (!trigger) throw new Error(`未找到弹窗入口：${actionName}`)
    const startedAt = performance.now()
    return new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect()
        reject(new Error(`弹窗未及时出现：${actionName}`))
      }, 3_000)
      const finishIfReady = () => {
        if (!document.querySelector(`[data-wait-handover-modal="${actionName}"]`)) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve(performance.now() - startedAt)
      }
      const observer = new MutationObserver(finishIfReady)
      observer.observe(document.body, { childList: true, subtree: true })
      trigger.click()
      finishIfReady()
    })
  }, action)
}

test('待交出仓保留原工作台，六个中转袋动作均局部打开并完成防错', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = collectPageErrors(page)
  await page.goto(WAIT_HANDOVER_PATH, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  if ((await page.locator('body').innerText()).trim().length < 20) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({
    timeout: 120_000,
  })
  await expect(page.getByRole('button', { name: '库存明细', exact: true })).toBeVisible()
  await expect(page.locator('[data-wait-handover-action="open-special-craft-return"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '库位图', exact: true })).toBeVisible()
  await expect(page.locator('[data-wait-handover-web-selector]')).toHaveCount(0)
  const actions = [
    { label: '菲票装袋', action: 'bagging' },
    { label: '中转袋入仓', action: 'inbound' },
    { label: '拆袋重装', action: 'repack' },
    { label: '中转袋交出', action: 'handover' },
    { label: '中转袋回收', action: 'recovery' },
    { label: '中转袋报废', action: 'scrap' },
  ] as const

  for (const item of actions) {
    const urlBefore = page.url()
    const openDurationMs = await openModalAndMeasure(page, item.action)

    const dialog = page.locator(`[data-wait-handover-modal="${item.action}"]`)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: item.label, exact: true })).toBeVisible()
    await expect(dialog.locator('[data-skip-page-rerender="true"]')).not.toHaveCount(0)
    expect(page.url()).toBe(urlBefore)
    expect(openDurationMs, `${item.label}弹窗响应必须低于 200ms`).toBeLessThan(200)
    if (item.action === 'repack') {
      for (const section of ['来源袋 / 菲票', '按接收车缝工厂分组', '结果袋 / 复用旧袋', '合计与确认']) {
        await expect(dialog.getByText(section, { exact: true })).toBeVisible()
      }
      const width = await dialog.locator('section').first().evaluate((element) => element.getBoundingClientRect().width)
      expect(width, '重装必须使用宽工作区').toBeGreaterThan(900)
    }
    if (item.action === 'recovery') {
      await expect(dialog.getByText('普通回收', { exact: true })).toBeVisible()
      await expect(dialog.getByText('强制回收', { exact: true })).toBeVisible()
    }
    if (item.action === 'scrap') {
      await expect(dialog.getByText(/二次确认/)).toBeVisible()
      await expect(dialog.getByText(/先拆袋重装/)).toBeVisible()
    }
    await dialog.getByText('关闭', { exact: true }).click()
    await expect(dialog).toHaveCount(0)

    expect(page.url()).toBe(urlBefore)
  }

  const workbenchData = page.locator('[data-wait-handover-workbench-data]')
  await expect(workbenchData).toBeVisible()
  await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[data-wait-handover-workbench-data]')
    if (!region) throw new Error('待交出仓工作台数据区不存在')
    ;(region as HTMLElement & { localIdentity?: string }).localIdentity = 'stable'
  })
  await page.locator('[data-wait-handover-action="open-recovery"]').click()
  const recoveryDialogForInput = page.locator('[data-wait-handover-modal="recovery"]')
  const recoveryBagCodeInput = recoveryDialogForInput.locator('[data-wait-handover-field="bagCode"]')
  await recoveryBagCodeInput.fill('KEEP-INPUT-001')
  const workbenchIdentityStable = await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[data-wait-handover-workbench-data]')
    const input = document.querySelector<HTMLInputElement>('[data-wait-handover-modal="recovery"] [data-wait-handover-field="bagCode"]')
    if (!region || !input) return false
    return (region as HTMLElement & { localIdentity?: string }).localIdentity === 'stable'
      && input.value === 'KEEP-INPUT-001'
  })
  expect(workbenchIdentityStable, '输入时必须保留工作台 DOM 与弹窗输入').toBe(true)
  await recoveryDialogForInput.getByText('关闭', { exact: true }).click()

  await page.locator('[data-wait-handover-action="open-scrap"]').click()
  const activeScrapDialog = page.locator('[data-wait-handover-modal="scrap"]')
  const activeScrapBagInput = activeScrapDialog.locator('[data-wait-handover-field="bagCode"]')
  await activeScrapBagInput.fill('BAG-B-003')
  await activeScrapBagInput.press('Enter')
  await expect(activeScrapDialog.locator('[data-wait-handover-bag-summary]')).toContainText('BAG-B-003')
  await expect(activeScrapDialog.locator('[data-wait-handover-bag-summary]')).toContainText(/张菲票/)
  await expect(activeScrapDialog.getByRole('button', { name: '确认报废', exact: true })).toBeDisabled()
  await expect(activeScrapDialog.getByRole('button', { name: '去拆袋重装', exact: true })).toBeVisible()
  await activeScrapDialog.getByRole('button', { name: '去拆袋重装', exact: true }).click()
  const guidedRepackDialog = page.locator('[data-wait-handover-modal="repack"]')
  const guidedSourceSelect = guidedRepackDialog.locator('[data-wait-handover-field="sourceBagCodes"]')
  await expect(guidedRepackDialog).toBeVisible()
  await expect(guidedSourceSelect.locator('option:checked')).toHaveText(/BAG-B-003/)
  await expect(guidedRepackDialog.locator('[data-wait-handover-repack-ticket-assignment]')).not.toHaveCount(0)
  await guidedRepackDialog.getByText('关闭', { exact: true }).click()

  await page.evaluate(async () => {
    const {
      listSpreadingResultGeneratedFeiTickets,
    } = await import('/src/data/fcs/cutting/generated-fei-tickets.ts')
    const {
      completeFeiTicketNumbering,
    } = await import('/src/data/fcs/cutting/fei-ticket-numbering.ts')
    listSpreadingResultGeneratedFeiTickets()
      .filter((ticket) => ticket.ticketStatus !== 'VOIDED' && ticket.pieceSequenceRange)
      .forEach((ticket) => {
        completeFeiTicketNumbering({
          feiTicketNoOrId: ticket.feiTicketId,
          operatorName: 'Web 验收打编号员',
          source: 'WEB',
        })
      })
  })

  const invalidBagCode = `WEB-E2E-INVALID-${Date.now()}`
  const unknownTicketCode = `UNKNOWN-FEI-${Date.now()}`
  const factsBeforeInvalidSubmit = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
  ).events.length)
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  const invalidBaggingDialog = page.locator('[data-wait-handover-modal="bagging"]')
  await invalidBaggingDialog.locator('[data-wait-handover-field="bagCode"]').fill(invalidBagCode)
  const invalidTicketSelect = invalidBaggingDialog.locator('[data-wait-handover-field="feiTicketId"]')
  await invalidTicketSelect.selectOption({ index: 0 })
  await invalidBaggingDialog.locator('[data-wait-handover-field="ticketScanInput"]').fill(unknownTicketCode)
  await invalidBaggingDialog.getByRole('button', { name: '确认菲票装袋', exact: true }).click()
  await expect(invalidBaggingDialog.locator('[data-wait-handover-feedback]')).toContainText(`以下菲票码未匹配：${unknownTicketCode}`)
  expect(await page.evaluate(({ invalidBagCode }) => {
    const events = JSON.parse(
      window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
    ).events as Array<{ refs?: { transferBagCode?: string } }>
    return {
      count: events.length,
      hasInvalidBagFact: events.some((event) => event.refs?.transferBagCode === invalidBagCode),
    }
  }, { invalidBagCode })).toEqual({ count: factsBeforeInvalidSubmit, hasInvalidBagFact: false })
  await invalidBaggingDialog.getByText('关闭', { exact: true }).click()

  const bagCode = `WEB-E2E-${Date.now()}`
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  const baggingDialog = page.locator('[data-wait-handover-modal="bagging"]')
  await expect(baggingDialog).toBeVisible()
  await baggingDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await expect(
    baggingDialog.locator('[data-wait-handover-field="bagCode"]'),
  ).toHaveValue(bagCode)
  const ticketSelect = baggingDialog.locator('[data-wait-handover-field="feiTicketId"]')
  expect(await ticketSelect.locator('option:not([disabled])').count()).toBeGreaterThan(0)
  await ticketSelect.selectOption({ index: 0 })
  await baggingDialog.getByRole('button', { name: '确认菲票装袋', exact: true }).click()
  await expect(baggingDialog.getByText('装袋成功，请继续中转袋入仓。', { exact: true })).toBeVisible()
  await baggingDialog.getByText('关闭', { exact: true }).click()

  await page.locator('[data-wait-handover-action="open-inbound"]').click()
  const inboundDialog = page.locator('[data-wait-handover-modal="inbound"]')
  await expect(inboundDialog).toBeVisible()
  await inboundDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await expect(
    inboundDialog.locator('[data-wait-handover-field="bagCode"]'),
  ).toHaveValue(bagCode)
  const inboundLocation = await page.evaluate(async () => {
    const { buildCurrentCuttingWarehouseMapProjection } = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const { listWarehouseLocationMapShelfCells } = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    const current = buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
    const area = current?.projection.areas.find((item) =>
      item.shelves.some((shelf) => listWarehouseLocationMapShelfCells(shelf).length > 0),
    )
    const location = area?.shelves.flatMap((shelf) => listWarehouseLocationMapShelfCells(shelf))[0]
    if (!area || !location) throw new Error('测试环境没有可用的待交出仓库位')
    return { areaName: area.areaName, locationNo: location.locationNo }
  })
  await inboundDialog.locator('[data-wait-handover-field="warehouseArea"]').fill(inboundLocation.areaName)
  await inboundDialog.locator('[data-wait-handover-field="locationCode"]').fill(inboundLocation.locationNo)
  await inboundDialog.getByRole('button', { name: '确认中转袋入仓', exact: true }).click()
  await expect(inboundDialog.getByText('入仓成功，可直接交出或拆袋重装。', { exact: true })).toBeVisible()
  await inboundDialog.getByText('关闭', { exact: true }).click()

  const persistedFacts = await page.evaluate(() => {
    const ledger = JSON.parse(
      window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
    ) as { events?: Array<{ eventType?: string; refs?: unknown; payload?: unknown }> }
    return ledger.events || []
  }, bagCode)
  expect(persistedFacts.map((event) => event.eventType)).toContain('菲票装袋')
  expect(persistedFacts.map((event) => event.eventType)).toContain('中转袋入仓')
  expect(JSON.stringify(persistedFacts)).toContain(bagCode)

  const partialFailureBagCode = await page.evaluate(async () => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const { submitWholeBagHandover } = await import('/src/data/fcs/cutting/transfer-bag-operations.ts')
    const bagCode = `WEB-PARTIAL-${Date.now()}`
    const usageCycleId = `usage:${bagCode}:1`
    const ticket = {
      feiTicketId: `${bagCode}-T1`, feiTicketNo: `${bagCode}-菲票-1`,
      productionOrderId: 'WEB-PARTIAL-PO-ID', productionOrderNo: 'WEB-PARTIAL-PO-001',
      cutOrderId: 'WEB-PARTIAL-CUT-ID', cutOrderNo: 'WEB-PARTIAL-CUT-001',
      color: '黑色', size: 'M', partCode: 'FRONT', partName: '前幅', pieceQty: 12,
      sewingTaskId: 'WEB-PARTIAL-SEW-ID', sewingTaskNo: 'WEB-PARTIAL-SEW-001',
      receiverFactoryId: 'WEB-PARTIAL-FACTORY-ID', receiverFactoryName: '部分成功测试车缝厂',
    }
    appendCuttingRuntimeEvent({
      eventType: '菲票装袋', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-01 10:00', operatorName: '部分成功测试装袋员',
      refs: { transferBagCode: bagCode, usageCycleId, productionOrderId: ticket.productionOrderId, productionOrderNo: ticket.productionOrderNo, feiTicketIds: [ticket.feiTicketId], feiTicketNos: [ticket.feiTicketNo] },
      payload: { baggingRecordId: `bagging:${bagCode}`, bagCode, feiTicketItems: [ticket], totalPieceQty: 12, mixedFlag: false, baggingBy: '部分成功测试装袋员', baggingAt: '2026-08-01 10:00' },
    } as never)
    appendCuttingRuntimeEvent({
      eventType: '中转袋入仓', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-01 10:10', operatorName: '部分成功测试入仓员',
      refs: { transferBagCode: bagCode, usageCycleId, productionOrderNo: ticket.productionOrderNo, feiTicketIds: [ticket.feiTicketId] },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: 12, unit: '片', toWarehouseArea: '部分成功测试区', toLocationCode: 'PARTIAL-01' },
      payload: { tempBagUseId: `temp:${bagCode}`, bagCode, warehouseArea: '部分成功测试区', locationCode: 'PARTIAL-01', inboundBy: '部分成功测试入仓员', inboundAt: '2026-08-01 10:10', feiTicketItems: [ticket], totalPieceQty: 12, mixedFlag: false, locationRef: { factoryId: 'FACTORY-PARTIAL', warehouseId: 'WAREHOUSE-PARTIAL', warehouseKind: 'WAIT_HANDOVER', areaId: 'AREA-PARTIAL', areaName: '部分成功测试区', shelfId: 'SHELF-PARTIAL', shelfNo: 'PARTIAL', locationId: 'LOCATION-PARTIAL-01', locationNo: 'PARTIAL-01' } },
    } as never)
    submitWholeBagHandover({
      bagCode, usageCycleId, handoverOrderId: `HO-${bagCode}`, handoverOrderNo: `HO-${bagCode}`,
      handoverRecordId: `HR-${bagCode}`, handoverRecordNo: `HR-${bagCode}`,
      assignments: [{ feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo, sewingTaskId: ticket.sewingTaskId, sewingTaskNo: ticket.sewingTaskNo, receiverFactoryId: ticket.receiverFactoryId, receiverFactoryName: ticket.receiverFactoryName }],
      submittedTicketSnapshot: [ticket], operator: { operatorName: '部分成功测试交出员' }, source: 'WEB', occurredAt: '2026-08-01 10:20',
    })
    return bagCode
  })
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  const partialFailureDialog = page.locator('[data-wait-handover-modal="bagging"]')
  await partialFailureDialog.locator('[data-wait-handover-field="bagCode"]').fill(partialFailureBagCode)
  await partialFailureDialog.locator('[data-wait-handover-field="feiTicketId"]').selectOption({ index: 0 })
  await partialFailureDialog.locator('[data-wait-handover-field="forceRecoveryReason"]').fill('实物空袋已回到装袋区')
  await partialFailureDialog.locator('[data-wait-handover-field="physicalBagReceived"]').check()
  await partialFailureDialog.locator('[data-wait-handover-field="physicalBagEmpty"]').check()
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem
    let ledgerWriteCount = 0
    Storage.prototype.setItem = function setItemWithSecondLedgerFailure(key: string, value: string): void {
      if (key === 'cuttingRuntimeEventLedger') {
        ledgerWriteCount += 1
        if (ledgerWriteCount === 2) {
          Storage.prototype.setItem = nativeSetItem
          throw new Error('模拟装袋账本第二次写入失败')
        }
      }
      nativeSetItem.call(this, key, value)
    }
  })
  await partialFailureDialog.getByRole('button', { name: '确认菲票装袋', exact: true }).click()
  await expect(partialFailureDialog.locator('[data-wait-handover-feedback]')).toContainText('回收已成功，装袋未完成：模拟装袋账本第二次写入失败')
  expect(await page.evaluate(async ({ partialFailureBagCode }) => {
    const { resolveTransferBagCurrentUse } = await import('/src/data/fcs/cutting/transfer-bag-operations.ts')
    const events = JSON.parse(window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}').events as Array<{ eventType?: string; refs?: { transferBagCode?: string } }>
    return {
      mainStatus: resolveTransferBagCurrentUse(partialFailureBagCode).mainStatus,
      recoveryCount: events.filter((event) => event.eventType === '中转袋回收' && event.refs?.transferBagCode === partialFailureBagCode).length,
      baggingCount: events.filter((event) => event.eventType === '菲票装袋' && event.refs?.transferBagCode === partialFailureBagCode).length,
    }
  }, { partialFailureBagCode })).toEqual({ mainStatus: 'IDLE', recoveryCount: 1, baggingCount: 1 })
  await partialFailureDialog.getByText('关闭', { exact: true }).click()

  await page.locator('[data-wait-handover-action="open-handover"]').click()
  const handoverDialog = page.locator('[data-wait-handover-modal="handover"]')
  await expect(handoverDialog).toBeVisible()
  await expect(handoverDialog).toContainText('一次只交出一个完整中转袋')
  await expect(handoverDialog.locator('[data-wait-handover-field="handoverSelection"]')).toBeVisible()
  await expect(handoverDialog.locator('[data-wait-handover-field="ticketScanInput"]')).toHaveCount(0)
  await handoverDialog.getByText('关闭', { exact: true }).click()
  await expect(handoverDialog).toHaveCount(0)

  const repackBagCode = `WEB-REPACK-${Date.now()}`
  await page.evaluate(async ({ repackBagCode }) => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const usageCycleId = `usage:${repackBagCode}:1`
    const tickets = [1, 2, 3].map((index) => ({
      feiTicketId: `${repackBagCode}-T${index}`,
      feiTicketNo: `${repackBagCode}-菲票-${index}`,
      productionOrderId: index === 3 ? 'WEB-REPACK-PO-ID-2' : 'WEB-REPACK-PO-ID-1',
      productionOrderNo: index === 3 ? 'WEB-REPACK-PO-002' : 'WEB-REPACK-PO-001',
      cutOrderId: 'WEB-REPACK-CUT-ID',
      cutOrderNo: 'WEB-REPACK-CUT-001',
      color: '黑色',
      size: index === 1 ? 'M' : 'L',
      partCode: 'FRONT',
      partName: '前幅',
      pieceQty: 6,
      sewingTaskId: `WEB-REPACK-SEW-${index}`,
      sewingTaskNo: `车缝任务-${index}`,
      receiverFactoryId: 'WEB-REPACK-FACTORY',
      receiverFactoryName: '雅加达车缝一厂',
    }))
    appendCuttingRuntimeEvent({
      eventType: '菲票装袋', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-02 08:00', operatorName: '重装测试员',
      refs: { transferBagCode: repackBagCode, usageCycleId, productionOrderId: 'WEB-REPACK-PO-ID-1', productionOrderNo: 'WEB-REPACK-PO-001', feiTicketIds: tickets.map((ticket) => ticket.feiTicketId), feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo) },
      payload: { baggingRecordId: `bagging:${repackBagCode}`, bagCode: repackBagCode, feiTicketItems: tickets, totalPieceQty: 18, mixedFlag: true, baggingBy: '重装测试员', baggingAt: '2026-08-02 08:00' },
    } as never)
    appendCuttingRuntimeEvent({
      eventType: '中转袋入仓', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-02 08:10', operatorName: '重装测试员',
      refs: { transferBagCode: repackBagCode, usageCycleId, productionOrderNo: 'WEB-REPACK-PO-001', feiTicketIds: tickets.map((ticket) => ticket.feiTicketId) },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: 18, unit: '片', toWarehouseArea: '重装测试区', toLocationCode: 'R-01' },
      payload: { tempBagUseId: `temp:${repackBagCode}`, bagCode: repackBagCode, warehouseArea: '重装测试区', locationCode: 'R-01', inboundBy: '重装测试员', inboundAt: '2026-08-02 08:10', feiTicketItems: tickets, totalPieceQty: 18, mixedFlag: true },
    } as never)
  }, { repackBagCode })

  await page.locator('[data-wait-handover-action="open-repack"]').click()
  const repackDialog = page.locator('[data-wait-handover-modal="repack"]')
  await expect(repackDialog).toBeVisible()
  await repackDialog.locator('[data-wait-handover-field="sourceBagCodes"]').selectOption(repackBagCode)
  await expect(repackDialog.locator('[data-wait-handover-repack-group-preview]')).toContainText('雅加达车缝一厂')
  await expect(repackDialog.locator('[data-wait-handover-repack-result-row]')).toHaveCount(2)
  await repackDialog.getByRole('button', { name: '新增结果袋', exact: true }).click()
  const resultRows = repackDialog.locator('[data-wait-handover-repack-result-row]')
  await expect(resultRows).toHaveCount(3)
  const resultCodes = [`${repackBagCode}-A`, `${repackBagCode}-B`, repackBagCode]
  const resultIds = await resultRows.evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.waitHandoverRepackResultRow || ''))
  for (let index = 0; index < resultCodes.length; index += 1) {
    await resultRows.nth(index).locator('[data-wait-handover-repack-result-bag-code]').fill(resultCodes[index])
  }
  await repackDialog.locator(`[data-wait-handover-repack-ticket-assignment][data-ticket-id="${repackBagCode}-T1"]`).selectOption(resultIds[0])
  await repackDialog.locator(`[data-wait-handover-repack-ticket-assignment][data-ticket-id="${repackBagCode}-T2"]`).selectOption(resultIds[2])
  await repackDialog.locator(`[data-wait-handover-repack-ticket-assignment][data-ticket-id="${repackBagCode}-T3"]`).selectOption(resultIds[1])
  await resultRows.nth(2).getByRole('button', { name: '移除', exact: true }).click()
  const unassignedTicket = repackDialog.locator(`[data-wait-handover-repack-ticket-assignment][data-ticket-id="${repackBagCode}-T2"]`)
  await expect(unassignedTicket).toHaveValue('')
  await expect(repackDialog.locator('[data-wait-handover-repack-total-preview]')).toContainText('待分配 1 张')
  await expect(repackDialog.getByRole('button', { name: '确认重装', exact: true })).toBeDisabled()
  await unassignedTicket.selectOption(resultIds[0])
  await expect(repackDialog.locator('[data-wait-handover-repack-total-preview]')).toContainText('待分配 0 张')
  await expect(repackDialog.getByRole('button', { name: '确认重装', exact: true })).toBeEnabled()
  await repackDialog.getByRole('button', { name: '确认重装', exact: true }).dblclick()
  await expect(repackDialog.getByText('重装成功，请继续交出。', { exact: true })).toBeVisible()
  const repackFacts = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
  ).events.filter((event: { eventType: string }) => event.eventType === '中转袋拆袋重装'))
  expect(repackFacts).toHaveLength(1)

  await repackDialog.getByText('关闭', { exact: true }).click()
  await page.locator('[data-wait-handover-action="open-handover"]').click()
  const repackedHandoverDialog = page.locator('[data-wait-handover-modal="handover"]')
  const repackedHandoverSelect = repackedHandoverDialog.locator('[data-wait-handover-field="handoverSelection"]')
  const repackedHandoverOption = repackedHandoverSelect.locator(`option:has-text("${repackBagCode}-A")`)
  await expect(repackedHandoverOption).toHaveCount(1)
  await repackedHandoverSelect.selectOption(await repackedHandoverOption.getAttribute('value') || '')
  await repackedHandoverDialog.getByRole('button', { name: '确认整袋交出', exact: true }).click()
  await expect(repackedHandoverDialog).toContainText('交出成功')

  await expectNoPageErrors(errors)
})

test('回收与已交出报废按当前袋状态和现场确认本地控制提交资格', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto(WAIT_HANDOVER_PATH, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({ timeout: 120_000 })

  const bagCodes = await page.evaluate(async () => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const { submitTransferBagScrap, submitWholeBagHandover } = await import('/src/data/fcs/cutting/transfer-bag-operations.ts')
    const suffix = Date.now()
    const packed = `RECOVERY-PACKED-${suffix}`
    const handed = `RECOVERY-HANDED-${suffix}`
    const disabled = `RECOVERY-DISABLED-${suffix}`
    const idle = `RECOVERY-IDLE-${suffix}`
    const usageCycleId = `usage:${handed}:1`
    const ticket = {
      feiTicketId: `${handed}-T1`, feiTicketNo: `${handed}-菲票-1`,
      productionOrderId: 'RECOVERY-PO-ID', productionOrderNo: 'RECOVERY-PO-001',
      cutOrderId: 'RECOVERY-CUT-ID', cutOrderNo: 'RECOVERY-CUT-001',
      color: '黑色', size: 'M', partCode: 'FRONT', partName: '前幅', pieceQty: 12,
      sewingTaskId: 'RECOVERY-SEW-ID', sewingTaskNo: 'RECOVERY-SEW-001',
      receiverFactoryId: 'RECOVERY-FACTORY-ID', receiverFactoryName: '万隆车缝一厂',
    }
    const appendBagging = (bagCode: string, cycleId: string, currentTicket: typeof ticket) => appendCuttingRuntimeEvent({
      eventType: '菲票装袋', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-02 11:00', operatorName: '回收测试装袋员',
      refs: { transferBagCode: bagCode, usageCycleId: cycleId, productionOrderId: currentTicket.productionOrderId, productionOrderNo: currentTicket.productionOrderNo, feiTicketIds: [currentTicket.feiTicketId], feiTicketNos: [currentTicket.feiTicketNo] },
      payload: { baggingRecordId: `bagging:${bagCode}`, bagCode, feiTicketItems: [currentTicket], totalPieceQty: currentTicket.pieceQty, mixedFlag: false, baggingBy: '回收测试装袋员', baggingAt: '2026-08-02 11:00' },
    } as never)
    appendBagging(packed, `usage:${packed}:1`, { ...ticket, feiTicketId: `${packed}-T1`, feiTicketNo: `${packed}-菲票-1` })
    appendBagging(handed, usageCycleId, ticket)
    appendCuttingRuntimeEvent({
      eventType: '中转袋入仓', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-02 11:10', operatorName: '回收测试入仓员',
      refs: { transferBagCode: handed, usageCycleId, productionOrderNo: ticket.productionOrderNo, feiTicketIds: [ticket.feiTicketId] },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: 12, unit: '片', toWarehouseArea: '回收测试区', toLocationCode: 'RECOVERY-01' },
      payload: { tempBagUseId: `temp:${handed}`, bagCode: handed, warehouseArea: '回收测试区', locationCode: 'RECOVERY-01', inboundBy: '回收测试入仓员', inboundAt: '2026-08-02 11:10', feiTicketItems: [ticket], totalPieceQty: 12, mixedFlag: false, locationRef: { factoryId: 'FACTORY-CUTTING', warehouseId: 'WAREHOUSE-WAIT-HANDOVER', warehouseKind: 'WAIT_HANDOVER', areaId: 'AREA-RECOVERY', areaName: '回收测试区', shelfId: 'SHELF-RECOVERY', shelfNo: 'RECOVERY', locationId: 'LOCATION-RECOVERY-01', locationNo: 'RECOVERY-01' } },
    } as never)
    const assignment = { feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo, sewingTaskId: ticket.sewingTaskId, sewingTaskNo: ticket.sewingTaskNo, receiverFactoryId: ticket.receiverFactoryId, receiverFactoryName: ticket.receiverFactoryName }
    submitWholeBagHandover({
      bagCode: handed, usageCycleId, handoverOrderId: `HO-${handed}`, handoverOrderNo: `HO-${handed}`,
      handoverRecordId: `HR-${handed}`, handoverRecordNo: `HR-${handed}`,
      assignments: [assignment], submittedTicketSnapshot: [ticket],
      operator: { operatorName: '回收测试交出员', operatorRole: '裁片仓交出员' }, source: 'WEB', occurredAt: '2026-08-02 11:20',
    })
    submitTransferBagScrap({ bagCode: disabled, reason: '袋体破损', authorizedBy: '回收测试主管', operator: { operatorName: '回收测试主管', operatorRole: '中转袋主管' }, source: 'WEB', occurredAt: '2026-08-02 11:30' })
    return { packed, handed, disabled, idle }
  })

  for (const [state, bagCode, expected] of [
    ['PACKED', bagCodes.packed, /去拆袋重装/],
    ['IDLE', bagCodes.idle, /无需回收/],
    ['DISABLED', bagCodes.disabled, /不能回收/],
  ] as const) {
    await page.locator('[data-wait-handover-action="open-recovery"]').click()
    const dialog = page.locator('[data-wait-handover-modal="recovery"]')
    await dialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
    await expect(dialog.locator('[data-wait-handover-recovery-eligibility]'), state).toContainText(expected)
    await expect(dialog.getByRole('button', { name: '确认回收', exact: true }), state).toBeDisabled()
    await dialog.getByText('关闭', { exact: true }).click()
  }

  await page.locator('[data-wait-handover-action="open-recovery"]').click()
  const recoveryDialog = page.locator('[data-wait-handover-modal="recovery"]')
  await recoveryDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCodes.handed)
  const recoverySubmit = recoveryDialog.getByRole('button', { name: '确认回收', exact: true })
  await expect(recoverySubmit).toBeDisabled()
  await recoveryDialog.locator('[data-wait-handover-field="physicalBagReceived"]').check()
  await recoveryDialog.locator('[data-wait-handover-field="physicalBagEmpty"]').check()
  await expect(recoverySubmit).toBeDisabled()
  await recoveryDialog.locator('[data-wait-handover-field="recoveryNode"]').fill('裁床待交出仓')
  await recoveryDialog.locator('[data-wait-handover-field="recoveryLocation"]').fill('普通空袋回收区')
  await recoveryDialog.locator('[data-wait-handover-field="reason"]').fill('实物空袋已由后道退回')
  await recoveryDialog.locator('[data-wait-handover-field="operatorName"]').fill('普通回收测试员')
  await expect(recoverySubmit).toBeDisabled()
  await recoveryDialog.locator('[data-wait-handover-field="secondConfirm"]').check()
  await expect(recoverySubmit).toBeEnabled()
  await recoveryDialog.locator('[data-wait-handover-field="recoveryMode"][value="FORCED"]').check()
  await recoveryDialog.locator('[data-wait-handover-field="reason"]').fill('主管核对后强制回收')
  await expect(recoverySubmit).toBeEnabled()
  await recoveryDialog.getByText('关闭', { exact: true }).click()

  await page.locator('[data-wait-handover-action="open-scrap"]').click()
  const scrapDialog = page.locator('[data-wait-handover-modal="scrap"]')
  await scrapDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCodes.handed)
  const scrapSubmit = scrapDialog.getByRole('button', { name: '确认报废', exact: true })
  await expect(scrapSubmit).toBeDisabled()
  await scrapDialog.locator('[data-wait-handover-field="recoverFirst"]').check()
  await expect(scrapSubmit).toBeDisabled()
  await scrapDialog.locator('[data-wait-handover-field="physicalBagReceived"]').check()
  await scrapDialog.locator('[data-wait-handover-field="physicalBagEmpty"]').check()
  await scrapDialog.locator('[data-wait-handover-field="reason"]').fill('袋体破损无法继续使用')
  await scrapDialog.locator('[data-wait-handover-field="authorizedBy"]').fill('回收测试主管')
  await scrapDialog.locator('[data-wait-handover-field="secondConfirm"]').check()
  await expect(scrapSubmit).toBeEnabled()
})

test('待交出仓交出记录只认运行时事实并支持真实本地分页', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto(WAIT_HANDOVER_PATH, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    window.localStorage.removeItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  })
  await page.goto(`${WAIT_HANDOVER_PATH}?tab=handover-bagging`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText(/JCR-260324-/)).toHaveCount(0)
  await expect(page.locator('[data-wait-handover-paged-list="handover-records"]')).toContainText('暂无中转袋交出记录。', { timeout: 120_000 })

  await page.evaluate(async () => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    for (let index = 1; index <= 25; index += 1) {
      appendCuttingRuntimeEvent({
        eventType: '新增交出记录', eventSource: 'WEB', eventStatus: '已同步', occurredAt: `2026-08-02 10:${String(index).padStart(2, '0')}`, operatorName: '分页测试员',
        refs: { transferBagCode: `PAGE-BAG-${index}`, productionOrderNo: `PAGE-PO-${index}` },
        payload: { handoverRecordNo: `PAGE-RECORD-${index}`, handoverOrderNo: `PAGE-ORDER-${index}`, receiverType: '车缝厂', receiverName: '分页测试工厂', currentHandedOverQty: index, transferBagUses: [{ bagCode: `PAGE-BAG-${index}` }], feiTicketItems: [] },
      } as never)
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const pagedRegion = page.locator('[data-wait-handover-paged-list="handover-records"]')
  await expect(pagedRegion.locator('tbody tr')).toHaveCount(20, { timeout: 120_000 })
  await expect(pagedRegion.locator('[data-wait-handover-pagination]')).toContainText('共 25 条')
  await pagedRegion.locator('[data-wait-handover-pagination-action="next"]').click()
  const secondPageRegion = page.locator('[data-wait-handover-paged-list="handover-records"]')
  await expect(secondPageRegion.locator('tbody tr')).toHaveCount(5)
  await expect(secondPageRegion).toContainText('PAGE-RECORD-1')
})
