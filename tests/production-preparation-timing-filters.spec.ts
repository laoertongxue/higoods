import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  derivePreparationItemProgress,
  productionPreparationRecords,
} from '../src/data/fcs/production-preparation-timing'

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
  await expect.poll(async () => {
    const token = crypto.randomUUID()
    await page.locator(selector).evaluate((node, value) => {
      ;(node as HTMLElement).dataset.playwrightStableToken = value
    }, token)
    await page.waitForTimeout(150)
    return page.locator(selector).getAttribute('data-playwright-stable-token')
  }).toMatch(/[0-9a-f-]{36}/)
}

interface ActionCompletionCondition {
  selector?: string
  textIncludes?: string
  attribute?: string
  attributeValue?: string
  absent?: boolean
  urlIncludes?: string
}

async function measureActionResponse(trigger: Locator, condition: ActionCompletionCondition): Promise<number> {
  return trigger.evaluate(async (node, expected) => {
    const startedAt = performance.now()
    ;(node as HTMLElement).click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`动作响应未完成：${JSON.stringify(expected)}`)), 1500)
      const isComplete = () => {
        if (expected.urlIncludes && !window.location.href.includes(expected.urlIncludes)) return false
        if (!expected.selector) return true
        const target = document.querySelector(expected.selector)
        if (expected.absent) return !target
        if (!target) return false
        if (expected.textIncludes && !target.textContent?.includes(expected.textIncludes)) return false
        if (expected.attribute && target.getAttribute(expected.attribute) !== expected.attributeValue) return false
        return true
      }
      const poll = () => {
        if (isComplete()) {
          window.clearTimeout(timeout)
          resolve()
          return
        }
        requestAnimationFrame(poll)
      }
      poll()
    })
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return performance.now() - startedAt
  }, condition)
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

function decodeCsvDataUri(uri: string): string {
  return decodeURIComponent(uri.slice(uri.indexOf(',') + 1)).replace(/^\uFEFF/, '')
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else value += char
  }
  row.push(value)
  rows.push(row)
  return rows
}

async function exportedCsvRows(link: Locator): Promise<string[][]> {
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^data:text\/csv/)
  return parseCsv(decodeCsvDataUri(href!))
}

async function paginationTotal(page: Page, region: 'list' | 'stats'): Promise<number> {
  const text = await page.locator(`[data-prep-${region}-region="pagination"]`).innerText()
  const match = text.match(/共\s*(\d+)\s*条/)
  expect(match).not.toBeNull()
  return Number(match![1])
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

test('准备项进度筛选排除目标项进度不匹配但其他项已完成的记录', async ({ page }) => {
  const crossItemCounterexample = productionPreparationRecords.find((record) => record.recordNo === 'PREP-202603-002')
  expect(crossItemCounterexample).toBeTruthy()
  const targetItem = crossItemCounterexample!.items.find((item) => item.itemType === '版衣制作' && item.ownerTeam === '车板团队')
  expect(targetItem).toBeTruthy()
  expect(derivePreparationItemProgress(targetItem!, crossItemCounterexample!)).toBe('不满足开始条件')
  expect(crossItemCounterexample!.items.some((item) =>
    item.itemId !== targetItem!.itemId && derivePreparationItemProgress(item, crossItemCounterexample!) === '已完成',
  )).toBe(true)

  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03&page=2`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')
  const itemProgress = filterGroup(page, 'itemProgress')

  await checkFilterOption(itemType, '版衣制作')
  await checkFilterOption(ownerTeam, '车板团队')
  await itemProgress.locator('[data-prep-filter-summary]').click()
  await filterOption(itemProgress, '已完成').check()
  await expect(itemProgress.locator('[data-prep-filter-summary]')).toContainText('准备项进度（1）')

  await page.locator('[data-prep-filter-scope]').getByRole('button', { name: '筛选', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.getAll('itemProgress')).toEqual(['已完成'])
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  await expect(page.locator('[data-prep-list-region="pagination"]')).toContainText('共 3 条')
  await expect.poll(() => page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => {
    const match = row.textContent?.match(/PREP-\d{6}-\d{3}/)
    return match?.[0] ?? ''
  }))).toEqual([
    'PREP-202603-004',
    'PREP-202603-005',
    'PREP-202603-006',
  ])
  await expect(page.getByText('PREP-202603-002', { exact: false })).toHaveCount(0)
})

test('已完成辅料下单与正式产出在详情中保持同一业务口径', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03&recordId=prep-202603-005`)
  const drawer = page.locator('aside').filter({ hasText: 'PREP-202603-005' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('证据缺失', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText(/仍需完成：.*辅料下单/)).toHaveCount(0)
  await expect(drawer.getByText('待生成', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('已生成', { exact: true }).first()).toBeVisible()
  await expect(drawer.getByText('辅料采购单', { exact: true })).toBeVisible()
})

test('辅料采购单逐行保留下单时间且只更新被修改行', async ({ page }) => {
  const operateRoute = `${ledgerRoute}?tab=ledger&month=2026-03&recordId=prep-202603-002&itemId=prep-202603-002-item-06&action=operate-item`
  await page.goto(operateRoute)
  const orderNos = page.locator('input[name="accessoryPurchaseOrderNo"]')
  const orderedAts = page.locator('input[name="accessoryPurchaseOrderedAt"]')
  await expect(orderNos).toHaveCount(2)
  await expect(orderNos.nth(0)).toHaveValue('FPO-202603-002-A')
  await expect(orderNos.nth(1)).toHaveValue('FPO-202603-002-B')
  await expect(orderedAts.nth(0)).toHaveValue('2026-03-04T11:20')
  await expect(orderedAts.nth(1)).toHaveValue('2026-03-05T16:10')

  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('[data-prep-accessory-order-form]')).toHaveCount(0)
  await page.goto(operateRoute)
  await expect(page.locator('input[name="accessoryPurchaseOrderedAt"]').nth(0)).toHaveValue('2026-03-04T11:20')
  await expect(page.locator('input[name="accessoryPurchaseOrderedAt"]').nth(1)).toHaveValue('2026-03-05T16:10')

  await page.locator('input[name="accessoryPurchaseOrderedAt"]').nth(0).fill('2026-03-06T09:45')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('[data-prep-accessory-order-form]')).toHaveCount(0)
  await page.goto(operateRoute)
  await expect(page.locator('input[name="accessoryPurchaseOrderedAt"]').nth(0)).toHaveValue('2026-03-06T09:45')
  await expect(page.locator('input[name="accessoryPurchaseOrderedAt"]').nth(1)).toHaveValue('2026-03-05T16:10')
  await expect(page.getByText(/当前完成时间：2026-03-06T09:45/)).toBeVisible()

  const runtime = await page.evaluate(() => JSON.parse(localStorage.getItem('higood.production-preparation.runtime.v1') || '{}'))
  expect(runtime.accessoryPurchaseOrders['prep-202603-002-item-06']).toMatchObject({
    orderNos: ['FPO-202603-002-A', 'FPO-202603-002-B'],
    orderedAts: ['2026-03-06T09:45', '2026-03-05T16:10'],
    updatedAt: '2026-03-06T09:45',
  })
})

test('生产准备关键真实动作完成响应均小于 200ms', async ({ page }) => {
  const responseTimes: Record<string, number> = {}

  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  await checkFilterOption(filterGroup(page, 'recordStatus'), '进行中')
  responseTimes.filterSubmit = await measureActionResponse(
    page.locator('[data-prep-filter-scope] [data-nav-from-fields]'),
    { urlIncludes: 'recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD', selector: '[data-prep-list-region="pagination"]', textIncludes: '共 1 条' },
  )

  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  responseTimes.pagination = await measureActionResponse(
    page.locator('[data-production-preparation-ledger-action="next-page"]'),
    { selector: '[data-prep-list-region="pagination"]', textIncludes: '2 / 2' },
  )

  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  responseTimes.sort = await measureActionResponse(
    ledgerSortButton(page),
    { selector: 'th[data-column-key="product"]', attribute: 'aria-sort', attributeValue: 'ascending' },
  )

  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  responseTimes.tab = await measureActionResponse(
    page.getByRole('button', { name: '明细统计', exact: true }),
    { urlIncludes: 'tab=detail', selector: '[data-prep-list-kind="detail"]' },
  )
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')

  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  responseTimes.monthDrill = await measureActionResponse(
    page.locator('tbody button').filter({ hasText: '2026-03' }).first(),
    { urlIncludes: 'tab=detail', selector: '[data-prep-list-kind="detail"]' },
  )
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')

  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const completedRow = page.locator('tbody tr').filter({ hasText: 'PREP-202603-005' })
  responseTimes.dialogOpen = await measureActionResponse(
    completedRow.getByRole('button', { name: '登记辅料下单', exact: true }),
    { selector: '[data-prep-accessory-order-form]' },
  )
  responseTimes.dialogSubmit = await measureActionResponse(
    page.locator('[data-prep-accessory-order-form] button[type="submit"]'),
    { selector: '[data-prep-accessory-order-form]', absent: true },
  )

  for (const [action, responseMs] of Object.entries(responseTimes)) {
    expect(responseMs, `${action} 响应 ${responseMs.toFixed(1)}ms`).toBeLessThan(200)
  }
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

test('统计四类多选保留重复参数且关键词保持单值', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  const scope = page.locator('[data-prep-stats-filter-scope]')

  for (const [field, values] of [
    ['merchandiserName', ['Maya', 'Raka']],
    ['recordStatus', ['进行中', '已完成']],
    ['itemType', ['梭织基码纸样', '辅料下单']],
    ['ownerTeam', ['版师团队', '采购团队']],
  ] as const) {
    const group = filterGroup(page, field)
    for (const value of values) await checkFilterOption(group, value)
    await expect(group.locator('[data-prep-filter-summary]')).toContainText(`（${values.length}）`)
  }
  await scope.locator('input[name="keyword"]').fill('FADAH')
  await scope.getByRole('button', { name: '筛选', exact: true }).click()

  await expect.poll(() => new URL(page.url()).searchParams.getAll('merchandiserName')).toEqual(['Maya', 'Raka'])
  expect(new URL(page.url()).searchParams.getAll('recordStatus')).toEqual(['进行中', '已完成'])
  expect(new URL(page.url()).searchParams.getAll('itemType')).toEqual(['梭织基码纸样', '辅料下单'])
  expect(new URL(page.url()).searchParams.getAll('ownerTeam')).toEqual(['版师团队', '采购团队'])
  expect(new URL(page.url()).searchParams.getAll('keyword')).toEqual(['FADAH'])
  expect(new URL(page.url()).searchParams.has('itemProgress')).toBe(false)
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

test('月度与明细 CSV 导出完整重复多选筛选结果而非当前页', async ({ page }) => {
  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  const itemType = filterGroup(page, 'itemType')
  const ownerTeam = filterGroup(page, 'ownerTeam')
  await checkFilterOption(itemType, '梭织基码纸样')
  await checkFilterOption(itemType, '辅料下单')
  await checkFilterOption(ownerTeam, '版师团队')
  await checkFilterOption(ownerTeam, '采购团队')
  await page.locator('[data-prep-stats-filter-scope]').getByRole('button', { name: '筛选', exact: true }).click()

  await expect.poll(() => new URL(page.url()).searchParams.getAll('itemType')).toEqual(['梭织基码纸样', '辅料下单'])
  await expect.poll(() => new URL(page.url()).searchParams.getAll('ownerTeam')).toEqual(['版师团队', '采购团队'])
  const monthlyPageSize = page.locator('[data-production-preparation-stats-monthly-field="pageSize"]')
  await monthlyPageSize.selectOption('5')
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 3')

  const monthlyCsvRows = await exportedCsvRows(page.getByRole('link', { name: '导出月度统计', exact: true }))
  expect(monthlyCsvRows).toHaveLength(12)
  const nonZeroMonthlyRows = monthlyCsvRows.slice(1)
    .filter((row) => Number(row[2]) > 0)
    .map((row) => [row[1], row[2], row[6]])
  expect(nonZeroMonthlyRows).toEqual([
    ['梭织基码纸样', '2', '版师团队'],
    ['辅料下单', '4', '采购团队'],
  ])

  await page.getByRole('button', { name: '明细统计', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('detail')
  await expect.poll(() => new URL(page.url()).searchParams.getAll('itemType')).toEqual(['梭织基码纸样', '辅料下单'])
  const detailPageSize = page.locator('[data-production-preparation-stats-detail-field="pageSize"]')
  await detailPageSize.selectOption('5')
  await expect(page.locator('[data-prep-stats-region="pagination"]')).toContainText('1 / 2')
  await expect(page.locator('tbody tr')).toHaveCount(5)

  const detailCsvRows = await exportedCsvRows(page.getByRole('link', { name: '导出完成明细', exact: true }))
  expect(detailCsvRows).toHaveLength(7)
  expect(detailCsvRows.slice(1).map((row) => [row[1], row[8], row[10]])).toEqual([
    ['PREP-202603-002', '梭织基码纸样', '版师团队'],
    ['PREP-202603-002', '辅料下单', '采购团队'],
    ['PREP-202603-004', '辅料下单', '采购团队'],
    ['PREP-202603-005', '梭织基码纸样', '版师团队'],
    ['PREP-202603-005', '辅料下单', '采购团队'],
    ['PREP-202603-006', '辅料下单', '采购团队'],
  ])
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
  const monthlyExport = page.getByRole('link', { name: '导出月度统计', exact: true })
  const monthlyCsvRows = await exportedCsvRows(monthlyExport)
  expect(monthlyCsvRows[0]).toEqual([
    '统计月份', '准备项', '完成数量', '按时完成数量', '超时完成数量', '平均耗时小时',
    '责任团队', '最近完成时间', '口径说明', '完成基码', '完成齐码', '完成花型', '完成染色',
  ])
  expect(monthlyCsvRows).toHaveLength((await paginationTotal(page, 'stats')) + 1)
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
  const detailExport = page.getByRole('link', { name: '导出完成明细', exact: true })
  const detailCsvRows = await exportedCsvRows(detailExport)
  expect(detailCsvRows[0]).toEqual([
    '统计月份', '准备记录编号', 'SPU', '商品名', '生产单号', '商品类型', '买手', '跟单',
    '准备项', '必做/选填', '责任团队', '责任人', '计划完成时间', '实际完成时间', '是否超时', '证据摘要',
  ])
  expect(detailCsvRows).toHaveLength((await paginationTotal(page, 'stats')) + 1)

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

test('台账无关点击和统计关键词输入不刷新列表且响应小于 200ms', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const ledgerResult = await page.evaluate(async () => {
    const table = document.querySelector('[data-prep-list-region="table"]')
    const heading = document.querySelector('h1')
    if (!table || !heading) throw new Error('台账性能反例元素缺失')
    let mutations = 0
    const observer = new MutationObserver((records) => { mutations += records.length })
    observer.observe(table, { childList: true, subtree: true, attributes: true })
    const startedAt = performance.now()
    const clickEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent & {
      higoodResponseCompletionProbe?: () => void
    }
    const responseMs = await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('台账点击异步事件链未完成')), 1000)
      clickEvent.higoodResponseCompletionProbe = async () => {
        await Promise.resolve()
        await new Promise((nextTask) => setTimeout(nextTask, 0))
        await new Promise<void>((nextFrame) => requestAnimationFrame(() => nextFrame()))
        window.clearTimeout(timeout)
        resolve(performance.now() - startedAt)
      }
      heading.dispatchEvent(clickEvent)
    })
    observer.disconnect()
    return { mutations, responseMs }
  })
  expect(ledgerResult.mutations).toBe(0)
  expect(ledgerResult.responseMs).toBeLessThan(200)

  await page.goto(`${statisticsRoute}?tab=monthly&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-stats-filter-scope]')
  const statsResult = await page.evaluate(async () => {
    const table = document.querySelector('[data-prep-stats-region="table"]')
    const keyword = document.querySelector<HTMLInputElement>('[data-prep-stats-filter-scope] input[name="keyword"]')
    if (!table || !keyword) throw new Error('统计性能反例元素缺失')
    let mutations = 0
    const observer = new MutationObserver((records) => { mutations += records.length })
    observer.observe(table, { childList: true, subtree: true, attributes: true })
    const responseTimes = await Promise.all(['性', '性能', '性能反例'].map((value) => new Promise<number>((resolve, reject) => {
      keyword.value = value
      const startedAt = performance.now()
      const inputEvent = new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }) as InputEvent & {
        higoodResponseCompletionProbe?: () => void
      }
      const timeout = window.setTimeout(() => reject(new Error(`统计输入异步事件链未完成：${value}`)), 1000)
      inputEvent.higoodResponseCompletionProbe = async () => {
        await Promise.resolve()
        await new Promise((nextTask) => setTimeout(nextTask, 0))
        await new Promise<void>((nextFrame) => requestAnimationFrame(() => nextFrame()))
        window.clearTimeout(timeout)
        resolve(performance.now() - startedAt)
      }
      keyword.dispatchEvent(inputEvent)
    })))
    observer.disconnect()
    return { mutations, finalValue: keyword.value, responseMs: Math.max(...responseTimes) }
  })
  expect(statsResult.mutations).toBe(0)
  expect(statsResult.finalValue).toBe('性能反例')
  expect(statsResult.responseMs).toBeLessThan(200)
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

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}x${viewport.height} 页面无横向溢出且台账操作列始终可见无重叠`, async ({ page }) => {
    await page.setViewportSize(viewport)
    for (const route of [
      `${ledgerRoute}?tab=ledger&month=2026-03`,
      `${statisticsRoute}?tab=monthly&month=2026-03`,
      `${statisticsRoute}?tab=detail&month=2026-03`,
    ]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-standard-list-page]')).toBeVisible()
      const layout = await page.evaluate(() => ({
        htmlFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        bodyFits: document.body.scrollWidth <= document.body.clientWidth,
        internalScrolls: Array.from(document.querySelectorAll<HTMLElement>('[data-standard-list-scroll]'))
          .some((element) => element.scrollWidth > element.clientWidth),
      }))
      expect(layout, `${viewport.width}x${viewport.height} ${route}`).toEqual({
        htmlFits: true,
        bodyFits: true,
        internalScrolls: true,
      })
      await expect(page.locator('h1').first()).not.toBeEmpty()
      await expect(page.locator('h1').first().locator('xpath=ancestor::*[@data-standard-list-table-section]')).toHaveCount(0)
      if (!route.includes('statistics')) {
        const expectedRows = [
          { recordNo: 'PREP-202603-001', requiredLabels: ['确认工作项'], minimumButtons: 1 },
          { recordNo: 'PREP-202603-002', requiredLabels: ['查看详情', '上传毛织基码纸样'], minimumButtons: 2 },
        ]
        for (const expectedRow of expectedRows) {
          const row = page.locator('tbody tr').filter({ hasText: expectedRow.recordNo })
          await expect(row).toHaveCount(1)
          await expect(page.locator('thead th[data-column-key="actions"]')).toHaveText('操作')
          const actionCell = row.locator('td').last()
          const buttons = actionCell.getByRole('button')
          await expect.poll(() => buttons.count()).toBeGreaterThanOrEqual(expectedRow.minimumButtons)
          for (const label of expectedRow.requiredLabels) {
            await expect(buttons.filter({ hasText: label })).toBeVisible()
          }
          const actionLayout = await actionCell.evaluate((cell) => {
            const cellBox = cell.getBoundingClientRect()
            const buttonElements = Array.from(cell.querySelectorAll<HTMLElement>('button'))
            const buttonBoxes = buttonElements.map((button) => button.getBoundingClientRect())
            return {
              labels: buttonElements.map((button) => button.textContent?.trim() ?? ''),
              nonZeroButtons: buttonBoxes.every((box) => box.width > 0 && box.height > 0),
              visibleButtons: buttonElements.every((button) => getComputedStyle(button).visibility !== 'hidden'),
              stickyRight: getComputedStyle(cell).position === 'sticky' && getComputedStyle(cell).right === '0px',
              insideViewport: cellBox.left >= 0 && cellBox.right <= window.innerWidth,
              buttonsInsideCell: buttonBoxes.every((box) => box.left >= cellBox.left && box.right <= cellBox.right),
              buttonsDoNotOverlap: buttonBoxes.every((box, index) => index === 0 || box.top >= buttonBoxes[index - 1].bottom || box.left >= buttonBoxes[index - 1].right),
            }
          })
          expect(actionLayout.labels.length).toBeGreaterThan(0)
          expect(actionLayout.labels).toEqual(expect.arrayContaining(expectedRow.requiredLabels))
          expect(actionLayout).toMatchObject({
            nonZeroButtons: true,
            visibleButtons: true,
            stickyRight: true,
            insideViewport: true,
            buttonsInsideCell: true,
            buttonsDoNotOverlap: true,
          })
        }
      }
    }
  })
}

test('多选联动和列设置等待异步事件链完成且响应小于 200ms', async ({ page }) => {
  await page.goto(`${ledgerRoute}?tab=ledger&month=2026-03`)
  await waitForStableFilterScope(page, '[data-prep-filter-scope]')
  const linkageMs = await page.evaluate(async () => {
    const checkbox = document.querySelector<HTMLInputElement>('input[name="itemType"][value="毛织基码纸样"]')
    const teamLabel = document.querySelector<HTMLInputElement>('input[name="ownerTeam"][value="采购团队"]')?.closest('label')
    if (!checkbox || !teamLabel) throw new Error('多选联动性能元素缺失')
    const startedAt = performance.now()
    checkbox.click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('多选联动未完成')), 1000)
      const waitUntilUpdated = () => {
        if (teamLabel.hidden) {
          window.clearTimeout(timeout)
          resolve()
          return
        }
        requestAnimationFrame(waitUntilUpdated)
      }
      waitUntilUpdated()
    })
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return performance.now() - startedAt
  })
  expect(linkageMs).toBeLessThan(200)

  const columnSettingsMs = await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('[data-production-preparation-ledger-action="open-column-settings"]')
    const region = document.querySelector<HTMLElement>('[data-prep-list-region="column-settings"]')
    if (!button || !region) throw new Error('列设置性能元素缺失')
    const startedAt = performance.now()
    button.click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('列设置未完成')), 1000)
      const observer = new MutationObserver(() => {
        if (!region.textContent?.includes('准备台账列设置')) return
        observer.disconnect()
        window.clearTimeout(timeout)
        resolve()
      })
      observer.observe(region, { childList: true, subtree: true })
      if (region.textContent?.includes('准备台账列设置')) {
        observer.disconnect()
        window.clearTimeout(timeout)
        resolve()
      }
    })
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return performance.now() - startedAt
  })
  expect(columnSettingsMs).toBeLessThan(200)
})

test('筛选文案只保留批准字段且标题不在列表卡片内', async ({ page }) => {
  for (const route of [
    `${ledgerRoute}?tab=ledger&month=2026-03`,
    `${statisticsRoute}?tab=monthly&month=2026-03`,
  ]) {
    await page.goto(route)
    const scope = page.locator(route.includes('statistics') ? '[data-prep-stats-filter-scope]' : '[data-prep-filter-scope]')
    await expect(scope).toBeVisible()
    for (const forbidden of ['责任人', '是否超时', '买手']) {
      await expect(scope.getByText(forbidden, { exact: true })).toHaveCount(0)
    }
    await expect(page.locator('h1').first()).toHaveText(route.includes('statistics') ? '生产准备时效统计' : '生产准备时效')
    await expect(page.locator('h1').first().locator('xpath=ancestor::*[@data-standard-list-table-section]')).toHaveCount(0)
  }
})
