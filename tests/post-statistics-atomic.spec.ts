import { expect, test } from '@playwright/test'

// POST-024: the dashboard must count return documents separately and reflect a claim.
test('后道统计按两次回货的质检单计数且领取后只移动一张', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.getByTestId('post-finishing-qc-workbench-page')).toBeVisible()
  const fixture = await page.evaluate(async () => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    f.resetPostFinishingFullFlow()
    f.setPostFinishingDemoBootstrapEnabled(false)
    const actors = f.POST_FINISHING_ACCEPTANCE_ACTORS
    const order = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
    for (const returnIndex of [91, 92]) {
      const delivery = f.registerPostFinishingFactoryReturn({
        productionOrderNo: order.productionOrderNo, returnIndex, triggerSource: '公共PDA自助回货',
        idempotencyKey: `POST-024:UI:${returnIndex}`, quantities: order.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 20 })),
        deliveryPersonName: actors.factoryCourier.actorName, deliveryPersonPhone: '08120000091',
        evidenceImageUrls: ['/shirt-sample.jpg'], actor: actors.factoryCourier,
      })
      f.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId,
        firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 20 })), actor: actors.returnConfirmer })
      f.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender })
    }
    f.setCurrentPostFinishingActor(actors.qcA.actorId)
    return { qty: order.skus.length * 40, qcTaskNo: f.listPostFinishingFullFlowQcTasks()[0].qcTaskNo }
  })
  const card = (label: string) => page.locator('article').filter({ has: page.getByText(label, { exact: true }) })
  const check = async (label: string, value: string) => expect(card(label).locator('.text-2xl')).toHaveText(value)
  await page.goto('/fcs/craft/post-finishing/statistics')
  await check('待质检单数', '2')
  await check('质检中任务数', '0')
  await check('已接收成衣件数', `${fixture.qty} 件`)
  await check('待质检成衣件数', `${fixture.qty} 件`)
  await check('已交出任务数', '0')
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await page.locator('[data-post-finishing-field="qc-task-input"]').fill(fixture.qcTaskNo)
  await page.locator('[data-post-finishing-action="full-flow-claim-qc"]').click()
  await page.goto('/fcs/craft/post-finishing/statistics')
  await check('待质检单数', '1')
  await check('质检中任务数', '1')
  await check('已接收成衣件数', `${fixture.qty} 件`)
  await page.screenshot({ path: 'output/playwright/process-route-review/post-statistics-two-returns.png', fullPage: true })
})
