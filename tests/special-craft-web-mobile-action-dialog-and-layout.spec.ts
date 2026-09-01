import { expect, test, type Locator, type Page } from '@playwright/test'

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

async function expectBefore(first: Locator, second: Locator): Promise<void> {
  const secondHandle = await second.elementHandle()
  if (!secondHandle) throw new Error('缺少用于顺序断言的第二个节点')
  const firstComesBefore = await first.evaluate((firstNode, secondNode) => (
    Boolean(firstNode.compareDocumentPosition(secondNode) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), secondHandle)
  expect(firstComesBefore).toBe(true)
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
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  await expect(actionPanel).toBeVisible()
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expect(workOrderDetails.getByText(order.taskOrderId)).toBeHidden()
  await expectBefore(actionPanel, workOrderDetails)
  await expect(page.locator('body')).not.toContainText('查看历史和流转')
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

test('PDA 列表不显示 Web 分页和加载按钮，滑到底部自动追加加工单', async ({ page }) => {
  const order = selectPartialHandoverOrder()
  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')

  const listRoot = page.locator('[data-testid="pda-exec-card-list"]')
  await expect(listRoot).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.production-object-floating-entry')).toHaveCount(0)
  await expect(listRoot.locator('[data-pda-exec-pagination]')).toHaveCount(0)
  await expect(listRoot).not.toContainText('上一页')
  await expect(listRoot).not.toContainText('下一页')
  await expect(listRoot).not.toContainText('每页 10 条')
  await expect(listRoot).not.toContainText(/已显示 \d+ \/ \d+ 条/)
  await expect(listRoot).not.toContainText(/继续显示 \d+ 条/)
  await expect(listRoot.locator('[data-pda-exec-action="load-more"]')).toHaveCount(0)

  const doneTab = page.locator('[data-testid="pda-exec-special-craft-tabs"] [data-tab="DONE"]')
  await doneTab.click()
  const cards = listRoot.locator('[data-testid="pda-exec-work-order-card"]')
  await expect(cards).toHaveCount(10)
  const originalList = await listRoot.elementHandle()
  const sentinel = listRoot.locator('[data-pda-exec-auto-load-sentinel="special-craft"]')
  const scrollContainer = page.locator('[data-pda-scroll-container="true"]')
  await expect(sentinel).toHaveCount(1)
  await sentinel.evaluate((node) => node.scrollIntoView({ block: 'end' }))
  await expect.poll(async () => scrollContainer.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  await expect(cards).toHaveCount(20)
  await expect(sentinel).toHaveCount(1)
  await sentinel.evaluate((node) => node.scrollIntoView({ block: 'end' }))
  await expect(cards).toHaveCount(27)
  await expect(sentinel).toHaveCount(0)
  expect(await scrollContainer.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  expect(await originalList!.evaluate((node) => node.isConnected)).toBe(true)
  await page.screenshot({
    path: 'output/playwright/pda-density-fix/exec-auto-load-final-360x640.png',
    fullPage: false,
  })
})

test('PDA 发起交出逐张扫描菲票，可部分交出且不在操作页展示历史流转', async ({ page }) => {
  const order = selectPartialHandoverOrder()
  const line = order.lineProgress?.find((item) => item.feiTicketNo)
  if (!line?.feiTicketNo) throw new Error(`${order.taskOrderNo} 缺少菲票明细`)
  const availableQty = line.completedQty - line.returnedQty
  const partialQty = Math.max(1, Math.floor(availableQty / 3))

  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}?surface=handover&handoverAction=handout`)

  await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.production-object-floating-entry')).toHaveCount(0)
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  await expect(actionPanel).toBeVisible()
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expectBefore(actionPanel, workOrderDetails)
  await expect(page.locator('body')).not.toContainText('查看历史和流转')
  await expect(page.getByLabel('交出备注（选填）')).toHaveCount(0)
  const scanInput = page.getByLabel('扫描或输入加工后裁片菲票')
  await expect(scanInput).toBeFocused()
  const submit = page.locator('[data-pda-execd-action="special-submit-handover"]')
  await expect(submit).toBeDisabled()

  await scanInput.fill('FT-NOT-IN-CURRENT-WORK-ORDER')
  await scanInput.press('Enter')
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('不属于当前加工单')

  await page.getByLabel('扫描或输入加工后裁片菲票').fill(line.feiTicketNo)
  await page.getByLabel('扫描或输入加工后裁片菲票').press('Enter')
  await expect(page.locator('[data-pda-physical-scan-line]')).toHaveCount(1)
  await expect(page.locator('[data-pda-physical-scan-line]')).toContainText('扫码')
  const qtyInput = page.getByLabel(`${line.feiTicketNo}本次数量`)
  await expect(qtyInput).toHaveValue(String(availableQty))
  await qtyInput.fill(String(partialQty))
  await expect(page.locator('[data-pda-physical-scan-total]')).toHaveText(`合计 ${partialQty} 片`)
  await qtyInput.fill(String(availableQty + 1))
  await expect(qtyInput).toHaveAttribute('aria-invalid', 'true')
  await expect(submit).toBeDisabled()
  await qtyInput.fill(String(partialQty))
  await expect(qtyInput).not.toHaveAttribute('aria-invalid', 'true')
  await expect(submit).toBeEnabled()
  await page.screenshot({ path: 'output/playwright/pda-density-fix/special-craft-handout-physical-scan-360x640.png', fullPage: true })

  await page.getByLabel('扫描或输入加工后裁片菲票').fill(line.feiTicketNo)
  await page.getByLabel('扫描或输入加工后裁片菲票').press('Enter')
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('已经扫过')

  await expect(submit).toHaveText('确认本批交出（1 张）')
  await expect(submit).toHaveAttribute('data-work-order-id', order.taskOrderId)
  await expect(submit).toHaveAttribute('data-source-task-id', order.sourceTaskId || '')
  await submit.click()

  await expect(page.locator('#app')).toContainText(`累计交出：${partialQty} 片`)
  await expect(page.locator('#app')).not.toContainText('业务记录 ID：')
  await expect(page.locator('#app')).not.toContainText('交出记录 ID：')
  await expect(page.locator('#app')).not.toContainText('最近扫码批次')
})

test('PDA 辅料接收使用单一输入框，扫码和手动输入走同一标签校验和留痕', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) =>
    item.targetObject === '辅料'
    && item.status === '待接收'
    && (item.inputPlannedQty || 0) > (item.inputReceivedQty || 0),
  )
  if (!order) throw new Error('缺少待接收的辅料加工单')

  await setPdaSession(page, order.factoryId)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}?surface=handover&handoverAction=receive`)

  const panel = page.locator('[data-pda-physical-scan-panel]')
  const actionPanel = page.getByTestId('pda-work-order-action-panel')
  const workOrderDetails = page.getByTestId('pda-work-order-details')
  await expect(panel).toBeVisible({ timeout: 30_000 })
  await expect(actionPanel).toBeVisible()
  await expect(workOrderDetails).toBeVisible()
  await expect(workOrderDetails).not.toHaveAttribute('open', '')
  await expectBefore(actionPanel, workOrderDetails)
  const unifiedInput = page.getByLabel('扫描或输入面料／辅料标签')
  await expect(unifiedInput).toBeFocused()
  await expect(panel.locator('input[data-pda-execd-field="specialCraftAccessoryQty"]')).toHaveCount(0)
  await expect(panel.locator('details').filter({ hasText: '无法扫码？手动输入' })).toHaveCount(0)
  await page.screenshot({ path: 'output/playwright/pda-density-fix/accessory-receive-unified-input-360x640.png', fullPage: true })

  const materialCode = `MAT-${order.taskOrderNo}-01`
  await unifiedInput.fill(materialCode)
  await page.getByRole('button', { name: '加入本批', exact: true }).click()
  await expect(panel.locator('[data-pda-physical-scan-line]')).toContainText('手动录入')
  const submit = page.locator('[data-pda-execd-action="special-confirm-receive"]')
  await expect(submit).toHaveText('确认本批接收（1 张）')
  await submit.click()

  await expect(page.locator('#app')).not.toContainText('业务记录 ID：')
  await expect(page.locator('#app')).not.toContainText('最近扫码批次')
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
