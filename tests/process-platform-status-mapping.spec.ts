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

test('平台侧印花加工单展示平台聚合状态和辅助细状态', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.getByRole('heading', { name: '印花加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('工厂内部状态')
  await expect(page.locator('body')).toContainText('风险提示')
  await expect(page.locator('body')).toContainText('下一步动作')
  await expect(page.locator('body')).toContainText(/准备中|加工中|待送货|待回写|待审核|异常|已完成/)
})

test('平台侧染色加工单展示平台聚合状态和辅助细状态', async ({ page }) => {
  await page.goto('/fcs/process/dye-orders')
  await expect(page.getByRole('heading', { name: '染色加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('工厂内部状态')
  await expect(page.locator('body')).toContainText('风险提示')
  await expect(page.locator('body')).toContainText('下一步动作')
  await expect(page.locator('body')).toContainText(/准备中|加工中|待送货|待回写|待审核|异常|已完成/)
})

test('工艺工厂运营系统保留印花和染色细状态', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  await expect(page.getByRole('heading', { name: '印花加工单', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(/待花型|等打印|打印中|转印中|待回写|待审核/)

  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(/待样衣|待原料|打样中|待排缸|染色中|脱水中|烘干中|定型中|打卷中|包装中/)
})

test('任务进度看板使用平台状态并保留内部执行状态', async ({ page }) => {
  await page.goto('/fcs/progress/board')
  await expect(page.getByText('任务进度看板').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('平台状态').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('工厂内部状态').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('下一步动作').first()).toBeVisible({ timeout: 30_000 })
})

test('移动端执行列表保留现场执行状态分类', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec')
  await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await expect(page.locator('body')).toContainText('待开工')
  await expect(page.locator('body')).toContainText('进行中')
  await expect(page.locator('body')).toContainText('已完工')
  await expect(page.locator('body')).toContainText('全能力测试工厂（F090）')
})
