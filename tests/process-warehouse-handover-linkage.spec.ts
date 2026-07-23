import { expect, test, type Page } from '@playwright/test'

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function confirmActionDialog(page: Page, actionName: string) {
  await expect(page.getByRole('heading', { name: actionName })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '确认执行' }).click()
}

test('烫画和直喷均使用当前辅助工艺入口与真实加工单', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders/AUX-TASK-PO2026030002-SFER-2ab9e9-03-WO-001-')
  await expect(page.getByRole('heading', { name: '加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('烫画')

  await page.goto('/fcs/process-factory/special-craft/aux-op-direct-print/work-orders/AUX-TASK-PO2026030002-RINT-34bb1b-04-WO-001-')
  await expect(page.getByRole('heading', { name: '加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('直喷')
})

test('印花 Web 完成转印后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-004')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成打印' })).toBeVisible()

  await page.getByRole('button', { name: '完成打印' }).click()
  await confirmActionDialog(page, '完成打印')
  await expect(page.locator('body')).toContainText('待转印')

  await expect(page.getByRole('button', { name: '开始转印' })).toBeVisible()
  await page.getByRole('button', { name: '开始转印' }).click()
  await confirmActionDialog(page, '开始转印')
  await expect(page.locator('body')).toContainText('转印中')

  await expect(page.getByRole('button', { name: '完成转印' })).toBeVisible()
  await page.getByRole('button', { name: '完成转印' }).click()
  await expect(page.getByRole('heading', { name: '完成转印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“完成转印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('完成转印')

  await navigateInApp(page, '/fcs/craft/printing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '印花待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000717')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('3,000 片')
})

test('染色 Web 完成包装后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-005')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()

  for (const actionName of ['完成烘干', '完成定型', '完成打卷']) {
    await expect(page.getByRole('button', { name: actionName })).toBeVisible()
    await page.getByRole('button', { name: actionName }).click()
    await confirmActionDialog(page, actionName)
  }

  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()

  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.getByTestId('process-web-status-action-dialog')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: '完成包装' })).toBeVisible()
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('完成包装')

  await navigateInApp(page, '/fcs/craft/dyeing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '染色待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-DYE-000725')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('米')
  await expect(page.locator('body')).toContainText('卷')
})

test('平台侧仍通过聚合状态展示联动后的风险', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.getByRole('heading', { name: '印花加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
  await expect(page.locator('body')).not.toContainText('转印中：')

  await page.goto('/fcs/process/dye-orders')
  await expect(page.getByRole('heading', { name: '染色加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
})
