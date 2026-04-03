import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('唛架列表工作台支持导出、上下文抽屉、公式列与行内动作', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')

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
  await expect(batchRow.getByRole('button', { name: '去合并批次' })).toBeVisible()

  const readyRow = refreshedTable.locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-spreading\?/)

  await expectNoPageErrors(errors)
})
