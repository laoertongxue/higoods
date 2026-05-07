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

async function nativeClick(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

const samplePhotoA = {
  name: '样衣正面.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('sample-photo-a'),
}

const samplePhotoB = {
  name: '样衣细节.png',
  mimeType: 'image/png',
  buffer: Buffer.from('sample-photo-b'),
}

const sampleVideo = {
  name: '样衣过程.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('sample-video'),
}

const factorySitePhoto = {
  name: '工厂现场.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('factory-site-photo'),
}

const factorySiteVideo = {
  name: '工厂现场.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('factory-site-video'),
}

test('工厂确认收到样衣后进入待工厂提交样衣审核', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_16')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣验证')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂确认收样')
  await expect(page.locator('[data-pda-onboarding-action="open-sample-receive"]')).toContainText('确认收到样衣')

  await nativeClick(page, '[data-pda-onboarding-action="open-sample-receive"]')
  await expect(page.locator('[data-pda-onboarding-dialog="sample-receive"]')).toContainText('确认收样时间')
  await expect(page.locator('[data-pda-onboarding-dialog="sample-receive"]')).toContainText('确认收样人')
  await expect(page.locator('[data-pda-onboarding-dialog="sample-receive"]')).toContainText('收样备注')

  await page.locator('[data-pda-onboarding-field="sampleReceive-factoryReceivedBy"]').fill('')
  await nativeClick(page, '[data-pda-onboarding-action="confirm-sample-receive"]')
  await expect(page.locator('[data-testid="pda-sample-receive-error"]')).toContainText('请填写确认收样人')

  await page.locator('[data-pda-onboarding-field="sampleReceive-factoryReceivedBy"]').fill('工厂样衣管理员')
  await nativeClick(page, '[data-pda-onboarding-action="confirm-sample-receive"]')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂提交样衣审核')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('提交样衣审核资料')
})

test('工厂提交样衣审核资料需要照片、视频和工艺说明', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_19')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传样衣照片')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传样衣视频')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('工艺说明')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传工厂照片')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('上传工厂视频')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('问题说明')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('备注')

  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-submit-error"]')).toContainText('请上传样衣照片')

  await page.locator('[data-pda-onboarding-file="factorySamplePhotos"]').setInputFiles([samplePhotoA, samplePhotoB])
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-submit-error"]')).toContainText('请上传样衣视频')

  await page.locator('[data-pda-onboarding-file="factorySampleVideos"]').setInputFiles(sampleVideo)
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-submit-error"]')).toContainText('请填写工艺说明')

  await page.locator('[data-pda-onboarding-field="sampleSubmission-factoryCraftDescription"]').fill('按平台参考资料完成车缝、后道和质量自检。')
  await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
  await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
  await nativeClick(page, '[data-pda-onboarding-action="submit-sample-review"]')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
  await expect(page.locator('body')).toContainText('待平台审核样衣')
})

test('待平台审核样衣状态只读且不能重复提交', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_22')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-submitted-info"]')).toContainText('已提交样衣照片')
  await expect(page.locator('[data-testid="pda-sample-submitted-info"]')).toContainText('已提交样衣视频')
  await expect(page.locator('[data-testid="pda-sample-submitted-info"]')).toContainText('工艺说明')
  await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-onboarding-action="submit-sample-review"]')).toHaveCount(0)
})

test('平台详情样衣验证页签只读展示工厂提交资料', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0022&dialog=detail&tab=sample')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator('body')).toContainText('工厂已提交样衣审核资料')
  await expect(page.locator('body')).toContainText('提交时间')
  await expect(page.locator('body')).toContainText('提交人')
  await expect(page.locator('body')).toContainText('样衣照片')
  await expect(page.locator('body')).toContainText('样衣视频')
  await expect(page.locator('body')).toContainText('工艺说明')
  await expect(page.locator('body')).toContainText('样衣审核记录')
})

test('待平台审核样衣账号仍不能进入业务页', async ({ page }) => {
  await clearAuth(page)
  await fillLogin(page, 'onboarding_22')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }
})
