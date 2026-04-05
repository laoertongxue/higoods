import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function countViewportRows(page: import('@playwright/test').Page, tableTestId: string) {
  return page.getByTestId(tableTestId).locator('tbody tr').evaluateAll((rows) => {
    const viewportHeight = window.innerHeight
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect()
      return rect.height > 0 && rect.top < viewportHeight && rect.bottom > 0
    }).length
  })
}

async function expectVerticalOrder(
  upper: import('@playwright/test').Locator,
  lower: import('@playwright/test').Locator,
) {
  const upperBox = await upper.boundingBox()
  const lowerBox = await lower.boundingBox()
  expect(upperBox).toBeTruthy()
  expect(lowerBox).toBeTruthy()
  expect((upperBox?.y ?? 0) + (upperBox?.height ?? 0)).toBeLessThanOrEqual((lowerBox?.y ?? 0) + 2)
}

async function countTripleCardNesting(page: import('@playwright/test').Page, rootSelector: string) {
  return page.locator(rootSelector).evaluate((root) => {
    const isCard = (node: Element) => node.classList.contains('border') && node.classList.contains('bg-card')
    return Array.from(root.querySelectorAll('*')).filter((node) => {
      if (!isCard(node)) return false
      const second = Array.from(node.children).find((child) => isCard(child))
      if (!second) return false
      return Array.from(second.children).some((child) => isCard(child))
    }).length
  })
}

test('唛架列表工作台支持导出、上下文抽屉、公式列与行内动作', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto('/fcs/craft/cutting/marker-list')
  await expect(page.getByTestId('marker-plan-more-filters')).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('marker-plan-list-stats')).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-tabs')).toBeVisible()
  await expect(page.getByTestId('marker-plan-list-filters')).toBeVisible()
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)

  await expectVerticalOrder(page.getByTestId('marker-plan-list-stats'), page.getByTestId('marker-plan-list-tabs'))
  await expectVerticalOrder(page.getByTestId('marker-plan-list-tabs'), page.getByTestId('marker-plan-list-filters'))
  await expectVerticalOrder(page.getByTestId('marker-plan-list-filters'), page.locator('[data-marker-plan-main-card="true"]'))
  const statsBox = await page.getByTestId('marker-plan-list-stats').boundingBox()
  expect(statsBox?.height ?? 0).toBeLessThan(220)
  const tabsBox = await page.getByTestId('marker-plan-list-tabs').boundingBox()
  expect(tabsBox?.height ?? 0).toBeLessThan(90)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('唛架列表-待建上下文-')

  await page.getByRole('button', { name: '从原始裁片单新建' }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByLabel('上下文类型')).toBeVisible()
  await expect(drawer.getByLabel('搜索')).toBeVisible()
  await drawer.getByLabel('搜索').fill('CUT-')
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(drawer).not.toBeVisible()

  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  const table = page.getByTestId('marker-plan-list-table')
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)
  await expect(table.locator('thead')).toBeVisible()
  expect(await countViewportRows(page, 'marker-plan-list-table')).toBeGreaterThanOrEqual(6)
  expect(await countTripleCardNesting(page, '[data-testid="cutting-marker-plan-list-page"]')).toBe(0)
  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await expect(table).toContainText('=')
  await expect(table.locator('.font-mono').first()).toBeVisible()
  await expect(table.locator('.font-mono').first()).toContainText('=')

  await expect(firstRow.getByRole('button', { name: '查看' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '编辑' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '复制为新唛架' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '去原始裁片单' })).toBeVisible()

  await firstRow.getByRole('button', { name: '查看' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\//)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  await page.getByTestId('marker-plan-list-table').locator('tbody tr').first().getByRole('button', { name: '编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\//)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  await page.getByTestId('marker-plan-list-table').locator('tbody tr').first().getByRole('button', { name: '复制为新唛架' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-create\?copyFrom=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  const refreshedTable = page.getByTestId('marker-plan-list-table')

  const batchRow = refreshedTable.locator('tbody tr').filter({ hasText: '合并裁剪批次' }).first()
  await expect(batchRow).toBeVisible()
  await expect(batchRow.getByRole('button', { name: '去合并裁剪批次' })).toBeVisible()

  const readyRow = refreshedTable.locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create\?/)
  await expect(page).toHaveURL(/markerId=/)

  await expectNoPageErrors(errors)
})
