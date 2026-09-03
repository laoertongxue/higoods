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

test('Web 后道加工单可用完整单号开始并查看产品与加工项目', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-POST')
  })
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.getByRole('heading', { name: '后道加工单', exact: true })).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
  await expect(page.locator('[data-post-finishing-work-orders-action="open-start"]').first()).toBeVisible()
  await page.locator('tbody [data-post-finishing-work-orders-action="open-start"]').first().click()
  await expect(page.getByRole('dialog', { name: '开始后道' })).toBeVisible()
  await expect(page.locator('[data-post-finishing-start-preview] img')).toHaveCount(5)
  await expect(page.getByRole('button', { name: '核对无误，开始后道' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PDA 执行（优先）')
  await expect(page.locator('body')).not.toContainText('Web 应急处理')
})

test('质检统一在 Web 领取管理，专用 PDA 只执行后道且不得执行质检', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-MGR')
  })
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '领取质检单' })).toHaveCount(0)
  await page.getByRole('button', { name: '领取质检单' }).click()
  await expect(page.getByRole('dialog', { name: '领取质检单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认领取' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '质检单号' })).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
  await expect(page.locator('[data-qc-task-input]')).toHaveAttribute('placeholder', /完整质检单号/)
  await expect(page.locator('body')).not.toContainText('调用摄像头')

  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/post-finishing/execute')
  await expect(page.locator('[data-pda-post-field="postScan"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始质检' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成质检' })).toHaveCount(0)
})
