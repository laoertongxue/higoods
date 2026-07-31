import { expect, test, type Page } from '@playwright/test'
import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source.ts'

const WAIT_PROCESS_PATH = '/fcs/craft/cutting/warehouse-management/wait-process'
const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'
const PICKUP_MANAGEMENT_PATH = '/fcs/craft/cutting/pickup-management'

test.setTimeout(600_000)

async function resetWarehouseMapStores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('warehouse-map-e2e-initialized') === '1') return
    Object.keys(localStorage)
      .filter((key) => key.startsWith('higood:cutting-warehouse-layout:'))
      .forEach((key) => localStorage.removeItem(key))
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'F090_operator',
      loginId: 'F090_operator',
      userName: '裁床仓管',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'F090',
      factoryName: '全能力测试工厂',
      loggedAt: '2026-07-30 10:00:00',
    }))
    sessionStorage.setItem('warehouse-map-e2e-initialized', '1')
  })
}

async function openWarehouseMap(page: Page, path: string): Promise<void> {
  await page.goto(`${path}?tab=locations`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-warehouse-map-root]')).toBeVisible({ timeout: 300_000 })
}

test.beforeEach(async ({ page }) => {
  await resetWarehouseMapStores(page)
})

for (const path of [WAIT_PROCESS_PATH, WAIT_HANDOVER_PATH]) {
  const warehouseName = path === WAIT_PROCESS_PATH ? '待加工仓' : '待交出仓'
  test(`PFOS ${warehouseName}库位图仅展示空闲和占用，并支持局部编排持久化`, async ({ page }) => {
    await openWarehouseMap(page, path)
    const root = page.locator('[data-warehouse-map-root]')
    await expect(root).toContainText('空闲')
    await expect(root).toContainText('占用')
    await expect(root).not.toContainText('库位组')
    await expect(root).not.toContainText('部分占用')
    await expect(root).not.toContainText('预留')

    const sectionIsRecorded = await root.evaluate((element) => {
      ;(window as typeof window & { __warehouseMapSection?: Element }).__warehouseMapSection =
        element.closest('[data-cutting-warehouse-map-section]') || undefined
      return true
    })
    expect(sectionIsRecorded).toBe(true)
    const elapsed = await page.evaluate(async () => {
      const button = document.querySelector<HTMLButtonElement>('[data-warehouse-map-action="enter-layout"]')
      if (!button) throw new Error('缺少编排入口')
      const startedAt = performance.now()
      button.click()
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('编排模式未及时打开')), 1_000)
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-warehouse-map-action="rename-area"]')) return
          window.clearTimeout(timeout)
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
      return performance.now() - startedAt
    })
    expect(elapsed).toBeLessThan(200)
    expect(await page.evaluate(() =>
      (window as typeof window & { __warehouseMapSection?: Element }).__warehouseMapSection
      === document.querySelector('[data-cutting-warehouse-map-section]'),
    )).toBe(true)
    await expect(page.locator('[data-warehouse-map-action="rename-area"]').first()).toBeVisible()
    await expect(page.locator('[data-warehouse-map-action="rename-shelf"]').first()).toBeVisible()
    await expect(page.locator('[data-warehouse-map-action="rename-location"]').first()).toBeVisible()

    const renameDialog = page.waitForEvent('dialog')
    await page.locator('[data-warehouse-map-action="rename-area"]').first().evaluate((button) => {
      window.setTimeout(() => (button as HTMLButtonElement).click(), 0)
    })
    await (await renameDialog).accept('验收库区')
    await expect(page.locator('[data-warehouse-map-root]')).toContainText('验收库区')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-warehouse-map-root]')).toContainText('验收库区', { timeout: 120_000 })
    if (path === WAIT_HANDOVER_PATH) {
      await page.locator('[data-wait-handover-web-action="open-inbound"]').click()
      const inboundMap = page.locator('[data-wait-handover-location-map] [data-warehouse-map-root]')
      await expect(inboundMap).toBeVisible({ timeout: 120_000 })
      await expect(inboundMap).toContainText('已选 1 个')
      await page.locator('[data-wait-handover-action="close-dialog"]').last().click()
    }
  })
}

test('PDA 中转仓领料支持连续多选、范围摘要、非法库位禁用和清空', async ({ page }) => {
  await page.goto(PICKUP_MANAGEMENT_PATH)
  const pickupHref = await page.getByText('办理领料入库', { exact: true }).first().getAttribute('href')
  expect(pickupHref).toBeTruthy()
  await page.goto(pickupHref!)
  const map = page.locator('[data-pda-cutting-pickup-location-map] [data-warehouse-map-root]')
  await expect(map).toBeVisible({ timeout: 300_000 })
  const continuousPair = await map.locator('article').evaluateAll((articles) => {
    for (const article of articles) {
      const ids = Array.from(article.querySelectorAll<HTMLButtonElement>(
        '[data-warehouse-map-action="toggle-location"]:not([disabled])',
      )).map((button) => button.dataset.locationId || '').filter(Boolean)
      if (ids.length >= 2) return ids.slice(0, 2)
    }
    return []
  })
  expect(continuousPair).toHaveLength(2)
  await map.locator(`[data-location-id="${continuousPair[0]}"]`).click()
  await map.locator(`[data-location-id="${continuousPair[1]}"]`).click()
  await expect(map).toContainText('已选 2 个')
  await expect(map).toContainText('范围：')
  await expect(map.locator('button[aria-disabled="true"]')).not.toHaveCount(0)
  await map.locator('[data-warehouse-map-action="clear-selection"]').click()
  await expect(map).toContainText('已选 0 个')
})

test('PDA 中转袋入仓可从库位图单选空闲库位', async ({ page }) => {
  const taskId = listPdaCuttingTaskSourceRecords()[0]?.taskId
  expect(taskId).toBeTruthy()
  await page.goto(`/fcs/pda/cutting/inbound/${taskId}?action=inbound-location`)
  const map = page.locator('[data-pda-inbound-location-map] [data-warehouse-map-root]')
  await expect(map).toBeVisible({ timeout: 300_000 })
  const first = map.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').first()
  const locationNo = await first.getAttribute('data-location-no')
  await first.click()
  await expect(page.locator('[data-pda-cut-inbound-field="locationLabel"]')).toHaveValue(locationNo || '')
  await expect(map).toContainText('已选 1 个')
  const stillEnabled = map.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])')
  await expect(stillEnabled).toHaveCount(1)
  await expect(stillEnabled).toHaveAttribute('aria-pressed', 'true')
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}×${viewport.height} 库位图不产生页面级横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const path = viewport.width <= 390
      ? `/fcs/pda/cutting/inbound/${listPdaCuttingTaskSourceRecords()[0]?.taskId}?action=inbound-location`
      : WAIT_PROCESS_PATH
    if (viewport.width <= 390) {
      await page.goto(path)
      await expect(page.locator('[data-warehouse-map-root]')).toBeVisible({ timeout: 300_000 })
    } else {
      await openWarehouseMap(page, path)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width)
  })
}
