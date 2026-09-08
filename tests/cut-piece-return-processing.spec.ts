import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const ppicRoute = '/fcs/sewing-outsourcing/cut-piece-returns'
const warehouseRoute = '/fcs/craft/cutting/cut-piece-return-processing'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.addInitScript(() => {
    const resetGuard = 'higood:test:cut-piece-return-processing:reset'
    if (sessionStorage.getItem(resetGuard) === 'done') return
    localStorage.removeItem('higood:fcs:sewing-outsourcing:cut-piece-return-workflow:v1')
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v1')
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v2')
    localStorage.removeItem('higood:fcs:cutting:cut-piece-return:v3')
    localStorage.removeItem('higood:list-page:/fcs/sewing-outsourcing/cut-piece-returns')
    localStorage.removeItem('higood:list-page:/fcs/craft/cutting/cut-piece-return-processing')
    sessionStorage.setItem(resetGuard, 'done')
  })
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: [document.body.scrollWidth, document.body.clientWidth],
    document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
  }))
  expect(overflow.body[0]).toBe(overflow.body[1])
  expect(overflow.document[0]).toBe(overflow.document[1])
}

test('PPIC建单、仓库异常、PPIC重提和仓库入仓共用同一裁片退仓事实', async ({ page }) => {
  test.setTimeout(180_000)
  mkdirSync('output/playwright', { recursive: true })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(ppicRoute)

  await expect(page.getByRole('heading', { name: '裁片退仓', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await expect(page.locator('[data-standard-list-table-section] table')).toBeVisible()
  await expect(page.locator('[data-standard-list-stats]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '查询', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重置', exact: true })).toBeVisible()
  for (const label of ['待仓库接收', '接收异常', '已入仓']) {
    await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible()
  }
  await expectNoPageOverflow(page)

  await page.getByRole('button', { name: '新增退仓申请', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '新增裁片退仓申请' })
  await expect(dialog.getByRole('heading', { name: '新增裁片退仓申请' })).toBeVisible()
  await expect(dialog).toContainText('操作角色：任务PPIC')
  await expect(dialog).toContainText('PPIC已线下收到')

  await dialog.locator('[data-ppic-return-create-field="reasonCode"]').selectOption('TASK_QTY_REDUCED')
  dialog = page.getByRole('dialog', { name: '新增裁片退仓申请' })
  await dialog.locator('[data-ppic-return-create-field="returnReasonDetail"]').fill('生产任务数量已正式调减，申请退回未投入生产的裁片。')
  await dialog.locator('[data-ppic-return-create-field="garmentQty"]').fill('1')
  await dialog.locator('[data-ppic-return-create-field="responsibilityAdjustmentQty"]').fill('1')
  await dialog.getByRole('button', { name: '创建并提交仓库接收' }).click()
  await expect(dialog).toContainText('必须填写已确认的调整依据号')
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('higood:fcs:sewing-outsourcing:cut-piece-return-workflow:v1')
    const stored = raw
      ? JSON.parse(raw) as { requests?: Array<{ commandId: string }> }
      : {}
    return (stored.requests || []).filter((item) => item.commandId.startsWith('CMD-PPIC-CUT-RETURN-CREATE-')).length
  })).toBe(0)

  await dialog.locator('[data-ppic-return-create-field="reasonCode"]').selectOption('EXCESS_OR_WRONG_PIECES')
  dialog = page.getByRole('dialog', { name: '新增裁片退仓申请' })
  await expect(dialog).toContainText('仅退回多交或错发的实物，不减少工厂已形成的回货责任')
  await dialog.locator('[data-ppic-return-create-field="returnReasonDetail"]').fill('工厂线下反馈多收到裁片，尚未投入生产，PPIC核对后申请原样退回。')
  await dialog.locator('[data-ppic-return-create-field="garmentQty"]').fill('1')
  await dialog.getByRole('button', { name: '创建并提交仓库接收' }).click()

  const created = await page.evaluate(() => {
    const raw = localStorage.getItem('higood:fcs:sewing-outsourcing:cut-piece-return-workflow:v1')
    const stored = raw
      ? JSON.parse(raw) as {
          requests?: Array<{
            requestId: string
            requestNo: string
            commandId: string
            status: string
            returnedGarmentQty: number
            responsibilityAdjustmentQty: number
            expectedReturnQtyBefore: number
            expectedReturnQtyAfter: number
            spuCode: string
            partCounts: Array<{ pieceQty: number }>
          }>
        }
      : {}
    const request = (stored.requests || []).find((item) => item.commandId.startsWith('CMD-PPIC-CUT-RETURN-CREATE-'))
    if (!request) throw new Error('未找到PPIC新建的裁片退仓申请')
    return request
  })
  expect(created.status).toBe('APPROVED_WAITING_WAREHOUSE')
  expect(created.returnedGarmentQty).toBe(1)
  expect(created.responsibilityAdjustmentQty).toBe(0)
  expect(created.expectedReturnQtyAfter).toBe(created.expectedReturnQtyBefore)
  const ppicRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: created.requestNo })
  await expect(ppicRow).toContainText('PPIC已建单，待仓库接收')
  await expect(ppicRow).toContainText('该原因不调整回货责任')

  await ppicRow.getByRole('button', { name: new RegExp(`查看${created.spuCode}款式高清图`) }).click()
  const preview = page.getByRole('dialog', { name: new RegExp(`${created.spuCode}.*高清大图`) })
  await expect(preview.locator('img')).toBeVisible()
  await expect.poll(() => preview.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await preview.getByRole('button', { name: '关闭', exact: true }).click()
  await page.screenshot({ path: 'output/playwright/cut-piece-return-ppic-created.png', fullPage: true })

  await page.goto(warehouseRoute)
  await expect(page.getByRole('heading', { name: '裁片退仓接收与入仓', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: '新增退仓申请' })).toHaveCount(0)
  const warehouseRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: created.requestNo })
  await expect(warehouseRow).toContainText('仓库不可修改')
  await warehouseRow.getByRole('button', { name: '查看建单明细' }).click()
  dialog = page.getByRole('dialog', { name: 'PPIC建单明细' })
  await expect(dialog).toContainText(`按PPIC建单的${created.returnedGarmentQty}件`)
  await expect(dialog).toContainText(`${created.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片`)
  await expect(dialog.locator('input')).toHaveCount(0)
  await dialog.locator('header').getByRole('button', { name: '关闭', exact: true }).click()

  await warehouseRow.getByRole('button', { name: '记录接收异常' }).click()
  dialog = page.getByRole('dialog', { name: '记录仓库接收异常' })
  await dialog.locator('[data-cut-piece-return-warehouse-field="exceptionNote"]').fill('外包装破损，暂不入仓，请PPIC协调工厂重新包装。')
  await dialog.getByRole('button', { name: '记录异常并退回PPIC' }).click()
  await expect(page.getByText('仓库已记录接收异常并退回PPIC处理；PPIC建单数量未被修改。')).toBeVisible()

  await page.goto(ppicRoute)
  await page.getByRole('button', { name: /接收异常/ }).click()
  const exceptionRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: created.requestNo })
  await expect(exceptionRow).toContainText('仓库接收异常，待PPIC处理')
  await exceptionRow.getByRole('button', { name: '处理并重提' }).click()
  dialog = page.getByRole('dialog', { name: '处理仓库接收异常' })
  await expect(dialog).toContainText('外包装破损')
  await dialog.locator('[data-ppic-return-field="reconfirmNote"]').fill('已协调工厂更换包装并重新核对实物，原建单部位和数量不变。')
  await dialog.getByRole('button', { name: '重新提交仓库接收' }).click()
  await expect(page.getByText('异常已处理，原PPIC建单部位和数量已重新提交仓库接收。')).toBeVisible()

  await page.goto(warehouseRoute)
  const resubmittedRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: created.requestNo })
  await expect(resubmittedRow).toContainText('待仓库接收')
  await resubmittedRow.getByRole('button', { name: '确认接收并入仓' }).click()
  await expect(page.getByText('已按PPIC建单部位和数量接收并入仓；仓库未修改业务量。')).toBeVisible()

  const finalFacts = await page.evaluate((requestId) => {
    const workflowRaw = localStorage.getItem('higood:fcs:sewing-outsourcing:cut-piece-return-workflow:v1')
    const workflowStore = workflowRaw
      ? JSON.parse(workflowRaw) as {
          requests?: Array<{
            requestId: string
            status: string
            expectedReturnQtyBefore: number
            expectedReturnQtyAfter: number
            responsibilityAdjustmentQty: number
            legacyReturnCaseId: string
            events: Array<{ eventType: string }>
          }>
        }
      : {}
    const request = (workflowStore.requests || []).find((item) => item.requestId === requestId)
    if (!request) throw new Error('退仓申请不存在')
    const legacyRaw = localStorage.getItem('higood:fcs:cutting:cut-piece-return:v3')
    const legacyStore = legacyRaw
      ? JSON.parse(legacyRaw) as {
          cases?: Array<{
            caseId: string
            receipts: Array<{
              returnedGarmentQty: number
              responsibilityAdjustmentGarmentQty?: number
            }>
          }>
        }
      : {}
    const returnCase = (legacyStore.cases || []).find((item) => item.caseId === request.legacyReturnCaseId)
    return {
      status: request.status,
      expectedReturnQtyBefore: request.expectedReturnQtyBefore,
      expectedReturnQtyAfter: request.expectedReturnQtyAfter,
      responsibilityAdjustmentQty: request.responsibilityAdjustmentQty,
      returnedGarmentQty: returnCase?.receipts.reduce((sum, receipt) => sum + receipt.returnedGarmentQty, 0) ?? -1,
      legacyAdjustmentQty: returnCase?.receipts.reduce((sum, receipt) => sum + (receipt.responsibilityAdjustmentGarmentQty || 0), 0) ?? -1,
      eventTypes: request.events.map((event) => event.eventType),
    }
  }, created.requestId)
  expect(finalFacts).toEqual({
    status: 'WAREHOUSED',
    expectedReturnQtyBefore: created.expectedReturnQtyBefore,
    expectedReturnQtyAfter: created.expectedReturnQtyBefore,
    responsibilityAdjustmentQty: 0,
    returnedGarmentQty: 1,
    legacyAdjustmentQty: 0,
    eventTypes: ['PPIC_CREATED', 'WAREHOUSE_EXCEPTION', 'PPIC_RECONFIRMED', 'WAREHOUSED'],
  })

  await expect(resubmittedRow).toContainText('已接收入仓')
  await page.screenshot({ path: 'output/playwright/cut-piece-return-warehouse-received.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 720 })
  await expectNoPageOverflow(page)
})
