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

async function openPdaExec(page: import('@playwright/test').Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/exec')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible()
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

test('裁片和特殊工艺列表展示全能力测试工厂编号', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/original-orders?originalCutOrderNo=CUT-260314-087-02')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL, { timeout: 30_000 })

  await page.goto('/fcs/process-factory/special-craft/sc-op-008/tasks')
  await expect(page.locator('body')).toContainText('打揽', { timeout: 30_000 })
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible({ timeout: 30_000 })

  await page.goto('/fcs/process-factory/special-craft/sc-op-008/tasks/SC-TASK-SC-OP-008-01')
  await expect(page).toHaveURL(/\/fcs\/process-factory\/special-craft\/sc-op-008\/tasks\/SC-TASK-/)
  await expect(page.getByRole('heading', { name: '打揽任务详情' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(DEMO_FACTORY_LABEL).first()).toBeVisible({ timeout: 30_000 })
})

test('F090 工厂端执行列表可检索印花、染色、裁片和特殊工艺任务', async ({ page }) => {
  await openPdaExec(page)

  await searchPdaTask(page, 'TASK-PRINT-000716')
  await searchPdaTask(page, 'TASK-DYE-000726')
  await searchPdaTask(page, 'TASK-CUT-000097')
  await searchPdaTask(page, 'TASK-SC-OP-008-0101')
})
