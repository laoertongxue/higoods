import { expect, test, type Page } from '@playwright/test'

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('印花 Web 完成转印后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-009')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成转印' })).toBeVisible()

  await page.getByRole('button', { name: '完成转印' }).click()
  await expect(page.getByRole('heading', { name: '完成转印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“完成转印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('Web 端操作记录')
  await expect(page.locator('body')).toContainText('完成转印')

  await navigateInApp(page, '/fcs/craft/printing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '印花待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(/待交出裁片数量|待交出面料米数/)
})

test('染色 Web 完成包装后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-013')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()

  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('完成包装')

  await navigateInApp(page, '/fcs/craft/dyeing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '染色待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-DYE-000733')
  await expect(page.locator('body')).toContainText('待交出面料米数')
  await expect(page.locator('body')).toContainText('卷')
})

test('特殊工艺确认接收和完成加工分别进入待加工仓与待交出仓', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-01-WO-001-')
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '确认接收裁片' })).toBeVisible()

  await page.getByRole('button', { name: '确认接收裁片' }).click()
  await expect(page.locator('body')).toContainText('已入待加工仓')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-008/wait-process-warehouse')
  await expect(page.getByRole('heading', { name: '打揽待加工仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TG-OP-008-01-部位01')
  await expect(page.locator('body')).toContainText('关联菲票数量')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-064/work-orders/SC-TASK-SC-OP-064-01-WO-001-')
  await expect(page.getByRole('button', { name: '完成加工' })).toBeVisible()
  await page.getByRole('button', { name: '完成加工' }).click()
  await expect(page.locator('body')).toContainText('待交出')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-064/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '激光切待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TG-OP-064-01-部位01')
  await expect(page.locator('body')).toContainText('待交出裁片数量')
})

test('特殊工艺差异记录保留菲票与裁片数量口径', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-02-WO-001-')
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '上报差异' })).toBeVisible()

  await page.getByRole('button', { name: '上报差异' }).click()
  await expect(page.locator('body')).toContainText('差异')
  await expect(page.locator('body')).toContainText('差异裁片数量')
  await expect(page.locator('body')).toContainText('绑定菲票')
  await expect(page.locator('body')).not.toContainText('开扣眼')
  await expect(page.locator('body')).not.toContainText('装扣子')
  await expect(page.locator('body')).not.toContainText('熨烫')
})

test('平台侧仍通过聚合状态展示联动后的风险', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.getByRole('heading', { name: '印花加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待送货|待回写|待审核|异常|加工中/)
  await expect(page.locator('body')).not.toContainText('转印中：')

  await page.goto('/fcs/process/dye-orders')
  await expect(page.getByRole('heading', { name: '染色加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待送货|待回写|待审核|异常|加工中/)
})
