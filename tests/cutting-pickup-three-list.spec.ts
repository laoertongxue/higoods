import { expect, test, type Page } from '@playwright/test'

const paths = {
  READY: '/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: '/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: '/fcs/craft/cutting/pickup-management/history',
} as const

test.setTimeout(180_000)

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
  const repeatedSkuRows = orderRow.locator('[data-pickup-material-row]').filter({
    hasText: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
  })
  expect(await repeatedSkuRows.count()).toBeGreaterThanOrEqual(2)
  await expect(orderRow.getByText('补料单：SUP-03COM84', { exact: true })).toBeVisible()
  await expect(orderRow.getByText('补料单：SUP-032P0J5', { exact: true })).toBeVisible()
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

test('筛选与列设置局部更新，页面根节点和菜单保持稳定', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/pickup-management\/incomplete$/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '未配齐配料', exact: true })).toBeVisible({ timeout: 60_000 })
  const root = page.locator('[data-pickup-list-root="INCOMPLETE"]')
  await expect(root).toBeVisible({ timeout: 60_000 })
  await root.evaluate((element) => {
    ;(window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot = element
  })
  const menu = page.getByText('领料管理', { exact: true }).first()
  await expect(menu).toBeVisible()

  const filter = page.getByLabel('生产单 / 配料单')
  await filter.fill('PO-202603-0101')
  await expect(page.getByRole('row').filter({ hasText: 'PO-202603-0101' })).toBeVisible()
  expect(await page.evaluate(() =>
    (window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot
      === document.querySelector('[data-pickup-list-root="INCOMPLETE"]')
  )).toBe(true)
  await expect(menu).toBeVisible()

  await page.getByRole('button', { name: '列设置' }).click()
  await expect(page.getByRole('heading', { name: '未配齐配料列设置', exact: true })).toBeVisible()
  expect(await page.evaluate(() =>
    (window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot
      === document.querySelector('[data-pickup-list-root="INCOMPLETE"]')
  )).toBe(true)
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 主体不溢出且操作列固定可读`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(paths.INCOMPLETE)
    await expect(page.getByRole('heading', { name: '未配齐配料', exact: true })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('link', { name: '去领料', exact: true }).first()).toBeVisible()
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
  })
}
