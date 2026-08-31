import { expect, test, type Page } from '@playwright/test'

import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import {
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  createPdaSessionFromUser,
  listFactoryPdaUsers,
} from '../src/data/fcs/store-domain-pda.ts'

test.setTimeout(120_000)

const forbiddenTaskActions = [
  '开工凭证',
  '关键节点上报',
  '补报关键节点',
  '查看开工',
  '查看节点',
  '任务完工',
  '完成任务',
]

function selectInProgressOrder(operationId = 'AUX-OP-DALAN'): SpecialCraftTaskOrder {
  const order = listSpecialCraftTaskOrders().find((item) =>
    item.operationId === operationId
    && item.status === '加工中',
  )
  if (!order) throw new Error(`${operationId} 缺少加工中加工单`)
  return order
}

function selectOrderByTarget(target: '已裁部位' | '成衣' | '辅料' | '捆条'): SpecialCraftTaskOrder {
  const order = listSpecialCraftTaskOrders().find((item) => item.targetObject === target)
  if (!order) throw new Error(`缺少 ${target} 加工单`)
  return order
}

function selectPartialHandoverOrder(): SpecialCraftTaskOrder {
  const order = listSpecialCraftTaskOrders().find((item) =>
    item.taskOrderNo === 'AUX-PO14672-0002-02'
    && item.status === '加工中'
    && item.completedQty > (item.returnedQty || 0),
  )
  if (!order) throw new Error('缺少压褶部分交出演示加工单 AUX-PO14672-0002-02')
  return order
}

async function setPdaSession(page: Page, factoryId: string): Promise<void> {
  const user = listFactoryPdaUsers(factoryId).find((item) =>
    item.status === 'ACTIVE' && ['ROLE_OPERATOR', 'ROLE_ADMIN'].includes(item.roleId),
  )
  if (!user) throw new Error(`${factoryId} 缺少可用 PDA 账号`)
  const session = createPdaSessionFromUser(user)
  await page.addInitScript((value) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(value))
  }, session)
}

async function assertNoTaskExecutionActions(page: Page): Promise<void> {
  const root = page.locator('#app')
  for (const label of forbiddenTaskActions) await expect(root).not.toContainText(label)
  await expect(page.getByRole('button', { name: '开始加工', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '上报差异', exact: true })).toHaveCount(0)
}

async function openWorkOrder(page: Page, order: SpecialCraftTaskOrder): Promise<void> {
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  const targetPath = `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`
  if (page.url() === 'about:blank') {
    const response = await page.goto(targetPath)
    expect(response?.status(), `${order.taskOrderNo} 深链必须返回 200`).toBe(200)
  } else {
    await page.evaluate((path) => {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, targetPath)
  }
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible({ timeout: 30_000 })
}

async function closeCurrentActionDialog(page: Page): Promise<void> {
  const genericDialog = page.getByTestId('process-web-status-action-dialog')
  if (await genericDialog.isVisible().catch(() => false)) {
    await genericDialog.getByTestId('process-web-status-action-cancel').last().click()
    return
  }
  const customDialog = page.locator(
    '#special-craft-garment-sku-dialog, #special-craft-fei-ticket-dialog, #special-craft-button-loop-dialog',
  )
  await expect(customDialog).toBeVisible()
  await customDialog.getByRole('button', { name: '取消', exact: true }).click()
}

async function assertCurrentActionDialogBinding(page: Page, workOrderId: string): Promise<void> {
  const genericDialog = page.getByTestId('process-web-status-action-dialog')
  if (await genericDialog.isVisible().catch(() => false)) {
    await expect(genericDialog).toHaveAttribute('data-source-id', workOrderId)
    return
  }
  const customDialog = page.locator(
    '#special-craft-garment-sku-dialog, #special-craft-fei-ticket-dialog, #special-craft-button-loop-dialog',
  )
  await expect(customDialog).toBeVisible()
  await expect(customDialog.locator('[data-work-order-id]').last()).toHaveAttribute('data-work-order-id', workOrderId)
}

test('特殊工艺 Web 详情以具体加工单为核心，并保留来源任务追溯', async ({ page }) => {
  const order = selectInProgressOrder()
  await openWorkOrder(page, order)

  await expect(page.locator('#app')).toContainText('加工单号')
  await expect(page.locator('#app')).toContainText('加工单 ID')
  await expect(page.locator('#app')).toContainText('来源任务 ID')
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
  await expect(page.locator('#app')).toContainText(order.sourceTaskId || '—')
  await expect(page.getByRole('button', { name: '加工明细', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '操作记录', exact: true })).toBeVisible()
  await assertNoTaskExecutionActions(page)
})

test('加工中加工单只提供四个简化动作，且每个弹窗精确绑定当前 workOrderId', async ({ page }) => {
  const order = selectInProgressOrder()
  await openWorkOrder(page, order)

  const expectedActions = ['确认接收', '加工填报', '发起交出', '完成加工单']
  const actions = page.locator('[data-special-craft-web-action="open-web-status-action-dialog"]')
  await expect(actions).toHaveCount(expectedActions.length)

  for (const actionLabel of expectedActions) {
    const action = actions.filter({ hasText: actionLabel })
    await expect(action).toHaveCount(1)
    await expect(action).toHaveAttribute('data-source-id', order.taskOrderId)
    await action.click()
    await assertCurrentActionDialogBinding(page, order.taskOrderId)
    await closeCurrentActionDialog(page)
  }

  await assertNoTaskExecutionActions(page)
})

test('PDA 按具体加工单进入，所有执行载荷同时保留加工单和来源任务 ID', async ({ page }) => {
  const order = selectInProgressOrder()
  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`)

  await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
  await expect(page.locator('#app')).toContainText(order.sourceTaskId || '')
  await expect(page.locator('#app')).toContainText(order.sourceTaskNo || order.sourceTaskId || '')
  await expect(page.locator('.production-object-floating-entry')).toHaveCount(0)

  const actions = page.locator('[data-pda-execd-action][data-work-order-id]')
  expect(await actions.count()).toBeGreaterThan(0)
  for (let index = 0; index < await actions.count(); index += 1) {
    await expect(actions.nth(index)).toHaveAttribute('data-work-order-id', order.taskOrderId)
    await expect(actions.nth(index)).toHaveAttribute('data-source-task-id', order.sourceTaskId || '')
  }
  await assertNoTaskExecutionActions(page)
})

test('PDA 列表不显示 Web 分页和全局悬浮搜索，较长列表只提供继续显示', async ({ page }) => {
  const order = selectPartialHandoverOrder()
  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')

  const listRoot = page.locator('[data-testid="pda-exec-card-list"]')
  await expect(listRoot).toBeVisible()
  await expect(page.locator('.production-object-floating-entry')).toHaveCount(0)
  await expect(listRoot.locator('[data-pda-exec-pagination]')).toHaveCount(0)
  await expect(listRoot).not.toContainText('上一页')
  await expect(listRoot).not.toContainText('下一页')
  await expect(listRoot).not.toContainText('每页 10 条')
  const progressiveControl = listRoot.locator('[data-pda-exec-load-more="special-craft"]')
  if (await progressiveControl.count()) {
    await expect(progressiveControl.getByRole('button', { name: /继续显示 \d+ 条/ })).toBeVisible()
  }
})

test('PDA 发起交出按菲票填写本次数量，可部分交出并显示业务留痕 ID', async ({ page }) => {
  const order = selectPartialHandoverOrder()
  const line = order.lineProgress?.find((item) => item.feiTicketNo)
  if (!line?.feiTicketNo) throw new Error(`${order.taskOrderNo} 缺少菲票明细`)
  const availableQty = line.completedQty - line.returnedQty
  const partialQty = Math.max(1, Math.floor(availableQty / 3))

  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}?surface=handover&handoverAction=handout`)

  await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible()
  await expect(page.locator('.production-object-floating-entry')).toHaveCount(0)
  const qtyInput = page.getByLabel(`${line.feiTicketNo}本次交出数量`)
  await expect(qtyInput).toHaveValue(String(availableQty))
  await qtyInput.fill(String(partialQty))
  await page.getByLabel('交出备注（选填）').fill('PDA 部分交出验证')

  const submit = page.getByRole('button', { name: '确认发起交出', exact: true })
  await expect(submit).toHaveAttribute('data-work-order-id', order.taskOrderId)
  await expect(submit).toHaveAttribute('data-source-task-id', order.sourceTaskId || '')
  await submit.click()

  await expect(page.locator('[data-line-progress-key]')).toContainText(`累计交出：${partialQty} 片`)
  await expect(page.locator('#app')).toContainText('业务记录 ID：PAO-')
  await expect(page.locator('#app')).toContainText('交出记录 ID：')
  await expect(page.locator('#app')).toContainText(`PDA 部分交出验证`)
  await expect(page.locator('[data-line-progress-key] input')).toHaveValue(String(availableQty - partialQty))
})

test('旧任务详情地址仅兼容重定向到唯一加工单地址', async ({ page }) => {
  const order = selectInProgressOrder()
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  await page.goto(`/fcs/process-factory/special-craft/${slug}/tasks/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page).toHaveURL(new RegExp(`${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}(?:\\?|$)`))
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible()
})

test('裁片、成衣、辅料和盘扣加工单保持各自对象与数量单位', async ({ page }) => {
  const cases = [
    { order: selectOrderByTarget('已裁部位'), labels: ['裁片', '菲票', '片'] },
    { order: selectOrderByTarget('成衣'), labels: ['成衣', 'SKU', '件'] },
    { order: selectOrderByTarget('辅料'), labels: ['辅料', '投入单位', '产出单位', '条'] },
    { order: selectOrderByTarget('捆条'), labels: ['捆条投入与盘扣产出', '张', '个', '中央辅料仓'] },
  ]

  for (const current of cases) {
    await openWorkOrder(page, current.order)
    for (const label of current.labels) await expect(page.locator('#app')).toContainText(label)
    await assertNoTaskExecutionActions(page)
  }
})
