import { expect, test } from '@playwright/test'

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

async function searchVisibleTask(page: import('@playwright/test').Page, taskNo: string, tab = 'NOT_STARTED') {
  await setPdaSession(page)
  await page.goto(`/fcs/pda/exec?tab=${tab}&keyword=${encodeURIComponent(taskNo)}`)
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue(taskNo)
  await expect(page.getByText(taskNo).first()).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
}

test('印花绑定校验通过并可在移动端执行列表搜索到', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
  await expect(page.getByText('移动端执行任务号').first()).toBeVisible()
  await expect(page.getByText('TASK-PRINT-000716').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定状态：有效')
  await expect(page.locator('body')).toContainText('允许打开移动端执行页')
  await expect(page.locator('body')).not.toContainText('报价阶段')
  await expect(page.locator('body')).not.toContainText('待定标')
  await expect(page.locator('body')).not.toContainText('尚未接单')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/TASK-PRINT-000716/)
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await searchVisibleTask(page, 'TASK-PRINT-000716')
})

test('染色绑定校验通过并可在移动端执行列表搜索到', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-006')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.getByText('TASK-DYE-000726').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定状态：有效')
  await expect(page.locator('body')).toContainText('允许打开移动端执行页')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/TASK-DYE-000726/)
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await searchVisibleTask(page, 'TASK-DYE-000726')
})

test('裁片绑定校验通过并可在移动端执行列表搜索到', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/original-orders?originalCutOrderNo=CUT-260314-087-02')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible()
  await expect(page.locator('body')).toContainText('移动端执行绑定')
  await expect(page.locator('body')).toContainText('TASK-CUT-000097')
  await expect(page.locator('body')).toContainText('绑定状态')
  await expect(page.locator('body')).toContainText('有效')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/TASK-CUT-000097/)
  await expect(page.locator('body')).toContainText('分配工厂：全能力测试工厂（F090）')

  await searchVisibleTask(page, 'TASK-CUT-000097')
})

test('特殊工艺绑定校验通过并可在移动端执行列表搜索到', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/tasks/SC-TASK-SC-OP-008-01')
  await expect(page.locator('body')).toContainText('打揽', { timeout: 30_000 })
  await page.getByRole('button', { name: '查看工艺单' }).first().click()
  await expect(page.locator('body')).toContainText('工艺单详情', { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('移动端执行任务号', { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('TASK-SC-OP-008-0101', { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('绑定状态', { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('允许打开移动端执行页', { timeout: 30_000 })

  await page.getByRole('button', { name: '打开移动端执行页' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/TASK-SC-OP-008-0101/)
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await searchVisibleTask(page, 'TASK-SC-OP-008-0101')
})

test('报价 / 待定标样本不会作为印花加工单执行绑定，也不会出现在执行列表', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-002')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定状态：有效')
  await expect(page.locator('body')).toContainText('分配方式：派单')
  await expect(page.locator('body')).toContainText('派单价格：1200 IDR/Yard')
  await expect(page.getByRole('button', { name: '打开移动端执行页' })).toBeEnabled()

  await setPdaSession(page)
  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=TASK-PRINT-000713')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue('TASK-PRINT-000713')
  await expect(page.locator('[data-testid="pda-exec-task-card"]')).toHaveCount(0)
})
