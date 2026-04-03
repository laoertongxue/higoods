import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openExceptionTable(page: import('@playwright/test').Page) {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '异常待处理', exact: true }).click()
  return page.getByTestId('marker-plan-exception-list')
}

test('异常待处理可带着问题页签上下文跳到详情和编辑页', async ({ page }) => {
  const errors = collectPageErrors(page)

  let table = await openExceptionTable(page)
  const allocationButton = table.locator('[data-marker-plan-action="go-detail"][data-tab-key="allocation"]').first()
  await expect(allocationButton).toBeVisible()
  await allocationButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\/.+tab=allocation/)

  table = await openExceptionTable(page)
  const mappingButton = table.locator('[data-marker-plan-action="go-edit"][data-tab-key="explosion"]').first()
  await expect(mappingButton).toBeVisible()
  await mappingButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\/.+tab=explosion/)

  table = await openExceptionTable(page)
  const layoutButton = table.locator('[data-marker-plan-action="go-detail"][data-tab-key="layout"]').first()
  await expect(layoutButton).toBeVisible()
  await layoutButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\/.+tab=layout/)

  table = await openExceptionTable(page)
  const imageButton = table.locator('[data-marker-plan-action="go-edit"][data-tab-key="images"]').first()
  await expect(imageButton).toBeVisible()
  await imageButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\/.+tab=images/)

  await expectNoPageErrors(errors)
})
