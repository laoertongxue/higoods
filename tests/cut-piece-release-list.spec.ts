import { expect, test, type Locator, type Page } from '@playwright/test'

const route = '/fcs/craft/cutting/cut-piece-release'
const storageKey = 'higood:list-page:/fcs/craft/cutting/cut-piece-release'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.addInitScript((key) => {
    const resetKey = `${key}:test-reset`
    if (!window.sessionStorage.getItem(resetKey)) {
      window.localStorage.removeItem(key)
      window.sessionStorage.setItem(resetKey, 'true')
    }
  }, storageKey)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()
  await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
  const input = page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })
  await expect(async () => {
    await input.fill('__交互就绪检查__')
    await input.press('Enter')
    await expect(page.getByText('当前筛选范围暂无裁片放行生产单。')).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
}

async function rememberPageRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseRoot?: Element }
    const root = document.querySelector('[data-cut-piece-release-page]')
    if (!root) throw new Error('缺少裁片放行页面根节点')
    acceptanceWindow.__cutPieceReleaseRoot = root
  })
}

async function expectPageRootStable(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseRoot?: Element }
    return document.querySelector('[data-cut-piece-release-page]') === acceptanceWindow.__cutPieceReleaseRoot
  })).toBe(true)
}

function header(page: Page, columnKey: string): Locator {
  return page.locator(`th[data-column-key="${columnKey}"]`)
}

function settingRow(page: Page, columnKey: string): Locator {
  return page.locator(`[data-standard-list-column-key="${columnKey}"]`)
}

async function headerOrder(page: Page): Promise<string[]> {
  return page.locator('th[data-column-key]').evaluateAll((headers) =>
    headers.map((item) => item.getAttribute('data-column-key') || ''),
  )
}

test('关键词草稿不重绘，点击或 Enter 查询及重置只刷新列表区域', async ({ page }) => {
  await openList(page)
  await rememberPageRoot(page)
  const input = page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })

  await input.fill('不存在')
  await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
  await expectPageRootStable(page)

  await input.press('Enter')
  await expect(page.getByText('当前筛选范围暂无裁片放行生产单。')).toBeVisible()
  await expectPageRootStable(page)

  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
  await expect(input).toHaveValue('')
  await expectPageRootStable(page)

  await input.fill('PO14671')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
  await expectPageRootStable(page)
})

test('排序具备未排序升序降序三态，打开矩阵反馈不替换页面根节点', async ({ page }) => {
  await openList(page)
  await rememberPageRoot(page)
  const productionOrderHeader = header(page, 'productionOrder')
  const sortButton = productionOrderHeader.getByRole('button')

  await expect(productionOrderHeader).toHaveAttribute('aria-sort', 'none')
  await sortButton.click()
  await expect(productionOrderHeader).toHaveAttribute('aria-sort', 'ascending')
  await sortButton.click()
  await expect(productionOrderHeader).toHaveAttribute('aria-sort', 'descending')
  await sortButton.click()
  await expect(productionOrderHeader).toHaveAttribute('aria-sort', 'none')
  await expectPageRootStable(page)

  await page.getByRole('button', { name: '打开矩阵' }).click()
  await expect(page.getByText('已选中生产单 PO14671 的裁片矩阵。')).toBeVisible()
  await expectPageRootStable(page)
})

test('列设置图标、显示、冻结、拖拽与路由级偏好均真实生效', async ({ page }) => {
  await openList(page)
  await rememberPageRoot(page)
  await page.getByRole('button', { name: '列设置' }).click()
  const overlay = page.locator('[data-cut-piece-release-region="overlay"]')
  await expect(page.getByRole('heading', { name: '列设置' })).toBeVisible()
  await expect(overlay.locator('svg[data-lucide="x"]')).toBeVisible()
  await expect(overlay.locator('svg[data-lucide="grip-vertical"]')).toHaveCount(8)
  await expect(overlay.locator('i[data-lucide]')).toHaveCount(0)

  await settingRow(page, 'spu').getByRole('checkbox', { name: '显示' }).uncheck()
  await expect(header(page, 'spu')).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}') as { visibleKeys?: string[] }
    return stored.visibleKeys?.includes('spu') ?? true
  }, storageKey)).toBe(false)

  await settingRow(page, 'productionOrder').getByRole('checkbox', { name: '冻结' }).check()
  await expect(header(page, 'productionOrder')).toHaveClass(/left-0/)
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}') as { frozenKeys?: string[] }
    return stored.frozenKeys?.includes('productionOrder') ?? false
  }, storageKey)).toBe(true)

  const targetStatusRow = settingRow(page, 'targetStatus')
  const colorSizeRow = settingRow(page, 'colorSize')
  await targetStatusRow.dragTo(colorSizeRow)
  await expect.poll(() => headerOrder(page)).toEqual([
    'productionOrder',
    'targetStatus',
    'colorSize',
    'matrixStatus',
    'shortage',
    'frozenCutOrders',
    'latestUpdate',
    'actions',
  ])
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}') as { order?: string[] }
    return stored.order ?? []
  }, storageKey)).toEqual([
    'productionOrder',
    'spu',
    'targetStatus',
    'colorSize',
    'matrixStatus',
    'shortage',
    'frozenCutOrders',
    'latestUpdate',
    'actions',
  ])
  await expectPageRootStable(page)

  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('heading', { name: '列设置' })).toHaveCount(0)
  await page.reload()
  await expect(header(page, 'spu')).toHaveCount(0)
  await expect(header(page, 'productionOrder')).toHaveClass(/left-0/)
  expect(await headerOrder(page)).toEqual([
    'productionOrder',
    'targetStatus',
    'colorSize',
    'matrixStatus',
    'shortage',
    'frozenCutOrders',
    'latestUpdate',
    'actions',
  ])
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`裁片放行列表在 ${viewport.width}×${viewport.height} 不产生页面横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openList(page)
    const overflow = await page.evaluate(() => ({
      body: [document.body.scrollWidth, document.body.clientWidth],
      document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    }))
    expect(overflow.body[0]).toBe(overflow.body[1])
    expect(overflow.document[0]).toBe(overflow.document[1])
    await expect(page.getByRole('button', { name: '打开矩阵' })).toBeVisible()
    const tableScroll = page.locator('[data-standard-list-scroll]')
    const tableOverflow = await tableScroll.evaluate((element) => [element.scrollWidth, element.clientWidth])
    expect(tableOverflow[0]).toBeGreaterThan(tableOverflow[1])
  })
}
