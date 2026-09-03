import { expect, test, type Page } from '@playwright/test'

const POST_FACTORY_OPERATOR = {
  userId: 'ID-F002_operator',
  loginId: 'ID-F002_operator',
  userName: '后道工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F002',
  factoryName: '后道工厂',
  loggedAt: '2026-09-03 10:00:00',
}

async function setSession(page: Page, roleId: 'ROLE_OPERATOR' | 'ROLE_ADMIN'): Promise<void> {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(({ session, role }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify({
      ...session,
      userId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.userId,
      loginId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.loginId,
      userName: role === 'ROLE_ADMIN' ? '后道工厂_管理员' : session.userName,
      roleId: role,
    }))
    window.localStorage.removeItem('higoods-pda-sewing-self-return-mode')
  }, { session: POST_FACTORY_OPERATOR, role: roleId })
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('后道工厂执行页只保留后道加工和后道复检', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/exec')
    await expect(page.getByRole('heading', { name: '后道现场执行' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道加工' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道复检' })).toBeVisible()
    await expect(page.locator('[data-pda-general-task-list]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pda-exec-tabs"]')).toHaveCount(0)
    await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('其他执行任务')
    await expect(page.locator('body')).not.toContainText('TASK-DYE-')
    await expectNoHorizontalOverflow(page)
  }
})

test('后道回货入口归入交接待接收，仓管不再承担回货或成衣仓收货', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/warehouse')
  await expect(page.locator('body')).not.toContainText('后道回货与出货')
  await expect(page.locator('body')).not.toContainText('扫描送货单点数确认')
  await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '后道回货接收' })).toBeVisible()
  await expect(page.getByRole('button', { name: /扫描送货单点数确认/ })).toBeVisible()
  await expect(page.getByText('开启车缝自助回货', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /扫描送货单点数确认/ }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/post-finishing\/return-confirm/)
  await expect(page.getByRole('heading', { name: '扫描后道送货单号' })).toBeVisible()

  await page.goto('/fcs/pda/post-finishing/outbound-receive')
  await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
})

test('车缝自助回货由管理员开启，锁定与退出状态完整闭环', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.goto('/fcs/pda/handover?tab=pickup')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请由后道工厂管理员开启')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)

  await setSession(page, 'ROLE_ADMIN')
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/sewing-self-return/)
  await expect(page.getByRole('heading', { name: '车缝现场交货登记模式' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('higoods-pda-sewing-self-return-mode')))).toBe(true)

  await page.getByRole('button', { name: '管理员退出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('higoods-pda-sewing-self-return-mode'))).toBeNull()
  await expect(page.getByRole('heading', { name: '后道回货接收' })).toBeVisible()
})
