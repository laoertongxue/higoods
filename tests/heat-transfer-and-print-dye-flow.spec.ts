import { expect, test } from '@playwright/test'

const HEAT_TRANSFER_GARMENT_WORK_ORDER = 'AUX-TASK-PO2026030002-SFER-2ab9e9-03-WO-001-'

test('直喷和烫画拥有独立加工单入口', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/aux-op-heat-transfer/tasks')
  await expect(page.getByRole('heading', { name: '烫画加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('AUX-202603-0002-8192-03')

  await page.goto('/fcs/process-factory/special-craft/aux-op-direct-print/tasks')
  await expect(page.getByRole('heading', { name: '直喷加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('AUX-202603-0002-6384-04')
})

test('成衣烫画按件加工、无需菲票并交往我方后道工厂', async ({ page }) => {
  await page.goto(`/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders/${HEAT_TRANSFER_GARMENT_WORK_ORDER}`)

  await expect(page.getByRole('heading', { name: '加工单详情' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '面包屑' })).toContainText('烫画')
  await expect(page.locator('body')).toContainText('目标对象')
  await expect(page.locator('body')).toContainText('成衣')
  await expect(page.locator('body')).toContainText('计划成衣数量')
  await expect(page.locator('body')).toContainText(/件/)
  await expect(page.locator('body')).toContainText('上游来源')
  await expect(page.locator('body')).toContainText('成衣仓')
  await expect(page.locator('body')).toContainText('下游去向')
  await expect(page.locator('body')).toContainText('我方后道工厂')
  await expect(page.getByRole('button', { name: '菲票记录' })).toHaveCount(0)
  await expect(page.getByText('绑定菲票数量', { exact: true })).toHaveCount(0)
})

test('补料详情只展示真实印花和染色加工单及补料来源', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/supplement-management')
  await expect(page.getByRole('heading', { name: '补料管理' })).toBeVisible()
  const supplementRow = page.locator('tbody tr').filter({ hasText: 'SUP-02SPEU6' })
  await expect(supplementRow).toHaveCount(1)
  await supplementRow.getByRole('button', { name: '查看详情', exact: true }).click()

  await expect(page.getByRole('heading', { name: '补料单详情' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '印花 / 染色加工单' })).toBeVisible()
  await expect(page.getByText('来源：裁片补料生成', { exact: true }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('印花需求单')
  await expect(page.locator('body')).not.toContainText('染色需求单')
})
