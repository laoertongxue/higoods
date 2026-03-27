import { expect, test, type Page } from '@playwright/test'

function attachPageErrorCollector(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoRuntimeErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

test('生产单进度可进入原始裁片单且页面不崩', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.locator('body')).toContainText('生产单主表')
  await page.locator('[data-cutting-progress-action="go-original-orders"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)
  await expect(page.locator('body')).toContainText('原始裁片单主表')

  await expectNoRuntimeErrors(errors)
})

test('合并裁剪批次页可正常打开', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('待建批次输入区')
  await expect(page.locator('body')).toContainText('当前还没有批次台账')

  await expectNoRuntimeErrors(errors)
})

test('PDA 裁片任务详情页可正常打开', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-000087')
  await expect(page.locator('body')).toContainText('裁片任务')
  await expect(page.locator('body')).toContainText('TASK-CUT-000087')
  await expect(page.locator('body')).toContainText('关联执行单')
  await expect(page.locator('body')).toContainText('绑定原始裁片单')

  await expectNoRuntimeErrors(errors)
})

test('PDA 执行入口在 identity core 重构后仍可打开', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/pda/cutting/pickup/TASK-CUT-000097?cutPieceOrderNo=CPO-20260319-K')
  await expect(page.locator('body')).toContainText('扫码领料')
  await expect(page.locator('body')).toContainText('当前领料状态')
  await expect(page.locator('body')).toContainText('CPO-20260319-K')

  await expectNoRuntimeErrors(errors)
})
