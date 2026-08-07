import { expect, test } from '@playwright/test'

import { buildProductionOrderOverviewRows } from '../src/pages/process-factory/cutting/production-order-overview-projection'
import { buildProductionProgressProjection } from '../src/pages/process-factory/cutting/production-progress-projection'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const detailTabs = [
  '裁片单',
  '配料 / 接收',
  '唛架 / 铺布',
  '裁剪产出 / 菲票',
  '待交出仓 / 中转袋',
  '交出',
  '差异 / 关闭',
  '样衣 / 特殊工艺 / 捆条',
] as const

test('生产单进度状态入口进入简化事实详情页', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()
  const overviewRows = buildProductionOrderOverviewRows()
  const detailRows = buildProductionProgressProjection().rows
  const targetProjection = overviewRows.find((overviewRow) =>
    detailRows.some((detailRow) => detailRow.productionOrderId === overviewRow.productionOrderId),
  )
  expect(targetProjection).toBeDefined()
  const targetDetail = detailRows.find((detailRow) => detailRow.productionOrderId === targetProjection!.productionOrderId)
  expect(targetDetail).toBeDefined()
  const targetRow = table.locator(`tbody tr[data-production-order-id="${targetProjection!.productionOrderId}"]`)
  await expect(targetRow).toBeVisible()
  const encodedDetailId = encodeURIComponent(targetDetail!.id)
  const materialFlowPath = `/fcs/craft/cutting/production-progress-detail/${encodedDetailId}?tab=material-flow`
  const printingStatusButton = targetRow.getByRole('button', { name: targetProjection!.printingStatus, exact: true })
  await expect(printingStatusButton).toHaveAttribute('data-nav', materialFlowPath)
  await printingStatusButton.click()

  await expect(page).toHaveURL(new RegExp(`${materialFlowPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  const detail = page.getByTestId('cutting-production-progress-detail-page')
  await expect(detail).toBeVisible()
  await expect(detail.getByText('生产单详情', { exact: true })).toBeVisible()
  await expect(detail.getByRole('heading', { name: targetDetail!.productionOrderNo })).toBeVisible()

  const tabNavigation = detail.getByRole('navigation', { name: '生产单详情页签' })
  await expect(tabNavigation.getByRole('button')).toHaveCount(detailTabs.length)
  for (const tab of detailTabs) {
    await expect(tabNavigation.getByRole('button', { name: tab, exact: true })).toBeVisible()
  }
  await expect(tabNavigation.getByRole('button', { name: '配料 / 接收', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(detail.getByRole('heading', { name: '配料 / 接收记录' })).toBeVisible()

  await tabNavigation.getByRole('button', { name: '裁片单', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/craft/cutting/production-progress-detail/${encodedDetailId}\\?tab=cut-orders$`))
  await expect(tabNavigation.getByRole('button', { name: '裁片单', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(detail).toContainText('本单成衣件数（件）')
  await expect(detail).toContainText('计划发货日期')
  await expect(detail.getByRole('heading', { name: '生产单下的裁片单' })).toBeVisible()
  await expect(detail.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('异常事实', { exact: true })).toHaveCount(0)
  await expect(page.locator('.fixed.inset-0.z-50')).toHaveCount(0)

  const overviewOnlyProjection = overviewRows.find((row) => row.productionOrderId === 'PO-202603-088')
  expect(overviewOnlyProjection).toBeDefined()
  expect(detailRows.some((row) => row.productionOrderId === overviewOnlyProjection!.productionOrderId)).toBe(false)
  await page.goto('/fcs/craft/cutting/production-progress')
  const overviewOnlyRow = page
    .getByTestId('cutting-production-progress-main-table')
    .locator('tbody tr[data-production-order-id="PO-202603-088"]')
  const overviewOnlyStatus = overviewOnlyRow.getByRole('button', {
    name: overviewOnlyProjection!.printingStatus,
    exact: true,
  })
  const productionOrderPath = '/fcs/production/orders/PO-202603-088'
  await expect(overviewOnlyStatus).toHaveAttribute('data-nav', productionOrderPath)
  await overviewOnlyStatus.click()
  await expect(page).toHaveURL(new RegExp(`${productionOrderPath}$`))
  await expect(page.getByText('未找到对应生产单详情，请返回生产单总览重新选择。')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
