import { expect, test, type Page } from '@playwright/test'

async function clearAuth(page: Page) {
  await page.goto('/fcs/pda/auth/login')
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

async function openSampleReview(page: Page, applicationId: string) {
  await page.goto(`/fcs/factories/onboarding?applicationId=${applicationId}&dialog=sample-review`)
  await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('平台样衣审核')
}

async function createReviewWaitingWithoutBossIdentity(page: Page, applicationId: string) {
  if (page.url() === 'about:blank') await page.goto('/fcs/factories/onboarding')
  return page.evaluate(async ({ applicationId }) => {
    const store = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = store.getSampleVerificationByApplicationId(applicationId)
    if (!verification) throw new Error('未找到样衣验证记录')
    const result = flow.submitFactorySampleReview(verification.verificationId, {
      factorySamplePhotos: [{
        fileId: 'PW-SAMPLE-PHOTO',
        fileName: '样衣照片.jpg',
        fileType: 'jpg',
        fileSizeMb: 2,
        uploadedAt: '2026-05-07 10:00:00',
      }],
      factorySampleVideos: [{
        fileId: 'PW-SAMPLE-VIDEO',
        fileName: '样衣视频.mp4',
        fileType: 'mp4',
        fileSizeMb: 12,
        uploadedAt: '2026-05-07 10:00:00',
      }],
      factoryCraftDescription: '样衣制作工艺说明。',
      factorySubmissionFiles: [],
      factorySitePhotos: [{
        fileId: 'PW-SITE-PHOTO',
        fileName: '工厂照片.jpg',
        fileType: 'jpg',
        fileSizeMb: 2,
        uploadedAt: '2026-05-07 10:00:00',
      }],
      factorySiteVideos: [{
        fileId: 'PW-SITE-VIDEO',
        fileName: '工厂视频.mp4',
        fileType: 'mp4',
        fileSizeMb: 16,
        uploadedAt: '2026-05-07 10:00:00',
      }],
      bossIdentityNo: '',
      bossIdentityFiles: [],
    } as never, 'Playwright 工厂管理员')
    return result.application.status
  }, { applicationId })
}

const samplePhoto = {
  name: '样衣照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('sample-photo'),
}

const sampleVideo = {
  name: '样衣视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('sample-video'),
}

const factorySitePhoto = {
  name: '工厂照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('factory-site-photo'),
}

const factorySiteVideo = {
  name: '工厂视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('factory-site-video'),
}

const bossIdentityFile = {
  name: '老板身份证.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('boss-id'),
}

async function expectOnboardingStatus(page: Page, applicationId: string, status: string) {
  void applicationId
  await expect.poll(async () => page.locator('body').textContent()).toContain(`当前状态：${status}`)
}

async function reviewSampleInBrowser(page: Page, applicationId: string, payload: Record<string, unknown>) {
  return page.evaluate(async ({ applicationId, payload }) => {
    const store = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = store.getSampleVerificationByApplicationId(applicationId)
    if (!verification) return { ok: false, message: '未找到样衣验证记录' }
    try {
      const result = flow.reviewFactorySample(verification.verificationId, payload as never, '平台样衣审核员')
      return { ok: true, status: result.application.status }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '样衣审核失败' }
    }
  }, { applicationId, payload })
}

test('工厂提交样衣时必须上传工厂照片和工厂视频', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_19')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传工厂照片')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传工厂视频')
  await page.locator('[data-pda-onboarding-file="factorySamplePhotos"]').setInputFiles(samplePhoto)
  await page.locator('[data-pda-onboarding-file="factorySampleVideos"]').setInputFiles(sampleVideo)
  await page.locator('[data-pda-onboarding-field="sampleSubmission-factoryCraftDescription"]').fill('样衣工艺说明。')

  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-submit-error"]')).toContainText('请上传工厂照片')

  await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-submit-error"]')).toContainText('请上传工厂视频')

  await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
})

test('工厂端老板身份资料非必填', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_20')
  await page.locator('[data-pda-onboarding-file="factorySamplePhotos"]').setInputFiles(samplePhoto)
  await page.locator('[data-pda-onboarding-file="factorySampleVideos"]').setInputFiles(sampleVideo)
  await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
  await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
  await page.locator('[data-pda-onboarding-field="sampleSubmission-factoryCraftDescription"]').fill('样衣工艺说明。')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('老板身份证号码/护照号码（可选）')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('老板身份证复印件或照片（可选）')
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
})

test('平台审核已通过时必须补齐老板身份资料', async ({ page }) => {
  await createReviewWaitingWithoutBossIdentity(page, 'FOA-0021')
  await openSampleReview(page, 'FOA-0021')
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('资料齐全后通过。')
  await expect(page.locator('[data-factory-onboarding-field="sampleReview-bossIdentityNo"]')).toBeVisible()
  await expect(page.locator('[data-factory-onboarding-file="sampleReview-bossIdentityFiles"]')).toBeVisible()

  const missingNo = await reviewSampleInBrowser(page, 'FOA-0021', {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '资料齐全后通过。',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    bossIdentityFiles: [],
  })
  expect(missingNo).toMatchObject({ ok: false })
  expect(missingNo.message).toContain('请填写老板身份证号码/护照号码')

  const missingFile = await reviewSampleInBrowser(page, 'FOA-0021', {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '资料齐全后通过。',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    bossIdentityNo: 'BOSS-PW-STEP10',
    bossIdentityFiles: [],
  })
  expect(missingFile).toMatchObject({ ok: false })
  expect(missingFile.message).toContain('请上传老板身份证复印件或照片')

  const passed = await reviewSampleInBrowser(page, 'FOA-0021', {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '资料齐全后通过。',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    bossIdentityNo: 'BOSS-PW-STEP10',
    bossIdentityFiles: [{
      fileId: 'PW-BOSS-ID',
      fileName: bossIdentityFile.name,
      fileType: 'pdf',
      fileSizeMb: 1,
      uploadedAt: '2026-05-07 10:00:00',
    }],
  })
  expect(passed).toMatchObject({ ok: true, status: '样衣审核通过待转正式' })
})

test('平台审核未通过时不强制老板身份资料', async ({ page }) => {
  await createReviewWaitingWithoutBossIdentity(page, 'FOA-0021')
  await openSampleReview(page, 'FOA-0021')
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('工厂照片需补充角度。')
  await nativeClick(page, '[data-factory-onboarding-field="sampleReviewRequiredItem"][value="工厂照片"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-sample-review"]')
  await expectOnboardingStatus(page, 'FOA-0021', '样衣审核退回')
})

test('工厂已提交老板身份资料时平台只读展示并可审核通过', async ({ page }) => {
  await openSampleReview(page, 'FOA-0023')
  await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('老板身份证号码/护照号码')
  await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('老板身份证复印件或照片')
  await expect(page.locator('[data-factory-onboarding-field="sampleReview-bossIdentityNo"]')).toHaveCount(0)
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]').fill('工厂已提交老板身份资料，审核通过。')
  const passed = await reviewSampleInBrowser(page, 'FOA-0023', {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '工厂已提交老板身份资料，审核通过。',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    bossIdentityFiles: [],
  })
  expect(passed).toMatchObject({ ok: true, status: '样衣审核通过待转正式' })
})
