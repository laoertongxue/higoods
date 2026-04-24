import { expect, test } from '@playwright/test'

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

test('特殊工艺交出差异能追溯菲票、数量变化和流转记录', async ({ page }) => {
  const detailPath = '/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-02-WO-001-'

  await page.goto(`${detailPath}?tab=difference`)
  await expect(page.getByRole('heading', { name: '差异上报' })).toBeVisible()
  await expect(page.getByText('交出裁片数量').first()).toBeVisible()
  await expect(page.getByText('实收裁片数量').first()).toBeVisible()
  await expect(page.getByText('差异裁片数量').first()).toBeVisible()
  await page.getByRole('button', { name: '同步菲票数量' }).first().click()
  await expect(page.getByText('已确认差异').first()).toBeVisible()

  await page.goto(`${detailPath}?tab=fei`)
  await expect(page.getByRole('heading', { name: '绑定菲票' })).toBeVisible()
  await expect(page.getByText('当前裁片数量').first()).toBeVisible()
  await expect(page.getByText('累计报废裁片数量').first()).toBeVisible()

  await page.goto(`${detailPath}?tab=quantity`)
  await expect(page.getByRole('heading', { name: '数量变化' })).toBeVisible()
  await expect(page.getByText('变化数量').first()).toBeVisible()

  await page.goto(`${detailPath}?tab=events`)
  await expect(page.getByRole('heading', { name: '流转记录' })).toBeVisible()
  await expect(page.getByText('交出记录').first()).toBeVisible()
})

test('后道交出仓只承接复检完成并统一统计交出差异', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('只承接复检完成后的后道工厂待交出记录。')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '统一交出记录' })).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('熨烫')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/statistics')
  await expect(page.getByRole('heading', { name: '后道统计' })).toBeVisible()
  await expect(page.getByText('交出成衣件数').first()).toBeVisible()
  await expect(page.getByText('实收成衣件数').first()).toBeVisible()
  await expect(page.getByText('差异成衣件数').first()).toBeVisible()
})
