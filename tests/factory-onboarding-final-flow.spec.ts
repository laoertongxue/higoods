import { expect, test, type Page } from '@playwright/test'

async function clearAuth(page: Page) {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
  await page.goto('/fcs/pda/auth/login')
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

async function fillRequiredDraft(page: Page, prefix: string) {
  const stamp = Date.now()
  const factoryShortName = `${prefix}_${stamp}`
  const factoryCompanyName = `${prefix}全链路演示工厂${stamp}`
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(factoryShortName)
  await page.locator('[data-pda-onboarding-field="applicantName"]').fill(`${prefix}申请人`)
  await page.locator('[data-pda-onboarding-field="identityNo"]').fill(`ID-${prefix}-${stamp}`)
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill(factoryCompanyName)
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达工业园全链路 01 号')
  await page.locator('[data-pda-onboarding-field="mobilePhone"]').fill('+62-812-0000-7711')
  await page.locator('[data-pda-onboarding-field="sourceChannel"]').fill('PPIC 转介绍')
  await page.locator('[data-pda-onboarding-field="ppicName"]').fill('王 PPIC')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('4')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('22')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-06-12')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]')
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('自动裁床')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineNo"]').fill('CUT-FINAL-01')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('1')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })
  return { loginId: factoryShortName, factoryCompanyName }
}

async function getApplicationByLoginId(page: Page, loginId: string) {
  return page.evaluate(async ({ loginId }) => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.listFactoryOnboardingApplications().find((item) => item.adminAccount.loginId === loginId)
    if (!application) throw new Error(`未找到入驻申请：${loginId}`)
    return {
      applicationId: application.applicationId,
      status: application.status,
      currentNode: application.currentNode,
      factoryCompanyName: application.factoryCompanyName,
      createdFactoryId: application.createdFactoryId || '',
    }
  }, { loginId })
}

async function reviewOnboarding(
  page: Page,
  applicationId: string,
  reviewResult: '已通过' | '未通过',
  reviewOpinion: string,
  requiredFields: string[] = [],
) {
  return page.evaluate(async ({ applicationId, reviewResult, reviewOpinion, requiredFields }) => {
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const result = flow.reviewFactoryOnboardingApplication({
      applicationId,
      reviewResult,
      reviewOpinion,
      reviewer: 'Playwright 初审员',
      requiredFields,
    })
    return {
      status: result.status,
      currentNode: result.currentNode,
      accountLocked: result.accountLocked,
      factoryNameLocked: result.factoryNameLocked,
      createdFactoryId: result.createdFactoryId || '',
    }
  }, { applicationId, reviewResult, reviewOpinion, requiredFields })
}

async function issueSample(page: Page, applicationId: string) {
  return page.evaluate(async ({ applicationId }) => {
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const payload = flow.createSampleIssuePayload()
    payload.sampleBatchNo = `SY-FINAL-${Date.now()}`
    payload.styleNo = 'ST-FINAL-01'
    payload.sampleName = '全链路样衣'
    payload.sampleQuantity = 2
    payload.sampleDescription = '用于全链路验收的样衣。'
    payload.verificationPurpose = ['检验车缝能力', '检验质量稳定性']
    payload.issueMethod = '现场发放'
    payload.issuedAt = '2026-05-06 10:00:00'
    payload.issuedBy = 'Playwright 发样员'
    payload.expectedSubmitAt = '2026-05-12 18:00:00'
    const result = flow.issueSampleForOnboarding(applicationId, payload, 'Playwright 发样员')
    return {
      applicationStatus: result.application.status,
      sampleStatus: result.sampleVerification.status,
      verificationId: result.sampleVerification.verificationId,
      sampleBatchNo: result.sampleVerification.sampleBatchNo,
    }
  }, { applicationId })
}

async function reviewSample(
  page: Page,
  applicationId: string,
  sampleReviewResult: '已通过' | '未通过',
  sampleReviewOpinion: string,
  requiredResubmitItems: string[] = [],
) {
  return page.evaluate(async ({ applicationId, sampleReviewResult, sampleReviewOpinion, requiredResubmitItems }) => {
    const store = await import('/src/data/fcs/factory-sample-verification-store.ts')
    const flow = await import('/src/data/fcs/factory-sample-verification-flow.ts')
    const verification = store.getSampleVerificationByApplicationId(applicationId)
    if (!verification) throw new Error('未找到样衣验证记录')
    const result = flow.reviewFactorySample(verification.verificationId, {
      sampleReviewResult,
      sampleReviewOpinion,
      resubmitAllowed: sampleReviewResult === '未通过',
      requiredResubmitItems,
      sampleQualityConclusion: sampleReviewResult === '已通过' ? '达标' : undefined,
      capacityConclusion: sampleReviewResult === '已通过' ? '具备合作能力' : undefined,
      bossIdentityNo: sampleReviewResult === '已通过' ? 'BOSS-FINAL-FLOW' : undefined,
      bossIdentityFiles: sampleReviewResult === '已通过'
        ? [{
            fileId: 'BOSS-FINAL-FLOW-FILE',
            fileName: '老板身份证.pdf',
            fileType: 'pdf',
            fileSizeMb: 2,
            uploadedAt: '2026-05-07 10:00:00',
          }]
        : [],
    }, 'Playwright 样衣审核员')
    return {
      applicationStatus: result.application.status,
      sampleStatus: result.sampleVerification.status,
      accountLocked: result.application.accountLocked,
      factoryNameLocked: result.application.factoryNameLocked,
      factoryCompanyName: result.application.factoryCompanyName,
      loginId: result.application.adminAccount.loginId,
    }
  }, { applicationId, sampleReviewResult, sampleReviewOpinion, requiredResubmitItems })
}

async function convertOfficial(page: Page, applicationId: string) {
  if (page.url() === 'about:blank') await page.goto('/fcs/factories/onboarding')
  return page.evaluate(async ({ applicationId }) => {
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const result = await flow.convertOnboardingToOfficialFactory(applicationId, 'Playwright 转档员')
    return {
      status: result.application.status,
      currentNode: result.application.currentNode,
      factoryId: result.createdFactory.id,
      factoryName: result.createdFactory.name,
      adminLoginId: result.application.adminAccount.loginId,
      capacityProfileId: result.capacityProfile.capacityProfileId,
    }
  }, { applicationId })
}

const samplePhoto = {
  name: '全链路样衣照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('final-flow-photo'),
}

const sampleVideo = {
  name: '全链路样衣视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('final-flow-video'),
}

const factorySitePhoto = {
  name: '全链路工厂照片.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from('final-flow-site-photo'),
}

const factorySiteVideo = {
  name: '全链路工厂视频.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('final-flow-site-video'),
}

test.describe.serial('factory-onboarding-final-flow', () => {
  test('场景一：工厂入驻与平台初审通过', async ({ page }) => {
    await clearAuth(page)
    await page.goto('/fcs/pda/auth/login')
    await expect(page.locator('[data-testid="pda-auth-login-page"]')).toBeVisible()
    await nativeClick(page, '[data-pda-login-action="go-onboarding"]')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await expect(page.locator('[data-testid="pda-onboarding-form"]')).toBeVisible()
    const created = await fillRequiredDraft(page, 'final_apply')
    await page.locator('[data-testid="pda-onboarding-submit"]').click()
    await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
    await expect(page.locator('body')).toContainText('待平台审核')

    const application = await getApplicationByLoginId(page, created.loginId)
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
    await expect(page.locator('body')).toContainText(created.factoryCompanyName)
    await page.goto(`/fcs/factories/onboarding?applicationId=${application.applicationId}&dialog=review`)
    await expect(page.locator('[data-testid="factory-onboarding-review-dialog"], [data-factory-onboarding-dialog="review"]')).toContainText('审核结果')
    const review = await reviewOnboarding(page, application.applicationId, '已通过', '资料齐全，进入待样衣验证。')
    expect(review.status).toBe('待样衣验证')
    expect(review.currentNode).toBe('样衣验证')
    expect(review.createdFactoryId).toBe('')

    await clearAuth(page)
    await fillLogin(page, created.loginId)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await page.goto('/fcs/pda/exec')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  })

  test('场景二：平台初审退回与再次申请', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0004&dialog=review')
    await expect(page.locator('[data-testid="factory-onboarding-review-dialog"], [data-factory-onboarding-dialog="review"]')).toContainText('未通过')
    const returned = await reviewOnboarding(page, 'FOA-0004', '未通过', '请补充地址与机器明细。', ['地址', '机器明细'])
    expect(returned.status).toBe('平台审核退回')
    await clearAuth(page)
    await fillLogin(page, 'onboarding_4')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('请补充地址与机器明细。')
    await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('地址')
    await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('机器明细')
    await page.locator('[data-pda-onboarding-field="address"]').fill('退回后补充的新地址')
    await page.locator('[data-testid="pda-onboarding-submit"]').click()
    await expect(page.locator('body')).toContainText('已提交入驻申请')
    await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
  })

  test('场景三：平台初审未通过不锁定', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0005&dialog=review')
    await expect(page.locator('[data-testid="factory-onboarding-review-dialog"], [data-factory-onboarding-dialog="review"]')).toContainText('未通过')
    const rejected = await reviewOnboarding(page, 'FOA-0005', '未通过', '该工厂资料需要补充。', ['工厂简称'])
    expect(rejected.status).toBe('平台审核退回')
    expect(rejected.accountLocked).toBe(false)
    expect(rejected.factoryNameLocked).toBe(false)
    await clearAuth(page)
    await fillLogin(page, 'onboarding_5')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('该工厂资料需要补充。')
  })

  test('场景四：平台发放样衣', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('[data-testid="factory-sample-issue-button"][data-application-id="FOA-0013"]')).toContainText('登记并发放样衣')
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=sample-issue')
    await expect(page.locator('[data-testid="factory-sample-issue-dialog"], [data-factory-onboarding-dialog="sample-issue"]')).toContainText('登记并发放样衣')
    await page.locator('[data-factory-onboarding-field="sampleIssue-sampleBatchNo"]').fill(`SY-FINAL-${Date.now()}`)
    await page.locator('[data-factory-onboarding-field="sampleIssue-styleNo"]').fill('ST-FINAL-13')
    await page.locator('[data-factory-onboarding-field="sampleIssue-sampleName"]').fill('平台发放全链路样衣')
    await page.locator('[data-factory-onboarding-field="sampleIssue-sampleQuantity"]').fill('2')
    await page.locator('[data-factory-onboarding-field="sampleIssue-sampleDescription"]').fill('平台登记并发放样衣。')
    await page.locator('[data-factory-onboarding-field="sampleIssuePurpose"][value="检验车缝能力"]').check()
    await page.locator('[data-factory-onboarding-field="sampleIssue-issueMethod"][value="现场发放"]').check()
    await page.locator('[data-factory-onboarding-field="sampleIssue-issuedAt"]').fill('2026-05-06T10:00')
    await page.locator('[data-factory-onboarding-field="sampleIssue-issuedBy"]').fill('Playwright 发样员')
    await page.locator('[data-factory-onboarding-field="sampleIssue-expectedSubmitAt"]').fill('2026-05-12T18:00')
    const issued = await issueSample(page, 'FOA-0013')
    expect(issued.applicationStatus).toBe('待工厂确认收样')
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('[data-testid="factory-sample-issue-button"][data-application-id="FOA-0013"]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText('查看样衣')

    await clearAuth(page)
    await fillLogin(page, 'onboarding_13')
    await expect(page.locator('[data-testid="pda-sample-card"]')).toBeAttached()
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣验证')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂确认收样')
    await page.goto('/fcs/pda/exec')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  })

  test('场景五：工厂确认收样并提交样衣审核资料', async ({ page }) => {
    await clearAuth(page)
    await fillLogin(page, 'onboarding_16')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂确认收样')
    await nativeClick(page, '[data-testid="pda-confirm-sample-received"]')
    await expect(page.locator('[data-pda-onboarding-dialog="sample-receive"]')).toContainText('确认收样人')
    await page.locator('[data-pda-onboarding-field="sampleReceive-factoryReceivedBy"]').fill('全链路收样人')
    await page.locator('[data-pda-onboarding-field="sampleReceive-factoryReceiveRemark"]').fill('样衣已收到。')
    await nativeClick(page, '[data-pda-onboarding-action="confirm-sample-receive"]')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待工厂提交样衣审核')
    await page.locator('[data-testid="pda-sample-photo-upload"]').setInputFiles(samplePhoto)
    await page.locator('[data-testid="pda-sample-video-upload"]').setInputFiles(sampleVideo)
    await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
    await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
    await page.locator('[data-testid="pda-sample-craft-description"]').fill('按平台样衣要求完成车缝和质量自检。')
    await nativeClick(page, '[data-testid="pda-submit-sample-review"]')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
    await expect(page.locator('body')).toContainText('待平台审核样衣')
    await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toHaveCount(0)
  })

  test('场景六：平台样衣审核退回并重新提交', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('[data-testid="factory-sample-review-button"][data-application-id="FOA-0022"]')).toContainText('样衣审核')
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0022&dialog=sample-review')
    await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('平台样衣审核')
    const returned = await reviewSample(page, 'FOA-0022', '未通过', '请重新提交样衣照片和视频。', ['样衣照片', '样衣视频'])
    expect(returned.applicationStatus).toBe('样衣审核退回')
    await clearAuth(page)
    await fillLogin(page, 'onboarding_22')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('上次样衣审核意见')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('需重新提交内容：样衣照片、样衣视频')
    await expect(page.locator('[data-testid="pda-sample-submit-form"]')).toContainText('重新提交样衣审核')
    await page.locator('[data-testid="pda-sample-photo-upload"]').setInputFiles(samplePhoto)
    await page.locator('[data-testid="pda-sample-video-upload"]').setInputFiles(sampleVideo)
    await page.locator('[data-pda-onboarding-file="factorySitePhotos"]').setInputFiles(factorySitePhoto)
    await page.locator('[data-pda-onboarding-file="factorySiteVideos"]').setInputFiles(factorySiteVideo)
    await page.locator('[data-testid="pda-sample-craft-description"]').fill('按退回意见重新提交。')
    await nativeClick(page, '[data-testid="pda-submit-sample-review"]')
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('当前状态：待平台审核样衣')
  })

  test('场景七：平台样衣审核未通过不锁定', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0023&dialog=sample-review')
    await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('平台样衣审核')
    const rejected = await reviewSample(page, 'FOA-0023', '未通过', '样衣质量稳定性仍需补充验证。', ['工艺说明'])
    expect(rejected.applicationStatus).toBe('样衣审核退回')
    expect(rejected.accountLocked).toBe(false)
    await clearAuth(page)
    await fillLogin(page, rejected.loginId)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await expect(page.locator('[data-testid="pda-sample-verification-card"]')).toContainText('样衣质量稳定性仍需补充验证。')
  })

  test('场景八：平台样衣审核通过但未转正式', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0024&dialog=sample-review')
    await expect(page.locator('[data-testid="factory-sample-review-dialog"], [data-factory-onboarding-dialog="sample-review"]')).toContainText('平台样衣审核')
    const passed = await reviewSample(page, 'FOA-0024', '已通过', '样衣审核通过，等待转正式。')
    expect(passed.applicationStatus).toBe('样衣审核通过待转正式')
    const state = await page.evaluate(async () => {
      const store = await import('/src/data/fcs/factory-onboarding-store.ts')
      const master = await import('/src/data/fcs/factory-master-store.ts')
      const application = store.getFactoryOnboardingApplicationById('FOA-0024')
      return {
        createdFactoryId: application?.createdFactoryId || '',
        profileExists: application ? master.listFactoryMasterRecords().some((factory) => factory.name === application.factoryCompanyName) : true,
      }
    })
    expect(state.createdFactoryId).toBe('')
    expect(state.profileExists).toBe(false)
    await clearAuth(page)
    await fillLogin(page, passed.loginId)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await page.goto('/fcs/pda/exec')
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
    await expect(page.locator('body')).toContainText('待转正式合作')
  })

  test('场景九：样衣通过后转正式合作', async ({ page }) => {
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('[data-testid="factory-official-conversion-button"][data-application-id="FOA-0031"]')).toContainText('转正式合作')
    await page.goto('/fcs/factories/onboarding?applicationId=FOA-0031&dialog=conversion')
    const conversionDialog = page.locator('[data-testid="factory-official-conversion-dialog"], [data-factory-onboarding-dialog="conversion"]')
    await expect(conversionDialog).toContainText('样衣通过后转正式合作')
    await expect(conversionDialog).toContainText('工厂档案：生成')
    await expect(conversionDialog).toContainText('管理员账号：转正')
    await expect(conversionDialog).toContainText('产能档案：生成')
    const converted = await convertOfficial(page, 'FOA-0031')
    expect(converted.status).toBe('已转正式合作')
    await page.goto('/fcs/factories/onboarding')
    await expect(page.locator('body')).toContainText('已转正式合作')
    await expect(page.locator('body')).toContainText('查看工厂档案')
    await page.goto('/fcs/factories/profile')
    await expect(page.locator('body')).toContainText(converted.factoryName)
    await page.goto(`/fcs/factories/capacity-profile?factoryId=${converted.factoryId}`)
    await expect(page.locator('body')).toContainText('待补充产能字段')

    await clearAuth(page)
    await fillLogin(page, converted.adminLoginId)
    await expect(page).toHaveURL(/\/fcs\/pda\/exec/)
    for (const route of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
      await page.goto(route)
      await expect(page).not.toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
      await expect(page).not.toHaveURL(/\/fcs\/pda\/auth\/login/)
    }
  })

  test('场景十：派单候选工厂过滤', async ({ page }) => {
    const converted = await convertOfficial(page, 'FOA-0032')
    await page.goto('/fcs/dispatch/board')
    const candidates = await page.evaluate(async () => {
      const master = await import('/src/data/fcs/factory-master-store.ts')
      return master.listBusinessFactoryMasterRecords().map((factory) => ({ id: factory.id, name: factory.name }))
    })
    expect(candidates.some((factory) => factory.id === converted.factoryId)).toBe(true)
    expect(candidates.some((factory) => factory.name === '数码印演示工厂13')).toBe(false)
    expect(candidates.some((factory) => factory.name === '定位裁演示工厂33')).toBe(false)
    expect(candidates.some((factory) => factory.name === '车缝演示工厂28')).toBe(false)
  })
})
