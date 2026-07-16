import { expect, test, type Locator, type Page } from '@playwright/test'

const ledgerRoute = '/fcs/production/preparation-timing'
const statisticsRoute = '/fcs/production/preparation-timing-statistics'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

function filterGroup(page: Page, field: string): Locator {
  return page.locator(`[data-prep-filter-group="${field}"]`)
}

function filterOption(group: Locator, value: string): Locator {
  return group.locator(`[data-prep-filter-checkbox][value="${value}"]`)
}

async function candidateValues(group: Locator): Promise<string[]> {
  return group.locator('[data-prep-filter-option-label]').evaluateAll((labels) =>
    labels
      .filter((label) => !(label as HTMLElement).hidden)
      .map((label) => (label as HTMLElement).dataset.prepFilterValue ?? ''),
  )
}

async function waitForStableFilterScope(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect.poll(async () => {
    const token = crypto.randomUUID()
    await page.locator(selector).evaluate((node, value) => {
      ;(node as HTMLElement).dataset.playwrightStableToken = value
    }, token)
    await page.waitForTimeout(150)
    return page.locator(selector).getAttribute('data-playwright-stable-token')
  }).toMatch(/[0-9a-f-]{36}/)
}

test('台账提交保留两个跟单重复参数并重置页码', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03&page=2`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')

  const merchandiser = filterGroup(page, 'merchandiserName')
  await merchandiser.locator('summary').click()
  await filterOption(merchandiser, 'Maya').check()
  await filterOption(merchandiser, 'Raka').check()
  await expect(merchandiser.locator('[data-prep-filter-summary]')).toContainText('跟单（2）')

  await page.locator('[data-prep-filter-scope]').getByRole('button', { name: '筛选', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.getAll('merchandiserName')).toEqual(['Maya', 'Raka'])
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
})

test('台账准备项与责任团队双向联动且已选项始终可见', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')

  await itemType.locator('summary').click()
  await filterOption(itemType, '毛织基码纸样').check()
  await expect(itemType.locator('[data-prep-filter-summary]')).toContainText('准备项（1）')
  expect(await candidateValues(ownerTeam)).toEqual(['毛织团队'])

  await ownerTeam.locator('summary').click()
  await filterOption(ownerTeam, '毛织团队').check()
  await expect(ownerTeam.locator('[data-prep-filter-summary]')).toContainText('责任团队（1）')
  expect(await candidateValues(itemType)).toEqual(['毛织基码纸样', '毛织齐码纸样'])
  await expect(filterOption(itemType, '毛织基码纸样')).toBeChecked()
  await expect(itemType.locator('[data-prep-filter-value="毛织基码纸样"]')).not.toHaveAttribute('hidden', '')
})

test('不兼容旧 URL 保留两个已选值并显示空态', async ({ page }) => {
  const route = `${ledgerRoute}?tab=ledger&month=2026-03&itemType=${encodeURIComponent('梭织基码纸样')}&ownerTeam=${encodeURIComponent('染色团队')}`
  await page.goto(route)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const openedUrl = page.url()

  await expect(filterOption(filterGroup(page, 'itemType'), '梭织基码纸样')).toBeChecked()
  await expect(filterOption(filterGroup(page, 'ownerTeam'), '染色团队')).toBeChecked()
  await expect(page.getByText('当前筛选条件下暂无生产准备记录', { exact: true })).toBeVisible()
  expect(page.url()).toBe(openedUrl)
  expect(new URL(page.url()).searchParams.getAll('itemType')).toEqual(['梭织基码纸样'])
  expect(new URL(page.url()).searchParams.getAll('ownerTeam')).toEqual(['染色团队'])
})

test('月度统计支持准备项团队联动且不展示准备项进度', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  await expect(page.getByText('准备项进度', { exact: true })).toHaveCount(0)

  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')
  await itemType.locator('summary').click()
  await filterOption(itemType, '梭织基码纸样').check()
  await expect(itemType.locator('[data-prep-filter-summary]')).toContainText('准备项（1）')
  expect(await candidateValues(ownerTeam)).toEqual(['版师团队'])

  await ownerTeam.locator('summary').click()
  await filterOption(ownerTeam, '版师团队').check()
  await expect(ownerTeam.locator('[data-prep-filter-summary]')).toContainText('责任团队（1）')
  expect(await candidateValues(itemType)).toEqual(['梭织基码纸样', '梭织齐码纸样'])
})
