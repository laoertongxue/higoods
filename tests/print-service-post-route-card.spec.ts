import { expect, test, type Page } from '@playwright/test'
import { getPostFinishingFlowText } from '../src/data/fcs/post-finishing-current-read-model.ts'

async function currentPostId(page: Page): Promise<string> {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  return page.evaluate(async () => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const task = flow.listPostFinishingFullFlowPostTasks()[0]
    if (!task) throw new Error('缺少当前后道加工单样例')
    return task.postTaskId
  })
}

test('后道加工单列表进入专用打印预览并隐藏 Web 系统壳', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await page.getByText('打印加工单', { exact: true }).first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/post-finishing\/print\?type=POST_ORDER/)
  await expect(page.locator('[data-testid="post-finishing-full-flow-print"]')).toBeVisible()
  await expect(page.getByText('后道加工单流转卡').first()).toBeVisible()
  await expect(page.getByText(/HD-/).first()).toBeVisible()
  await expect(page.getByText(/PO-QC-202608-/).first()).toBeVisible()

  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
  await expect(page.getByText('采购管理系统')).toHaveCount(0)
  await expect(page.getByText('工厂生产协同')).toHaveCount(0)
})

test('专门后道工厂完整流程打印单包含正式单据区域', async ({ page }) => {
  const id = await currentPostId(page)
  await page.goto(`/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=${encodeURIComponent(id)}`)

  await expect(page.getByText('后道加工单流转卡').first()).toBeVisible()
  await expect(page.getByText('QC → 后道加工 → 处理后交出复核 → 成衣仓交接').first()).toBeVisible()
  for (const label of ['扫码收货区', '质检区', '后道处理区', '处理后交出复核区', '交出区', '差异记录区', '签字区', '二维码区']) {
    await expect(page.getByText(label).first()).toBeVisible()
  }
  for (const label of ['计划成衣件数', '待质检成衣件数', '复核确认成衣件数', '待交出成衣件数', '差异成衣件数']) {
    await expect(page.getByText(label).first()).toBeVisible()
  }
  await expect(page.getByText('系统占位图')).toHaveCount(0)
})

test('车缝厂已做后道时流程规则跳过后道节点', () => {
  expect(getPostFinishingFlowText({ requiresPostFinishing: false })).toBe('QC → 成衣仓交接')
})

test('独立后道加工单在打印链路中展示实际工序节点', () => {
  expect(getPostFinishingFlowText({ requiresPostFinishing: true })).toBe('QC → 后道加工 → 处理后交出复核 → 成衣仓交接')
})

test('商品图片区、二维码区和打印按钮符合打印预览要求', async ({ page }) => {
  const id = await currentPostId(page)
  await page.goto(`/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=${encodeURIComponent(id)}`)

  await expect(page.locator('.print-image-box')).toBeVisible()
  await expect(page.getByText('系统占位图')).toHaveCount(0)
  const qrBox = page.locator('.print-qr-box .print-qr-inner')
  await expect(qrBox).toBeVisible()
  const qrBounds = await qrBox.boundingBox()
  expect(qrBounds?.width || 0).toBeLessThan(180)
  expect(qrBounds?.height || 0).toBeLessThan(180)
  await expect(page.getByText('扫码进入工厂端后道加工单详情').first()).toBeVisible()

  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })
  await page.getByRole('button', { name: '打印' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true)
})

test('旧任务流转卡路由兼容后道新模板', async ({ page }) => {
  const id = await currentPostId(page)
  await page.goto(`/fcs/print/task-route-card?sourceType=POST_FINISHING_WORK_ORDER&sourceId=${encodeURIComponent(id)}`)

  await expect(page).toHaveURL(/\/fcs\/print\/task-route-card/)
  await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
  await expect(page.getByText('后道加工单流转卡').first()).toBeVisible()
  await expect(page.getByText('QC → 后道加工 → 处理后交出复核 → 成衣仓交接').first()).toBeVisible()
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
})
