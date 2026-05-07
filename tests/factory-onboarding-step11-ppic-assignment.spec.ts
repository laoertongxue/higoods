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

const samplePhoto = { name: '样衣照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('sample-photo') }
const sampleVideo = { name: '样衣视频.mp4', mimeType: 'video/mp4', buffer: Buffer.from('sample-video') }
const factorySitePhoto = { name: '工厂照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('factory-site-photo') }
const factorySiteVideo = { name: '工厂视频.mp4', mimeType: 'video/mp4', buffer: Buffer.from('factory-site-video') }

async function submitSampleByFunction(page: Page, applicationId: string) {
  return page.evaluate(async ({ applicationId }) => {
    const sampleStore = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const sampleFlow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = sampleStore.getSampleVerificationByApplicationId(applicationId)
    if (!verification) throw new Error('未找到样衣验证记录')
    const file = (fileName: string, fileType: string) => ({
      fileId: `PW11-${fileName}`,
      fileName,
      fileType,
      fileSizeMb: fileType === 'mp4' ? 12 : 2,
      uploadedAt: '2026-05-07 12:00:00',
    })
    const result = sampleFlow.submitFactorySampleReview(verification.verificationId, {
      factorySamplePhotos: [file('样衣照片.jpg', 'jpg')],
      factorySampleVideos: [file('样衣视频.mp4', 'mp4')],
      factoryCraftDescription: '样衣工艺说明。',
      factoryProblemDescription: '',
      factorySubmitRemark: '',
      factorySubmissionFiles: [],
      factorySitePhotos: [file('工厂照片.jpg', 'jpg')],
      factorySiteVideos: [file('工厂视频.mp4', 'mp4')],
      bossIdentityNo: '',
      bossIdentityFiles: [],
    } as never, 'Playwright 工厂管理员')
    return {
      applicationId: result.application.applicationId,
      assignedPpicId: result.application.assignedPpicId,
      assignedPpicName: result.application.assignedPpicName,
      ppicChangeLogs: result.application.ppicChangeLogs.length,
    }
  }, { applicationId })
}

test('工厂提交样衣后自动分配默认 PPIC', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_19')
  await page.locator('[data-pda-onboarding-file="factorySamplePhotos"]').setInputFiles(samplePhoto)
  await page.locator('[data-pda-onboarding-file="factorySampleVideos"]').setInputFiles(sampleVideo)
  await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
  await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
  await page.locator('[data-pda-onboarding-field="sampleSubmission-factoryCraftDescription"]').fill('样衣工艺说明。')
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')

  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0019&dialog=detail&tab=basic')
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toContainText('默认跟进 PPIC')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('系统默认分配')
})

test('已有 PPIC 不被默认覆盖', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  const result = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    store.updateOnboardingPpic('FOA-0025', 'PPIC-ACTIVE-002', 'Playwright 平台运营员', '预先指定 PPIC')
    const before = store.getFactoryOnboardingApplicationById('FOA-0025')!
    const beforeLogs = before.ppicChangeLogs.length
    const sampleStore = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const sampleFlow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = sampleStore.getSampleVerificationByApplicationId('FOA-0025')!
    const file = (fileName: string, fileType: string) => ({
      fileId: `PW11-${fileName}`,
      fileName,
      fileType,
      fileSizeMb: fileType === 'mp4' ? 12 : 2,
      uploadedAt: '2026-05-07 12:00:00',
    })
    const submitted = sampleFlow.submitFactorySampleReview(verification.verificationId, {
      factorySamplePhotos: [file('重提样衣照片.jpg', 'jpg')],
      factorySampleVideos: [file('重提样衣视频.mp4', 'mp4')],
      factoryCraftDescription: '重新提交样衣工艺说明。',
      factorySubmissionFiles: [],
      factorySitePhotos: [file('重提工厂照片.jpg', 'jpg')],
      factorySiteVideos: [file('重提工厂视频.mp4', 'mp4')],
      bossIdentityFiles: [],
    } as never, 'Playwright 工厂管理员')
    return {
      assignedPpicId: submitted.application.assignedPpicId,
      ppicChangeLogs: submitted.application.ppicChangeLogs.length,
      beforeLogs,
    }
  })
  expect(result.assignedPpicId).toBe('PPIC-ACTIVE-002')
  expect(result.ppicChangeLogs).toBe(result.beforeLogs)
})

test('平台修改 PPIC 并写入变更记录', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0022&dialog=ppic')
  await expect(page.locator('[data-factory-onboarding-dialog="ppic"]')).toContainText('修改 PPIC')
  await page.locator('[data-factory-onboarding-field="ppicDraftId"]').evaluate((element) => {
    const select = element as HTMLSelectElement
    select.value = 'PPIC-ACTIVE-002'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.locator('[data-factory-onboarding-field="ppicDraftId"]')).toHaveValue('PPIC-ACTIVE-002')
  await page.locator('[data-factory-onboarding-field="ppicChangeReason"]').fill('Playwright 调整跟进人')
  const updated = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.updateOnboardingPpic(
      'FOA-0022',
      'PPIC-ACTIVE-002',
      '平台运营员',
      'Playwright 调整跟进人',
    )
    return {
      assignedPpicName: application.assignedPpicName,
      latestReason: application.ppicChangeLogs.at(-1)?.changeReason,
      changeLogCount: application.ppicChangeLogs.length,
    }
  })
  expect(updated.assignedPpicName).toBe('李敏 PPIC')
  expect(updated.latestReason).toBe('Playwright 调整跟进人')
  expect(updated.changeLogCount).toBeGreaterThanOrEqual(2)
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0022&dialog=detail&tab=basic')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('李敏 PPIC')
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toContainText('Playwright 调整跟进人')
})

test('PPIC 筛选支持具体 PPIC、未分配和全部', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await page.locator('[data-factory-onboarding-field="ppicFilter"]').selectOption('PPIC-DEFAULT-001')
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toContainText('默认跟进 PPIC')

  await page.locator('[data-factory-onboarding-field="ppicFilter"]').selectOption('UNASSIGNED')
  const rows = await page.locator('tbody tr').allTextContents()
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.some((row) => row.includes('未分配'))).toBeTruthy()

  await page.locator('[data-factory-onboarding-field="ppicFilter"]').selectOption('ALL')
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toContainText('默认跟进 PPIC')
})

test('转正式后携带 PPIC', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  const result = await page.evaluate(async () => {
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const factoryStore = await import('/src/data/fcs/factory-master-store.ts')
    const converted = await flow.convertOnboardingToOfficialFactory('FOA-0031', 'Playwright 转档员')
    const factory = factoryStore.getFactoryMasterRecordById(converted.createdFactory.id)
    return {
      applicationPpic: converted.application.assignedPpicName,
      factoryPpic: factory?.assignedPpicName,
    }
  })
  expect(result.factoryPpic).toBe(result.applicationPpic)
  await page.goto('/fcs/factories/profile')
  await expect(page.locator('body')).toContainText(result.factoryPpic || '')
})
