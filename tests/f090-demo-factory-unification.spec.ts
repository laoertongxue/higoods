import { expect, test } from '@playwright/test'

import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { createPdaSessionFromUser, listFactoryPdaUsers } from '../src/data/fcs/store-domain-pda.ts'

const DEMO_FACTORY_LABEL = '全能力测试工厂（F090）'
const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-28 10:00:00',
}

async function openPdaExec(page: import('@playwright/test').Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/exec')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
}

async function setPdaSessionForFactory(page: import('@playwright/test').Page, factoryId: string) {
  const user = listFactoryPdaUsers(factoryId).find((item) =>
    item.status === 'ACTIVE' && ['ROLE_OPERATOR', 'ROLE_ADMIN'].includes(item.roleId),
  )
  if (!user) throw new Error(`${factoryId} 缺少可用 PDA 账号`)
  const session = createPdaSessionFromUser(user)
  await page.addInitScript((value) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(value))
  }, session)
}

async function searchPdaTask(page: import('@playwright/test').Page, taskNo: string) {
  await page.goto(`/fcs/pda/exec?tab=NOT_STARTED&keyword=${encodeURIComponent(taskNo)}`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue(taskNo)
  await expect(page.getByText(taskNo).first()).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
}

test('印花和染色加工单列表与详情展示全能力测试工厂编号', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  await expect(page.getByRole('heading', { name: '印花加工单', exact: true })).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
  await expect(page.getByText('PT Prima Printing Center')).toHaveCount(0)

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/PWO-PRINT-/)
  await expect(page.getByRole('heading', { name: /印花加工单详情/ })).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()

  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单', exact: true })).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
  await expect(page.getByText('PT Cahaya Dyeing Sejahtera')).toHaveCount(0)

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-001')
  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders\/DWO-/)
  await expect(page.getByRole('heading', { name: /染色加工单详情/ })).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
})

test('辅助/特殊工艺保留各自实际执行工厂，不借用 F090 作为通过证据', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.status === '加工中')
  if (!order) throw new Error('缺少可执行特殊工艺加工单')
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders`)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单` })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#app')).toContainText(order.factoryName)

  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#app')).toContainText(order.factoryName)
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
})

test('F090 工厂端执行列表只验证其实际归属的印花、染色和裁片任务', async ({ page }) => {
  await openPdaExec(page)

  await searchPdaTask(page, 'TASK-PRINT-000716')
  await searchPdaTask(page, 'TASK-DYE-000726')
  await searchPdaTask(page, 'TASK-CUT-000097')
})

test('辅助/特殊工艺在加工单实际工厂账号下进入具体加工单', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.status === '加工中')
  if (!order) throw new Error('缺少可执行特殊工艺加工单')
  await setPdaSessionForFactory(page, order.factoryId)
  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible()
  await expect(page.locator('#app')).toContainText(order.factoryName)
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
})
