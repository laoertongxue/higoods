import { expect, test, type Page } from '@playwright/test'

async function clearAuth(page: Page) {
  if (page.url() === 'about:blank') await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
}

async function fillLogin(page: Page, loginId: string, password = '123456') {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function nativeClick(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

async function openPlatformReview(page: Page, applicationId: string) {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await nativeClick(page, `[data-factory-onboarding-action="open-review"][data-application-id="${applicationId}"]`)
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
}

async function openSampleReview(page: Page, applicationId: string) {
  await page.goto(`/fcs/factories/onboarding?applicationId=${applicationId}&dialog=sample-review`)
  await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('平台样衣审核')
}

const legacyPlatformReturn = ['不通过', '且允许', '再次申请'].join('')
const legacyPlatformReject = ['不通过', '且不允许', '再次申请'].join('')
const legacySampleReturn = ['不通过', '且允许', '再次提交'].join('')
const legacySampleReject = ['不通过', '且不允许', '再次提交'].join('')

test('平台初审结果只有已通过和未通过', async ({ page }) => {
  await openPlatformReview(page, 'FOA-0004')
  const dialog = page.locator('[data-testid="factory-onboarding-review-dialog"], [data-factory-onboarding-dialog="review"]')
  await expect(dialog).toContainText('已通过')
  await expect(dialog).toContainText('未通过')
  await expect(dialog).not.toContainText(legacyPlatformReturn)
  await expect(dialog).not.toContainText(legacyPlatformReject)
})

test('平台初审未通过进入退回且账号不锁定', async ({ page }) => {
  await openPlatformReview(page, 'FOA-0005')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充手机号和机器明细。')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="手机号"]')
  await nativeClick(page, '[data-factory-onboarding-field="reviewRequiredField"][value="机器明细"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('平台审核退回')

  const state = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0005')
    return {
      status: application?.status,
      reviewResult: application?.reviewRecords.at(-1)?.reviewResult,
      accountLocked: application?.accountLocked,
      factoryNameLocked: application?.factoryNameLocked,
    }
  })
  expect(state.status).toBe('平台审核退回')
  expect(state.reviewResult).toBe('未通过')
  expect(state.accountLocked).toBe(false)
  expect(state.factoryNameLocked).toBe(false)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_5')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('请补充手机号和机器明细。')
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toContainText('重新提交入驻申请')
})

test('平台初审已通过进入待样衣验证且不开放业务页', async ({ page }) => {
  await openPlatformReview(page, 'FOA-0004')
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料齐全，进入待样衣验证。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  const state = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const master = await import('/src/data/fcs/factory-master-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0004')
    return {
      status: application?.status,
      currentNode: application?.currentNode,
      reviewResult: application?.reviewRecords.at(-1)?.reviewResult,
      createdFactoryId: application?.createdFactoryId || '',
      canEnterBusiness: application ? flow.canFactoryEnterBusiness(application.status) : true,
      hasFactoryProfile: application ? master.listFactoryMasterRecords().some((factory) => factory.name === application.factoryCompanyName) : true,
    }
  })
  expect(state.status).toBe('待样衣验证')
  expect(state.currentNode).toBe('样衣验证')
  expect(state.reviewResult).toBe('已通过')
  expect(state.createdFactoryId).toBe('')
  expect(state.canEnterBusiness).toBe(false)
  expect(state.hasFactoryProfile).toBe(false)
})

test('样衣审核结果只有已通过和未通过', async ({ page }) => {
  await openSampleReview(page, 'FOA-0022')
  const dialog = page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')
  await expect(dialog).toContainText('已通过')
  await expect(dialog).toContainText('未通过')
  await expect(dialog).not.toContainText(legacySampleReturn)
  await expect(dialog).not.toContainText(legacySampleReject)
})

test('样衣审核未通过进入退回且可重新提交', async ({ page }) => {
  await openSampleReview(page, 'FOA-0023')
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('请补充样衣照片和工艺说明。')
  await nativeClick(page, '[data-factory-onboarding-field="sampleReviewRequiredItem"][value="样衣照片"]')
  await nativeClick(page, '[data-factory-onboarding-field="sampleReviewRequiredItem"][value="工艺说明"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('样衣审核退回')

  const state = await page.evaluate(async () => {
    const onboardingStore = await import('/src/data/fcs/factory-onboarding-store.ts')
    const sampleStore = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const application = onboardingStore.getFactoryOnboardingApplicationById('FOA-0023')
    const verification = sampleStore.getSampleVerificationByApplicationId('FOA-0023')
    return {
      applicationStatus: application?.status,
      sampleStatus: verification?.status,
      sampleReviewResult: verification?.sampleReviewRecords.at(-1)?.sampleReviewResult,
      accountLocked: application?.accountLocked,
      factoryNameLocked: application?.factoryNameLocked,
    }
  })
  expect(state.applicationStatus).toBe('样衣审核退回')
  expect(state.sampleStatus).toBe('样衣审核退回')
  expect(state.sampleReviewResult).toBe('未通过')
  expect(state.accountLocked).toBe(false)
  expect(state.factoryNameLocked).toBe(false)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_23')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('请补充样衣照片和工艺说明。')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('重新提交样衣审核')
})

test('样衣审核已通过进入待转正式且不生成工厂档案', async ({ page }) => {
  await openSampleReview(page, 'FOA-0024')
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('样衣质量达标，等待转正式。')

  const state = await page.evaluate(async () => {
    const onboardingStore = await import('/src/data/fcs/factory-onboarding-store.ts')
    const sampleStore = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const sampleFlow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const master = await import('/src/data/fcs/factory-master-store.ts')
    const verification = sampleStore.getSampleVerificationByApplicationId('FOA-0024')
    if (!verification) throw new Error('未找到样衣验证记录')
    const result = sampleFlow.reviewFactorySample(verification.verificationId, {
      sampleReviewResult: '已通过',
      sampleReviewOpinion: '样衣质量达标，等待转正式。',
      resubmitAllowed: false,
      requiredResubmitItems: [],
      sampleQualityConclusion: '达标',
      capacityConclusion: '具备合作能力',
    }, '平台样衣审核员')
    const application = onboardingStore.getFactoryOnboardingApplicationById('FOA-0024')
    return {
      status: result.application.status,
      sampleReviewResult: result.sampleReviewRecord.sampleReviewResult,
      createdFactoryId: result.application.createdFactoryId || '',
      canEnterBusiness: flow.canFactoryEnterBusiness(result.application.status),
      hasFactoryProfile: application ? master.listFactoryMasterRecords().some((factory) => factory.name === application.factoryCompanyName) : true,
    }
  })
  expect(state.status).toBe('样衣审核通过待转正式')
  expect(state.sampleReviewResult).toBe('已通过')
  expect(state.createdFactoryId).toBe('')
  expect(state.canEnterBusiness).toBe(false)
  expect(state.hasFactoryProfile).toBe(false)
})
