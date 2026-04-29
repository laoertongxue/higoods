import { expect, test } from '@playwright/test'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-28 10:00:00',
}

async function setPdaSession(page: import('@playwright/test').Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

test('印花 Web 操作后移动端动作写回同一前端事实源', async ({ page }) => {
  await setPdaSession(page)

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-011')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始打印' })).toBeVisible()

  await page.getByRole('button', { name: '开始打印' }).click()
  await expect(page.getByRole('heading', { name: '开始打印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“开始打印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('打印中')
  await expect(page.locator('body')).toContainText('开始打印')
  await expect(page.locator('body')).toContainText('Web 端')
  await expect(page.locator('body')).toContainText('平台聚合状态：加工中')

  await page.getByRole('button', { name: '打开移动端执行页' }).click()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000722')
  await expect(page.getByRole('button', { name: '完成打印' })).toBeVisible()

  const dialogAnswers = ['900', '0']
  page.on('dialog', async (dialog) => {
    await dialog.accept(dialogAnswers.shift() || '')
  })
  await page.getByRole('button', { name: '完成打印' }).click()
  await expect(page.locator('body')).toContainText('打印完成已记录')

  await page.goBack()
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('完成打印')
  await expect(page.locator('body')).toContainText('移动端')
  await expect(page.locator('body')).toContainText('Web 端')
})

test('非法动作不写回，平台仍显示聚合状态而不是工厂细状态', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-001')
  await expect(page.locator('body')).toContainText('待花型')
  await expect(page.getByRole('button', { name: '确认花型到位' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成转印' })).toHaveCount(0)

  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/准备中|加工中|待送货|待回写|待审核|异常|已完成/)
})
