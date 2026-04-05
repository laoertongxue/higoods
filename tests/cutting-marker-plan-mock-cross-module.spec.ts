import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('唛架 mock 覆盖待建上下文、模式与主状态场景', async ({ page }) => {
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

  await expectNoPageErrors(errors)
})

test('原始裁片单、仓库配料领料、合并裁剪批次都会跳到 canonical 唛架入口', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByTestId('cutting-original-orders-page')).toBeVisible()
  await page
    .getByTestId('cutting-original-orders-main-table')
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: '去唛架' })
    .click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByText('原始裁片单配料主表')).toBeVisible()
  await page
    .locator('table')
    .filter({ hasText: '原始裁片单号' })
    .first()
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: '去唛架' })
    .click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByTestId('cutting-merge-batches-page')).toBeVisible()
  await page
    .getByTestId('cutting-merge-batches-ledger')
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: '查看详情' })
    .click()
  await page.getByRole('button', { name: '去唛架' }).first().evaluate((node: HTMLElement) => node.click())
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-list\?/)
  await expect(page).toHaveURL(/mergeBatchId=/)

  await expectNoPageErrors(errors)
})

test('已建唛架可真实跳回原始裁片单、配料领料、合并裁剪批次和铺布执行', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()

  const originalRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '原始裁片单' }).first()
  await expect(originalRow).toBeVisible()
  await originalRow.getByRole('button', { name: '查看' }).click()
  await page.getByRole('button', { name: '去原始裁片单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const originalEditRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '原始裁片单' }).first()
  await originalEditRow.getByRole('button', { name: '编辑' }).click()
  await page.getByRole('button', { name: '去配料领料' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/material-prep\?/)
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const batchRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '合并裁剪批次' }).first()
  await batchRow.getByRole('button', { name: '查看' }).click()
  await page.getByRole('button', { name: '去合并裁剪批次' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches\?/)
  await expect(page).toHaveURL(/focusBatchId=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const readyRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-create\?/)
  await expect(page).toHaveURL(/markerId=/)
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()
  await expect(page.getByRole('button', { name: '已选中' })).toBeVisible()

  await expectNoPageErrors(errors)
})
