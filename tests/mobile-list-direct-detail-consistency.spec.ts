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

async function setPdaSession(page: import('@playwright/test').Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
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

async function clearTodoModal(page: import('@playwright/test').Page) {
  const modal = page.locator('[data-pda-todo-modal="true"]')
  if (await modal.count()) {
    const closeButton = modal.locator('[data-pda-shell-action="close-todo-modal"]').last()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await expect(modal).toHaveCount(0)
  }
}

async function expectTaskLocated(page: import('@playwright/test').Page, keyword: string, taskNo: string) {
  await page.goto(`/fcs/pda/exec?keyword=${encodeURIComponent(keyword)}`)
  await clearTodoModal(page)
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue(keyword)
  await expect(page.locator('body')).toContainText(taskNo)
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)
}

test('印花 Web 直达与执行列表定位一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page.locator('body')).toContainText('PH-20260328-001')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/TASK-PRINT-000716/)
  await page.getByRole('button', { name: '返回执行列表' }).click()
  await expect(page).toHaveURL(/keyword=PH-20260328-001/)
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')

  await expectTaskLocated(page, 'TASK-PRINT-000716', 'TASK-PRINT-000716')
})

test('染色 Web 直达与执行列表定位一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-006')
  await expect(page.locator('body')).toContainText('DY-20260328-006')
  await expect(page.locator('body')).toContainText('TASK-DYE-000726')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/TASK-DYE-000726/)
  await page.getByRole('button', { name: '返回执行列表' }).click()
  await expect(page).toHaveURL(/keyword=DY-20260328-006/)
  await expect(page.locator('body')).toContainText('TASK-DYE-000726')

  await expectTaskLocated(page, 'TASK-DYE-000726', 'TASK-DYE-000726')
})

test('裁片 Web 直达与执行列表定位一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/cutting/cut-orders?cutOrderNo=CUT-260314-087-02')
  await expect(page.locator('body')).toContainText('CUT-260314-087-02')
  await expect(page.locator('body')).toContainText('TASK-CUT-000097')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/TASK-CUT-000097/)
  await page.getByRole('button', { name: /返回/ }).first().click()
  await expect(page).toHaveURL(/keyword=CUT-260314-087-02/)
  await expect(page.locator('body')).toContainText('TASK-CUT-000097')
})

test('特殊工艺 Web 直达与执行列表定位一致', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.status === '加工中')
  if (!order) throw new Error('缺少可执行特殊工艺加工单')
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  await setPdaSessionForFactory(page, order.factoryId)
  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible()
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
  await expect(page.locator('#app')).toContainText(order.sourceTaskId || '')

  await page.goto(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`))
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
  await expect(page.locator('#app')).toContainText(order.taskOrderId)
  await page.goto(`/fcs/pda/exec?tab=BLOCKED&keyword=${encodeURIComponent(order.taskOrderNo)}`)
  await clearTodoModal(page)
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue(order.taskOrderNo)
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
  await expect(page.locator('#app')).toContainText(order.factoryName)
})

test('报价或待定标任务不进入执行列表，直达详情只显示不可执行原因', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=TASK-PRINT-000714')
  await clearTodoModal(page)
  await expect(page.locator('[data-testid="pda-exec-task-card"]')).toHaveCount(0)

  await page.goto('/fcs/pda/exec/TASK-PRINT-000714')
  await expect(page.locator('body')).toContainText('当前任务仍在报价或定标阶段，不能执行')
  await expect(page.locator('body')).toContainText('当前任务只允许查看，不显示开始、完工、交出等执行按钮')
  await expect(page.getByRole('button', { name: '开工' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完工' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发起交出' })).toHaveCount(0)
})

test('搜索字段覆盖工厂、生产单、加工单和任务号', async ({ page }) => {
  await setPdaSession(page)
  await expectTaskLocated(page, 'F090', 'TASK-PRINT-000716')
  await expectTaskLocated(page, '全能力测试工厂', 'TASK-PRINT-000716')
  await expectTaskLocated(page, 'PO-20260328-071', 'TASK-PRINT-000716')
  await expectTaskLocated(page, 'PH-20260328-001', 'TASK-PRINT-000716')
})

test('移动端 Tab 分类与执行状态一致', async ({ page }) => {
  await setPdaSession(page)
  const taskList = page.locator('[data-testid="pda-exec-card-list"]')

  await page.goto('/fcs/pda/exec?tab=NOT_STARTED')
  await clearTodoModal(page)
  await expect(page).toHaveURL(/tab=NOT_STARTED/)
  await expect(taskList).toContainText('TASK-PRINT-000716')
  await expect(taskList).not.toContainText('TASK-PRINT-000719')
  await expect(taskList).not.toContainText('TASK-PRINT-000714')
  await expect(taskList).not.toContainText('TASK-PRINT-000715')

  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')
  await clearTodoModal(page)
  await expect(page).toHaveURL(/tab=IN_PROGRESS/)
  await expect(taskList).toContainText('TASK-PRINT-000717')
  await expect(taskList).not.toContainText('TASK-PRINT-000716')
  await expect(taskList).not.toContainText('TASK-PRINT-000719')

  await page.goto('/fcs/pda/exec?tab=BLOCKED')
  await clearTodoModal(page)
  await expect(page).toHaveURL(/tab=BLOCKED/)
  await expect(taskList).toContainText('TASK-PRINT-000718')
  await expect(taskList).not.toContainText('TASK-PRINT-000717')
  await expect(taskList).not.toContainText('TASK-PRINT-000719')

  await page.goto('/fcs/pda/exec?tab=DONE')
  await clearTodoModal(page)
  await expect(page).toHaveURL(/tab=DONE/)
  await expect(taskList).toContainText('TASK-PRINT-000719')
  await expect(taskList).not.toContainText('TASK-PRINT-000716')
  await expect(taskList).not.toContainText('TASK-PRINT-000714')
  await expect(taskList).not.toContainText('TASK-PRINT-000715')
})
