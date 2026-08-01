import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'

async function openModalAndMeasure(
  page: Page,
  action: 'bagging' | 'inbound' | 'handover',
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

test('待交出仓保留原工作台，三个中转袋操作均在当前页面打开弹窗', async ({ page }) => {
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
  await expect(
    page.locator('[data-wait-handover-action="open-special-craft-return"]'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '库位图', exact: true })).toBeVisible()
  await expect(page.locator('[data-wait-handover-web-selector]')).toHaveCount(0)
  const actions = [
    { label: '菲票装袋', action: 'bagging' },
    { label: '中转袋入仓', action: 'inbound' },
    { label: '中转袋交出', action: 'handover' },
  ] as const

  for (const item of actions) {
    const urlBefore = page.url()
    const openDurationMs = await openModalAndMeasure(page, item.action)

    const dialog = page.locator(`[data-wait-handover-modal="${item.action}"]`)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: item.label, exact: true })).toBeVisible()
    expect(page.url()).toBe(urlBefore)
    expect(openDurationMs, `${item.label}弹窗响应必须低于 200ms`).toBeLessThan(200)
    await dialog.getByText('关闭', { exact: true }).click()
    await expect(dialog).toHaveCount(0)

    expect(page.url()).toBe(urlBefore)
  }

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
  await expect(baggingDialog).toHaveCount(0)

  await page.locator('[data-wait-handover-action="open-inbound"]').click()
  const inboundDialog = page.locator('[data-wait-handover-modal="inbound"]')
  await expect(inboundDialog).toBeVisible()
  await inboundDialog.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await expect(
    inboundDialog.locator('[data-wait-handover-field="bagCode"]'),
  ).toHaveValue(bagCode)
  await inboundDialog.locator('[data-warehouse-map-action="clear-selection"]').click()
  const areaCards = inboundDialog.locator('article').filter({ has: page.locator('h3') })
  const firstAreaCell = areaCards.nth(0).locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').first()
  const secondAreaCell = areaCards.nth(1).locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').first()
  await firstAreaCell.click()
  await secondAreaCell.click()
  await expect(inboundDialog.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 2 个库位')
  await inboundDialog.getByRole('button', { name: '确认中转袋入仓', exact: true }).click()
  await expect(inboundDialog).toHaveCount(0)

  const persistedFacts = await page.evaluate(() => {
    const ledger = JSON.parse(
      window.localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}',
    ) as { events?: Array<{ eventType?: string; refs?: unknown; payload?: unknown }> }
    return ledger.events || []
  }, bagCode)
  expect(persistedFacts.map((event) => event.eventType)).toContain('菲票装袋')
  expect(persistedFacts.map((event) => event.eventType)).toContain('中转袋入仓')
  expect(JSON.stringify(persistedFacts)).toContain(bagCode)
  const inboundFact = persistedFacts.find((event) => event.eventType === '中转袋入仓' && JSON.stringify(event).includes(bagCode))
  expect((inboundFact?.payload as { warehouseLocations?: unknown[] })?.warehouseLocations).toHaveLength(2)
  expect((inboundFact?.payload as { locationRef?: unknown })?.locationRef).toBeUndefined()

  await page.locator('[data-wait-handover-action="open-handover"]').click()
  const handoverDialog = page.locator('[data-wait-handover-modal="handover"]')
  await expect(handoverDialog).toBeVisible()
  await expect(handoverDialog).toContainText('一次只交出一个完整中转袋')
  await expect(handoverDialog.locator('[data-wait-handover-field="handoverSelection"]')).toBeVisible()
  await expect(handoverDialog.locator('[data-wait-handover-field="ticketScanInput"]')).toHaveCount(0)
  await handoverDialog.getByText('关闭', { exact: true }).click()
  await expect(handoverDialog).toHaveCount(0)

  await expectNoPageErrors(errors)
})
