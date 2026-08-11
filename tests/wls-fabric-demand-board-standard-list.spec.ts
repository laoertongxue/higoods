import { expect, test, type Page } from '@playwright/test'

const ROUTE = '/wls/fabric-demand-board'
const ROOT = '[data-wls-fabric-demand-board-root]'
const PREFERENCE_KEY = '/wls/fabric-demand-board:list-columns'

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text())
  })
  return errors
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((preferenceKey) => localStorage.removeItem(preferenceKey), PREFERENCE_KEY)
})

test('面料需求看板使用标准列表且分页、筛选、排序和列设置均不整页重绘', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(ROUTE)

  const root = page.locator(ROOT)
  await expect(root).toBeVisible()
  await expect(root.locator('[data-standard-list-page]')).toBeVisible()
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(5)

  await page.evaluate(({ rootSelector }) => {
    const stableWindow = window as typeof window & {
      __wlsFabricDemandStable?: { main: Element | null; root: Element | null; tableSection: Element | null }
    }
    const listRoot = document.querySelector(rootSelector)
    stableWindow.__wlsFabricDemandStable = {
      main: document.querySelector('main'),
      root: listRoot,
      tableSection: listRoot?.querySelector('[data-standard-list-table-section]') ?? null,
    }
  }, { rootSelector: ROOT })

  await root.locator('[data-fabric-demand-list-field="pageSize"]').selectOption('10')
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(6)

  const materialSort = root.locator('th[data-column-key="material"] button')
  await materialSort.click()
  await expect(materialSort.locator('[data-standard-list-sort-icon="asc"]')).toBeVisible()

  await root.locator('[data-fabric-demand-filter="keyword"]').fill('FAB-2026-031-PRT')
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(1)
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toContainText('FAB-2026-031-PRT')

  await root.getByRole('button', { name: '重置', exact: true }).click()
  await expect(root.locator('[data-fabric-demand-filter="keyword"]')).toHaveValue('')
  await expect(root.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(6)

  await root.getByRole('button', { name: '列设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '面料需求看板列设置' })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: '面料需求看板列设置' })).toHaveCount(0)

  await root.locator('[data-fabric-demand-action="preview-image"]').first().click()
  const imagePreview = page.locator('[data-wls-fabric-demand-image-preview]')
  await expect(imagePreview).toBeVisible()
  await expect(imagePreview.locator('img')).toHaveAttribute('alt', /高清大图$/)
  await page.keyboard.press('Escape')
  await expect(imagePreview).toHaveCount(0)

  const stability = await page.evaluate(({ rootSelector }) => {
    const stableWindow = window as typeof window & {
      __wlsFabricDemandStable?: { main: Element | null; root: Element | null; tableSection: Element | null }
    }
    const before = stableWindow.__wlsFabricDemandStable
    const listRoot = document.querySelector(rootSelector)
    return {
      mainSame: Boolean(before && document.querySelector('main') === before.main),
      rootSame: Boolean(before && listRoot === before.root),
      tableSectionSame: Boolean(before && listRoot?.querySelector('[data-standard-list-table-section]') === before.tableSection),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tableScrollsInternally: Array.from(listRoot?.querySelectorAll<HTMLElement>('[data-standard-list-scroll]') ?? [])
        .some((node) => node.scrollWidth > node.clientWidth),
    }
  }, { rootSelector: ROOT })

  expect(stability).toEqual({
    mainSame: true,
    rootSame: true,
    tableSectionSame: true,
    pageOverflow: 0,
    tableScrollsInternally: true,
  })
  expect(runtimeErrors).toEqual([])
})
