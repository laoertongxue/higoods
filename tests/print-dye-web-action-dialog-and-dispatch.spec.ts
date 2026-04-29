import { expect, test, type Page } from '@playwright/test'

const DEMO_FACTORY_LABEL = '全能力测试工厂（F090）'
const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-29 10:00:00',
}

async function setPdaSession(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

async function fillDialogField(page: Page, field: string, value: string) {
  await page.locator(`[data-process-web-status-action-field="${field}"]`).fill(value)
}

function actionDialog(page: Page) {
  return page.locator('[data-testid="process-web-status-action-dialog"]')
}

function actionDialogTitle(page: Page) {
  return page.locator('[data-testid="process-web-status-action-title"]')
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('印花操作按钮先弹窗并填写字段后写回', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-011')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)
  await expect(page.locator('body')).toContainText('分配方式：派单')
  await expect(page.locator('body')).toContainText('派单价格：1200 IDR/Yard')

  await page.getByRole('button', { name: '开始打印' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(actionDialogTitle(page)).toHaveText('开始打印')
  await expect(page.locator('[data-process-web-status-action-field="操作人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="打印机编号"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="开始时间"]')).toBeVisible()

  await fillDialogField(page, '操作人', 'Web 印花操作员')
  await fillDialogField(page, '打印机编号', 'PRN-TEST-01')
  await fillDialogField(page, '开始时间', '2026-04-29 10:15')
  await page.locator('[data-testid="process-web-status-action-confirm"]').click()

  await expect(actionDialog(page)).toHaveCount(0)
  await expect(page.locator('body')).toContainText('打印中')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('开始打印')
  await expect(page.locator('body')).toContainText('Web 端')
})

test('印花动作取消时不直接写回，完成调色测试也先弹窗', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page.locator('body')).toContainText('当前状态：待花型')

  await page.getByRole('button', { name: '确认花型到位' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '取消' }).click()
  await expect(actionDialog(page)).toHaveCount(0)
  await expect(page.locator('body')).toContainText('当前状态：待花型')
  await expect(page.locator('body')).not.toContainText('当前状态：待调色测试')

  await page.getByRole('button', { name: '确认花型到位' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-testid="process-web-status-action-confirm"]').click()
  await expect(page.locator('body')).toContainText('当前状态：待调色测试')
  await page.getByRole('button', { name: '完成调色测试' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(actionDialogTitle(page)).toHaveText('完成调色测试')
  await expect(page.locator('[data-process-web-status-action-field="调色结果"]')).toBeVisible()
})

test('染色操作按钮先弹窗并填写字段后写回', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-013')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('分配方式：派单')
  await expect(page.locator('body')).toContainText('派单价格：1500 IDR/Yard')

  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(actionDialogTitle(page)).toHaveText('完成包装')
  await expect(page.locator('[data-process-web-status-action-field="操作人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="包装完成面料米数"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="包装卷数"]')).toBeVisible()

  await fillDialogField(page, '操作人', 'Web 染色操作员')
  await fillDialogField(page, '完成时间', '2026-04-29 10:30')
  await fillDialogField(page, '包装完成面料米数', '940')
  await fillDialogField(page, '包装卷数', '12')
  await page.locator('[data-testid="process-web-status-action-confirm"]').click()

  await expect(actionDialog(page)).toHaveCount(0)
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('完成包装')
  await expect(page.locator('body')).toContainText('Web 端')
})

test('操作记录合并 Web 端与移动端来源', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-011')
  await page.getByRole('button', { name: '开始打印' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-testid="process-web-status-action-confirm"]').click()
  await expect(page.locator('body')).toContainText('Web 端')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000722')
  await expect(page.getByRole('button', { name: '完成打印' })).toBeVisible()

  const answers = ['900', '0']
  page.on('dialog', async (dialog) => {
    await dialog.accept(answers.shift() || '')
  })
  await page.locator('[data-pda-execd-action="print-complete-printing"]').click()
  await expect(page.locator('body')).toContainText(/打印完成已记录|打印完成/)

  await navigateInApp(page, '/fcs/craft/printing/work-orders/PWO-PRINT-011')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('Web 端')
  await expect(page.locator('body')).toContainText('移动端')
  await expect(page.locator('body')).not.toContainText('Web 端操作记录')
})

test('印花和染色任务不进入接单报价链路，进入移动端执行列表', async ({ page }) => {
  await setPdaSession(page)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await page.locator('[data-pda-tr-field="keyword"]').fill('PH-20260328-001')
  await expect(page.locator('body')).toContainText(/暂无待接单任务|当前筛选条件暂无待接单任务|暂无/)
  await expect(page.locator('body')).not.toContainText('TASK-PRINT-000716')

  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=PH-20260328-001')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue('PH-20260328-001')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await page.locator('[data-pda-tr-field="keyword"]').fill('DYE-20260328-006')
  await expect(page.locator('body')).not.toContainText('TASK-DYE-000726')

  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=TASK-DYE-000726')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('body')).toContainText('TASK-DYE-000726')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)
})

test('平台侧按派单和执行聚合口径展示印花染色', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('body')).toContainText('分配方式')
  await expect(page.locator('body')).toContainText('派单')
  await expect(page.locator('body')).toContainText('派单价格')
  await expect(page.locator('body')).toContainText('1200 IDR/Yard')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).not.toContainText('平台状态：待定标')
  await expect(page.locator('body')).not.toContainText('平台状态：待接单')

  await page.goto('/fcs/process/dye-orders')
  await expect(page.locator('body')).toContainText('分配方式')
  await expect(page.locator('body')).toContainText('派单')
  await expect(page.locator('body')).toContainText('派单价格')
  await expect(page.locator('body')).toContainText('1500 IDR/Yard')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).not.toContainText('平台状态：待定标')
  await expect(page.locator('body')).not.toContainText('平台状态：待接单')
  await expect(page.locator('body')).not.toContainText('染色报表')
})
