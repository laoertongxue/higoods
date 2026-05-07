import { expect, test, type Page } from '@playwright/test'

async function clearAuth(page: Page) {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  })
}

async function fillLogin(page: Page, loginId: string, password = '123456') {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function convertFromPage(page: Page, applicationId: string) {
  await page.goto('/fcs/factories/onboarding')
  return page.evaluate(async ({ applicationId }) => {
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const result = await flow.convertOnboardingToOfficialFactory(applicationId, 'Playwright 转档员')
    return {
      status: result.application.status,
      currentNode: result.application.currentNode,
      createdFactoryId: result.application.createdFactoryId,
      conversionRecordCount: result.application.conversionRecords.length,
      factoryName: result.createdFactory.name,
      factoryId: result.createdFactory.id,
      capacityProfileId: result.capacityProfile.capacityProfileId,
      adminLoginId: result.application.adminAccount.loginId,
    }
  }, { applicationId })
}

test('样衣审核通过后转正式', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  const convertButton = page.locator('[data-factory-onboarding-action="open-conversion"][data-application-id="FOA-0031"]')
  await expect(convertButton).toContainText('转正式合作')
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0031&dialog=conversion')
  await expect(page.locator('body')).toContainText('样衣通过后转正式合作')
  await expect(page.locator('body')).toContainText('入驻申请编号')
  await expect(page.locator('body')).toContainText('工厂/公司名称')
  await expect(page.locator('body')).toContainText('样衣审核结果')
  await expect(page.locator('body')).toContainText('工厂档案：生成')
  await expect(page.locator('body')).toContainText('管理员账号：转正')
  await expect(page.locator('body')).toContainText('产能档案：生成')
  const result = await convertFromPage(page, 'FOA-0031')
  expect(result.status).toBe('已转正式合作')
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('body')).toContainText('已转正式合作')
  await expect(page.locator('body')).toContainText('查看工厂档案')

  await page.goto('/fcs/factories/profile')
  await expect(page.locator('body')).toContainText('工厂档案')
  const profileExists = await page.evaluate(async ({ factoryName }) => {
    const master = await import('/src/data/fcs/factory-master-store.ts')
    return master.listFactoryMasterRecords().some((factory) => factory.name === factoryName)
  }, { factoryName: result.factoryName })
  expect(profileExists).toBe(true)

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0031&dialog=detail&tab=conversion')
  await expect(page.locator('body')).toContainText('转档记录')
  await expect(page.locator('body')).toContainText('工厂档案编号')
  await expect(page.locator('body')).toContainText('正式管理员账号')
  await expect(page.locator('body')).toContainText('产能档案编号')
})

test('只有样衣审核通过待转正式可转正式', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  for (const applicationId of ['FOA-0013', 'FOA-0016', 'FOA-0019', 'FOA-0022', 'FOA-0025', 'FOA-0028']) {
    await expect(page.locator(`[data-factory-onboarding-action="open-conversion"][data-application-id="${applicationId}"]`)).toHaveCount(0)
  }
})

test('转正式后 PDA 业务权限开放', async ({ page }) => {
  const result = await convertFromPage(page, 'FOA-0032')
  expect(result.status).toBe('已转正式合作')

  await clearAuth(page)
  await fillLogin(page, result.adminLoginId)
  await expect(page).toHaveURL(/\/fcs\/pda\/exec/)

  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).not.toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }

  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('body')).toContainText('已转正式合作')
  await expect(page.getByRole('button', { name: '进入执行' })).toBeVisible()
})

test('转正式前业务权限仍禁止', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_33')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待转正式合作')
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
})

test('产能档案初始数据', async ({ page }) => {
  const result = await convertFromPage(page, 'FOA-0031')
  await page.goto(`/fcs/factories/capacity-profile?factoryId=${result.factoryId}`)
  await expect(page.locator('body')).toContainText(result.factoryName)
  await expect(page.locator('body')).toContainText('来源入驻申请编号')
  await expect(page.locator('body')).toContainText('有效工人数量')
  await expect(page.locator('body')).toContainText('机器数量')
  await expect(page.locator('body')).toContainText('工序工艺能力')
  await expect(page.locator('body')).toContainText('机器明细')
  await expect(page.locator('body')).toContainText('默认日可供给发布工时 SAM')
  await expect(page.locator('body')).toContainText('待补充产能字段')

  const profile = await page.evaluate(async ({ factoryId }) => {
    const capacity = await import('/src/data/fcs/factory-capacity-profile-mock.ts')
    return capacity.listFactoryCapacityProfiles().find((item) => item.factoryId === factoryId)
  }, { factoryId: result.factoryId })
  expect(profile?.sourceApplicationId).toBe('FOA-0031')
  expect(profile?.defaultDailyAvailablePublishedSam).toBe(0)
  expect(profile?.calculationStatus).toBe('待补充产能字段')
})

test('派单候选过滤', async ({ page }) => {
  const result = await convertFromPage(page, 'FOA-0031')
  await page.goto('/fcs/dispatch/board')
  const candidates = await page.evaluate(async () => {
    const master = await import('/src/data/fcs/factory-master-store.ts')
    return master.listBusinessFactoryMasterRecords().map((factory) => ({
      id: factory.id,
      name: factory.name,
    }))
  })
  expect(candidates.some((factory) => factory.id === result.factoryId)).toBe(true)
  expect(candidates.some((factory) => factory.name === '定位裁演示工厂32')).toBe(false)
  expect(candidates.some((factory) => factory.name === '数码印演示工厂13')).toBe(false)
})
