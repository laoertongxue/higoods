import { expect, test, type Page } from '@playwright/test'

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('平台侧印花可看到统一交出回写结果', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('main')).toContainText('印花加工单')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('工厂内部状态')
  await expect(page.locator('body')).toContainText('风险提示')
  await expect(page.locator('body')).toContainText('下一步动作')
  await expect(page.locator('body')).toContainText('当前责任方')
  await expect(page.locator('body')).toContainText('待回写')
  await expect(page.locator('body')).toContainText('跟进接收方回写')
  await expect(page.locator('body')).toContainText('待交出仓')
  await expect(page.locator('body')).toContainText(/待交出裁片数量|待交出面料米数/)
  await expect(page.locator('body')).not.toContainText('平台状态：转印中')
})

test('平台侧印花异常可追溯差异记录和处理动作', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('main')).toContainText('印花加工单')
  await expect(page.locator('body')).toContainText('异常')
  await expect(page.locator('body')).toContainText('差异记录')
  await expect(page.locator('body')).toContainText(/处理差异|要求重新交出/)
  await expect(page.locator('body')).toContainText(/差异裁片数量|差异面料米数/)
})

test('平台侧染色可看到包装后的待交出结果且不显示染色报表', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-013')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()
  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.getByTestId('process-web-status-action-dialog')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '确认执行' }).click()

  await navigateInApp(page, '/fcs/process/dye-orders')
  await expect(page.locator('main')).toContainText('染色加工单')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('工厂内部状态')
  await expect(page.locator('body')).toContainText('风险提示')
  await expect(page.locator('body')).toContainText('下一步动作')
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('跟进工厂交出')
  await expect(page.locator('body')).toContainText('待交出面料米数')
  await expect(page.locator('body')).toContainText('卷数')
  await expect(page.locator('body')).not.toContainText('染色报表')
  await expect(page.locator('body')).not.toContainText('平台状态：包装中')
})

test('任务进度看板读取平台结果视图展示裁片和特殊工艺结果', async ({ page }) => {
  await page.goto('/fcs/progress/board')
  await expect(page.locator('body')).toContainText('任务进度看板', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('平台状态', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('工厂内部状态', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('同步结果', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/待交出仓|交出记录|审核记录|差异记录/)
  await expect(page.locator('body')).toContainText(/裁片数量|面料米数|菲票数量|绑定菲票数量|关联菲票数量/)
  await expect(page.locator('body')).not.toContainText('合并裁剪批次作为菲票归属主体')
  await expect(page.locator('body')).not.toContainText('开扣眼')
  await expect(page.locator('body')).not.toContainText('装扣子')
  await expect(page.locator('body')).not.toContainText('熨烫')
})

test('平台侧跟单动作按状态区分展示', async ({ page }) => {
  await page.goto('/fcs/process/dye-orders')
  await expect(page.locator('main')).toContainText('染色加工单')
  await expect(page.locator('body')).toContainText('跟进工厂交出')

  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('main')).toContainText('印花加工单')
  await expect(page.locator('body')).toContainText('跟进接收方回写')
  await expect(page.locator('body')).toContainText(/处理差异|要求重新交出/)
  await expect(page.locator('body')).toContainText(/查看详情|查看交出记录/)

  await page.goto('/fcs/progress/board')
  await expect(page.locator('body')).toContainText('任务进度看板', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('下一步动作', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/查看交接记录|归档或查看记录|平台核对菲票/)
})
