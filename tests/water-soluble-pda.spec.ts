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

async function bootstrapWaterSession(page: Page, roleId: 'ROLE_OPERATOR' | 'ROLE_ADMIN', status = 'WATER_SOLUBLE_IN_PROGRESS') {
  await page.goto('/')
  return page.evaluate(async ({ requestedRole, requestedStatus }) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const order = water.listWaterSolubleWorkOrders().find((item) => item.status === requestedStatus && item.factoryId)
    if (!order?.factoryId) throw new Error(`缺少状态为 ${requestedStatus} 的水溶加工单`)
    const user = pda.listFactoryPdaUsers(order.factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === requestedRole)
    if (!user) throw new Error(`缺少 ${requestedRole} 测试账号`)
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(user)))
    return {
      taskId: order.taskId,
      orderId: order.waterOrderId,
      plannedQty: order.plannedQty,
      logCount: order.actionLogs.length,
      materialName: order.materialName,
      qtyUnit: order.qtyUnit,
      factoryId: order.factoryId,
    }
  }, { requestedRole: roleId, requestedStatus: status })
}

async function removeTodoModal(page: Page): Promise<void> {
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
}

test('操作员完成独立水溶短量，重复点击只写一次且主管动作不可注入', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  await page.goto(`/fcs/pda/exec/${seed.taskId}`)
  await removeTodoModal(page)

  const detail = page.getByTestId('pda-water-soluble-detail')
  await expect(detail).toContainText(seed.materialName)
  await expect(detail).toContainText(`${seed.plannedQty} ${seed.qtyUnit}`)
  await expect(detail.getByRole('button', { name: '完成水溶', exact: true })).toBeVisible()
  await expect(detail.locator('[data-water-primary-action="true"]')).toHaveCount(1)

  await detail.getByRole('button', { name: '完成水溶', exact: true }).click()
  const qtyInput = page.locator('[data-pda-execd-field="waterCompletedQty"]')
  const reasonInput = page.locator('[data-pda-execd-field="waterReason"]')
  await page.locator('[data-testid="pda-water-soluble-detail"]').evaluate((node) => {
    ;(window as typeof window & { __waterDetailRoot?: Element }).__waterDetailRoot = node
  })
  await qtyInput.fill(String(seed.plannedQty - 1))
  await reasonInput.fill('现场实测原料不足')
  await reasonInput.focus()
  await expect(reasonInput).toBeFocused()
  await expect.poll(() => page.locator('[data-testid="pda-water-soluble-detail"]').evaluate((node) =>
    (window as typeof window & { __waterDetailRoot?: Element }).__waterDetailRoot === node,
  )).toBe(true)

  await page.getByRole('button', { name: '确认完成', exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })
  await expect(detail).toContainText('生产暂停')
  await expect(detail).toContainText(`完整执行记录（${seed.logCount + 1} 条）`)
  await expect(detail.getByRole('button', { name: '处理数量不足', exact: true })).toHaveCount(0)

  await detail.evaluate((node, data) => {
    const button = document.createElement('button')
    button.dataset.pdaExecdAction = 'water-open-supervisor'
    button.dataset.orderId = data.orderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = 'PRODUCTION_PAUSED'
    button.dataset.actionToken = 'forged-token'
    button.textContent = '注入主管处理'
    node.appendChild(button)
  }, seed)
  await page.getByRole('button', { name: '注入主管处理' }).click()
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('失效')
  await expect(detail).toContainText('生产暂停')
})

test('独立水溶超量取消无副作用，确认后进入待交出', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  await page.goto(`/fcs/pda/exec/${seed.taskId}`)
  await removeTodoModal(page)
  const detail = page.getByTestId('pda-water-soluble-detail')

  await detail.getByRole('button', { name: '完成水溶', exact: true }).click()
  await page.locator('[data-pda-execd-field="waterCompletedQty"]').fill(String(seed.plannedQty + 1))
  await page.locator('[data-pda-execd-field="waterReason"]').fill('现场实测多出一米')
  await page.getByRole('button', { name: '确认完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认超出计划数量' })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('[data-pda-execd-field="waterCompletedQty"]')).toHaveValue(String(seed.plannedQty + 1))
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(detail).toContainText('水溶中')

  await detail.getByRole('button', { name: '完成水溶', exact: true }).click()
  await page.locator('[data-pda-execd-field="waterCompletedQty"]').fill(String(seed.plannedQty + 1))
  await page.locator('[data-pda-execd-field="waterReason"]').fill('现场实测多出一米')
  await page.getByRole('button', { name: '确认完成', exact: true }).click()
  await page.getByRole('button', { name: '确认超量完成', exact: true }).click()
  await expect(detail).toContainText('待交出')
  await expect(detail.getByRole('button', { name: '去交出', exact: true })).toHaveCount(0)
})

test('切换执行任务会清空独立水溶草稿、确认令牌和待处理状态', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  await page.goto(`/fcs/pda/exec/${seed.taskId}`)
  await removeTodoModal(page)
  await page.getByRole('button', { name: '完成水溶', exact: true }).click()
  await page.locator('[data-pda-execd-field="waterCompletedQty"]').fill(String(seed.plannedQty + 9))
  await page.locator('[data-pda-execd-field="waterReason"]').fill('不应带到其他任务')
  const stale = await page.getByRole('button', { name: '确认完成', exact: true }).evaluate((button: HTMLElement) => ({
    action: button.dataset.pdaExecdAction || '',
    orderId: button.dataset.orderId || '',
    taskId: button.dataset.taskId || '',
    expectedStatus: button.dataset.expectedStatus || '',
    overlayToken: button.dataset.overlayToken || '',
  }))
  const otherTaskId = await page.evaluate(async (activeTaskId) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const taskId = water.listWaterSolubleWorkOrders().find((item) => item.taskId !== activeTaskId)?.taskId
      || dye.listDyeWorkOrders().find((item) => item.taskId !== activeTaskId)?.taskId
    if (!taskId) throw new Error('缺少用于切换的其他执行任务')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
    return taskId
  }, seed.taskId)
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/${otherTaskId}`))
  await expect(page.locator('[data-pda-execd-field="waterCompletedQty"]')).toHaveCount(0)

  await page.locator('body').evaluate(async (body, data) => {
    const button = document.createElement('button')
    button.dataset.pdaExecdAction = data.action
    button.dataset.orderId = data.orderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = data.expectedStatus
    button.dataset.overlayToken = data.overlayToken
    button.textContent = '提交旧任务确认'
    body.appendChild(button)
    const detail = await import(/* @vite-ignore */ '/src/pages/pda-exec-detail.ts')
    detail.handlePdaExecDetailEvent(button)
  }, stale)
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('失效')

  await page.evaluate(async (taskId) => {
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
  }, seed.taskId)
  await expect(page.locator('[data-pda-execd-field="waterCompletedQty"]')).toHaveCount(0)
  await page.getByRole('button', { name: '完成水溶', exact: true }).click()
  await expect(page.locator('[data-pda-execd-field="waterCompletedQty"]')).toHaveValue(String(seed.plannedQty))
  await expect(page.locator('[data-pda-execd-field="waterReason"]')).toHaveValue('')
  const logCount = await page.evaluate(async (orderId) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    return water.getWaterSolubleWorkOrderById(orderId)?.actionLogs.length
  }, seed.orderId)
  expect(logCount).toBe(seed.logCount)
})

test('管理员处理独立水溶短量并进入现有交出入口', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_ADMIN', 'PRODUCTION_PAUSED')
  await page.goto(`/fcs/pda/exec/${seed.taskId}`)
  await removeTodoModal(page)
  const detail = page.getByTestId('pda-water-soluble-detail')
  await detail.getByRole('button', { name: '处理数量不足', exact: true }).click()
  await page.getByRole('button', { name: '按实际数量继续', exact: true }).click()
  await expect(detail.getByRole('button', { name: '去交出', exact: true })).toBeVisible()
  await detail.getByRole('button', { name: '去交出', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover\\?tab=handout&focusTaskId=${seed.taskId}`))
})

test('PFOS 联合水溶必须使用当前会话且普通动作只允许操作员', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  const combined = await page.evaluate(async (factoryId) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const order = dye.listDyeWorkOrders().find((item) => item.requiresWaterSoluble && item.dyeFactoryId === factoryId)
    if (!order) throw new Error('缺少含水溶染色加工单')
    if (order.isFirstOrder && order.sampleWaitType !== 'NONE') {
      dye.startDyeSampleWait(order.dyeOrderId, { waitType: order.sampleWaitType, operatorName: '浏览器测试操作员' })
      dye.completeDyeSampleWait(order.dyeOrderId, '浏览器测试操作员')
      dye.startDyeSampleTest(order.dyeOrderId, '浏览器测试操作员')
      dye.completeDyeSampleTest(order.dyeOrderId, { colorNo: 'WS-PFOS', operatorName: '浏览器测试操作员' })
    }
    dye.startDyeMaterialWait(order.dyeOrderId, '浏览器测试操作员')
    dye.completeDyeMaterialWait(order.dyeOrderId, '浏览器测试操作员')
    dye.startDyeMaterialReady(order.dyeOrderId, '浏览器测试操作员')
    dye.completeDyeMaterialReady(order.dyeOrderId, { outputQty: order.plannedQty, operatorName: '浏览器测试操作员' })
    const vat = dye.listDyeVatOptions(order.dyeFactoryId)[0]
    if (!vat) throw new Error('缺少测试染缸')
    dye.planDyeVat(order.dyeOrderId, { dyeVatNo: vat.dyeVatNo, operatorName: '浏览器测试操作员' })
    localStorage.removeItem('fcs_pda_session')
    return { dyeOrderId: order.dyeOrderId, taskId: order.taskId, factoryId: order.dyeFactoryId }
  }, seed.factoryId)

  await page.evaluate(async (dyeOrderId) => {
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    store.appStore.navigate(`/fcs/craft/dyeing/work-orders/${dyeOrderId}`)
  }, combined.dyeOrderId)
  await page.locator('body').evaluate(async (body, data) => {
    const button = document.createElement('button')
    button.dataset.dyeingAction = 'start-water-soluble'
    button.dataset.dyeOrderId = data.dyeOrderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = 'WAIT_WATER_SOLUBLE'
    button.dataset.expectedNode = 'WATER_SOLUBLE'
    body.appendChild(button)
    const events = await import(/* @vite-ignore */ '/src/pages/process-factory/dyeing/events.ts')
    events.handleCraftDyeingEvent(button)
  }, combined)
  await expect(page.locator('#dyeing-page-toast-root')).toContainText('登录信息已失效')
  expect(await page.evaluate(async (id) => (await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')).getDyeWorkOrderById(id)?.status, combined.dyeOrderId)).toBe('WAIT_WATER_SOLUBLE')

  await page.evaluate(async ({ factoryId, dyeOrderId }) => {
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const admin = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_ADMIN')
    if (!admin) throw new Error('缺少管理员测试账号')
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(admin)))
    store.appStore.navigate('/fcs/craft/dyeing/work-orders')
    store.appStore.navigate(`/fcs/craft/dyeing/work-orders/${dyeOrderId}`)
  }, combined)
  await page.locator('body').evaluate(async (body, data) => {
    const button = document.createElement('button')
    button.dataset.dyeingAction = 'start-water-soluble'
    button.dataset.dyeOrderId = data.dyeOrderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = 'WAIT_WATER_SOLUBLE'
    button.dataset.expectedNode = 'WATER_SOLUBLE'
    body.appendChild(button)
    const events = await import(/* @vite-ignore */ '/src/pages/process-factory/dyeing/events.ts')
    events.handleCraftDyeingEvent(button)
  }, combined)
  await expect(page.locator('#dyeing-page-toast-root')).toContainText('当前账号不能执行水溶现场操作')
  expect(await page.evaluate(async (id) => (await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')).getDyeWorkOrderById(id)?.status, combined.dyeOrderId)).toBe('WAIT_WATER_SOLUBLE')

  await page.evaluate(async ({ factoryId, dyeOrderId }) => {
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const operator = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
    if (!operator) throw new Error('缺少操作员测试账号')
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(operator)))
    store.appStore.navigate('/fcs/craft/dyeing/work-orders')
    store.appStore.navigate(`/fcs/craft/dyeing/work-orders/${dyeOrderId}`)
  }, combined)
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('body').evaluate(async (body, data) => {
    const button = document.createElement('button')
    button.dataset.dyeingAction = 'start-water-soluble'
    button.dataset.dyeOrderId = data.dyeOrderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = 'WAIT_WATER_SOLUBLE'
    button.dataset.expectedNode = 'WATER_SOLUBLE'
    body.appendChild(button)
    const events = await import(/* @vite-ignore */ '/src/pages/process-factory/dyeing/events.ts')
    events.handleCraftDyeingEvent(button)
  }, combined)
  await expect(page.locator('#dyeing-page-toast-root')).toContainText('已开始水溶')
  expect(await page.evaluate(async (id) => (await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')).getDyeWorkOrderById(id)?.status, combined.dyeOrderId)).toBe('WATER_SOLUBLE_IN_PROGRESS')
})

test('含水溶染色按当前节点执行，80产出阻断100投入并允许80投入', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  const combined = await page.evaluate(async (factoryId) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const order = dye.listDyeWorkOrders().find((item) => item.requiresWaterSoluble && item.dyeFactoryId === factoryId)
    if (!order) throw new Error('缺少含水溶染色加工单')
    return { taskId: order.taskId, dyeOrderId: order.dyeOrderId, factoryId: order.dyeFactoryId }
  }, seed.factoryId)
  await page.goto(`/fcs/pda/exec/${combined.taskId}`)
  await removeTodoModal(page)
  await expect(page.getByTestId('pda-combined-dye-current-action')).toHaveCount(0)

  await page.evaluate(async ({ dyeOrderId, taskId }) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const order = dye.getDyeWorkOrderById(dyeOrderId)
    if (!order) throw new Error('含水溶染色加工单丢失')
    if (order.isFirstOrder && order.sampleWaitType !== 'NONE') {
      dye.startDyeSampleWait(dyeOrderId, { waitType: order.sampleWaitType, operatorName: '浏览器测试操作员' })
      dye.completeDyeSampleWait(dyeOrderId, '浏览器测试操作员')
      dye.startDyeSampleTest(dyeOrderId, '浏览器测试操作员')
      dye.completeDyeSampleTest(dyeOrderId, { colorNo: 'WS-E2E', operatorName: '浏览器测试操作员' })
    }
    dye.startDyeMaterialWait(dyeOrderId, '浏览器测试操作员')
    dye.completeDyeMaterialWait(dyeOrderId, '浏览器测试操作员')
    dye.startDyeMaterialReady(dyeOrderId, '浏览器测试操作员')
    dye.completeDyeMaterialReady(dyeOrderId, { outputQty: order.plannedQty, operatorName: '浏览器测试操作员' })
    const vat = dye.listDyeVatOptions(order.dyeFactoryId)[0]
    if (!vat) throw new Error('缺少测试染缸')
    dye.planDyeVat(dyeOrderId, { dyeVatNo: vat.dyeVatNo, operatorName: '浏览器测试操作员' })
    store.appStore.navigate('/fcs/pda/exec')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
  }, combined)

  const current = page.getByTestId('pda-combined-dye-current-action')
  await expect(current.getByRole('button', { name: '开始水溶', exact: true })).toBeVisible()
  await current.getByRole('button', { name: '开始水溶', exact: true }).click()
  await expect(current.getByRole('button', { name: '完成水溶', exact: true })).toBeVisible()
  await current.getByRole('button', { name: '完成水溶', exact: true }).click()
  await page.locator('[data-pda-execd-field="dyeWaterOutputQty"]').fill('77')
  await page.locator('[data-pda-execd-field="dyeWaterReason"]').fill('不应跨任务保留')
  await page.evaluate(async ({ otherTaskId, combinedTaskId }) => {
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    store.appStore.navigate(`/fcs/pda/exec/${otherTaskId}`)
    store.appStore.navigate(`/fcs/pda/exec/${combinedTaskId}`)
  }, { otherTaskId: seed.taskId, combinedTaskId: combined.taskId })
  await expect(page.locator('[data-pda-execd-field="dyeWaterOutputQty"]')).toHaveCount(0)
  await current.getByRole('button', { name: '完成水溶', exact: true }).click()
  await expect(page.locator('[data-pda-execd-field="dyeWaterOutputQty"]')).not.toHaveValue('77')
  await expect(page.locator('[data-pda-execd-field="dyeWaterReason"]')).toHaveValue('')
  await page.locator('[data-pda-execd-field="dyeWaterOutputQty"]').fill('80')
  await page.locator('[data-pda-execd-field="dyeWaterReason"]').fill('物料实际可水溶数量不足')
  await page.getByRole('button', { name: '确认完成', exact: true }).click()
  await expect(current).toContainText('生产暂停')
  await expect(current.getByRole('button', { name: '处理数量不足', exact: true })).toHaveCount(0)

  await page.evaluate(async ({ dyeOrderId, taskId, factoryId }) => {
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const admin = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_ADMIN')
    if (!admin) throw new Error('缺少管理员测试账号')
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(admin)))
    store.appStore.navigate('/fcs/pda/exec')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
  }, combined)
  await current.getByRole('button', { name: '处理数量不足', exact: true }).click()
  await page.getByRole('button', { name: '按实际数量继续', exact: true }).click()
  await page.evaluate(async ({ taskId, factoryId }) => {
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    const operator = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
    if (!operator) throw new Error('缺少操作员测试账号')
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(operator)))
    store.appStore.navigate('/fcs/pda/exec')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
  }, combined)
  await expect(current.getByRole('button', { name: '开始染色', exact: true })).toBeVisible()
  await expect(current.getByRole('button', { name: /交出/ })).toHaveCount(0)

  page.once('dialog', (dialog) => dialog.accept('100'))
  await current.getByRole('button', { name: '开始染色', exact: true }).click()
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('不能超过水溶完成数量')
  page.once('dialog', (dialog) => dialog.accept('80'))
  await current.getByRole('button', { name: '开始染色', exact: true }).click()
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('染色开始已记录')
  await expect(current.getByRole('button', { name: '开始染色', exact: true })).toHaveCount(0)
  await expect(current.getByRole('button', { name: '完成染色', exact: true })).toBeVisible()

  const ordinaryTaskId = await page.evaluate(async (factoryId) => {
    const dye = await import(/* @vite-ignore */ '/src/data/fcs/dyeing-task-domain.ts')
    return dye.listDyeWorkOrders().find((item) => !item.requiresWaterSoluble && item.dyeFactoryId === factoryId)?.taskId || ''
  }, combined.factoryId)
  expect(ordinaryTaskId).toBeTruthy()
  await page.evaluate(async (taskId) => {
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
  }, ordinaryTaskId)
  await expect(page.getByTestId('pda-combined-dye-current-action')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开始水溶', exact: true })).toHaveCount(0)
})
