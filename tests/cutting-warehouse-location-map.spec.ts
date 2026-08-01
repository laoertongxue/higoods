import { expect, test, type Locator, type Page } from '@playwright/test'
import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source.ts'

const WAIT_PROCESS_PATH = '/fcs/craft/cutting/warehouse-management/wait-process'
const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'
const READY_PICKUP_PATH = '/fcs/craft/cutting/pickup-management/ready'

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
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}tab=locations`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-warehouse-map-root]')).toBeVisible({ timeout: 300_000 })
}

async function clickAndAcceptDialog(page: Page, selector: string): Promise<void> {
  const dialogPromise = page.waitForEvent('dialog')
  await page.locator(selector).evaluate((button) => {
    window.setTimeout(() => (button as HTMLButtonElement).click(), 0)
  })
  await (await dialogPromise).accept()
}

async function expectImageOrPlaceholder(scope: Locator, alt: string, placeholder: string): Promise<void> {
  const image = scope.getByAltText(alt)
  if (await image.count()) {
    await expect(image).toBeVisible()
    const loaded = await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)
    if (loaded) return
  }
  await expect(scope).toContainText(placeholder)
}

async function expectLoadedImage(scope: Locator, alt: string): Promise<void> {
  const image = scope.getByAltText(alt)
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
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
      await page.locator('[data-wait-handover-action="open-inbound"]')
        .filter({ hasText: /^中转袋入仓$/ })
        .click()
      const inboundMap = page.locator('[data-wait-handover-location-map] [data-warehouse-map-root]')
      await expect(inboundMap).toBeVisible({ timeout: 120_000 })
      await expect(inboundMap).toContainText('已选 1 个')
      await page.locator('[data-wait-handover-action="close-dialog"]').last().click()
    }
  })
}

test('普通查看模式可新增库区并在刷新后保留', async ({ page }) => {
  await openWarehouseMap(page, WAIT_PROCESS_PATH)
  await expect(page.locator('[data-warehouse-map-action="open-add-area"]')).toBeVisible()
  await expect(page.locator('[data-warehouse-map-action="open-add-location"]')).toBeVisible()
  const openElapsed = await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('[data-warehouse-map-action="open-add-area"]')
    if (!button) throw new Error('缺少新增库区入口')
    const startedAt = performance.now()
    button.click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('新增库区弹窗未及时打开')), 1_000)
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-cutting-warehouse-modal]')) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    return performance.now() - startedAt
  })
  expect(openElapsed).toBeLessThan(200)
  const modal = page.locator('[data-cutting-warehouse-modal]')
  await expect(modal).toBeVisible()
  await modal.locator('[name="areaName"]').fill('浏览器新增库区')
  let unexpectedDialog = ''
  let unexpectedPageError = ''
  page.once('pageerror', (error) => { unexpectedPageError = error.message })
  page.once('dialog', async (dialog) => {
    unexpectedDialog = dialog.message()
    await dialog.dismiss()
  })
  await modal.locator('[data-warehouse-map-action="submit-add-area"]').click()
  expect(unexpectedDialog, '新增库区不应触发错误提示').toBe('')
  expect(unexpectedPageError, '新增库区不应触发页面异常').toBe('')
  await expect(page.locator('[data-warehouse-map-root]')).toContainText('浏览器新增库区')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-warehouse-map-root]')).toContainText('浏览器新增库区', { timeout: 120_000 })
})

test('普通查看模式可向既有货架新增库位并在刷新后保留', async ({ page }) => {
  await openWarehouseMap(page, WAIT_PROCESS_PATH)
  await page.locator('[data-warehouse-map-action="open-add-location"]').click()
  const modal = page.locator('[data-cutting-warehouse-modal]')
  await expect(modal).toBeVisible()
  const areaValues = await modal.locator('[name="areaId"] option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  )
  if (areaValues.length > 1) {
    await modal.locator('[name="areaId"]').selectOption(areaValues[1])
    await expect(modal.locator('[name="shelfId"] option:checked')).toHaveAttribute('data-area-id', areaValues[1])
  }
  await modal.locator('[name="locationNo"]').fill('浏览器新增库位-01')
  await modal.locator('[data-warehouse-map-action="submit-add-location"]').click()
  await expect(page.locator('[data-warehouse-map-root]')).toContainText('浏览器新增库位-01')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-warehouse-map-root]')).toContainText('浏览器新增库位-01', { timeout: 120_000 })
})

test('新增结构入口覆盖取消、必填、重复编号、版本冲突和编排隐藏', async ({ page }) => {
  await openWarehouseMap(page, WAIT_PROCESS_PATH)
  const root = page.locator('[data-warehouse-map-root]')

  await page.locator('[data-warehouse-map-action="open-add-area"]').click()
  let modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaName"]').fill('取消新增库区')
  await modal.locator('[data-warehouse-map-action="close-add-dialog"]').last().click()
  await expect(root).not.toContainText('取消新增库区')

  await page.locator('[data-warehouse-map-action="open-add-area"]').click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await clickAndAcceptDialog(page, '[data-cutting-warehouse-modal] [data-warehouse-map-action="submit-add-area"]')
  await expect(modal).toBeVisible()
  await modal.locator('[name="areaName"]').fill('版本基线区')
  await modal.locator('[data-warehouse-map-action="submit-add-area"]').click()
  await expect(root).toContainText('版本基线区')

  const existingLocationNo = await root.locator('[data-location-no]').first().getAttribute('data-location-no')
  await page.locator('[data-warehouse-map-action="open-add-location"]').click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="locationNo"]').fill(existingLocationNo || '')
  await clickAndAcceptDialog(page, '[data-cutting-warehouse-modal] [data-warehouse-map-action="submit-add-location"]')
  await expect(modal.locator('[name="locationNo"]')).toHaveValue(existingLocationNo || '')
  await modal.locator('[data-warehouse-map-action="close-add-dialog"]').last().click()
  await page.locator('[data-warehouse-map-action="open-add-location"]').click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="locationNo"]').fill(`  ${(existingLocationNo || '').toLowerCase()}  `)
  await clickAndAcceptDialog(page, '[data-cutting-warehouse-modal] [data-warehouse-map-action="submit-add-location"]')
  await expect(modal).toBeVisible()
  await modal.locator('[data-warehouse-map-action="close-add-dialog"]').last().click()

  await page.locator('[data-warehouse-map-action="open-add-area"]').click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaName"]').fill('冲突保留库区')
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('higood:cutting-warehouse-layout:v2:') && item.includes(':WAIT_PROCESS:'))
    if (!key) throw new Error('缺少待加工仓布局快照')
    const snapshot = JSON.parse(localStorage.getItem(key) || '{}')
    snapshot.layoutVersion += 1
    localStorage.setItem(key, JSON.stringify(snapshot))
  })
  await clickAndAcceptDialog(page, '[data-cutting-warehouse-modal] [data-warehouse-map-action="submit-add-area"]')
  await expect(modal.locator('[name="areaName"]')).toHaveValue('冲突保留库区')
  await modal.locator('[data-warehouse-map-action="close-add-dialog"]').last().click()

  await page.locator('[data-warehouse-map-action="enter-layout"]').click()
  await expect(page.locator('[data-warehouse-map-action="open-add-area"]')).toHaveCount(0)
  await expect(page.locator('[data-warehouse-map-action="open-add-location"]')).toHaveCount(0)
})

test('两张库位图占用详情分别展示物料卷和袋内菲票', async ({ page }) => {
  await openWarehouseMap(page, `${WAIT_PROCESS_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-root]').evaluate((root) => {
    ;(window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot = root
  })
  const drawerElapsed = await page.evaluate(async () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-warehouse-map-action="open-occupancy"]'))
      .find((item) => item.textContent?.includes('PO-DEMO-CUTTING-001'))
    if (!button) throw new Error('缺少占用详情入口')
    const startedAt = performance.now()
    button.click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('占用详情未及时打开')), 1_000)
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-warehouse-map-occupancy-drawer]')) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    return performance.now() - startedAt
  })
  expect(drawerElapsed).toBeLessThan(200)
  const processDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await expect(processDrawer).toBeVisible({ timeout: 120_000 })
  await expect(processDrawer).toContainText(/物料卷明细|演示卷明细/)
  await expectLoadedImage(processDrawer, '物料图')
  await expectLoadedImage(processDrawer, '款式图')
  expect(await page.evaluate(() =>
    (window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot
      === document.querySelector('[data-warehouse-map-root]'),
  )).toBe(true)
  await page.locator('[data-warehouse-map-action="close-occupancy"]').first().click()
  await expect(processDrawer).toHaveCount(0)
  expect(await page.evaluate(() =>
    (window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot
      === document.querySelector('[data-warehouse-map-root]'),
  )).toBe(true)

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-warehouse-map-root]')
    const selector = document.querySelector<HTMLSelectElement>('[data-warehouse-map-action="change-factory"]')
    const factoryId = selector?.selectedOptions[0]?.dataset.factoryId || ''
    const cell = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-location-id]'))
      .find((button) => button.textContent?.includes('空闲'))
    if (!root || !factoryId || !cell) throw new Error('缺少分页测试所需的空闲库位')
    const locationId = cell.dataset.locationId || ''
    const locationNo = cell.dataset.locationNo || ''
    const warehouseId = root.dataset.warehouseId || ''
    const rollDetails = Array.from({ length: 12 }, (_, index) => ({
      rollNo: `ROLL-E2E-${String(index + 1).padStart(3, '0')}`,
      yard: 10,
      meter: 9.14,
      locationNo,
    }))
    localStorage.setItem('cuttingRuntimeEventLedger', JSON.stringify({ events: [{
      eventId: 'EVENT-E2E-ROLL-PAGE',
      eventNo: '领料-E2E-分页',
      eventType: '中转仓领料',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: '2026-07-31 10:00',
      createdAt: '2026-07-31 10:00',
      operatorId: 'U-E2E',
      operatorName: '分页测试仓管',
      operatorRole: 'PDA 仓管',
      refs: { productionOrderNo: 'PO-E2E-PAGE', handoverRecordId: 'SESSION-E2E-PAGE:LINE-001' },
      material: { materialSku: 'MAT-E2E-PAGE', materialName: '分页测试面料', unit: 'yard' },
      inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 120, unit: 'yard', rollCount: 12 },
      payload: {
        pickupSessionId: 'SESSION-E2E-PAGE',
        prepLineId: 'LINE-001',
        pickupQty: 120,
        rollCount: 12,
        rollDetails,
        locationRefs: [{ factoryId, warehouseId, warehouseKind: 'WAIT_PROCESS', locationId, locationNo }],
      },
    }] }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const pagedCell = page.locator('[data-warehouse-map-action="open-occupancy"]').filter({ hasText: 'PO-E2E-PAGE' })
  await expect(pagedCell).toBeVisible({ timeout: 120_000 })
  await pagedCell.click()
  const pagedDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await pagedDrawer.locator('[data-warehouse-map-action="occupancy-detail-page"][data-page="2"]').click()
  await expect(page).toHaveURL(/occupancyDetailPage=2/)
  await expect(pagedDrawer).toContainText('ROLL-E2E-011')
  await expect(pagedDrawer).not.toContainText('ROLL-E2E-001')
  await pagedDrawer.locator('[data-warehouse-map-action="close-occupancy"]').click()

  await openWarehouseMap(page, `${WAIT_HANDOVER_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-action="open-occupancy"]').first().click()
  const handoverDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await expect(handoverDrawer).toBeVisible({ timeout: 120_000 })
  await expect(handoverDrawer).toContainText('袋内菲票明细')
  await expect(handoverDrawer).toContainText('已装菲票')
  await expectImageOrPlaceholder(handoverDrawer, '款式图', '款式图待补充')
})

test('PDA 中转仓领料支持跨区货架层自由多选、任意取消、逐项摘要和清空', async ({ page }) => {
  await page.goto(READY_PICKUP_PATH)
  const pickupHref = await page.getByRole('link', { name: '去领料', exact: true }).first().getAttribute('href')
  expect(pickupHref).toBeTruthy()
  await page.goto(pickupHref!)
  const map = page.locator('[data-pda-cutting-pickup-location-map] [data-warehouse-map-root]')
  await expect(map).toBeVisible({ timeout: 300_000 })
  const crossHierarchyLocations = await map.locator(
    '[data-warehouse-map-action="toggle-location"]:not([disabled])',
  ).evaluateAll((buttons) => {
    const candidates = buttons.map((button) => {
      const element = button as HTMLButtonElement
      const locationNo = element.dataset.locationNo || ''
      const match = locationNo.match(/^([A-Z])-R(\d+)-L(\d+)-P\d+$/)
      return match ? {
        locationId: element.dataset.locationId || '',
        locationNo,
        area: match[1],
        shelf: `${match[1]}-R${match[2]}`,
        level: match[3],
      } : null
    }).filter((item): item is NonNullable<typeof item> => Boolean(item?.locationId))
    for (let first = 0; first < candidates.length; first += 1) {
      for (let second = first + 1; second < candidates.length; second += 1) {
        for (let third = second + 1; third < candidates.length; third += 1) {
          const group = [candidates[first], candidates[second], candidates[third]]
          if (new Set(group.map((item) => item.area)).size > 1
            && new Set(group.map((item) => item.shelf)).size > 1
            && new Set(group.map((item) => item.level)).size > 1) return group
        }
      }
    }
    return []
  })
  expect(crossHierarchyLocations).toHaveLength(3)
  for (const location of crossHierarchyLocations) {
    await map.locator(`[data-location-id="${location.locationId}"]`).click()
  }
  const selectionSummary = map.locator('[data-warehouse-map-selection-summary]')
  const selectedItems = selectionSummary.locator('[data-warehouse-map-selected-item]')
  await expect(selectionSummary).toContainText('已选 3 个库位')
  await expect(selectedItems).toHaveCount(3)
  for (const [index, location] of crossHierarchyLocations.entries()) {
    await expect(selectedItems.nth(index)).toContainText(location.locationNo)
  }
  await expect(selectionSummary).not.toContainText(/范围：|连续|相邻/)
  await selectedItems.nth(1).click()
  await expect(selectionSummary).toContainText('已选 2 个库位')
  await expect(selectionSummary).toContainText(crossHierarchyLocations[0].locationNo)
  await expect(selectionSummary).not.toContainText(crossHierarchyLocations[1].locationNo)
  await expect(selectionSummary).toContainText(crossHierarchyLocations[2].locationNo)
  await expect(map.locator('button[aria-disabled="true"]')).not.toHaveCount(0)
  await map.locator('[data-warehouse-map-action="clear-selection"]').click()
  await expect(selectionSummary).toContainText('已选 0 个库位')
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
