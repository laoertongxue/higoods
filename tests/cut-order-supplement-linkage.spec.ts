import { expect, test, type Page } from '@playwright/test'

const route = '/fcs/craft/cutting/cut-orders'
const storageKey = 'higood:list-page:/fcs/craft/cutting/cut-orders'

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
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
