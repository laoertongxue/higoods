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
    const current = buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
    const area = current?.projection.areas.find((item) => item.shelves.some((shelf) => shelf.locations.length > 0))
    const location = area?.shelves.flatMap((shelf) => shelf.locations)[0]
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
    const tickets = [1, 2].map((index) => ({
      feiTicketId: `${repackBagCode}-T${index}`,
      feiTicketNo: `${repackBagCode}-菲票-${index}`,
      productionOrderId: 'WEB-REPACK-PO-ID',
      productionOrderNo: 'WEB-REPACK-PO-001',
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
      refs: { transferBagCode: repackBagCode, usageCycleId, productionOrderId: 'WEB-REPACK-PO-ID', productionOrderNo: 'WEB-REPACK-PO-001', feiTicketIds: tickets.map((ticket) => ticket.feiTicketId), feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo) },
      payload: { baggingRecordId: `bagging:${repackBagCode}`, bagCode: repackBagCode, feiTicketItems: tickets, totalPieceQty: 12, mixedFlag: true, baggingBy: '重装测试员', baggingAt: '2026-08-02 08:00' },
    } as never)
    appendCuttingRuntimeEvent({
      eventType: '中转袋入仓', eventSource: 'WEB', eventStatus: '已同步', occurredAt: '2026-08-02 08:10', operatorName: '重装测试员',
      refs: { transferBagCode: repackBagCode, usageCycleId, productionOrderNo: 'WEB-REPACK-PO-001', feiTicketIds: tickets.map((ticket) => ticket.feiTicketId) },
      inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'IN', qty: 12, unit: '片', toWarehouseArea: '重装测试区', toLocationCode: 'R-01' },
      payload: { tempBagUseId: `temp:${repackBagCode}`, bagCode: repackBagCode, warehouseArea: '重装测试区', locationCode: 'R-01', inboundBy: '重装测试员', inboundAt: '2026-08-02 08:10', feiTicketItems: tickets, totalPieceQty: 12, mixedFlag: true },
    } as never)
  }, { repackBagCode })

  await page.locator('[data-wait-handover-action="open-repack"]').click()
  const repackDialog = page.locator('[data-wait-handover-modal="repack"]')
  await expect(repackDialog).toBeVisible()
  await repackDialog.locator('[data-wait-handover-field="sourceBagCodes"]').selectOption(repackBagCode)
  await expect(repackDialog.locator('[data-wait-handover-repack-group-preview]')).toContainText('雅加达车缝一厂')
  await expect(repackDialog.locator('[data-wait-handover-repack-group-preview]')).toContainText('2 张 / 12 片')
  await repackDialog.locator('[data-wait-handover-field="resultBagCode"]').fill(repackBagCode)
  await repackDialog.getByRole('button', { name: '确认重装', exact: true }).dblclick()
  await expect(repackDialog.getByText('重装成功，请继续交出。', { exact: true })).toBeVisible()
  const repackFacts = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
  ).events.filter((event: { eventType: string }) => event.eventType === '中转袋拆袋重装'))
  expect(repackFacts).toHaveLength(1)

  await expectNoPageErrors(errors)
})
