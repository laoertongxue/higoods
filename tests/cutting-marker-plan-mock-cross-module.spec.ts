import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openBuiltPlanRow(page: import('@playwright/test').Page, rowText: string) {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const row = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: rowText }).first()
  await expect(row).toBeVisible()
  return row
}

test('唛架 mock 覆盖跨模块上下文与关键状态场景', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  const pendingRows = page.getByTestId('marker-plan-pending-contexts').locator('tbody tr')
  expect(await pendingRows.count()).toBeGreaterThanOrEqual(6)
  await expect(page.getByTestId('marker-plan-pending-contexts')).toContainText('原始裁片单')
  await expect(page.getByTestId('marker-plan-pending-contexts')).toContainText('合并裁剪批次')

  await page.getByRole('button', { name: '已建唛架' }).click()
  const builtRows = page.getByTestId('marker-plan-list-table').locator('tbody tr')
  expect(await builtRows.count()).toBeGreaterThanOrEqual(10)

  const planTable = page.getByTestId('marker-plan-list-table')
  await expect(planTable).toContainText('普通模式')
  await expect(planTable).toContainText('高低层模式')
  await expect(planTable).toContainText('对折-普通模式')
  await expect(planTable).toContainText('对折-高低层模式')

  await expect(planTable).toContainText('待配平')
  await expect(planTable).toContainText('映射异常')
  await expect(planTable).toContainText('待排版')
  await expect(planTable).toContainText('待上传')
  await expect(planTable).toContainText('可交接铺布')

  const originalRow = await openBuiltPlanRow(page, '原始裁片单')
  await originalRow.getByRole('button', { name: '查看' }).click()
  await expect(page.getByRole('button', { name: '去原始裁片单' })).toBeVisible()
  await page.getByRole('button', { name: '去原始裁片单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  const originalRowForPrep = await openBuiltPlanRow(page, '原始裁片单')
  await originalRowForPrep.getByRole('button', { name: '编辑' }).click()
  await page.getByRole('button', { name: '去配料领料' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/material-prep\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  const batchRow = await openBuiltPlanRow(page, '合并裁剪批次')
  await batchRow.getByRole('button', { name: '查看' }).click()
  await page.getByRole('button', { name: '去合并批次' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches\?/)
  await expect(page).toHaveURL(/focusBatchId=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const readyRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-spreading\?/)

  await expectNoPageErrors(errors)
})
