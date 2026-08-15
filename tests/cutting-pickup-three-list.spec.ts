import { expect, test, type Locator, type Page } from '@playwright/test'

const paths = {
  READY: '/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: '/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: '/fcs/craft/cutting/pickup-management/history',
} as const

// 冷启动会初始化完整补料、加工结果与接收节点；交互性能仍由 measureDomAction 单独按 200ms 门禁校验。
test.setTimeout(300_000)

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

function cardByOrder(page: Page, productionOrderNo: string): Locator {
  return page.locator(`[data-pickup-order-card][data-production-order-no="${productionOrderNo}"]`)
}

test.beforeEach(async ({ page }) => {
  await resetPickupStores(page)
})

const expectedStats = {
  READY: ['待领生产单', '一次直接配齐', '从未配齐升级', '当前未编号托盘'],
  INCOMPLETE: ['未配齐生产单', '当前占用库位', '可整批接收生产单', '含补料生产单'],
  HISTORY: ['有接收记录生产单', '已配齐后接收', '未配齐先领', '尚未全部领完', '新增补料待领'],
} as const

const expectedExtraFields = {
  READY: ['readySource', 'palletNumbered'],
  INCOMPLETE: ['locationKeyword', 'shortageOnly'],
  HISTORY: ['historyPath', 'finalResult'],
} as const

for (const [kind, heading] of [
  ['READY', '已配齐待接收'],
  ['INCOMPLETE', '未配齐配料'],
  ['HISTORY', '已接收'],
] as const) {
  test(`${heading}使用同一生产单卡片骨架、保留上方区域并在底部提供分页`, async ({ page }) => {
    await page.goto(paths[kind])
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 60_000 })

    const cards = page.locator('[data-pickup-order-card]')
    await expect(cards.first()).toBeVisible({ timeout: 60_000 })
    const cardIds = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-production-order-id')))
    expect(new Set(cardIds).size).toBe(cardIds.length)

    const firstCard = cards.first()
    await expect(firstCard).not.toContainText('生产单信息')
    await expect(firstCard.locator('[data-pickup-card-header]')).toBeVisible()
    await expect(firstCard.locator('[data-pickup-card-summary-band]')).toBeVisible()
    await expect(firstCard.locator('[data-pickup-style-summary]')).toContainText('SPU')
    await expect(firstCard.locator('[data-pickup-style-summary] img')).toHaveCount(1)
    const firstSegment = firstCard.locator('[data-pickup-demand-segment]').first()
    await expect(firstSegment).toBeVisible()
    await expect(firstSegment.getByRole('columnheader', { name: '物料', exact: true })).toBeVisible()
    await expect(firstSegment.getByRole('columnheader', { name: '应配', exact: true })).toBeAttached()
    await expect(firstSegment.getByRole('columnheader', { name: '累计接收', exact: true })).toBeAttached()
    await expect(firstSegment.getByRole('columnheader', { name: '位置 / 载体', exact: true })).toBeAttached()
    for (const removed of ['加工状态', '加工可供', '已到仓', '超配异常']) {
      await expect(firstSegment.getByRole('columnheader', { name: removed, exact: true })).toHaveCount(0)
    }
    const firstMaterial = firstSegment.locator('[data-pickup-material-row]').first()
    await expect(firstMaterial.locator('img')).toHaveCount(1)
    await expect(firstMaterial).toContainText(/面料|辅料|纱线|包材/)
    await expect(firstMaterial).toContainText(/tdv_demand_|FAB-|ACC-|YARN-|PACK-/)

    const stats = page.locator('[data-standard-list-stats]')
    await expect(stats.locator(':scope > div')).toHaveCount(expectedStats[kind].length)
    for (const label of expectedStats[kind]) await expect(stats.getByText(label, { exact: true })).toBeVisible()
    for (const selector of [
      '[data-pickup-list-filter="keyword"]',
      '[data-pickup-list-filter="materialKeyword"]',
      '[data-pickup-list-field="demandSource"]',
      '[data-pickup-list-field="processRoute"]',
    ]) await expect(page.locator(selector)).toBeVisible()
    for (const field of expectedExtraFields[kind]) {
      await expect(page.locator(`[data-pickup-list-filter="${field}"], [data-pickup-list-field="${field}"]`)).toBeVisible()
    }
    await expect(page.locator('[data-pickup-list-filter="recentDate"]')).toBeVisible()

    const pagination = page.locator('[data-pickup-list-region="pagination"] footer')
    await expect(pagination).toBeAttached()
    await expect(pagination.getByText(/共 \d+ 条/)).toBeAttached()
    await expect(pagination.locator('select[data-pickup-list-field="pageSize"]')).toHaveValue('10')
    await expect(pagination.getByRole('button', { name: '上一页', exact: true })).toBeAttached()
    await expect(pagination.getByRole('button', { name: '下一页', exact: true })).toBeAttached()
    await expect(page.getByText('查看详情', { exact: true })).toHaveCount(0)
  })
}

test('未配齐稳定组精确展示同物料两个当前位置并可在 Web 打开接收', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const orderCard = cardByOrder(page, 'PO-202603-0101')
  await expect(orderCard).toBeVisible({ timeout: 60_000 })
  const blackMaterialRow = orderCard.locator('tbody tr').filter({ hasText: 'Black 弹力斜纹主面料' }).first()
  await expect(blackMaterialRow).toContainText('tdv_demand_SPU_2024_010-bom-black-stretch-twill')
  await expect(blackMaterialRow).toContainText('TR-A-010')
  await expect(blackMaterialRow).toContainText('TR-A-012')
  await expect(blackMaterialRow.getByText(/TR-A-0(10|12)/)).toHaveCount(2)
  await orderCard.getByRole('button', { name: '接收', exact: true }).first().click()
  const receiptDialog = page.locator('[data-pickup-receipt-modal]')
  await expect(receiptDialog).toBeVisible()
  await expect(receiptDialog).toContainText('确认接收')
  await expect(receiptDialog.locator('[data-pickup-receipt-readonly-items]')).toBeVisible()
  await expect(page).toHaveURL(paths.INCOMPLETE)
})

test('已配齐卡片按既有配齐来源展示无编号待接收托盘', async ({ page }) => {
  await page.goto(paths.READY)
  await expect(page.getByText('直接配齐', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  const cardSummaries = page.locator('[data-pickup-card-summary="READY"]')
  await expect(cardSummaries.first()).toBeVisible()
  expect(await cardSummaries.count()).toBeGreaterThanOrEqual(1)
  expect(await cardSummaries.evaluateAll((nodes) => nodes.every((node) => /直接配齐|由未配齐升级/.test(node.textContent || '')))).toBe(true)
  expect(await page.getByText('待接收托盘（暂未编号）', { exact: true }).count()).toBeGreaterThanOrEqual(1)
  await expect(page.locator('body')).not.toContainText(/TP[-_]/)
})

test('同一生产单只保留一张卡片，两次同 SKU 补料保持独立分段和物料行', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const keywordFilter = page.locator('[data-pickup-list-filter="keyword"]')
  await expect(keywordFilter).toBeVisible({ timeout: 60_000 })
  await keywordFilter.fill('PO-202603-0004')
  const orderCard = cardByOrder(page, 'PO-202603-0004')
  await expect(orderCard).toBeVisible({ timeout: 10_000 })
  await expect(orderCard).toHaveCount(1)
  const supplementSegments = orderCard.locator('[data-pickup-demand-segment]').filter({ hasText: '补料单：' })
  await expect.poll(() => supplementSegments.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2)
  const sku = 'tdv_demand_SPU_2024_010-bom-black-stretch-twill'
  const matchingSupplements = supplementSegments.filter({
    has: page.locator('[data-pickup-material-row]').filter({ hasText: sku }),
  })
  await expect.poll(() => matchingSupplements.count()).toBeGreaterThanOrEqual(2)
  const firstSupplement = matchingSupplements.nth(0)
  const secondSupplement = matchingSupplements.nth(1)
  const firstMaterial = firstSupplement.locator('[data-pickup-material-row]').filter({ hasText: sku }).first()
  const secondMaterial = secondSupplement.locator('[data-pickup-material-row]').filter({ hasText: sku }).first()
  const firstSupplementNo = (await firstSupplement.textContent())?.match(/补料单：(SUP-[A-Z0-9]+)/)?.[1]
  const secondSupplementNo = (await secondSupplement.textContent())?.match(/补料单：(SUP-[A-Z0-9]+)/)?.[1]
  expect(firstSupplementNo).toBeTruthy()
  expect(secondSupplementNo).toBeTruthy()
  expect(firstSupplementNo).not.toBe(secondSupplementNo)
  expect(await firstMaterial.getAttribute('data-pickup-material-row')).not.toBe(
    await secondMaterial.getAttribute('data-pickup-material-row'),
  )
})

test('已接收卡片覆盖接收路径、三种结果与新增补料物料重开', async ({ page }) => {
  await page.goto(paths.HISTORY)
  await expect(page.locator('[data-pickup-material-row]').first()).toBeVisible({ timeout: 120_000 })
  for (const label of ['未配齐先接收', '全部接收', '尚未全部接收', '新增补料待接收']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  }
  await page.locator('[data-pickup-list-filter="materialKeyword"]').fill('SUP-000TDWG')
  const supplementSegment = page.locator('[data-pickup-demand-segment]').filter({ hasText: 'SUP-000TDWG' })
  await expect(supplementSegment).toBeVisible()
  await expect(supplementSegment.locator('tbody tr').filter({ hasText: 'SUP-000TDWG' }).first()).toBeVisible()
  await expect(supplementSegment.getByRole('columnheader', { name: '应配', exact: true })).toBeAttached()
  await expect(supplementSegment.getByRole('columnheader', { name: '累计接收', exact: true })).toBeAttached()
})

test('加工路线筛选覆盖无需加工、染色、印花和先染后印四种数量依据', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const routeFilter = page.locator('[data-pickup-list-field="processRoute"]')
  await expect(routeFilter).toBeVisible({ timeout: 60_000 })
  expect(await routeFilter.locator('option').evaluateAll((options) => options.map((option) => option.getAttribute('value'))))
    .toEqual(['ALL', 'NONE', 'DYE', 'PRINT', 'DYE_PRINT'])
  for (const route of ['NONE', 'DYE', 'PRINT', 'DYE_PRINT']) {
    await routeFilter.selectOption(route)
    await expect(routeFilter).toHaveValue(route)
  }
})

test('款式和物料缩略图共用大图预览，并支持按钮、遮罩、Esc 与失败态', async ({ page }) => {
  await page.goto(paths.INCOMPLETE)
  const firstCard = page.locator('[data-pickup-order-card]').first()
  await expect(firstCard).toBeVisible({ timeout: 60_000 })

  const styleButton = firstCard.locator('[data-pickup-style-summary] button[data-pickup-list-action="open-image-preview"]')
  const materialButton = firstCard.locator('[data-pickup-material-row] button[data-pickup-list-action="open-image-preview"]').first()
  await expect(styleButton).toBeVisible()
  await expect(materialButton).toBeVisible()
  for (const button of [styleButton, materialButton]) {
    const src = await button.getAttribute('data-image-src')
    expect(src).toBeTruthy()
    expect(src).not.toMatch(/placeholder|via\.placeholder/i)
  }

  await styleButton.click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('img')).toHaveAttribute('alt', /款式图/)
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await materialButton.click()
  dialog = page.getByRole('dialog')
  await expect(dialog.locator('img')).toHaveAttribute('alt', /实物图/)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await styleButton.click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '关闭大图', exact: true }).click({ position: { x: 5, y: 5 } })
  await expect(dialog).toHaveCount(0)

  await materialButton.click()
  dialog = page.getByRole('dialog')
  await dialog.locator('img').evaluate((image) => image.dispatchEvent(new Event('error')))
  await expect(dialog.getByText('图片加载失败，请核对素材。', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
})

test('筛选、分页、排序与物料列偏好均在 200ms 内局部更新并保持菜单和滚动位置', async ({ page }) => {
  await page.goto(paths.HISTORY)
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/pickup-management\/history$/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '已接收', exact: true })).toBeVisible({ timeout: 60_000 })
  const root = page.locator('[data-pickup-list-root="HISTORY"]')
  await expect(root).toBeVisible({ timeout: 60_000 })
  await root.evaluate((element) => {
    ;(window as typeof window & { __pickupListRoot?: Element }).__pickupListRoot = element
  })
  const menu = page.getByText('接收管理', { exact: true }).first()
  await expect(menu).toBeVisible()

  const keywordFilterElapsed = await measureDomAction(page, {
    type: 'input',
    triggerSelector: '[data-pickup-list-filter="keyword"]',
    observeSelector: '[data-pickup-list-region="table"]',
    value: 'PO-202603-0001',
  })
  expect(keywordFilterElapsed, '筛选输入到 DOM 总耗时必须在 200ms 门槛内保留至少 30ms 余量').toBeLessThan(170)
  console.log(`接收列表筛选输入到 DOM 总耗时：${keywordFilterElapsed.toFixed(1)}ms`)
  await expect(cardByOrder(page, 'PO-202603-0001')).toBeVisible()
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
  await expect(page.getByRole('heading', { name: '已接收物料明细列设置', exact: true })).toBeVisible()
  const preparedSetting = page.locator('[data-standard-list-column-key="preparedQty"]')
  const sourceSetting = page.locator('[data-standard-list-column-key="source"]')
  await expect(preparedSetting).toBeVisible()
  await expect(sourceSetting).toBeVisible()
  for (const removedKey of ['process', 'processAvailableQty', 'arrivedQty', 'overageQty']) {
    await expect(page.locator(`[data-standard-list-column-key="${removedKey}"]`)).toHaveCount(0)
  }
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="preparedQty"] input[data-pickup-list-action="toggle-column-visibility"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.getByRole('columnheader', { name: '当前配料', exact: true })).toHaveCount(0)
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="preparedQty"] input[data-pickup-list-action="toggle-column-visibility"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.getByRole('columnheader', { name: '当前配料', exact: true }).first()).toBeVisible()
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: '[data-standard-list-column-key="source"] input[data-pickup-list-action="toggle-column-freeze"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(sourceSetting.getByLabel('冻结')).toBeChecked()
  await measureDomAction(page, {
    type: 'drag',
    triggerSelector: '[data-standard-list-column-key="source"]',
    dropSelector: '[data-standard-list-column-key="material"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(page.locator('[data-standard-list-column-key]').first()).toHaveAttribute('data-standard-list-column-key', 'source')
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: 'button[data-pickup-list-action="close-column-settings"]',
    observeSelector: '[data-pickup-list-region="overlay"]',
  })

  await measureDomAction(page, {
    type: 'change',
    triggerSelector: 'select[data-pickup-sort-select]',
    observeSelector: '[data-pickup-list-region="table"]',
    value: 'productionOrder',
  })
  await expect(page.locator('select[data-pickup-sort-select]')).toHaveValue('productionOrder')
  const directionButton = page.locator('button[data-pickup-list-action="toggle-sort-direction"]')
  await expect(directionButton).toHaveText('升序')
  await measureDomAction(page, {
    type: 'click',
    triggerSelector: 'button[data-pickup-list-action="toggle-sort-direction"]',
    observeSelector: '[data-pickup-list-region="table"]',
  })
  await expect(directionButton).toHaveText('降序')

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
  expect(stored.frozenKeys).toContain('source')
  expect(stored.order[0]).toBe('source')

  await page.reload()
  await expect(page.getByRole('heading', { name: '已接收', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('select[data-pickup-list-field="pageSize"]')).toHaveValue('20')
  await expect(page.getByRole('columnheader', { name: '需求来源', exact: true }).first()).toBeVisible()
  await expect(page.locator('select[data-pickup-sort-select]')).toHaveValue('')
})

test('旧列偏好中的四个删除列会被归一清理且不再出现在列设置', async ({ page }) => {
  const preferenceKey = 'standard-list:/fcs/craft/cutting/pickup-management/incomplete'
  await page.goto('/')
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      order: ['material', 'process', 'processAvailableQty', 'arrivedQty', 'overageQty', 'source', 'location', 'preparedQty'],
      visibleKeys: ['material', 'process', 'processAvailableQty', 'arrivedQty', 'overageQty', 'source', 'location', 'preparedQty'],
      frozenKeys: ['material', 'process'],
      pageSize: 20,
    }))
  }, preferenceKey)
  await page.goto(paths.INCOMPLETE)
  await expect(page.locator('select[data-pickup-list-field="pageSize"]')).toHaveValue('20')
  await page.locator('button[data-pickup-list-action="open-column-settings"]').click()
  for (const removedKey of ['process', 'processAvailableQty', 'arrivedQty', 'overageQty']) {
    await expect(page.locator(`[data-standard-list-column-key="${removedKey}"]`)).toHaveCount(0)
  }
  await page.locator('button[data-pickup-list-action="restore-column-settings"]').click()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), preferenceKey)
  expect(stored.order).not.toEqual(expect.arrayContaining(['process', 'processAvailableQty', 'arrivedQty', 'overageQty']))
  expect(stored.visibleKeys).not.toEqual(expect.arrayContaining(['process', 'processAvailableQty', 'arrivedQty', 'overageQty']))
  expect(stored.frozenKeys).not.toEqual(expect.arrayContaining(['process', 'processAvailableQty', 'arrivedQty', 'overageQty']))
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 主体不溢出、宽表只在卡内滚动且卡头操作可读`, async ({ page }) => {
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
    expect(widths.scrollWidth).toBeGreaterThanOrEqual(widths.clientWidth)
    const firstCard = page.locator('[data-pickup-order-card]').first()
    const cardBox = await firstCard.boundingBox()
    expect(cardBox).not.toBeNull()
    expect(cardBox!.x).toBeGreaterThanOrEqual(0)
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width + 1)
    await expect(page.getByRole('button', { name: '接收', exact: true }).first()).toBeVisible()
    const compactBands = await firstCard.evaluate((card) => {
      const header = card.querySelector<HTMLElement>('[data-pickup-card-header]')
      const summary = card.querySelector<HTMLElement>('[data-pickup-card-summary-band]')
      return { header: header?.offsetHeight || 0, summary: summary?.offsetHeight || 0 }
    })
    expect(compactBands.header + compactBands.summary).toBeLessThanOrEqual(176)
    await expect(page.locator('[data-pickup-list-region="pagination"] footer')).toBeAttached()
    if (viewport.width === 1280) {
      const firstMaterial = page.locator('[data-pickup-material-row]').first()
      await expect(firstMaterial.locator('img')).toBeVisible()
      await expect(firstMaterial).toContainText(/面料|辅料|纱线|包材/)
      await expect(firstMaterial).toContainText(/tdv_demand_|FAB-|ACC-|YARN-|PACK-/)
      await expect(firstCard.locator('[data-pickup-style-summary] img')).toBeVisible()
    }
  })
}
