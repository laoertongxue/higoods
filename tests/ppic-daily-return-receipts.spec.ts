import { setPpicTestLogin } from './fixtures/ppic-current-login'
import { expect, test, type Page } from '@playwright/test'

const report = '/fcs/sewing-outsourcing/daily-return-report'
const warehouse = '/fcs/craft/post-finishing/wait-process-warehouse'
const nowAt = '2026-10-14T08:00:00.123Z'
type ReceiptFixture = { actorId: string; assignmentId: string; deliveryId: string; deliveryNo: string; promiseId: string; quantity: number; skuId: string; firstSkuQty: number; priorConfirmedQty: number }

async function prepareReceipt(page: Page): Promise<ReceiptFixture> {
  await page.goto(report)
  await expect(page.getByRole('heading', { name: '每日回货填报', exact: true })).toBeVisible()
  return page.evaluate(async () => {
    const records = await import('/src/data/fcs/ppic-daily-return-records.ts')
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const pending = post.listPostFinishingFactoryReturns().filter(d => d.status === '待后道确认')
    for (const actor of records.PPIC_DAILY_DEMO_MEMBERS.filter(p => !p.leader)) {
      const login = await import('/src/data/fcs/factory-onboarding-ppic.ts')
      Object.assign(login.SEWING_OUTSOURCING_DEMO_CURRENT_PPIC, login.getOnboardingPpicOptionById(actor.id)!)
      const view = records.getPpicDailyReturnView({ nowAt: '2026-10-14T08:00:00.123Z' })
      const task = view.tasks.find(t => t.basis.status === 'READY' && !t.capacity.conflict && pending.some(d => d.assignmentId === t.task.assignmentId && d.lines.reduce((n, l) => n + l.registeredQty, 0) <= t.capacity.available))
      if (!task) continue
      const delivery = pending.find(d => d.assignmentId === task.task.assignmentId)!
      const quantity = delivery.lines.reduce((n, l) => n + l.registeredQty, 0)
      const promise = await records.savePpicDailyReturnPromise({ operationId: 'RECEIPT-BROWSER-PROMISE', assignmentId: task.task.assignmentId, quantity, deadlineAt: '2026-10-14T14:00:00', date: '2026-10-14', basisVersion: task.basis.basisVersion, nowAt: '2026-10-14T04:00:00Z' })
      const priorConfirmedQty = post.listPostFinishingReturnConfirmationVersions({ assignmentId: task.task.assignmentId, activeOnly: true }).reduce((sum, version) => sum + version.confirmedQty, 0)
      return { actorId: actor.id, assignmentId: task.task.assignmentId, deliveryId: delivery.deliveryId, deliveryNo: delivery.deliveryOrderNo, promiseId: promise.promiseId, quantity, skuId: delivery.lines[0]!.sku.skuId, firstSkuQty: delivery.lines[0]!.registeredQty, priorConfirmedQty }
    }
    throw new Error('正常后道场景需要有已确认应回依据、待确认回货及足够承诺容量的第三方车缝任务')
  })
}

async function snapshot(page: Page, fixture: ReceiptFixture) {
  return page.evaluate(async ({ deliveryId, promiseId }) => {
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const records = await import('/src/data/fcs/ppic-daily-return-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    const store = records.capturePpicDailyStore()
    return {
      delivery: post.getPostFinishingFactoryReturn(deliveryId),
      versions: post.listPostFinishingReturnConfirmationVersions({ deliveryId }),
      warehouse: post.listPostFinishingWaitProcessWarehouseRecords().filter(row => row.deliveryId === deliveryId),
      qc: post.listPostFinishingFullFlowQcTasks().filter(row => row.deliveryId === deliveryId),
      allocations: store.allocations.filter(row => row.promiseId === promiseId),
      evaluations: store.evaluations.filter(row => row.promiseId === promiseId),
      durable: (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.sort((a, b) => a.id.localeCompare(b.id)),
    }
  }, fixture)
}

async function promiseResult(page: Page, fixture: ReceiptFixture) {
  return page.evaluate(async ({ promiseId }) => {
    const records = await import('/src/data/fcs/ppic-daily-return-records.ts')
    const domain = await import('/src/data/fcs/ppic-daily-return.ts')
    const store = records.capturePpicDailyStore()
    return domain.ppicPromiseResult(store, store.promises.find(p => p.promiseId === promiseId)!, '2026-10-14T08:00:00.123Z')
  }, fixture)
}

async function confirmFromUi(page: Page, fixture: ReceiptFixture, actual = '2026-10-14T13:00') {
  await page.goto(`${warehouse}?tab=returns&deliveryId=${encodeURIComponent(fixture.deliveryId)}`)
  await expect(page.locator('[data-return-business-confirmed-at]')).toBeVisible()
  await page.locator('[data-return-business-confirmed-at]').fill(actual)
  await page.locator('[data-return-entry-delay-reason]').fill('仓库现场已确认，稍后补录')
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByText('后道已最终确认回货', { exact: false })).toBeVisible()
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(nowAt)) })

test('后道确认后新标签直达回货跟进，读取同一实收、承诺和分摊且不落盘种子', async ({ page, context }) => {
  const fixture = await prepareReceipt(page)
  await confirmFromUi(page, fixture)
  const user = await page.evaluate(async id => (await import('/src/data/fcs/factory-onboarding-ppic.ts')).getOnboardingPpicOptionById(id), fixture.actorId)
  const before = await snapshot(page, fixture)
  const cold = await context.newPage()
  await cold.clock.setFixedTime(new Date(nowAt))
  // 只设置已有登录上下文；此标签不先打开填报页、不导入PPIC记录模块。
  await cold.route('**/src/data/fcs/factory-onboarding-ppic.ts*', async route => {
    const response = await route.fetch()
    const body = await response.text()
    await route.fulfill({ response, body: body.replace(/^export const SEWING_OUTSOURCING_DEMO_CURRENT_PPIC = .*;$/m, 'export const SEWING_OUTSOURCING_DEMO_CURRENT_PPIC = ' + JSON.stringify(user) + ';') })
  })
  await cold.goto('/fcs/sewing-outsourcing/returns')
  await cold.locator('[data-ppic-return-track-action="switch-tab:OVERDUE"]').click()
  await cold.locator(`[data-ppic-return-track-action="detail"][data-assignment-id="${fixture.assignmentId}"]`).click()
  const detail = cold.getByRole('dialog', { name: '回货履约归责详情' })
  await expect(detail).toContainText(`已确认 ${fixture.priorConfirmedQty + fixture.quantity} 件`)
  await expect(detail).toContainText('按期兑现')
  await expect(detail).not.toContainText('尚无每日承诺')
  await detail.locator('summary').click()
  await expect(detail).toContainText('正式实收分摊')
  expect((await snapshot(page, fixture)).durable).toEqual(before.durable)
})

test('补录原因和未来时刻在页面阻断，按实际确认时刻计算及时量且首次读取不落盘种子', async ({ page }) => {
  await page.goto(report)
  await expect(page.getByRole('heading', { name: '每日回货填报', exact: true })).toBeVisible()
  const initial = await page.evaluate(async () => {
    const records = await import('/src/data/fcs/ppic-daily-return-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    records.getPpicDailyReturnView(); records.getPpicDailyReturnView()
    return { durable: (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.length,
      legacyBusinessKeys: Object.keys(localStorage).filter(key => key.startsWith('higood.ppic-daily-return.')) }
  })
  expect(initial).toEqual({ durable: 0, legacyBusinessKeys: [] })
  const fixture = await prepareReceipt(page)
  await page.goto(`${warehouse}?tab=returns&deliveryId=${encodeURIComponent(fixture.deliveryId)}`)
  const input = page.locator('[data-return-business-confirmed-at]')
  await input.fill('2026-10-14T13:00')
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByText('补录实际确认时间时须填写录入延迟原因。', { exact: false })).toBeVisible()
  expect((await snapshot(page, fixture)).versions).toHaveLength(0)
  await page.locator('[data-return-entry-delay-reason]').fill('稍后补录')
  await input.fill('2026-10-15T13:00')
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByText('实际后道确认时间不能晚于当前时间。', { exact: false })).toBeVisible()
  await expect(input).toHaveValue('2026-10-15T13:00')
  expect((await snapshot(page, fixture)).versions).toHaveLength(0)
  await input.fill('2026-10-14T13:00')
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByText('后道已最终确认回货', { exact: false })).toBeVisible()
  const result = await snapshot(page, fixture)
  expect(result.versions).toHaveLength(1)
  expect(result.versions[0]).toMatchObject({ confirmedAt: '2026-10-14T06:00:00.000Z', versionCreatedAt: nowAt, entryDelayReason: '稍后补录', confirmedQty: fixture.quantity, status: 'ACTIVE' })
  expect(result.allocations.filter(a => a.active).reduce((sum, row) => sum + row.quantity, 0)).toBe(fixture.quantity)
  expect(await promiseResult(page, fixture)).toMatchObject({ timelyQty: fixture.quantity, originalGap: 0, currentGap: 0 })
  expect(result.warehouse[0].confirmedAt).toBe('2026-10-14T06:00:00.000Z')
  expect(result.qc[0].lines.reduce((sum, row) => sum + row.expectedQty, 0)).toBe(fixture.quantity)
  await page.reload()
  await expect(page.getByText('录入延迟：稍后补录', { exact: false })).toBeVisible()
  expect((await snapshot(page, fixture)).versions).toHaveLength(1)
  await test.info().attach('confirmed-receipt', { body: JSON.stringify({ fixture, versions: result.versions, allocations: result.allocations, result: await promiseResult(page, fixture) }), contentType: 'application/json' })
})

test('主管订正保留原版本并重算数量与时间，普通确认岗位没有订正入口', async ({ page }) => {
  const fixture = await prepareReceipt(page)
  await confirmFromUi(page, fixture)
  await expect(page.locator('[data-post-finishing-action="full-flow-correct-return"]')).toHaveCount(0)
  await page.evaluate(async () => (await import('/src/data/fcs/post-finishing-full-flow.ts')).setCurrentPostFinishingActor('PF-USER-RETURN-MGR'))
  await page.reload()
  await expect(page.locator('[data-post-finishing-action="full-flow-correct-return"]')).toBeVisible()
  await page.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`).fill(String(fixture.firstSkuQty - 1))
  await page.locator('[data-return-correction-reason]').fill('主管重新核对数量和实际到仓时间')
  await page.locator('[data-return-business-confirmed-at]').fill('2026-10-14T14:30')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-action="full-flow-correct-return"]').click()
  await expect.poll(async () => (await snapshot(page, fixture)).versions.length).toBe(2)
  const result = await snapshot(page, fixture)
  expect(result.versions).toHaveLength(2)
  const original = result.versions.find(v => v.versionKind === 'FINAL_CONFIRMATION')!
  const corrected = result.versions.find(v => v.versionKind === 'AUTHORIZED_CORRECTION')!
  expect(original).toMatchObject({ status: 'SUPERSEDED', confirmedQty: fixture.quantity, confirmedAt: '2026-10-14T06:00:00.000Z' })
  expect(corrected).toMatchObject({ status: 'ACTIVE', confirmedQty: fixture.quantity - 1, confirmedAt: '2026-10-14T07:30:00.000Z', versionCreatedAt: nowAt, supersedesVersionId: original.confirmationVersionId })
  expect(original.supersededByVersionId).toBe(corrected.confirmationVersionId)
  expect(corrected.entryDelayReason).toBe('仓库现场已确认，稍后补录')
  expect(result.allocations.filter(a => a.active).reduce((sum, row) => sum + row.quantity, 0)).toBe(fixture.quantity - 1)
  expect(result.allocations.filter(a => !a.active).some(a => a.receiptId === original.confirmationVersionId)).toBe(true)
  expect(await promiseResult(page, fixture)).toMatchObject({ timelyQty: 0, originalGap: fixture.quantity, currentGap: 1 })
  expect(result.warehouse[0].lines.reduce((sum, row) => sum + row.confirmedQty, 0)).toBe(fixture.quantity - 1)
  expect(result.qc[0].lines.reduce((sum, row) => sum + row.expectedQty, 0)).toBe(fixture.quantity - 1)
  const formalQty = await page.evaluate(async ({ assignmentId }) => {
    const rows = (await import('/src/data/fcs/sewing-outsourcing-return-tracking.ts')).listSewingOutsourcingReturnTrackingRows('2026-10-14T08:00:00.123Z')
    return rows.find(row => row.assignment.assignmentId === assignmentId)!.returnProjection.confirmedReturnedQty
  }, fixture)
  expect(formalQty).toBe(fixture.priorConfirmedQty + fixture.quantity - 1)
  await page.reload()
  await expect.poll(async () => (await snapshot(page, fixture)).versions.length).toBe(2)
  expect((await snapshot(page, fixture)).versions).toHaveLength(2)
})

test('强制PCS事务中止后送货单、仓库、QC和PPIC全部回滚，唯一重试在同事务提交并刷新下游读回', async ({ page }) => {
  const fixture = await prepareReceipt(page)
  await page.goto(`${warehouse}?tab=returns&deliveryId=${encodeURIComponent(fixture.deliveryId)}`)
  await page.locator('[data-return-business-confirmed-at]').fill('2026-10-14T13:00')
  await page.locator('[data-return-entry-delay-reason]').fill('补录现场确认')
  const before = await snapshot(page, fixture)
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    ;(window as any).restoreReceiptTransaction = () => { IDBDatabase.prototype.transaction = original }
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const transaction = original.apply(this, args)
      if (this.name === 'higood-pcs-records' && args[1] === 'readwrite') transaction.abort()
      return transaction
    }
  })
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByRole('alert')).toContainText(/未保存|中止|AbortError/)
  await expect(page.locator('[data-return-business-confirmed-at]')).toHaveValue('2026-10-14T13:00')
  await expect(page.locator('[data-return-entry-delay-reason]')).toHaveValue('补录现场确认')
  expect(await snapshot(page, fixture)).toEqual(before)
  await page.evaluate(() => {
    ;(window as any).restoreReceiptTransaction()
    const original = IDBObjectStore.prototype.put
    const ids = new WeakMap<IDBTransaction, number>(); let sequence = 0
    ;(window as any).receiptPuts = []
    ;(window as any).restoreReceiptPuts = () => { IDBObjectStore.prototype.put = original }
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.transaction.db.name === 'higood-pcs-records' && this.name === 'records') {
        if (!ids.has(this.transaction)) ids.set(this.transaction, ++sequence)
        ;(window as any).receiptPuts.push({ tx: ids.get(this.transaction), id: (args[0] as { id: string }).id })
      }
      return original.apply(this, args)
    }
  })
  await page.locator('[data-post-finishing-action="full-flow-confirm-return"]').click()
  await expect(page.getByText('后道已最终确认回货', { exact: false })).toBeVisible()
  const puts = await page.evaluate(() => (window as any).receiptPuts as Array<{ tx: number; id: string }>)
  for (const required of ['flow/deliveries/', 'flow/waitProcessWarehouseRecords/', 'flow/qcTasks/', 'ppicAllocations/']) expect(puts.some(row => row.id.includes(required)), required).toBe(true)
  expect(new Set(puts.map(row => row.tx)).size).toBe(1)
  await page.evaluate(() => (window as any).restoreReceiptPuts())
  const saved = await snapshot(page, fixture)
  expect(saved.versions).toHaveLength(1); expect(saved.qc).toHaveLength(1)
  await page.evaluate(async ({ deliveryId }) => {
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const repo = await import('/src/data/fcs/post-finishing-records.ts')
    const delivery = post.getPostFinishingFactoryReturn(deliveryId)!
    await repo.runPostFinishingCommand(() => post.confirmPostFinishingFactoryReturn({ deliveryId, firstCounts: delivery.lines.map(l => ({ skuId: l.sku.skuId, actualQty: l.registeredQty })), actor: post.POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer }))
  }, fixture)
  expect((await snapshot(page, fixture)).versions).toHaveLength(1)
  await page.goto(report)
  await setPpicTestLogin(page, fixture.actorId)
  await page.reload()
  await setPpicTestLogin(page, fixture.actorId)
  const restored = await snapshot(page, fixture)
  expect(restored.versions).toHaveLength(1); expect(restored.qc).toHaveLength(1)
  expect(restored.allocations.filter(row => row.active).reduce((sum, row) => sum + row.quantity, 0)).toBe(fixture.quantity)
  await test.info().attach('single-transaction-writes', { body: JSON.stringify(puts), contentType: 'application/json' })
})

test('同一浏览器两标签旧revision订正冲突保留输入和既有资料，重新读取后可重试', async ({ page, context }) => {
  const fixture = await prepareReceipt(page)
  await confirmFromUi(page, fixture)
  await page.evaluate(async () => (await import('/src/data/fcs/post-finishing-full-flow.ts')).setCurrentPostFinishingActor('PF-USER-RETURN-MGR'))
  await page.reload()
  const second = await context.newPage()
  await second.clock.setFixedTime(new Date(nowAt))
  await second.goto(`${warehouse}?tab=returns&deliveryId=${encodeURIComponent(fixture.deliveryId)}`)
  await expect(second.locator('[data-post-finishing-action="full-flow-correct-return"]')).toBeVisible()
  await second.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`).fill(String(fixture.firstSkuQty - 2))
  await second.locator('[data-return-correction-reason]').fill('第二标签旧页面复点')
  await page.bringToFront()
  await page.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`).fill(String(fixture.firstSkuQty - 1))
  await page.locator('[data-return-correction-reason]').fill('第一标签主管复点')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-action="full-flow-correct-return"]').click()
  await expect.poll(async () => (await snapshot(page, fixture)).versions.length).toBe(2)
  await expect(second.locator('[data-return-correction-reason]')).toHaveValue('第二标签旧页面复点')
  await expect(second.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`)).toHaveValue(String(fixture.firstSkuQty - 2))
  await second.bringToFront()
  second.once('dialog', dialog => dialog.accept())
  await second.locator('[data-post-finishing-action="full-flow-correct-return"]').click()
  await expect(second.getByRole('alert')).toContainText(/其他页面|已变化|版本|重新读取/)
  await expect(second.locator('[data-return-correction-reason]')).toHaveValue('第二标签旧页面复点')
  const persisted = await snapshot(page, fixture)
  expect(persisted.versions).toHaveLength(2)
  expect(persisted.versions.find(v => v.status === 'ACTIVE')!.confirmedQty).toBe(fixture.quantity - 1)
  await second.reload()
  await expect(second.getByText('2 个版本', { exact: true })).toBeVisible()
  await second.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`).fill(String(fixture.firstSkuQty - 2))
  await second.locator('[data-return-correction-reason]').fill('重新读取后复点')
  second.once('dialog', dialog => dialog.accept())
  await second.locator('[data-post-finishing-action="full-flow-correct-return"]').click()
  await expect(second.getByText('3 个版本', { exact: true })).toBeVisible()
  expect((await snapshot(second, fixture)).versions).toHaveLength(3)
})

test('补录后仅订正数量不会截断原实际确认的秒或毫秒，正式累计回货与PPIC保持一致', async ({ page }) => {
  const fixture = await prepareReceipt(page)
  const actualAt = '2026-10-14T06:00:17.321Z'
  await page.evaluate(async ({ deliveryId, actualAt }) => {
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const repo = await import('/src/data/fcs/post-finishing-records.ts')
    const delivery = post.getPostFinishingFactoryReturn(deliveryId)!
    await repo.runPostFinishingCommand(() => post.confirmPostFinishingFactoryReturn({ deliveryId, firstCounts: delivery.lines.map(l => ({ skuId: l.sku.skuId, actualQty: l.registeredQty })), actor: post.POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer, actualConfirmedAt: actualAt, entryDelayReason: '现场凭证精确至毫秒，后补录' }))
    post.setCurrentPostFinishingActor('PF-USER-RETURN-MGR')
  }, { ...fixture, actualAt })
  await page.goto(`${warehouse}?tab=returns&deliveryId=${encodeURIComponent(fixture.deliveryId)}`)
  await expect(page.locator('[data-return-business-confirmed-at]')).toHaveValue('2026-10-14T13:00:17')
  await page.locator(`[data-return-correction-line="${fixture.skuId}"] [data-return-correction-count]`).fill(String(fixture.firstSkuQty - 1))
  await page.locator('[data-return-correction-reason]').fill('只订正一件数量，实际确认时间保持原记录')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-action="full-flow-correct-return"]').click()
  await expect(page.getByText('2 个版本', { exact: true })).toBeVisible()
  const result = await snapshot(page, fixture)
  const active = result.versions.find(v => v.status === 'ACTIVE')!
  expect(active.confirmedAt).toBe(actualAt)
  expect(active.entryDelayReason).toBe('现场凭证精确至毫秒，后补录')
  expect(await promiseResult(page, fixture)).toMatchObject({ timelyQty: fixture.quantity - 1, originalGap: 1, currentGap: 1 })
  const formal = await page.evaluate(async ({ assignmentId }) => (await import('/src/data/fcs/sewing-outsourcing-return-tracking.ts')).listSewingOutsourcingReturnTrackingRows('2026-10-14T08:00:00.123Z').find(row => row.assignment.assignmentId === assignmentId)!.returnProjection.confirmedReturnedQty, fixture)
  expect(formal).toBe(fixture.priorConfirmedQty + fixture.quantity - 1)
  const slaTime = await page.evaluate(async ({ deliveryId }) => {
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const delivery = post.getPostFinishingFactoryReturn(deliveryId)!
    const version = post.listPostFinishingReturnConfirmationVersions({ deliveryId, activeOnly: true })[0]!
    return (await import('/src/data/fcs/sewing-delivery-receipt-facts.ts')).listSewingDeliveryReceiptFacts(delivery.executionTaskId, '2026-10-14 15:00:01').find(r => r.recordId === version.confirmationVersionId)?.receivedAt
  }, fixture)
  expect(slaTime).toBe('2026-10-14 13:00:17.321')
})

test('现场同一秒确认后立即默认读取会包含已保存的毫秒实收', async ({ page }) => {
  const fixture = await prepareReceipt(page)
  const actual = await page.evaluate(async ({ deliveryId }) => {
    const post = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const repo = await import('/src/data/fcs/post-finishing-records.ts')
    const before = post.getPostFinishingFactoryReturn(deliveryId)!
    await repo.runPostFinishingCommand(() => post.confirmPostFinishingFactoryReturn({ deliveryId, firstCounts: before.lines.map(l => ({ skuId: l.sku.skuId, actualQty: l.registeredQty })), actor: post.POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer }))
    const version = post.listPostFinishingReturnConfirmationVersions({ deliveryId, activeOnly: true })[0]!
    const facts = await import('/src/data/fcs/sewing-delivery-receipt-facts.ts')
    return { confirmedAt: version.confirmedAt, quantity: version.confirmedQty,
      immediate: facts.listSewingDeliveryReceiptFacts(before.executionTaskId).find(r => r.recordId === version.confirmationVersionId),
      earlier: facts.listSewingDeliveryReceiptFacts(before.executionTaskId, '2026-10-14 15:00:00').some(r => r.recordId === version.confirmationVersionId) }
  }, fixture)
  expect(actual.confirmedAt).toBe(nowAt)
  expect(actual.immediate).toMatchObject({ receivedAt: '2026-10-14 15:00:00.123', receivedQty: fixture.quantity })
  expect(actual.earlier).toBe(false)
})

test('PDA后道确认冷开独立入口即写入PPIC分摊，核验前不导入PPIC模块也不打开填报页', async ({ page, context }) => {
  const fixture = await prepareReceipt(page)
  const cold = await context.newPage()
  await cold.setViewportSize({ width: 390, height: 844 })
  await cold.clock.setFixedTime(new Date(nowAt))
  await cold.addInitScript(() => localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: 'F090_operator', loginId: 'F090_operator', userName: '全能力测试工厂_操作工', roleId: 'ROLE_OPERATOR', factoryId: 'F090', factoryName: '全能力测试工厂', loggedAt: '2026-10-14 15:00:00' })))
  await cold.goto(`/fcs/pda/post-finishing/return-confirm?id=${encodeURIComponent(fixture.deliveryNo)}`)
  await expect(cold.locator('[data-pda-return-confirm]')).toBeVisible()
  await cold.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    const transactions = new WeakMap<IDBTransaction, number>(); let sequence = 0
    ;(window as any).coldReceiptPuts = []
    ;(window as any).restoreColdReceiptPuts = () => { IDBObjectStore.prototype.put = original }
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.transaction.db.name === 'higood-pcs-records' && this.name === 'records') {
        if (!transactions.has(this.transaction)) transactions.set(this.transaction, ++sequence)
        ;(window as any).coldReceiptPuts.push({ tx: transactions.get(this.transaction), id: (args[0] as { id: string }).id })
      }
      return original.apply(this, args)
    }
  })
  await cold.locator('[data-return-business-confirmed-at]').fill('2026-10-14T13:00')
  await cold.locator('[data-return-entry-delay-reason]').fill('PDA现场确认后补录')
  await cold.locator('[data-pda-post-action="confirm-return"]').click()
  await expect(cold.getByText('回货确认成功', { exact: false })).toBeVisible()
  const raw = await cold.evaluate(async ({ promiseId, deliveryId }) => {
    // 独立读取数据库原始记录；此处绝不动态 import PPIC，避免测试注册遗漏的投影。
    const rows = await new Promise<Array<{ id: string; value: any }>>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('records', 'readonly')
        const all = tx.objectStore('records').getAll()
        tx.oncomplete = () => { db.close(); resolve(all.result) }
        tx.onabort = () => { db.close(); reject(tx.error) }
      }
    })
    return { allocations: rows.filter(row => row.id.includes('/ppicAllocations/') && row.value.promiseId === promiseId).map(row => row.value),
      confirmations: rows.filter(row => row.id.includes('/returnConfirmationVersions/') && row.value.deliveryId === deliveryId).map(row => row.value), puts: (window as any).coldReceiptPuts as Array<{ tx: number; id: string }> }
  }, fixture)
  expect(raw.allocations.filter(row => row.active).reduce((sum, row) => sum + row.quantity, 0)).toBe(fixture.quantity)
  expect(raw.confirmations).toHaveLength(1)
  expect(raw.confirmations[0]).toMatchObject({ confirmedAt: '2026-10-14T06:00:00.000Z', versionCreatedAt: nowAt, entryDelayReason: 'PDA现场确认后补录' })
  expect(new Set(raw.puts.map(row => row.tx)).size).toBe(1)
  expect(raw.puts.some(row => row.id.includes('/ppicAllocations/'))).toBe(true)
  expect(raw.puts.some(row => row.id.includes('/flow/qcTasks/'))).toBe(true)
  await cold.evaluate(() => (window as any).restoreColdReceiptPuts())
  await test.info().attach('cold-pda-raw-idb', { body: JSON.stringify({ fixture, raw }), contentType: 'application/json' })
})

test('IDB打开和读取失败均阻断空记录保存，恢复后原资料可读且没有业务种子或localStorage后备', async ({ page, context }) => {
  const fixture = await prepareReceipt(page)
  const before = await snapshot(page, fixture)
  for (const mode of ['open', 'read'] as const) {
    const broken = await context.newPage()
    await broken.clock.setFixedTime(new Date(nowAt))
    await broken.addInitScript(mode => {
      const open = IDBFactory.prototype.open, transaction = IDBDatabase.prototype.transaction, put = IDBObjectStore.prototype.put, setItem = Storage.prototype.setItem
      ;(window as any).receiptReadFailure = mode
      ;(window as any).receiptFailureBusinessWrites = []
      ;(window as any).receiptFailureLocalWrites = []
      ;(window as any).restoreReceiptReadFailure = () => { (window as any).receiptReadFailure = ''; IDBFactory.prototype.open = open; IDBDatabase.prototype.transaction = transaction; IDBObjectStore.prototype.put = put; Storage.prototype.setItem = setItem }
      IDBFactory.prototype.open = function (...args: Parameters<typeof open>) {
        if (args[0] === 'higood-pcs-records' && (window as any).receiptReadFailure === 'open') throw new DOMException('隔离浏览器测试模拟无法打开资料', 'UnknownError')
        return open.apply(this, args)
      }
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof transaction>) {
        const tx = transaction.apply(this, args)
        if (this.name === 'higood-pcs-records' && args[1] === 'readonly' && (window as any).receiptReadFailure === 'read') tx.abort()
        return tx
      }
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        if (this.transaction.db.name === 'higood-pcs-records' && this.name === 'records') (window as any).receiptFailureBusinessWrites.push((args[0] as { id: string }).id)
        return put.apply(this, args)
      }
      Storage.prototype.setItem = function (key: string, value: string) {
        if (/ppic-daily-return|post-finishing-full-flow/.test(key)) (window as any).receiptFailureLocalWrites.push(key)
        return setItem.call(this, key, value)
      }
    }, mode)
    await broken.goto(report)
    await expect(broken.getByRole('alert').first()).toContainText(/未.*读取|无法读取|未能读取|未读/)
    await expect(broken.getByRole('button', { name: '确认今日填报', exact: true })).toHaveCount(0)
    await expect(broken.locator('[data-daily-task]')).toHaveCount(0)
    const failed = await broken.evaluate(() => ({ businessWrites: (window as any).receiptFailureBusinessWrites, localWrites: (window as any).receiptFailureLocalWrites }))
    expect(failed).toEqual({ businessWrites: [], localWrites: [] })
    expect((await snapshot(page, fixture)).durable).toEqual(before.durable)
    await broken.evaluate(() => (window as any).restoreReceiptReadFailure())
    await broken.evaluate(() => { (window as any).beforeReceiptRetryRoot = document.querySelector('[data-ppic-daily-page]') })
    await broken.getByRole('button', { name: '重新读取', exact: true }).first().click()
    await expect.poll(async () => broken.evaluate(() => (window as any).beforeReceiptRetryRoot !== document.querySelector('[data-ppic-daily-page]'))).toBe(true)
    await expect(broken.getByRole('heading', { name: '每日回货填报', exact: true })).toBeVisible()
    if (await broken.getByRole('alert').filter({ hasText: '生产来源正在保存或迁移' }).count()) {
      // 首次初始化仍持有只读作用域时，遵循页面等待提示，确认其完成后再重读。
      await expect.poll(async () => broken.evaluate(async () => (await import('/src/data/fcs/production-context-records.ts')).isProductionContextReady())).toBe(true)
      await broken.evaluate(() => { (window as any).beforeReceiptRetryRoot = document.querySelector('[data-ppic-daily-page]') })
      await broken.getByRole('button', { name: '重新读取', exact: true }).first().click()
      await expect.poll(async () => broken.evaluate(() => (window as any).beforeReceiptRetryRoot !== document.querySelector('[data-ppic-daily-page]'))).toBe(true)
    }
    await expect(broken.getByRole('heading', { name: '每日回货填报', exact: true })).toBeVisible()
    const restored = await snapshot(broken, fixture)
    expect(restored.durable).toEqual(before.durable)
    expect(await broken.evaluate(async ({ promiseId }) => (await import('/src/data/fcs/ppic-daily-return-records.ts')).capturePpicDailyStore().promises.filter(p => p.promiseId === promiseId).length, fixture)).toBe(1)
    await test.info().attach(`idb-${mode}-failure-protection`, { body: JSON.stringify({ mode, failed, preservedRecordCount: restored.durable.length }), contentType: 'application/json' })
    await broken.close()
  }
})
