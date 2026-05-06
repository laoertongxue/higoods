import { expect, test } from '@playwright/test'

const DRAFT_LOGIN = { loginId: 'onboarding_1', password: '123456' }

async function clearAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  })
}

async function fillLogin(page: import('@playwright/test').Page, loginId: string, password: string) {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function nativeClick(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

async function fillDraftIdentity(page: import('@playwright/test').Page, prefix: string) {
  await page.locator('[data-pda-onboarding-field="admin-loginId"]').fill(`${prefix}_${Date.now()}`)
  await page.locator('[data-pda-onboarding-field="admin-password"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="confirmPassword"]').fill('123456')
}

test('资料完整性评分展示', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('[data-testid="pda-onboarding-completeness-card"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('资料完整性评分')
  await expect(page.locator('body')).toContainText('完整性等级')
  await page.locator('[data-pda-onboarding-action="toggle-completeness-items"]').click()
  await expect(page.locator('body')).toContainText('缺失原因')
  await expect(page.locator('body')).toContainText('建议补充动作')
})

test('低于 80 分会阻止已有草稿提交', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, DRAFT_LOGIN.loginId, DRAFT_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-completeness-card"]')).toContainText('不完整')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('资料完整性不足 80 分，请先补充必填信息后再提交。')
})

test('工厂类型自动匹配', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]')
  await expect(page.locator('body')).toContainText('主类型：裁床厂')

  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="PRINT"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="PRINT"][data-craft-code="CRAFT_2000002"]')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="DYE"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="DYE"][data-craft-code="CRAFT_2000003"]')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="POST_FINISHING"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="POST_FINISHING"][data-craft-code="PACKAGING"]')

  await expect(page.locator('body')).toContainText('主类型：全能力工厂')
  await expect(page.locator('body')).toContainText('裁床厂')
  await expect(page.locator('body')).toContainText('印花厂')
  await expect(page.locator('body')).toContainText('染厂')
})

test('WhatsApp 校验与归一化', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_4', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-pda-onboarding-field="whatsapp"]')).toHaveValue('+628123456784')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_7', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-pda-onboarding-field="whatsapp"]')).toHaveValue('+628123456787')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_10', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-pda-onboarding-field="whatsapp"]')).toHaveValue('+6281234567810')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await fillDraftIdentity(page, 'p2_whatsapp_bad')
  await page.locator('[data-pda-onboarding-field="admin-adminName"]').fill('WhatsApp校验员')
  await page.locator('[data-pda-onboarding-field="admin-whatsapp"]').fill('08中文-1')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('WhatsApp 格式不正确，请填写印尼手机号，例如 +6281234567890')
})

test('平台列表展示资料完整性评分与匹配工厂类型', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('资料完整性评分')
  await expect(page.locator('body')).toContainText('匹配工厂类型')
  await expect(page.locator('body')).toContainText('高完整')
})

test('平台详情展示完整性与工厂类型匹配信息', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0010&dialog=detail')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  const detail = page.locator('[data-factory-onboarding-dialog="detail"]')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('资料完整性评分')
  await expect(detail).toContainText('完整性等级')
  await expect(detail).toContainText('缺失项')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0010&dialog=detail&tab=capability')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  const capabilityDetail = page.locator('[data-factory-onboarding-dialog="detail"]')
  await expect(capabilityDetail).toContainText('系统匹配工厂类型')
  await expect(capabilityDetail).toContainText('匹配依据')
})

test('确认合作后生成产能档案初始数据', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=confirm')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  const confirmDialog = page.locator('[data-factory-onboarding-dialog="confirm"]')
  await expect(confirmDialog).toBeVisible()
  await page.evaluate(async () => {
    const module = await import('/src/data/fcs/factory-onboarding-flow.ts')
    await module.confirmFactoryOnboardingCooperation({
      applicationId: 'FOA-0013',
      operator: '平台运营经理',
    })
  })

  await page.reload()
  await expect(page.locator('[data-factory-onboarding-dialog="confirm"]')).toHaveCount(0)

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=transfer')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('产能档案：已生成')
  await expect(page.locator('body')).toContainText('管理员账号：已生成 / 已转正')
  await page.locator('button[data-nav^="/fcs/factories/capacity-profile?"]').click()

  await expect(page).toHaveURL(/\/fcs\/factories\/capacity-profile\?factoryId=/)
  await expect(page.locator('body')).toContainText('来源入驻申请')
  await expect(page.locator('body')).toContainText('默认日可供给发布工时 SAM')
  await expect(page.locator('body')).toContainText('SAM 计算状态')
  await expect(page.locator('body')).toContainText('待补充产能字段')
  await expect(page.locator('body')).toContainText('有效工人数量')
  await expect(page.locator('body')).toContainText('机器总数')
  await expect(page.locator('body')).toContainText('工序工艺能力')
  await expect(page.locator('body')).toContainText('计算说明')
})
