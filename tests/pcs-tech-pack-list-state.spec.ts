import { expect, test } from '@playwright/test'

// Real browser regression for the shared state used by the lightweight list and handlers.
// Run against an existing server with PLAYWRIGHT_BASE_URL; 5173 is the dev fallback.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

test('technical pack list preserves queries and selections across rendering', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(`${baseURL}/pcs/technical-data/tech-packs`)
  const keyword = page.locator('[data-tech-data-field="keyword"]')
  const search = page.locator('[data-tech-data-action="search"]')
  const rows = page.locator('main tbody')
  const openImage = page.locator('[data-tech-data-action="open-image"]')
  await expect(openImage.first()).toBeVisible()

  await test.step('query survives rendering and produces an actual empty result', async () => {
    await keyword.fill('NO-SUCH-TECH-PACK-REGRESSION')
    await search.click()
    await expect(keyword).toHaveValue('NO-SUCH-TECH-PACK-REGRESSION')
    await expect(rows).toContainText('暂无符合条件的技术包')
    await expect(openImage).toHaveCount(0)
  })

  await test.step('clearing the query restores the list', async () => {
    await keyword.fill('')
    await search.click()
    await expect(keyword).toHaveValue('')
    await expect(openImage.first()).toBeVisible()
    await expect(rows).not.toContainText('暂无符合条件的技术包')
  })

  await test.step('status selection remains selected after query rendering', async () => {
    const status = page.locator('[data-tech-data-field="status"]')
    await status.selectOption('PUBLISHED')
    await search.click()
    await expect(status).toHaveValue('PUBLISHED')
    await expect(rows).toContainText('已发布')
    await status.selectOption('')
    await search.click()
    await expect(status).toHaveValue('')
    await expect(openImage.first()).toBeVisible()
  })

  await test.step('the original image loads and closes', async () => {
    await openImage.first().click()
    const close = page.locator('[data-tech-data-action="close-image"]')
    await expect(close.last()).toBeVisible()
    const original = page.getByRole('dialog').locator('img')
    await expect(original).toBeVisible()
    await expect.poll(() => original.evaluate(image =>
      (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
    )).toBe(true)
    await close.last().click()
    await expect(close).toHaveCount(0)
    await expect(openImage.first()).toBeVisible()
  })
  expect(pageErrors).toEqual([])
})
