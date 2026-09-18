import { expect, test, type Page } from '@playwright/test'

const woolOrderId = 'WOOL-STAGE-008:KNITTING'
const workAction = (name: string, id?: string) => `[data-wool-work-orders-action="${name}"]${id ? `[data-wool-order-id="${id}"]` : ''}`
const receiveAction = (name: string) => `[data-wool-receiving-action="${name}"]`

async function readBatch(page: Page, handoverId: string) {
  return page.evaluate(async handoverId => {
    const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const { listFactoryReceivingSources, listFactoryReceipts } = await import('/src/data/fcs/factory-receiving.ts')
    const { listWoolCraftTaskOrders } = await import('/src/data/fcs/wool-domain/craft-flow.ts')
    const { buildWoolCraftWarehouseProjection } = await import('/src/data/fcs/wool-domain/craft-warehouse.ts')
    const handover = readWoolStore().handovers.find((h: any) => h.handoverId === handoverId)!
    const sources = listFactoryReceivingSources().filter((s: any) => s.originalRecordId === handoverId)
    const lines = listFactoryReceipts().flatMap((receipt: any) => receipt.lines.filter((line: any) => sources.some((s: any) => s.id === line.sourceId)).map((line: any) => ({ ...line, receiptId: receipt.id, factoryId: receipt.factoryId })))
    const task = listWoolCraftTaskOrders().find((t: any) => t.taskOrderId === handover.targetWorkOrderId)!
    const stocks = buildWoolCraftWarehouseProjection().waitProcessStockItems.filter((s: any) => s.taskId === task.taskOrderId)
    return { handover, sources, lines, task, stocks }
  }, handoverId)
}

async function receiveBatch(page: Page, sourceLineId: string, qty: number) {
  await page.locator(`${receiveAction('receive')}[data-id="${sourceLineId}"]`).click()
  await page.locator('[data-wool-receiving-field="pieceQty"]').fill(String(qty))
  await page.locator(receiveAction('review')).click()
  await page.locator(receiveAction('save')).click()
  await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
}

test('A08 同一实际横机交出100片分60和40接收，刷新守恒且同来源不能重复入库', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.goto('/fcs/craft/wool/knitting-orders')
  // Demo 008 has 40 pieces already knitted; report the remaining 60 through UI.
  await page.locator(workAction('open-report', woolOrderId)).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill('60')
  await page.locator(workAction('save-report')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await page.locator(workAction('open-handover', woolOrderId)).click()
  await expect(page.locator('[data-wool-business-dialog]')).toContainText('首工艺')
  await page.locator('[data-wool-dialog-field="qty"]').fill('100')
  await page.locator(workAction('save-handover')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  // Read-only lookup ties every subsequent assertion to the actual UI-created batch.
  const created = await page.evaluate(async id => {
    const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const { listWoolCraftTaskOrders } = await import('/src/data/fcs/wool-domain/craft-flow.ts')
    const { buildSpecialCraftTaskDetailPath } = await import('/src/data/fcs/special-craft-operations.ts')
    const handovers = readWoolStore().handovers.filter((h: any) => h.woolOrderId === id && !h.automatic)
    const task = listWoolCraftTaskOrders().find((t: any) => t.taskOrderId === handovers[0]?.targetWorkOrderId)
    return { handovers, route: task ? buildSpecialCraftTaskDetailPath(task, task.taskOrderId) : '' }
  }, woolOrderId)
  expect(created.handovers).toHaveLength(1)
  expect(created.handovers[0]).toMatchObject({ handoverQty: 100, qtyUnit: '片', receiverId: 'FAC-APF' })
  const handoverId = created.handovers[0].handoverId
  const initial = await readBatch(page, handoverId)
  expect(initial.sources).toHaveLength(1)
  expect(initial.sources[0].lines).toHaveLength(1)
  expect(initial.lines).toHaveLength(0)
  expect(initial.task.receivedQty).toBe(0)
  expect(initial.stocks).toHaveLength(0)
  const source = initial.sources[0], sourceLine = source.lines[0]
  expect(sourceLine).toMatchObject({ sentQty: 100, woolCraftOrderId: initial.task.taskOrderId, woolPieceKey: created.handovers[0].pieceKey })

  await page.goto(created.route)
  await page.locator('[data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
  await receiveBatch(page, sourceLine.id, 60)
  const partial = await readBatch(page, handoverId)
  expect(partial.lines.map((l: any) => l.qty)).toEqual([60])
  expect(partial.handover.downstreamReceipt).toMatchObject({ status: 'PENDING', actualReceivedQty: 60, differenceQty: -40 })
  expect(partial.task).toMatchObject({ receivedQty: 60, currentQty: 60 })
  expect(partial.stocks.reduce((n: number, s: any) => n + s.availableQty, 0)).toBe(60)
  const sourceRow = page.locator('[data-wool-receiving-table] tbody tr').filter({ hasText: handoverId })
  await expect(sourceRow).toContainText('尚待接收：40 片')
  await expect(sourceRow).not.toContainText('本批已收齐')
  await page.reload()
  await expect(sourceRow).toContainText('已实收：60 片')
  await expect(sourceRow).toContainText('尚待接收：40 片')
  expect((await readBatch(page, handoverId)).lines).toEqual(partial.lines)
  await receiveBatch(page, sourceLine.id, 40)
  const final = await readBatch(page, handoverId)
  expect(final.sources).toHaveLength(1)
  expect(final.sources[0]).toEqual(source)
  expect(final.lines.map((l: any) => l.qty)).toEqual([60, 40])
  expect(new Set(final.lines.map((l: any) => l.receiptId)).size).toBe(2)
  expect(new Set(final.lines.map((l: any) => l.id)).size).toBe(2)
  expect(final.lines.every((l: any) => l.sourceId === source.id && l.sourceLineId === sourceLine.id && l.factoryId === source.targetFactoryId)).toBe(true)
  expect(final.handover.downstreamReceipt).toMatchObject({ status: 'CONFIRMED', actualReceivedQty: 100, differenceQty: 0 })
  expect(final.task).toMatchObject({ receivedQty: 100, currentQty: 100, completedQty: 0 })
  expect(final.stocks).toHaveLength(2)
  expect(final.stocks.reduce((n: number, s: any) => n + s.availableQty, 0)).toBe(100)
  expect(new Set(final.stocks.map((s: any) => s.stockItemId)).size).toBe(2)
  await page.reload()
  await page.locator('[data-wool-receiving-field="registration"]').selectOption('all')
  await page.locator(receiveAction('query')).click()
  await expect(sourceRow).toContainText('尚待接收：0 片')
  await expect(sourceRow).toContainText('本批已收齐')
  await expect(sourceRow.locator(receiveAction('receive'))).toHaveCount(0)
  const afterReload = await readBatch(page, handoverId)
  expect(afterReload.lines).toEqual(final.lines)
  expect(afterReload.stocks).toEqual(final.stocks)
  await info.attach('split-receipt-facts', { body: Buffer.from(JSON.stringify({ handoverId, sourceId: source.id, initial, partial, final, afterReload }, null, 2)), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('split-receipt-complete.png'), fullPage: true })
})
