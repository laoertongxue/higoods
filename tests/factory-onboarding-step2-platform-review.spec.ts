import { expect, test } from '@playwright/test'

async function clearAuth(page: import('@playwright/test').Page) {
  if (page.url() === 'about:blank') await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
}

async function nativeClick(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

async function fillLogin(page: import('@playwright/test').Page, loginId: string, password: string) {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function openReview(page: import('@playwright/test').Page, applicationId: string) {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await nativeClick(page, `[data-factory-onboarding-action="open-review"][data-application-id="${applicationId}"]`)
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
}

test('平台初审通过进入待样衣验证且不转正式', async ({ page }) => {
  await openReview(page, 'FOA-0004')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料齐全，进入待样衣验证。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('待样衣验证')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('样衣验证')
  await expect(page.locator('body')).not.toContainText('确认' + '合作')

  const reviewed = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const master = await import('/src/data/fcs/factory-master-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0004')
    return {
      status: application?.status,
      currentNode: application?.currentNode,
      createdFactoryId: application?.createdFactoryId || '',
      accountStatus: application?.adminAccount.accountStatus,
      canEnterBusiness: application ? flow.canFactoryEnterBusiness(application.status) : true,
      hasFactoryProfile: application ? master.listFactoryMasterRecords().some((factory) => factory.name === application.factoryCompanyName) : true,
      reviewResult: application?.reviewRecords.at(-1)?.reviewResult,
      actionName: application?.actionLogs.at(-1)?.actionName,
      platformNodeStatus: application?.nodeLogs.find((item) => item.nodeName === '平台审核')?.nodeStatus,
      sampleNodeStatus: application?.nodeLogs.find((item) => item.nodeName === '样衣验证')?.nodeStatus,
    }
  })
  expect(reviewed.status).toBe('待样衣验证')
  expect(reviewed.currentNode).toBe('样衣验证')
  expect(reviewed.createdFactoryId).toBe('')
  expect(reviewed.accountStatus).not.toBe('已转正式')
  expect(reviewed.canEnterBusiness).toBe(false)
  expect(reviewed.hasFactoryProfile).toBe(false)
  expect(reviewed.reviewResult).toBe('已通过')
  expect(reviewed.actionName).toBe('平台初审已通过')
  expect(reviewed.platformNodeStatus).toBe('已完成')
  expect(reviewed.sampleNodeStatus).toBe('进行中')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_4', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待样衣验证')
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
})

test('平台初审未通过可重新提交', async ({ page }) => {
  await openReview(page, 'FOA-0005')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-testid="factory-onboarding-required-fields"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充身份文件、地址和机器明细。')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="身份证复印件/电子文件"]')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="地址"]')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="机器明细"]')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="工厂简称"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('平台审核退回')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('请补充身份文件、地址和机器明细。')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('机器明细')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_5', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('请补充身份文件、地址和机器明细。')
  await expect(page.locator('[data-testid="pda-onboarding-supplement-card"]')).toContainText('机器明细')
  await expect(page.locator('[data-pda-onboarding-field="factoryCompanyName"]')).toBeEditable()
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toContainText('重新提交入驻申请')
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达示范工业园补充地址')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('已提交入驻申请')

  const resubmitted = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    return store.getFactoryOnboardingApplicationById('FOA-0005')?.status
  })
  expect(resubmitted).toBe('待平台审核')
})

test('平台初审未通过不锁定账号且不禁止同名入驻', async ({ page }) => {
  await openReview(page, 'FOA-0006')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('该工厂资料需要补充。')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="工厂简称"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('平台审核退回')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('账号是否锁定：否')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('该工厂资料需要补充。')

  const rejected = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0006')
    return {
      accountLocked: application?.accountLocked,
      accountLockedReason: application?.accountLockedReason,
      factoryNameLocked: application?.factoryNameLocked,
      factoryCompanyName: application?.factoryCompanyName || '',
      helperLocked: application ? store.isFactoryCompanyNameLocked(application.factoryCompanyName) : false,
      helperCanStart: application ? store.canStartNewOnboarding(application.factoryCompanyName) : true,
    }
  })
  expect(rejected.accountLocked).toBe(false)
  expect(rejected.accountLockedReason || '').toBe('')
  expect(rejected.factoryNameLocked).toBe(false)
  expect(rejected.helperLocked).toBe(false)
  expect(rejected.helperCanStart).toBe(true)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_6', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)

  await page.goto('/fcs/pda/auth/onboarding')
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('该工厂资料需要补充。')
})

test('审核记录与流程记录展示初审结果', async ({ page }) => {
  await openReview(page, 'FOA-0004')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料齐全，进入待样衣验证。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0004&dialog=detail&tab=review')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('已通过')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('资料齐全，进入待样衣验证。')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('平台审核员')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0004&dialog=detail&tab=flow')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('平台初审已通过')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('样衣验证')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('已完成')
})
