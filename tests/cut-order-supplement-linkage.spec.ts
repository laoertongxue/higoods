import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { matchesSupplementFilters } from '../src/pages/process-factory/cutting/cut-orders-model.ts'

const route = '/fcs/craft/cutting/cut-orders'
const storageKey = 'higood:list-page:/fcs/craft/cutting/cut-orders'

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
}

function cutOrderRow(page: Page, cutOrderNo: string) {
  return page.locator('[data-standard-list-table] tbody tr').filter({ hasText: cutOrderNo })
}

async function findCutOrderRow(page: Page, cutOrderNo: string) {
  await page.locator('[data-cutting-piece-field="keyword"]').fill(cutOrderNo)
  const row = cutOrderRow(page, cutOrderNo)
  await expect(row).toHaveCount(1)
  return row
}

const stableSupplementFacts = [
  { id: 'supplement-cut14671-b-001', recordNo: 'SUP-CUT14671-B-001', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 1, status: '已完成', reason: '验片破损', totalQty: 393, lineSummary: 'Black/M/9件；Black/M/10件', createdAt: '2026-07-22 10:00', createdBy: '裁床主管 王敏', completedAt: '2026-07-22 10:00', completedBy: '裁床主管 王敏' },
  { id: 'supplement-cut14671-b-002', recordNo: 'SUP-CUT14671-B-002', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 2, status: '未完成', reason: '尺码齐套不足', totalQty: 412, lineSummary: 'Black/M/10件；Black/M/11件', createdAt: '2026-07-22 11:00', createdBy: '裁床主管 王敏', completedAt: '', completedBy: '' },
  { id: 'supplement-cut14671-b-003', recordNo: 'SUP-CUT14671-B-003', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 3, status: '未完成', reason: '尺码齐套不足', totalQty: 431, lineSummary: 'Black/M/11件；Black/M/12件', createdAt: '2026-07-22 12:00', createdBy: '裁床主管 王敏', completedAt: '', completedBy: '' },
]

async function readStableRegistry(page: Page) {
  return page.evaluate(async () => {
    const registry = await import('/src/data/fcs/cutting/supplement-order-registry.ts')
    return registry.listSupplementOrdersByCutOrder('cut-14671-b')
  })
}

async function expectVisibleIconsHydrated(page: Page, selector: string, requireIcon = false): Promise<void> {
  const result = await page.locator(selector).evaluate((root) => {
    const visibleIcons = [...root.querySelectorAll<HTMLElement>('[data-lucide]')].filter((icon) => {
      const style = getComputedStyle(icon)
      const rect = icon.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    return {
      count: visibleIcons.length,
      unhydrated: visibleIcons.filter((icon) => icon.tagName.toLowerCase() !== 'svg' || !icon.classList.contains('lucide')).length,
    }
  })
  if (requireIcon) expect(result.count).toBeGreaterThan(0)
  expect(result.unhydrated).toBe(0)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    const marker = '__cutOrderListAcceptanceReset'
    if (window.sessionStorage.getItem(marker)) return
    window.localStorage.removeItem(key)
    window.sessionStorage.setItem(marker, 'true')
  }, storageKey)
})

test('补料筛选纯规则覆盖空、全完成、混合和矛盾组合', () => {
  const matches = (
    statuses: Array<'未完成' | '已完成'>,
    hasSupplement: 'ALL' | 'YES' | 'NO',
    supplementCompletion: 'ALL' | 'HAS_INCOMPLETE' | 'ALL_COMPLETED',
  ) => matchesSupplementFilters(statuses, { hasSupplement, supplementCompletion })

  expect(matches([], 'ALL', 'ALL')).toBe(true)
  expect(matches([], 'YES', 'ALL')).toBe(false)
  expect(matches([], 'NO', 'ALL')).toBe(true)
  expect(matches([], 'ALL', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches([], 'ALL', 'ALL_COMPLETED')).toBe(false)
  expect(matches(['未完成'], 'YES', 'HAS_INCOMPLETE')).toBe(true)
  expect(matches(['已完成'], 'YES', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches(['已完成', '已完成'], 'ALL', 'ALL_COMPLETED')).toBe(true)
  expect(matches(['已完成', '未完成'], 'ALL', 'ALL_COMPLETED')).toBe(false)
  expect(matches(['未完成'], 'NO', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches(['已完成'], 'NO', 'ALL_COMPLETED')).toBe(false)
})

test('CUT14671-B 稳定补料定义只允许存在于一个共享 fixture', () => {
  const cutOrdersSource = readFileSync('src/pages/process-factory/cutting/cut-orders.ts', 'utf8')
  const supplementSource = readFileSync('src/pages/process-factory/cutting/supplement-management.ts', 'utf8')
  for (const duplicatedFact of ['supplement-cut14671-b-001', 'SUP-CUT14671-B-001', 'Black/M/9件；Black/M/10件']) {
    expect(cutOrdersSource).not.toContain(duplicatedFact)
    expect(supplementSource).not.toContain(duplicatedFact)
  }
})

test('先访问任一页面都登记同一组 CUT14671-B 补料事实', async ({ browser }) => {
  const cutFirst = await browser.newPage()
  await cutFirst.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(cutFirst.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(cutFirst)).toEqual(stableSupplementFacts)
  await cutFirst.getByRole('button', { name: '裁后处理', exact: true }).click()
  await cutFirst.getByRole('button', { name: '补料管理', exact: true }).click()
  await expect(cutFirst.getByRole('heading', { name: '补料管理' })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(cutFirst)).toEqual(stableSupplementFacts)
  await cutFirst.close()

  const supplementFirst = await browser.newPage()
  await supplementFirst.goto('/fcs/craft/cutting/supplement-management')
  await expect(supplementFirst.getByRole('heading', { name: '补料管理' })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(supplementFirst)).toEqual(stableSupplementFacts)
  await supplementFirst.getByRole('button', { name: '裁前准备', exact: true }).click()
  await supplementFirst.getByRole('complementary').getByRole('button', { name: '裁片单', exact: true }).click()
  await expect(supplementFirst.getByRole('heading', { name: '裁片单', exact: true })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(supplementFirst)).toEqual(stableSupplementFacts)
  await supplementFirst.close()
})

test('裁片单使用标准列表根、标准表格、固定操作列和明确分页口径', async ({ page }) => {
  await openList(page)

  await expect(page.locator('[data-standard-list-table]')).toBeVisible()
  await expect(page.locator('[data-standard-list-action-column]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(page.getByText(/共 \d+ 条/)).toBeVisible()
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible()
  await expect(page.locator('[data-cutting-piece-field="pageSize"]')).toHaveValue('10')
})

test('排序、分页和列偏好只局部刷新且按规则持久化', async ({ page }) => {
  await openList(page)
  const mainHandle = await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __cutOrderMain?: Element }).__cutOrderMain = node
    return true
  })
  expect(mainHandle).toBe(true)

  await expect(page.getByRole('button', { name: '下一页' })).toBeEnabled()
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText(/2 \/ \d+/)).toBeVisible()
  await expectVisibleIconsHydrated(page, '[data-cutting-piece-region="pagination"]')

  const cutOrderHeader = page.locator('th[data-column-key="cutOrder"]')
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'none')
  const firstResponseMs = await cutOrderHeader.getByRole('button').evaluate(async (button) => {
    const startedAt = performance.now()
    ;(button as HTMLButtonElement).click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return performance.now() - startedAt
  })
  expect(firstResponseMs).toBeLessThan(200)
  console.log(`裁片单排序局部响应：${firstResponseMs.toFixed(1)}ms`)
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'ascending')
  await cutOrderHeader.getByRole('button').click()
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'descending')
  await cutOrderHeader.getByRole('button').click()
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'none')

  await page.getByRole('button', { name: '列设置' }).click()
  const settings = page.getByRole('heading', { name: '列设置' }).locator('xpath=ancestor::div[contains(@class,"fixed")]')
  await expectVisibleIconsHydrated(page, '[data-cutting-piece-region="overlay"]', true)
  const materialSetting = settings.locator('[data-cutting-piece-column-key="material"]')
  await materialSetting.getByLabel('显示').uncheck()
  await expectVisibleIconsHydrated(page, '[data-cutting-piece-region="overlay"]', true)
  await settings.locator('[data-cutting-piece-column-key="date"]').getByLabel('冻结').check()
  await settings.locator('[data-standard-list-column-drag][data-cutting-piece-column-key="risk"]').dragTo(
    settings.locator('[data-standard-list-column-drag][data-cutting-piece-column-key="boundary"]'),
  )
  await settings.getByRole('button', { name: '关闭' }).click()
  await page.locator('[data-cutting-piece-field="pageSize"]').selectOption('20')

  const persisted = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey)
  expect(persisted.visibleKeys).not.toContain('material')
  expect(persisted.frozenKeys).toContain('date')
  expect(persisted.order.indexOf('risk')).toBeLessThan(persisted.order.indexOf('boundary'))
  expect(persisted.pageSize).toBe(20)
  expect(persisted.page).toBeUndefined()
  expect(persisted.sort).toBeUndefined()
  expect(await page.evaluate(() => document.querySelector('main') === (
    window as typeof window & { __cutOrderMain?: Element }
  ).__cutOrderMain)).toBe(true)

  await page.reload()
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('th[data-column-key="material"]')).toHaveCount(0)
  await expect(page.locator('th[data-column-key="date"]')).toHaveCSS('position', 'sticky')
  await expect(page.locator('[data-cutting-piece-field="pageSize"]')).toHaveValue('20')
  await expect(page.locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(0)
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible()
})

test('放行联动区块不受列设置局部刷新影响且 Escape 只关闭最上层弹层', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })

  const linkage = page.locator('[data-testid="cut-order-release-linked-orders"]')
  await expect(linkage).toBeVisible()
  await expect(page.locator('[data-cutting-piece-region="overlay"] [data-testid="cut-order-release-linked-orders"]')).toHaveCount(0)
  const linkageText = await linkage.innerText()
  await expect(page.getByText('预筛：裁片单 CUT14671-B')).toBeVisible()
  await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __cutOrderLayerMain?: Element }).__cutOrderLayerMain = node
  })

  await page.getByRole('button', { name: '列设置' }).click()
  let settings = page.getByRole('heading', { name: '列设置' }).locator('xpath=ancestor::div[contains(@class,"fixed")]')
  await settings.locator('[data-cutting-piece-column-key="material"]').getByLabel('显示').uncheck()
  await expect(linkage).toBeVisible()
  expect(await linkage.innerText()).toBe(linkageText)
  await settings.getByRole('button', { name: '关闭' }).click()
  await expect(linkage).toBeVisible()
  expect(await linkage.innerText()).toBe(linkageText)

  await page.getByRole('button', { name: '列设置' }).click()
  settings = page.getByRole('heading', { name: '列设置' }).locator('xpath=ancestor::div[contains(@class,"fixed")]')
  await expect(settings).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)
  await expect(page.getByText('预筛：裁片单 CUT14671-B')).toBeVisible()
  await expect(linkage).toBeVisible()
  expect(await linkage.innerText()).toBe(linkageText)
  expect(await page.evaluate(() => document.querySelector('main') === (
    window as typeof window & { __cutOrderLayerMain?: Element }
  ).__cutOrderLayerMain)).toBe(true)
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 下宽表仅容器横向滚动且操作列可见`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openList(page)
    const metrics = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>('[data-standard-list-scroll]')!
      const action = document.querySelector<HTMLElement>('[data-standard-list-action-column]')!
      return {
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tableOverflows: scroll.scrollWidth > scroll.clientWidth,
        actionRight: action.getBoundingClientRect().right,
        viewportWidth: window.innerWidth,
      }
    })
    expect(metrics.bodyOverflow).toBeLessThanOrEqual(1)
    expect(metrics.tableOverflows).toBe(true)
    expect(metrics.actionRight).toBeLessThanOrEqual(metrics.viewportWidth)

    await page.locator('[data-standard-list-scroll]').evaluate((node) => {
      node.scrollLeft = node.scrollWidth
    })
    await expect(page.locator('[data-standard-list-action-column]').first()).toBeVisible()
  })
}

test('现有筛选与详情入口迁移后仍可演示', async ({ page }) => {
  await openList(page)
  const firstCutOrderNo = (await page.locator('[data-standard-list-table] tbody tr').first().locator('td').first().innerText())
    .match(/CUT-[\d-]+/)?.[0]
  expect(firstCutOrderNo).toBeTruthy()
  const keyword = page.locator('[data-cutting-piece-field="keyword"]')
  await keyword.fill(firstCutOrderNo!)
  await keyword.press('Enter')
  const rows = page.locator('[data-standard-list-table] tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(firstCutOrderNo!)

  await rows.first().getByRole('button', { name: '查看详情' }).click()
  await expect(page.locator('[data-testid="cut-order-detail-page"]')).toBeVisible()
  await expect(page.getByText('裁片单详情', { exact: true })).toBeVisible()
})

test('历史补料投影只新增 CUT14671-B 且不臆造任务边界', async ({ page }) => {
  await openList(page)
  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-A')
  await expect(cutOrderRow(page, 'CUT14671-A')).toHaveCount(0)
  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-B')
  const row = cutOrderRow(page, 'CUT14671-B')
  await expect(row).toHaveCount(1)
  const headers = await page.locator('[data-standard-list-table] thead th').allTextContents()
  const boundaryIndex = headers.findIndex((header) => header.includes('任务边界'))
  expect(boundaryIndex).toBeGreaterThanOrEqual(0)
  const boundaryCell = row.locator('td').nth(boundaryIndex)
  await expect(boundaryCell).not.toContainText('独立裁片任务')
  await expect(boundaryCell).not.toContainText('回我方裁片仓')
  await expect(boundaryCell).not.toContainText('回货后生成后续工艺单')
  await expect(boundaryCell).toContainText(/未提供|—/)
})

test('历史裁片单数量未知时不展示为真实零值', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  const headers = await page.locator('[data-standard-list-table] thead th').allTextContents()
  const patternCell = row.locator('td').nth(headers.findIndex((header) => header.includes('纸样')))
  const quantityCell = row.locator('td').nth(headers.findIndex((header) => header.includes('数量账')))
  await expect(patternCell).toContainText('有效幅宽：未提供')
  await expect(quantityCell).toContainText('未提供')
  await expect(row).not.toContainText('0厘米')
  await expect(row).not.toContainText('0 件')
  await expect(row).not.toContainText('需求用量：0 米')
})

test('冷启动直达裁片单可逐张查看并完成关联补料单', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  let row = cutOrderRow(page, 'CUT14671-B')
  await expect(row.getByRole('button', { name: '补 · 第 1 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: /^补 · 第/ })).toHaveCount(3)
  await expect(row.getByRole('button', { name: /第 4 次/ })).toHaveCount(0)
  await expect(row.getByText(/补\s*×\s*3/)).toHaveCount(0)

  await page.reload()
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  row = cutOrderRow(page, 'CUT14671-B')
  await expect(row.getByRole('button', { name: /^补 · 第/ })).toHaveCount(3)
  await expect(row.getByRole('button', { name: /第 4 次/ })).toHaveCount(0)

  const main = page.locator('main')
  await main.evaluate((node) => {
    ;(window as typeof window & { __supplementCutOrderMain?: Element }).__supplementCutOrderMain = node
  })
  const statusColumnIndex = await page.locator('th[data-column-key="status"]').evaluate((header) =>
    [...(header.parentElement?.children || [])].indexOf(header),
  )
  const mainStageBefore = await row.locator('td').nth(statusColumnIndex).innerText()
  await row.getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await expect(detail.getByRole('heading', { name: '补料单详情' })).toBeVisible()
  await expect(detail).toContainText('SUP-CUT14671-B-002')
  await expect(detail).toContainText('CUT14671-B')
  await expect(detail).toContainText('PO14671')
  await expect(detail).toContainText('第 2 次')
  await expect(detail.getByText('未完成', { exact: true })).toBeVisible()
  await expect(detail).toContainText('尺码齐套不足')
  await expect(detail).toContainText('明细摘要')
  await expect(detail).toContainText('总补料数量')
  await expect(detail).toContainText('裁床主管 王敏')
  await expect(detail).toContainText('尚未完成')
  await detail.getByRole('button', { name: '完成该补料单' }).click()

  const confirm = page.locator('[data-cutting-piece-supplement-confirm]')
  await expect(confirm).toContainText('SUP-CUT14671-B-002')
  await page.evaluate(() => {
    const regionNames = ['filters', 'filter-state', 'pagination', 'feedback'] as const
    const win = window as typeof window & {
      __supplementStableRegions?: Record<string, Element | null>
      __supplementStableRegionObservers?: MutationObserver[]
      __supplementStableRegionMutations?: Record<string, number>
    }
    win.__supplementStableRegions = Object.fromEntries(regionNames.map((name) => [
      name,
      document.querySelector(`[data-cutting-piece-region="${name}"]`),
    ]))
    win.__supplementStableRegionMutations = Object.fromEntries(regionNames.map((name) => [name, 0]))
    win.__supplementStableRegionObservers = regionNames.map((name) => {
      const observer = new MutationObserver((records) => {
        win.__supplementStableRegionMutations![name] += records.length
      })
      const node = win.__supplementStableRegions![name]
      if (node) observer.observe(node, { childList: true, subtree: true, characterData: true })
      return observer
    })
  })
  const responseMs = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const table = document.querySelector('[data-cutting-piece-region="table"]')
    const button = document.querySelector<HTMLButtonElement>('[data-cutting-piece-action="confirm-complete-supplement"]')
    if (!table || !button) return reject(new Error('缺少裁片单补料完成验收节点'))
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      if (!table.textContent?.includes('补 · 第 2 次 · 已完成')) return
      observer.disconnect()
      resolve(performance.now() - startedAt)
    })
    observer.observe(table, { childList: true, subtree: true })
    button.click()
  }))
  console.log(`裁片单详情完成补料局部响应：${responseMs.toFixed(1)}ms`)
  expect(responseMs).toBeLessThan(200)
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成', exact: true })).toBeVisible()
  await expect(row.locator('td').nth(statusColumnIndex)).toHaveText(mainStageBefore)
  expect(await page.evaluate(() => document.querySelector('main') === (
    window as typeof window & { __supplementCutOrderMain?: Element }
  ).__supplementCutOrderMain)).toBe(true)
  const stableRegions = await page.evaluate(() => {
    const win = window as typeof window & {
      __supplementStableRegions?: Record<string, Element | null>
      __supplementStableRegionObservers?: MutationObserver[]
      __supplementStableRegionMutations?: Record<string, number>
    }
    Object.keys(win.__supplementStableRegionMutations || {}).forEach((name, index) => {
      win.__supplementStableRegionMutations![name] += win.__supplementStableRegionObservers?.[index]?.takeRecords().length || 0
    })
    return Object.fromEntries(Object.entries(win.__supplementStableRegions || {}).map(([name, node]) => [
      name,
      node === document.querySelector(`[data-cutting-piece-region="${name}"]`),
    ])) as Record<string, boolean>
  })
  expect(stableRegions).toEqual({ filters: true, 'filter-state': true, pagination: true, feedback: true })
  expect(await page.evaluate(() => (
    window as typeof window & { __supplementStableRegionMutations?: Record<string, number> }
  ).__supplementStableRegionMutations)).toEqual({ filters: 0, 'filter-state': 0, pagination: 0, feedback: 0 })

  await page.locator('[data-cutting-piece-supplement-detail]').getByRole('button', { name: '关闭' }).click()
  await row.getByRole('button', { name: '补 · 第 1 次 · 已完成', exact: true }).click()
  await expect(page.locator('[data-cutting-piece-supplement-detail]').getByRole('button', { name: '完成该补料单' })).toHaveCount(0)
})

test('补料确认 Esc 逐层关闭且保留底层详情', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  await row.getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await detail.getByRole('button', { name: '完成该补料单' }).click()
  await expect(page.locator('[data-cutting-piece-supplement-confirm]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-cutting-piece-supplement-confirm]')).toHaveCount(0)
  await expect(detail).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(page.getByText('预筛：裁片单 CUT14671-B')).toBeVisible()
})

test('补料弹层初始聚焦、Tab 圈定并在关闭后恢复触发点', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const trigger = cutOrderRow(page, 'CUT14671-B').getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true })
  await trigger.focus()
  await trigger.click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await expect(detail.getByRole('button', { name: '关闭' })).toBeFocused()
  const lastButton = detail.getByRole('button', { name: '完成该补料单' })
  await lastButton.focus()
  await page.keyboard.press('Tab')
  await expect(detail.getByRole('button', { name: '关闭' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('详情确认层取消或 Escape 后焦点返回详情完成按钮', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  await cutOrderRow(page, 'CUT14671-B').getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  const requestComplete = detail.getByRole('button', { name: '完成该补料单' })

  await requestComplete.click()
  await page.keyboard.press('Escape')
  await expect(requestComplete).toBeFocused()

  await requestComplete.click()
  await page.locator('[data-cutting-piece-supplement-confirm]').getByRole('button', { name: '取消' }).click()
  await expect(requestComplete).toBeFocused()
})

test('详情确认完成后焦点保留在已更新的详情内', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  await cutOrderRow(page, 'CUT14671-B').getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await detail.getByRole('button', { name: '完成该补料单' }).click()
  await page.locator('[data-cutting-piece-supplement-confirm]').getByRole('button', { name: '确认完成' }).click()
  await expect(detail.getByRole('button', { name: '关闭' })).toBeFocused()
  await expect(page.locator('body')).not.toBeFocused()
})

test('操作栏补料选择层取消、完成及末单完成均有可靠焦点返回', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  let trigger = row.getByRole('button', { name: '完成补料', exact: true })

  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.locator('[data-cutting-piece-supplement-picker]').getByRole('button', { name: '取消' }).click()
  await expect(trigger).toBeFocused()

  await trigger.click()
  let picker = page.locator('[data-cutting-piece-supplement-picker]')
  await picker.getByRole('radio', { name: /第 2 次/ }).check()
  await picker.getByRole('button', { name: '确认完成' }).click()
  trigger = row.getByRole('button', { name: '完成补料', exact: true })
  await expect(trigger).toBeFocused()

  await trigger.click()
  picker = page.locator('[data-cutting-piece-supplement-picker]')
  await picker.getByRole('radio', { name: /第 3 次/ }).check()
  await picker.getByRole('button', { name: '确认完成' }).click()
  await expect(trigger).toHaveCount(0)
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 已完成', exact: true })).toBeFocused()
  await expect(page.locator('body')).not.toBeFocused()
})

test('同值 change 不吞补料点击且单一事件通道只打开一次', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-cutting-piece-field="keyword"]').evaluate((input) => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const overlay = page.locator('[data-cutting-piece-region="overlay"]')
  const mutationCount = await page.evaluate(() => new Promise<number>((resolve) => {
    const region = document.querySelector('[data-cutting-piece-region="overlay"]')!
    let mutations = 0
    const observer = new MutationObserver((records) => { mutations += records.length })
    observer.observe(region, { childList: true })
    document.querySelector<HTMLButtonElement>('[aria-label="补 · 第 2 次 · 未完成"]')!.click()
    requestAnimationFrame(() => {
      observer.disconnect()
      resolve(mutations)
    })
  }))
  await expect(overlay.locator('[data-cutting-piece-supplement-detail]')).toHaveCount(1)
  expect(mutationCount).toBe(1)
  const source = readFileSync('src/pages/process-factory/cutting/cut-orders.ts', 'utf8')
  expect(source).not.toContain('bindCutOrderSupplementInteractions')
})

test('同一确认快速触发两次只完成当前补料并安全清理 pending', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  await row.getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  await page.locator('[data-cutting-piece-supplement-detail]').getByRole('button', { name: '完成该补料单' }).click()
  await page.locator('[data-cutting-piece-action="confirm-complete-supplement"]').evaluate((button) => {
    ;(button as HTMLButtonElement).click()
    ;(button as HTMLButtonElement).click()
  })
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成', exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-piece-supplement-confirm]')).toHaveCount(0)
  await expect(page.locator('[data-cutting-piece-supplement-feedback]')).toHaveText('已完成补料单 SUP-CUT14671-B-002，裁片单主状态保持不变。')
})

test('同一 SPA 会话完成补料后跨页面共享状态且序号不增长', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  let row = cutOrderRow(page, 'CUT14671-B')
  await row.getByRole('button', { name: '补 · 第 2 次 · 未完成', exact: true }).click()
  await page.locator('[data-cutting-piece-supplement-detail]').getByRole('button', { name: '完成该补料单' }).click()
  await page.locator('[data-cutting-piece-supplement-confirm]').getByRole('button', { name: '确认完成' }).click()
  await page.locator('[data-cutting-piece-supplement-detail]').getByRole('button', { name: '关闭' }).click()
  await page.getByRole('button', { name: '裁后处理', exact: true }).click()
  await page.getByRole('button', { name: '补料管理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '补料管理' })).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-cutting-supplement-field="keyword"]').fill('SUP-CUT14671-B-002')
  const supplementRow = page.locator('[data-standard-list-table-section] tbody tr').filter({ hasText: 'SUP-CUT14671-B-002' })
  await expect(supplementRow).toHaveCount(1)
  await expect(supplementRow).toContainText('已完成')

  await page.getByRole('button', { name: '裁前准备', exact: true }).click()
  await page.getByRole('complementary').getByRole('button', { name: '裁片单', exact: true }).click()
  await expect(page.getByRole('heading', { name: '裁片单', exact: true })).toBeVisible({ timeout: 30_000 })
  row = await findCutOrderRow(page, 'CUT14671-B')
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: /^补 · 第/ })).toHaveCount(3)
  await expect(row.getByRole('button', { name: /第 4 次/ })).toHaveCount(0)
})

test('操作栏一次只完成一张未完成补料且全部完成后动作消失', async ({ page }) => {
  await openList(page)
  const row = await findCutOrderRow(page, 'CUT14671-B')
  await page.locator('[data-cutting-piece-field="supplementCompletion"]').selectOption('HAS_INCOMPLETE')
  const pagination = page.locator('[data-cutting-piece-region="pagination"]')
  await pagination.evaluate((node) => {
    const win = window as typeof window & { __supplementFilteredPagination?: Element; __supplementPaginationMutations?: number }
    win.__supplementFilteredPagination = node
    win.__supplementPaginationMutations = 0
    new MutationObserver((records) => { win.__supplementPaginationMutations! += records.length })
      .observe(node, { childList: true, subtree: true, characterData: true })
  })
  const scroll = page.locator('[data-standard-list-scroll]')
  await scroll.evaluate((node) => { node.scrollLeft = 180 })
  await row.getByRole('button', { name: '完成补料', exact: true }).click()
  const dialog = page.locator('[data-cutting-piece-supplement-picker]')
  await expect(dialog.getByRole('heading', { name: '完成补料' })).toBeVisible()
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await expect(dialog).not.toContainText('SUP-CUT14671-B-001')
  const submit = dialog.getByRole('button', { name: '确认完成' })
  await expect(submit).toBeDisabled()
  const second = dialog.getByRole('radio', { name: /第 2 次.*SUP-CUT14671-B-002/ })
  await second.click()
  await second.click({ force: true })
  await expect(second).toBeChecked()
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成', exact: true })).toBeVisible()
  expect(await scroll.evaluate((node) => node.scrollLeft)).toBe(180)

  await row.getByRole('button', { name: '完成补料', exact: true }).click()
  await expect(page.locator('[data-cutting-piece-supplement-picker]').getByRole('radio')).toHaveCount(1)
  await page.locator('[data-cutting-piece-supplement-picker]').getByRole('radio').check()
  await page.locator('[data-cutting-piece-supplement-picker]').getByRole('button', { name: '确认完成' }).click()
  await expect(row).toHaveCount(0)
  await expect(page.locator('[data-cutting-piece-region="table"]')).toContainText('当前条件下暂无裁片单')
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('裁片单总数')
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('0')
  await expect(pagination).toContainText('共 0 条')
  await expect(pagination).toContainText('1 / 1')
  expect(await page.evaluate(() => document.querySelector('[data-cutting-piece-region="pagination"]') === (
    window as typeof window & { __supplementFilteredPagination?: Element }
  ).__supplementFilteredPagination)).toBe(true)
  expect(await page.evaluate(() => (
    window as typeof window & { __supplementPaginationMutations?: number }
  ).__supplementPaginationMutations)).toBeGreaterThan(0)
})

test('补料完成导致跨页 clamp 时表格分页同步且滚动稳定', async ({ page }) => {
  await openList(page)
  const seeded = await page.evaluate(async () => {
    const [{ buildCutOrderViewModel }, { cuttingOrderProgressRecords }, registry] = await Promise.all([
      import('/src/pages/process-factory/cutting/cut-orders-model.ts'),
      import('/src/data/fcs/cutting/order-progress.ts'),
      import('/src/data/fcs/cutting/supplement-order-registry.ts'),
    ])
    const rows = buildCutOrderViewModel(cuttingOrderProgressRecords).rows
    const candidates = [...new Map(rows
      .filter((row) => row.cutOrderNo.localeCompare('CUT14671-B', 'zh-CN') < 0)
      .map((row) => [row.cutOrderId, row])).values()].slice(0, 10)
    candidates.forEach((row, index) => registry.registerSupplementOrder({
      id: `pagination-supplement-${index}`,
      recordNo: `SUP-PAGE-${String(index + 1).padStart(2, '0')}`,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderNo: row.productionOrderNo,
      reason: '分页联动验收',
      totalQty: 1,
      lineSummary: '验收补料 1 件',
      createdAt: '2026-07-22 13:00',
      createdBy: '测试主管',
    }))
    return candidates.length
  })
  expect(seeded).toBe(10)
  await page.locator('[data-cutting-piece-field="supplementCompletion"]').selectOption('HAS_INCOMPLETE')
  const cutOrderHeader = page.locator('th[data-column-key="cutOrder"]')
  await cutOrderHeader.getByRole('button').click()
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('2 / 2')
  const row = cutOrderRow(page, 'CUT14671-B')
  await expect(row).toHaveCount(1)
  const scroll = page.locator('[data-standard-list-scroll]')
  await scroll.evaluate((node) => { node.scrollLeft = 180 })
  for (let remaining = 2; remaining >= 1; remaining -= 1) {
    await row.getByRole('button', { name: '完成补料', exact: true }).click()
    const picker = page.locator('[data-cutting-piece-supplement-picker]')
    await picker.getByRole('radio').first().check()
    const responseMs = await picker.getByRole('button', { name: '确认完成' }).evaluate(async (button) => {
      const startedAt = performance.now()
      ;(button as HTMLButtonElement).click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      return performance.now() - startedAt
    })
    expect(responseMs).toBeLessThan(200)
    if (remaining === 2) await expect(row).toHaveCount(1)
  }
  await expect(row).toHaveCount(0)
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('1 / 1')
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('共 10 条')
  await expect(page.locator('[data-standard-list-table] tbody tr')).toHaveCount(10)
  expect(await scroll.evaluate((node) => node.scrollLeft)).toBe(180)
})

test('补料存在性和完成状态筛选遵守无补料边界并局部刷新', async ({ page }) => {
  await openList(page)
  await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __supplementFilterMain?: Element }).__supplementFilterMain = node
  })
  const hasSupplement = page.locator('[data-cutting-piece-field="hasSupplement"]')
  const completion = page.locator('[data-cutting-piece-field="supplementCompletion"]')
  await expect(hasSupplement.locator('option')).toHaveText(['全部', '有补料', '无补料'])
  await expect(completion.locator('option')).toHaveText(['全部', '有未完成', '全部已完成'])

  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-B')
  await completion.selectOption('HAS_INCOMPLETE')
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(1)
  const incompleteRows = page.locator('[data-standard-list-table] tbody tr')
  expect(await incompleteRows.count()).toBeGreaterThan(0)
  for (const row of await incompleteRows.all()) await expect(row).toContainText('未完成')
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible()

  await hasSupplement.selectOption('NO')
  await expect(completion).toHaveValue('ALL')
  await expect(completion).toBeDisabled()
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(0)
  for (const row of await page.locator('[data-standard-list-table] tbody tr').all()) {
    await expect(row.getByRole('button', { name: /^补 ·/ })).toHaveCount(0)
  }

  await hasSupplement.selectOption('YES')
  await expect(completion).toBeEnabled()
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(1)
  expect(await page.evaluate(() => document.querySelector('main') === (
    window as typeof window & { __supplementFilterMain?: Element }
  ).__supplementFilterMain)).toBe(true)
})
