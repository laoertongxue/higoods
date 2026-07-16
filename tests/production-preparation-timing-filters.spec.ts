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

async function checkFilterOption(group: Locator, value: string): Promise<void> {
  await group.evaluate((details) => {
    ;(details as HTMLDetailsElement).open = true
  })
  await filterOption(group, value).check()
}

async function expectClosestOptionLabelVisible(group: Locator, value: string): Promise<void> {
  await expect.poll(() => filterOption(group, value).evaluate((input) => input.closest('label')?.hidden)).toBe(false)
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

function expectStatsWhitelist(urlValue: string): void {
  const params = new URL(urlValue).searchParams
  expect(params.getAll('merchandiserName')).toEqual(['Maya', 'Raka'])
  expect(params.getAll('recordStatus')).toEqual(['进行中', '已完成'])
  expect(params.getAll('itemType')).toEqual(['梭织基码纸样', '辅料下单'])
  expect(params.getAll('ownerTeam')).toEqual(['版师团队'])
  expect(params.get('keyword')).toBe('FADAH')
  for (const key of ['itemProgress', 'buyerName', 'ownerName', 'overdueOnly', 'patternDesigner'] as const) {
    expect(params.has(key), `${key} 不得传播`).toBe(false)
  }
}

test('台账提交保留两个跟单重复参数并重置页码', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03&page=2`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')

  const merchandiser = filterGroup(page, 'merchandiserName')
  await checkFilterOption(merchandiser, 'Maya')
  await checkFilterOption(merchandiser, 'Raka')
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

  await checkFilterOption(itemType, '毛织基码纸样')
  await expect(itemType.locator('[data-prep-filter-summary]')).toContainText('准备项（1）')
  expect(await candidateValues(ownerTeam)).toEqual(['毛织团队'])

  await checkFilterOption(ownerTeam, '毛织团队')
  await expect(ownerTeam.locator('[data-prep-filter-summary]')).toContainText('责任团队（1）')
  expect(await candidateValues(itemType)).toEqual(['毛织基码纸样', '毛织齐码纸样'])
  await expect(filterOption(itemType, '毛织基码纸样')).toBeChecked()
  await expect(itemType.locator('[data-prep-filter-value="毛织基码纸样"]')).not.toHaveAttribute('hidden', '')
})

test('多个责任团队按并集展示对应准备项并隐藏不相关项', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')

  await checkFilterOption(ownerTeam, '版师团队')
  await checkFilterOption(ownerTeam, '染色团队')
  await expect(ownerTeam.locator('[data-prep-filter-summary]')).toContainText('责任团队（2）')
  expect(await candidateValues(itemType)).toEqual([
    '梭织基码纸样',
    '梭织齐码纸样',
    '染色调色（纱线）',
    '染色调色（面料）',
  ])
  await expectClosestOptionLabelVisible(itemType, '梭织基码纸样')
  await expectClosestOptionLabelVisible(itemType, '染色调色（纱线）')
  await expectClosestOptionLabelVisible(itemType, '染色调色（面料）')
  await expect.poll(() => filterOption(itemType, '辅料下单').evaluate((input) => input.closest('label')?.hidden)).toBe(true)
})

test('多个准备项按并集展示对应责任团队并隐藏不相关团队', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')

  await checkFilterOption(itemType, '梭织基码纸样')
  await checkFilterOption(itemType, '辅料下单')
  await expect(itemType.locator('[data-prep-filter-summary]')).toContainText('准备项（2）')
  expect(await candidateValues(ownerTeam)).toEqual(['版师团队', '采购团队'])
  await expectClosestOptionLabelVisible(ownerTeam, '版师团队')
  await expectClosestOptionLabelVisible(ownerTeam, '采购团队')
  await expect.poll(() => filterOption(ownerTeam, '染色团队').evaluate((input) => input.closest('label')?.hidden)).toBe(true)
})

test('不兼容旧 URL 保留两个已选值并显示空态', async ({ page }) => {
  const route = `${ledgerRoute}?tab=ledger&month=2026-03&itemType=${encodeURIComponent('梭织基码纸样')}&ownerTeam=${encodeURIComponent('染色团队')}`
  await page.goto(route)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const openedUrl = page.url()

  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')
  await expect(filterOption(itemType, '梭织基码纸样')).toBeChecked()
  await expect(filterOption(ownerTeam, '染色团队')).toBeChecked()
  await expectClosestOptionLabelVisible(itemType, '梭织基码纸样')
  await expectClosestOptionLabelVisible(ownerTeam, '染色团队')
  await expect(page.getByText('当前筛选条件下暂无生产准备记录', { exact: true })).toBeVisible()
  expect(page.url()).toBe(openedUrl)
  expect(new URL(page.url()).searchParams.getAll('itemType')).toEqual(['梭织基码纸样'])
  expect(new URL(page.url()).searchParams.getAll('ownerTeam')).toEqual(['染色团队'])
})

test('准备台账标准列表局部分页、三态排序和列偏好可用', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await page.evaluate(() => {
    window.localStorage.removeItem('higood:list-page:/fcs/production/preparation-timing:ledger')
  })
  await page.reload()
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await expect(page.locator('[data-standard-list-scroll]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await page.locator('[data-standard-list-scroll]').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

  const responseMs = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const root = document.querySelector('[data-standard-list-page]')
    const table = document.querySelector('[data-prep-list-region="table"]')
    const next = document.querySelector<HTMLButtonElement>('[data-production-preparation-ledger-action="next-page"]')
    if (!root || !table || !next) {
      reject(new Error('准备台账标准分页元素缺失'))
      return
    }
    ;(window as Window & { __prepLedgerRoot?: Element }).__prepLedgerRoot = root
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve(performance.now() - startedAt)
    })
    observer.observe(table, { childList: true, subtree: true })
    next.click()
    window.setTimeout(() => {
      observer.disconnect()
      reject(new Error('准备台账下一页未局部更新'))
    }, 500)
  }))
  expect(responseMs).toBeLessThan(200)
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2')
  await expect(page.getByText('PREP-202603-006', { exact: false })).toBeVisible()
  expect(await page.evaluate(() =>
    (window as Window & { __prepLedgerRoot?: Element }).__prepLedgerRoot === document.querySelector('[data-standard-list-page]'),
  )).toBe(true)

  const productHeader = page.locator('th[data-column-key="product"]')
  const sortButton = productHeader.getByRole('button')
  await sortButton.click()
  await expect(productHeader).toHaveAttribute('aria-sort', 'ascending')
  await sortButton.click()
  await expect(productHeader).toHaveAttribute('aria-sort', 'descending')
  await sortButton.click()
  await expect(productHeader).toHaveAttribute('aria-sort', 'none')

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  const outputsSetting = page.locator('[data-standard-list-column-key="outputs"]')
  await expect(outputsSetting).toBeVisible()
  await outputsSetting.locator('[data-production-preparation-ledger-action="toggle-column-visibility"]').uncheck()
  await expect(page.locator('th[data-column-key="outputs"]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('th[data-column-key="outputs"]')).toHaveCount(0)

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  await expect(page.locator('th[data-column-key="outputs"]')).toBeVisible()

  const statusSetting = page.locator('[data-standard-list-column-key="status"]')
  await statusSetting.locator('[data-production-preparation-ledger-action="toggle-column-freeze"]').check()
  await expect(page.locator('thead th[data-column-key]').first()).toHaveAttribute('data-column-key', 'status')
  await page.reload()
  await expect(page.locator('thead th[data-column-key]').first()).toHaveAttribute('data-column-key', 'status')
  await page.getByRole('button', { name: '列设置', exact: true }).click()
  await page.locator('[data-standard-list-column-key="status"] [data-production-preparation-ledger-action="toggle-column-freeze"]').uncheck()
  await expect(page.locator('thead th[data-column-key]').first()).toHaveAttribute('data-column-key', 'product')

  const timingSetting = page.locator('[data-standard-list-column-key="timing"]')
  const peopleSetting = page.locator('[data-standard-list-column-key="people"]')
  await timingSetting.dragTo(peopleSetting)
  await expect.poll(() => page.locator('thead th[data-column-key]').evaluateAll((headers) =>
    headers.slice(0, 3).map((header) => header.getAttribute('data-column-key')),
  )).toEqual(['product', 'timing', 'people'])
  await page.reload()
  await expect.poll(() => page.locator('thead th[data-column-key]').evaluateAll((headers) =>
    headers.slice(0, 3).map((header) => header.getAttribute('data-column-key')),
  )).toEqual(['product', 'timing', 'people'])
})

test('月度统计支持准备项团队联动且不展示准备项进度', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  await expect(page.getByText('准备项进度', { exact: true })).toHaveCount(0)

  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')
  await checkFilterOption(itemType, '梭织基码纸样')
  await expect(itemType.locator('[data-prep-filter-summary]')).toContainText('准备项（1）')
  expect(await candidateValues(ownerTeam)).toEqual(['版师团队'])

  await checkFilterOption(ownerTeam, '版师团队')
  await expect(ownerTeam.locator('[data-prep-filter-summary]')).toContainText('责任团队（1）')
  expect(await candidateValues(itemType)).toEqual(['梭织基码纸样', '梭织齐码纸样'])
})

test('统计关键词筛选收窄完成明细并可重置清除', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  const scope = page.locator('[data-prep-stats-filter-scope]')
  const keyword = scope.locator('input[name="keyword"]')

  await expect(keyword).toHaveAttribute('placeholder', '商品 / 生产单 / 准备项 / 跟单')
  await keyword.fill('Maya')
  await scope.getByRole('button', { name: '筛选', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('keyword')).toBe('Maya')
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  await expect(page.getByText('本月完成准备项', { exact: true }).locator('..')).toContainText('1项')

  const detailTab = page.getByRole('button', { name: '明细统计', exact: true })
  await expect(detailTab).toHaveAttribute('data-nav', /keyword=Maya/)
  await detailTab.click()
  await expect.poll(() => new URL(page.url()).searchParams.get('keyword')).toBe('Maya')
  await expect(page.getByText('共 1 条，第 1/1 页', { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Maya', exact: true })).toBeVisible()

  await page.locator('[data-prep-stats-filter-scope]').getByRole('button', { name: '重置', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('keyword')).toBe(false)
  await expect(page.locator('[data-prep-stats-filter-scope] input[name="keyword"]')).toHaveValue('')
  await expect(page.getByText('共 19 条，第 1/3 页', { exact: true })).toBeVisible()
})

test('统计 tab 分页和月份明细链接只传播白名单并保留合法重复参数', async ({ page }) => {
  const legacyQuery = new URLSearchParams([
    ['tab', 'monthly'],
    ['month', '2026-03'],
    ['merchandiserName', 'Maya'],
    ['merchandiserName', 'Raka'],
    ['recordStatus', '进行中'],
    ['recordStatus', '已完成'],
    ['itemType', '梭织基码纸样'],
    ['itemType', '辅料下单'],
    ['ownerTeam', '版师团队'],
    ['keyword', 'FADAH'],
    ['itemProgress', '未开始'],
    ['buyerName', '李乔'],
    ['ownerName', 'Diah'],
    ['overdueOnly', 'true'],
    ['patternDesigner', '冰冰'],
  ])
  const route = `${statisticsRoute}?${legacyQuery.toString()}`
  await page.goto(route)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')

  const detailTabUrl = await page.getByRole('button', { name: '明细统计', exact: true }).getAttribute('data-nav')
  const nextPageUrl = await page.getByRole('button', { name: '下一页', exact: true }).getAttribute('data-nav')
  const monthDetailUrl = await page.locator('section').filter({ has: page.getByRole('heading', { name: '统计表' }) })
    .getByRole('button', { name: '2026-03', exact: true }).first().getAttribute('data-nav')
  expect(detailTabUrl).toBeTruthy()
  expect(nextPageUrl).toBeTruthy()
  expect(monthDetailUrl).toBeTruthy()
  expectStatsWhitelist(new URL(detailTabUrl!, page.url()).toString())
  expectStatsWhitelist(new URL(nextPageUrl!, page.url()).toString())
  expectStatsWhitelist(new URL(monthDetailUrl!, page.url()).toString())

  await page.getByRole('button', { name: '明细统计', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('detail')
  expectStatsWhitelist(page.url())
})
