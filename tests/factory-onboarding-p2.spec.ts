import { expect, test } from '@playwright/test'

const FORMAL_PENDING_LOGIN = { loginId: 'onboarding_31', password: '123456' }
const FORMAL_LOGIN = { loginId: 'onboarding_34', password: '123456' }

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

test('工厂类型自动匹配', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]')
  await expect(page.locator('body')).toContainText('系统匹配工厂类型：裁床厂')

  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="PRINT"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="PRINT"][data-craft-code="CRAFT_2000002"]')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="DYE"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="DYE"][data-craft-code="CRAFT_2000003"]')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="POST_FINISHING"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="POST_FINISHING"][data-craft-code="PACKAGING"]')

  await expect(page.locator('body')).toContainText('系统匹配工厂类型：全能力工厂')
  await expect(page.locator('body')).toContainText('裁床厂')
  await expect(page.locator('body')).toContainText('印花厂')
  await expect(page.locator('body')).toContainText('染厂')
})

test('手机号字段校验', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(`p2_mobile_${Date.now()}`)
  await page.locator('[data-pda-onboarding-field="applicantName"]').fill('手机号校验申请人')
  await page.locator('[data-pda-onboarding-field="identityNo"]').fill('ID-MOBILE-001')
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill('手机号校验工厂')
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达手机号校验园区')
  await page.locator('[data-pda-onboarding-field="mobilePhone"]').fill('abc')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请填写手机号')
})

test('平台列表展示入驻新字段', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  for (const label of ['入驻申请编号', '姓名', '身份证号码/护照号码', '工厂简称', '工厂/公司名称', '手机号', '来源', 'PPIC 姓名', '机器数量', '有效工人数量', '已选工序工艺', '当前节点', '当前状态', '当前节点耗时', '当前节点动作次数', '提交时间']) {
    await expect(page.locator('body')).toContainText(label)
  }
})

test('平台详情展示基础资料、账号、能力、机器、样衣状态', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  const detail = page.locator('[data-factory-onboarding-dialog="detail"]')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('基础资料')
  await expect(detail).toContainText('身份证复印件/电子文件')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=account')
  await expect(detail).toContainText('登录账号')
  await expect(detail).toContainText('是否锁定')
  await expect(detail).not.toContainText('明文密码')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=capability')
  await expect(detail).toContainText('工序')
  await expect(detail).toContainText('工艺')
  await expect(detail).toContainText('是否可接任务')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=machines')
  await expect(detail).toContainText('机器名称')
  await expect(detail).toContainText('校验状态')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=sample')
  await expect(detail).toContainText('样衣状态')
  await expect(detail).toContainText('暂未登记样衣')
})

test('待转正式只允许预留转档判断，不能进入业务页', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, FORMAL_PENDING_LOGIN.loginId, FORMAL_PENDING_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待转正式合作')

  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)

  const guard = await page.evaluate(async () => {
    const module = await import('/src/data/fcs/factory-onboarding-flow.ts')
    return {
      canCreatePending: module.canCreateFactoryProfile('样衣审核通过待转正式'),
      canEnterPending: module.canFactoryEnterBusiness('样衣审核通过待转正式'),
      canEnterFormal: module.canFactoryEnterBusiness('已转正式合作'),
    }
  })
  expect(guard.canCreatePending).toBe(true)
  expect(guard.canEnterPending).toBe(false)
  expect(guard.canEnterFormal).toBe(true)
})

test('已转正式合作是唯一可进入业务页状态', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, FORMAL_LOGIN.loginId, FORMAL_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)

  await page.goto('/fcs/pda/handover')
  await expect(page).toHaveURL(/\/fcs\/pda\/handover/)
  await page.goto('/fcs/pda/warehouse')
  await expect(page).toHaveURL(/\/fcs\/pda\/warehouse/)
  await page.goto('/fcs/pda/settlement')
  await expect(page).toHaveURL(/\/fcs\/pda\/settlement/)
})
