import { expect, test } from '@playwright/test'

async function clearAuth(page: import('@playwright/test').Page) {
  if (page.url() === 'about:blank') await page.goto('/fcs/pda/auth/login')
  await page.evaluate(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  }).catch(() => {})
}

async function fillLogin(page: import('@playwright/test').Page, loginId: string, password: string) {
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
}

async function nativeClick(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().evaluate((element) => {
    ;(element as HTMLElement).click()
  })
}

async function fillRequiredDraft(page: import('@playwright/test').Page, prefix: string, factoryCompanyName?: string) {
  const stamp = Date.now()
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(`${prefix}_${stamp}`)
  await page.locator('[data-pda-onboarding-field="applicantName"]').fill(`${prefix}申请人`)
  await page.locator('[data-pda-onboarding-field="identityNo"]').fill(`ID-${prefix}-${stamp}`)
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill(factoryCompanyName || `${prefix}演示工厂`)
  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达工业园 A-01')
  await page.locator('[data-pda-onboarding-field="mobilePhone"]').fill('+62-812-0000-6601')
  await page.locator('[data-pda-onboarding-field="sourceChannel"]').fill('PPIC 转介绍')
  await page.locator('[data-pda-onboarding-field="ppicName"]').fill('陈 PPIC')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('3')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('18')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-06-01')
}

async function selectCutPanelCapability(page: import('@playwright/test').Page) {
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="CUT_PANEL"][data-craft-code="CRAFT_000001"]')
}

async function addMachineLinkedToFirstSelectedCapability(page: import('@playwright/test').Page) {
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('自动裁床')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('1')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })
}

test('工厂端入驻表单字段完整', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  for (const label of ['姓名', '身份证号码/护照号码', '地址', '工厂简称', '工厂/公司名称', '机器数量', '手机号', '来源', '收到此通知的 PPIC 姓名', '上传身份证复印件/电子文件', '有效工人数量', '可开始合作时间', '工序工艺能力', '机器明细']) {
    await expect(page.locator('body')).toContainText(label)
  }
})

test('入驻表单必填、工序工艺和机器关联校验', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请填写工厂简称')

  await fillRequiredDraft(page, 'step1_process_only')
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="CUT_PANEL"]')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('请至少选择一个工序工艺')

  await selectCutPanelCapability(page)
  await addMachineLinkedToFirstSelectedCapability(page)
  await nativeClick(page, '[data-pda-onboarding-action="select-process"][data-process-code="PRINT"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"][data-process-code="PRINT"][data-craft-code="CRAFT_2000002"]')
  await nativeClick(page, '[data-pda-onboarding-action="remove-capability"][data-capability-index="0"]')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺。')
})

test('平台初审通过进入待样衣验证且不转正式', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="已通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料齐全，进入待样衣验证。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')

  const reviewed = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const flow = await import('/src/data/fcs/factory-onboarding-flow.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0004')
    return {
      status: application?.status,
      currentNode: application?.currentNode,
      createdFactoryId: application?.createdFactoryId || '',
      accountStatus: application?.adminAccount.accountStatus,
      canEnterBusiness: application ? flow.canFactoryEnterBusiness(application.status) : true,
    }
  })
  expect(reviewed.status).toBe('待样衣验证')
  expect(reviewed.currentNode).toBe('样衣验证')
  expect(reviewed.createdFactoryId).toBe('')
  expect(reviewed.accountStatus).not.toBe('已转正式')
  expect(reviewed.canEnterBusiness).toBe(false)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_4', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  for (const path of ['/fcs/pda/exec', '/fcs/pda/handover', '/fcs/pda/warehouse', '/fcs/pda/settlement']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  }
})

test('平台审核退回后工厂可查看原因并再次提交', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0005"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充地址与机器明细。')
  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="地址"]').check()
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('平台审核退回')

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_5', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('请补充地址与机器明细。')
  await expect(page.locator('[data-pda-onboarding-field="factoryCompanyName"]')).toBeEditable()
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('已提交入驻申请')
  await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
})

test('平台审核未通过不锁定账号且可继续登录补充', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0006"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充地址与机器明细后重新提交。')
  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="地址"]').check()
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('平台审核退回')

  const returned = await page.evaluate(async () => {
    const store = await import('/src/data/fcs/factory-onboarding-store.ts')
    const application = store.getFactoryOnboardingApplicationById('FOA-0006')
    return {
      accountLocked: application?.accountLocked,
      factoryNameLocked: application?.factoryNameLocked,
      factoryCompanyName: application?.factoryCompanyName || '',
    }
  })
  expect(returned.accountLocked).toBe(false)
  expect(returned.factoryNameLocked).toBe(false)

  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_6', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('请补充地址与机器明细后重新提交。')

  await page.goto('/fcs/pda/auth/onboarding')
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(`locked_same_name_${Date.now()}`)
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill(returned.factoryCompanyName)
  await page.locator('[data-pda-onboarding-action="save-draft"]').click()
  await expect(page.locator('body')).not.toContainText('该工厂入驻申请已被拒绝')
})

test('待样衣验证状态只展示等待提示并继续拦截业务页', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, 'onboarding_13', '123456')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待样衣验证')

  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('待样衣验证')
})
