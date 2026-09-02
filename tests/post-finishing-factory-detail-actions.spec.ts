import { expect, test } from '@playwright/test'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-08-31 10:00:00',
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(45_000)
  page.setDefaultNavigationTimeout(45_000)
})

test('Web 后道单同时保留 PDA 优先入口和 Web 应急入口', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.getByRole('heading', { name: '后道单', exact: true })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('body')).toContainText('5')
  await expect(page.getByText('打开 PDA 后道加工')).toBeVisible()
  const taskExecutionEntries = page.locator('[data-nav^="/fcs/pda/post-finishing/execute"]').filter({ hasText: 'PDA执行（优先）' })
  await expect(taskExecutionEntries).toHaveCount(2)
  await expect(page.locator('[data-nav^="/fcs/craft/post-finishing/work-orders/"]').filter({ hasText: 'Web应急处理' })).toHaveCount(2)
  await expect(page.locator('[data-nav*="type=POST_ORDER"]')).toHaveCount(2)
  await expect(page.locator('body')).not.toContainText('雅加达后道工厂')

  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await taskExecutionEntries.first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/post-finishing\/execute\?id=HD-/)
  await expect(page.getByRole('heading', { name: '后道加工' })).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(5)
  await expect(page.getByRole('button', { name: '核对无误，开始后道' })).toBeVisible()
})

test('质检统一在 Web 领取管理，专用 PDA 只执行后道且不得执行质检', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-MGR')
  })
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检任务', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '输入质检任务号' })).toBeVisible()
  await expect(page.getByRole('button', { name: '领取并开始质检' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '质检任务管理' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(9)
  await expect(page.locator('body')).toContainText('Web 端输入完整任务号后领取')
  await expect(page.locator('body')).not.toContainText('调用摄像头')

  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/post-finishing/execute')
  await expect(page.locator('[data-pda-post-field="postScan"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始质检' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成质检' })).toHaveCount(0)
})
