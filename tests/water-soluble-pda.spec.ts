import { expect, test, type Page } from '@playwright/test'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-07-11 10:00:00',
}

const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([])
})

async function removeTodoModal(page: Page): Promise<void> {
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
}

test('水溶列表只读动作、局部搜索和详情事实保持一致', async ({ page }) => {
  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')
  await removeTodoModal(page)

  const card = page.getByTestId('pda-exec-task-card').filter({ hasText: '水溶加工单' }).first()
  await expect(card).toContainText('主面料')
  await expect(card).toContainText('米')
  await expect(card).toContainText('下一步')
  await expect(card.getByRole('button', { name: '查看任务', exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: '上报完成数量', exact: true })).toHaveCount(0)

  await page.locator('[data-testid="pda-exec-page"]').evaluate((node) => {
    ;(window as typeof window & { __waterPdaPage?: Element }).__waterPdaPage = node
  })
  await page.locator('[data-pda-exec-field="searchKeyword"]').fill('主面料')
  await expect.poll(() => page.locator('[data-testid="pda-exec-page"]').evaluate((node) => {
    const remembered = (window as typeof window & { __waterPdaPage?: Element }).__waterPdaPage
    return remembered === node && remembered?.isConnected === true
  })).toBe(true)

  const taskId = await card.getAttribute('data-task-id')
  expect(taskId).toBeTruthy()
  await card.getByRole('button', { name: '查看任务', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/${taskId}`))

  const detail = page.getByTestId('pda-water-soluble-readonly-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('水溶单-')
  await expect(detail).toContainText('主面料')
  await expect(detail).toContainText('计划数量')
  await expect(detail).toContainText('完成数量')
  await expect(detail).toContainText('当前步骤')
  await expect(detail).toContainText('下一步提示')
  await expect(detail.locator('[data-pda-execd-action="finish-task"]')).toHaveCount(0)
  await expect(detail.getByRole('button', { name: '完工', exact: true })).toHaveCount(0)

  await detail.evaluate((node, injectedTaskId) => {
    const button = document.createElement('button')
    button.dataset.pdaExecdAction = 'finish-task'
    button.dataset.taskId = injectedTaskId || ''
    button.textContent = '注入通用完工'
    node.appendChild(button)
  }, taskId)
  await page.getByRole('button', { name: '注入通用完工' }).click()
  await expect(page.locator('#pda-exec-detail-toast-root')).toContainText('水溶任务当前仅支持查看')
  await expect(detail).toContainText('水溶中')
})

test('生产暂停水溶卡片只显示主管提示和查看任务', async ({ page }) => {
  await page.goto('/fcs/pda/exec?tab=BLOCKED&keyword=主面料')
  await removeTodoModal(page)
  const card = page.getByTestId('pda-exec-task-card').filter({ hasText: '水溶加工单' }).first()
  await expect(card).toContainText('生产暂停')
  await expect(card).toContainText('查看主管处理')
  await expect(card.getByRole('button', { name: '查看任务', exact: true })).toBeVisible()
  await expect(card.locator('button')).toHaveCount(1)
})
