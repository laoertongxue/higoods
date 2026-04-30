import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120_000)

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

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function fillActionField(page: Page, field: string, value: string) {
  await page.locator(`[data-process-web-status-action-field="${field}"]`).fill(value)
}

async function openActionDialog(page: Page, actionCode: string) {
  const button = page.locator(`button[data-action-code="${actionCode}"]`).first()
  await expect(button).toBeVisible({ timeout: 30_000 })
  await button.click()
  await expect(page.locator('#process-web-status-action-dialog')).toBeVisible({ timeout: 30_000 })
}

test('后道 Web 操作必须先弹窗，取消不写回，确认后生成 Web 端操作记录', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders/POST-WO-007')
  await expect(page.getByRole('heading', { name: '后道单详情' })).toBeVisible()
  await expect(page.getByText('接收中').first()).toBeVisible()

  await openActionDialog(page, 'POST_RECEIVE_FINISH')
  await expect(page.getByTestId('process-web-status-action-title')).toContainText(/完成接收领料|确认接收领料/)
  await expect(page.locator('[data-process-web-status-action-field="操作人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="完成时间"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="接收成衣件数"]')).toBeVisible()

  await page.getByTestId('process-web-status-action-cancel').last().click()
  await expect(page.getByTestId('process-web-status-action-dialog')).toHaveCount(0)
  await expect(page.getByText('接收中').first()).toBeVisible()

  await openActionDialog(page, 'POST_RECEIVE_FINISH')
  await fillActionField(page, '操作人', 'Web 后道员')
  await fillActionField(page, '完成时间', '2026-04-29 10:10')
  await fillActionField(page, '接收成衣件数', '260')
  await page.getByTestId('process-web-status-action-confirm').click()

  await expect(page.locator('body')).toContainText('待质检')
  await page.getByRole('button', { name: '流转记录' }).click()
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('[data-testid="operation-record-row"]').first()).toContainText(/Web 端|完成接收领料/)
  await expect(page.locator('body')).not.toContainText('Web 端操作记录')
})

test('质检单和复检单 Web 操作使用同一弹窗并收集成衣件数字段', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await openActionDialog(page, 'POST_QC_FINISH')
  await expect(page.locator('[data-process-web-status-action-field="质检人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="质检通过成衣件数"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="质检不合格成衣件数"]')).toBeVisible()
  await page.getByTestId('process-web-status-action-cancel').last().click()

  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await expect(page.getByRole('heading', { name: '复检单', exact: true })).toBeVisible()
  await openActionDialog(page, 'POST_RECHECK_FINISH')
  await expect(page.locator('[data-process-web-status-action-field="复检人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="复检确认成衣件数"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="复检不合格成衣件数"]')).toBeVisible()
})

test('移动端后道操作走统一写回，Web 详情合并展示移动端操作记录', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec/TASK-POST-010')
  await expect(page.getByRole('heading', { name: '后道任务执行' })).toBeVisible()
  await expect(page.locator('body')).toContainText('当前流程')
  await expect(page.locator('body')).toContainText('计划成衣件数')
  await expect(page.locator('body')).toContainText('操作记录')

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请输入复检确认成衣件数')
    await dialog.accept('420')
  })
  await page.getByRole('button', { name: '完成复检' }).click()
  await expect(page.locator('body')).toContainText('移动端')
  await expect(page.locator('[data-testid="operation-record-row"]').first()).toContainText('移动端')

  await navigateInApp(page, '/fcs/craft/post-finishing/work-orders/POST-WO-010?tab=events')
  await expect(page.getByRole('heading', { name: '后道单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('[data-testid="operation-record-row"]').first()).toContainText('移动端')

  await navigateInApp(page, '/fcs/craft/post-finishing/wait-handover-warehouse?postOrderId=POST-WO-010')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('HD-2026-010')
  await expect(page.locator('body')).toContainText('待交出成衣件数')
})

test('后道发起交出和上报差异会联动交出记录、差异记录与平台异常结果', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec/TASK-POST-005')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请输入交出成衣件数')
    await dialog.accept('320')
  })
  await page.getByRole('button', { name: '发起交出' }).click()
  await expect(page.locator('body')).toContainText(/后道交出已通过统一写回提交|待回写/)

  await navigateInApp(page, '/fcs/craft/post-finishing/work-orders/POST-WO-005?tab=handover')
  await expect(page.locator('body')).toContainText('交出记录')
  await expect(page.locator('body')).toContainText('交出成衣件数')

  await navigateInApp(page, '/fcs/pda/exec/TASK-POST-008')
  const diffAnswers = ['320', '317', '3']
  page.on('dialog', async (dialog) => {
    await dialog.accept(diffAnswers.shift() || '3')
  })
  await page.getByRole('button', { name: '上报差异' }).click()
  await expect(page.locator('body')).toContainText(/后道差异已通过统一写回上报|有差异/)

  await navigateInApp(page, '/fcs/craft/post-finishing/work-orders/POST-WO-008?tab=events')
  await expect(page.locator('body')).toContainText('差异')
  await expect(page.locator('body')).toContainText('差异成衣件数')

  await navigateInApp(page, '/fcs/progress/board')
  await expect(page.locator('body')).toContainText('平台状态', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('异常')
  await expect(page.locator('body')).toContainText(/处理差异|要求重新交出/)
})

test('后道页面和移动端不出现错误后道动作，统计读取成衣件数口径', async ({ page }) => {
  for (const path of [
    '/fcs/craft/post-finishing/work-orders/POST-WO-003',
    '/fcs/craft/post-finishing/qc-orders',
    '/fcs/craft/post-finishing/recheck-orders',
    '/fcs/pda/exec/TASK-POST-003',
  ]) {
    await page.goto(path)
    await expect(page.locator('body')).not.toContainText('开扣眼')
    await expect(page.locator('body')).not.toContainText('装扣子')
    await expect(page.locator('body')).not.toContainText('熨烫')
    await expect(page.locator('body')).not.toContainText('包装')
  }

  await page.goto('/fcs/craft/post-finishing/statistics')
  await expect(page.getByRole('heading', { name: '后道统计' })).toBeVisible()
  await expect(page.locator('body')).toContainText('成衣件数')
  await expect(page.locator('body')).toContainText('差异成衣件数')
  await expect(page.locator('body')).not.toContainText('数量：')
})
