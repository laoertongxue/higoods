import { expect, test } from '@playwright/test'

const COOPERATED_LOGIN = { loginId: 'F090_admin', password: '123456' }
const PENDING_LOGIN = { loginId: 'onboarding_4', password: '123456' }
const REJECTED_LOGIN = { loginId: 'onboarding_16', password: '123456' }
const RESUBMIT_LOGIN = { loginId: 'onboarding_7', password: '123456' }
const APPROVE_LOGIN = { loginId: 'onboarding_6', password: '123456' }

async function clearAuth(page: import('@playwright/test').Page) {
  await resetAuthNow(page)
  await page.addInitScript(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  })
}

async function resetAuthNow(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
}

async function fillLogin(page: import('@playwright/test').Page, loginId: string, password: string) {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function nativeClick(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

test('新菜单与新路由生效，旧登录入口失效', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await expect(page.locator('body')).toContainText('工厂入驻&登录')
  await expect(page.locator('[data-tab-href="/fcs/pda/auth/login"]').first()).toBeVisible()
  await expect(page.locator('[data-tab-href="/fcs/pda/auth/onboarding"]').first()).toBeVisible()

  await page.locator('[data-tab-href="/fcs/pda/auth/login"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/login/)
  await expect(page.locator('body')).toContainText('工厂登录')

  await page.locator('[data-tab-href="/fcs/pda/auth/onboarding"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('入驻流程')

  await page.goto('/fcs/pda/login')
  await expect(page).not.toHaveURL(/\/fcs\/pda\/auth\/login/)
  await expect(page.locator('body')).not.toContainText('工厂登录')
})

test('未登录访问业务页会跳转新登录页，登录后按状态分流', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/login\?returnTo=/)
  await expect(page.locator('body')).toContainText('工厂登录')

  await fillLogin(page, COOPERATED_LOGIN.loginId, COOPERATED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)
})

test('未合作工厂登录后进入入驻页，不能进入执行/交接/仓管/结算', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, PENDING_LOGIN.loginId, PENDING_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('已提交待审核')

  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }
})

test('已合作工厂登录后进入执行页，并可访问交接、仓管、结算', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, COOPERATED_LOGIN.loginId, COOPERATED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)

  await page.goto('/fcs/pda/handover')
  await expect(page).toHaveURL(/\/fcs\/pda\/handover/)
  await page.goto('/fcs/pda/warehouse')
  await expect(page).toHaveURL(/\/fcs\/pda\/warehouse/)
  await page.goto('/fcs/pda/settlement')
  await expect(page).toHaveURL(/\/fcs\/pda\/settlement/)
})

test('入驻表单字段、流程卡和中文校验提示完整', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('[data-testid="pda-onboarding-flow"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('当前节点')
  await expect(page.locator('body')).toContainText('当前节点耗时')
  await expect(page.locator('body')).toContainText('当前节点动作次数')
  await expect(page.locator('body')).toContainText('登录账户')
  await expect(page.locator('body')).toContainText('登录密码')
  await expect(page.locator('body')).toContainText('确认密码')
  await expect(page.locator('body')).toContainText('管理员姓名')
  await expect(page.locator('body')).toContainText('管理员 WhatsApp')
  await expect(page.locator('body')).toContainText('工厂名称')
  await expect(page.locator('body')).toContainText('老板名字')
  await expect(page.locator('body')).toContainText('地址')
  await expect(page.locator('body')).toContainText('有效工人数量')
  await expect(page.locator('body')).toContainText('机器总数')
  await expect(page.locator('body')).toContainText('工序工艺能力')
  await expect(page.locator('body')).toContainText('机器明细')

  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请填写登录账户')

  await page.locator('[data-pda-onboarding-field="admin-loginId"]').fill('new_factory_case')
  await page.locator('[data-pda-onboarding-field="admin-password"]').fill('123')
  await page.locator('[data-pda-onboarding-field="confirmPassword"]').fill('1234')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('登录密码至少 6 位')

  await page.locator('[data-pda-onboarding-field="admin-password"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="confirmPassword"]').fill('123457')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('两次输入的密码不一致')
})

test('提交入驻申请后状态进入待审核，并记录平台审核节点', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toBeVisible()
  await page.locator('[data-pda-onboarding-field="admin-loginId"]').fill(`new_factory_${Date.now()}`)
  await page.locator('[data-pda-onboarding-field="admin-password"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="confirmPassword"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="admin-adminName"]').fill('工厂管理员甲')
  await page.locator('[data-pda-onboarding-field="admin-whatsapp"]').fill('+62-812-0000-1001')
  await page.locator('[data-pda-onboarding-field="factoryName"]').fill('演示入驻工厂A')
  await page.locator('[data-pda-onboarding-field="bossName"]').fill('老板甲')
  await page.locator('[data-pda-onboarding-field="whatsapp"]').fill('+62-812-0000-1001')
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达原型工业区 A-01')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-05-20')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('26')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('8')

  await page.locator('[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]').click()
  await page.locator('[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]').click()
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await expect(page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]')).toBeVisible()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('定位裁切机')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('2')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption('CUT_PANEL')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption('CRAFT_000001')

  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('已提交入驻申请')
  await expect(page.locator('body')).toContainText('已提交待审核')
  await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
})

test('平台可审核退回、拒绝、通过并确认合作生成工厂档案', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.locator('body')).toContainText('待审核')
  await expect(page.locator('body')).toContainText('待确认合作')
  await expect(page.locator('body')).toContainText('已合作')
  await expect(page.locator('body')).toContainText('已拒绝')

  await expect(page.locator('[data-factory-onboarding-action="view-detail"][data-application-id="FOA-0004"]')).toBeVisible()
  await page.locator('[data-factory-onboarding-action="view-detail"][data-application-id="FOA-0004"]').click({ force: true })
  await expect(page.getByRole('heading', { name: '工厂入驻详情' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: '基础信息' })).toBeVisible()
  await expect(page.getByRole('button', { name: '账号信息' })).toBeVisible()
  await expect(page.getByRole('button', { name: '工序工艺能力' })).toBeVisible()
  await expect(page.getByRole('button', { name: '机器能力' })).toBeVisible()
  await expect(page.getByRole('button', { name: '流程记录' })).toBeVisible()
  await expect(page.getByRole('button', { name: '审核记录' })).toBeVisible()
  await expect(page.getByRole('button', { name: '转档记录' })).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).last().click()

  await expect(page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]')).toBeVisible()
  await page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]').click({ force: true })
  await expect(page.getByRole('heading', { name: '审核入驻申请' })).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="不通过且允许再次提交"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充设备与工序对应说明。')
  await page.getByRole('button', { name: '确认审核' }).click()
  await expect(page.locator('body')).toContainText('审核结果已保存')
  await expect(page.locator('body')).toContainText('退回补充资料')

  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, PENDING_LOGIN.loginId, PENDING_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('退回补充资料')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('已重新提交入驻申请')
  await expect(page.locator('body')).toContainText('已重新提交待审核')

  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0005"]')).toBeVisible()
  await page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0005"]').click({ force: true })
  await expect(page.getByRole('heading', { name: '审核入驻申请' })).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="不通过且不允许再次提交"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('当前能力与合作范围不匹配。')
  await page.getByRole('button', { name: '确认审核' }).click()
  await expect(page.locator('body')).toContainText('已拒绝')

  await resetAuthNow(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, REJECTED_LOGIN.loginId, REJECTED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('已拒绝')
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)

  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0006"]')).toBeVisible()
  await page.locator('[data-factory-onboarding-action="open-review"][data-application-id="FOA-0006"]').click({ force: true })
  await expect(page.getByRole('heading', { name: '审核入驻申请' })).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料完整，同意进入合作确认。')
  await page.getByRole('button', { name: '确认审核' }).click()
  await expect(page.locator('body')).toContainText('审核通过待确认合作')

  await expect(page.locator('[data-factory-onboarding-action="open-confirm"][data-application-id="FOA-0006"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-confirm"][data-application-id="FOA-0006"]')
  await expect(page.getByRole('heading', { name: '确认合作并生成工厂档案' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: '确认生成' }).click()
  await expect(page.locator('body')).toContainText('已确认合作并生成工厂档案')
  await expect(page.locator('body')).toContainText('已合作')

  await page.goto('/fcs/factories/profile')
  await expect(page.locator('body')).toContainText('工厂档案')
  await expect(page.locator('body')).toContainText('共 30 条记录')
  const hasArchivedFactory = await page.evaluate(() => {
    const raw = window.localStorage.getItem('fcs_factory_master_store_v1')
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw) as Array<{ name?: string }>
      return parsed.some((item) => item.name === '包装演示工厂6')
    } catch {
      return false
    }
  })
  expect(hasArchivedFactory).toBe(true)

  await resetAuthNow(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, APPROVE_LOGIN.loginId, APPROVE_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)
})
