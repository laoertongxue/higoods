import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120_000)

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-29 10:00:00',
}

async function setPdaSession(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function openSpecialCraftDetail(page: Page, slug: string, workOrderId: string) {
  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders/${workOrderId}`)
  await expect(page.getByRole('heading', { name: '工艺单详情' })).toBeVisible({ timeout: 30_000 })
}

function actionDialog(page: Page) {
  return page.getByTestId('process-web-status-action-dialog')
}

test('特殊工艺详情结构对齐后道单，Tab 和基本信息完整', async ({ page }) => {
  await openSpecialCraftDetail(page, 'sc-op-008', 'SC-TASK-SC-OP-008-01-WO-001-')

  for (const tab of ['基本信息', '接收记录', '加工记录', '菲票记录', '差异记录', '交出记录', '操作记录']) {
    await expect(page.getByRole('button', { name: tab })).toBeVisible()
  }
  await expect(page.locator('body')).toContainText('工艺单号')
  await expect(page.locator('body')).toContainText('特殊工艺')
  await expect(page.locator('body')).toContainText('全能力测试工厂（F090）')
  await expect(page.locator('body')).toContainText('当前裁片数量')
  await expect(page.locator('body')).toContainText('绑定菲票数量')
  await expect(page.getByTestId('web-status-action-area')).toBeVisible()
})

test('特殊工艺 Web 操作必须先弹窗，确认后生成 Web 端操作记录', async ({ page }) => {
  await openSpecialCraftDetail(page, 'sc-op-008', 'SC-TASK-SC-OP-008-01-WO-001-')
  await page.getByRole('button', { name: '确认接收裁片' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('process-web-status-action-title')).toHaveText('确认接收裁片')
  await expect(page.locator('[data-process-web-status-action-field="接收人"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="接收时间"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="接收裁片数量"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="关联菲票"]')).toBeVisible()

  await page.getByTestId('process-web-status-action-confirm').click()
  await expect(actionDialog(page)).toHaveCount(0)
  await expect(page.locator('body')).toContainText('已入待加工仓')
  await page.getByRole('button', { name: '操作记录' }).click()
  await expect(page.locator('[data-testid="operation-record-row"]').first()).toContainText('Web 端')
  await expect(page.locator('body')).not.toContainText('Web 端操作记录')
})

test('特殊工艺移动端操作走统一写回，Web 详情合并展示移动端记录', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec/TASK-SC-OP-032-0201')
  await expect(page.locator('body')).toContainText('特殊工艺')
  await expect(page.locator('body')).toContainText('工艺单号')
  await expect(page.locator('body')).toContainText('当前裁片数量')
  await expect(page.getByRole('button', { name: '开始加工' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '开始加工' }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺开始加工已同步|加工中/)

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-032/work-orders/SC-TASK-SC-OP-032-01-WO-001-?tab=events')
  await expect(page.getByRole('heading', { name: '工艺单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('[data-testid="operation-record-row"]').first()).toContainText('移动端')
})

test('特殊工艺完成加工生成待交出仓，发起交出生成交出记录', async ({ page }) => {
  await openSpecialCraftDetail(page, 'sc-op-064', 'SC-TASK-SC-OP-064-01-WO-001-')
  await page.getByRole('button', { name: '完成加工' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-process-web-status-action-field="加工完成裁片数量"]')).toBeVisible()
  await page.getByTestId('process-web-status-action-confirm').click()
  await expect(page.locator('body')).toContainText('待交出')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-064/work-orders/SC-TASK-SC-OP-064-01-WO-001-?tab=handover')
  await expect(page.locator('body')).toContainText('待交出仓记录')
  await expect(page.locator('body')).toContainText('待交出裁片数量')

  await page.getByRole('button', { name: '发起交出' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-process-web-status-action-field="交出裁片数量"]')).toBeVisible()
  await page.getByTestId('process-web-status-action-confirm').click()
  await expect(page.locator('body')).toContainText(/交出记录号|已交出/)
})

test('特殊工艺上报差异持续关联菲票并同步平台异常结果', async ({ page }) => {
  await openSpecialCraftDetail(page, 'sc-op-064', 'SC-TASK-SC-OP-064-01-WO-001-')
  await page.getByRole('button', { name: '上报差异' }).click()
  await expect(actionDialog(page)).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-process-web-status-action-field="差异裁片数量"]')).toBeVisible()
  await expect(page.locator('[data-process-web-status-action-field="关联菲票"]')).toBeVisible()
  await page.getByTestId('process-web-status-action-confirm').click()
  await expect(page.locator('body')).toContainText('差异')

  await page.getByRole('button', { name: '差异记录' }).click()
  await expect(page.locator('body')).toContainText('关联菲票')
  await expect(page.locator('body')).toContainText(/累计报废裁片数量|累计货损裁片数量|差异裁片数量/)

  await navigateInApp(page, '/fcs/progress/board')
  await expect(page.locator('body')).toContainText(/特殊工艺|激光切/, { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/异常|差异记录/)
})

test('特殊工艺页面、移动端和统计不出现后道错误动作，统计保持裁片与菲票口径', async ({ page }) => {
  for (const path of [
    '/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-01-WO-001-',
    '/fcs/process-factory/special-craft/sc-op-008/task-orders',
    '/fcs/process-factory/special-craft/sc-op-008/warehouse',
    '/fcs/pda/exec/TASK-SC-OP-008-0101',
  ]) {
    await page.goto(path)
    await expect(page.locator('body')).not.toContainText('开扣眼')
    await expect(page.locator('body')).not.toContainText('装扣子')
    await expect(page.locator('body')).not.toContainText('熨烫')
    await expect(page.locator('body')).not.toContainText('包装')
  }

  await page.goto('/fcs/process-factory/special-craft/sc-op-008/statistics')
  await expect(page.getByRole('heading', { name: '打揽统计' })).toBeVisible()
  await expect(page.locator('body')).toContainText('裁片数量')
  await expect(page.locator('body')).toContainText('菲票数量')
  await expect(page.locator('body')).toContainText('差异裁片数量')
  await expect(page.locator('body')).not.toContainText('数量：')
})
