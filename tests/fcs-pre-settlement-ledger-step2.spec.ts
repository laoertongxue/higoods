import { expect, test } from '@playwright/test'

test('平台侧预结算流水页面按正式流水渲染', async ({ page }) => {
  await page.goto('/fcs/settlement/adjustments')
  await expect(page.locator('body')).toContainText('预结算流水')
  await expect(page.locator('body')).toContainText('任务收入流水')
  await expect(page.locator('body')).toContainText('质量扣款流水')
  await expect(page.locator('body')).not.toContainText('应付调整')
  await expect(page.locator('body')).not.toContainText('下周期调整')
  await expect(page.locator('body')).not.toContainText('冲回')
})

test('任务收入流水详情可以追到任务、回货批次和价格来源', async ({ page }) => {
  await page.goto('/fcs/settlement/adjustments')
  const taskRow = page.locator('tbody tr').filter({ hasText: '任务收入流水' }).first()
  await expect(taskRow).toBeVisible()
  await taskRow.getByRole('button', { name: '查看详情' }).click()
  await expect(page.locator('body')).toContainText('流水详情')
  await expect(page.locator('body')).toContainText('来源追溯')
  await expect(page.locator('body')).toContainText('任务号')
  await expect(page.locator('body')).toContainText('回货批次号')
  await expect(page.locator('body')).toContainText('价格来源')
})

test('质量扣款流水详情可以追到质检记录与待确认记录，且未把未正式成立记录混入主列表', async ({ page }) => {
  await page.goto('/fcs/settlement/adjustments')
  const qualityRow = page.locator('tbody tr').filter({ hasText: '质量扣款流水' }).first()
  await expect(qualityRow).toBeVisible()
  await qualityRow.getByRole('button', { name: '查看详情' }).click()
  await expect(page.locator('body')).toContainText('质检记录')
  await expect(page.locator('body')).toContainText('待确认质量扣款记录')
  await expect(page.locator('body')).not.toContainText('待确认质量扣款记录待入正式流水')
  await expect(page.locator('body')).not.toContainText('异议中记录已进入正式流水')
})
