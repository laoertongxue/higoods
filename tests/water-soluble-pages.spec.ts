import { expect, test, type Page } from '@playwright/test'
import { canAssignWaterSolubleFactory, listWaterSolubleWorkOrders } from '../src/data/fcs/water-soluble-task-domain.ts'
import { createPdaSessionFromUser, listAllFactoryPdaUsers, listFactoryPdaUsers } from '../src/data/fcs/store-domain-pda.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

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

async function rememberMain(page: Page): Promise<void> {
  await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __waterMain?: Element }).__waterMain = node
  })
}

async function expectSameMain(page: Page): Promise<void> {
  await expect.poll(() => page.locator('main').evaluate((node) => {
    const remembered = (window as typeof window & { __waterMain?: Element }).__waterMain
    return remembered === node && remembered?.isConnected === true
  })).toBe(true)
}

async function loginForSeededOrder(page: Page, status: string, roleIds: string[] = ['ROLE_OPERATOR']): Promise<{ factoryId: string; orderId: string; plannedQty: number }> {
  const order = listWaterSolubleWorkOrders().find((item) => item.status === status && item.factoryId)
  if (!order?.factoryId) throw new Error(`缺少状态为 ${status} 的确定性水溶演示单`)
  const user = listFactoryPdaUsers(order.factoryId).find((item) => item.status === 'ACTIVE' && roleIds.includes(item.roleId))
  if (!user) throw new Error(`工厂 ${order.factoryId} 缺少角色 ${roleIds.join('/')} 的可用 PDA 用户`)
  const session = createPdaSessionFromUser(user)
  await page.goto('/fcs/workbench/overview')
  await page.evaluate((value) => window.localStorage.setItem('fcs_pda_session', JSON.stringify(value)), session)
  return { factoryId: order.factoryId, orderId: order.waterOrderId, plannedQty: order.plannedQty }
}

async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function arrangePfosOrderForRole(
  page: Page,
  status: 'WAIT_MATERIAL' | 'WAIT_WATER_SOLUBLE' | 'WATER_SOLUBLE_IN_PROGRESS' | 'PRODUCTION_PAUSED' | 'WAIT_HANDOVER',
  roleId: 'ROLE_OPERATOR' | 'ROLE_PRODUCTION' | 'ROLE_HANDOVER' | 'ROLE_ADMIN',
): Promise<{ orderId: string; factoryId: string; userName: string }> {
  await page.goto('/')
  const arranged = await page.evaluate(async ({ targetStatus, targetRole }) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const pda = await import(/* @vite-ignore */ '/src/data/fcs/store-domain-pda.ts')
    const store = await import(/* @vite-ignore */ '/src/state/store.ts')
    water.resetWaterSolubleDomainForChecks({ seedDemo: true })
    let order = water.listWaterSolubleWorkOrders().find((item) => item.status === targetStatus && item.factoryId)
    if (!order && targetStatus === 'WAIT_MATERIAL') {
      const unassigned = water.listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')
      if (!unassigned) throw new Error('缺少可派厂水溶单')
      const result = water.assignWaterSolubleFactory(unassigned.waterOrderId, 'F090')
      if (!result.ok || !result.order) throw new Error(result.message)
      order = result.order
    }
    if (!order && (targetStatus === 'WAIT_WATER_SOLUBLE' || targetStatus === 'WAIT_HANDOVER')) {
      const paused = water.listWaterSolubleWorkOrders().find((item) => item.status === 'PRODUCTION_PAUSED' && item.factoryId)
      if (!paused) throw new Error('缺少生产暂停水溶单')
      const result = water.resolveWaterSolublePause(paused.waterOrderId, targetStatus === 'WAIT_HANDOVER' ? 'CONTINUE_WITH_ACTUAL_QTY' : 'CONTINUE_PROCESSING')
      if (!result.ok || !result.order) throw new Error(result.message)
      order = result.order
    }
    if (!order?.factoryId || order.status !== targetStatus) throw new Error(`无法构造 ${targetStatus} 水溶单`)
    const user = pda.listFactoryPdaUsers(order.factoryId).find((item) => item.status === 'ACTIVE' && item.roleId === targetRole)
      || await pda.createFactoryPdaUser({ factoryId: order.factoryId, name: `任务3-${targetRole}`, loginId: `${order.factoryId}_task3_${targetRole}`, password: '123456', roleId: targetRole, createdBy: 'Playwright任务3' })
    localStorage.setItem('fcs_pda_session', JSON.stringify(pda.createPdaSessionFromUser(user)))
    store.appStore.navigate('/fcs/craft/dyeing/water-soluble-orders')
    return { orderId: order.waterOrderId, factoryId: order.factoryId, userName: user.name }
  }, { targetStatus: status, targetRole: roleId })
  await expect(page).toHaveURL('/fcs/craft/dyeing/water-soluble-orders')
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toBeVisible()
  await expect(page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${arranged.orderId}"]`)).toBeVisible()
  return arranged
}

async function openPausedSupervisor(page: Page): Promise<void> {
  await loginForSeededOrder(page, 'PRODUCTION_PAUSED', ['ROLE_PRODUCTION', 'ROLE_ADMIN'])
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toBeVisible()
  await page.getByRole('button', { name: '主管处理' }).click()
}

async function confirmSupervisorDecision(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label }).click()
  await expect(page.getByRole('heading', { name: `确认${label}` })).toBeVisible()
  await page.getByRole('button', { name: label }).click()
}

async function openCompletionDialog(page: Page): Promise<{ orderId: string; plannedQty: number }> {
  const arranged = await loginForSeededOrder(page, 'WATER_SOLUBLE_IN_PROGRESS')
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  await page.getByTestId('factory-water-soluble-card').filter({ has: page.getByRole('button', { name: '上报完成数量' }) }).getByRole('button', { name: '上报完成数量' }).click()
  await expect(page.getByRole('heading', { name: '上报完成数量' })).toBeVisible()
  return { orderId: arranged.orderId, plannedQty: arranged.plannedQty }
}

test('FCS 展示款式及完整事实详情', async ({ page }) => {
  await page.goto('/fcs/process/water-soluble-orders')
  await expect(page.getByTestId('water-soluble-orders-page')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '款号或款式' })).toBeVisible()
  await expect(page.getByText(/SPU-|未记录/).first()).toBeVisible()
  await page.getByRole('button', { name: '查看详情' }).first().click()
  const overlay = page.locator('[data-water-soluble-overlay]')
  await expect(overlay).toContainText('工艺要求')
  await expect(overlay).toContainText('PDA 执行记录')
  await expect(overlay).toContainText('交接与收货结果')
  await expect(overlay).toContainText('主管处理记录')
})

test('FCS 使用领域真实任务号和交接单号进入执行事实', async ({ page }) => {
  await page.goto('/fcs/process/water-soluble-orders')
  await expect(page.getByText('统一执行详情入口待后续任务接入')).toHaveCount(0)
  const taskButton = page.getByRole('button', { name: '查看任务' }).first()
  const taskId = await taskButton.getAttribute('data-task-id')
  expect(taskId).toBeTruthy()
  await taskButton.click()
  await expect(page).toHaveURL(`/fcs/pda/exec/${encodeURIComponent(taskId!)}`)

  const handover = await arrangePfosOrderForRole(page, 'WAIT_HANDOVER', 'ROLE_ADMIN')
  await page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${handover.orderId}"]`).getByRole('button', { name: '现在交出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/[^?]+\?action=new-record/)
  const handoverOrderId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1) || '')
  expect(handoverOrderId).toBeTruthy()
  await navigateInApp(page, '/fcs/process/water-soluble-orders')
  const handoverRow = page.locator(`button[data-order-id="${handover.orderId}"]`).first().locator('xpath=ancestor::tr')
  const handoverButton = handoverRow.getByRole('button', { name: '查看交接' })
  await expect(handoverButton).toHaveAttribute('data-handover-order-id', handoverOrderId)
  await handoverButton.click()
  await expect(page).toHaveURL(`/fcs/pda/handover/${encodeURIComponent(handoverOrderId)}`)
})

test('PFOS 真实 PDA 动作后展示最近操作人、动作和时间', async ({ page }) => {
  const arranged = await arrangePfosOrderForRole(page, 'WAIT_WATER_SOLUBLE', 'ROLE_OPERATOR')
  const card = page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${arranged.orderId}"]`)
  await card.getByRole('button', { name: '开始水溶' }).click()
  await expect(card).toContainText(`PDA 操作人：${arranged.userName}`)
  await expect(card).toContainText(/最近操作：开始水溶 · \d{4}-\d{2}-\d{2}/)
  await expect(card).not.toContainText('领域暂未记录')
})

test('FCS input、select、分页和抽屉保持 main 节点及输入焦点', async ({ page }) => {
  await page.goto('/fcs/process/water-soluble-orders')
  await expect(page.getByTestId('water-soluble-orders-page')).toBeVisible()
  await rememberMain(page)
  const keyword = page.getByPlaceholder('加工单号 / 生产单号 / 物料')
  const fcsTiming = await keyword.evaluate(async (input: HTMLInputElement) => {
    const main = document.querySelector('main')
    const previousList = document.querySelector('[data-water-soluble-list-region]')
    input.focus()
    const startedAt = performance.now()
    const listReady = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const currentList = document.querySelector('[data-water-soluble-list-region]')
        if (!currentList || currentList === previousList || !currentList.isConnected) return
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
    input.value = 'PO-202603-081'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await listReady
    const elapsed = performance.now() - startedAt
    const currentList = document.querySelector('[data-water-soluble-list-region]')
    return {
      elapsed,
      sameMain: main === document.querySelector('main') && main?.isConnected === true,
      listUpdated: Boolean(currentList && currentList !== previousList && currentList.isConnected),
      focused: document.activeElement === input,
      value: input.value,
    }
  })
  console.log(`[performance] FCS 水溶关键词筛选 ${fcsTiming.elapsed.toFixed(3)}ms`)
  expect(fcsTiming.elapsed).toBeLessThan(200)
  expect(fcsTiming).toMatchObject({ sameMain: true, listUpdated: true, focused: true, value: 'PO-202603-081' })
  await expect(keyword).toBeFocused()
  await expect(keyword).toHaveValue('PO-202603-081')
  await expectSameMain(page)
  await page.locator('[data-water-soluble-field="status"]').selectOption('WAIT_FACTORY_ASSIGNMENT')
  await expectSameMain(page)
  await page.locator('[data-testid="water-soluble-pagination"] select').selectOption('20')
  await expectSameMain(page)
  const pageSize = page.locator('[data-testid="water-soluble-pagination"] select')
  await pageSize.evaluate((select) => {
    const option = document.createElement('option')
    option.value = 'Infinity'
    option.textContent = 'Infinity'
    select.appendChild(option)
  })
  await pageSize.selectOption('Infinity')
  await expect(page.locator('[data-testid="water-soluble-pagination"] select')).toHaveValue('10')
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expectSameMain(page)
})

test('FCS 派厂抽屉只展示领域允许派单的水溶染厂', async ({ page }) => {
  const expectedFactoryIds = listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .filter((factory) => canAssignWaterSolubleFactory(factory.id).ok)
    .map((factory) => factory.id)
    .sort()
  await page.goto('/fcs/process/water-soluble-orders')
  await page.getByRole('button', { name: '分配染厂' }).first().click()
  const options = page.locator('[data-water-soluble-field="assignFactoryId"] option')
  await expect(options).toHaveCount(expectedFactoryIds.length + 1)
  for (const factoryId of expectedFactoryIds) {
    await expect(page.locator(`[data-water-soluble-field="assignFactoryId"] option[value="${factoryId}"]`)).toHaveCount(1)
  }
})

test('PFOS 无可信 session 时仅管理预览且 URL 不能开启动作', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  await navigateInApp(page, '/fcs/craft/dyeing/water-soluble-orders?factoryId=F090')
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toContainText('管理预览')
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toContainText('只读')
  for (const action of ['material-ready', 'start', 'complete', 'open-supervisor', 'open-handover', 'confirm-handover']) {
    await expect(page.locator(`[data-factory-water-soluble-action="${action}"]`)).toHaveCount(0)
  }
})

test('PFOS 伪造 URL 和注入外厂 orderId 都不能扩大当前工厂权限', async ({ page }) => {
  const current = await loginForSeededOrder(page, 'WATER_SOLUBLE_IN_PROGRESS')
  const foreignUser = listAllFactoryPdaUsers().find((item) => item.status === 'ACTIVE' && item.factoryId !== current.factoryId)
  expect(foreignUser).toBeTruthy()
  const foreignSession = createPdaSessionFromUser(foreignUser!)
  await page.evaluate((value) => window.localStorage.setItem('fcs_pda_session', JSON.stringify(value)), foreignSession)
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  await navigateInApp(page, `/fcs/craft/dyeing/water-soluble-orders?factoryId=${encodeURIComponent(current.factoryId)}`)
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toContainText('查看条件不属于当前登录工厂')
  await page.evaluate((orderId) => {
    const button = document.createElement('button')
    button.dataset.factoryWaterSolubleAction = 'material-ready'
    button.dataset.orderId = orderId || ''
    button.dataset.skipPageRerender = 'true'
    document.querySelector('[data-testid="factory-water-soluble-orders-page"]')?.appendChild(button)
    button.click()
    button.remove()
  }, current.orderId)
  await expect(page.getByText(/当前账号不属于该加工单工厂/)).toBeVisible()
  await page.goto('/fcs/process/water-soluble-orders')
  const protectedRow = page.locator(`button[data-order-id="${current.orderId}"]`).first().locator('xpath=ancestor::tr')
  await expect(protectedRow).toContainText('水溶中')
})

test('PFOS 合法当前工厂动作成功且 pageSize 只接受白名单', async ({ page }) => {
  await loginForSeededOrder(page, 'WATER_SOLUBLE_IN_PROGRESS')
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  await expect(page.getByRole('button', { name: '上报完成数量' })).toBeVisible()
  const status = page.locator('[data-factory-water-soluble-field="status"]')
  const pfosTiming = await status.evaluate(async (select: HTMLSelectElement) => {
    const main = document.querySelector('main')
    const previousList = document.querySelector('[data-factory-water-soluble-list-region]')
    select.focus()
    const startedAt = performance.now()
    const listReady = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const currentList = document.querySelector('[data-factory-water-soluble-list-region]')
        if (!currentList || currentList === previousList || !currentList.isConnected) return
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
    select.value = 'WATER_SOLUBLE_IN_PROGRESS'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await listReady
    const elapsed = performance.now() - startedAt
    const currentList = document.querySelector('[data-factory-water-soluble-list-region]')
    return {
      elapsed,
      sameMain: main === document.querySelector('main') && main?.isConnected === true,
      listUpdated: Boolean(currentList && currentList !== previousList && currentList.isConnected),
      focused: document.activeElement === select,
      value: select.value,
    }
  })
  console.log(`[performance] PFOS 水溶状态筛选 ${pfosTiming.elapsed.toFixed(3)}ms`)
  expect(pfosTiming.elapsed).toBeLessThan(200)
  expect(pfosTiming).toMatchObject({ sameMain: true, listUpdated: true, focused: true, value: 'WATER_SOLUBLE_IN_PROGRESS' })
  const pageSize = page.locator('[data-testid="factory-water-soluble-pagination"] select')
  await pageSize.evaluate((select) => {
    const option = document.createElement('option')
    option.value = '-1'
    option.textContent = '-1'
    select.appendChild(option)
  })
  await pageSize.selectOption('-1')
  await expect(page.locator('[data-testid="factory-water-soluble-pagination"] select')).toHaveValue('10')
})

test('PFOS 同厂操作员不能查看或注入主管处理动作', async ({ page }) => {
  const arranged = await loginForSeededOrder(page, 'PRODUCTION_PAUSED', ['ROLE_OPERATOR'])
  await page.goto('/fcs/craft/dyeing/water-soluble-orders')
  const pausedCard = page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${arranged.orderId}"]`)
  await expect(pausedCard).toContainText('生产暂停')
  await expect(pausedCard.getByRole('button', { name: '主管处理' })).toHaveCount(0)
  await page.evaluate((orderId) => {
    const button = document.createElement('button')
    button.dataset.factoryWaterSolubleAction = 'select-supervisor-decision'
    button.dataset.orderId = orderId
    button.dataset.decision = 'CONTINUE_PROCESSING'
    button.dataset.skipPageRerender = 'true'
    document.querySelector('[data-testid="factory-water-soluble-orders-page"]')?.appendChild(button)
    button.click()
    button.remove()
  }, arranged.orderId)
  await expect(page.getByText(/当前账号不能处理水溶生产暂停/)).toBeVisible()
  await expect(pausedCard).toContainText('生产暂停')
})

test('PFOS 同厂操作员完成后不能查看或注入交出动作', async ({ page }) => {
  const { orderId, plannedQty } = await openCompletionDialog(page)
  await page.locator('[data-factory-water-soluble-field="completedQty"]').fill(String(plannedQty))
  await page.getByRole('button', { name: '确认上报' }).click()
  const handoverCard = page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${orderId}"]`)
  await expect(handoverCard).toContainText('待交出')
  await expect(handoverCard.getByRole('button', { name: '现在交出' })).toHaveCount(0)
  await page.evaluate((id) => {
    const button = document.createElement('button')
    button.dataset.factoryWaterSolubleAction = 'open-handover'
    button.dataset.orderId = id
    button.dataset.skipPageRerender = 'true'
    document.querySelector('[data-testid="factory-water-soluble-orders-page"]')?.appendChild(button)
    button.click()
    button.remove()
  }, orderId)
  await expect(page.getByText(/当前账号不能执行水溶交出/)).toBeVisible()
  await expect(handoverCard).toContainText('待交出')
})

for (const roleId of ['ROLE_PRODUCTION', 'ROLE_ADMIN'] as const) {
  test(`PFOS ${roleId} 在普通执行状态不显示操作员按钮`, async ({ page }) => {
    const actionByStatus = {
      WAIT_MATERIAL: '确认原料到位',
      WAIT_WATER_SOLUBLE: '开始水溶',
      WATER_SOLUBLE_IN_PROGRESS: '上报完成数量',
    } as const
    for (const [status, actionLabel] of Object.entries(actionByStatus)) {
      const arranged = await arrangePfosOrderForRole(page, status as keyof typeof actionByStatus, roleId)
      const card = page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${arranged.orderId}"]`)
      await expect(card).toBeVisible()
      await expect(card.getByRole('button', { name: actionLabel, exact: true })).toHaveCount(0)
    }
  })
}

test('PFOS 交接员只在待交出显示交出动作且管理员保留主管和交接兜底', async ({ page }) => {
  const handover = await arrangePfosOrderForRole(page, 'WAIT_HANDOVER', 'ROLE_HANDOVER')
  await expect(page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${handover.orderId}"]`).getByRole('button', { name: '现在交出', exact: true })).toBeVisible()
  for (const label of ['确认原料到位', '开始水溶', '上报完成数量', '主管处理']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }

  const paused = await arrangePfosOrderForRole(page, 'PRODUCTION_PAUSED', 'ROLE_ADMIN')
  await expect(page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${paused.orderId}"]`).getByRole('button', { name: '主管处理', exact: true })).toBeVisible()

  const adminHandover = await arrangePfosOrderForRole(page, 'WAIT_HANDOVER', 'ROLE_ADMIN')
  await expect(page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${adminHandover.orderId}"]`).getByRole('button', { name: '现在交出', exact: true })).toBeVisible()
})

test('PFOS 短量必须填写真实原因并保留日志', async ({ page }) => {
  const { orderId, plannedQty } = await openCompletionDialog(page)
  await page.locator('[data-factory-water-soluble-field="completedQty"]').fill(String(plannedQty - 1))
  await page.getByRole('button', { name: '确认上报' }).click()
  await expect(page.getByText('数量与计划不一致，请填写原因。')).toBeVisible()
  await expect(page.getByRole('heading', { name: '上报完成数量' })).toBeVisible()
  await page.locator('[data-factory-water-soluble-field="completionReason"]').fill('现场实测短少 1 米')
  await page.getByRole('button', { name: '确认上报' }).click()
  const pausedCard = page.locator(`[data-testid="factory-water-soluble-card"][data-order-id="${orderId}"]`)
  await expect(pausedCard).toContainText('现场实测短少 1 米')
  await pausedCard.getByRole('button', { name: '查看任务详情与记录' }).click()
  await expect(page.locator('[data-factory-water-soluble-overlay]')).toContainText('现场实测短少 1 米')
})

test('PFOS 超量必须二次确认，取消无副作用，确认后保存真实原因', async ({ page }) => {
  const { plannedQty } = await openCompletionDialog(page)
  await page.locator('[data-factory-water-soluble-field="completedQty"]').fill(String(plannedQty + 1))
  await page.locator('[data-factory-water-soluble-field="completionReason"]').fill('复尺后多出 1 米')
  await page.getByRole('button', { name: '确认上报' }).click()
  await expect(page.getByRole('heading', { name: '确认超量完成' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('heading', { name: '上报完成数量' })).toBeVisible()

  await page.getByRole('button', { name: '确认上报' }).click()
  await page.getByRole('button', { name: '确认超量并上报' }).click()
  const handoverCard = page.getByTestId('factory-water-soluble-card').filter({ hasText: '待交出' })
  await expect(handoverCard).toContainText('复尺后多出 1 米')
})

test('PFOS 非有限数和非正数均中文拦截且无副作用', async ({ page }) => {
  await openCompletionDialog(page)
  const input = page.locator('[data-factory-water-soluble-field="completedQty"]')
  for (const value of ['NaN', 'Infinity', '0']) {
    await input.fill(value)
    await page.getByRole('button', { name: '确认上报' }).click()
    await expect(page.getByText(value === '0' ? '完成数量必须大于 0。' : '完成数量必须是有限数字。').last()).toBeVisible()
    await expect(page.getByRole('heading', { name: '上报完成数量' })).toBeVisible()
  }
})

test('PFOS 主管选择继续补做并局部刷新', async ({ page }) => {
  await openPausedSupervisor(page)
  await rememberMain(page)
  await confirmSupervisorDecision(page, '继续补做')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始水溶' })).toHaveCount(0)
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' })).toContainText('等待有权限角色处理')
  await expectSameMain(page)
})

test('PFOS 主管选择按实际数量继续交出', async ({ page }) => {
  await openPausedSupervisor(page)
  const pausedCard = page.getByTestId('factory-water-soluble-card').filter({ hasText: '生产暂停' })
  const orderId = await pausedCard.getAttribute('data-order-id')
  expect(orderId).toBeTruthy()
  await confirmSupervisorDecision(page, '按实际数量继续交出')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待交出' })).toBeVisible()
  await expect(page.getByRole('button', { name: '现在交出' })).toBeVisible()
  const expected = await page.evaluate(async (id) => {
    const water = await import(/* @vite-ignore */ '/src/data/fcs/water-soluble-task-domain.ts')
    const order = water.getWaterSolubleWorkOrderById(id || '')
    return order ? { materialName: order.materialName, qtyUnit: order.qtyUnit } : null
  }, orderId)
  expect(expected).toBeTruthy()
  await page.getByRole('button', { name: '现在交出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/[^?]+\?action=new-record/)
  await expect(page.getByText('水溶加工单', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(expected!.materialName, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(new RegExp(`计划交出物料数量（${expected!.qtyUnit}）`)).first()).toBeVisible()
})

test('PFOS 主管选择退回重做', async ({ page }) => {
  await openPausedSupervisor(page)
  await confirmSupervisorDecision(page, '退回重做')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' })).toBeVisible()
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' }).getByText('0 米', { exact: true })).toBeVisible()
})
