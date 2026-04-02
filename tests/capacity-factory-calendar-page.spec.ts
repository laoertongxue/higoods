import { expect, test, type Locator } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function selectByIndexIfPossible(locator: Locator, targetIndex: number): Promise<void> {
  const optionCount = await locator.locator('option').count()
  if (optionCount > targetIndex) {
    await locator.selectOption({ index: targetIndex })
  }
}

async function selectFactoryWithMinimumRows(factorySelect: Locator, rows: Locator, minimumRows: number): Promise<number> {
  const optionCount = await factorySelect.locator('option').count()
  for (let index = 0; index < optionCount; index += 1) {
    await factorySelect.selectOption({ index })
    await expect.poll(async () => rows.count()).toBeGreaterThan(0)
    const rowCount = await rows.count()
    if (rowCount >= minimumRows) {
      return index
    }
  }

  throw new Error(`未找到至少包含 ${minimumRows} 条工厂日历记录的工厂`)
}

test('工厂日历页已继续收平且详情区保持附属说明角色', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/capacity/constraints')

  const pageRoot = page.getByTestId('capacity-constraints-page')
  const header = page.getByTestId('capacity-constraints-header')
  const hint = page.getByTestId('capacity-constraints-hint')
  const kpis = page.getByTestId('capacity-constraints-kpis')
  const filters = page.getByTestId('capacity-constraints-filters')
  const main = page.getByTestId('capacity-constraints-main')
  const tableSection = page.getByTestId('factory-calendar-table-section')
  const detailPanel = page.getByTestId('factory-calendar-detail-panel')

  await expect(pageRoot).toBeVisible()
  await expect(page.getByRole('heading', { name: '工厂日历', exact: true })).toBeVisible()
  await expect(header).toContainText('当前窗口')

  await expect(hint).toHaveText('当前页展示选定工厂在窗口内各工序 / 工艺的标准工时供需事实，待分配需求不扣到工厂。')
  await expect(hint).not.toContainText('供给来自产能档案自动计算结果，已占用来自占用工时对象，已冻结来自冻结工时对象')

  const hintClass = (await hint.getAttribute('class')) ?? ''
  expect(hintClass).not.toContain('rounded')
  expect(hintClass).not.toContain('bg-muted')

  await expect(kpis.locator('article')).toHaveCount(6)
  const filtersClass = (await filters.getAttribute('class')) ?? ''
  expect(filtersClass).toContain('bg-slate-50/80')
  expect(filtersClass).not.toMatch(/\bborder\b/)

  await expect(main).toBeVisible()
  await expect(tableSection).toContainText('每日供需主表')
  await expect(tableSection).toContainText('按日期、工序、工艺查看窗口内每日供给、占用、冻结与剩余标准工时。')
  await expect(page.getByTestId('factory-calendar-count-rule-note')).toBeVisible()

  const detailClass = (await detailPanel.getAttribute('class')) ?? ''
  expect(detailClass).toContain('xl:border-l')
  expect(detailClass).not.toContain('rounded-md')
  expect(detailClass).not.toContain('bg-card')

  const factorySelect = page.locator('[data-capacity-filter="constraints-factory-id"]')
  const windowSelect = page.locator('[data-capacity-filter="constraints-window-days"]')
  const processSelect = page.locator('[data-capacity-filter="constraints-process-code"]')
  const craftSelect = page.locator('[data-capacity-filter="constraints-craft-code"]')
  const rows = page.locator('[data-capacity-action="open-factory-calendar-detail"]')

  await expect(factorySelect).toBeVisible()
  await expect(windowSelect).toBeVisible()
  await expect(processSelect).toBeVisible()
  await expect(craftSelect).toBeVisible()

  const selectedFactoryIndex = await selectFactoryWithMinimumRows(factorySelect, rows, 3)
  await expect(rows.nth(2)).toBeVisible()

  for (const index of [0, 1, 2]) {
    const row = rows.nth(index)
    const rowKey = await row.getAttribute('data-row-key')
    expect(rowKey).toBeTruthy()
    await row.click()
    await expect(detailPanel).toHaveAttribute('data-factory-calendar-detail', rowKey ?? '')
    await expect(page.getByTestId('factory-calendar-detail-summary')).toBeVisible()
    await expect(page.getByTestId('factory-calendar-committed-section')).toBeVisible()
    await expect(page.getByTestId('factory-calendar-frozen-section')).toBeVisible()
  }

  const factoryOptionCount = await factorySelect.locator('option').count()
  if (factoryOptionCount > 1) {
    const nextFactoryIndex = selectedFactoryIndex === 0 ? 1 : 0
    await factorySelect.selectOption({ index: nextFactoryIndex })
    await expect.poll(async () => rows.count()).toBeGreaterThan(0)
  }
  await windowSelect.selectOption('7')
  await expect.poll(async () => rows.count()).toBeGreaterThan(0)
  await selectByIndexIfPossible(processSelect, 1)
  await expect.poll(async () => rows.count()).toBeGreaterThan(0)
  await selectByIndexIfPossible(craftSelect, 1)
  await expect.poll(async () => rows.count()).toBeGreaterThan(0)

  await expect(rows.first()).toBeVisible()
  const filteredRowKey = await rows.first().getAttribute('data-row-key')
  expect(filteredRowKey).toBeTruthy()
  await rows.first().click()
  await expect(detailPanel).toHaveAttribute('data-factory-calendar-detail', filteredRowKey ?? '')

  const sourceTables = detailPanel.getByTestId('factory-calendar-source-table')
  const sourceTableCount = await sourceTables.count()
  if (sourceTableCount > 0) {
    const sourceTableClass = (await sourceTables.first().getAttribute('class')) ?? ''
    expect(sourceTableClass).toContain('bg-slate-50/90')
    expect(sourceTableClass).not.toMatch(/\bborder\b/)
  }

  await expectNoPageErrors(errors)
})
