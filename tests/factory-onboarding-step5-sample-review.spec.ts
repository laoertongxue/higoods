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

async function setChecked(page: Page, selector: string) {
  await page.locator(selector).first().check({ force: true })
}

async function reviewSampleFromPage(
  page: Page,
  applicationId: string,
  payload: {
    sampleReviewResult: string
    sampleReviewOpinion: string
    resubmitAllowed: boolean
    requiredResubmitItems: string[]
    sampleQualityConclusion?: string
    capacityConclusion?: string
    bossIdentityNo?: string
    bossIdentityFiles?: Array<{
      fileId: string
      fileName: string
      fileType: string
      fileSizeMb: number
      uploadedAt: string
    }>
    remark?: string
  },
) {
  return page.evaluate(async ({ applicationId, payload }) => {
    const store = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = store.getSampleVerificationByApplicationId(applicationId)
    if (!verification) throw new Error('未找到样衣验证记录')
    const result = flow.reviewFactorySample(verification.verificationId, payload as never, '平台样衣审核员')
    return {
      applicationStatus: result.application.status,
      applicationCurrentNode: result.application.currentNode,
      sampleStatus: result.sampleVerification.status,
      sampleNode: result.sampleVerification.currentNode,
      accountLocked: result.application.accountLocked,
      factoryNameLocked: result.application.factoryNameLocked,
    }
  }, { applicationId, payload })
}

async function validateSampleReviewFromPage(
  page: Page,
  applicationId: string,
  payload: {
    sampleReviewResult: string
    sampleReviewOpinion: string
    resubmitAllowed: boolean
    requiredResubmitItems: string[]
  },
) {
  return page.evaluate(async ({ applicationId, payload }) => {
    const store = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = store.getSampleVerificationByApplicationId(applicationId)
    if (!verification) return '未找到样衣验证记录'
    try {
      flow.reviewFactorySample(verification.verificationId, payload as never, '平台样衣审核员')
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : '样衣审核失败'
    }
  }, { applicationId, payload })
}

async function openSampleReview(page: Page, applicationId: string) {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator(`[data-factory-onboarding-action="open-sample-review"][data-application-id="${applicationId}"]`)).toContainText('样衣审核')
  await page.goto(`/fcs/factories/onboarding?applicationId=${applicationId}&dialog=sample-review`)
  await expect(page.locator('body')).toContainText('平台样衣审核')
}

const samplePhoto = {
  name: '重新提交样衣照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('resubmit-photo'),
}

const sampleVideo = {
  name: '重新提交样衣视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('resubmit-video'),
}

const factorySitePhoto = {
  name: '重新提交工厂照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('resubmit-site-photo'),
}

const factorySiteVideo = {
  name: '重新提交工厂视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('resubmit-site-video'),
}

test('平台样衣审核通过后进入样衣审核通过待转正式', async ({ page }) => {
  await openSampleReview(page, 'FOA-0022')
  const dialog = page.locator('body')
  await expect(dialog).toContainText('样衣照片')
  await expect(dialog).toContainText('样衣视频')
  await expect(dialog).toContainText('工艺说明')
  await expect(dialog).toContainText('工厂提交轮次')

  await setChecked(page, '[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="已通过"]')
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('样衣质量和工艺表现符合要求。')
  await setChecked(page, '[data-factory-onboarding-field="sampleReview-sampleQualityConclusion"][value="达标"]')
  await setChecked(page, '[data-factory-onboarding-field="sampleReview-capacityConclusion"][value="具备合作能力"]')
  const reviewResult = await reviewSampleFromPage(page, 'FOA-0022', {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '样衣质量和工艺表现符合要求。',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    sampleQualityConclusion: '达标',
    capacityConclusion: '具备合作能力',
    bossIdentityNo: 'BOSS-PW-STEP5',
    bossIdentityFiles: [{
      fileId: 'BOSS-PW-STEP5-FILE',
      fileName: '老板身份证.pdf',
      fileType: 'pdf',
      fileSizeMb: 2,
      uploadedAt: '2026-05-07 10:00:00',
    }],
  })

  expect(reviewResult.applicationStatus).toBe('样衣审核通过待转正式')
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0022&dialog=detail&tab=sample')
  await expect(page.locator('body')).toContainText('当前状态：样衣审核通过待转正式')
  const state = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0022')
    const master = await import('/src/data/fcs/factory-master-store.ts')
    return {
      createdFactoryId: application?.createdFactoryId || '',
      profileExists: application ? master.listFactoryMasterRecords().some((factory) => factory.name === application.factoryCompanyName) : true,
    }
  })
  expect(state.createdFactoryId).toBe('')
  expect(state.profileExists).toBe(false)

  await clearAuth(page)
  await fillLogin(page, 'onboarding_22')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待转正式合作')
  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
})

test('平台样衣审核退回后工厂可重新提交', async ({ page }) => {
  await openSampleReview(page, 'FOA-0023')
  const validationMessage = await validateSampleReviewFromPage(page, 'FOA-0023', {
    sampleReviewResult: '未通过',
    sampleReviewOpinion: '请补充样衣照片和视频细节。',
    resubmitAllowed: true,
    requiredResubmitItems: [],
  })
  expect(validationMessage).toContain('请选择需重新提交内容')

  await reviewSampleFromPage(page, 'FOA-0023', {
    sampleReviewResult: '未通过',
    sampleReviewOpinion: '请补充样衣照片和视频细节。',
    resubmitAllowed: true,
    requiredResubmitItems: ['样衣照片', '样衣视频'],
  })
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0023&dialog=detail&tab=sample')
  await expect(page.locator('body')).toContainText('当前状态：样衣审核退回')

  await clearAuth(page)
  await fillLogin(page, 'onboarding_23')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('上次样衣审核意见')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('需重新提交内容：样衣照片、样衣视频')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('重新提交样衣审核')

  await page.locator('[data-pda-onboarding-file="factorySamplePhotos"]').setInputFiles(samplePhoto)
  await page.locator('[data-pda-onboarding-file="factorySampleVideos"]').setInputFiles(sampleVideo)
  await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
  await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
  await page.locator('[data-pda-onboarding-field="sampleSubmission-factoryCraftDescription"]').fill('按退回意见补充关键工艺细节。')
  await page.locator('[data-pda-onboarding-action="submit-sample-review"]').click()
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
})

test('平台样衣审核未通过后不锁定账号并可继续重新提交', async ({ page }) => {
  await openSampleReview(page, 'FOA-0024')
  const rejectResult = await reviewSampleFromPage(page, 'FOA-0024', {
    sampleReviewResult: '未通过',
    sampleReviewOpinion: '样衣质量稳定性仍需补充验证。',
    resubmitAllowed: true,
    requiredResubmitItems: ['工艺说明'],
  })
  expect(rejectResult.accountLocked).toBe(false)
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0024&dialog=detail&tab=sample')
  await expect(page.locator('body')).toContainText('当前状态：样衣审核退回')
  await expect(page.locator('body')).toContainText('账号是否锁定：否')

  const rejected = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0024')
    return {
      factoryCompanyName: application?.factoryCompanyName || '',
      accountLocked: application?.accountLocked,
      factoryNameLocked: application?.factoryNameLocked,
    }
  })
  expect(rejected.accountLocked).toBe(false)
  expect(rejected.factoryNameLocked).toBe(false)

  await clearAuth(page)
  await fillLogin(page, 'onboarding_24')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣质量稳定性仍需补充验证。')
})

test('平台详情样衣验证页签展示样衣审核记录', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0025&dialog=detail&tab=sample')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('样衣审核记录')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('审核轮次')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('审核结果')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('审核意见')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('需重新提交内容')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('审核人')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('审核时间')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('对应提交轮次')
})

test('样衣审核通过待转正式账号仍不能进入业务页', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_31')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待转正式合作')
  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }
})
