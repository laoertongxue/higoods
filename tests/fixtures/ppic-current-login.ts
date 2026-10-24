import type { Page } from '@playwright/test'

/** 隔离浏览器的登录上下文夹具；产品没有身份切换入口。 */
export async function setPpicTestLogin(page: Page, id: string): Promise<void> {
  const user = await page.evaluate(async id => {
    const login = await import('/src/data/fcs/factory-onboarding-ppic.ts')
    const user = login.getOnboardingPpicOptionById(id)
    if (!user) throw new Error('测试登录账号不存在')
    return user
  }, id)
  const pattern = '**/src/data/fcs/factory-onboarding-ppic.ts*'
  await page.unroute(pattern)
  await page.route(pattern, async route => {
    const response = await route.fetch()
    const body = await response.text()
    const declaration = /^export const SEWING_OUTSOURCING_DEMO_CURRENT_PPIC = .*;$/m
    if (!declaration.test(body)) throw new Error('未找到现有登录上下文，拒绝使用错位夹具')
    await route.fulfill({ response, body: body.replace(declaration, 'export const SEWING_OUTSOURCING_DEMO_CURRENT_PPIC = ' + JSON.stringify(user) + ';') })
  })
  await page.reload()
  await page.waitForSelector('[data-ppic-daily-page]')
}
