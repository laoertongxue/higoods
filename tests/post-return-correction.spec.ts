import { expect, test } from '@playwright/test'

// POST-020: only the current return supervisor may correct a confirmed receipt.
test('回货主管订正保留原版本、可取消并同步待送检数量', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.getByTestId('post-finishing-qc-workbench-page')).toBeVisible()
  const fixture = await page.evaluate(async () => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    f.resetPostFinishingFullFlow()
    f.setPostFinishingDemoBootstrapEnabled(false)
    const actors = f.POST_FINISHING_ACCEPTANCE_ACTORS
    const order = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
    const registered = f.registerPostFinishingFactoryReturn({
      productionOrderNo: order.productionOrderNo, returnIndex: 92,
      triggerSource: '公共PDA自助回货', idempotencyKey: 'POST-020:BROWSER',
      quantities: order.skus.map(sku => ({ skuId: sku.skuId, registeredQty: 20 })),
      deliveryPersonName: actors.factoryCourier.actorName, deliveryPersonPhone: '08120000092',
      evidenceImageUrls: ['/shirt-sample.jpg'], actor: actors.factoryCourier,
    })
    const confirmed = f.confirmPostFinishingFactoryReturn({
      deliveryId: registered.deliveryId,
      firstCounts: registered.lines.map(line => ({ skuId: line.sku.skuId, actualQty: 20 })),
      actor: actors.returnConfirmer,
    })
    f.setCurrentPostFinishingActor(actors.returnConfirmer.actorId)
    return { id: confirmed.deliveryId, confirmedAt: confirmed.confirmedAt, lines: confirmed.lines.length }
  })
  const url = `/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${fixture.id}`
  await page.goto(url)
  await expect(page.locator('[data-return-confirm-root]')).toBeVisible()
  await expect(page.locator('[data-post-finishing-action="full-flow-correct-return"]')).toHaveCount(0)
  await page.evaluate(() => localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-RETURN-MGR'))
  await page.reload()
  const counts = page.locator('[data-return-correction-count]')
  await expect(counts).toHaveCount(fixture.lines)
  for (const input of await counts.all()) await input.fill('19')
  await page.locator('[data-return-correction-reason]').fill('主管复点每个尺码少一件')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: '主管确认订正并保留版本', exact: true }).click()
  await expect(page.getByText('已被订正', { exact: true })).toHaveCount(0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '主管确认订正并保留版本', exact: true }).click()
  await expect(page.getByText('已被订正', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('当前生效', { exact: true })).toBeVisible()
  await expect(page.getByText('已被订正', { exact: true })).toBeVisible()
  const facts = await page.evaluate(async (id) => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return { delivery: f.getPostFinishingFactoryReturn(id)!, versions: f.listPostFinishingReturnConfirmationVersions({ deliveryId: id }), qc: f.listPostFinishingFullFlowQcTasks() }
  }, fixture.id)
  expect(facts.delivery.confirmedAt).toBe(fixture.confirmedAt)
  expect(facts.versions).toHaveLength(2)
  expect(facts.versions[0].confirmedQty).toBe(20 * fixture.lines)
  expect(facts.versions[1].confirmedQty).toBe(19 * fixture.lines)
  expect(facts.qc.find(task => task.qcTaskId === facts.delivery.qcTaskId)?.lines.every(line => line.expectedQty === 19)).toBe(true)
  await page.screenshot({ path: 'output/playwright/process-route-review/post-return-correction.png', fullPage: true })
})
