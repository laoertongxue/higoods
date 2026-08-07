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
  await page.goto('/fcs/pda/login', { waitUntil: 'domcontentloaded' })
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

async function ensurePdaSession(page: Page, session = PDA_SESSION): Promise<void> {
  await page.evaluate(({ session, eventLedgerKey }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(eventLedgerKey)) {
      window.localStorage.setItem(eventLedgerKey, JSON.stringify({ events: [] }))
    }
  }, {
    session,
    eventLedgerKey: RUNTIME_EVENT_LEDGER_KEY,
  }).catch(() => undefined)
}

async function gotoPda(page: Page, path: string, readySelector: string, session = PDA_SESSION): Promise<void> {
  await ensurePdaSession(page, session)
  const isCuttingHandoverRoute = path.startsWith('/fcs/pda/cutting/handover/')
  if (isCuttingHandoverRoute) {
    await page.evaluate(async () => {
      await import('/src/pages/pda-cutting-handover.ts')
    })
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (isCuttingHandoverRoute) {
      await page.evaluate((nextPath) => {
        window.history.pushState({}, '', nextPath)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
    } else {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    }
    await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
    const ready = await expect
      .poll(async () => {
        return page.locator(readySelector).isVisible().catch(() => false)
      }, { timeout: 15_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false)
    if (ready) {
      await expect(page).not.toHaveURL(/\/fcs\/pda\/login(?:\?|$)/)
      return
    }
    await ensurePdaSession(page, session)
  }
  throw new Error(`PDA 业务主体未就绪：${path}`)
}

async function gotoWeb(page: Page, path: string, readyText: string | RegExp): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 500 }).catch(() => undefined)
    const ready = await expect.poll(async () => {
      return page.getByText(readyText, { exact: false }).first().isVisible().catch(() => false)
    }, { timeout: 30_000 }).toBeTruthy().then(() => true).catch(() => false)
    if (ready) return
  }
  throw new Error(`Web 业务主体未就绪：${path}`)
}

async function ensureAppPage(page: Page): Promise<void> {
  if (page.url() === 'about:blank') {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
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
    eventType: '中转仓接收',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: '2026-05-25 09:01',
    operatorName: '裁床接收员-测试',
    operatorRole: '裁床接收员',
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
      pickupBy: '裁床接收员-测试',
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
  // PDA handlers can leave a route transition queued after confirmation. Use a
  // clean tab for the Web projection so that transition cannot abort page.goto.
  const webPage = await page.context().newPage()
  try {
    await gotoWeb(webPage, webPath, pageText)
    await expect(webPage.locator('body')).toContainText(pageText, { timeout: 30000 })
    await expectRuntimeEvent(webPage, eventType, predicate)
  } finally {
    await webPage.close()
  }
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
    const { buildPdaUniversalHandoverRecordDraft, listHandoverRecords } = await import('/src/data/fcs/cutting/handover-orders.ts')
    const { appendFeiTicketNumberingRecord, validateFeiTicketNumberingBeforeBagging } = await import('/src/data/fcs/cutting/fei-ticket-numbering.ts')

    const handoverDraft = buildPdaUniversalHandoverRecordDraft()
    const handoverRecord = listHandoverRecords().find((record: any) => record.handoverOrderId === handoverDraft.handoverOrderId)
    const handoverTicket = handoverRecord?.feiTicketItems.find((ticket: any) => (
      handoverRecord.transferBagUses.some((bag: any) => (
        !bag.containedFeiTicketIds.length || bag.containedFeiTicketIds.includes(ticket.feiTicketId)
      ))
    ))
    const handoverBag = handoverRecord?.transferBagUses.find((bag: any) => bag.containedFeiTicketIds.includes(handoverTicket?.feiTicketId)) || handoverRecord?.transferBagUses[0]
    if (handoverTicket) {
      appendFeiTicketNumberingRecord({
        recordId: `NUM-E2E-${handoverTicket.feiTicketId}`,
        feiTicketId: handoverTicket.feiTicketId,
        feiTicketNo: handoverTicket.feiTicketNo,
        productionOrderId: handoverRecord.relatedProductionOrderIds[0] || '',
        productionOrderNo: handoverTicket.productionOrderNo,
        cutOrderId: handoverRecord.relatedCutOrderIds[0] || '',
        cutOrderNo: handoverTicket.cutOrderNo,
        spreadingOrderId: handoverTicket.spreadingOrderId || '',
        spreadingOrderNo: handoverTicket.spreadingOrderNo || '',
        materialSku: handoverTicket.materialSku || '',
        color: handoverTicket.color,
        size: handoverTicket.size,
        partCode: handoverTicket.partCode,
        partName: handoverTicket.partName,
        pieceSequenceStartNo: 1,
        pieceSequenceEndNo: handoverTicket.pieceQty,
        pieceSequenceLabel: `1-${handoverTicket.pieceQty}`,
        numberCount: handoverTicket.pieceQty,
        operatorId: 'CUT-NUM-E2E',
        operatorName: '运行时事件账验收打编号员',
        operatorRole: '打编号员工',
        completedAt: '2026-05-25 08:50',
        source: 'WEB',
      })
      if (!validateFeiTicketNumberingBeforeBagging(handoverTicket).ok) {
        throw new Error('真实编号账夹具写入后仍未通过装袋前编号校验')
      }
      const runtime = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts')
      const mapModule = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
      const mapModel = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
      const map = mapModule.buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
      const location = map
        ? mapModel.listWarehouseLocationMapCells(map.projection).find((cell: any) => cell.businessStatus !== 'OCCUPIED')
        : null
      if (!location) throw new Error('缺少可用于通用交出上游入仓事实的待交出仓库位')
      const usageCycleId = handoverBag.bagUseId
      runtime.appendWaitHandoverBaggingEvent({
        source: 'WEB',
        operator: { operatorName: '运行时事件账验收装袋员', operatorRole: '裁片仓装袋员' },
        bagCode: handoverBag.bagCode,
        usageCycleId,
        occurredAt: '2026-05-25 08:51',
        tickets: [{
          feiTicketId: handoverTicket.feiTicketId,
          feiTicketNo: handoverTicket.feiTicketNo,
          productionOrderId: handoverRecord.relatedProductionOrderIds[0] || '',
          productionOrderNo: handoverTicket.productionOrderNo,
          cutOrderId: handoverRecord.relatedCutOrderIds[0] || '',
          cutOrderNo: handoverTicket.cutOrderNo,
          spreadingOrderId: handoverTicket.spreadingOrderId || '',
          spreadingOrderNo: handoverTicket.spreadingOrderNo || '',
          spuCode: handoverTicket.spuCode,
          color: handoverTicket.color,
          size: handoverTicket.size,
          partCode: handoverTicket.partCode,
          partName: handoverTicket.partName,
          pieceQty: handoverTicket.pieceQty,
          pieceSequenceLabel: `1-${handoverTicket.pieceQty}`,
          hasSpecialCraft: false,
          specialCraftDisplay: '无',
          receiverFactoryDisplay: handoverRecord.receiverName,
          printStatus: '已打印',
          voidStatus: '有效',
        }],
      })
      runtime.appendWaitHandoverInboundEvent({
        source: 'WEB',
        operator: { operatorName: '运行时事件账验收入仓员', operatorRole: '裁片仓入仓员' },
        bagCode: handoverBag.bagCode,
        usageCycleId,
        warehouseArea: location.areaName,
        locationCode: location.locationNo,
        locationRef: location,
        warehouseLocations: [location],
        occurredAt: '2026-05-25 08:52',
      })
    }

    const specialCraftDraft = buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001')
    const specialCraftRecord = listHandoverRecords().find((record: any) => record.handoverOrderId === specialCraftDraft.handoverOrderId)
    const specialCraftItem = specialCraftRecord?.specialCraftItems?.[0]
    const specialCraftTicket = specialCraftRecord?.feiTicketItems.find((ticket: any) => ticket.feiTicketId === specialCraftItem?.feiTicketId) || specialCraftRecord?.feiTicketItems[0]
    const specialCraftBag = specialCraftRecord?.transferBagUses.find((bag: any) => bag.containedFeiTicketIds.includes(specialCraftTicket?.feiTicketId)) || specialCraftRecord?.transferBagUses[0]
    if (specialCraftTicket && specialCraftBag) {
      const runtime = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts')
      const mapModule = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
      const mapModel = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
      const map = mapModule.buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
      const location = map
        ? mapModel.listWarehouseLocationMapCells(map.projection).find((cell: any) => cell.businessStatus !== 'OCCUPIED')
        : null
      if (!location) throw new Error('缺少可用于特殊工艺交出上游入仓事实的待交出仓库位')
      const usageCycleId = specialCraftBag.bagUseId
      runtime.appendWaitHandoverBaggingEvent({
        source: 'WEB',
        operator: { operatorName: '运行时事件账特殊工艺装袋员', operatorRole: '裁片仓装袋员' },
        bagCode: specialCraftBag.bagCode,
        usageCycleId,
        occurredAt: '2026-05-25 08:53',
        tickets: [{
          feiTicketId: specialCraftTicket.feiTicketId,
          feiTicketNo: specialCraftTicket.feiTicketNo,
          productionOrderId: specialCraftRecord.relatedProductionOrderIds[0] || '',
          productionOrderNo: specialCraftTicket.productionOrderNo,
          cutOrderId: specialCraftRecord.relatedCutOrderIds[0] || '',
          cutOrderNo: specialCraftTicket.cutOrderNo,
          spreadingOrderId: specialCraftTicket.spreadingOrderId || '',
          spreadingOrderNo: specialCraftTicket.spreadingOrderNo || '',
          spuCode: specialCraftTicket.spuCode,
          color: specialCraftTicket.color,
          size: specialCraftTicket.size,
          partCode: specialCraftTicket.partCode,
          partName: specialCraftTicket.partName,
          pieceQty: specialCraftTicket.pieceQty,
          pieceSequenceLabel: `1-${specialCraftTicket.pieceQty}`,
          hasSpecialCraft: true,
          specialCraftDisplay: specialCraftItem?.craftType || '特殊工艺',
          receiverFactoryDisplay: specialCraftRecord.receiverName,
          printStatus: '已打印',
          voidStatus: '有效',
        }],
      })
      runtime.appendWaitHandoverInboundEvent({
        source: 'WEB',
        operator: { operatorName: '运行时事件账特殊工艺入仓员', operatorRole: '裁片仓入仓员' },
        bagCode: specialCraftBag.bagCode,
        usageCycleId,
        warehouseArea: location.areaName,
        locationCode: location.locationNo,
        locationRef: location,
        warehouseLocations: [location],
        occurredAt: '2026-05-25 08:54',
      })
    }

    return {
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

  expect(scanData.handover.orderNo).not.toBe('')
  expect(scanData.handover.bagCode).not.toBe('')
  expect(scanData.handover.feiTicketNo).not.toBe('')
  expect(scanData.specialCraft.orderNo).not.toBe('')
  expect(scanData.specialCraft.bagCode).not.toBe('')
  expect(scanData.specialCraft.feiTicketNo).not.toBe('')
  expect(scanData.specialCraft.expectedQty).toBeGreaterThan(0)

  return scanData
}

// 加工接收与回收入仓的真实表单确认和事件写入由
// cutting-warehouse-location-map.spec.ts 的“PDA 扫码异常、特殊工艺回仓和多候选接收批次均走真实页面处理器”覆盖。
test('PDA 中转仓接收按待领节点选位确认，并在 Web 裁床待加工仓回查同一事件账', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)
  const pickupSession = {
    userId: 'PDAU-FACTORY-ONBOARD-0034-ADMIN',
    loginId: 'onboarding_34',
    userName: '裁床仓管',
    roleId: 'ROLE_ADMIN',
    factoryId: 'FACTORY-ONBOARD-0034',
    factoryName: '定向裁演示工厂34',
    loggedAt: '2026-07-23 10:00:00',
  }
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, pickupSession)
  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, pickupSession).catch(() => undefined)

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.goto('/fcs/craft/cutting/pickup-management/ready')
  const pickupLink = page.getByRole('row').filter({ hasText: '去接收' }).first()
    .getByRole('link', { name: '去接收', exact: true })
  const pickupHref = await pickupLink.getAttribute('href')
  expect(pickupHref).toBeTruthy()
  await page.evaluate(async () => {
    await import('/src/pages/pda-warehouse-wait-process.ts')
  })
  await page.evaluate((targetPath) => {
    window.history.pushState({}, '', targetPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, pickupHref!)
  const pickupTask = page.locator('[data-cutting-pickup-node-id]')
  await expect(pickupTask).toBeVisible()
  const emptyLocation = page.locator(
    '[data-pda-cutting-pickup-location-map] [data-warehouse-map-action="toggle-location"]:not([disabled])',
  ).first()
  await expect(emptyLocation).toBeVisible()
  await emptyLocation.click()
  await page.locator('[data-pda-warehouse-action="confirm-cutting-wp-pickup"]').click()
  await expectRuntimeEvent(
    page,
    '中转仓接收',
    (event) => Number((event.payload as any)?.pickupQty || 0) > 0,
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '流水记录',
    '中转仓接收',
    (event) => Number((event.payload as any)?.pickupQty || 0) > 0,
  )

  await expectNoPageErrors(errors)
})

test('PDA 完成裁剪写入实际裁剪产出，Web 铺布单和菲票页面可读取同一事件账', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)
  await seedPickupForPdaTask(page, 'TASK-CUT-PDA-CUTTING-0306')

  await gotoPda(
    page,
    '/fcs/pda/cutting/spreading/TASK-CUT-PDA-CUTTING-0306',
    '[data-pda-cut-spreading-field="actualCutQty"]',
  )
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

test('PDA 菲票装袋结构化写入袋码、菲票和数量，Web 待交出仓可回查', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags', '中转袋')
  const ticketNo = await getFirstPrintedFeiTicketNo(page)

  await gotoPda(
    page,
    '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307',
    '[data-pda-cut-inbound-field="carrierCode"]',
  )
  await expect(page.getByText('菲票装袋', { exact: true })).toBeVisible({ timeout: 30_000 })
  const bagCode = 'BAG-001'
  await expect.poll(() => page.evaluate((code) => (
    window.__higoodPdaCuttingInboundMockLedger?.bags[code]?.status || ''
  ), bagCode)).toBe('EMPTY_READY')
  await page.locator('[data-pda-cut-inbound-field="carrierCode"]').fill(bagCode)
  const ticketScan = page.locator('[data-pda-cut-inbound-field="scanCode"]')
  await ticketScan.fill(ticketNo)
  await ticketScan.press('Enter')
  await expect(page.locator('body')).toContainText('已加入')
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expectRuntimeEvent(
    page,
    '菲票装袋',
    (event) => {
      const payload = event.payload as any
      return payload?.bagCode === bagCode && Array.isArray(payload?.feiTicketItems) && payload.feiTicketItems.length > 0
    },
  )

  await verifyEventOnWebPage(
    page,
    '/fcs/craft/cutting/warehouse-management/wait-handover',
    '裁床待交出仓',
    '菲票装袋',
    (event) => {
      const payload = event.payload as any
      return payload?.bagCode === bagCode && Array.isArray(payload?.feiTicketItems) && payload.feiTicketItems.length > 0
    },
  )

  await expectNoPageErrors(errors)
})

// 分拣装袋到目标袋已经从本页退场；该链路由
// cutting-wait-handover-web-modal.spec.ts 第 252 行所在的目标袋快照流程继续覆盖。
test('PDA 通用交出、特殊工艺交出和回仓均写入统一事件账，并能在 Web 回查', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags', '中转袋')
  const scanData = await getPdaHandoverScanData(page)

  await gotoPda(
    page,
    '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307',
    '[data-pda-cut-handover-field="handoverOrderScan"]',
  )
  await expect(page.locator('[data-pda-cut-handover-field="handoverOrderScan"]')).toBeVisible({ timeout: 30000 })

  await page.locator('[data-pda-cut-handover-field="handoverOrderScan"]').fill(scanData.handover.orderNo)
  await page.locator('[data-pda-cut-handover-field="handoverBagScan"]').fill(scanData.handover.bagCode)
  await page.locator('[data-pda-cut-handover-field="handoverFeiTicketScan"]').fill(scanData.handover.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm"]').click()
  await page.waitForTimeout(50)
  await expectNoPageErrors(errors)
  await expectRuntimeEvent(page, '新增交出记录')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftBagScan"]').fill(scanData.specialCraft.bagCode)
  await page.locator('[data-pda-cut-handover-field="specialCraftFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-handover"]').click()
  await expectRuntimeEvent(page, '特殊工艺交出')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnBagScan"]').fill(scanData.specialCraft.bagCode)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  const returnLocationNo = await page.locator('[data-warehouse-map-action="toggle-location"]').first().getAttribute('data-location-no') || ''
  expect(returnLocationNo).not.toBe('')
  const returnLocationScan = page.locator('[data-pda-cut-handover-field="specialCraftReturnLocationScan"]')
  await returnLocationScan.fill(returnLocationNo)
  await returnLocationScan.press('Enter')
  await expect(page.locator('[data-warehouse-map-selection-summary]')).toContainText(returnLocationNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnQty"]').fill(String(scanData.specialCraft.expectedQty))
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expectRuntimeEvent(
    page,
    '特殊工艺回仓',
    (event) => {
      const payload = event.payload as any
      return Boolean(payload?.locationCode)
        && event.inventoryEffect?.toLocationCode === payload.locationCode
        && Number(event.inventoryEffect?.qty || 0) === scanData.specialCraft.expectedQty
    },
  )
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

test('PDA 特殊工艺回仓缺少来源、库位或数量时不写入事件账', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedCuttingPdaSession(page)

  await gotoWeb(page, '/fcs/craft/cutting/transfer-bags', '中转袋')
  const scanData = await getPdaHandoverScanData(page)

  await gotoPda(
    page,
    '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307',
    '[data-pda-cut-handover-field="handoverOrderScan"]',
  )
  await expect(page.locator('[data-pda-cut-handover-field="handoverOrderScan"]')).toBeVisible({ timeout: 30000 })
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expect(page.locator('body')).toContainText('请先扫描来源特殊工艺交出单。')
  await expectNoRuntimeEvent(page, '特殊工艺回仓')

  await page.locator('[data-pda-cut-handover-field="specialCraftOrderScan"]').fill(scanData.specialCraft.orderNo)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnBagScan"]').fill(scanData.specialCraft.bagCode)
  await page.locator('[data-pda-cut-handover-field="specialCraftReturnFeiTicketScan"]').fill(scanData.specialCraft.feiTicketNo)
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expect(page.locator('body')).toContainText('请选择空闲库位。')
  await expectNoRuntimeEvent(page, '特殊工艺回仓')

  const returnLocationNo = await page.locator('[data-warehouse-map-action="toggle-location"]').first().getAttribute('data-location-no') || ''
  expect(returnLocationNo).not.toBe('')
  const returnLocationScan = page.locator('[data-pda-cut-handover-field="specialCraftReturnLocationScan"]')
  await returnLocationScan.fill(returnLocationNo)
  await returnLocationScan.press('Enter')
  await expect(page.locator('[data-warehouse-map-selection-summary]')).toContainText(returnLocationNo)
  await page.locator('[data-pda-cut-handover-action="confirm-special-craft-return"]').click()
  await expect(page.locator('body')).toContainText('请填写大于 0 的实回数量。')
  await expectNoRuntimeEvent(page, '特殊工艺回仓')

  await expectNoPageErrors(errors)
})
