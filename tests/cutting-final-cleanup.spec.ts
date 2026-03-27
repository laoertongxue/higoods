import { expect, test, type Page } from '@playwright/test'

const sampleTaskId = 'TASK-CUT-000097'
const sampleExecutionOrderNo = 'CPO-20260319-K'

function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoPageErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

test('删旧后裁片主链页面仍然可跑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await expect(page.getByRole('heading', { name: '可裁排产', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('删旧后执行准备链抽样入口仍然可跑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/fabric-warehouse')
  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { name: '补料管理', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/special-processes')
  await expect(page.getByRole('heading', { name: '特殊工艺', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('删旧后 PDA 链仍然正常', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()

  await page.goto(`/fcs/pda/cutting/pickup/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '扫码领料', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('删旧后追溯链仍然正常', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.locator('table tbody').getByRole('button', { name: '查看详情', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('菲票拆分明细')

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('步骤 1：扫周转口袋码')

  await expectNoPageErrors(errors)
})

test('保留的 legacy 入口只做 canonical redirect，不会落回旧业务页', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/order-progress')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/cut-piece-orders')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders$/)
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/warehouse-management')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)
  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('最终收口后关键页面 UI 骨架保持稳定', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-progress-action="go-original-orders"]').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-prep-action="go-marker-spreading-index"]')).toBeVisible()

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first()).toBeVisible()

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-task-card-id]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
