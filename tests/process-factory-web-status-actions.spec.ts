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

test('印花 Web 状态操作按合法下一步推进并生成 Web 端操作记录', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-011')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '开始打印' })).toBeVisible()

  await page.getByRole('button', { name: '开始打印' }).click()

  await expect(page.locator('body')).toContainText('打印中')
  await expect(page.locator('body')).toContainText('Web 端操作记录')
  await expect(page.locator('body')).toContainText('开始打印')
  await expect(page.locator('body')).toContainText('Web 端')
  await expect(page.locator('body')).toContainText('平台聚合状态：加工中')
})

test('印花非法跳转不可见且没有自由状态下拉', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('待花型')
  await expect(page.getByRole('button', { name: '确认花型到位' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成转印' })).toHaveCount(0)
  await expect(page.locator('select[name="status"]')).toHaveCount(0)
})

test('染色 Web 状态操作复用写回并保留平台聚合状态', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-012')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()

  await page.getByRole('button', { name: '完成包装' }).click()

  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('Web 端操作记录')
  await expect(page.locator('body')).toContainText('完成包装')
  await expect(page.locator('body')).toContainText('平台聚合状态：待送货')
})

test('裁片 Web 状态操作不破坏原始裁片单和菲票归属口径', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/original-orders?originalCutOrderNo=CUT-260314-087-02')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible()
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '开始铺布' })).toBeVisible()

  await page.getByRole('button', { name: '开始铺布' }).click()

  await expect(page.locator('body')).toContainText('铺布中')
  await expect(page.locator('body')).toContainText('Web 端操作记录')
  await expect(page.locator('body')).toContainText('开始铺布')
  await expect(page.locator('body')).toContainText('菲票归属原始裁片单')
  await expect(page.locator('body')).not.toContainText('菲票归属合并裁剪批次')
})

test('特殊工艺 Web 状态操作只展示合法工艺动作', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-064/work-orders/SC-TASK-SC-OP-064-01-WO-001-')
  await expect(page.locator('body')).toContainText('可执行动作', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: '完成加工' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('开扣眼')
  await expect(page.locator('body')).not.toContainText('装扣子')
  await expect(page.locator('body')).not.toContainText('熨烫')

  await page.getByRole('button', { name: '完成加工' }).click()

  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('Web 端操作记录')
  await expect(page.locator('body')).toContainText('完成加工')
})

test('不可操作任务显示原因，移动端和平台侧能力不回退', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-002')
  await expect(page.locator('body')).toContainText('当前任务仍在待定标阶段，不能执行')
  await expect(page.getByRole('button', { name: '打开移动端执行页' })).toBeDisabled()

  await setPdaSession(page)
  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=TASK-PRINT-000716')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveValue('TASK-PRINT-000716')
  await expect(page.getByText('TASK-PRINT-000716').first()).toBeVisible()
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/准备中|加工中|待送货|待回写|待审核|异常|已完成/)
})
