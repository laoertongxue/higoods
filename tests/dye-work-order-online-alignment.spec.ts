import { expect, test, type Page } from '@playwright/test'

const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([])
})

async function clickAndMeasure(
  locator: import('@playwright/test').Locator,
  promptAnswers: string[] = [],
  expectedSelector = '',
  expectedText = '',
): Promise<number> {
  return locator.evaluate(async (node, input) => {
    const originalPrompt = window.prompt
    let index = 0
    let firstPromptAt: number | null = null
    window.prompt = () => {
      firstPromptAt ??= performance.now()
      return input.promptAnswers[index++] ?? ''
    }
    const startedAt = performance.now()
    ;(node as HTMLButtonElement).click()
    const hasExpectedState = () => {
      if (!input.expectedText) return true
      const scope = input.expectedSelector ? document.querySelector(input.expectedSelector) : document.body
      return scope?.textContent?.includes(input.expectedText) ?? false
    }
    if (!hasExpectedState()) {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          observer.disconnect()
          reject(new Error(`按钮点击后未出现：${input.expectedText}`))
        }, 2_000)
        const observer = new MutationObserver(() => {
          if (!hasExpectedState()) return
          window.clearTimeout(timeoutId)
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      })
    }
    if (!input.expectedText && input.promptAnswers.length > 0 && firstPromptAt === null) {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => reject(new Error('按钮点击后未打开输入确认')), 2_000)
        const check = () => {
          if (firstPromptAt !== null) {
            window.clearTimeout(timeoutId)
            resolve()
            return
          }
          window.setTimeout(check, 0)
        }
        check()
      })
    }
    const elapsed = (firstPromptAt ?? performance.now()) - startedAt
    window.prompt = originalPrompt
    return elapsed
  }, { promptAnswers, expectedSelector, expectedText })
}

async function openList(page: Page): Promise<void> {
  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单', exact: true })).toBeVisible()
}

async function navigateInApp(page: Page, href: string): Promise<void> {
  await page.evaluate((path) => {
    void import(/* @vite-ignore */ '/src/state/store.ts').then((store) => store.appStore.navigate(path))
  }, href)
  await page.waitForURL((url) => `${url.pathname}${url.search}` === href)
}

async function navigateToListInApp(page: Page): Promise<void> {
  await navigateInApp(page, '/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单', exact: true })).toBeVisible()
}

test('PFOS 列表支持局部查看编辑日志和中印双语流程卡', async ({ page, context }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await openList(page)
  await expect(page.getByRole('button', { name: '导出备料数据' })).toBeVisible()
  await expect(page.getByRole('button', { name: '批量打印染整生产流程卡' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/dye-work-order-list-1366x768.png' })

  await page.setViewportSize({ width: 1280, height: 720 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/dye-work-order-list-1280x720.png' })

  const row = page.locator('tbody tr').filter({ has: page.locator('[data-work-order-no]') }).first()
  await expect(row).toBeVisible()
  const workOrderNo = await row.locator('[data-work-order-no]').getAttribute('data-work-order-no')
  expect(workOrderNo).toBeTruthy()

  // 首次打开用于预热异步模块，性能口径从第二次可观察操作开始。
  await row.getByRole('button', { name: '查看', exact: true }).click()
  await expect(page.getByRole('heading', { name: `查看染色加工单 - ${workOrderNo}` })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()

  const workspace = page.locator('[data-dye-work-orders-workspace]')
  const workspaceIdentity = await workspace.evaluate((node) => {
    ;(node as HTMLElement).dataset.acceptanceIdentity = 'stable-workspace'
    return (node as HTMLElement).dataset.acceptanceIdentity
  })
  await page.evaluate(() => window.scrollTo(0, 160))
  const scrollBefore = await page.evaluate(() => window.scrollY)

  expect(await clickAndMeasure(row.getByRole('button', { name: '编辑', exact: true }))).toBeLessThan(200)
  const editOverlay = page.locator('[data-dye-work-orders-overlay]')
  await expect(editOverlay.getByRole('heading', { name: `编辑染色加工单 - ${workOrderNo}` })).toBeVisible()
  const editDialogBox = await editOverlay.locator('.relative.bg-background.rounded-lg').boundingBox()
  expect(editDialogBox).not.toBeNull()
  expect(editDialogBox!.y).toBeGreaterThanOrEqual(0)
  expect(editDialogBox!.y + editDialogBox!.height).toBeLessThanOrEqual(720)
  await expect(editOverlay.getByRole('button', { name: '保存', exact: true })).toBeVisible()
  await expect(editOverlay.getByLabel('计划数量')).toHaveAttribute('readonly', '')
  await editOverlay.locator('[data-dye-work-orders-field="status"]').selectOption({ label: '染色中' })
  await editOverlay.getByLabel('原料数量').fill('83')
  await editOverlay.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editOverlay).toBeEmpty()
  const updatedRow = page.locator('tbody tr').filter({ has: page.locator(`[data-work-order-no="${workOrderNo}"]`) })
  await expect(updatedRow).toContainText('染色中')
  expect(await workspace.getAttribute('data-acceptance-identity')).toBe(workspaceIdentity)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)

  expect(await clickAndMeasure(updatedRow.getByRole('button', { name: '日志', exact: true }))).toBeLessThan(200)
  await expect(page.getByRole('heading', { name: `操作日志 - ${workOrderNo}` })).toBeVisible()
  await expect(page.getByText('PFOS人工编辑')).toBeVisible()
  await expect(page.getByRole('cell', { name: '等待处理 → 染色中', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()

  await updatedRow.getByRole('button', { name: '编辑', exact: true }).click()
  await editOverlay.locator('[data-dye-work-orders-field="status"]').selectOption({ label: '取消' })
  await editOverlay.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editOverlay.getByRole('heading', { name: '确认高风险状态变更' })).toBeVisible()
  const highRiskDialogBox = await editOverlay.locator('.relative.bg-background.rounded-lg').boundingBox()
  expect(highRiskDialogBox).not.toBeNull()
  expect(highRiskDialogBox!.y).toBeGreaterThanOrEqual(0)
  expect(highRiskDialogBox!.y + highRiskDialogBox!.height).toBeLessThanOrEqual(720)
  await expect(editOverlay.getByRole('button', { name: '确认保存', exact: true })).toBeVisible()
  await editOverlay.getByRole('button', { name: '取消', exact: true }).click()
  await expect(editOverlay.getByRole('heading', { name: `编辑染色加工单 - ${workOrderNo}` })).toBeVisible()
  await editOverlay.getByRole('button', { name: '取消', exact: true }).click()

  await page.getByRole('button', { name: '按染色信息升序排列' }).click()
  await expect(page.locator('th[data-column-key="dyeInfo"]')).toHaveAttribute('aria-sort', 'ascending')
  const nextPage = page.getByRole('button', { name: '下一页', exact: true }).last()
  await expect(nextPage).toBeEnabled()
  await nextPage.click()
  await expect(page.locator('footer').last()).toContainText('2 /')
  await navigateInApp(page, '/fcs/craft/dyeing/combined-dyeing')
  await navigateToListInApp(page)
  await expect(page.locator('th[data-column-key="dyeInfo"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.locator('footer').last()).toContainText('1 /')

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  const remarkSetting = page.locator('[data-standard-list-column-key="remark"]')
  await remarkSetting.getByRole('checkbox', { name: '显示' }).uncheck()
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()
  await page.locator('[data-dye-work-orders-field="pageSize"]').last().selectOption('20')
  const storedPreferences = await page.evaluate(() => JSON.parse(localStorage.getItem('/fcs/craft/dyeing/work-orders:list-columns') || '{}'))
  expect(storedPreferences.pageSize).toBe(20)
  expect(storedPreferences.visibleKeys).not.toContain('remark')
  await navigateInApp(page, '/fcs/craft/dyeing/combined-dyeing')
  await navigateToListInApp(page)
  await expect(page.locator('[data-dye-work-orders-field="pageSize"]').last()).toHaveValue('20')
  await expect(page.locator('th[data-column-key="remark"]')).toHaveCount(0)

  const popupPromise = context.waitForEvent('page')
  await updatedRow.getByRole('button', { name: '打印流程卡', exact: true }).click()
  const printPage = await popupPromise
  await printPage.waitForLoadState('domcontentloaded')
  await printPage.setViewportSize({ width: 1280, height: 720 })
  await expect(printPage.getByText('染整生产流程卡').first()).toBeVisible()
  await expect(printPage.getByText('Kartu Alur Produksi Pencelupan dan Penyempurnaan').first()).toBeVisible()
  await expect(printPage.getByText(workOrderNo!, { exact: true }).first()).toBeVisible()
  await expect(printPage.getByText('染色加工单二维码', { exact: true }).first()).toBeVisible()
  await expect(printPage.locator('.print-qr-box svg')).toBeVisible()
  await expect(printPage.getByText('复样 Pencocokan sampel/duplikasi sampel', { exact: true })).toBeVisible()
  await expect(printPage.getByText('出货 Pengiriman', { exact: true })).toBeVisible()
  await expect(printPage.getByText('签字区 Tanda tangan', { exact: true })).toBeVisible()
  expect(await printPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await printPage.screenshot({ path: 'output/playwright/dye-work-order-flow-card-1280x720.png', fullPage: true })
  await printPage.close()
})

test('PDA 接单、开工、完工和交出依次同步 PFOS 状态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const seed = await page.evaluate(async () => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const online = await import(/* @vite-ignore */ '/src/data/fcs/dye-work-order-online-domain.ts')
    const tasks = await import(/* @vite-ignore */ '/src/data/fcs/process-mobile-task-binding.ts')
    const mock = await import(/* @vite-ignore */ '/src/data/fcs/pda-task-mock-factory.ts')
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const factories = await import(/* @vite-ignore */ '/src/data/fcs/factory-master-store.ts')

    const testFactory = factories.listFactoryMasterRecords().find((item) => item.id === 'F090')
    if (!testFactory) throw new Error('缺少全能力测试染厂')
    const user = pda.listFactoryPdaUsers(testFactory.id).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
    if (!user) throw new Error('缺少染厂操作员账号')
    const session = pda.createPdaSessionFromUser(user)
    const order = dye.registerFormalProductionOrderDyeWorkOrder({
      workOrderId: 'DWO-E2E-ONLINE-001',
      workOrderNo: 'RS-E2E-ONLINE-001',
      processName: '匹染',
      productionOrderId: 'PO-E2E-ONLINE-001',
      productionOrderNo: 'PO-E2E-ONLINE-001',
      orderedAt: '2026-07-16 07:30:00',
      techPackVersionId: 'TP-E2E-001',
      techPackVersionLabel: 'v1.0',
      materialId: 'FAB-E2E-001',
      materialName: '浏览器验收面料',
      targetColor: '海军蓝',
      plannedQty: 120,
      qtyUnit: '米',
      processCodes: ['DYE'],
      dyeProcessName: '匹染',
      factoryId: session.factoryId,
      factoryName: session.factoryName,
      spuCode: 'SPU-E2E-001',
      spuName: '染色浏览器验收款',
      requiredDeliveryDate: '2026-07-20',
    })
    online.getDyeWorkOrderOnlineRecord(order.dyeOrderId)
    const task = tasks.listPdaMobileExecutionTasks().find((item) => item.taskId === order.taskId)
    if (!task) throw new Error('缺少 PDA 状态映射验收任务')
    mock.registerPdaGenericProcessTask({
      ...task,
      assignedFactoryId: session.factoryId,
      assignedFactoryName: session.factoryName,
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'PENDING',
      acceptedAt: undefined,
      acceptedBy: undefined,
      status: 'NOT_STARTED',
      startedAt: undefined,
      finishedAt: undefined,
    })
    localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    return { dyeOrderId: order.dyeOrderId, taskId: order.taskId, workOrderNo: order.dyeOrderNo, plannedQty: order.plannedQty }
  })

  await navigateInApp(page, '/fcs/pda/task-receive?tab=pending-accept')
  const receiveFacts = await page.evaluate(async (taskId) => {
    const tasks = await import(/* @vite-ignore */ '/src/data/fcs/process-mobile-task-binding.ts')
    const scope = await import(/* @vite-ignore */ '/src/data/fcs/pda-receive-scope.ts')
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const task = tasks.listPdaMobileExecutionTasks().find((item) => item.taskId === taskId)
    const session = pda.getPdaSession()
    return { task, session, eligible: scope.isReceiveEligibleTask(task, session?.factoryId) }
  }, seed.taskId)
  expect(receiveFacts.task, JSON.stringify(receiveFacts)).toBeTruthy()
  expect(receiveFacts.task?.acceptanceStatus, JSON.stringify(receiveFacts)).toBe('PENDING')
  expect(receiveFacts.task?.assignedFactoryId, JSON.stringify(receiveFacts)).toBe(receiveFacts.session?.factoryId)
  expect(receiveFacts.eligible, JSON.stringify(receiveFacts)).toBe(true)
  const taskCard = page.locator('article').filter({ hasText: seed.workOrderNo }).first()
  await expect(taskCard).toBeVisible()
  expect(await clickAndMeasure(taskCard.getByRole('button', { name: '接单', exact: true }))).toBeLessThan(200)
  await expect(page.locator('[data-pda-tr-accept-dialog="true"]')).toBeVisible()
  expect(await clickAndMeasure(page.getByRole('button', { name: '确认接单', exact: true }).last())).toBeLessThan(200)
  await expect(page.locator('#pda-task-receive-toast-root')).toContainText('接单成功')

  await navigateInApp(page, `/fcs/pda/exec/${seed.taskId}`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.getByText('等待处理', { exact: true }).first()).toBeVisible()

  expect(await clickAndMeasure(page.getByRole('button', { name: '开工', exact: true }))).toBeLessThan(200)
  await expect(page.getByRole('heading', { name: '开工信息', exact: true })).toBeVisible()
  expect(await clickAndMeasure(page.getByRole('button', { name: '确认开工', exact: true }))).toBeLessThan(200)
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('开工成功')
  await expect(page.getByRole('button', { name: '开始染色', exact: true })).toBeVisible()
  await page.waitForLoadState('domcontentloaded')

  // 预热详情页动作后，把任务推进到可开始染色的现场前置状态。
  const vatNo = await page.evaluate(async ({ dyeOrderId }) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const order = dye.getDyeWorkOrderById(dyeOrderId)
    if (!order) throw new Error('染色加工单不存在')
    dye.startDyeMaterialWait(dyeOrderId, '浏览器验收')
    dye.completeDyeMaterialWait(dyeOrderId, '浏览器验收')
    dye.startDyeMaterialReady(dyeOrderId, '浏览器验收')
    dye.completeDyeMaterialReady(dyeOrderId, { outputQty: order.plannedQty, operatorName: '浏览器验收' })
    const vat = dye.listDyeVatOptions(order.dyeFactoryId)[0]
    if (!vat) throw new Error('缺少染缸')
    dye.planDyeVat(dyeOrderId, { dyeVatNo: vat.dyeVatNo, operatorName: '浏览器验收' })
    return vat.dyeVatNo
  }, seed)
  await navigateInApp(page, `/fcs/pda/exec/${seed.taskId}?acceptanceRefresh=1`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await page.evaluate(async () => { await import(/* @vite-ignore */ '/src/pages/pda-exec-detail.ts') })

  expect(await clickAndMeasure(page.getByRole('button', { name: '开始染色', exact: true }), [vatNo])).toBeLessThan(200)
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('染色开始已记录')
  await expect(page.locator('[data-testid="pda-dye-online-status"]')).toHaveText('染色中')
  await navigateToListInApp(page)
  const pfosProjection = await page.evaluate(async (dyeOrderId) => {
    const view = await import(/* @vite-ignore */ '/src/data/fcs/dye-work-order-online-view.ts')
    return view.listDyeWorkOrderOnlineRows().find((row) => row.dyeOrderId === dyeOrderId) || null
  }, seed.dyeOrderId)
  expect(pfosProjection?.workOrderNo).toBe(seed.workOrderNo)
  expect(pfosProjection?.status).toBe('染色中')
  await page.evaluate(async () => { await import(/* @vite-ignore */ '/src/main-handlers/fcs-handlers.ts') })
  await page.getByLabel('查询内容').fill(seed.workOrderNo)
  await expect(page.getByLabel('查询内容')).toHaveValue(seed.workOrderNo)
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect.poll(
    () => page.locator('[data-work-order-no]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-work-order-no'))),
  ).toContain(seed.workOrderNo)
  const pfosRow = page.locator('tbody tr').filter({ has: page.locator(`[data-work-order-no="${seed.workOrderNo}"]`) })
  await expect(pfosRow).toContainText('染色中')

  await navigateInApp(page, `/fcs/pda/exec/${seed.taskId}`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  expect(await clickAndMeasure(page.getByRole('button', { name: '完成染色', exact: true }), [String(seed.plannedQty), String(seed.plannedQty)])).toBeLessThan(200)
  await expect(page.locator('[data-testid="pda-dye-online-status"]')).toHaveText('染色完成')

  await page.evaluate(async ({ dyeOrderId, plannedQty }) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    for (const node of ['DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'] as const) {
      dye.startDyeNode(dyeOrderId, node, '浏览器验收')
      dye.completeDyeNode(dyeOrderId, node, { outputQty: plannedQty, operatorName: '浏览器验收' })
    }
  }, seed)
  await navigateInApp(page, `/fcs/pda/exec/${seed.taskId}?handoverRefresh=1`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  expect(await clickAndMeasure(page.getByRole('button', { name: '发起交出', exact: true }).first(), [String(seed.plannedQty)])).toBeLessThan(200)
  await expect(page.locator('[data-testid="pda-dye-online-status"]')).toHaveText('待审核')

  await navigateToListInApp(page)
  await page.getByLabel('查询内容').fill(seed.workOrderNo)
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.locator('tbody tr').filter({ has: page.locator(`[data-work-order-no="${seed.workOrderNo}"]`) })).toContainText('待审核')
})
