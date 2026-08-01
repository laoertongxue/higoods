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
  test(`PFOS ${warehouseName}通过单一入口维护空库区和分层货架`, async ({ page }) => {
    await openWarehouseMap(page, path)
    const root = page.locator('[data-warehouse-map-root]')
    await expect(root).toContainText('空闲')
    await expect(root).toContainText('占用')
    await expect(page.getByRole('button', { name: '维护库位图', exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: '新增库区', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增库位', exact: true })).toHaveCount(0)
    const elapsed = await page.evaluate(async () => {
      const button = document.querySelector<HTMLButtonElement>('[data-warehouse-map-action="enter-maintenance"]')
      if (!button) throw new Error('缺少维护入口')
      const startedAt = performance.now()
      button.click()
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('维护模式未及时打开')), 1_000)
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-warehouse-map-action="open-create-area"]')) return
          window.clearTimeout(timeout)
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
      return performance.now() - startedAt
    })
    expect(elapsed).toBeLessThan(200)
    await page.locator('[data-warehouse-map-action="open-create-area"]').click()
    let modal = page.locator('[data-cutting-warehouse-modal]')
    await modal.locator('[name="areaCode"]').fill('Z')
    await modal.locator('[name="areaName"]').fill(`浏览器${warehouseName}扩展区`)
    await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
    expect(await page.evaluate(() => Object.values(localStorage).join('\n'))).toContain(`浏览器${warehouseName}扩展区`)
    await expect(root).toContainText(`浏览器${warehouseName}扩展区`)
    await expect(root).toContainText('暂无货架')

    await root.locator('[data-warehouse-map-action="open-create-shelf"]').last().click()
    modal = page.locator('[data-cutting-warehouse-modal]')
    await modal.locator('[name="shelfSequence"]').fill('9')
    await modal.locator('[name="levelCount"]').fill('2')
    await modal.locator('[name="defaultPositionCount"]').fill('2')
    await expect(modal.locator('[data-location-number-preview]')).toContainText('Z-R09-L02-P02')
    await modal.locator('[name="positionCount-2"]').fill('3')
    await expect(modal.locator('[data-location-number-preview]')).toContainText('Z-R09-L02-P03')
    await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
    await expect(root).toContainText('Z-R09-L02-P03')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-warehouse-map-root]')).toContainText('Z-R09-L02-P03', { timeout: 120_000 })
  })
}

test('维护表单冲突和占用保护保留输入并显示受影响编号', async ({ page }) => {
  await openWarehouseMap(page, `${WAIT_PROCESS_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-action="enter-maintenance"]').click()
  await page.locator('[data-warehouse-map-action="open-create-shelf"]').first().click()
  let modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('1')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[role="alert"]')).toContainText('货架序号 1 已存在')
  await expect(modal.locator('[name="shelfSequence"]')).toHaveValue('1')
  await modal.locator('[data-warehouse-map-action="close-maintenance-dialog"]').last().click()

  await page.locator('[data-warehouse-map-action="rename-area"]').first().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('→')
  await expect(modal.locator('[name="areaCode"]')).toBeDisabled()
  await expect(modal).toContainText('占用库位')
  await expect(modal).toContainText(/A-R\d+-L\d+-P\d+/)
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
  const availableLocations = await map.locator(
    '[data-warehouse-map-action="toggle-location"]:not([disabled])',
  ).evaluateAll((buttons) => buttons.slice(0, 2).map((button) => ({
    locationId: (button as HTMLButtonElement).dataset.locationId || '',
    locationNo: (button as HTMLButtonElement).dataset.locationNo || '',
  })))
  expect(availableLocations).toHaveLength(2)
  const [firstLocation, secondLocation] = availableLocations
  const locationInput = page.locator('[data-pda-cut-inbound-field="locationLabel"]')
  const selectionSummary = map.locator('[data-warehouse-map-selection-summary]')
  const selectedItems = selectionSummary.locator('[data-warehouse-map-selected-item]')

  await map.locator(`[data-location-id="${firstLocation.locationId}"]`).click()
  await expect(locationInput).toHaveValue(firstLocation.locationNo)
  await expect(selectionSummary).toContainText('已选 1 个库位')
  await expect(selectedItems).toHaveCount(1)
  await expect(selectedItems).toContainText(firstLocation.locationNo)

  const secondButton = map.locator(`[data-location-id="${secondLocation.locationId}"]`)
  await expect(secondButton).toBeEnabled()
  await expect(secondButton).toHaveAttribute('aria-pressed', 'false')
  await secondButton.click()

  await expect(locationInput).toHaveValue(secondLocation.locationNo)
  await expect(selectionSummary).toContainText('已选 1 个库位')
  await expect(selectedItems).toHaveCount(1)
  await expect(selectedItems).toContainText(secondLocation.locationNo)
  await expect(selectedItems).not.toContainText(firstLocation.locationNo)
  await expect(map.locator(`[data-location-id="${firstLocation.locationId}"]`)).toHaveAttribute('aria-pressed', 'false')
  await expect(secondButton).toHaveAttribute('aria-pressed', 'true')

  await selectedItems.click()
  await expect(locationInput).toHaveValue('')
  await expect(selectionSummary).toContainText('已选 0 个库位')
  await expect(selectedItems).toHaveCount(0)
  await expect(secondButton).toHaveAttribute('aria-pressed', 'false')
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
