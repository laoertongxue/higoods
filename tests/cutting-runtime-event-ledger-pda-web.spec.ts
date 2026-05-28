import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test.setTimeout(120_000)

const RUNTIME_EVENT_LEDGER_KEY = 'cuttingRuntimeEventLedger'
const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-05-25 09:00:00',
}

type RuntimeEventForTest = {
  eventType: string
  refs?: Record<string, unknown>
  payload?: Record<string, unknown>
  inventoryEffect?: Record<string, unknown>
}

async function seedCuttingPdaSession(page: Page): Promise<void> {
  await page.addInitScript(({ session, eventLedgerKey }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(eventLedgerKey)) {
      window.localStorage.setItem(eventLedgerKey, JSON.stringify({ events: [] }))
    }
  }, {
    session: PDA_SESSION,
    eventLedgerKey: RUNTIME_EVENT_LEDGER_KEY,
  })
  await page.evaluate(({ session, eventLedgerKey }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(eventLedgerKey)) {
      window.localStorage.setItem(eventLedgerKey, JSON.stringify({ events: [] }))
    }
  }, {
    session: PDA_SESSION,
    eventLedgerKey: RUNTIME_EVENT_LEDGER_KEY,
  }).catch(() => undefined)
}

async function ensurePdaSession(page: Page): Promise<void> {
  await page.evaluate(({ session, eventLedgerKey }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(eventLedgerKey)) {
      window.localStorage.setItem(eventLedgerKey, JSON.stringify({ events: [] }))
    }
  }, {
    session: PDA_SESSION,
    eventLedgerKey: RUNTIME_EVENT_LEDGER_KEY,
  }).catch(() => undefined)
}

async function gotoPda(page: Page, path: string): Promise<void> {
  await ensurePdaSession(page)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
    const ready = await expect
      .poll(async () => {
        const bodyText = await page.locator('body').innerText().catch(() => '')
        return bodyText.trim().length >= 20 && !bodyText.includes('登录')
      }, { timeout: 30_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false)
    if (ready) return
    await ensurePdaSession(page)
  }
}

async function gotoWeb(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
  await expect
    .poll(async () => {
      const bodyText = await page.locator('body').innerText().catch(() => '')
      return bodyText.trim().length >= 20
    }, { timeout: 30_000 })
    .toBeTruthy()
}

async function ensureAppPage(page: Page): Promise<void> {
  if (page.url() === 'about:blank') {
    await gotoWeb(page, '/')
  }
  await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
}

async function evaluateOnAppPage<T, A>(
  page: Page,
  fn: (arg: A) => Promise<T> | T,
  arg: A,
): Promise<T> {
  await ensureAppPage(page)
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(fn, arg)
    } catch (error) {
      lastError = error
      await page.waitForLoadState('domcontentloaded').catch(() => undefined)
      await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
      await page.waitForTimeout(50)
    }
  }
  throw lastError
}

async function clickPdaWarehouseAction(page: Page, action: string, label: string): Promise<void> {
  const dataAction = page.locator(`[data-pda-warehouse-action="${action}"]`).last()
  if (await dataAction.count()) {
    await dataAction.click()
    return
  }
  await page.getByRole('button', { name: new RegExp(label) }).last().click()
}

async function appendRuntimeEventForTest(page: Page, input: Record<string, unknown>): Promise<void> {
  await evaluateOnAppPage(page, async (eventInput) => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    appendCuttingRuntimeEvent(eventInput as any)
  }, input)
}

async function seedPickupForPdaTask(page: Page, taskId: string): Promise<void> {
  const context = await evaluateOnAppPage(page, async (currentTaskId) => {
    const { getPdaCuttingTaskSnapshot } = await import('/src/data/fcs/pda-cutting-execution-source.ts')
    const detail = getPdaCuttingTaskSnapshot(currentTaskId)
    const line = detail?.cutPieceOrders?.[0]
    const target = detail?.spreadingTargets?.[0]
    return {
      productionOrderId: detail?.productionOrderId || '',
      productionOrderNo: detail?.productionOrderNo || line?.productionOrderNo || target?.productionOrderNo || '',
      cutOrderId: detail?.cutOrderId || line?.cutOrderId || '',
      cutOrderNo: detail?.cutOrderNo || line?.cutOrderNo || target?.cutOrderNo || '',
      markerPlanId: detail?.markerPlanId || line?.markerPlanId || '',
      markerPlanNo: detail?.markerPlanNo || line?.markerPlanNo || target?.markerPlanNo || '',
      spreadingOrderId: target?.spreadingSessionId || line?.executionOrderId || '',
      spreadingOrderNo: target?.title || line?.executionOrderNo || '',
      materialSku: target?.materialSku || line?.materialSku || '',
      materialName: target?.materialAlias || target?.materialSku || line?.materialSku || '',
      materialColor: target?.colorSummary || '',
      materialAlias: target?.materialAlias || '',
    }
  }, taskId)

  expect(context.cutOrderNo).not.toBe('')
  await appendRuntimeEventForTest(page, {
    eventType: '中转仓领料',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: '2026-05-25 09:01',
    operatorName: '裁床领料员-测试',
    operatorRole: '裁床领料员',
    refs: {
      productionOrderId: context.productionOrderId,
      productionOrderNo: context.productionOrderNo,
      cutOrderId: context.cutOrderId,
      cutOrderNo: context.cutOrderNo,
      markerPlanId: context.markerPlanId,
      markerPlanNo: context.markerPlanNo,
      spreadingOrderId: context.spreadingOrderId,
      spreadingOrderNo: context.spreadingOrderNo,
    },
    material: {
      materialSku: context.materialSku || 'TEST-MATERIAL',
      materialName: context.materialName || context.materialSku || '测试面料',
      materialColor: context.materialColor || '测试颜色',
      materialAlias: context.materialAlias || '测试面料',
      unit: '米',
    },
    payload: {
      pickupRecordId: `PICKUP-${taskId}`,
      pickupRecordNo: `PICKUP-${taskId}`,
      prepNoticeId: `PREP-${taskId}`,
      prepOrderNo: context.cutOrderNo,
      pickupQty: 120,
      unit: '米',
      rollCount: 2,
      rollNos: [`ROLL-${taskId}-01`, `ROLL-${taskId}-02`],
      pickupBy: '裁床领料员-测试',
      pickupAt: '2026-05-25 09:01',
      hasDifference: false,
    },
  })
}

async function readRuntimeEvents(page: Page): Promise<RuntimeEventForTest[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed?.events) ? parsed.events : []
    } catch {
      return []
    }
  }, RUNTIME_EVENT_LEDGER_KEY)
}

async function expectRuntimeEvent(
  page: Page,
  eventType: string,
  predicate: (event: RuntimeEventForTest) => boolean = () => true,
): Promise<void> {
  await expect
    .poll(async () => {
      const events = await readRuntimeEvents(page)
      return events.some((event) => event.eventType === eventType && predicate(event))
    })
    .toBeTruthy()
}

async function expectNoRuntimeEvent(
  page: Page,
  eventType: string,
  predicate: (event: RuntimeEventForTest) => boolean = () => true,
): Promise<void> {
  const events = await readRuntimeEvents(page)
  expect(events.some((event) => event.eventType === eventType && predicate(event))).toBeFalsy()
}

async function verifyEventOnWebPage(
  page: Page,
  webPath: string,
  pageText: string | RegExp,
  eventType: string,
  predicate?: (event: RuntimeEventForTest) => boolean,
): Promise<void> {
  await gotoWeb(page, webPath)
  await expect(page.locator('body')).toContainText(pageText, { timeout: 30000 })
  await expectRuntimeEvent(page, eventType, predicate)
}

async function getFirstPrintedFeiTicketNo(page: Page): Promise<string> {
  const ticketNo = await evaluateOnAppPage(page, async () => {
    const { buildTransferBagsProjection } = await import('/src/pages/process-factory/cutting/transfer-bags-projection.ts')
    const projection = buildTransferBagsProjection()
    const used = new Set(Object.keys(projection.viewModel.activeTicketBindingsByTicketId || {}))
    const printedTickets = projection.viewModel.ticketCandidates.filter((item: any) => {
      const isPrinted = item.ticketStatus === 'PRINTED' || item.printStatus === '已首打'
      return isPrinted
    })
    const ticket = printedTickets.find((item: any) => !used.has(item.ticketRecordId)) || printedTickets[0]
    return ticket?.ticketNo || ''
  })
  expect(ticketNo).not.toBe('')
  return ticketNo
}

async function getPdaHandoverScanData(page: Page): Promise<{
  picking: {
    taskNo: string
    sourceBagCode: string
    feiTicketNo: string
    targetBagCode: string
  }
  handover: {
    orderNo: string
    bagCode: string
    feiTicketNo: string
  }
  specialCraft: {
    orderNo: string
    bagCode: string
    feiTicketNo: string
    expectedQty: number
  }
}> {
  const scanData = await evaluateOnAppPage(page, async () => {
    const {
      buildHandoverPickingTaskProjectionFromAllocationProjection,
      buildSewingTaskAllocationProjectionFromInventory,
    } = await import('/src/data/fcs/cutting/sewing-dispatch.ts')
    const {
      buildInboundTempBagInventoryRecords,
      buildInboundTempBagsFromTransferBagViewModel,
    } = await import('/src/pages/process-factory/cutting/transfer-bags-model.ts')
    const { buildTransferBagsProjection } = await import('/src/pages/process-factory/cutting/transfer-bags-projection.ts')
    const { buildPdaUniversalHandoverRecordDraft, listHandoverRecords } = await import('/src/data/fcs/cutting/handover-orders.ts')

    const transferBagViewModel = buildTransferBagsProjection().viewModel
    const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
    const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
    const allocationProjection = buildSewingTaskAllocationProjectionFromInventory(inboundInventoryRecords)
    const pickingProjection = buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection)
    const pickingTask = pickingProjection.tasks[0]
    const pickedTicketIds = new Set((pickingTask?.pickedItems || []).map((item: any) => item.feiTicketId))
    const pickingTicket = pickingTask?.allocatedInventoryItems.find((item: any) => {
      return item.specialCraftReturnStatus === '不需要特殊工艺' || item.specialCraftReturnStatus === '已回仓'
        ? !pickedTicketIds.has(item.feiTicketId)
        : false
    }) || pickingTask?.allocatedInventoryItems.find((item: any) => !pickedTicketIds.has(item.feiTicketId)) || pickingTask?.allocatedInventoryItems[0]

    const handoverDraft = buildPdaUniversalHandoverRecordDraft()
    const handoverRecord = listHandoverRecords().find((record: any) => record.handoverOrderId === handoverDraft.handoverOrderId)
    const handoverTicket = handoverRecord?.feiTicketItems[0]
    const handoverBag = handoverRecord?.transferBagUses.find((bag: any) => bag.containedFeiTicketIds.includes(handoverTicket?.feiTicketId)) || handoverRecord?.transferBagUses[0]

    const specialCraftDraft = buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001')
    const specialCraftRecord = listHandoverRecords().find((record: any) => record.handoverOrderId === specialCraftDraft.handoverOrderId)
    const specialCraftItem = specialCraftRecord?.specialCraftItems?.[0]
    const specialCraftTicket = specialCraftRecord?.feiTicketItems.find((ticket: any) => ticket.feiTicketId === specialCraftItem?.feiTicketId) || specialCraftRecord?.feiTicketItems[0]
    const specialCraftBag = specialCraftRecord?.transferBagUses.find((bag: any) => bag.containedFeiTicketIds.includes(specialCraftTicket?.feiTicketId)) || specialCraftRecord?.transferBagUses[0]

    return {
      picking: {
        taskNo: pickingTask?.pickingTaskNo || '',
        sourceBagCode: pickingTicket?.tempBagCode || pickingTask?.tempBagSources[0]?.tempBagCode || '',
        feiTicketNo: pickingTicket?.feiTicketNo || '',
        targetBagCode: `BAG-E2E-${pickingTask?.sewingTaskNo || 'PICKING'}`,
      },
      handover: {
        orderNo: handoverDraft.handoverOrderNo,
        bagCode: handoverBag?.bagCode || '',
        feiTicketNo: handoverTicket?.feiTicketNo || '',
      },
      specialCraft: {
        orderNo: specialCraftDraft.handoverOrderNo,
        bagCode: specialCraftBag?.bagCode || '',
        feiTicketNo: specialCraftTicket?.feiTicketNo || '',
        expectedQty: specialCraftItem?.pieceQty || specialCraftTicket?.pieceQty || 1,
      },
    }
  })

  expect(scanData.picking.taskNo).not.toBe('')
  expect(scanData.picking.sourceBagCode).not.toBe('')
  expect(scanData.picking.feiTicketNo).not.toBe('')
  expect(scanData.handover.orderNo).not.toBe('')
  expect(scanData.handover.bagCode).not.toBe('')
  expect(scanData.handover.feiTicketNo).not.toBe('')
  expect(scanData.specialCraft.orderNo).not.toBe('')
  expect(scanData.specialCraft.bagCode).not.toBe('')
  expect(scanData.specialCraft.feiTicketNo).not.toBe('')
  expect(scanData.specialCraft.expectedQty).toBeGreaterThan(0)

  return scanData
}

test('PDA 待加工仓四类动作写入统一事件账，并在 Web 裁床待加工仓可回查', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  const dialogAnswers = [
    '128 米 / 2 卷',
    'CUT-260302-004-01',
    '面料 A 区 / FAB-A-01',
    '96 米 / 2 卷',
    'PB-MKP-20260403-001-A-1',
    '面料 A 区 / FAB-A-01',
    '42 米 / 1 卷',
    'PB-MKP-20260403-001-A-1',
    '11 米 / 1 卷',
    '面料 A 区 / FAB-A-02',
  ]
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(dialogAnswers.shift() || '')
      return
    }
    await dialog.accept()
  })

  await gotoPda(page, '/fcs/pda/warehouse/wait-process?scope=cutting')
  await expect(page.locator('body')).toContainText('裁床待加工仓')

  await page.locator('[data-pda-warehouse-action="cutting-wp-pickup"][data-source-no]').first().click()
  await expectRuntimeEvent(
    page,
    '中转仓领料',
    (event) => Number((event.payload as any)?.pickupQty || 0) > 0,
  )
  await clickPdaWarehouseAction(page, 'cutting-wp-receive', '扫码入仓')
  await expectRuntimeEvent(
    page,
    '待加工仓扫码入仓',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'IN',
  )
  await clickPdaWarehouseAction(page, 'cutting-wp-issue', '加工领料')
  await expectRuntimeEvent(
    page,
    '待加工仓加工领料',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'OUT',
  )
  await clickPdaWarehouseAction(page, 'cutting-wp-return', '回收入仓')
  await expectRuntimeEvent(
    page,
    '待加工仓回收入仓',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'IN',
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '流水记录',
    '中转仓领料',
    (event) => Number((event.payload as any)?.pickupQty || 0) > 0,
  )
  await expectRuntimeEvent(
    page,
    '待加工仓扫码入仓',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'IN',
  )
  await expectRuntimeEvent(
    page,
    '待加工仓加工领料',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'OUT',
  )
  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '流水记录',
    '待加工仓回收入仓',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待加工仓' && event.inventoryEffect?.direction === 'IN',
  )

  await expectNoPageErrors(errors)
})

test('PDA 完成裁剪写入实际裁剪产出，Web 铺布单和菲票页面可读取同一事件账', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)
  await seedPickupForPdaTask(page, 'TASK-CUT-PDA-CUTTING-0306')

  await gotoPda(page, '/fcs/pda/cutting/spreading/TASK-CUT-PDA-CUTTING-0306')
  await expect(page.locator('body')).toContainText('完成裁剪')
  await page.locator('[data-pda-cut-spreading-field="actualCutQty"]').fill('88')
  await page.locator('[data-pda-cut-spreading-field="actualUsage"]').fill('66')
  await page.locator('[data-pda-cut-spreading-field="cuttingOperator"]').fill('裁剪员-测试')
  await page.locator('[data-pda-cut-spreading-action="submit"]').click()
  await expectRuntimeEvent(
    page,
    '完成裁剪',
    (event) => {
      const outputLines = (event.payload as any)?.outputLines
      return Array.isArray(outputLines)
        && outputLines.length > 0
        && outputLines.every((line: any) =>
          String(line?.partCode || '') !== 'UNMATCHED'
          && String(line?.partName || '') !== '未匹配部位'
          && Number(line?.actualPieceQty || 0) > 0,
        )
    },
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/spreading-list',
    '铺布单',
    '完成裁剪',
    (event) => Number((event.payload as any)?.actualMaterialUsage || 0) === 66,
  )
  await verifyEventOnWebPage(page, '/fcs/craft/cutting/fei-tickets', /菲票|菲票打印/, '完成裁剪')

  await expectNoPageErrors(errors)
})

test('PDA 入仓暂存袋结构化写入袋码、菲票和数量，Web 待交出仓可回查', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags')
  const ticketNo = await getFirstPrintedFeiTicketNo(page)

  await gotoPda(page, '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307')
  await expect(page.locator('body')).toContainText('入仓', { timeout: 30000 })
  await page.locator('[data-pda-cut-inbound-field="carrierCode"]').fill('BAG-PDA-E2E-001')
  await page.locator('[data-pda-cut-inbound-field="scanCode"]').fill(ticketNo)
  await page.locator('[data-pda-cut-inbound-action="add-ticket"]').click()
  await expect(page.locator('body')).toContainText('已加入')
  await page.locator('[data-pda-cut-inbound-field="locationLabel"]').fill('A-01 临时位')
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expectRuntimeEvent(
    page,
    '菲票入仓暂存',
    (event) => {
      const payload = event.payload as any
      return payload?.bagCode === 'BAG-PDA-E2E-001' && Array.isArray(payload?.feiTicketItems) && payload.feiTicketItems.length > 0
    },
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/warehouse-management/wait-handover',
    '裁床待交出仓',
    '菲票入仓暂存',
    (event) => {
      const payload = event.payload as any
      return payload?.bagCode === 'BAG-PDA-E2E-001' && Array.isArray(payload?.feiTicketItems) && payload.feiTicketItems.length > 0
    },
  )

  await expectNoPageErrors(errors)
})

test('PDA 现场差异反馈写入统一事件账，Web 补料管理可读取', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoPda(page, '/fcs/pda/cutting/replenishment-feedback/TASK-CUT-PDA-SYNC-FAIL-0310')
  await expect(page.locator('body')).toContainText('现场差异反馈', { timeout: 30000 })
  await page.locator('[data-pda-cut-replenishment-field="reasonLabel"]').selectOption('面料余额不足')
  await page.locator('[data-pda-cut-replenishment-field="differenceQty"]').fill('18')
  await page.locator('[data-pda-cut-replenishment-field="unit"]').selectOption('米')
  await page.locator('[data-pda-cut-replenishment-field="note"]').fill('E2E-补料反馈-事件账')
  await page.locator('[data-pda-cut-replenishment-field="photoProofCount"]').fill('2')
  await page.locator('[data-pda-cut-replenishment-action="submit"]').click()
  await expectRuntimeEvent(
    page,
    '补料反馈',
    (event) => (event.payload as any)?.reasonLabel === '面料余额不足' && (event.payload as any)?.note?.includes('E2E-补料反馈-事件账'),
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/replenishment',
    /补料管理|布料管理/,
    '补料反馈',
    (event) => (event.payload as any)?.note?.includes('E2E-补料反馈-事件账'),
  )
  await expect(page.locator('body')).toContainText('E2E-补料反馈-事件账', { timeout: 30000 })
  await expect(page.locator('body')).toContainText('面料余额不足')

  await expectNoPageErrors(errors)
})

test('PDA 分拣装袋、交出、特殊工艺交出和回仓均写入统一事件账，并能在 Web 回查', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags')
  const scanData = await getPdaHandoverScanData(page)

  await gotoPda(page, '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307')
  await expect(page.locator('[data-pda-cut-handover-field="pickingTaskScan"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-pda-cut-handover-action="confirm-picking"]')).toContainText('确认装袋')

  await page.locator('[data-pda-cut-handover-field="pickingTaskScan"]').fill(scanData.picking.taskNo)
  await page.locator('[data-pda-cut-handover-field="sourceBagScan"]').fill(scanData.picking.sourceBagCode)
  await page.locator('[data-pda-cut-handover-field="pickingFeiTicketScan"]').fill(scanData.picking.feiTicketNo)
  await page.locator('[data-pda-cut-handover-field="targetBagScan"]').fill(scanData.picking.targetBagCode)
  await page.locator('[data-pda-cut-handover-action="confirm-picking"]').click()
  await expectRuntimeEvent(page, '待交出仓分拣装袋')

  await page.locator('[data-pda-cut-handover-field="handoverOrderScan"]').fill(scanData.handover.orderNo)
  await page.locator('[data-pda-cut-handover-field="handoverBagScan"]').fill(scanData.handover.bagCode)
  await page.locator('[data-pda-cut-handover-field="handoverFeiTicketScan"]').fill(scanData.handover.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm"]').click()
  await expectRuntimeEvent(page, '新增交出记录')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftBagScan"]').fill(scanData.specialCraft.bagCode)
  await page.locator('[data-pda-cut-handover-field="specialCraftFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-handover"]').click()
  await expectRuntimeEvent(page, '特殊工艺交出')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnLocationScan"]').fill('SP-RETURN-E2E-01')
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnQty"]').fill(String(scanData.specialCraft.expectedQty))
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expectRuntimeEvent(
    page,
    '特殊工艺回仓',
    (event) => {
      const payload = event.payload as any
      return payload?.locationCode === 'SP-RETURN-E2E-01'
        && event.inventoryEffect?.toLocationCode === 'SP-RETURN-E2E-01'
      && Number(event.inventoryEffect?.qty || 0) === scanData.specialCraft.expectedQty
    },
  )
  await verifyEventOnWebPage(page, '/fcs/craft/cutting/warehouse-management/wait-handover', '裁床待交出仓', '待交出仓分拣装袋')
  await verifyEventOnWebPage(page, '/fcs/craft/cutting/handover-orders', '交出单', '新增交出记录')
  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/special-processes',
    /特殊工艺|捆条加工单/,
    '特殊工艺交出',
  )
  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/special-processes',
    /特殊工艺|捆条加工单/,
    '特殊工艺回仓',
    (event) => event.inventoryEffect?.inventoryScope === '裁床待交出仓' && event.inventoryEffect?.direction === 'IN',
  )

  await expectNoPageErrors(errors)
})

test('PDA 分拣装袋和特殊工艺回仓缺少扫码时不写入事件账', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags')
  const scanData = await getPdaHandoverScanData(page)

  await gotoPda(page, '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307')
  await expect(page.locator('[data-pda-cut-handover-field="pickingTaskScan"]')).toBeVisible({ timeout: 30000 })
  await page.locator('[data-pda-cut-handover-action="confirm-picking"]').click()
  await expect(page.locator('body')).toContainText('请先扫描当前分拣装袋任务码。')
  await expectNoRuntimeEvent(page, '待交出仓分拣装袋')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expect(page.locator('body')).toContainText('请扫描回仓库位。')
  await expectNoRuntimeEvent(page, '特殊工艺回仓')

  await page.locator('[data-pda-cut-handover-field="specialCraftReturnLocationScan"]').fill('SP-RETURN-E2E-02')
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expect(page.locator('body')).toContainText('请填写大于 0 的实回数量。')
  await expectNoRuntimeEvent(page, '特殊工艺回仓')

  await expectNoPageErrors(errors)
})
