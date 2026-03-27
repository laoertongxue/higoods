import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const sampleTaskId = 'TASK-CUT-000097'
const sampleExecutionOrderNo = 'CPO-20260319-K'

test('P1 收口后主页面与执行准备链抽样页面仍可正常打开', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

test('P1 收口后 traceability 页面仍正常工作', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('周转口袋列表')
  await expect(page.locator('body')).toContainText('使用周期')

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('来源裁片单数')

  await expectNoPageErrors(errors)
})

test('P1 收口后 PDA 页面仍正常工作', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('关联执行单')
  await expect(page.locator('body')).toContainText('绑定原始裁片单')

  await page.goto(`/fcs/pda/cutting/pickup/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '扫码领料', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cut-pickup-action="submit"]')).toBeVisible()

  await expectNoPageErrors(errors)
})

test('P1 收口没有顺手改 UI 骨架', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '查看裁剪总表' }).first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '开始装袋' }).first()).toBeVisible()

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-order-card-id]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})
