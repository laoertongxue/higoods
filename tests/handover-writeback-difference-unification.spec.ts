import { expect, test } from '@playwright/test'

import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

test('印花交出回写与差异处理读取统一记录', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007?tab=handover')
  await expect(page.getByRole('heading', { name: '送货交出' })).toBeVisible()
  await expect(page.getByText('交出面料米数').first()).toBeVisible()
  await expect(page.getByText('实收面料米数').first()).toBeVisible()

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007?tab=review')
  await expect(page.getByRole('heading', { name: '审核记录' })).toBeVisible()
  await expect(page.getByText('数量差异').first()).toBeVisible()

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007?tab=exception')
  await expect(page.getByRole('heading', { name: '交出差异处理' })).toBeVisible()
  await expect(page.getByText('差异面料米数').first()).toBeVisible()
  await page.getByRole('button', { name: '要求重新交出' }).first().click()
  await expect(page.getByText('需重新交出').first()).toBeVisible()
})

test('染色统计和染色差异处理统一使用交出记录', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-010?tab=handover')
  await expect(page.getByRole('heading', { name: '送货交出' })).toBeVisible()
  await expect(page.getByText('交出面料米数').first()).toBeVisible()

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-010?tab=statistics')
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)
  await expect(page.getByText('有差异交出记录数').first()).toBeVisible()

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-010?tab=exception')
  await expect(page.getByRole('heading', { name: '染色交出差异处理' })).toBeVisible()
  await expect(page.getByText('差异面料米数').first()).toBeVisible()
  await page.getByRole('button', { name: '标记平台处理中' }).first().click()
  await expect(page.getByText('处理中').first()).toBeVisible()
})

test('特殊工艺仓库、交出与操作记录统一追溯具体加工单', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.targetObject === '已裁部位' && item.status === '加工中')
  if (!order) throw new Error('缺少加工中裁片特殊工艺加工单')
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  const detailPath = `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`

  await page.goto(`${detailPath}?tab=warehouse`)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/work-orders/${encodeURIComponent(order.taskOrderId)}\\?tab=warehouse`))
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
  await expect(page.getByRole('heading', { name: '菲票流转', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '仓库记录' })).toBeVisible()
  await expect(page.locator('#app')).toContainText('交出记录')

  await page.goto(`${detailPath}?tab=events`)
  await expect(page.getByRole('heading', { name: '操作记录' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/work-orders/${encodeURIComponent(order.taskOrderId)}\\?tab=events`))
  await expect(page.locator('#app')).toContainText(order.taskOrderNo)
})

test('后道交出仓只承接复检完成并统一统计交出差异', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('只承接复检完成后的后道工厂待交出记录。')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '统一交出记录' })).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('烫包')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/statistics')
  await expect(page.getByRole('heading', { name: '后道统计' })).toBeVisible()
  await expect(page.getByText('交出成衣件数').first()).toBeVisible()
  await expect(page.getByText('实收成衣件数').first()).toBeVisible()
  await expect(page.getByText('差异成衣件数').first()).toBeVisible()
})
