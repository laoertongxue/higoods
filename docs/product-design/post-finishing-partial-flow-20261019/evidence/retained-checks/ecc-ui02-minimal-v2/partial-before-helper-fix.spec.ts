import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceDirectory = resolve(process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence', 'partial-flow-e2e')
const processItems = ['开扣眼', '装扣子', '熨烫', '包装']
const webPostAction = (action: string) => `[data-post-finishing-work-order-detail-action="${action}"]`
interface Seed { taskId: string; taskNo: string; deliveryId: string; qcTaskId: string; qcTaskNo: string; skuId: string; skuCode: string; barcode: string }

async function evidence(page: Page, info: TestInfo, name: string) {
  mkdirSync(evidenceDirectory, { recursive: true })
  const path = resolve(evidenceDirectory, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function showProcessColumns(page: Page) {
  await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-standard-list-scroll]')!
    const first = scroller.querySelector<HTMLElement>('th[data-column-key="process-开扣眼"]')!
    const frozen = scroller.querySelector<HTMLElement>('th[data-column-key="documents"]')!
    scroller.scrollLeft += first.getBoundingClientRect().left - frozen.getBoundingClientRect().right - 8
  })
  const bounds = await page.evaluate(() => {
    const first = document.querySelector('th[data-column-key="process-开扣眼"]')!.getBoundingClientRect()
    const last = document.querySelector('th[data-column-key="process-包装"]')!.getBoundingClientRect()
    const frozen = document.querySelector('th[data-column-key="documents"]')!.getBoundingClientRect()
    const actions = document.querySelector('th[data-column-key="actions"]')!.getBoundingClientRect()
    return { firstLeft: first.left, lastRight: last.right, frozenRight: frozen.right, actionsLeft: actions.left }
  })
  expect(bounds.firstLeft).toBeGreaterThanOrEqual(bounds.frozenRight)
  expect(bounds.lastRight).toBeLessThanOrEqual(bounds.actionsLeft)
}

async function seedUpstream(page: Page, items = processItems, stopAtQc = false): Promise<Seed> {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  return page.evaluate(async ({ selectedItems, stopAtQc }) => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const records = await import('/src/data/fcs/post-finishing-records.ts')
    await records.ensurePostFinishingRecordState()
    const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
    const originalPlans = source.skus.map(sku => sku.plannedQty)
    // An isolated, explicitly authorized source-input fixture. It never seeds
    // processing, rechecks, outbounds or receipts and does not alter disk seeds.
    source.skus[0].plannedQty = 1000
    try {
      return await records.runPostFinishingCommand(() => {
        flow.resetPostFinishingFullFlow()
        const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
        const now = Date.parse('2026-10-19T08:00:00+08:00')
        const delivery = flow.registerPostFinishingFactoryReturn({
          productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId,
          returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: 'PARTIAL-FLOW-E2E-D1',
          quantities: source.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 1000 : 0 })),
          deliveryPersonName: '分项验收来源送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl],
          actor: actors.factoryCourier, nowMs: now,
        })
        flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, actor: actors.returnConfirmer,
          firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), nowMs: now + 1000 })
        const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs: now + 2000 })
        if (!stopAtQc) {
          flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: now + 3000 })
          flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actors.qcA, processItems: selectedItems,
            results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })), nowMs: now + 4000 })
        }
        const task = flow.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === qc.qcTaskId)
        return { taskId: task?.postTaskId || '', taskNo: task?.postTaskNo || '', deliveryId: delivery.deliveryId, qcTaskId: qc.qcTaskId, qcTaskNo: qc.qcTaskNo,
          skuId: source.skus[0].skuId, skuCode: source.skus[0].skuCode, barcode: source.skus[0].barcode }
      })
    } finally { source.skus.forEach((sku, index) => { sku.plannedQty = originalPlans[index] }) }
  }, { selectedItems: items, stopAtQc })
}

async function snapshot(page: Page, seed: Seed) {
  return page.evaluate(async value => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const records = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    await records.ensurePostFinishingRecordState()
    return {
      progress: flow.getPostFinishingProcessProgress(value.taskId),
      task: flow.getPostFinishingFullFlowPostTask(value.taskId),
      delivery: flow.getPostFinishingFactoryReturn(value.deliveryId),
      rechecks: flow.listPostFinishingFullFlowRecheckOrders().filter(row => row.postTaskId === value.taskId),
      outbounds: flow.listPostFinishingFullFlowOutboundOrders().filter(row => row.postTaskId === value.taskId),
      receipts: flow.listPostFinishingWarehouseReceipts(),
      stored: (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records,
    }
  }, seed)
}

async function detail(page: Page, seed: Seed) {
  if (page.url() === 'about:blank') await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(seed.taskId)}`)
  await expect(page.locator('[data-web-post-task]')).toBeVisible()
}

async function openEntry(page: Page, seed: Seed, processItem: string, quantity: number) {
  await page.locator(`${webPostAction('open-register')}[data-process-item="${processItem}"]`).click()
  await expect(page.locator('[data-post-entry-form]')).toBeVisible()
  await page.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill(String(quantity))
}

async function saveEntry(page: Page, seed: Seed, processItem: string, quantity: number) {
  await openEntry(page, seed, processItem, quantity)
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  await expect(page.locator('[data-web-post-task] [role="status"]')).toBeVisible()
}

async function submitUi(page: Page, seed: Seed, quantity: number) {
  await page.locator(webPostAction('open-recheck')).click()
  await page.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill(String(quantity))
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  const state = await snapshot(page, seed)
  return state.rechecks[state.rechecks.length - 1]
}

async function recheckUi(page: Page, seed: Seed, record: { recheckOrderNo: string; recheckOrderId: string }) {
  await page.evaluate(() => window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-RC-A'))
  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await page.locator('[data-post-finishing-recheck-action="open-claim"]').click()
  await page.locator('[data-recheck-claim-task-no]').fill(record.recheckOrderNo)
  await page.locator('[data-post-finishing-recheck-action="confirm-claim"]').click()
  await expect(page.locator(`[data-recheck-web-form="${record.recheckOrderId}"]`)).toBeVisible()
  await page.locator('[data-recheck-result-field="barcodeCorrect"]').first().selectOption('yes')
  await page.locator('[data-post-finishing-recheck-action="complete"]').click()
  await expect(page.locator('[data-post-finishing-recheck-action="complete"]')).toHaveCount(0)
  await expect(page.getByText('复检完成', { exact: true })).toBeVisible()
  const state = await snapshot(page, seed)
  return state.outbounds.find(row => row.recheckOrderId === record.recheckOrderId)!
}

async function receiveUi(page: Page, seed: Seed, outbound: { outboundOrderNo: string; outboundOrderId: string }) {
  await page.goto('/wls/finished-inbound')
  await expect(page.locator('[data-wls-finished-inbound-root]')).toBeVisible()
  await page.locator('[data-wls-finished-inbound-field="name"]').fill('分项验收成衣仓收货员')
  await page.locator('[data-wls-finished-inbound-field="keyword"]').fill(outbound.outboundOrderNo)
  await page.locator('[data-wls-finished-inbound-action="query"]').click()
  await page.locator(`[data-wls-finished-inbound-action="open"][data-order-no="${outbound.outboundOrderNo}"]`).click()
  const quantity = (await snapshot(page, seed)).outbounds.find(row => row.outboundOrderId === outbound.outboundOrderId)!.lines[0].outboundQty
  await page.locator(`[data-wls-finished-inbound-field="qty"][data-sku-id="${seed.skuId}"]`).fill(String(quantity))
  await page.locator('[data-wls-finished-inbound-action="save"]').click()
  await expect(page.locator('[data-finished-inbound-feedback]')).toContainText('实收已保存')
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
})

test('PFN-A01/A02/A17/A26/071/072：QC四项独立勾选、四列数量、键盘与代登记订正', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  let seed = await seedUpstream(page, [], true)
  await page.evaluate(() => window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-A'))
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await page.locator('[data-post-finishing-field="qc-task-input"]').fill(seed.qcTaskNo)
  await page.locator('[data-post-finishing-action="full-flow-claim-qc"]').click()
  await expect(page.locator('[data-qc-process-item]')).toHaveCount(4)
  for (const input of await page.locator('[data-qc-process-item]').all()) { await expect(input).toBeEnabled(); await input.uncheck() }
  await page.locator('[data-qc-process-item][value="包装"]').check()
  await expect(page.locator('[data-qc-process-item][value="熨烫"]')).not.toBeChecked()
  await page.locator('[data-qc-process-item][value="装扣子"]').check()
  await expect(page.locator('[data-qc-process-item][value="开扣眼"]')).not.toBeChecked()
  await evidence(page, info, 'qc-four-independent-items-button-pack')
  await page.locator('[data-post-finishing-action="full-flow-complete-qc"]').click()
  await expect(page.locator('[data-testid="post-finishing-qc-workbench-page"]')).toContainText('质检完成')
  const task = await page.evaluate(async qcTaskId => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return flow.listPostFinishingFullFlowPostTasks().find(row => row.qcTaskId === qcTaskId)!
  }, seed.qcTaskId)
  expect(task.processItems).toEqual(['装扣子', '包装'])
  seed = { ...seed, taskId: task.postTaskId, taskNo: task.postTaskNo }
  await page.goto('/fcs/craft/post-finishing/work-orders')
  const row = page.locator('tbody tr')
  await expect(row).toHaveCount(1)
  const headerKeys = await page.locator('thead th').evaluateAll(elements => elements.map(element => element.getAttribute('data-column-key')))
  for (const item of processItems) {
    const index = headerKeys.indexOf(`process-${item}`)
    expect(index).toBeGreaterThanOrEqual(0)
    await expect(row.locator('td').nth(index)).toContainText(['装扣子', '包装'].includes(item) ? '0 / 1000' : '不涉及')
  }
  await showProcessColumns(page)
  await evidence(page, info, 'list-zero-versus-not-applicable-1280')
  await page.locator('input[name="keyword"]').fill('不存在的加工单')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.locator('main')).toContainText('质检确认需要后道加工后自动生成后道加工单')
  await expect(page.locator('main')).toContainText('0 张')
  await page.locator('a[data-nav="/fcs/craft/post-finishing/work-orders"]').filter({ hasText: '重置' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await detail(page, seed)
  await expect(page.locator('[data-post-prototype-actor]')).toHaveCount(0)
  await expect(page.locator(webPostAction('switch-actor'))).toHaveCount(0)
  // QC's existing permission context is neither used as a finishing gate nor
  // silently rewritten by opening this complete-function detail page.
  expect(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-current-actor-v1'))).toBe('PF-USER-QC-A')
  await expect(page.locator(`${webPostAction('open-register')}[data-process-item="装扣子"]`)).toBeEnabled()
  await expect(page.locator('[data-post-process-card="开扣眼"]')).toContainText('不涉及')
  await expect(page.locator('[data-post-process-card="包装"]')).toContainText('前序尚未有可登记数量')
  await page.setViewportSize({ width: 1024, height: 768 })
  await openEntry(page, seed, '装扣子', 1)
  const form = page.locator('[data-post-entry-form]')
  await expect(form).toBeVisible()
  const quantity = form.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)
  await quantity.fill('')
  await form.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('不能留空')
  await expect(quantity).toHaveValue('')
  expect((await snapshot(page, seed)).progress.records).toHaveLength(0)
  await quantity.fill('1')
  const save = form.locator(webPostAction('save-entry'))
  const close = form.getByRole('button', { name: '关闭', exact: true })
  await save.focus()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(save).toBeFocused()
  await expect(form.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('1')
  await evidence(page, info, 'web-keyboard-tab-keeps-entry-and-focus-1024')
  await page.keyboard.press('Escape')
  await expect(form).toHaveCount(0)
  await expect(page.locator(`${webPostAction('open-register')}[data-process-item="装扣子"]`)).toBeFocused()
  const image = page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first()
  await image.focus()
  await page.keyboard.press('Enter')
  const imageDialog = page.locator('[data-post-image-overlay]')
  await expect(imageDialog).toBeVisible()
  await expect(imageDialog.getByRole('button', { name: '关闭图片', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(imageDialog).toHaveCount(0)
  await expect(image).toBeFocused()
  await openEntry(page, seed, '装扣子', 2)
  await page.locator('[data-post-entry-responsible]').selectOption('PF-USER-POST-MGR')
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  const delegated = await snapshot(page, seed)
  const original = delegated.progress.records[0]
  expect(original.responsible.actorId).toBe('PF-USER-POST-MGR')
  expect(original.recordedBy.actorId).toBe('PF-USER-POST')
  expect(original.quantities).toEqual([{ skuId: seed.skuId, quantity: 2 }])
  await expect(page.locator('[data-post-prototype-actor]')).toHaveCount(0)
  await expect(page.locator(webPostAction('switch-actor'))).toHaveCount(0)
  await expect(page.locator(`${webPostAction('open-correct')}[data-record-id="${original.recordId}"]`)).toBeEnabled()
  await page.locator(`${webPostAction('open-correct')}[data-record-id="${original.recordId}"]`).click()
  const correctionForm = page.locator('[data-post-entry-form]')
  await correctionForm.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill('1')
  await expect(correctionForm.locator('[data-post-entry-supervisor]')).toHaveValue('')
  await correctionForm.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('请选择本次实际核对主管')
  await expect(correctionForm.locator('[data-post-entry-quantity]')).toHaveValue('1')
  expect((await snapshot(page, seed)).progress.records).toEqual(delegated.progress.records)
  await correctionForm.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  await correctionForm.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('填写订正原因')
  await expect(correctionForm.locator('[data-post-entry-quantity]')).toHaveValue('1')
  expect((await snapshot(page, seed)).progress.records).toHaveLength(1)
  await correctionForm.locator('[data-post-entry-reason]').fill('主管复核代登记数量，原2件应为1件，保留原责任')
  await correctionForm.locator(webPostAction('save-entry')).click()
  await expect(correctionForm).toHaveCount(0)
  await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  const corrected = await snapshot(page, seed)
  expect(corrected.progress.processes.find(row => row.processItem === '装扣子')?.completedQty).toBe(1)
  expect(corrected.progress.records).toHaveLength(2)
  expect(corrected.progress.records.find(row => row.recordId === original.recordId)).toEqual(original)
  const amendment = corrected.progress.records.find(row => row.correctionOf === original.recordId)!
  expect(amendment.quantities).toEqual([{ skuId: seed.skuId, quantity: -1 }])
  expect(amendment.responsible.actorId).toBe('PF-USER-POST-MGR')
  expect(amendment.recordedBy.actorId).toBe('PF-USER-POST-MGR')
  expect(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-current-actor-v1'))).toBe('PF-USER-QC-A')
  writeFileSync(resolve(evidenceDirectory, 'web-delegation-correction-readback.json'), JSON.stringify(corrected, null, 2))
  await evidence(page, info, 'web-delegated-registration-and-supervisor-correction')

  // Direct access removes the prototype identity gate, while a real reserved
  // child still prevents a supervisor's amendment from taking its supply.
  await registerUi(page, seed, '包装', 1)
  await expect(page.locator(webPostAction('open-recheck'))).toBeEnabled()
  await submitUi(page, seed, 1)
  const occupied = await snapshot(page, seed)
  const packing = occupied.progress.records.find(row => row.processItem === '包装' && !row.correctionOf)!
  await page.locator(`${webPostAction('open-correct')}[data-record-id="${packing.recordId}"]`).click()
  const blockedCorrection = page.locator('[data-post-entry-form]')
  await expect(blockedCorrection.locator('[data-post-entry-supervisor]')).toHaveValue('')
  await blockedCorrection.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  await blockedCorrection.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill('0')
  await blockedCorrection.locator('[data-post-entry-reason]').fill('核对已交复检占用，尝试减少包装原记录必须阻断')
  await blockedCorrection.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('订正会破坏前后序或已交复检数量')
  await expect(blockedCorrection.locator('[data-post-entry-supervisor]')).toHaveValue('PF-USER-POST-MGR')
  await expect(blockedCorrection.locator('[data-post-entry-quantity]')).toHaveValue('0')
  await expect(blockedCorrection.locator('[data-post-entry-reason]')).toHaveValue('核对已交复检占用，尝试减少包装原记录必须阻断')
  const refused = await snapshot(page, seed)
  expect(refused.progress.records).toEqual(occupied.progress.records)
  expect(refused.rechecks).toEqual(occupied.rechecks)
  expect(refused.stored).toEqual(occupied.stored)
  await evidence(page, info, 'web-direct-correction-reservation-protected')
})

test('PFN-A04/A08-A13/A17-A18/A29：D1实际Web/PDA分项登记及100/100/800多次复检出货闭环', async ({ page }, info) => {
  test.setTimeout(180000)
  await page.setViewportSize({ width: 1366, height: 768 })
  const seed = await seedUpstream(page)
  await detail(page, seed)
  for (const [index, quantity] of [500, 300, 200, 100].entries()) await saveEntry(page, seed, processItems[index], quantity)
  let state = await snapshot(page, seed)
  expect(state.progress.processes.map(row => row.completedQty)).toEqual([500, 300, 200, 100])
  expect(state.progress.totalCompletedQty).toBe(100)
  await evidence(page, info, 'd1-four-process-500-300-200-100')
  await page.goto('/fcs/craft/post-finishing/work-orders')
  for (const item of processItems) await expect(page.getByRole('columnheader', { name: `${item}完成`, exact: true })).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBe(1)
  await showProcessColumns(page)
  await evidence(page, info, 'd1-parent-list-four-quantities')
  await detail(page, seed)
  const first = await submitUi(page, seed, 100)
  expect((await snapshot(page, seed)).progress.availableForRecheckQty).toBe(0)
  const firstOutbound = await recheckUi(page, seed, first)
  await receiveUi(page, seed, firstOutbound)
  expect((await snapshot(page, seed)).delivery?.status).not.toBe('已完成')

  await page.evaluate(() => window.localStorage.setItem('fcs_pda_session', JSON.stringify({
    userId: 'F090_operator', loginId: 'F090_operator', userName: '全能力测试工厂_操作工', roleId: 'ROLE_OPERATOR',
    factoryId: 'F090', factoryName: '全能力测试工厂', loggedAt: '2026-10-19 08:00:00',
  })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.taskNo)}`)
  await expect(page.locator('[data-pda-post-task]')).toBeVisible()
  await page.locator('[data-post-process="包装"] > summary').click()
  await page.locator(`[data-post-process="包装"] [data-post-process-line="${seed.skuId}"] [data-post-process-qty]`).fill('100')
  await page.locator('[data-pda-post-action="save-process-completion"][data-process-item="包装"]').click()
  await expect(page.locator('[data-post-process="包装"]')).toContainText('200')
  // Finish the remaining work before the second handover. This freezes the
  // exact A29 boundary: F=1000, only 100 reserved/received and 900 still available.
  await page.setViewportSize({ width: 1280, height: 720 })
  await detail(page, seed)
  for (const [index, quantity] of [500, 700, 800, 800].entries()) await saveEntry(page, seed, processItems[index], quantity)
  state = await snapshot(page, seed)
  expect(state.progress.processes.map(row => row.completedQty)).toEqual([1000, 1000, 1000, 1000])
  expect(state.task?.status).toBe('后道完成')
  expect(state.progress.totalReservedQty).toBe(100)
  expect(state.progress.availableForRecheckQty).toBe(900)
  expect(state.receipts.reduce((sum, receipt) => sum + receipt.lines.reduce((qty, line) => qty + line.receivedQty, 0), 0)).toBe(100)
  expect(state.delivery?.status).not.toBe('已完成')
  await evidence(page, info, 'd1-post-completed-with-900-unsubmitted-after-first-receipt')
  await page.goto(`/fcs/craft/post-finishing/tasks?keyword=${encodeURIComponent(state.delivery!.productionOrderNo)}`)
  await page.locator(`[data-post-finishing-tasks-action="view-return-records"][data-production-order-no="${state.delivery!.productionOrderNo}"]`).click()
  const parent = page.getByTestId('post-production-task-return-dialog').locator('tbody tr').filter({ hasText: state.delivery!.deliveryOrderNo })
  await expect(parent).toHaveCount(1)
  await expect(parent.locator('td').nth(4)).not.toHaveText('已完成')
  await evidence(page, info, 'd1-parent-return-remains-open-after-100-received')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.taskNo)}`)
  await expect(page.locator('[data-pda-post-task]')).toBeVisible()
  const handover = page.locator('[data-post-recheck-form]')
  if ((await handover.getAttribute('open')) === null) await handover.locator(':scope > summary').click()
  await page.locator(`[data-post-recheck-line="${seed.skuId}"] [data-post-recheck-qty]`).fill('100')
  await page.locator('[data-pda-post-action="submit-for-recheck"]').click()
  await expect.poll(async () => (await snapshot(page, seed)).rechecks.length).toBe(2)
  state = await snapshot(page, seed)
  const second = state.rechecks[1]
  const pdaRecord = state.progress.records.find(row => row.recordedBy.actorId === 'F090_operator')
  expect(pdaRecord?.recordedBy.actorName).toBe('全能力测试工厂_操作工')
  expect(pdaRecord?.processItem).toBe('包装')
  expect(pdaRecord?.quantities).toEqual([{ skuId: seed.skuId, quantity: 100 }])
  await evidence(page, info, 'd1-pda-second-processing-and-recheck')
  await page.locator(`[data-pda-post-action="open-recheck"][data-recheck-no="${second.recheckOrderNo}"]`).click()
  await expect(page.locator(`[data-pda-recheck-task="${second.recheckOrderId}"]`)).toBeVisible()
  await page.locator('[data-pda-post-action="claim-recheck"]').click()
  await expect(page.locator('[data-recheck-barcode-input]')).toBeVisible()
  await page.locator('[data-recheck-barcode-input]').fill('WRONG-BARCODE')
  await page.locator('[data-pda-post-action="scan-recheck-barcode"]').click()
  await expect(page.locator('[data-pda-recheck-task]')).toContainText('错误待重贴')
  await page.locator('[data-pda-post-action="complete-recheck"]').click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('条码')
  expect((await snapshot(page, seed)).outbounds).toHaveLength(1)
  await page.locator('[data-pda-post-action="mark-relabeled"]').click()
  await expect(page.locator('[data-pda-recheck-task]')).toContainText('已重贴待复扫')
  await page.locator('[data-pda-post-action="complete-recheck"]').click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('条码')
  await page.locator('[data-recheck-barcode-input]').fill(seed.barcode)
  await page.locator('[data-pda-post-action="scan-recheck-barcode"]').click()
  await expect(page.locator('[data-pda-recheck-task]')).toContainText('条码状态：正确')
  await page.locator('[data-pda-post-action="complete-recheck"]').click()
  await expect(page.locator('[data-pda-post-action="complete-recheck"]')).toHaveCount(0)
  await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  await evidence(page, info, 'd1-pda-second-recheck-rescanned-completed')
  state = await snapshot(page, seed)
  const secondOutbound = state.outbounds.find(row => row.recheckOrderId === second.recheckOrderId)!
  expect(secondOutbound).toBeTruthy()
  await page.setViewportSize({ width: 1280, height: 720 })

  await detail(page, seed)
  state = await snapshot(page, seed)
  expect(state.task?.status).toBe('后道完成')
  expect(state.progress.availableForRecheckQty).toBe(800)
  expect(state.delivery?.status).not.toBe('已完成')
  await evidence(page, info, 'd1-post-completed-with-800-unsubmitted')
  const third = await submitUi(page, seed, 800)
  const thirdOutbound = await recheckUi(page, seed, third)
  await receiveUi(page, seed, thirdOutbound)
  state = await snapshot(page, seed)
  expect(state.delivery?.status).not.toBe('已完成')
  expect(state.outbounds.find(row => row.outboundOrderId === secondOutbound.outboundOrderId)?.status).toBe('待仓库接收')
  await receiveUi(page, seed, secondOutbound)
  state = await snapshot(page, seed)
  expect(state.rechecks.map(row => row.lines.reduce((sum, line) => sum + line.expectedQty, 0))).toEqual([100, 100, 800])
  expect(state.outbounds).toHaveLength(3)
  expect(state.receipts).toHaveLength(3)
  expect(state.delivery?.status).toBe('已完成')
  expect(state.progress.totalReservedQty).toBe(1000)
  expect(state.progress.availableForRecheckQty).toBe(0)
  await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(thirdOutbound.outboundOrderId)}`)
  await expect(page.locator('main')).toContainText(thirdOutbound.outboundOrderNo)
  await page.reload()
  await expect(page.locator('main')).toContainText(thirdOutbound.outboundOrderNo)
  expect((await snapshot(page, seed)).outbounds.find(row => row.outboundOrderId === thirdOutbound.outboundOrderId)?.lines[0].outboundQty).toBe(800)
  await evidence(page, info, 'd1-third-outbound-direct-reload-800')
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(resolve(evidenceDirectory, 'd1-final-persistent-readback.json'), JSON.stringify(state, null, 2))
})

for (const failureKind of ['QuotaExceededError', 'AbortError'] as const) test(`PFN-A19：${failureKind}时本次加工不落半套、输入保留且恢复后同意图只保存一次`, async ({ page }, info) => {
  const seed = await seedUpstream(page, ['开扣眼'])
  await detail(page, seed)
  await openEntry(page, seed, '开扣眼', 7)
  const before = (await snapshot(page, seed)).stored
  await page.evaluate(kind => {
    const original = IDBObjectStore.prototype.put
    ;(window as any).__partialOriginalPut = original
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (value.collection === 'flow/processCompletions') throw new DOMException('验收加工保存故障', kind)
      return original.call(this, value, ...args)
    }
  }, failureKind)
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toBeVisible()
  await expect(page.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('7')
  const failed = await snapshot(page, seed)
  expect(failed.stored).toEqual(before)
  expect(failed.progress.records).toHaveLength(0)
  expect(failed.progress.totalCompletedQty).toBe(0)
  await evidence(page, info, `save-failure-${failureKind}-input-retained`)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__partialOriginalPut; delete (window as any).__partialOriginalPut })
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-web-post-task]')).toBeVisible()
  const recovered = await snapshot(page, seed)
  expect(recovered.progress.records).toHaveLength(1)
  expect(recovered.progress.totalCompletedQty).toBe(7)
})

test('PFN-A19：两个标签同revision竞争时第二次拒绝，保留输入且不超实物量', async ({ page, context }, info) => {
  const seed = await seedUpstream(page, ['包装'])
  await detail(page, seed)
  const second = await context.newPage()
  second.on('dialog', dialog => dialog.accept())
  await detail(second, seed)
  await openEntry(page, seed, '包装', 600)
  await openEntry(second, seed, '包装', 600)
  await page.locator(webPostAction('save-entry')).click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  await second.locator(webPostAction('save-entry')).click()
  await expect(second.locator('[data-post-finishing-action-error]')).toContainText(/变化|重新读取|冲突/)
  await expect(second.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('600')
  const state = await snapshot(page, seed)
  expect(state.progress.totalCompletedQty).toBe(600)
  expect(state.progress.records).toHaveLength(1)
  await evidence(second, info, 'two-tab-revision-conflict-input-retained')
  await second.close()
})

test('PFN-067样本：五次完整增量保存及五次预热后刷新加载，含持久读回', async ({ page }, info) => {
  test.setTimeout(120000)
  const seed = await seedUpstream(page, ['开扣眼'])
  await detail(page, seed)
  const saves: number[] = []
  for (let index = 0; index < 5; index += 1) {
    await openEntry(page, seed, '开扣眼', 1)
    await page.evaluate(() => { (window as any).__partialStart = performance.now() })
    await page.locator(webPostAction('save-entry')).click()
    await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
    const result = await snapshot(page, seed)
    expect(result.progress.totalCompletedQty).toBe(index + 1)
    expect(result.progress.records).toHaveLength(index + 1)
    saves.push(await page.evaluate(() => performance.now() - (window as any).__partialStart))
  }
  const reloads: number[] = []
  await page.reload()
  await expect(page.locator('[data-web-post-task]')).toBeVisible()
  for (let index = 0; index < 5; index += 1) {
    await page.reload()
    await expect(page.locator('[data-web-post-task]')).toBeVisible()
    expect((await snapshot(page, seed)).progress.totalCompletedQty).toBe(5)
    reloads.push(await page.evaluate(() => performance.now()))
  }
  const result = { capturedAt: new Date().toISOString(), baseURL: test.info().project.use.baseURL,
    environment: 'this worktree Vite dev server; warmed D1 1-SKU source; not D10 or production/physical-device acceptance',
    completion: 'UI success and persisted record readback', samples: { processCompletionSaveMs: saves, warmedDetailReloadMs: reloads } }
  mkdirSync(evidenceDirectory, { recursive: true })
  const path = resolve(evidenceDirectory, 'performance-samples.json')
  writeFileSync(path, JSON.stringify(result, null, 2))
  await info.attach('performance-samples', { path, contentType: 'application/json' })
  expect(saves.every(value => value <= 1000), `完整加工保存样本 ${saves.join(', ')}`).toBe(true)
  expect(reloads.every(value => value <= 1000), `预热后详情刷新样本 ${reloads.join(', ')}`).toBe(true)
})
