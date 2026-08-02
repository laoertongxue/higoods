import { expect, test } from '@playwright/test'

import { buildProductionOrderOverviewRows } from '../src/pages/process-factory/cutting/production-order-overview-projection'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('裁床生产单总览只读展示完整业务状态', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.locator('[data-testid="cutting-production-progress-main-table"]:visible')
  await expect(table).toBeVisible()
  const firstStyleImage = table.locator('tbody img').first()
  await expect(firstStyleImage).not.toHaveAttribute('src', /placeholder\.svg/)
  await expect(firstStyleImage).toHaveAttribute('src', /\.(jpg|jpeg|png|webp)$/)
  await expect(table).toContainText(/无需印花|未开始|进行中|已完成/)
  await expect(table.locator('[data-cutting-overview-factory-line]').first()).toBeVisible()
  await expect(table).toContainText('中央工厂')
  await expect(table.locator('tr[data-production-order-id="PO-202603-0002"] [data-cutting-overview-factory-line]')).toHaveCount(2)
  await expect(table).toContainText('PO-202603-088')
  const printingRow = buildProductionOrderOverviewRows().find((row) => row.productionOrderId === 'PO-202603-088')
  expect(printingRow).toBeDefined()
  const printingDetailPath = printingRow!.id === printingRow!.productionOrderId
    ? `/fcs/production/orders/${printingRow!.productionOrderId}`
    : `/fcs/craft/cutting/production-progress-detail/${printingRow!.id}?tab=material-flow`
  const printingStatusButton = table.locator('tr[data-production-order-id="PO-202603-088"]')
    .getByRole('button', { name: printingRow!.printingStatus, exact: true })
  await expect(printingStatusButton).toHaveAttribute('data-nav', printingDetailPath)
  await printingStatusButton.click()
  await expect(page).toHaveURL(new RegExp(`${printingDetailPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(table).toBeVisible()

  await expect(page.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(page.getByText('异常事实', { exact: true })).toHaveCount(0)
  await expect(page.getByText('风险提示', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-cutting-overview-mutate]')).toHaveCount(0)
  await expect(page.getByText(/共 \d+ 张生产单/).first()).toBeVisible()

  const expectedDyeingRowCount = await table.locator('tbody tr').evaluateAll((rows) =>
    rows.filter((row) => row.textContent?.includes('染色中')).length,
  )
  expect(expectedDyeingRowCount).toBeGreaterThan(0)
  const dyeingFilter = page.locator('details:visible').filter({ hasText: '染色状态' })
  await dyeingFilter.locator('summary').click()
  await dyeingFilter.locator('input[value="染色中"]').check()
  const filterDuration = await page.evaluate(() => {
    const root = [...document.querySelectorAll<HTMLElement>('[data-cutting-overview-root]')]
      .find((item) => item.offsetParent !== null)
    const queryButton = [...(root?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent?.trim() === '查询')
    if (!queryButton) throw new Error('生产单总览缺少查询按钮')
    const startedAt = performance.now()
    queryButton.click()
    return performance.now() - startedAt
  })
  console.log(`生产单总览染色查询到 DOM 总耗时：${filterDuration.toFixed(1)}ms`)
  expect(filterDuration).toBeLessThan(200)
  await expect(table.locator('tbody tr')).toHaveCount(expectedDyeingRowCount)
  await expect.poll(() => page.evaluate((expectedCount) =>
    [...document.querySelectorAll('[data-cutting-overview-root]')].some((root) => {
      const hasSelectedDyeing = [...root.querySelectorAll('summary')]
        .some((summary) => summary.textContent?.includes('染色状态（1）'))
      const rows = [...root.querySelectorAll<HTMLElement>('tbody tr')]
      return hasSelectedDyeing
        && rows.length === expectedCount
        && rows.every((row) => row.textContent?.includes('染色中'))
        && rows.every((row) => row.dataset.productionOrderId !== 'PO-202603-086')
    }), expectedDyeingRowCount,
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
