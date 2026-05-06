import { expect, test } from '@playwright/test'

const PENDING_LOGIN = { loginId: 'onboarding_4', password: '123456' }
const RETURNED_LOGIN = { loginId: 'onboarding_7', password: '123456' }
const REJECTED_LOGIN = { loginId: 'onboarding_16', password: '123456' }

async function clearAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('fcs_pda_session')
    window.localStorage.removeItem('fcs_factory_onboarding_session_v1')
  })
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
  await expect(page.locator('[data-testid="pda-onboarding-flow"]')).toBeVisible()
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('当前节点')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('已在当前节点耗时')
  await expect(page.locator('[data-testid="pda-onboarding-current-elapsed"]')).not.toHaveText('-')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('当前节点动作次数')
  await expect(page.locator('[data-testid="pda-onboarding-current-card"]')).toContainText('上次动作')
})

test('退回补充资料后可编辑并重新提交', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, RETURNED_LOGIN.loginId, RETURNED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('平台已退回资料，请按审核意见补充后重新提交')
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('审核意见')
  await expect(page.locator('[data-testid="pda-onboarding-supplement-card"]')).toContainText('需补充字段')
  await expect(page.locator('[data-pda-onboarding-field="factoryName"]')).toBeEditable()
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toContainText('重新提交入驻申请')

  await page.locator('[data-pda-onboarding-field="address"]').fill('雅加达退回补充工业园 A-02')
  await page.locator('[data-pda-onboarding-machine-index="1"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-machine-index="1"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })
  await page.locator('[data-pda-onboarding-action="submit"]').click()

  await expect(page.locator('body')).toContainText('已重新提交待审核')
  await expect(page.locator('[data-testid="pda-onboarding-current-node"]')).toContainText('平台审核')
  await expect(page.locator('body')).toContainText('工厂重新提交')
})

test('已拒绝状态只读且不能进入业务页', async ({ page }) => {
  await page.goto('/fcs/pda/auth/login')
  await fillLogin(page, REJECTED_LOGIN.loginId, REJECTED_LOGIN.password)
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('入驻申请未通过，当前不可再次提交')
  await expect(page.locator('[data-testid="pda-onboarding-review-card"]')).toContainText('审核意见')
  await expect(page.locator('[data-pda-onboarding-field="factoryName"]')).toBeDisabled()
  await expect(page.locator('[data-pda-onboarding-action="submit"]')).toHaveCount(0)

  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/auth\/onboarding/)
  await expect(page.locator('body')).toContainText('已拒绝')
})

test('机器关联工序工艺强校验', async ({ page }) => {
  await clearAuth(page)
  await page.goto('/fcs/pda/auth/onboarding')
  const loginId = `p1_machine_${Date.now()}`
  await page.locator('[data-pda-onboarding-field="admin-loginId"]').fill(loginId)
  await page.locator('[data-pda-onboarding-field="admin-password"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="confirmPassword"]').fill('123456')
  await page.locator('[data-pda-onboarding-field="admin-adminName"]').fill('机器校验管理员')
  await page.locator('[data-pda-onboarding-field="admin-whatsapp"]').fill('+62-812-0000-2011')
  await page.locator('[data-pda-onboarding-field="factoryName"]').fill('机器校验工厂')
  await page.locator('[data-pda-onboarding-field="bossName"]').fill('老板机')
  await page.locator('[data-pda-onboarding-field="whatsapp"]').fill('+62-812-0000-2011')
  await page.locator('[data-pda-onboarding-field="address"]').fill('机器校验园区 B-11')
  await page.locator('[data-pda-onboarding-field="availableStartDate"]').fill('2026-05-28')
  await page.locator('[data-pda-onboarding-field="effectiveWorkerCount"]').fill('16')
  await page.locator('[data-pda-onboarding-field="machineTotalCount"]').fill('3')

  await page.locator('[data-pda-onboarding-action="select-process"]').first().click()
  await page.locator('[data-pda-onboarding-action="toggle-capability"]').first().click()
  await page.locator('[data-pda-onboarding-action="add-machine"]').click()
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineName"]').fill('能力联动机')
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="machineCount"]').fill('1')

  await expect(page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"] option')).toHaveCount(2)
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedProcessCode"]').selectOption({ index: 1 })
  await expect(page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"] option')).toHaveCount(2)
  await page.locator('[data-pda-onboarding-machine-index="0"][data-pda-onboarding-machine-field="linkedCraftCode"]').selectOption({ index: 1 })

  await page.locator('[data-pda-onboarding-action="remove-capability"]').first().click()
  await expect(page.locator('[data-testid="pda-onboarding-machine-row-0"]')).toContainText('工序工艺未在接单能力中选择')
  await page.locator('[data-pda-onboarding-action="submit"]').click()
  await expect(page.locator('body')).toContainText('该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺')
})

test('平台审核退回必须选择需补充字段，并写入补充记录', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0004"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="不通过且允许再次提交"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('请补充机器明细与工序工艺能力说明。')
  await page.waitForTimeout(200)
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('请至少选择一个需补充字段')

  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="机器明细"]').check()
  await page.locator('[data-factory-onboarding-field="reviewRequiredField"][value="工序工艺能力"]').check()
  await page.waitForTimeout(200)
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('审核结果已保存')
  await expect(page.locator('body')).toContainText('退回补充资料')

  await nativeClick(page, '[data-factory-onboarding-action="view-detail"][data-application-id="FOA-0004"]')
  await nativeClick(page, '[data-factory-onboarding-action="switch-detail-tab"][data-tab="supplement"]')
  await expect(page.locator('body')).toContainText('机器明细')
  await expect(page.locator('body')).toContainText('工序工艺能力')
  await nativeClick(page, '[data-factory-onboarding-action="close-detail"]')
})

test('平台审核拒绝时不显示需补充字段', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0005"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="不通过且不允许再次提交"]').check()
  await expect(page.locator('[data-testid="factory-onboarding-required-fields"]')).toHaveCount(0)
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('当前能力与平台合作范围不匹配。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('已拒绝')
})

test('平台审核通过后进入待确认合作', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="open-review"][data-application-id="FOA-0006"]')
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').waitFor({ state: 'visible' })
  await page.locator('[data-factory-onboarding-field="reviewResult"][value="通过"]').check()
  await page.locator('[data-factory-onboarding-field="reviewOpinion"]').fill('资料完整，同意进入合作确认。')
  await nativeClick(page, '[data-factory-onboarding-action="submit-review"]')
  await expect(page.locator('body')).toContainText('审核通过待确认合作')
  await nativeClick(page, '[data-factory-onboarding-action="view-detail"][data-application-id="FOA-0006"]')
  await expect(page.locator('body')).toContainText('当前节点：确认合作')
})

test('平台详情展示流程记录、审核记录与补充记录', async ({ page }) => {
  await page.goto('/fcs/factories/onboarding')
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="factory-onboarding-table"]')).toBeVisible()
  await nativeClick(page, '[data-factory-onboarding-action="view-detail"][data-application-id="FOA-0010"]')
  await page.locator('[data-factory-onboarding-action="switch-detail-tab"][data-tab="flow"]').waitFor({ state: 'visible' })
  await nativeClick(page, '[data-factory-onboarding-action="switch-detail-tab"][data-tab="flow"]')
  await expect(page.locator('body')).toContainText('节点耗时')
  await expect(page.locator('body')).toContainText('动作次数')
  await nativeClick(page, '[data-factory-onboarding-action="switch-detail-tab"][data-tab="review"]')
  await expect(page.locator('body')).toContainText('第1轮')
  await expect(page.locator('body')).toContainText('审核意见')
  await nativeClick(page, '[data-factory-onboarding-action="switch-detail-tab"][data-tab="supplement"]')
  await expect(page.locator('body')).toContainText('需补充字段')
  await expect(page.locator('body')).toContainText('已重新提交')
})
