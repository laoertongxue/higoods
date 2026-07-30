import { expect, test, type Page } from '@playwright/test'

const paths = {
  READY: '/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: '/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: '/fcs/craft/cutting/pickup-management/history',
} as const

test.setTimeout(120_000)

type MeasuredDomAction = {
  type: 'click' | 'input' | 'change' | 'drag'
  triggerSelector: string
  observeSelector: string
  value?: string
  dropSelector?: string
}

async function measureDomAction(page: Page, config: MeasuredDomAction): Promise<number> {
  const elapsed = await page.evaluate((options) => new Promise<number>((resolve, reject) => {
    const trigger = document.querySelector<HTMLElement>(options.triggerSelector)
    const observed = document.querySelector<HTMLElement>(options.observeSelector)
    if (!trigger || !observed) {
      reject(new Error(`交互测量节点不存在：${options.triggerSelector} / ${options.observeSelector}`))
      return
    }
    let timer = 0
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      observer.disconnect()
      window.clearTimeout(timer)
      resolve(performance.now() - startedAt)
    })
    observer.observe(observed, { attributes: true, childList: true, subtree: true })
    if (options.type === 'input' && trigger instanceof HTMLInputElement) {
      trigger.value = options.value || ''
      trigger.dispatchEvent(new Event('input', { bubbles: true }))
    } else if (options.type === 'change' && trigger instanceof HTMLSelectElement) {
      trigger.value = options.value || ''
      trigger.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (options.type === 'drag') {
      const target = document.querySelector<HTMLElement>(options.dropSelector || '')
      if (!target) {
        observer.disconnect()
        reject(new Error(`拖拽目标不存在：${options.dropSelector}`))
        return
      }
      const dataTransfer = new DataTransfer()
      trigger.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
      trigger.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }))
    } else {
      trigger.click()
    }
    timer = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`轻交互 1 秒内没有目标 DOM 变化：${options.triggerSelector}`))
    }, 1_000)
  }), config)
  expect(elapsed, `${config.type} ${config.triggerSelector} 响应耗时`).toBeLessThan(200)
  return elapsed
}

async function resetPickupStores(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    Object.values({
      READY: 'standard-list:/fcs/craft/cutting/pickup-management/ready',
      INCOMPLETE: 'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
      HISTORY: 'standard-list:/fcs/craft/cutting/pickup-management/history',
    }).forEach((key) => localStorage.removeItem(key))
  })
}

test.beforeEach(async ({ page }) => {
  await resetPickupStores(page)
})

for (const [kind, heading] of [
  ['READY', '已配齐待领料'],
  ['INCOMPLETE', '未配齐配料'],
  ['HISTORY', '已领料'],
] as const) {
  test(`${heading}规范路由按生产单展示全部物料事实且无需进入详情`, async ({ page }) => {
    await page.goto(paths[kind])
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 60_000 })
    const firstMaterial = page.locator('[data-pickup-material-row]').first()
    await expect(firstMaterial).toBeVisible({ timeout: 60_000 })
    await expect(firstMaterial.locator('img')).toHaveCount(1)
    await expect(firstMaterial).toContainText(/主面料|斜纹|帆布|半成品/)
    await expect(firstMaterial).toContainText(/tdv_demand_/)
    await expect(firstMaterial).toContainText('应配')
    await expect(firstMaterial).toContainText('累计领料')
    await expect(page.getByText('查看详情', { exact: true })).toHaveCount(0)
  })
}

test('未配齐稳定组精确展示同物料两个当前位置并可去领料', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const orderRow = page.getByRole('row').filter({ hasText: 'PO-202603-0101' })
  await expect(orderRow).toBeVisible({ timeout: 60_000 })
  const blackMaterial = orderRow.locator('[data-pickup-material-row]').filter({
    hasText: 'Black 弹力斜纹主面料',
  })
  await expect(blackMaterial).toContainText('应配')
  await expect(blackMaterial).toContainText('累计领料')
  const blackLocations = orderRow.locator('article').filter({
    hasText: 'Black 弹力斜纹主面料 · tdv_demand_SPU_2024_010-bom-black-stretch-twill',
  }).filter({ hasText: 'TR-A-010' })
  await expect(blackLocations).toContainText('TR-A-010')
  await expect(blackLocations).toContainText('TR-A-012')
  await expect(blackLocations.getByText(/TR-A-0(10|12)/)).toHaveCount(2)
  await expect(orderRow.getByRole('link', { name: '去领料', exact: true })).toHaveAttribute(
    'href',
    /pickupNodeId=.*version=/,
  )
})

test('已配齐同时覆盖直接配齐和由未配齐升级，均为无编号托盘', async ({ page }) => {
  await page.goto(paths.READY)
  await expect(page.getByText('直接配齐', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('由未配齐升级', { exact: true })).toBeVisible()
  expect(await page.getByText('待领托盘（暂未编号）', { exact: true }).count()).toBeGreaterThanOrEqual(2)
  await expect(page.locator('body')).not.toContainText(/TP[-_]/)
})

test('同一物料 SKU 的两次补料保持独立补料单和独立物料行', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const orderRow = page.getByRole('row').filter({ hasText: 'PO-202603-0004' })
  await expect(orderRow).toBeVisible({ timeout: 60_000 })
  const sku = 'tdv_demand_SPU_2024_010-bom-black-stretch-twill'
  const firstSupplement = orderRow.locator('[data-pickup-material-row]').filter({ hasText: '补料单：SUP-03COM84' })
  const secondSupplement = orderRow.locator('[data-pickup-material-row]').filter({ hasText: '补料单：SUP-032P0J5' })
  await expect(firstSupplement).toHaveCount(1)
  await expect(secondSupplement).toHaveCount(1)
  await expect(firstSupplement).toContainText(sku)
  await expect(secondSupplement).toContainText(sku)
  await expect(firstSupplement).not.toContainText('SUP-032P0J5')
  await expect(secondSupplement).not.toContainText('SUP-03COM84')
  expect(await firstSupplement.getAttribute('data-pickup-material-row')).not.toBe(
    await secondSupplement.getAttribute('data-pickup-material-row'),
  )
})

test('已领料覆盖未配齐先领的三种结果与新增补料重开', async ({ page }) => {
  await page.goto(paths.HISTORY)
  await expect(page.getByText('未配齐先领', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('全部领完', { exact: true })).toBeVisible()
  await expect(page.getByText('未完成全部领料', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('新增补料待领', { exact: true })).toBeVisible()
  const supplementRow = page.locator('[data-pickup-material-row]').filter({ hasText: '补料单：SUP-000TDWG' })
  await expect(supplementRow).toBeVisible()
  await expect(supplementRow).toContainText('应配')
  await expect(supplementRow).toContainText('累计领料')
})

test('页面同时可见无需加工、染色、染色印花三种数量依据', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  await expect(page.getByText(/无需加工 · 按计划数量/).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/染色 · 等待染色一次性完成/).first()).toBeVisible()
  await expect(page.getByText(/染色 → 印花 · 等待印花一次性完成/).first()).toBeVisible()
})

test('筛选、分页、排序三态与列偏好均在 200ms 内局部更新并保持菜单和滚动位置', async ({ page }) => {
  await page.goto(paths.HISTORY)
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/pickup-management\/history$/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '已领料', exact: true })).toBeVisible({ timeout: 60_000 })
  const root = page.locator('[data-pickup-list-root="HISTORY"]')
  await expect(root).toBeVisible({ timeout: 60_000 })
  await root.evaluate((element) => {
    ;(window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot = element
  })
  const menu = page.getByText('领料管理', { exact: true }).first()
  await expect(menu).toBeVisible()

  await measureDomAction(page, {
    type: 'input',
    triggerSelector: '[data-pickup-list-filter="keyword"]',
    observeSelector: '[data-pickup-list-region="table"]',
    value: 'PO-202603-0001',
  })
  await expect(page.getByRole('row').filter({ hasText: 'PO-202603-0001' })).toBeVisible()
  await measureDomAction(page, {
    type: 'input',
    triggerSelector: '[data-pickup-list-filter="keyword"]',
    observeSelector: '[data-pickup-list-region="table"]',
    value: '',
  })
  expect(await page.evaluate(() =>
    (window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot
      === document.querySelector('[data-pickup-list-root="HISTORY"]')
  )).toBe(true)
  await expect(menu).toBeVisible()

  await measureDomAction(page, {
    type: 'click',
    triggerSelector: 'button[data-pickup-list-action="open-column-settings"]',
    observeSelector: '[data-pickup-list-region="overlay"]',
  })
  await expect(page.getByRole('heading', { name: '已领料列设置', exact: true })).toBeVisible()
  const sessionsSetting = page.locator('[data-standard-list-column-key="sessions"]')
  await expect(sessionsSetting).toBeVisible()
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="sessions"] input[data-pickup-list-action="toggle-column-visibility"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.getByRole('columnheader', { name: '领取次数 / 最近时间' })).toHaveCount(0)
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="sessions"] input[data-pickup-list-action="toggle-column-visibility"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.getByRole('columnheader', { name: '领取次数 / 最近时间' })).toBeVisible()
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="sessions"] input[data-pickup-list-action="toggle-column-freeze"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(sessionsSetting.getByLabel('冻结')).toBeChecked()
  await measureDomAction(page, {
    type: 'drag',
    triggerSelector: '[data-standard-list-column-key="sessions"]',
    dropSelector: '[data-standard-list-column-key="productionOrder"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.locator('[data-standard-list-column-key]').first()).toHaveAttribute(
    'data-standard-list-column-key',
    'sessions',
  )
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: 'button[data-pickup-list-action="close-column-settings"]',
    observeSelector: '[data-pickup-list-region="overlay"]',
  })

  for (const [expectedState, expectedLabel] of [
    ['asc', /按生产单降序排列/],
    ['desc', /恢复生产单默认顺序/],
    ['none', /按生产单升序排列/],
  ] as const) {
    await measureDomAction(page, {
      type: 'click',
      triggerSelector: 'button[data-pickup-list-action="sort-column"][data-column-key="productionOrder"]',
      observeSelector: '[data-pickup-list-region="table"]',
    })
    const sortButton = page.locator('button[data-pickup-list-action="sort-column"][data-column-key="productionOrder"]')
    await expect(sortButton).toHaveAttribute('aria-label', expectedLabel)
    await expect(sortButton.locator(`[data-standard-list-sort-icon="${expectedState}"]`)).toBeVisible()
  }

  const scrollTop = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-page-content-root]')?.parentElement
    if (!scroller) return -1
    scroller.scrollTop = Math.min(160, Math.max(scroller.scrollHeight - scroller.clientHeight, 0))
    return scroller.scrollTop
  })
  expect(scrollTop).toBeGreaterThan(0)
  await measureDomAction(page, {
    type: 'change',
    triggerSelector: 'select[data-pickup-list-field="pageSize"]',
    observeSelector: '[data-pickup-list-region="pagination"]',
    value: '20',
  })
  expect(await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-page-content-root]')?.parentElement?.scrollTop
  )).toBe(scrollTop)
  await expect(menu).toBeVisible()
  expect(await page.evaluate(() =>
    (window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot
      === document.querySelector('[data-pickup-list-root="HISTORY"]')
  )).toBe(true)

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management/history') || '{}')
  )
  expect(stored.pageSize).toBe(20)
  expect(stored.frozenKeys).toContain('sessions')
  expect(stored.order[0]).toBe('sessions')

  await page.reload()
  await expect(page.getByRole('heading', { name: '已领料', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('select[data-pickup-list-field="pageSize"]')).toHaveValue('20')
  await expect(page.getByRole('columnheader', { name: '领取次数 / 最近时间' })).toBeVisible()
  await expect(
    page.locator('button[data-pickup-list-action="sort-column"][data-column-key="productionOrder"]'),
  ).toHaveAttribute('aria-label', /按生产单升序排列/)
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 主体不溢出且操作列固定可读`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(paths.INCOMPLETE)
    await expect(page.getByRole('heading', { name: '未配齐配料', exact: true })).toBeVisible({ timeout: 60_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    const scrollContainer = page.locator('[data-standard-list-scroll]').first()
    await expect(scrollContainer).toBeVisible()
    const widths = await scrollContainer.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(widths.scrollWidth).toBeGreaterThan(widths.clientWidth)
    const actionHeader = page.getByRole('columnheader', { name: '操作' })
    await expect(actionHeader).toHaveCSS('position', 'sticky')
    await expect(actionHeader).toHaveCSS('right', '0px')
    if (viewport.width === 1280) {
      const firstMaterial = page.locator('[data-pickup-material-row]').first()
      await expect(firstMaterial.locator('img')).toBeVisible()
      await expect(firstMaterial).toContainText(/主面料|斜纹|帆布/)
      await expect(firstMaterial).toContainText(/tdv_demand_/)
      await expect(firstMaterial).toContainText('应配')
      await expect(firstMaterial).toContainText('累计领料')
      await expect(page.getByRole('link', { name: '去领料', exact: true }).first()).toBeVisible()
    }
  })
}
