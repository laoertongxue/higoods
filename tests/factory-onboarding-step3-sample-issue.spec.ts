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

async function openSampleIssue(page: import('@playwright/test').Page, applicationId: string) {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator(`[data-factory-onboarding-action="open-sample-issue"][data-application-id="${applicationId}"]`)).toContainText('登记并发放样衣')
  await nativeClick(page, `[data-factory-onboarding-action="open-sample-issue"][data-application-id="${applicationId}"]`)
  await expect(page.getByRole('heading', { name: '登记并发放样衣' })).toBeVisible({ timeout: 30_000 })
}

async function fillRequiredSampleIssue(page: import('@playwright/test').Page) {
  await page.locator('[data-factory-onboarding-field="sampleIssue-sampleBatchNo"]').fill('SY-20260506-E2E')
  await page.locator('[data-factory-onboarding-field="sampleIssue-styleNo"]').fill('HG-E2E-001')
  await page.locator('[data-factory-onboarding-field="sampleIssue-sampleName"]').fill('车缝能力验证样')
  await page.locator('[data-factory-onboarding-field="sampleIssue-sampleQuantity"]').fill('3')
  await page.locator('[data-factory-onboarding-field="sampleIssue-sampleDescription"]').fill('用于验证车缝能力和质量稳定性。')
  await nativeClick(page, '[data-factory-onboarding-field="sampleIssuePurpose"][value="检验车缝能力"]')
  await page.locator('[data-factory-onboarding-field="sampleIssue-issuedAt"]').fill('2026-05-06T10:00')
  await page.locator('[data-factory-onboarding-field="sampleIssue-issuedBy"]').fill('平台样衣员')
  await page.locator('[data-factory-onboarding-field="sampleIssue-expectedSubmitAt"]').fill('2026-05-10T18:00')
}

test('平台登记并发放样衣后进入待工厂确认收样', async ({ page }) => {
  await openSampleIssue(page, 'FOA-0013')
  await expect(page.locator('body')).toContainText('入驻申请编号')
  await expect(page.locator('body')).toContainText('工厂/公司名称')
  await expect(page.locator('body')).toContainText('姓名')
  await expect(page.locator('body')).toContainText('手机号')
  await fillRequiredSampleIssue(page)
  await nativeClick(page, '[data-factory-onboarding-action="submit-sample-issue"]')

  await expect(page.locator('[data-testid="factory-onboarding-status-panel"]')).toContainText('待工厂确认收样')
  await expect(page.locator('[data-testid="factory-sample-verification-detail"]')).toContainText('样衣批次号')
  await expect(page.locator('body')).toContainText('查看样衣')

  const result = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const sampleStore = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0013')
    const sample = sampleStore.getSampleVerificationByApplicationId('FOA-0013')
    return {
      status: application?.status,
      currentNode: application?.currentNode,
      sampleStatus: application?.sampleStatus,
      sampleVerificationId: application?.sampleVerificationId || '',
      sampleBatchNo: sample?.sampleBatchNo,
      createdFactoryId: application?.createdFactoryId || '',
      accountStatus: application?.adminAccount.accountStatus,
      canEnterBusiness: application ? flow.canFactoryEnterBusiness(application.status) : true,
    }
  })
  expect(result.status).toBe('待工厂确认收样')
  expect(result.currentNode).toBe('样衣验证')
  expect(result.sampleStatus).toBe('待工厂确认收样')
  expect(result.sampleVerificationId).not.toBe('')
  expect(result.sampleBatchNo).toBe('SY-20260506-E2E')
  expect(result.createdFactoryId).toBe('')
  expect(result.accountStatus).not.toBe('已转正式')
  expect(result.canEnterBusiness).toBe(false)
})

test('快递发放缺少快递公司和快递单号时展示中文校验', async ({ page }) => {
  await openSampleIssue(page, 'FOA-0014')
  await fillRequiredSampleIssue(page)
  await nativeClick(page, '[data-factory-onboarding-field="sampleIssue-issueMethod"][value="快递发放"]')
  await nativeClick(page, '[data-factory-onboarding-action="submit-sample-issue"]')
  await expect(page.locator('[data-testid="factory-sample-issue-error"]')).toContainText('请填写快递公司')
  await expect(page.locator('[data-testid="factory-sample-issue-error"]')).toContainText('请填写快递单号')
})

test('禁止重复发放和非待样衣验证状态发放', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-factory-onboarding-action="open-sample-issue"][data-application-id="FOA-0016"]')).toHaveCount(0)
  await expect(page.locator('[data-factory-onboarding-action="open-sample-issue"][data-application-id="FOA-0004"]')).toHaveCount(0)

  const messages = await page.evaluate(async () => {
    const sampleFlow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const payload = sampleFlow.createSampleIssuePayload({
      sampleBatchNo: 'SY-重复测试',
      styleNo: 'HG-REPEAT',
      sampleName: '重复验证样',
      sampleDescription: '重复发放测试',
      verificationPurpose: ['检验车缝能力'],
      sampleQuantity: 1,
      issueMethod: '现场发放',
      issuedAt: '2026-05-06 10:00:00',
      issuedBy: '平台样衣员',
      expectedSubmitAt: '2026-05-10 18:00:00',
    })
    const result: string[] = []
    try {
      sampleFlow.issueSampleForOnboarding('FOA-0016', payload, '平台样衣员')
    } catch (error) {
      result.push(error instanceof Error ? error.message : '')
    }
    try {
      sampleFlow.issueSampleForOnboarding('FOA-0004', payload, '平台样衣员')
    } catch (error) {
      result.push(error instanceof Error ? error.message : '')
    }
    return result
  })
  expect(messages).toContain('当前申请已登记样衣，请勿重复发放。')
  expect(messages).toContain('只有待样衣验证的申请可以登记并发放样衣。')
})

test('工厂端展示样衣信息并出现下一步确认收样入口', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_16', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣验证')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣批次号')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('款号')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣名称')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣件数')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣说明')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('验证目的')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('发放时间')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('预计提交样衣审核时间')
  await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂确认收样')
  await expect(page.locator('body')).toContainText('待工厂确认收样')
  await expect(page.getByRole('button', { name: '确认收到样衣' })).toHaveCount(1)
})

test('待工厂确认收样账号仍不能进入业务页', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_16', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }
})
