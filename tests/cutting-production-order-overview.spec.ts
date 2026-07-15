import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('裁床生产单总览只读展示完整业务状态', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.locator('[data-testid="cutting-production-progress-main-table"]:visible')
  await expect(table).toBeVisible()
  await expect(table.locator('tbody img').first()).toHaveAttribute('src', /\.(jpg|jpeg|png|webp)$/)
  await expect(table).toContainText(/无需印花|未开始|进行中|已完成/)
  await expect(table.locator('[data-cutting-overview-factory-line]').first()).toBeVisible()
  await expect(table).toContainText('中央工厂')
  await expect(table.locator('tr[data-production-order-id="PO-202603-0002"] [data-cutting-overview-factory-line]')).toHaveCount(2)
  await expect(table.locator('tbody tr').first()).toContainText('PO-202603-088')
  await expect(table.locator('tr[data-production-order-id="PO-202603-088"] td').nth(3).getByRole('button', { name: '进行中' }))
    .toHaveAttribute('data-nav', '/fcs/production/orders/PO-202603-088')

  await expect(page.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(page.getByText('异常事实', { exact: true })).toHaveCount(0)
  await expect(page.getByText('风险提示', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-cutting-overview-mutate]')).toHaveCount(0)
  await expect(page.getByText(/共 \d+ 张生产单/).first()).toBeVisible()

  const dyeingFilter = page.locator('details:visible').filter({ hasText: '染色状态' })
  await dyeingFilter.locator('summary').click()
  const filterStartedAt = performance.now()
  await dyeingFilter.locator('input[value="进行中"]').check()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  expect(performance.now() - filterStartedAt).toBeLessThan(200)
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('[data-cutting-overview-root]')].some((root) => {
      const hasSelectedDyeing = [...root.querySelectorAll('summary')]
        .some((summary) => summary.textContent?.includes('染色状态（1）'))
      const rows = [...root.querySelectorAll<HTMLElement>('tbody tr')]
      return hasSelectedDyeing
        && rows.length === 2
        && rows.every((row) => row.textContent?.includes('进行中'))
        && rows.every((row) => row.dataset.productionOrderId !== 'PO-202603-086')
    }),
  )).toBe(true)

  await page.evaluate(() => {
    const root = [...document.querySelectorAll('[data-cutting-overview-root]')].find((item) =>
      [...item.querySelectorAll('summary')].some((summary) => summary.textContent?.includes('染色状态（1）')),
    )
    const resetButton = [...(root?.querySelectorAll('button') ?? [])]
      .find((button) => button.textContent?.trim() === '重置') as HTMLButtonElement | undefined
    resetButton?.click()
  })
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('[data-cutting-overview-root] summary')]
      .every((summary) => !summary.textContent?.includes('染色状态（1）')),
  )).toBe(true)

  await expectNoPageErrors(errors)
})
