import { expect, test } from '@playwright/test'

test('旧出货单链接只读保留数量、图片并与当前出货隔离', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('higood-fcs-post-finishing-demo-mode-v1', 'empty')
    localStorage.setItem('higood-fcs-post-finishing-outbound-orders-v1', JSON.stringify([{
      outboundOrderId: 'OLD-OUT-KEEP', outboundOrderNo: 'OLD-OUT-007', productionOrderNo: 'OLD-PO-1',
      status: '已确认', recheckOrderNo: 'OLD-RC-1', lines: [{
        skuCode: 'OLD-SKU-1', spuName: '历史衬衫', colorName: '白色', sizeName: 'M',
        skuImageUrl: '/shirt-sample.jpg', plannedQty: 7, inboundQty: 6, qtyUnit: '件',
      }],
    }]))
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/fcs/craft/post-finishing/outbound-orders/OLD-OUT-KEEP')
  const archive = page.getByTestId('archived-post-outbound')
  await expect(archive).toContainText('OLD-OUT-007')
  await expect(archive).toContainText('7 件')
  await expect(archive).toContainText('6 件')
  await expect(page.getByText('打印整单', { exact: true })).toHaveCount(0)
  await expect(archive.locator('img')).toBeVisible()
  await expect.poll(() => archive.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await archive.locator('button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await testInfo.attach('历史只读出货页', { body: await page.screenshot(), contentType: 'image/png' })
  const active = await page.evaluate(async () => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return flow.listPostFinishingFullFlowOutboundOrders().some((row) => row.outboundOrderId === 'OLD-OUT-KEEP')
  })
  expect(active).toBe(false)
  await page.goto('/fcs/craft/post-finishing/outbound-orders/OLD-OUT-007')
  await expect(page.getByTestId('archived-post-outbound')).toContainText('OLD-SKU-1')
})

test('已有批次入库不能掩盖同生产单待质检批次或自动完成', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  const orderId = await page.evaluate(async () => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    flow.resetPostFinishingFullFlow()
    flow.loadPostFinishingDemoData()
    const key = 'higood-fcs-post-finishing-full-flow-v1'
    const state = JSON.parse(localStorage.getItem(key)!)
    const qc = state.qcTasks.find((task: any) => task.status === '待质检')
    if (!qc) throw new Error('缺少待质检批次')
    state.outboundOrders.forEach((order: any) => { order.status = '已接收入库' })
    localStorage.setItem(key, JSON.stringify(state))
    return qc.productionOrderId
  })
  await page.reload()
  const task = await page.evaluate(async (id) => {
    const model = await import('/src/data/fcs/post-finishing-current-read-model.ts')
    return model.getPostFinishingTaskByProductionOrder(id)
  }, orderId)
  expect(task).toBeTruthy()
  expect(task!.currentStatus).not.toBe('已完成')
  expect(task!.waitQcQty).toBeGreaterThan(0)
})
