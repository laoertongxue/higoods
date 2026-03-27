import { expect, test, type Page } from '@playwright/test'

function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoPageErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

test('平台裁片总览正常打开，pickup / prep 字段仍可见', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/progress/cutting-overview')

  await expect(page.getByRole('heading', { name: '裁片任务总览', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('领料摘要')
  await expect(page.locator('body')).toContainText('建议动作')
  await expect(page.locator('[data-platform-cutting-field="pickupResult"]')).toBeVisible()

  await expectNoPageErrors(errors)
})

test('平台总览行仍以正式生产单为主对象，进入明细不会退回原始裁片单行', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/progress/cutting-overview')

  const firstRow = page.locator('table tbody tr').first()
  const productionOrderButton = firstRow.locator('button[data-platform-cutting-action="go-detail"]').first()
  const productionOrderNo = ((await productionOrderButton.textContent()) || '').trim()

  expect(productionOrderNo).toMatch(/^PO-/)

  await productionOrderButton.click()
  await expect(page).toHaveURL(/\/fcs\/progress\/cutting-overview\//)
  expect(new URL(page.url()).searchParams.has('originalCutOrderId')).toBeFalsy()
  expect(new URL(page.url()).searchParams.has('cutPieceOrderNo')).toBeFalsy()
  await expect(page.getByRole('heading', { name: '裁片任务详情', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(productionOrderNo)

  await expectNoPageErrors(errors)
})

test('平台总览 pickup / prep 汇总字段和明细摘要继续可见', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/progress/cutting-overview')
  await page.locator('[data-platform-cutting-action="open-summary"]').first().click()

  await expect(page.locator('body')).toContainText('裁片任务跟进摘要')
  await expect(page.locator('body')).toContainText('领料单号 / 打印版本')
  await expect(page.locator('body')).toContainText('裁片单主码 / 扫描结果')
  await expect(page.locator('body')).toContainText('补料摘要')
  await expect(page.locator('body')).toContainText('仓务摘要')

  await expectNoPageErrors(errors)
})

test('平台总览 UI 骨架未被顺手重做', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/progress/cutting-overview')

  await expect(page.getByRole('heading', { name: '裁片任务总览', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '查看详情' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '查看跟进摘要' }).first()).toBeVisible()
  await expect(page.locator('[data-platform-cutting-field="keyword"]')).toBeVisible()
  await expect(page.locator('[data-platform-cutting-field="stage"]')).toBeVisible()

  await expectNoPageErrors(errors)
})
