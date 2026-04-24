import { expect, test } from '@playwright/test'

test('印花统计读取统一执行、仓和交出数据', async ({ page }) => {
  await page.goto('/fcs/craft/printing/statistics')
  await expect(page.getByRole('heading', { name: '印花统计' })).toBeVisible()
  await expect(page.getByText('计划印花面料米数').first()).toBeVisible()
  await expect(page.getByText('打印完成面料米数').first()).toBeVisible()
  await expect(page.getByText('转印完成面料米数').first()).toBeVisible()
  await expect(page.getByText('差异面料米数').first()).toBeVisible()
  await expect(page.getByText('印花待回写交出记录数').first()).toBeVisible()
  await expect(page.getByText('印花有差异交出记录数').first()).toBeVisible()

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007?tab=handover')
  await expect(page.getByRole('heading', { name: '送货交出' })).toBeVisible()
  await expect(page.getByText('交出面料米数').first()).toBeVisible()
})

test('印花大屏读取印花统计派生数据', async ({ page }) => {
  await page.goto('/fcs/craft/printing/dashboards')
  await expect(page.locator('h1').filter({ hasText: '印花大屏' })).toBeVisible()
  await expect(page.getByText('今日待打印面料米数').first()).toBeVisible()
  await expect(page.getByText('今日打印完成面料米数').first()).toBeVisible()
  await expect(page.getByText('按状态维度的印花加工单分布')).toBeVisible()
  await expect(page.getByText('按工厂维度的印花执行进度')).toBeVisible()
})

test('染色统计和详情统计 Tab 使用同源统计口径', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/reports')
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)
  await expect(page.getByText('计划染色面料米数').first()).toBeVisible()
  await expect(page.getByText('染色完成面料米数').first()).toBeVisible()
  await expect(page.getByText('包装完成面料米数').first()).toBeVisible()
  await expect(page.getByText('差异面料米数').first()).toBeVisible()

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-010?tab=statistics')
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)
  await expect(page.getByText('包装完成面料米数').first()).toBeVisible()
})

test('特殊工艺统计读取菲票、裁片数量和差异记录', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/statistics')
  await expect(page.getByRole('heading', { name: /统计/ })).toBeVisible()
  await expect(page.getByText('待加工裁片数量').first()).toBeVisible()
  await expect(page.getByText('加工完成裁片数量').first()).toBeVisible()
  await expect(page.getByText('当前裁片数量').first()).toBeVisible()
  await expect(page.getByText('累计报废裁片数量').first()).toBeVisible()
  await expect(page.getByText('累计货损裁片数量').first()).toBeVisible()
  await expect(page.getByText('关联菲票数量').first()).toBeVisible()

  const detailPath = '/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-02-WO-001-'
  await page.goto(`${detailPath}?tab=fei`)
  await expect(page.getByRole('heading', { name: '绑定菲票' })).toBeVisible()
  await expect(page.getByText('当前裁片数量').first()).toBeVisible()
  await page.goto(`${detailPath}?tab=difference`)
  await expect(page.getByRole('heading', { name: '差异上报' })).toBeVisible()
  await expect(page.getByText('差异裁片数量').first()).toBeVisible()
})

test('后道统计读取后道、质检、复检、交出和差异记录', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/statistics')
  await expect(page.getByRole('heading', { name: '后道统计' })).toBeVisible()
  await expect(page.getByText('待后道成衣件数').first()).toBeVisible()
  await expect(page.getByText('质检通过成衣件数').first()).toBeVisible()
  await expect(page.getByText('复检确认成衣件数').first()).toBeVisible()
  await expect(page.getByText('已交出成衣件数').first()).toBeVisible()
  await expect(page.getByText('差异成衣件数').first()).toBeVisible()
  await expect(page.getByText('专门后道工厂任务数').first()).toBeVisible()
  await expect(page.getByText('非专门工厂转入后道工厂待质检成衣件数').first()).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('熨烫')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('待交出成衣件数').first()).toBeVisible()
  await expect(page.getByText('已交出成衣件数').first()).toBeVisible()
})
