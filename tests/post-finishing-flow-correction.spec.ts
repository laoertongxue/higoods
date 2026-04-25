import { expect, test } from '@playwright/test'

const FULL_FACTORY_NAME = '全能力测试工厂'
const PDA_SESSION = {
  userId: 'ID-F090_operator',
  loginId: 'ID-F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F090',
  factoryName: FULL_FACTORY_NAME,
  loggedAt: '2026-04-25 10:00:00',
}
const PDA_SEWING_SESSION = {
  userId: 'ID-SEW-FULL_operator',
  loginId: 'ID-SEW-FULL_operator',
  userName: '全能力测试车缝工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-SEW-FULL',
  factoryName: '全能力测试车缝工厂',
  loggedAt: '2026-04-25 10:00:00',
}

test('Web 专门后道工厂完整流程按接收领料、质检、后道、复检、交出展示', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  const row = page.locator('tr', { hasText: 'HD-2026-001' })
  await expect(row).toContainText('后道工厂执行')
  await expect(row).toContainText('接收领料 -> 质检 -> 后道 -> 复检 -> 交出')
  await expect(row).not.toContainText('后道 -> 质检 -> 复检')

  await row.getByRole('button', { name: '查看详情' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/post-finishing\/work-orders\/POST-WO-001/)
  await expect(page.getByText('后道来源').first()).toBeVisible()
  await expect(page.getByText('当前流程').first()).toBeVisible()
  await expect(page.getByText('接收领料 -> 质检 -> 后道 -> 复检 -> 交出').first()).toBeVisible()

  for (const tab of ['接收领料', '质检记录', '后道记录', '复检记录', '交出记录', '流转记录']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: tab })).toBeVisible()
  }
})

test('Web 车缝厂已做后道流程不再让后道工厂执行后道', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  const row = page.locator('tr', { hasText: 'HD-2026-102' })
  await expect(row).toContainText('车缝厂已完成后道')
  await expect(row).toContainText('接收领料 -> 质检 -> 复检 -> 交出')
  await expect(row).not.toContainText('接收领料 -> 质检 -> 后道 -> 复检 -> 交出')

  await row.getByRole('button', { name: '查看详情' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/post-finishing\/work-orders\/POST-WO-102/)
  await page.getByRole('button', { name: '后道记录' }).click()
  await expect(page.getByRole('heading', { name: '后道记录' })).toBeVisible()
  await expect(page.getByText('后道已由车缝厂完成').first()).toBeVisible()
  await expect(page.getByText('全能力测试车缝工厂')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始后道' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成后道' })).toHaveCount(0)
})

test('后道待加工仓和交出仓按新流程展示', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await expect(page.getByText('待接收领料').first()).toBeVisible()
  await expect(page.getByText('待质检').first()).toBeVisible()
  await expect(page.getByText('待后道').first()).toBeVisible()
  await expect(page.getByText('待复检').first()).toBeVisible()
  await expect(page.getByText('待处理成衣件数')).toBeVisible()
  const sewingDoneRow = page.locator('tr', { hasText: 'HD-2026-101' })
  await expect(sewingDoneRow).toContainText('车缝厂已完成后道')
  await expect(sewingDoneRow).not.toContainText('待后道')

  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('复检确认成衣件数')).toBeVisible()
  await expect(page.getByText('待交出成衣件数')).toBeVisible()
  await expect(page.getByText('实收成衣件数')).toBeVisible()
})

test('工厂端移动应用区分专门后道流程和车缝厂已做后道流程', async ({ page }) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SEWING_SESSION)

  await page.goto('/fcs/pda/exec/TASK-POST-001')
  await expect(page.getByRole('heading', { name: '后道任务执行' })).toBeVisible()
  await expect(page.getByText('接收领料 -> 质检 -> 后道 -> 复检 -> 交出')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认接收领料' })).toBeVisible()

  await page.goto('/fcs/pda/exec/TASK-POST-003')
  await expect(page.getByRole('button', { name: '开始后道' })).toBeVisible()

  await page.goto('/fcs/pda/exec/TASK-POST-101')
  await expect(page.getByText('接收领料 -> 质检 -> 复检 -> 交出')).toBeVisible()
  await expect(page.getByText('后道已由车缝厂完成').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '开始后道' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成后道' })).toHaveCount(0)
})

test('车缝工厂移动端既能看到车缝后道任务又不能执行质检复检', async ({ page }) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SEWING_SESSION)

  await page.goto('/fcs/pda/exec')
  await expect(page.getByText('车缝后道').first()).toBeVisible()
  await expect(page.getByText('HD-2026-104').first()).toBeVisible()

  await page.goto('/fcs/pda/exec/SEW-POST-104')
  await expect(page.getByRole('heading', { name: '车缝后道任务' })).toBeVisible()
  await expect(page.getByText('是否需要本厂完成后道')).toBeVisible()
  await expect(page.getByText('后道后流向')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始后道' })).toBeVisible()
  await expect(page.getByRole('button', { name: /质检/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /复检/ })).toHaveCount(0)
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('熨烫')).toHaveCount(0)
  await expect(page.getByText('包装')).toHaveCount(0)
})
