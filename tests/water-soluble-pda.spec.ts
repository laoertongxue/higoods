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

async function bootstrapWaterSession(page: Page, roleId: 'ROLE_OPERATOR' | 'ROLE_HANDOVER' | 'ROLE_ADMIN', status = 'WATER_SOLUBLE_IN_PROGRESS') {
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
      materialCode: order.materialCode,
      qtyUnit: order.qtyUnit,
      factoryId: order.factoryId,
    }
  }, { requestedRole: roleId, requestedStatus: status })
}

async function removeTodoModal(page: Page): Promise<void> {
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
}

test('操作员离线完成独立水溶可原输入重试，重复点击只写一次且主管动作不可注入', async ({ page, context }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_OPERATOR')
  await page.goto(`/fcs/pda/exec/${seed.taskId}`)
  await removeTodoModal(page)

  const detail = page.getByTestId('pda-water-soluble-detail')
  await expect(detail).toContainText(seed.materialName)
  await expect(detail).toContainText(`${seed.plannedQty} ${seed.qtyUnit}`)
  await expect(detail.getByRole('button', { name: '完成水溶', exact: true })).toBeVisible()
  await expect(detail.locator('[data-water-primary-action="true"]')).toHaveCount(1)

  const openFormTiming = await detail.getByRole('button', { name: '完成水溶', exact: true }).evaluate(async (button: HTMLButtonElement) => {
    const root = document.querySelector('[data-testid="pda-water-soluble-detail"]')
    button.focus()
    const startedAt = performance.now()
    const formReady = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-pda-execd-field="waterCompletedQty"]')) return
        observer.disconnect()
        clearTimeout(timeout)
        resolve()
      })
      const timeout = window.setTimeout(() => {
        observer.disconnect()
        resolve()
      }, 1000)
      observer.observe(document.body, { childList: true, subtree: true })
    })
    button.click()
    await formReady
    const elapsed = performance.now() - startedAt
    return {
      elapsed,
      sameRoot: root === document.querySelector('[data-testid="pda-water-soluble-detail"]') && root?.isConnected === true,
      focused: document.activeElement === button,
      formReady: Boolean(document.querySelector('[data-pda-execd-field="waterCompletedQty"]')),
    }
  })
  console.log(`[performance] PDA 打开水溶完成表单 ${openFormTiming.elapsed.toFixed(3)}ms`)
  expect(openFormTiming.elapsed).toBeLessThan(200)
  expect(openFormTiming).toMatchObject({ sameRoot: true, focused: true, formReady: true })
  const qtyInput = page.locator('[data-pda-execd-field="waterCompletedQty"]')
  const reasonInput = page.locator('[data-pda-execd-field="waterReason"]')
  await page.locator('[data-testid="pda-water-soluble-detail"]').evaluate((node) => {
    ;(window as typeof window & { __waterDetailRoot?: Element }).__waterDetailRoot = node
  })
  await qtyInput.fill(String(seed.plannedQty - 1))
  const inputTiming = await reasonInput.evaluate((input: HTMLTextAreaElement) => {
    const root = document.querySelector('[data-testid="pda-water-soluble-detail"]')
    input.focus()
    const startedAt = performance.now()
    input.value = '现场实测原料不足'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const elapsed = performance.now() - startedAt
    return {
      elapsed,
      sameRoot: root === document.querySelector('[data-testid="pda-water-soluble-detail"]') && root?.isConnected === true,
      focused: document.activeElement === input,
      value: input.value,
    }
  })
  console.log(`[performance] PDA 水溶原因输入 ${inputTiming.elapsed.toFixed(3)}ms`)
  expect(inputTiming.elapsed).toBeLessThan(200)
  expect(inputTiming).toMatchObject({ sameRoot: true, focused: true, value: '现场实测原料不足' })
  await expect(reasonInput).toBeFocused()
  await expect.poll(() => page.locator('[data-testid="pda-water-soluble-detail"]').evaluate((node) =>
    (window as typeof window & { __waterDetailRoot?: Element }).__waterDetailRoot === node,
  )).toBe(true)

  const beforeOffline = await page.evaluate(async (taskId) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
    const order = water.listWaterSolubleWorkOrders().find((item) => item.taskId === taskId)
    if (!order) throw new Error('缺少离线重试水溶加工单')
    return {
      status: order.status,
      completedQty: order.completedQty,
      exceptionReason: order.exceptionReason ?? '',
      logCount: order.actionLogs.length,
      handoverHeadCount: handover.listHandoverOrdersByTaskId(taskId).length,
    }
  }, seed.taskId)
  const staleConfirm = await page.getByRole('button', { name: '确认完成', exact: true }).evaluate((button: HTMLElement) => ({
    action: button.dataset.pdaExecdAction || '',
    orderId: button.dataset.orderId || '',
    taskId: button.dataset.taskId || '',
    expectedStatus: button.dataset.expectedStatus || '',
    overlayToken: button.dataset.overlayToken || '',
  }))

  await context.setOffline(true)
  await page.getByRole('button', { name: '确认完成', exact: true }).click()
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('网络不可用')
  const afterOffline = await page.evaluate(async (taskId) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
    const order = water.listWaterSolubleWorkOrders().find((item) => item.taskId === taskId)
    if (!order) throw new Error('缺少离线重试水溶加工单')
    return {
      status: order.status,
      completedQty: order.completedQty,
      exceptionReason: order.exceptionReason ?? '',
      logCount: order.actionLogs.length,
      handoverHeadCount: handover.listHandoverOrdersByTaskId(taskId).length,
    }
  }, seed.taskId)
  expect(afterOffline).toEqual(beforeOffline)
  await expect(qtyInput).toHaveValue(String(seed.plannedQty - 1))
  await expect(reasonInput).toHaveValue('现场实测原料不足')
  await expect(reasonInput).toBeFocused()
  await expect(page.getByRole('button', { name: '确认完成', exact: true })).toBeEnabled()

  await context.setOffline(false)
  await page.getByRole('button', { name: '确认完成', exact: true }).click()
  await expect(detail).toContainText('生产暂停')
  await expect(detail).toContainText(`完整执行记录（${seed.logCount + 1} 条）`)
  await expect(detail.getByRole('button', { name: '处理数量不足', exact: true })).toHaveCount(0)

  await page.locator('body').evaluate(async (body, data) => {
    const button = document.createElement('button')
    button.dataset.pdaExecdAction = data.action
    button.dataset.orderId = data.orderId
    button.dataset.taskId = data.taskId
    button.dataset.expectedStatus = data.expectedStatus
    button.dataset.overlayToken = data.overlayToken
    button.textContent = '重复提交旧确认'
    body.appendChild(button)
    const detailModule = await import(/* @vite-ignore */ '/src/pages/pda-exec-detail.ts')
    detailModule.handlePdaExecDetailEvent(button)
  }, staleConfirm)
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText(/失效|已更新/)
  const afterStaleRetry = await page.evaluate(async (taskId) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
    const order = water.listWaterSolubleWorkOrders().find((item) => item.taskId === taskId)
    return {
      logCount: order?.actionLogs.length,
      handoverHeadCount: handover.listHandoverOrdersByTaskId(taskId).length,
    }
  }, seed.taskId)
  expect(afterStaleRetry).toEqual({ logCount: seed.logCount + 1, handoverHeadCount: 0 })

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
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/HO-[^?]+\?action=new-record$/)
  await expect(page.getByTestId('handout-head-object-profile')).toContainText('交出物类型：物料')
  await expect(page.getByTestId('handout-head-object-profile')).toContainText(seed.qtyUnit)
})

test('任务9：独立水溶通过唯一通用交接单完成交出与相等收货', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_ADMIN', 'PRODUCTION_PAUSED')
  try {
    await page.goto(`/fcs/pda/exec/${seed.taskId}`)
    await removeTodoModal(page)
    const detail = page.getByTestId('pda-water-soluble-detail')
    await detail.getByRole('button', { name: '处理数量不足', exact: true }).click()
    await page.getByRole('button', { name: '按实际数量继续', exact: true }).click()
    const approvedQty = await page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      return water.getWaterSolubleWorkOrderById(orderId)?.handoverQty
    }, seed.orderId)
    expect(approvedQty).toBeGreaterThan(0)

    await page.evaluate(async ({ factoryId, taskId }) => {
      const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      const user = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_HANDOVER')
        || await pda.createFactoryPdaUser({ factoryId, name: '任务9交接员', loginId: `${factoryId}_task9_handover`, password: '123456', roleId: 'ROLE_HANDOVER', createdBy: 'Playwright任务9' })
      localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(user)))
      store.appStore.navigate('/fcs/pda/exec')
      store.appStore.navigate(`/fcs/pda/exec/${taskId}`)
    }, { factoryId: seed.factoryId, taskId: seed.taskId })
    await page.getByTestId('pda-water-soluble-detail').getByRole('button', { name: '去交出', exact: true }).click()
    await expect(page).toHaveURL(/\/fcs\/pda\/handover\/HO-[^?]+\?action=new-record$/)
    await expect(page.getByTestId('handout-head-object-profile')).toContainText('交出物类型：物料')
    await expect(page.getByTestId('handout-head-object-profile')).toContainText(seed.materialName)
    await expect(page.getByTestId('handout-head-object-profile')).toContainText(seed.materialCode)
    await expect(page.getByTestId('handout-head-object-profile')).toContainText(seed.qtyUnit)
    await expect(page.getByTestId('handout-new-record-form')).toHaveCount(0)
    await page.getByRole('button', { name: '新增交出记录', exact: true }).click()
    await expect(page.locator('[data-pda-handoverd-field="newRecordUnit"]')).toHaveCount(0)

    await page.locator('[data-pda-handoverd-field="newRecordScanCode"]').fill(seed.materialCode)
    await page.locator('[data-pda-handoverd-field="newRecordQty"]').fill(String(approvedQty))
    await page.getByRole('button', { name: '确认交出', exact: true }).click()
    await expect.poll(() => page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      return water.getWaterSolubleWorkOrderById(orderId)?.status
    }, seed.orderId)).toBe('HANDOVER_WAIT_RECEIVE')
    await expect(page.getByRole('button', { name: '完成交出单', exact: true })).toHaveCount(0)
    await expect.poll(() => page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const linkedId = water.getWaterSolubleWorkOrderById(orderId)?.handoverOrderId
      const head = linkedId ? handover.getHandoverOrderById(linkedId) : null
      return head ? `${head.completionStatus}:${head.handoverOrderStatus}` : null
    }, seed.orderId)).toBe('COMPLETED:WAIT_RECEIVER_WRITEBACK')

    await page.evaluate(async (factoryId) => {
      const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      const admin = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_ADMIN')
      if (!admin) throw new Error('缺少接收确认管理员')
      localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(admin)))
      const current = store.appStore.getState().pathname.split('?')[0]
      store.appStore.navigate('/fcs/pda/handover?tab=handout')
      store.appStore.navigate(`${current}?demoRole=RECEIVER`)
    }, seed.factoryId)
    await expect(page).toHaveURL(/demoRole=RECEIVER/)
    await page.getByRole('button', { name: '确认收货', exact: true }).click()
    await page.locator('[data-pda-handoverd-field="writebackQty"]').fill(String(approvedQty))
    await page.getByRole('button', { name: '确认收货', exact: true }).last().click()
    await expect.poll(() => page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      return water.getWaterSolubleWorkOrderById(orderId)?.status
    }, seed.orderId)).toBe('DONE')
    const closedHead = await page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const linkedId = water.getWaterSolubleWorkOrderById(orderId)?.handoverOrderId
      return linkedId ? handover.getHandoverOrderById(linkedId) : null
    }, seed.orderId)
    expect(closedHead?.completionStatus).toBe('COMPLETED')
    expect(closedHead?.handoverOrderStatus).toBe('CLOSED')
    expect(closedHead?.submittedQtyTotal).toBe(approvedQty)
    expect(closedHead?.writtenBackQtyTotal).toBe(approvedQty)
    expect(closedHead?.diffQtyTotal).toBe(0)
    expect(closedHead?.receiverClosedAt).toBeTruthy()
    await expect(page).toHaveURL(/demoRole=RECEIVER/)
  } finally {
    await page.evaluate(async () => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      water.resetWaterSolubleDomainForChecks()
      localStorage.removeItem('fcs_pda_session')
    }).catch(() => undefined)
  }
})

test('任务9闭环：接收方可回写 0，主管接受差异后订单与交出单同时关闭', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_ADMIN', 'PRODUCTION_PAUSED')
  try {
    const prepared = await page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const resolved = water.resolveWaterSolublePause(orderId, 'CONTINUE_WITH_ACTUAL_QTY')
      if (!resolved.ok || !resolved.order?.handoverQty) throw new Error(resolved.message)
      const ensured = handover.ensureHandoverOrderForStartedTask(resolved.order.taskId)
      const record = handover.createFactoryHandoverRecord({
        handoverOrderId: ensured.handoverOrderId,
        submittedQty: resolved.order.handoverQty,
        factorySubmittedAt: '2026-07-12 09:00:00',
        factorySubmittedBy: '浏览器交接员',
      })
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      store.appStore.navigate(`/fcs/pda/handover/${ensured.handoverOrderId}?demoRole=RECEIVER`)
      return { handoverOrderId: ensured.handoverOrderId, recordId: record.recordId, qtyUnit: record.qtyUnit }
    }, seed.orderId)

    await page.getByRole('button', { name: '确认收货', exact: true }).click()
    await page.locator('[data-pda-handoverd-field="writebackQty"]').fill('0')
    await page.locator('[data-pda-handoverd-field="writebackReason"]').fill('现场复点实收为零')
    await page.getByRole('button', { name: '确认收货', exact: true }).last().click()
    await expect.poll(() => page.evaluate(async (orderId) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const order = water.getWaterSolubleWorkOrderById(orderId)
      return order ? `${order.status}:${order.receivedQty}` : null
    }, seed.orderId)).toBe('RECEIPT_DIFFERENCE:0')
    await expect.poll(() => page.evaluate(async (handoverOrderId) => {
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const head = handover.getHandoverOrderById(handoverOrderId)
      return head ? `${head.completionStatus}:${head.handoverOrderStatus}:${head.writtenBackQtyTotal}` : null
    }, prepared.handoverOrderId)).toBe('COMPLETED:DIFF_WAIT_FACTORY_CONFIRM:0')

    await page.evaluate(async (handoverOrderId) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      store.appStore.navigate(`/fcs/pda/handover/${handoverOrderId}?demoRole=FACTORY`)
    }, prepared.handoverOrderId)
    await page.locator(`[data-pda-handoverd-action="accept-record-diff"][data-record-id="${prepared.recordId}"]`).click()
    await expect.poll(() => page.evaluate(async ({ orderId, handoverOrderId }) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const order = water.getWaterSolubleWorkOrderById(orderId)
      const head = handover.getHandoverOrderById(handoverOrderId)
      return order && head ? `${order.status}:${head.completionStatus}:${head.handoverOrderStatus}` : null
    }, { orderId: seed.orderId, handoverOrderId: prepared.handoverOrderId })).toBe('DONE:COMPLETED:CLOSED')
  } finally {
    await page.evaluate(async () => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      water.resetWaterSolubleDomainForChecks()
      localStorage.removeItem('fcs_pda_session')
    }).catch(() => undefined)
  }
})

test('任务9安全：水溶交出详情拒绝无会话、错误角色、跨厂和伪造确认令牌', async ({ page }) => {
  const seed = await bootstrapWaterSession(page, 'ROLE_ADMIN', 'PRODUCTION_PAUSED')
  try {
    const prepared = await page.evaluate(async ({ orderId, taskId, factoryId }) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
      const admin = pda.getPdaSession()
      if (!admin) throw new Error('缺少管理员会话')
      const result = water.executeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', orderId, taskId, expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'SUPERVISOR', decision: 'CONTINUE_WITH_ACTUAL_QTY', actor: admin })
      if (!result.ok) throw new Error(result.message)
      const head = handover.ensureHandoverOrderForStartedTask(taskId)
      const operator = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
      const handoverUser = pda.listFactoryPdaUsers(factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_HANDOVER')
        || await pda.createFactoryPdaUser({ factoryId, name: '任务9安全交接员', loginId: `${factoryId}_task9_security`, password: '123456', roleId: 'ROLE_HANDOVER', createdBy: 'Playwright任务9安全' })
      if (!operator) throw new Error('缺少操作员')
      const foreignUser = pda.listAllFactoryPdaUsers().find((item) => item.status === 'ACTIVE' && item.factoryId !== factoryId)
      if (!foreignUser) throw new Error('缺少真实外厂用户')
      let second = water.listWaterSolubleWorkOrders().find((item) => item.waterOrderId !== orderId)
      if (!second) throw new Error('缺少第二张水溶单验证跨单令牌')
      if (second.status === 'WAIT_FACTORY_ASSIGNMENT') water.assignWaterSolubleFactory(second.waterOrderId, factoryId)
      second = water.getWaterSolubleWorkOrderById(second.waterOrderId)!
      if (second.status === 'WAIT_MATERIAL') water.markWaterSolubleMaterialReady(second.waterOrderId)
      second = water.getWaterSolubleWorkOrderById(second.waterOrderId)!
      if (second.status === 'WAIT_WATER_SOLUBLE') water.startWaterSoluble(second.waterOrderId)
      second = water.getWaterSolubleWorkOrderById(second.waterOrderId)!
      if (second.status === 'WATER_SOLUBLE_IN_PROGRESS') water.completeWaterSoluble(second.waterOrderId, second.plannedQty)
      second = water.getWaterSolubleWorkOrderById(second.waterOrderId)!
      if (second.status === 'PRODUCTION_PAUSED') water.resolveWaterSolublePause(second.waterOrderId, 'CONTINUE_WITH_ACTUAL_QTY')
      second = water.getWaterSolubleWorkOrderById(second.waterOrderId)!
      if (second.status !== 'WAIT_HANDOVER') throw new Error(`第二张水溶单未进入待交出：${second.status}`)
      const secondHead = handover.ensureHandoverOrderForStartedTask(second.taskId)
      return {
        handoverOrderId: head.handoverOrderId,
        approvedQty: result.order?.handoverQty || 0,
        operatorSession: pda.createPdaSessionFromUser(operator),
        handoverSession: pda.createPdaSessionFromUser(handoverUser),
        adminSession: admin,
        foreignSession: pda.createPdaSessionFromUser(foreignUser),
        secondOrderId: second.waterOrderId,
        secondHandoverOrderId: secondHead.handoverOrderId,
      }
    }, seed)
    const detailUrl = `/fcs/pda/handover/${prepared.handoverOrderId}?action=new-record`

    await page.evaluate(async (url) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      localStorage.removeItem('fcs_pda_session')
      store.appStore.navigate(url)
    }, detailUrl)
    await expect(page.getByTestId('handout-new-record-form')).toHaveCount(0)
    await expect(page.locator('body')).toContainText(/登录|无权|不能操作/)

    await page.evaluate(async ({ session, url }) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      localStorage.setItem('fcs_pda_session', JSON.stringify(session))
      store.appStore.navigate('/fcs/pda/handover?tab=handout')
      store.appStore.navigate(`${url}&operator=1`)
    }, { session: prepared.operatorSession, url: detailUrl })
    await expect(page.getByTestId('handout-new-record-form')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增交出记录', exact: true })).toHaveCount(0)

    await page.evaluate(async ({ session, url }) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      localStorage.setItem('fcs_pda_session', JSON.stringify(session))
      store.appStore.navigate('/fcs/pda/handover?tab=handout')
      store.appStore.navigate(`${url}&cross=1`)
    }, { session: prepared.foreignSession, url: detailUrl })
    await expect(page.getByTestId('handout-new-record-form')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增交出记录', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('water-handover-access-denied')).toContainText('不属于当前工厂')

    await page.evaluate(async ({ session, url }) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      localStorage.setItem('fcs_pda_session', JSON.stringify(session))
      store.appStore.navigate('/fcs/pda/handover?tab=handout')
      store.appStore.navigate(`${url}&admin=1`)
    }, { session: prepared.adminSession, url: detailUrl })
    await page.getByRole('button', { name: '新增交出记录', exact: true }).click()
    await expect(page.getByTestId('handout-new-record-form')).toBeVisible()
    await page.getByTestId('handout-new-record-form').getByRole('button', { name: '取消', exact: true }).click()

    await page.evaluate(async ({ session, url }) => {
      const store = await import(/* @vite-ignore */ '/src/state/store.ts')
      localStorage.setItem('fcs_pda_session', JSON.stringify(session))
      store.appStore.navigate('/fcs/pda/handover?tab=handout')
      store.appStore.navigate(`${url}&valid=1`)
    }, { session: prepared.handoverSession, url: detailUrl })
    await expect(page.getByTestId('handout-new-record-form')).toHaveCount(0)
    await page.getByRole('button', { name: '新增交出记录', exact: true }).click()
    const form = page.getByTestId('handout-new-record-form')
    await expect(form).toBeVisible()
    await expect(form.locator('[data-pda-handoverd-field="newRecordUnit"]')).toHaveCount(0)
    await page.locator('body').evaluate(async (body) => {
      const input = document.createElement('input')
      input.dataset.pdaHandoverdField = 'newRecordUnit'
      input.value = '打'
      body.appendChild(input)
      const detail = await import(/* @vite-ignore */ '/src/pages/pda-handover-detail.ts')
      detail.handlePdaHandoverDetailEvent(input)
    })
    await expect(page.locator('#pda-handover-detail-toast-root')).toContainText(/原 BOM|不能修改/)
    await form.locator('[data-pda-handoverd-field="newRecordScanCode"]').fill(seed.materialCode)
    await form.locator('[data-pda-handoverd-field="newRecordQty"]').fill(String(prepared.approvedQty))
    const token = await form.getByRole('button', { name: '确认交出', exact: true }).getAttribute('data-water-handover-confirm-token')
    expect(token).toBeTruthy()
    await page.locator('body').evaluate(async (body, data) => {
      const button = document.createElement('button')
      button.dataset.pdaHandoverdAction = 'submit-new-handout-record'
      button.dataset.handoverId = data.handoverOrderId
      button.dataset.waterHandoverConfirmToken = data.token || ''
      button.textContent = 'A令牌操作B单'
      body.appendChild(button)
      const detail = await import(/* @vite-ignore */ '/src/pages/pda-handover-detail.ts')
      detail.handlePdaHandoverDetailEvent(button)
    }, { handoverOrderId: prepared.secondHandoverOrderId, token })
    await expect(page.locator('#pda-handover-detail-toast-root')).toContainText(/失效|重新确认/)
    expect(await page.evaluate(async (handoverOrderId) => {
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      return handover.getPdaHandoverRecordsByHead(handoverOrderId).length
    }, prepared.secondHandoverOrderId)).toBe(0)
    await form.getByRole('button', { name: '取消', exact: true }).click()
    await page.locator('body').evaluate(async (body, data) => {
      const button = document.createElement('button')
      button.dataset.pdaHandoverdAction = 'submit-new-handout-record'
      button.dataset.handoverId = data.handoverOrderId
      button.dataset.waterHandoverConfirmToken = data.token || ''
      button.textContent = '伪造旧确认'
      body.appendChild(button)
      const detail = await import(/* @vite-ignore */ '/src/pages/pda-handover-detail.ts')
      detail.handlePdaHandoverDetailEvent(button)
    }, { handoverOrderId: prepared.handoverOrderId, token })
    await expect(page.locator('#pda-handover-detail-toast-root')).toContainText(/失效|重新确认/)
    const facts = await page.evaluate(async ({ orderId, handoverOrderId }) => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      const handover = await import(/* @vite-ignore */ '/src/data/fcs/pda-handover-events.ts')
      return { status: water.getWaterSolubleWorkOrderById(orderId)?.status, records: handover.getPdaHandoverRecordsByHead(handoverOrderId).length }
    }, { orderId: seed.orderId, handoverOrderId: prepared.handoverOrderId })
    expect(facts).toEqual({ status: 'WAIT_HANDOVER', records: 0 })
  } finally {
    await page.evaluate(async () => {
      const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
      water.resetWaterSolubleDomainForChecks()
      localStorage.removeItem('fcs_pda_session')
    }).catch(() => undefined)
  }
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
