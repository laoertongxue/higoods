import { expect, test, type Locator, type Page } from '@playwright/test'

const route = '/fcs/craft/cutting/supplement-management'
const storageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.addInitScript((key) => {
    const resetMarker = '__supplementListAcceptanceReset'
    if (window.sessionStorage.getItem(resetMarker)) return
    window.localStorage.removeItem(key)
    window.sessionStorage.setItem(resetMarker, 'true')
  }, storageKey)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function waitForList(page: Page): Promise<void> {
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await waitForList(page)
}

async function rememberStableRegions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector('main')
    const stats = document.querySelector('[data-cutting-supplement-region="stats"]')
    const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
    if (!main || !stats || !pagination) throw new Error('缺少列表局部刷新验收区域')
    const acceptanceWindow = window as typeof window & {
      __supplementAcceptance?: {
        main: Element
        stats: Element
        pagination: Element
        statsMutations: number
        paginationMutations: number
      }
    }
    acceptanceWindow.__supplementAcceptance = {
      main,
      stats,
      pagination,
      statsMutations: 0,
      paginationMutations: 0,
    }
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementAcceptance) {
        acceptanceWindow.__supplementAcceptance.statsMutations += records.length
      }
    }).observe(stats, { attributes: true, childList: true, characterData: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementAcceptance) {
        acceptanceWindow.__supplementAcceptance.paginationMutations += records.length
      }
    }).observe(pagination, { attributes: true, childList: true, characterData: true, subtree: true })
  })
}

async function stableRegionResult(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __supplementAcceptance?: {
        main: Element
        stats: Element
        pagination: Element
        statsMutations: number
        paginationMutations: number
      }
    }).__supplementAcceptance
    if (!state) throw new Error('缺少列表局部刷新验收状态')
    return {
      mainSame: document.querySelector('main') === state.main,
      statsSame: document.querySelector('[data-cutting-supplement-region="stats"]') === state.stats,
      paginationSame: document.querySelector('[data-cutting-supplement-region="pagination"]') === state.pagination,
      statsMutations: state.statsMutations,
      paginationMutations: state.paginationMutations,
    }
  })
}

function tableHeaders(page: Page): Locator {
  return page.locator('[data-standard-list-table-section] thead th[data-column-key]')
}

async function headerOrder(page: Page): Promise<(string | null)[]> {
  return tableHeaders(page).evaluateAll((headers) => headers.map((header) => header.getAttribute('data-column-key')))
}

async function openColumnSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '列设置' }).click()
  await expect(page.getByRole('heading', { name: '列设置' })).toBeVisible()
}

function settingRow(page: Page, columnKey: string): Locator {
  return page.locator(`[data-standard-list-column-key="${columnKey}"]`)
}

async function visibleBox(locator: Locator, label: string) {
  await expect(locator, `${label}必须可见`).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label}必须有可测量的边界`).not.toBeNull()
  return box!
}

async function rememberFilterRefreshBoundary(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector('main')
    const stats = document.querySelector('[data-cutting-supplement-region="stats"]')
    const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
    const overlay = document.querySelector('[data-cutting-supplement-region="overlay"]')
    if (!main || !stats || !pagination || !overlay) throw new Error('缺少筛选刷新边界验收区域')
    const acceptanceWindow = window as typeof window & {
      __supplementFilterBoundary?: {
        main: Element
        statsMutations: number
        paginationMutations: number
        overlay: Element
        overlayMutations: number
      }
    }
    acceptanceWindow.__supplementFilterBoundary = {
      main,
      statsMutations: 0,
      paginationMutations: 0,
      overlay,
      overlayMutations: 0,
    }
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.statsMutations += records.length
      }
    }).observe(stats, { childList: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.paginationMutations += records.length
      }
    }).observe(pagination, { childList: true, subtree: true })
    new MutationObserver((records) => {
      if (acceptanceWindow.__supplementFilterBoundary) {
        acceptanceWindow.__supplementFilterBoundary.overlayMutations += records.length
      }
    }).observe(overlay, { attributes: true, childList: true, characterData: true, subtree: true })
  })
}

async function filterRefreshBoundaryResult(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __supplementFilterBoundary?: {
        main: Element
        statsMutations: number
        paginationMutations: number
        overlay: Element
        overlayMutations: number
      }
    }).__supplementFilterBoundary
    if (!state) throw new Error('缺少筛选刷新边界验收状态')
    return {
      mainSame: document.querySelector('main') === state.main,
      statsMutations: state.statsMutations,
      paginationMutations: state.paginationMutations,
      overlaySame: document.querySelector('[data-cutting-supplement-region="overlay"]') === state.overlay,
      overlayMutations: state.overlayMutations,
    }
  })
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`补料管理模板在 ${viewport.width}×${viewport.height} 无页面横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openList(page)

    await expect(page.getByText('工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理')).toHaveCount(0)
    await expect(page.getByText('列表对象是补料单；新增补料填写后会弹窗确认。')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增补料' })).toBeVisible()
    await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
    await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('10')
    await expect(page.getByRole('button', { name: '下一页' })).toBeVisible()

    const overflow = await page.evaluate(() => ({
      body: [document.body.scrollWidth, document.body.clientWidth],
      document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    }))
    expect(overflow.body[0]).toBe(overflow.body[1])
    expect(overflow.document[0]).toBe(overflow.document[1])
    const tableScroll = page.locator('[data-standard-list-scroll]')
    const tableOverflow = await tableScroll.evaluate((element) => [element.scrollWidth, element.clientWidth])
    expect(tableOverflow[0]).toBeGreaterThan(tableOverflow[1])
  })
}

test('默认分页、三态排序及临时状态刷新后回到默认', async ({ page }) => {
  await openList(page)
  await rememberStableRegions(page)

  const rows = page.locator('[data-standard-list-table-section] tbody tr')
  await expect(rows).toHaveCount(10)
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  const defaultFirstRecord = (await rows.first().locator('td').first().innerText()).trim()

  const firstClickDuration = await page.evaluate((targetRecordNo) => new Promise<number>((resolve, reject) => {
    const table = document.querySelector('[data-cutting-supplement-region="table"]')
    const next = document.querySelector<HTMLButtonElement>('[data-cutting-supplement-action="next-page"]')
    if (!table || !next) {
      reject(new Error('缺少首次翻页性能验收元素'))
      return
    }
    requestAnimationFrame(() => {
      const startedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (!table.textContent?.includes(targetRecordNo)) return
        observer.disconnect()
        resolve(performance.now() - startedAt)
      })
      observer.observe(table, { childList: true, subtree: true })
      next.click()
    })
  }), 'SUP-030002-011')
  expect(firstClickDuration).toBeLessThan(200)
  console.log(`首次下一页实际 DOM 响应：${firstClickDuration.toFixed(1)}ms`)
  await expect(rows).toHaveCount(2)
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  let stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)

  await page.getByRole('button', { name: '上一页' }).click()
  const quantityHeader = page.locator('th[data-column-key="supplementQty"]')
  const quantitySort = quantityHeader.getByRole('button')
  const quantityColumnIndex = await tableHeaders(page).evaluateAll(
    (headers) => headers.findIndex((header) => header.getAttribute('data-column-key') === 'supplementQty'),
  )
  const quantities = async () => rows.locator(`td:nth-child(${quantityColumnIndex + 1})`).evaluateAll((cells) =>
    cells.map((cell) => Number(cell.textContent?.replace(/\D/g, '') ?? '0')),
  )

  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending')
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => a - b))
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'descending')
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => b - a))
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'none')
  await expect(rows.first().locator('td').first()).toContainText(defaultFirstRecord)

  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending')
  await quantitySort.click()
  await expect(quantityHeader).toHaveAttribute('aria-sort', 'descending')
  expect(await quantities()).toEqual([...await quantities()].sort((a, b) => b - a))

  await page.getByRole('button', { name: '下一页' }).click()
  stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)
  await page.reload()
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.locator('th[data-column-key="supplementQty"]')).toHaveAttribute('aria-sort', 'none')
})

test('筛选与重置改变结果并回到第 1 页，且不刷新无关覆盖层', async ({ page }) => {
  await openList(page)
  const rows = page.locator('[data-standard-list-table-section] tbody tr')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  const targetRecordNo = (await rows.first().locator('td').first().innerText()).trim()
  const targetSourceType = (await rows.first().locator('td').nth(1).innerText()).includes('裁片单')
    ? 'cut-order'
    : 'production-order'

  await rememberFilterRefreshBoundary(page)
  await page.locator('[data-cutting-supplement-field="sourceType"]').selectOption(targetSourceType)
  await page.locator('[data-cutting-supplement-field="keyword"]').fill(targetRecordNo)
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first().locator('td').first()).toContainText(targetRecordNo)
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible()
  await expect(page.locator('[data-standard-list-stats]').getByText('1', { exact: true }).first()).toBeVisible()
  let boundary = await filterRefreshBoundaryResult(page)
  expect(boundary.mainSame).toBe(true)
  expect(boundary.statsMutations).toBeGreaterThan(0)
  expect(boundary.paginationMutations).toBeGreaterThan(0)
  expect(boundary.overlaySame).toBe(true)
  expect(boundary.overlayMutations).toBe(0)

  await rememberFilterRefreshBoundary(page)
  await page.getByRole('button', { name: '重置', exact: true }).click()
  await expect(rows).toHaveCount(10)
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.locator('[data-cutting-supplement-field="sourceType"]')).toHaveValue('ALL')
  await expect(page.locator('[data-cutting-supplement-field="keyword"]')).toHaveValue('')
  boundary = await filterRefreshBoundaryResult(page)
  expect(boundary.mainSame).toBe(true)
  expect(boundary.statsMutations).toBeGreaterThan(0)
  expect(boundary.paginationMutations).toBeGreaterThan(0)
  expect(boundary.overlaySame).toBe(true)
  expect(boundary.overlayMutations).toBe(0)
})

test('列显示、顺序、冻结和每页条数持久化，且列操作只刷新相关区域', async ({ page }) => {
  await openList(page)
  await rememberStableRegions(page)
  await openColumnSettings(page)

  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
  let stability = await stableRegionResult(page)
  expect(stability).toEqual({
    mainSame: true,
    statsSame: true,
    paginationSame: true,
    statsMutations: 0,
    paginationMutations: 0,
  })

  await settingRow(page, 'created').dragTo(settingRow(page, 'recordNo'))
  expect((await headerOrder(page)).slice(0, 2)).toEqual(['created', 'recordNo'])
  stability = await stableRegionResult(page)
  expect(stability).toEqual({
    mainSame: true,
    statsSame: true,
    paginationSame: true,
    statsMutations: 0,
    paginationMutations: 0,
  })

  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('[data-cutting-supplement-field="pageSize"]').selectOption('20')
  await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(12)
  stability = await stableRegionResult(page)
  expect(stability.mainSame).toBe(true)
  expect(stability.statsSame).toBe(true)
  expect(stability.statsMutations).toBe(0)

  const preferences = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey)
  expect(preferences.visibleKeys).not.toContain('processDemand')
  expect(preferences.order.slice(0, 2)).toEqual(['created', 'recordNo'])
  expect(preferences.frozenKeys).toContain('recordNo')
  expect(preferences.pageSize).toBe(20)

  await page.reload()
  await waitForList(page)
  await expect(page.locator('th[data-column-key="processDemand"]')).toHaveCount(0)
  expect((await headerOrder(page)).slice(0, 2)).toEqual(['created', 'recordNo'])
  await expect(page.locator('th[data-column-key="recordNo"]')).toHaveClass(/sticky/)
  await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('20')
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible()
})

test('冻结补料单号和固定操作列在表格横向滚动时坐标稳定', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openList(page)
  await openColumnSettings(page)
  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  const scroll = page.locator('[data-standard-list-scroll]')
  const recordNo = page.locator('th[data-column-key="recordNo"]')
  const actions = page.locator('th[data-column-key="actions"]')
  const scrollBefore = await visibleBox(scroll, '表格横向滚动容器')
  const recordNoBefore = await visibleBox(recordNo, '冻结补料单号表头')
  const actionsBefore = await visibleBox(actions, '固定操作列表头')
  expect(Math.abs(actionsBefore.x + actionsBefore.width - (scrollBefore.x + scrollBefore.width))).toBeLessThanOrEqual(1)
  await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const scrollAfter = await visibleBox(scroll, '滚动后的表格横向滚动容器')
  const recordNoAfter = await visibleBox(recordNo, '滚动后的冻结补料单号表头')
  const actionsAfter = await visibleBox(actions, '滚动后的固定操作列表头')
  expect(Math.abs(recordNoAfter.x - recordNoBefore.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(actionsAfter.x + actionsAfter.width - (scrollAfter.x + scrollAfter.width))).toBeLessThanOrEqual(1)
})

test('恢复默认清除列偏好并保持 main 节点', async ({ page }) => {
  await openList(page)
  await openColumnSettings(page)
  await settingRow(page, 'processDemand').getByLabel('显示').uncheck()
  await settingRow(page, 'created').dragTo(settingRow(page, 'recordNo'))
  await settingRow(page, 'recordNo').getByLabel('冻结').check()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('[data-cutting-supplement-field="pageSize"]').selectOption('20')
  await rememberStableRegions(page)

  await openColumnSettings(page)
  await page.getByRole('button', { name: '恢复默认' }).click()
  await expect(page.locator('th[data-column-key="processDemand"]')).toBeVisible()
  expect(await headerOrder(page)).toEqual([
    'recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions',
  ])
  await expect(page.locator('th[data-column-key="recordNo"]')).not.toHaveClass(/sticky/)
  await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('10')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()
  expect((await stableRegionResult(page)).mainSame).toBe(true)
})
