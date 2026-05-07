import { expect, test } from '@playwright/test'

const PENDING_LOGIN = { loginId: 'onboarding_4', password: '123456' }
const FORMAL_LOGIN = { loginId: 'onboarding_34', password: '123456' }
const LEGACY_RETURNED_LOGIN = { loginId: 'onboarding_10', password: '123456' }

async function clearAuth(page: import('@playwright/test').Page) {
  if (page.url() === 'about:blank') await page.goto('/fcs/pda/auth/login')
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
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

test('新菜单与新路由生效，旧登录入口失效', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await expect(page.locator('body')).toContainText('工厂入驻&登录')
  await expect(page.locator('[data-tab-href="/fcs/pda/auth/login"]').first()).toBeVisible()
  await expect(page.locator('[data-tab-href="/fcs/pda/auth/onboarding"]').first()).toBeVisible()

  await page.locator('[data-tab-href="/fcs/pda/auth/onboarding"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('入驻进度')

  const legacyLoginPath = '/fcs/pda' + '/login'
  await page.goto(legacyLoginPath)
  await expect(page).not.toHaveURL(/\/fcs\/pda\/auth\/login/)
  await expect(page.locator('body')).not.toContainText('工厂登录')
})

test('PDA 登录后按入驻状态做业务准入', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/login\?returnTo=/)

  await fillLogin(page, PENDING_LOGIN.loginId, PENDING_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待平台审核')

  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, FORMAL_LOGIN.loginId, FORMAL_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)
})

test('历史未通过账号不再因未通过锁定', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, LEGACY_RETURNED_LOGIN.loginId, LEGACY_RETURNED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('历史入驻记录已终止')
})

test('入驻表单字段和中文校验提示完整', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  for (const label of ['姓名', '身份证号码/护照号码', '地址', '工厂简称', '工厂/公司名称', '机器数量', '手机号', '来源', '收到此通知的 PPIC 姓名', '上传身份证复印件/电子文件', '有效工人数量', '可开始合作时间', '工序工艺能力', '机器明细']) {
    await expect(page.locator('body')).toContainText(label)
  }

  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请填写工厂简称')

  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill('onboarding_4')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('工厂简称已存在，请更换')
})

test('平台初审通过只进入待样衣验证', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料齐全，进入待样衣验证。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('待样衣验证')
  await expect(page.locator('body')).not.toContainText('确认' + '合作')
  const reviewed = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0004')
    return {
      status: application?.status,
      createdFactoryId: application?.createdFactoryId || '',
      accountStatus: application?.adminAccount.accountStatus,
    }
  })
  expect(reviewed.status).toBe('待样衣验证')
  expect(reviewed.createdFactoryId).toBe('')
  expect(reviewed.accountStatus).not.toBe('已转正式')
})
