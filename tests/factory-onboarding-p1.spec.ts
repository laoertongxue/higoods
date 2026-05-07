import { expect, test } from '@playwright/test'

const PENDING_LOGIN = { loginId: 'onboarding_4', password: '123456' }
const RETURNED_LOGIN = { loginId: 'onboarding_7', password: '123456' }

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

test('节点耗时展示完整', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, PENDING_LOGIN.loginId, PENDING_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('当前节点')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('已在当前节点耗时')
  await expect(page.locator('[data-testid="pda-onboarding-current-elapsed"]')).not.toHaveText('-')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('当前节点动作次数')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('上次动作')
})

test('平台审核退回后可编辑并重新提交', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, RETURNED_LOGIN.loginId, RETURNED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('平台审核未通过，请根据审核意见补充后再次提交')
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('审核意见')
  await expect(page.locator('[data-testid="pda-onboarding-supplement-card"]')).toContainText('需补充字段')
  await expect(page.locator('[data-pda-onboarding-field="factoryCompanyName"]')).toBeEditable()
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toContainText('重新提交入驻申请')

  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达退回补充工业园 A-02')
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-machine-index="1"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="1"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-action="submit"]').click()

  await expect(page.locator('body')).toContainText('已提交入驻申请')
  await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
  await expect(page.locator('body')).toContainText('工厂重新提交')
})

test('机器关联工序工艺强校验', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  await page.locator('[data-pda-onboarding-field="factoryShortName"]').fill(`p1_machine_${Date.now()}`)
  await page.locator('[data-pda-onboarding-field="applicantName"]').fill('机器校验申请人')
  await page.locator('[data-pda-onboarding-field="identityNo"]').fill('ID-MACHINE-001')
  await page.locator('[data-pda-onboarding-action="use-demo-identity-file"]').click()
  await page.locator('[data-pda-onboarding-field="factoryCompanyName"]').fill('机器校验工厂')
  await page.locator('[data-pda-onboarding-field="mobilePhone"]').fill('+62-812-0000-2011')
  await page.locator('[data-pda-onboarding-field="address"]').fill('机器校验园区 B-11')
  await page.locator('[data-pda-onboarding-field="sourceChannel"]').fill('PPIC 转介绍')
  await page.locator('[data-pda-onboarding-field="ppicName"]').fill('测试 PPIC')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-05-28')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('16')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('3')

  await nativeClick(page, '[data-pda-onboarding-action="select-process"]')
  await nativeClick(page, '[data-pda-onboarding-action="toggle-capability"]')
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('能力联动机')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('1')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })

  await nativeClick(page, '[data-pda-onboarding-action="remove-capability"]')
  await expect(page.locator('[data-testid="pda-onboarding-machine-row-0"]')).toContainText('工序工艺未在接单能力中选择')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺。')
})

test('平台审核未通过统一退回且可补充', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充机器明细与工序工艺能力说明。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('请至少选择一个需补充字段')

  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="机器明细"]').check()
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('平台审核退回')

  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0005"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="未通过"]').check()
  await expect(page.locator('[data-testid="factory-onboarding-required-fields"]')).toHaveCount(1)
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('当前能力与平台合作范围不匹配。')
  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="地址"]').check()
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('平台审核退回')
})

test('平台详情展示流程记录、审核记录与样衣状态', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail')
  await expect(page.locator('[data-testid="factory-onboarding-page"]')).toBeVisible()
  await expect(page.locator('[data-factory-onboarding-dialog="detail"]')).toBeVisible()
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=flow')
  await expect(page.locator('body')).toContainText('节点耗时')
  await expect(page.locator('body')).toContainText('动作次数')
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=review')
  await expect(page.locator('body')).toContainText('第1轮')
  await expect(page.locator('body')).toContainText('审核意见')
  await page.goto('/fcs/factories/onboarding?applicationId=FOA-0013&dialog=detail&tab=sample')
  await expect(page.locator('body')).toContainText('样衣状态')
  await expect(page.locator('body')).toContainText('暂未登记样衣')
})
