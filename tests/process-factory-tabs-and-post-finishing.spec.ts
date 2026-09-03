import { expect, test } from '@playwright/test'

import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

test('印花加工单列表移除冗余切换并进入详情 Tab', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  await expect(page.getByRole('heading', { name: '印花加工单', exact: true })).toBeVisible()
  await expect(page.getByText('加工单列表')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '审核记录' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '执行进度' })).toHaveCount(0)
  await expect(page.getByText('印花加工单表格')).toBeVisible()

  await page.locator('a[role="button"][data-nav^="/fcs/craft/printing/work-orders/"]').first().click({ position: { x: 8, y: 8 } })
  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders\/.+/)
  await page.getByRole('button', { name: '花型与调色' }).click()
  await expect(page).toHaveURL(/tab=pattern/)
  await expect(page.getByRole('heading', { name: '花型与调色' })).toBeVisible()
  await page.getByRole('button', { name: '审核记录' }).click()
  await expect(page).toHaveURL(/tab=review/)
  await expect(page.getByRole('heading', { name: '审核记录' })).toBeVisible()
  await page.getByRole('button', { name: '执行进度' }).click()
  await expect(page).toHaveURL(/tab=progress/)
  await expect(page.getByRole('heading', { name: '执行进度' })).toBeVisible()
})

test('染色加工单列表移除冗余切换并进入详情 Tab', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单', exact: true })).toBeVisible()
  await expect(page.getByText('加工单列表')).toHaveCount(0)
  await expect(page.getByText('染色报表')).toHaveCount(0)
  await expect(page.getByText('染色加工单表格')).toBeVisible()

  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders\/.+/)
  await page.getByRole('button', { name: '染色配方' }).click()
  await expect(page).toHaveURL(/tab=formula/)
  await expect(page.getByRole('heading', { name: '染色配方' })).toBeVisible()
  await page.getByRole('button', { name: '染色统计' }).click()
  await expect(page).toHaveURL(/tab=statistics/)
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)
})

test('特殊工艺加工单列表与详情 Tab 收口', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.status === '加工中')
  if (!order) throw new Error('缺少可执行特殊工艺加工单')
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  const detailPath = `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`

  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders`)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单` })).toBeVisible()
  await expect(page.getByText('当前特殊工艺')).toHaveCount(0)
  await expect(page.getByText(/任务单.*待加工仓.*待交出仓.*统计/)).toHaveCount(0)

  await page.goto(detailPath)
  await expect(page.getByRole('heading', { name: `${order.operationName}加工单详情` })).toBeVisible()
  await page.getByRole('button', { name: '加工明细' }).click()
  await expect(page).toHaveURL(/tab=demand/)
  await expect(page.getByRole('heading', { name: '加工明细' })).toBeVisible()
  await page.getByRole('button', { name: '仓库流转' }).click()
  await expect(page).toHaveURL(/tab=warehouse/)
  await expect(page.getByRole('heading', { name: '仓库记录' })).toBeVisible()
  await page.getByRole('button', { name: '操作记录' }).click()
  await expect(page).toHaveURL(/tab=events/)
  await expect(page.getByRole('heading', { name: '操作记录' })).toBeVisible()
})

test('后道工厂菜单页面可访问且数据串联', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.getByRole('heading', { name: '后道加工单', exact: true })).toBeVisible()
  for (const column of ['单据', '工厂', 'SKU 明细', '后道项目', '后道状态']) {
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: '开始后道' }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PDA 执行（优先）')

  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await expect(page.getByText('全能力测试工厂').first()).toBeVisible()
  await expect(page.getByText('雅加达后道工厂')).toHaveCount(0)
  await expect(page.getByText('雅加达车缝协作厂')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await expect(page.getByRole('heading', { name: '复检单', exact: true })).toBeVisible()
  await expect(page.getByText('查看交出仓').first()).toBeVisible()

  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('复检确认成衣件数')).toBeVisible()
})

test('工厂档案不展示后道 产值 节点为接单能力', async ({ page }) => {
  await page.goto('/fcs/factories/profile')
  await expect(page.getByText('后道接单能力口径')).toBeVisible()
  await expect(page.getByText('专门后道工厂固定具备后道、质检、复检')).toBeVisible()
  await expect(page.getByText('非专门工厂只展示后道')).toBeVisible()
  await expect(page.getByText('后道', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('质检', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('复检', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('烫包')).toHaveCount(0)
})
