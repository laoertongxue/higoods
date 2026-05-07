import { expect, test, type Page } from '@playwright/test'

async function clearAuth(page: Page) {
  if (page.url() === 'about:blank') await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
}

async function nativeClick(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

async function fillRequiredDraft(page: Page, factoryShortName: string, factoryCompanyName: string) {
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(factoryShortName)
  await page.locator('[data-pda-onboarding-field="applicantName"]').fill('简称登录申请人')
  await page.locator('[data-pda-onboarding-field="identityNo"]').fill(`ID-SHORT-${Date.now()}`)
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill(factoryCompanyName)
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达简称登录工业园 1 号')
  await page.locator('[data-pda-onboarding-field="mobilePhone"]').fill('+62-812-0000-8801')
  await page.locator('[data-pda-onboarding-field="sourceChannel"]').fill('PPIC 转介绍')
  await page.locator('[data-pda-onboarding-field="ppicName"]').fill('简称 PPIC')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('2')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('15')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-06-18')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]')
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('简称测试设备')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('1')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达简称登录工业园 1 号')
}

test('入驻表单不再有账号信息模块', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('[data-testid="pda-onboarding-page"]')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('账号信息')
  await expect(page.locator('body')).not.toContainText('登录账户')
  await expect(page.locator('body')).not.toContainText('登录密码')
  await expect(page.locator('body')).not.toContainText('确认密码')
  await expect(page.locator('body')).not.toContainText('WhatsApp')
  await expect(page.locator('body')).not.toContainText('手机号码/WhatsApp')
  await expect(page.locator('body')).toContainText('工厂简称')
  await expect(page.locator('body')).toContainText('手机号')
})

test('工厂简称必填并校验入驻申请与正式工厂档案唯一性', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请填写工厂简称')

  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill('onboarding_4')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('工厂简称已存在，请更换')

  const officialShortName = await page.evaluate(async () => {
    const master = await import('/src/data/fcs/factory-master-store.ts')
    return master.listFactoryMasterRecords().find((factory) => factory.factoryShortName)?.factoryShortName || ''
  })
  expect(officialShortName).not.toBe('')
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(officialShortName)
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('工厂简称已存在，请更换')
})

test('工厂简称作为登录账号并自动生成管理员账号', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  const factoryShortName = `short_login_${Date.now()}`
  const factoryCompanyName = `简称登录工厂${Date.now()}`
  await fillRequiredDraft(page, factoryShortName, factoryCompanyName)
  await page.locator('[data-testid="pda-onboarding-submit"]').click()
  await expect(page.locator('body')).toContainText('待平台审核')

  const generated = await page.evaluate(async ({ factoryShortName }) => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.listFactoryOnboardingApplications().find((item) => item.factoryShortName === factoryShortName)
    return {
      loginId: application?.adminAccount.loginId,
      mobilePhone: application?.adminAccount.mobilePhone,
      accountStatus: application?.adminAccount.accountStatus,
      isTemporary: application?.adminAccount.isTemporary,
    }
  }, { factoryShortName })
  expect(generated.loginId).toBe(factoryShortName)
  expect(generated.mobilePhone).toBe('+62-812-0000-8801')
  expect(generated.accountStatus).toBe('入驻中')
  expect(generated.isTemporary).toBe(true)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await page.locator('[data-pda-login-field="loginId"]').fill(factoryShortName)
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText(factoryCompanyName)
})

test('手机号替代 WhatsApp 并同步到平台列表与详情', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('工厂简称')
  await expect(page.locator('body')).toContainText('手机号')
  await expect(page.locator('body')).not.toContainText('WhatsApp')
  await expect(page.locator('body')).not.toContainText('手机号码/WhatsApp')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail')
  const detail = page.locator('[data-factory-onboarding-dialog="detail"]')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('工厂简称')
  await expect(detail).toContainText('手机号')
  await expect(detail).not.toContainText('WhatsApp')
  await expect(detail).not.toContainText('手机号码/WhatsApp')
})

test('正式工厂档案工厂简称参与新入驻唯一性', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  const officialShortName = await page.evaluate(async () => {
    const master = await import('/src/data/fcs/factory-master-store.ts')
    return master.listFactoryMasterRecords().find((factory) => factory.factoryShortName)?.factoryShortName || ''
  })
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(officialShortName)
  await page.locator('[data-pda-onboarding-action="save-draft"]').click()
  await expect(page.locator('body')).toContainText('工厂简称已存在，请更换')
})
