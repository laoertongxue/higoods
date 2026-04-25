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

test('后道单列表工厂名称、详情和操作入口可用', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.getByRole('heading', { name: '后道单', exact: true })).toBeVisible()
  await expect(page.getByText('雅加达后道工厂')).toHaveCount(0)
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()

  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/post-finishing\/work-orders\/POST-WO-\d+/)
  await expect(page.getByRole('heading', { name: '后道单详情' })).toBeVisible()
  await expect(page.getByText('HD-2026-001', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('生产单-001')).toBeVisible()
  await expect(page.getByText('后道来源任务-001')).toBeVisible()
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()
  await expect(page.getByText('计划成衣件数')).toBeVisible()
  await expect(page.getByText('当前状态')).toBeVisible()

  for (const tab of ['接收领料', '质检记录', '后道记录', '复检记录', '交出记录', '流转记录']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`tab=${tab === '接收领料' ? 'receive' : tab === '后道记录' ? 'post' : tab === '质检记录' ? 'qc' : tab === '复检记录' ? 'recheck' : tab === '交出记录' ? 'handover' : 'events'}`))
    await expect(page.getByRole('heading', { name: tab })).toBeVisible()
  }

  await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.getByRole('button', { name: '打印任务流转卡' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/print\/preview/)
  await expect(page.getByText('后道任务流转卡', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()

  await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.getByRole('button', { name: '查看待加工仓' }).first().click()
  await expect(page).toHaveURL(/wait-process-warehouse\?postOrderId=POST-WO-001/)
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await expect(page.getByText('已按后道单定位：POST-WO-001')).toBeVisible()
  await expect(page.getByText('HD-2026-001', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('待处理成衣件数')).toBeVisible()

  await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.getByRole('button', { name: '查看交出记录' }).first().click()
  await expect(page).toHaveURL(/wait-handover-warehouse\?postOrderId=POST-WO-/)
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('待交出成衣件数')).toBeVisible()
  await expect(page.getByText('实收成衣件数')).toBeVisible()
})

test('质检单、复检单和移动端后道任务使用同一工厂与同一批后道单', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()
  await expect(page.getByText('雅加达后道工厂')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await expect(page.getByRole('heading', { name: '复检单', exact: true })).toBeVisible()
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()
  await expect(page.getByText('雅加达后道工厂')).toHaveCount(0)

  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
  await page.goto('/fcs/pda/exec')
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()
  await expect(page.getByText('HD-2026-001', { exact: true }).first()).toBeVisible()

  await page.goto('/fcs/pda/exec/TASK-POST-001')
  await expect(page.getByRole('heading', { name: '后道任务执行' })).toBeVisible()
  await expect(page.getByText('HD-2026-001')).toBeVisible()
  await expect(page.getByText(FULL_FACTORY_NAME).first()).toBeVisible()
  await expect(page.getByText('计划成衣件数')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认接收领料' })).toBeVisible()

  await page.goto('/fcs/pda/exec/TASK-POST-002')
  await expect(page.getByRole('button', { name: '开始质检' })).toBeVisible()
  await page.goto('/fcs/pda/exec/TASK-POST-003')
  await expect(page.getByRole('button', { name: '开始后道' })).toBeVisible()
  await page.goto('/fcs/pda/exec/TASK-POST-004')
  await expect(page.getByRole('button', { name: '开始复检' })).toBeVisible()

  await page.goto('/fcs/pda/exec/TASK-POST-101')
  await expect(page.getByText('HD-2026-101')).toBeVisible()
  await expect(page.getByText('后道已由车缝厂完成', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始后道' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成后道' })).toHaveCount(0)

  await page.goto('/fcs/pda/exec/SEW-POST-101')
  await expect(page.getByText('HD-2026-101')).toBeVisible()
  await expect(page.getByRole('button', { name: '交给后道工厂' })).toBeVisible()
  await expect(page.getByRole('button', { name: /质检/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /复检/ })).toHaveCount(0)
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('熨烫')).toHaveCount(0)
  await expect(page.getByText('包装')).toHaveCount(0)
})
