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

function ledgerSortButton(page: Page): Locator {
  return page.locator('th[data-column-key="product"]').getByRole('button')
}

async function expectLedgerDefaults(page: Page): Promise<void> {
  await expect(page.getByText('PREP-202603-001', { exact: false })).toBeVisible()
  await expect(page.getByText('PREP-202603-006', { exact: false })).toHaveCount(0)
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.locator('[data-production-preparation-ledger-action="prev-page"]')).toBeDisabled()
}

async function prepareSortedLedgerSecondPage(page: Page): Promise<void> {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await ledgerSortButton(page).click()
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'ascending')
  await page.locator('[data-production-preparation-ledger-action="next-page"]').click()
  await expect(page.locator('[data-prep-list-region="pagination"]')).toContainText(/2\s*\/\s*\d+/)
}

async function expectSortedLedgerSecondPage(page: Page): Promise<void> {
  await expect(page.locator('[data-prep-list-region="pagination"]')).toContainText(/2\s*\/\s*\d+/)
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'ascending')
}

async function navigateBySpaTab(page: Page, href: string, key: string): Promise<void> {
  await page.locator('[data-playwright-spa-nav]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  await page.locator('#app').evaluate((root, input) => {
    const button = document.createElement('button')
    button.dataset.playwrightSpaNav = ''
    button.dataset.action = 'open-tab'
    button.dataset.tabKey = input.key
    button.dataset.tabTitle = input.key
    button.dataset.tabHref = input.href
    root.appendChild(button)
  }, { href, key })
  await page.locator('[data-playwright-spa-nav]').evaluate((button) => (button as HTMLButtonElement).click())
  await expect(page).toHaveURL(new RegExp(href.replaceAll('/', '\\/')))
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
  await expect.poll(() => new URL(page.url()).searchParams.has('page')).toBe(false)
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

test('准备台账停在第二页刷新后回到第一页', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await page.locator('[data-production-preparation-ledger-action="next-page"]').click()
  await expect(page.getByText('PREP-202603-006', { exact: false })).toBeVisible()

  await page.reload()
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await expectLedgerDefaults(page)
})

test('准备台账保持排序刷新后回到未排序', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await ledgerSortButton(page).click()
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'ascending')

  await page.reload()
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await expectLedgerDefaults(page)
})

test('准备台账 SPA 离开再进入后回到第一页且未排序', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await page.locator('[data-production-preparation-ledger-action="next-page"]').click()
  await ledgerSortButton(page).click()
  await expect(page.getByText('PREP-202603-006', { exact: false })).toBeVisible()
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'ascending')

  await navigateBySpaTab(page, statisticsRoute, 'production-preparation-timing-statistics-test')
  await navigateBySpaTab(page, ledgerRoute, 'production-preparation-timing-test')
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await expectLedgerDefaults(page)
})

test('准备台账同路由打开并关闭详情后保留第二页和排序', async ({ page }) => {
  await prepareSortedLedgerSecondPage(page)

  await page.locator('tbody tr').first().getByRole('button', { name: '查看详情', exact: true }).click()
  const detailDrawer = page.locator('aside.fixed.inset-y-0.right-0')
  await expect(detailDrawer.getByRole('button', { name: '关闭', exact: true })).toBeVisible()
  await expectSortedLedgerSecondPage(page)
  await detailDrawer.getByRole('button', { name: '关闭', exact: true }).click()

  await expect(detailDrawer).toHaveCount(0)
  await expectSortedLedgerSecondPage(page)
})

test('准备台账同路由打开并关闭准备项操作弹窗后保留第二页和排序', async ({ page }) => {
  await prepareSortedLedgerSecondPage(page)

  const row = page.locator('tbody tr').first()
  const operationButton = row.locator('button[data-nav*="action=operate-item"]').first()
  await expect(operationButton).toBeVisible()
  await operationButton.click()
  await expect(page.getByRole('button', { name: '取消', exact: true })).toBeVisible()
  await expectSortedLedgerSecondPage(page)
  await page.getByRole('button', { name: '取消', exact: true }).click()

  await expect(page.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)
  await expectSortedLedgerSecondPage(page)
})

test('准备台账列设置局部渲染后图标已 hydration 且 SPA 重进不自动打开', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await page.getByRole('button', { name: '列设置', exact: true }).click()

  const settingsRegion = page.locator('[data-prep-list-region="column-settings"]')
  await expect(settingsRegion.getByRole('heading', { name: '准备台账列设置', exact: true })).toBeVisible()
  await expect(settingsRegion.locator('svg[data-lucide]').first()).toBeVisible()
  await expect(settingsRegion.locator('i[data-lucide]')).toHaveCount(0)

  await navigateBySpaTab(page, statisticsRoute, 'production-preparation-timing-statistics-column-settings-test')
  await navigateBySpaTab(page, ledgerRoute, 'production-preparation-timing-column-settings-test')
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await expect(page.getByRole('heading', { name: '准备台账列设置', exact: true })).toHaveCount(0)
})

test('准备台账筛选后回到第一页且排序重置', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await page.locator('[data-production-preparation-ledger-action="next-page"]').click()
  await ledgerSortButton(page).click()
  const recordStatus = filterGroup(page, 'recordStatus')
  await checkFilterOption(recordStatus, '进行中')

  await page.locator('[data-prep-filter-scope]').getByRole('button', { name: '筛选', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.getAll('recordStatus')).toEqual(['进行中'])
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  await expect(page.locator('th[data-column-key="product"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.locator('[data-production-preparation-ledger-action="prev-page"]')).toBeDisabled()
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
  await expect(page.getByText('共 1 条，当前 1-1', { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Maya', exact: true })).toBeVisible()

  await page.locator('[data-prep-stats-filter-scope]').getByRole('button', { name: '重置', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('keyword')).toBe(false)
  await expect(page.locator('[data-prep-stats-filter-scope] input[name="keyword"]')).toHaveValue('')
  await expect(page.getByText('共 19 条，当前 1-8', { exact: true })).toBeVisible()
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
  const monthDetailUrl = await page.locator('section').filter({ has: page.getByRole('heading', { name: '统计表' }) })
    .getByRole('button', { name: '2026-03', exact: true }).first().getAttribute('data-nav')
  expect(detailTabUrl).toBeTruthy()
  expect(monthDetailUrl).toBeTruthy()
  expectStatsWhitelist(new URL(detailTabUrl!, page.url()).toString())
  expectStatsWhitelist(new URL(monthDetailUrl!, page.url()).toString())
  expect(new URL(monthDetailUrl!, page.url()).searchParams.get('detailPage')).toBe('1')

  await page.getByRole('button', { name: '明细统计', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('detail')
  expectStatsWhitelist(page.url())
})

test('月度统计标准列表局部分页、三态排序和列偏好可用', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await page.evaluate(() => localStorage.removeItem('higood:list-page:/fcs/production/preparation-timing-statistics:monthly'))
  await page.reload()
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')

  const tableRegion = page.locator('[data-prep-stats-region="table"]')
  const root = page.locator('[data-standard-list-page]')
  await expect(root).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await tableRegion.locator('[data-standard-list-scroll]').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

  const responseMs = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const table = document.querySelector('[data-prep-stats-region="table"]')
    const next = document.querySelector<HTMLButtonElement>('[data-production-preparation-stats-monthly-action="next-page"]')
    if (!table || !next) return reject(new Error('月度统计局部分页元素缺失'))
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve(performance.now() - startedAt)
    })
    observer.observe(table, { childList: true, subtree: true })
    next.click()
    setTimeout(() => reject(new Error('月度统计下一页未局部更新')), 500)
  }))
  expect(responseMs).toBeLessThan(200)
  expect(new URL(page.url()).searchParams.has('monthlyPage')).toBe(false)
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('2 / 3')

  const itemTypeHeader = page.locator('th[data-column-key="itemType"]')
  await itemTypeHeader.getByRole('button').click()
  await expect(itemTypeHeader).toHaveAttribute('aria-sort', 'ascending')
  await itemTypeHeader.getByRole('button').click()
  await expect(itemTypeHeader).toHaveAttribute('aria-sort', 'descending')
  await itemTypeHeader.getByRole('button').click()
  await expect(itemTypeHeader).toHaveAttribute('aria-sort', 'none')

  const monthlyPageSize = page.locator('[data-production-preparation-stats-monthly-field="pageSize"]')
  await monthlyPageSize.selectOption('10')
  await expect(monthlyPageSize).toHaveValue('10')
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 2')

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  const basisSetting = page.locator('[data-standard-list-column-key="basisText"]')
  await basisSetting.locator('[data-production-preparation-stats-monthly-action="toggle-column-visibility"]').uncheck()
  await expect(page.locator('th[data-column-key="basisText"]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('th[data-column-key="basisText"]')).toHaveCount(0)
  await expect(page.locator('[data-production-preparation-stats-monthly-field="pageSize"]')).toHaveValue('10')
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 2')
  await expect(page.locator('th[data-column-key="itemType"]')).toHaveAttribute('aria-sort', 'none')

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  await expect(page.locator('th[data-column-key="basisText"]')).toBeVisible()
  const ownerTeamSetting = page.locator('[data-standard-list-column-key="ownerTeamText"]')
  await ownerTeamSetting.locator('[data-production-preparation-stats-monthly-action="toggle-column-freeze"]').check()
  await expect(page.locator('thead th[data-column-key]').first()).toHaveAttribute('data-column-key', 'ownerTeamText')
  await ownerTeamSetting.locator('[data-production-preparation-stats-monthly-action="toggle-column-freeze"]').uncheck()
  const latestSetting = page.locator('[data-standard-list-column-key="latestFinishedAt"]')
  const completedSetting = page.locator('[data-standard-list-column-key="completedCount"]')
  await latestSetting.dragTo(completedSetting)
  await expect.poll(() => page.locator('thead th[data-column-key]').evaluateAll((headers) =>
    headers.slice(0, 4).map((header) => header.getAttribute('data-column-key')),
  )).toEqual(['month', 'itemType', 'latestFinishedAt', 'completedCount'])
  await expect(page.getByRole('link', { name: '导出月度统计', exact: true })).toHaveAttribute('href', /^data:text\/csv/)
})

test('明细统计独立分页排序列偏好并在 Tab 切换后重置瞬时状态', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`${statisticsRoute}?tab=detail&month=2026-03`)
  await page.evaluate(() => localStorage.removeItem('higood:list-page:/fcs/production/preparation-timing-statistics:detail'))
  await page.reload()
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await page.locator('[data-prep-stats-region="table"] [data-standard-list-scroll]').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

  const detailPageSize = page.locator('[data-production-preparation-stats-detail-field="pageSize"]')
  await detailPageSize.selectOption('5')
  await expect(detailPageSize).toHaveValue('5')
  await page.locator('[data-production-preparation-stats-detail-action="next-page"]').click()
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('2 / 4')
  expect(new URL(page.url()).searchParams.has('detailPage')).toBe(false)

  const recordHeader = page.locator('th[data-column-key="recordNo"]')
  await recordHeader.getByRole('button').click()
  await expect(recordHeader).toHaveAttribute('aria-sort', 'ascending')

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  const buyerSetting = page.locator('[data-standard-list-column-key="buyerName"]')
  await buyerSetting.locator('[data-production-preparation-stats-detail-action="toggle-column-visibility"]').uncheck()
  await expect(page.locator('th[data-column-key="buyerName"]')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  await page.getByRole('button', { name: '月度统计', exact: true }).click()
  await expect(page.locator('th[data-column-key="basisText"]')).toBeVisible()
  await expect(page.locator('[data-production-preparation-stats-monthly-field="pageSize"]')).toHaveValue('5')
  await page.locator('[data-production-preparation-stats-monthly-field="pageSize"]').selectOption('10')
  await page.getByRole('button', { name: '明细统计', exact: true }).click()
  await expect(page.locator('[data-production-preparation-stats-detail-field="pageSize"]')).toHaveValue('5')
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 4')
  await expect(page.locator('th[data-column-key="recordNo"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.locator('th[data-column-key="buyerName"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '导出完成明细', exact: true })).toHaveAttribute('href', /^data:text\/csv/)

  await page.getByRole('button', { name: '列设置', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  await expect(page.locator('th[data-column-key="buyerName"]')).toBeVisible()
  const teamSetting = page.locator('[data-standard-list-column-key="ownerTeam"]')
  await teamSetting.locator('[data-production-preparation-stats-detail-action="toggle-column-freeze"]').check()
  await expect(page.locator('thead th[data-column-key]').first()).toHaveAttribute('data-column-key', 'ownerTeam')
  await teamSetting.locator('[data-production-preparation-stats-detail-action="toggle-column-freeze"]').uncheck()
  const merchandiserSetting = page.locator('[data-standard-list-column-key="merchandiserName"]')
  const buyerDefaultSetting = page.locator('[data-standard-list-column-key="buyerName"]')
  await merchandiserSetting.dragTo(buyerDefaultSetting)
  await expect.poll(() => page.locator('thead th[data-column-key]').evaluateAll((headers) =>
    headers.slice(0, 8).map((header) => header.getAttribute('data-column-key')),
  )).toEqual(['month', 'recordNo', 'spuCode', 'spuName', 'productionOrderNo', 'confirmedProductPrepType', 'merchandiserName', 'buyerName'])
})

test('统计页 SPA 离开再进入后重置页码排序和列设置抽屉', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await page.locator('[data-production-preparation-stats-monthly-action="next-page"]').click()
  const itemTypeHeader = page.locator('th[data-column-key="itemType"]')
  await itemTypeHeader.getByRole('button').click()
  await page.getByRole('button', { name: '列设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '月度统计列设置', exact: true })).toBeVisible()

  await navigateBySpaTab(page, ledgerRoute, 'production-preparation-timing-stats-leave-test')
  await navigateBySpaTab(page, statisticsRoute, 'production-preparation-timing-stats-reenter-test')
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')

  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 3')
  await expect(page.locator('th[data-column-key="itemType"]')).toHaveAttribute('aria-sort', 'none')
  await expect(page.getByRole('heading', { name: '月度统计列设置', exact: true })).toHaveCount(0)
})
