import { expect, test, type Page } from '@playwright/test'

// Run only against the task's local prototype. UI actions own all writes; this
// helper opens existing stores with readonly transactions and never seeds data.
type Payment = {
  requestNo: string; type: string; currency: string; payableAmount: number
  requestedAmount: number; paidAmount: number; paymentStatus: string
  sourceRows: Array<{ sourceId: string; sourceLabel: string; amount: number }>
  requestRecords: Array<{ amount: number }>
  paymentRecords: Array<{ amount: number; voucherNo: string }>
}
async function stored<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (store) => {
    if (!(await indexedDB.databases()).some(db => db.name === 'higood-pms')) throw new Error('PMS database has not opened')
    return new Promise<unknown[]>((resolve, reject) => {
      const open = indexedDB.open('higood-pms')
      open.onupgradeneeded = () => { open.transaction?.abort(); reject(new Error('Readonly evidence cannot initialize a database')) }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction(store, 'readonly'), request = tx.objectStore(store).getAll()
        let rows: unknown[] = []
        request.onsuccess = () => { rows = request.result }
        tx.oncomplete = () => { db.close(); resolve(rows) }
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Readonly evidence failed')) }
      }
    })
  }, store) as Promise<T[]>
}
async function localPage(page: Page, route: string, root: string): Promise<void> {
  await page.goto(route)
  expect(['localhost', '127.0.0.1', '[::1]'], 'Business tests must never write to test/production sites').toContain(new URL(page.url()).hostname)
  await expect(page.locator(root)).toBeVisible()
}

test.describe('PMS 物流来源与请付款守恒', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1366, height: 768 }) })

  test('新建 USD 物流来源→请款80→付款30；超余款被阻断且独立入口读回50未付', async ({ page, context }) => {
    const batchNo = `FL-E2E-${Date.now()}`, voucher = `LOCAL-${Date.now()}`
    await localPage(page, '/pms/first-leg-shipments', '[data-pms-fls-root]')
    await page.locator('[data-pms-fls-action="open-create"]').click()
    await page.locator('[data-pms-fls-create-field="batchNo"]').fill(batchNo)
    await page.locator('[data-pms-fls-create-field="carrierId"]').selectOption('FL-CN-003')
    await page.locator('[data-pms-fls-create-field="channelId"]').selectOption('CH-CN-0005')
    await page.locator('[data-pms-fls-create-field="fee"]').fill('100')
    await page.locator('[data-pms-fls-create-field="remark"]').fill('自动化本地演示物流来源')
    await page.locator('[data-pms-fls-create-check]').first().check()
    await page.locator('[data-pms-fls-action="submit-create"]').click()
    await expect.poll(async () => (await stored<{ batchNo: string; fee: number; feeCurrency: string }>(page, 'pmsFirstLegBatches')).find(row => row.batchNo === batchNo)).toMatchObject({ batchNo, fee: 100, feeCurrency: 'USD' })

    await localPage(page, '/pms/logistics-payment-requests', '[data-pms-pay-root]')
    await page.locator('[data-pms-pay-action="choose-source"]').click()
    await page.locator(`[data-payment-source="${batchNo}"]`).check()
    await page.locator('[data-pms-pay-action="adopt-source"]').click()
    await expect(page.locator('[data-pms-pay-draft-root]')).toContainText(batchNo)
    await expect(page.locator('[data-pms-pay-draft-root]')).toContainText('USD')
    await page.locator('[data-pms-pay-draft-field="paymentType"]').selectOption('部分付款')
    await page.locator('[data-pms-pay-draft-field="purpose"]').fill(`本地物流结算 ${batchNo}`)
    await page.locator('[data-pms-pay-action="create-request"]').click()
    const findRequest = async () => (await stored<Payment>(page, 'pmsPaymentRequests')).find(row => row.sourceRows.some(source => source.sourceId === batchNo))
    await expect.poll(findRequest).toMatchObject({ type: 'logistics', currency: 'USD', payableAmount: 100, requestedAmount: 0, paidAmount: 0 })
    const requestNo = (await findRequest())!.requestNo
    await page.locator('[data-pms-pay-field="keyword"]').fill(requestNo)
    await page.locator('[data-pms-pay-action="query"]').click()
    await page.locator(`[data-pms-pay-action="open-detail"][data-request-no="${requestNo}"]`).click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toBeVisible()

    await page.locator('[data-pms-pay-action="open-request"]').click()
    await page.locator('[data-pms-pay-request-amount]').fill('80')
    await page.locator('[data-pms-pay-request-note]').fill('本地演示分批请款')
    await page.locator('[data-pms-pay-action="submit-request"]').click()
    await expect.poll(findRequest).toMatchObject({ requestedAmount: 80, paidAmount: 0, requestRecords: [{ amount: 80 }] })
    await page.locator('[data-pms-pay-action="open-pay"]').click()
    await page.locator('[data-pms-pay-pay-amount]').fill('30')
    await page.locator('[data-pms-pay-pay-voucher]').fill(voucher)
    await page.locator('[data-pms-pay-action="submit-pay"]').click()
    await expect.poll(findRequest).toMatchObject({ requestedAmount: 80, paidAmount: 30, paymentStatus: '部分付款', paymentRecords: [{ amount: 30, voucherNo: voucher }] })
    const before = await findRequest()

    await page.locator('[data-pms-pay-action="open-pay"]').click()
    await page.locator('[data-pms-pay-pay-amount]').fill('51')
    await page.locator('[data-pms-pay-pay-note]').fill('超出未付金额1，输入应保留')
    await page.locator('[data-pms-pay-action="submit-pay"]').click()
    await expect(page.locator('[data-pms-pay-register-root]')).toBeVisible()
    await expect(page.locator('[data-pms-pay-pay-amount]')).toHaveValue('51')
    await expect(page.locator('[data-pms-pay-pay-note]')).toHaveValue('超出未付金额1，输入应保留')
    expect(await findRequest(), 'Rejected payment must not append a payment or change durable totals').toEqual(before)
    await page.locator('[data-pms-pay-action="close-sub"]').click()

    const fresh = await context.newPage()
    await localPage(fresh, '/pms/logistics-payment-requests', '[data-pms-pay-root]')
    await fresh.locator('[data-pms-pay-field="keyword"]').fill(requestNo)
    await fresh.locator('[data-pms-pay-action="query"]').click()
    await fresh.locator(`[data-pms-pay-action="open-detail"][data-request-no="${requestNo}"]`).click()
    const detail = fresh.locator('[data-pms-pay-detail-root]')
    await expect(detail).toContainText(batchNo)
    await expect(detail).toContainText('USD')
    await expect(detail).toContainText(voucher)
    const totals = detail.locator('section.grid').filter({ has: fresh.locator('dt', { hasText: '应付' }) }).locator('dd')
    await expect(totals.nth(0)).toContainText(/100(?:\.00)?/)
    await expect(totals.nth(1)).toContainText(/80(?:\.00)?/)
    await expect(totals.nth(2)).toContainText(/30(?:\.00)?/)
    await expect(totals.nth(3)).toContainText(/20(?:\.00)?.*50(?:\.00)?/)
    const saved = (await stored<Payment>(fresh, 'pmsPaymentRequests')).find(row => row.requestNo === requestNo)!
    expect(saved.requestedAmount - saved.paidAmount).toBe(50)
    expect(saved.payableAmount - saved.requestedAmount).toBe(20)
    expect(saved.sourceRows).toEqual([{ sourceId: batchNo, sourceLabel: expect.stringContaining(batchNo), amount: 100 }])
    expect(saved.currency).toBe('USD')
    await detail.getByRole('button', { name: '关闭', exact: true }).click()
    await fresh.locator('[data-pms-pay-action="choose-source"]').click()
    await expect(fresh.locator(`[data-payment-source="${batchNo}"]`), 'Active request removes its source from another request').toHaveCount(0)
    await test.info().attach('物流原币与余款持久回读', { body: Buffer.from(JSON.stringify({ batchNo, request: saved }, null, 2)), contentType: 'application/json' })
  })
})
