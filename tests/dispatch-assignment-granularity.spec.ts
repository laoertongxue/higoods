import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type Locator } from '@playwright/test'

const evidenceDir = path.resolve('output/playwright/dispatch-assignment-granularity-20261010')
const samples: { action: string; durationMs: number; scenario: string }[] = []
const dialog = (page: Page) => page.locator('[data-unified-dispatch-overlay] section').first()

async function measureNavigation(page: Page, action: string, scenario: string) {
  const durationMs = await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-unified-dispatch-page] img')].map(img => img.decode()))
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    return performance.now()
  })
  samples.push({ action, scenario, durationMs })
  // Source-server timings are diagnostics. Production preview timings have their own mandatory gate.
  if (process.env.DISPATCH_PERF_ENFORCE === 'true') expect(durationMs, `${action} ${scenario}`).toBeLessThanOrEqual(1000)
}

async function prepare(page: Page, merged: boolean) {
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
  await measureNavigation(page, 'first-visit', merged ? 'merged' : 'sewing')
  const taskId = await page.evaluate(async isMerged => {
    const release = await import('/src/data/fcs/cut-piece-release.ts')
    const result = await release.saveCutPieceReleaseAvailableQtyAction({
      productionOrderId: 'PO-202603-0002',
      basisMatrixVersion: release.getCutPieceReleaseSummaryForProductionOrder('PO-202603-0002')!.latestMatrixVersion,
      basisTargetVersion: release.listCutPieceReleaseTargetSnapshots('PO-202603-0002').at(-1)!.matrixVersion,
      releaseQtyByColorSize: { 'Grey::S': 500, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 },
      riskReason: '隔离浏览器验收：裁床主管确认全部目标裁片可放行。', confirmedBy: '验收裁床主管', confirmedAt: '2026-10-10 08:00:00',
    })
    if (!result.ok) throw new Error(result.message)
    if (!isMerged) return 'TASKGEN-202603-0002-002__ORDER'
    const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
    const { saveProductionSourceAction } = await import('/src/data/fcs/production-context-actions.ts')
    return saveProductionSourceAction({ id: 'TEST-MERGE-SEW-IRON', intent: '粒度验收创建合并任务', action: () => {
      const merged = runtime.createFixedMergedTask(['TASKGEN-202603-0002-002__ORDER', 'TASKGEN-202603-0002-009__ORDER'], '粒度验收')
      if (!merged) throw new Error('合并夹具创建失败')
      return merged.taskId
    } })
  }, merged)
  await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(taskId.replace('__ORDER', ''))}`)
  await expect(page.locator(`[data-unified-action="open-direct"][data-task-id="${taskId}"]`)).toBeVisible()
  await measureNavigation(page, 'keyword-navigation', merged ? 'merged' : 'sewing')
  return taskId
}

// Start with the real click event; finish after the asserted DOM result and two animation frames.
// For save, include an independent IndexedDB read before ending the sample.
async function measure(page: Page, target: Locator, action: string, scenario: string, complete: () => Promise<void>, persisted = false) {
  const profiler = process.env.DISPATCH_PROFILE === 'true' && action === 'quote-save' ? await page.context().newCDPSession(page) : null
  if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start') }
  await page.evaluate(() => document.addEventListener('click', () => {
    (window as any).__dispatchEventStarted = performance.now()
  }, { once: true, capture: true }))
  await target.click()
  await complete()
  const durationMs = await page.evaluate(async readBack => {
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-unified-dispatch-overlay] img')].map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('识别图片未就绪') }))
    if (readBack) {
      const { readCuttingRecords } = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      await readCuttingRecords()
    }
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    return performance.now() - (window as any).__dispatchEventStarted
  }, persisted)
  samples.push({ action, scenario, durationMs })
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop')
    fs.writeFileSync(path.join(evidenceDir, `quote-profile-${scenario}.json`), JSON.stringify(profile))
    console.log(profile.nodes.filter((node: any) => node.hitCount).sort((a: any, b: any) => b.hitCount - a.hitCount).slice(0, 15).map((node: any) => ({ name: node.callFrame.functionName, url: node.callFrame.url, hits: node.hitCount })))
  }
  if (process.env.DISPATCH_PERF_ENFORCE === 'true') expect(durationMs, `${action} ${scenario}`).toBeLessThanOrEqual(1000)
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, `environment-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ browser: browser.version(), baseURL: process.env.PLAYWRIGHT_BASE_URL, preview: process.env.CUTTING_E2E_USE_PREVIEW === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, worktree: process.cwd() }, null, 2))
})
test.afterAll(() => fs.writeFileSync(path.join(evidenceDir, `performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(samples, null, 2)))

for (const mode of ['DIRECT', 'BIDDING'] as const) for (let run = 0; run < 5; run++) {
  const merged = run % 2 === 1
  const scenario = `${mode}-${merged ? 'merged' : 'sewing'}-${run + 1}`
  test(`${scenario} 完整 SKU 分配保存、刷新与下游范围一致`, async ({ page }) => {
    await page.setViewportSize(run === 4 ? { width: 1024, height: 768 } : run === 3 ? { width: 1280, height: 720 } : { width: 1366, height: 768 })
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    const taskId = await prepare(page, merged)
    await page.evaluate(() => { (window as any).__listNode = document.querySelector('[data-unified-dispatch-page] table') })
    await measure(page, page.locator(`[data-unified-action="${mode === 'DIRECT' ? 'open-direct' : 'open-bidding'}"][data-task-id="${taskId}"]`), 'open', scenario,
      async () => { await expect(dialog(page)).toBeVisible() })
    if (mode === 'DIRECT') await dialog(page).locator('[data-unified-field="distributionMode"][value="FREE"]').check()
    await expect(dialog(page).locator('[data-unified-sku]')).toHaveCount(4)
    for (const code of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) {
      await measure(page, dialog(page).locator(`[data-unified-sku="${code}"]`), 'select', scenario,
        async () => { await expect(dialog(page).locator(`[data-unified-sku="${code}"]`)).not.toBeChecked() })
    }
    await expect(dialog(page)).toContainText('500件')
    if (mode === 'DIRECT') {
      const factoryId = await dialog(page).locator('[data-unified-field="factoryId"] option').evaluateAll(nodes => (nodes.find(n => (n as HTMLOptionElement).value) as HTMLOptionElement)?.value)
      expect(factoryId).toBeTruthy()
      await dialog(page).locator('[data-unified-field="factoryId"]').selectOption(factoryId!)
    } else {
      await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200')
      await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2099-10-10T18:00')
    }
    await measure(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), 'confirm', scenario,
      async () => { await expect(dialog(page)).toContainText(mode === 'DIRECT' ? '二次确认派单价格' : '二次确认发起竞价') })
    await expect(dialog(page)).toContainText('500件')
    expect(await page.evaluate(() => (window as any).__listNode.isConnected)).toBe(true)
    await dialog(page).screenshot({ path: path.join(evidenceDir, `${scenario}-confirmed.png`) })
    await measure(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), `save-${mode}`, scenario,
      async () => { await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0) }, true)
    const read = async () => page.evaluate(async id => {
      const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
      const assignments = await import('/src/data/fcs/effective-task-assignments.ts')
      const tenders = await import('/src/data/fcs/runtime-task-tenders.ts')
      const tasks = runtime.listRuntimeTaskSplitGroupsByOrder('PO-202603-0002').find(g => g.sourceTaskId === id)!.resultTasks.map(result => runtime.getRuntimeTaskById(result.taskId)!)
      return { source: runtime.getRuntimeTaskById(id)!.executionEnabled, tasks: tasks.map(t => ({ id: t.taskId, qty: t.scopeQty, status: t.assignmentStatus, codes: t.scopeSkuLines.map(s => s.skuCode), merged: t.mergedTaskType, qr: t.taskQrValue, processes: t.coveredProcesses, sources: t.mergeSourceTaskIds })), assignments: tasks.flatMap(t => assignments.listCurrentEffectiveTaskAssignments(t.taskId)).map(a => ({ id: a.assignmentId, qty: a.assignedQty, codes: a.skuLines.map(s => s.skuCode) })), tenders: tenders.listRuntimeTaskTenderRecords().filter(t => tasks.some(task => task.taskId === t.taskId)).map(t => ({ id: t.tenderId, qty: t.taskSnapshot.qty, codes: t.taskSnapshot.skuLines.map(s => s.skuCode), taskId: t.taskId })) }
    }, taskId)
    const before = await read()
    expect(before.source).toBe(false)
    expect(before.tasks).toHaveLength(2)
    expect(before.tasks.map(t => t.qty).sort((a, b) => a - b)).toEqual([500, 2000])
    expect(before.tasks.find(t => t.qty === 2000)?.status).toBe('UNASSIGNED')
    const selected = before.tasks.find(t => t.qty === 500)!
    expect(selected.codes).toEqual(['SKU-005-S-GRY'])
    if (merged) expect(selected.merged).toBe('SEWING_IRON_PACK')
    if (mode === 'DIRECT') expect(before.assignments).toEqual([expect.objectContaining({ qty: 500, codes: ['SKU-005-S-GRY'] })])
    else expect(before.tenders).toEqual([expect.objectContaining({ qty: 500, codes: ['SKU-005-S-GRY'] })])
    await page.reload()
    await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
    expect(await read()).toEqual(before)
    await measureNavigation(page, 'refresh-readback', scenario)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('裁剪、特种、毛织、烫包和三工序合并均不显示明细分配入口', async ({ page }) => {
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()
  const ids = await page.evaluate(async () => {
    const { listRuntimeProcessTasks } = await import('/src/data/fcs/runtime-process-tasks.ts')
    const { classifyTaskFulfillmentPolicy } = await import('/src/data/fcs/task-fulfillment-policy.ts')
    const { isAssignableProductionExecutionTask } = await import('/src/data/fcs/merged-production-task.ts')
    const tasks = listRuntimeProcessTasks().filter(t => isAssignableProductionExecutionTask(t) && t.assignmentStatus === 'UNASSIGNED' && classifyTaskFulfillmentPolicy(t).assignmentGranularity === 'ORDER')
    return ['CUTTING', 'SPECIAL_CRAFT', 'WOOL', 'IRON_PACK', 'CUTTING_SEWING_IRON_PACK'].map(code => tasks.find(t => {
      const policy = classifyTaskFulfillmentPolicy(t)
      return (policy.mergedTaskType || policy.normalizedProcessCodes[0]) === code
    })?.taskId).filter((id): id is string => Boolean(id))
  })
  expect(ids.length).toBeGreaterThan(3)
  for (const id of ids) {
    await page.goto(`/fcs/dispatch/workbench?keyword=${encodeURIComponent(id.replace('__ORDER', ''))}`)
    await expect(page.locator(`[data-unified-action="open-detail"][data-task-id="${id}"]`)).toBeVisible()
    for (const action of ['open-direct', 'open-bidding']) {
      const button = page.locator(`[data-unified-action="${action}"][data-task-id="${id}"]`)
      if (await button.count() === 0) {
        // 三工序合并的现有演示配料不齐：验证真实阻断，不绕过前置条件。
        const readiness = await page.evaluate(async taskId => {
          const { getRuntimeTaskById } = await import('/src/data/fcs/runtime-process-tasks.ts')
          const { getSewingAssignmentReadiness } = await import('/src/data/fcs/sewing-assignment-readiness.ts')
          return getSewingAssignmentReadiness(getRuntimeTaskById(taskId)!).ready
        }, id)
        expect(readiness).toBe(false)
        continue
      }
      await button.click()
      await expect(dialog(page).locator('[data-unified-sku], [data-unified-bag-group]')).toHaveCount(0)
      await expect(dialog(page).locator(action === 'open-direct' ? '[data-unified-whole-task-direct-scope]' : '[data-unified-whole-task-tender-scope]')).toBeVisible()
      await dialog(page).getByRole('button', { name: '取消', exact: true }).click()
    }
  }
})

for (let run = 0; run < 5; run++) test(`竞价保存事务中止-${run + 1} 保留输入，分区与竞价均不落盘，重试后一次成功`, async ({ page }) => {
  const taskId = await prepare(page, true)
  await page.locator(`[data-unified-action="open-bidding"][data-task-id="${taskId}"]`).click()
  for (const code of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await dialog(page).locator(`[data-unified-sku="${code}"]`).uncheck()
  await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200')
  await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2099-10-10T18:00')
  await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    ;(window as any).__restoreDispatchTransaction = () => { IDBDatabase.prototype.transaction = original }
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      const tx = Reflect.apply(original, this, args)
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort())
      return tx
    }
  })
  await measure(page, dialog(page).locator('[data-unified-action="confirm-dispatch"]'), 'tender-abort', `merged-abort-${run + 1}`, async () => {
    await expect(dialog(page)).toContainText(/未保存|中止|失败/)
    await expect(dialog(page)).toContainText('500件')
  }, true)
  const assertClean = async () => {
    expect(await page.evaluate(async id => {
      const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
      const tender = await import('/src/data/fcs/runtime-task-tenders.ts')
      return { splits: runtime.listRuntimeTaskSplitGroupsByOrder('PO-202603-0002').filter(g => g.sourceTaskId === id).length, tenders: tender.listRuntimeTaskTenderRecords().filter(t => t.taskId === id).length, status: runtime.getRuntimeTaskById(id)!.assignmentStatus }
    }, taskId)).toEqual({ splits: 0, tenders: 0, status: 'UNASSIGNED' })
  }
  await assertClean()
  await page.evaluate(() => (window as any).__restoreDispatchTransaction())
  await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
  await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0)
  await page.reload()
  expect(await page.evaluate(async () => {
    const runtime = await import('/src/data/fcs/runtime-process-tasks.ts')
    const tender = await import('/src/data/fcs/runtime-task-tenders.ts')
    return { splits: runtime.listRuntimeTaskSplitGroupsByOrder('PO-202603-0002').length, qty: tender.listRuntimeTaskTenderRecords().filter(t => t.taskSnapshot.productionOrderId === 'PO-202603-0002').map(t => t.taskSnapshot.qty) }
  })).toEqual({ splits: 1, qty: [500] })
})

for (let run = 0; run < 5; run++) {
const merged = run % 2 === 1
test(`${merged ? '车缝加烫包' : '独立车缝'}-${run + 1} 所选范围贯通 PDA 报价、定标和任务单`, async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 10, 9, 0, 0))
  const taskId = await prepare(page, merged)
  await page.locator(`[data-unified-action="open-bidding"][data-task-id="${taskId}"]`).click()
  for (const code of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await dialog(page).locator(`[data-unified-sku="${code}"]`).uncheck()
  await dialog(page).locator('[data-unified-field="tenderMinPrice"]').fill('1200')
  await dialog(page).locator('[data-unified-field="tenderDeadline"]').fill('2026-10-10T10:00')
  await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
  await dialog(page).locator('[data-unified-action="confirm-dispatch"]').click()
  await expect(page.locator('[data-unified-dispatch-overlay] section')).toHaveCount(0)
  const fact = await page.evaluate(async () => {
    const tenders = await import('/src/data/fcs/runtime-task-tenders.ts')
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const tender = tenders.listRuntimeTaskTenderRecords().find(t => t.taskSnapshot.productionOrderId === 'PO-202603-0002')!
    const factory = tender.factoryPool[0]!
    pda.ensureFactoryPdaSeed(factory.factoryId, factory.factoryName)
    const user = pda.listFactoryPdaUsers(factory.factoryId).find(u => u.roleId === 'ROLE_ADMIN') || pda.listFactoryPdaUsers(factory.factoryId)[0]!
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/pda/notify')
    return { tenderId: tender.tenderId, taskId: tender.taskId, factoryId: factory.factoryId, price: tender.standardPrice }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  const todo = page.locator('[data-pda-todo-card-id]').filter({ hasText: fact.taskId }).first()
  await expect(todo).toContainText('1 个 SKU')
  await todo.getByRole('button', { name: '去报价' }).click()
  const quote = page.getByRole('heading', { name: '立即报价' }).locator('xpath=ancestor::article[1]')
  await expect(quote).toContainText('1 个 SKU，共 500 件')
  await quote.evaluate(node => { (window as any).__quoteDialogBeforeInput = node })
  await quote.locator('[data-pda-tr-field="quoteAmount"]').fill(String(fact.price))
  await quote.locator('[data-pda-tr-field="deliveryDays"]').fill('9')
  await expect(quote.locator('[data-pda-tr-field="quoteAmount"]')).toHaveValue(String(fact.price))
  expect(await page.evaluate(() => (window as any).__quoteDialogBeforeInput.isConnected)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await quote.screenshot({ path: path.join(evidenceDir, `pda-quote-${run + 1}.png`) })
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    ;(window as any).__restoreQuoteTransaction = () => { IDBDatabase.prototype.transaction = original }
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      const tx = Reflect.apply(original, this, args)
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort())
      return tx
    }
  })
  await measure(page, quote.getByRole('button', { name: '确认提交报价' }), 'quote-abort', `pda-${run + 1}`, async () => {
    await expect(page.locator('#pda-task-receive-toast-root')).toContainText(/未保存|中止|失败/)
    await expect(quote.locator('[data-pda-tr-field="quoteAmount"]')).toHaveValue(String(fact.price))
    expect(await page.evaluate(async id => {
      const { getRuntimeTaskTenderRecordByTenderId } = await import('/src/data/fcs/runtime-task-tenders.ts')
      return getRuntimeTaskTenderRecordByTenderId(id)?.quotes.length
    }, fact.tenderId)).toBe(0)
  }, true)
  await page.evaluate(() => (window as any).__restoreQuoteTransaction())
  await measure(page, quote.getByRole('button', { name: '确认提交报价' }), 'quote-save', `pda-${run + 1}`, async () => {
    await expect(page.locator('#pda-task-receive-toast-root')).toContainText('报价提交成功')
  }, true)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.clock.setFixedTime(new Date(2026, 9, 10, 11, 0, 0))
  await page.goto(`/fcs/dispatch/tenders?tenderId=${encodeURIComponent(fact.tenderId)}`)
  const drawer = page.getByRole('heading', { name: '招标单详情' }).locator('xpath=ancestor::section[1]')
  await expect(drawer).toContainText('待定标')
  expect(await page.evaluate(async id => {
    const { getRuntimeTaskTenderRecordByTenderId } = await import('/src/data/fcs/runtime-task-tenders.ts')
    return getRuntimeTaskTenderRecordByTenderId(id)?.quotes.length
  }, fact.tenderId)).toBe(1)
  await expect(drawer).toContainText('500')
  await drawer.locator(`[data-tender-action="select-award-factory"][data-factory-id="${fact.factoryId}"]`).click()
  for (const field of ['view.awardRiskConfirmed', 'view.awardSupervisorAssigned']) {
    const checkbox = drawer.locator(`[data-tender-field="${field}"]`)
    if (await checkbox.count()) await checkbox.check()
  }
  await drawer.getByRole('button', { name: '确认定标', exact: true }).click()
  await drawer.getByRole('button', { name: '二次确认并冻结中标价' }).click()
  await expect(page.getByRole('heading', { name: '中标分配及合同已生成' })).toBeVisible()
  await page.reload()
  const assignment = await page.evaluate(async id => {
    const { listCurrentEffectiveTaskAssignments } = await import('/src/data/fcs/effective-task-assignments.ts')
    const { listProductionContracts } = await import('/src/data/fcs/production-contracts.ts')
    const a = listCurrentEffectiveTaskAssignments(id)[0]!
    return { id: a.assignmentId, qty: a.assignedQty, codes: a.skuLines.map(s => s.skuCode), contractQty: listProductionContracts({ runtimeTaskId: id }).find(c => c.status === 'EFFECTIVE')!.assignedQty }
  }, fact.taskId)
  expect(assignment).toEqual(expect.objectContaining({ qty: 500, codes: ['SKU-005-S-GRY'], contractQty: 500 }))
  await page.goto(`/fcs/print/preview?documentType=DISPATCH_TASK_SHEET&sourceType=EFFECTIVE_TASK_ASSIGNMENT&sourceId=${encodeURIComponent(assignment.id)}`)
  const scope = page.locator('[data-task-sheet-section="task-sku-scope"]')
  await expect(scope).toContainText('SKU-005-S-GRY')
  await expect(scope).not.toContainText('SKU-005-M-GRY')
  await expect(scope).toContainText('500')
  await expect(page.locator('[data-real-qr] svg')).toBeVisible()
  await page.screenshot({ path: path.join(evidenceDir, `${merged ? 'merged' : 'sewing'}-selected-task-sheet.png`), fullPage: true })
})
}
