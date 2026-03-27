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

test('裁片仓页面正常打开，列表与详情 drawer 可用', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')

  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cut-piece-warehouse-action="open-detail"]').first()).toBeVisible()
  await page.locator('[data-cut-piece-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('裁片仓详情')

  await expectNoPageErrors(errors)
})

test('裁片仓动作改走正式 writeback 链，刷新后状态仍存在', async ({ page }) => {
  const errors = collectPageErrors(page)
  const locationCode = `A区-${Date.now().toString().slice(-6)}`

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  const detailButton = page.locator('[data-cut-piece-warehouse-action="open-detail"]').first()
  const itemId = (await detailButton.getAttribute('data-item-id')) || ''
  await detailButton.click()

  await page.locator('[data-cut-piece-warehouse-detail-field="locationCode"]').fill(locationCode)
  await page.locator('[data-cut-piece-warehouse-action="save-location"]').first().click()

  await expect(page.locator('body')).toContainText(locationCode)

  await page.reload()
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await page.locator(`[data-cut-piece-warehouse-action="open-detail"][data-item-id="${itemId}"]`).first().click()
  await expect(page.locator('[data-cut-piece-warehouse-detail-field="locationCode"]')).toHaveValue(locationCode)

  await expectNoPageErrors(errors)
})

test('样衣仓页面正常打开，列表与详情 drawer 可用', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/sample-warehouse')

  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-sample-warehouse-action="open-detail"]').first()).toBeVisible()
  await page.locator('[data-sample-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('样衣仓详情')
  await expect(page.locator('body')).toContainText('流转记录')

  await expectNoPageErrors(errors)
})

test('样衣仓动作改走正式 writeback 链，时间线刷新后仍可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  const note = `抽检回写-${Date.now().toString().slice(-6)}`

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  const detailButton = page.locator('[data-sample-warehouse-action="open-detail"]').first()
  const itemId = (await detailButton.getAttribute('data-item-id')) || ''
  await detailButton.click()

  await page.locator('[data-sample-warehouse-detail-field="locationType"]').selectOption('inspection')
  await page.locator('[data-sample-warehouse-detail-field="note"]').fill(note)
  await page.locator('[data-sample-warehouse-action="mark-inspection"]').first().click()

  await expect(page.locator('body')).toContainText('抽检中')
  await expect(page.locator('body')).toContainText('样衣进入抽检')
  await expect(page.locator('body')).toContainText(note)

  await page.reload()
  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await page.locator(`[data-sample-warehouse-action="open-detail"][data-item-id="${itemId}"]`).first().click()
  await expect(page.locator('body')).toContainText('抽检中')
  await expect(page.locator('body')).toContainText('样衣进入抽检')
  await expect(page.locator('body')).toContainText(note)

  await expectNoPageErrors(errors)
})

test('仓务写回链接入后 UI 骨架保持稳定', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cut-piece-warehouse-action="go-summary-index"]')).toBeVisible()
  await page.locator('[data-cut-piece-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('区位信息')

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-sample-warehouse-action="go-summary-index"]')).toBeVisible()
  await page.locator('[data-sample-warehouse-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('流转记录')
})
