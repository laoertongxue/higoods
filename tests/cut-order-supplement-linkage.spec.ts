import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { matchesSupplementFilters } from '../src/pages/process-factory/cutting/cut-orders-model.ts'

const route = '/fcs/craft/cutting/cut-orders'
const storageKey = 'higood:list-page:/fcs/craft/cutting/cut-orders'

async function openList(page: Page): Promise<void> {
  await page.goto(route)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
}

function cutOrderRow(page: Page, cutOrderNo: string) {
  return page.locator('[data-standard-list-table] tbody tr').filter({ hasText: cutOrderNo })
}

async function findCutOrderRow(page: Page, cutOrderNo: string) {
  await page.locator('[data-cutting-piece-field="keyword"]').fill(cutOrderNo)
  const row = cutOrderRow(page, cutOrderNo)
  await expect(row).toHaveCount(1)
  return row
}

async function confirmSupplementFromOperation(page: Page, sequenceNo?: number): Promise<void> {
  const picker = page.locator('[data-cutting-piece-supplement-picker]')
  if (await picker.count()) {
    if (sequenceNo) await picker.getByRole('radio', { name: new RegExp(`第 ${sequenceNo} 次`) }).check()
    await picker.getByRole('button', { name: '确认完成' }).click()
    return
  }
  await page.locator('[data-cutting-piece-supplement-confirm]').getByRole('button', { name: '确认完成' }).click()
}

const stableSupplementFacts = [
  { id: 'supplement-cut14671-b-001', recordNo: 'SUP-CUT14671-B-001', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 1, status: '已完成', reason: '验片破损', totalQty: 393, lineSummary: 'Black/M/9件；Black/M/10件', createdAt: '2026-07-22 10:00', createdBy: '裁床主管 王敏', completedAt: '2026-07-22 10:00', completedBy: '裁床主管 王敏' },
  { id: 'supplement-cut14671-b-002', recordNo: 'SUP-CUT14671-B-002', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 2, status: '未完成', reason: '尺码齐套不足', totalQty: 412, lineSummary: 'Black/M/10件；Black/M/11件', createdAt: '2026-07-22 11:00', createdBy: '裁床主管 王敏', completedAt: '', completedBy: '' },
  { id: 'supplement-cut14671-b-003', recordNo: 'SUP-CUT14671-B-003', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671', sequenceNo: 3, status: '未完成', reason: '尺码齐套不足', totalQty: 431, lineSummary: 'Black/M/11件；Black/M/12件', createdAt: '2026-07-22 12:00', createdBy: '裁床主管 王敏', completedAt: '', completedBy: '' },
]

async function readStableRegistry(page: Page) {
  return page.evaluate(async () => {
    const registry = await import('/src/data/fcs/cutting/supplement-order-registry.ts')
    return registry.listSupplementOrdersByCutOrder('cut-14671-b').map((order) => ({
      id: order.id,
      recordNo: order.recordNo,
      cutOrderId: order.cutOrderId,
      cutOrderNo: order.cutOrderNo,
      productionOrderNo: order.productionOrderNo,
      sequenceNo: order.sequenceNo,
      status: order.status,
      reason: order.reason,
      totalQty: order.totalQty,
      lineSummary: order.lineSummary,
      createdAt: order.createdAt,
      createdBy: order.createdBy,
      completedAt: order.completedAt,
      completedBy: order.completedBy,
    }))
  })
}

async function readAllRegistry(page: Page) {
  return page.evaluate(async () => {
    const registry = await import('/src/data/fcs/cutting/supplement-order-registry.ts')
    return registry.listSupplementOrders().map((order) => order.confirmationKey.startsWith('supplement-page-seed-')
      ? { ...order, createdAt: '<mock-seed-created-at>' }
      : order)
  })
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

test('补料筛选纯规则覆盖空、全完成、混合和矛盾组合', () => {
  const matches = (
    statuses: Array<'未完成' | '已完成'>,
    hasSupplement: 'ALL' | 'YES' | 'NO',
    supplementCompletion: 'ALL' | 'HAS_INCOMPLETE' | 'ALL_COMPLETED',
  ) => matchesSupplementFilters(statuses, { hasSupplement, supplementCompletion })

  expect(matches([], 'ALL', 'ALL')).toBe(true)
  expect(matches([], 'YES', 'ALL')).toBe(false)
  expect(matches([], 'NO', 'ALL')).toBe(true)
  expect(matches([], 'ALL', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches([], 'ALL', 'ALL_COMPLETED')).toBe(false)
  expect(matches(['未完成'], 'YES', 'HAS_INCOMPLETE')).toBe(true)
  expect(matches(['已完成'], 'YES', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches(['已完成', '已完成'], 'ALL', 'ALL_COMPLETED')).toBe(true)
  expect(matches(['已完成', '未完成'], 'ALL', 'ALL_COMPLETED')).toBe(false)
  expect(matches(['未完成'], 'NO', 'HAS_INCOMPLETE')).toBe(false)
  expect(matches(['已完成'], 'NO', 'ALL_COMPLETED')).toBe(false)
})

test('主投影只补入 registry 已关联且存在真实进度候选的裁片单', async ({ page }) => {
  await page.goto(route)
  const projection = await page.evaluate(async () => {
    const [{ buildCutOrderViewModel }, { cuttingOrderProgressRecords }, registry] = await Promise.all([
      import('/src/pages/process-factory/cutting/cut-orders-model.ts'),
      import('/src/data/fcs/cutting/order-progress.ts'),
      import('/src/data/fcs/cutting/supplement-order-registry.ts'),
    ])
    registry.resetSupplementOrderRegistryForTesting()
    const sourceRecord = cuttingOrderProgressRecords.find((record) => record.materialLines.some((line) => line.cutOrderId === 'cut-14671-a'))
    if (!sourceRecord) throw new Error('缺少动态投影验收所需的真实进度候选')
    const dynamicRecord = structuredClone(sourceRecord)
    dynamicRecord.id = 'cutting-op:po-dynamic-projection:cut-dynamic-projection'
    dynamicRecord.productionOrderId = 'po-dynamic-projection'
    dynamicRecord.productionOrderNo = 'PO-DYNAMIC-PROJECTION'
    dynamicRecord.materialLines.forEach((line) => {
      line.cutOrderId = 'cut-dynamic-projection'
      line.cutOrderNo = 'CUT-DYNAMIC-PROJECTION'
      line.cutPieceOrderNo = 'CUT-DYNAMIC-PROJECTION'
    })
    registry.registerSupplementOrder({
      id: 'supplement-dynamic-projection',
      recordNo: 'SUP-DYNAMIC-PROJECTION',
      cutOrderId: 'cut-dynamic-projection',
      cutOrderNo: 'CUT-DYNAMIC-PROJECTION',
      productionOrderNo: 'PO-DYNAMIC-PROJECTION',
      reason: '验收动态投影',
      reasonDetail: '只允许补入有真实进度候选的关联裁片单。',
      totalQty: 2,
      lineSummary: 'Black/M/2件',
      lines: [{ color: 'Black', size: 'M', supplementQty: 2 }],
      materialDemands: [{ materialSku: 'RELEASE-A', materialName: '面料 A · 净色', requiredQty: 0.84, unit: 'yard' }],
      createdAt: '2026-07-23 09:00',
      createdBy: '裁床主管 王敏',
    })
    registry.registerSupplementOrder({
      id: 'supplement-unknown-cut-order',
      recordNo: 'SUP-UNKNOWN-CUT-ORDER',
      cutOrderId: 'cut-not-in-progress',
      cutOrderNo: 'CUT-NOT-IN-PROGRESS',
      productionOrderNo: 'PO-NOT-IN-PROGRESS',
      reason: '验收未知对象',
      reasonDetail: '没有真实进度候选时不得臆造裁片单。',
      totalQty: 1,
      lineSummary: '验收色/M/1件',
      lines: [{ color: '验收色', size: 'M', supplementQty: 1 }],
      materialDemands: [{ materialSku: 'MAT-UNKNOWN', materialName: '未知面料', requiredQty: 1, unit: '米' }],
      createdAt: '2026-07-23 09:01',
      createdBy: '测试主管',
    })
    const linkedCutOrderIdentities = registry.listSupplementOrders().map((order) => ({
      cutOrderId: order.cutOrderId,
      cutOrderNo: order.cutOrderNo,
    }))
    const rows = buildCutOrderViewModel([...cuttingOrderProgressRecords, dynamicRecord], [], {
      supplementLinkedCutOrderIdentities: linkedCutOrderIdentities,
    }).rows
    return rows.map((row) => ({
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      quantityDataAvailable: row.quantityDataAvailable,
      pieceCountText: row.pieceCountText,
      plannedShipDate: row.plannedShipDate,
      currentStage: row.currentStage.label,
    }))
  })

  expect(projection.filter((row) => row.cutOrderId === 'cut-dynamic-projection')).toEqual([{
    cutOrderId: 'cut-dynamic-projection',
    cutOrderNo: 'CUT-DYNAMIC-PROJECTION',
    quantityDataAvailable: false,
    pieceCountText: '未提供',
    plannedShipDate: '',
    currentStage: '已开工',
  }])
  expect(projection.some((row) => row.cutOrderId === 'cut-not-in-progress')).toBe(false)
  expect(projection.some((row) => row.cutOrderId === 'cut-14671-b')).toBe(false)
})

test('无补料事实时不把真实进度候选扩大为裁片单主投影', async ({ page }) => {
  await page.goto(route)
  const cutOrderNos = await page.evaluate(async () => {
    const [{ buildCutOrderViewModel }, { cuttingOrderProgressRecords }] = await Promise.all([
      import('/src/pages/process-factory/cutting/cut-orders-model.ts'),
      import('/src/data/fcs/cutting/order-progress.ts'),
    ])
    const rows = buildCutOrderViewModel(cuttingOrderProgressRecords, [], {
      supplementLinkedCutOrderIdentities: [],
    }).rows
    return rows.map((row) => row.cutOrderNo)
  })

  expect(cutOrderNos).not.toContain('CUT14671-A')
  expect(cutOrderNos).not.toContain('CUT14671-B')
})

test('补料身份对必须同时匹配同一裁片单 ID 与单号且同生产单不串单', async ({ page }) => {
  await page.goto(route)
  const result = await page.evaluate(async () => {
    const [{ buildCutOrderViewModel }, { cuttingOrderProgressRecords }] = await Promise.all([
      import('/src/pages/process-factory/cutting/cut-orders-model.ts'),
      import('/src/data/fcs/cutting/order-progress.ts'),
    ])
    const project = (identities: ReadonlyArray<{ cutOrderId: string; cutOrderNo: string }>) =>
      buildCutOrderViewModel(cuttingOrderProgressRecords, [], {
        supplementLinkedCutOrderIdentities: identities,
      }).rows
        .filter((row) => row.productionOrderNo === 'PO14671' && ['CUT14671-A', 'CUT14671-B'].includes(row.cutOrderNo))
        .map((row) => row.cutOrderNo)

    return {
      crossed: project([{ cutOrderId: ' cut-14671-b ', cutOrderNo: ' cut14671-a ' }]),
      correctA: project([{ cutOrderId: ' CUT-14671-A ', cutOrderNo: ' cut14671-a ' }]),
      correctB: project([{ cutOrderId: ' CUT-14671-B ', cutOrderNo: ' cut14671-b ' }]),
    }
  })

  expect(result.crossed).toEqual([])
  expect(result.correctA).toEqual(['CUT14671-A'])
  expect(result.correctB).toEqual(['CUT14671-B'])
})

test('放行快照创建真实补料后同一 SPA 的裁片单行与详情读取同一事实', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9')
  await expect(page.getByRole('heading', { name: '按放行目标快照新增补料' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('快照编号 cpr-target-po-14671-v9')).toBeVisible()
  const originalCutOrderSelector = page.locator('[data-release-original-cut-order]')
  await expect(originalCutOrderSelector.locator('option')).toHaveText(['CUT14671-A', 'CUT14671-B'])
  await originalCutOrderSelector.selectOption({ label: 'CUT14671-A' })
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('动态投影验收：真实补料归属 CUT14671-A。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await page.getByRole('button', { name: '确认创建补料单' }).click()
  await expect(page.getByRole('heading', { name: '补料单详情' })).toBeVisible({ timeout: 60_000 })
  const created = await page.evaluate(async () => {
    const registry = await import('/src/data/fcs/cutting/supplement-order-registry.ts')
    const order = registry.listSupplementOrders().find((item) => item.reasonDetail === '动态投影验收：真实补料归属 CUT14671-A。')
    if (!order) throw new Error('未找到刚创建的真实补料单')
    return { id: order.id, recordNo: order.recordNo, cutOrderNo: order.cutOrderNo, totalQty: order.totalQty, reason: order.reason }
  })

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/cut-orders')
  })
  await expect(page.getByRole('heading', { name: '裁片单', exact: true })).toBeVisible({ timeout: 30_000 })
  const row = await findCutOrderRow(page, created.cutOrderNo)
  const tag = row.locator(`[data-supplement-id="${created.id}"]`)
  await expect(tag).toBeVisible()
  await expect(tag).toHaveAccessibleName(/补 · 第 \d+ 次 · 未完成/)
  await tag.click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await expect(detail).toContainText(created.recordNo)
  await expect(detail).toContainText(created.cutOrderNo)
  await expect(detail).toContainText(created.reason)
  await expect(detail).toContainText(`${created.totalQty} 件`)
})

test('CUT14671-B 稳定补料定义只允许存在于一个共享 fixture', () => {
  const cutOrdersSource = readFileSync('src/pages/process-factory/cutting/cut-orders.ts', 'utf8')
  const supplementSource = readFileSync('src/pages/process-factory/cutting/supplement-management.ts', 'utf8')
  for (const duplicatedFact of ['supplement-cut14671-b-001', 'SUP-CUT14671-B-001', 'Black/M/9件；Black/M/10件']) {
    expect(cutOrdersSource).not.toContain(duplicatedFact)
    expect(supplementSource).not.toContain(duplicatedFact)
  }
})

test('先访问任一页面都登记同一组 CUT14671-B 补料事实', async ({ browser }) => {
  const cutFirst = await browser.newPage()
  await cutFirst.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(cutFirst.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(cutFirst)).toEqual(stableSupplementFacts)
  await cutFirst.getByRole('button', { name: '裁后处理', exact: true }).click()
  await cutFirst.getByRole('button', { name: '补料管理', exact: true }).click()
  await expect(cutFirst.getByRole('heading', { name: '补料管理' })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(cutFirst)).toEqual(stableSupplementFacts)
  await cutFirst.close()

  const supplementFirst = await browser.newPage()
  await supplementFirst.goto('/fcs/craft/cutting/supplement-management')
  await expect(supplementFirst.getByRole('heading', { name: '补料管理' })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(supplementFirst)).toEqual(stableSupplementFacts)
  await supplementFirst.getByRole('button', { name: '裁前准备', exact: true }).click()
  await supplementFirst.getByRole('complementary').getByRole('button', { name: '裁片单', exact: true }).click()
  await expect(supplementFirst.getByRole('heading', { name: '裁片单', exact: true })).toBeVisible({ timeout: 30_000 })
  expect(await readStableRegistry(supplementFirst)).toEqual(stableSupplementFacts)
  await supplementFirst.close()
})

test('两种访问顺序下相同页面初始化结果一致且补料页覆盖裁片单事实', async ({ browser }) => {
  test.setTimeout(120_000)
  const readByOrder = async (firstRoute: string, secondRoute: string) => {
    const page = await browser.newPage()
    await page.goto(firstRoute)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
    const first = await readAllRegistry(page)
    await page.goto(secondRoute)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
    const second = await readAllRegistry(page)
    await page.goto(firstRoute)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
    const repeated = await readAllRegistry(page)
    await page.close()
    return { first, second, repeated }
  }

  const cutFirst = await readByOrder(route, '/fcs/craft/cutting/supplement-management')
  const supplementFirst = await readByOrder('/fcs/craft/cutting/supplement-management', route)
  for (const snapshot of [cutFirst.first, cutFirst.second, cutFirst.repeated, supplementFirst.first, supplementFirst.second, supplementFirst.repeated]) {
    expect(snapshot.length).toBeGreaterThan(0)
    expect(new Set(snapshot.map((item) => item.cutOrderId)).size).toBeGreaterThan(1)
    expect(snapshot.every((item) => item.reasonDetail && Array.isArray(item.lines) && Array.isArray(item.materialDemands))).toBe(true)
  }
  expect(cutFirst.first).toEqual(cutFirst.repeated)
  expect(cutFirst.first).toEqual(supplementFirst.second)
  expect(cutFirst.second).toEqual(supplementFirst.first)
  expect(cutFirst.second).toEqual(supplementFirst.repeated)
  expect(cutFirst.second).toEqual(expect.arrayContaining(cutFirst.first))
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
    const beforeScroll = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>('[data-standard-list-scroll]')!
      const action = document.querySelector<HTMLElement>('[data-standard-list-action-column]')!
      const ordinary = [...document.querySelectorAll<HTMLElement>('th[data-column-key]')]
        .find((header) => getComputedStyle(header).position !== 'sticky')!
      ;(window as typeof window & { __acceptanceOrdinaryColumn?: HTMLElement }).__acceptanceOrdinaryColumn = ordinary
      return {
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: document.querySelector('main')!.scrollWidth - document.querySelector('main')!.clientWidth,
        tableOverflows: scroll.scrollWidth > scroll.clientWidth,
        actionLeft: action.getBoundingClientRect().left,
        actionRight: action.getBoundingClientRect().right,
        ordinaryLeft: ordinary.getBoundingClientRect().left,
        scrollRight: scroll.getBoundingClientRect().right,
        viewportWidth: window.innerWidth,
      }
    })
    expect(beforeScroll.bodyOverflow).toBeLessThanOrEqual(1)
    expect(beforeScroll.mainOverflow).toBeLessThanOrEqual(1)
    expect(beforeScroll.tableOverflows).toBe(true)
    expect(beforeScroll.actionLeft).toBeGreaterThanOrEqual(0)
    expect(beforeScroll.actionRight).toBeLessThanOrEqual(beforeScroll.viewportWidth)
    expect(Math.abs(beforeScroll.actionRight - beforeScroll.scrollRight)).toBeLessThanOrEqual(16)

    const afterScroll = await page.locator('[data-standard-list-scroll]').evaluate(async (node) => {
      node.scrollLeft = node.scrollWidth
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const action = document.querySelector<HTMLElement>('[data-standard-list-action-column]')!
      const ordinary = (window as typeof window & { __acceptanceOrdinaryColumn?: HTMLElement }).__acceptanceOrdinaryColumn!
      return {
        actionLeft: action.getBoundingClientRect().left,
        actionRight: action.getBoundingClientRect().right,
        ordinaryLeft: ordinary.getBoundingClientRect().left,
        scrollLeft: node.scrollLeft,
        scrollRight: node.getBoundingClientRect().right,
      }
    })
    expect(afterScroll.scrollLeft).toBeGreaterThan(0)
    expect(Math.abs(afterScroll.actionLeft - beforeScroll.actionLeft)).toBeLessThanOrEqual(2)
    expect(Math.abs(afterScroll.actionRight - beforeScroll.actionRight)).toBeLessThanOrEqual(2)
    expect(Math.abs(afterScroll.actionRight - afterScroll.scrollRight)).toBeLessThanOrEqual(16)
    expect(Math.abs(afterScroll.ordinaryLeft - beforeScroll.ordinaryLeft)).toBeGreaterThan(100)
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

test('历史补料投影只新增 CUT14671-B 且不臆造任务边界', async ({ page }) => {
  await openList(page)
  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-A')
  await expect(cutOrderRow(page, 'CUT14671-A')).toHaveCount(0)
  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-B')
  const row = cutOrderRow(page, 'CUT14671-B')
  await expect(row).toHaveCount(1)
  const headers = await page.locator('[data-standard-list-table] thead th').allTextContents()
  const boundaryIndex = headers.findIndex((header) => header.includes('任务边界'))
  expect(boundaryIndex).toBeGreaterThanOrEqual(0)
  const boundaryCell = row.locator('td').nth(boundaryIndex)
  await expect(boundaryCell).not.toContainText('独立裁片任务')
  await expect(boundaryCell).not.toContainText('回我方裁片仓')
  await expect(boundaryCell).not.toContainText('回货后生成后续工艺单')
  await expect(boundaryCell).toContainText(/未提供|—/)
})

test('历史裁片单数量未知时不展示为真实零值', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  const headers = await page.locator('[data-standard-list-table] thead th').allTextContents()
  const patternCell = row.locator('td').nth(headers.findIndex((header) => header.includes('纸样')))
  const quantityCell = row.locator('td').nth(headers.findIndex((header) => header.includes('数量账')))
  await expect(patternCell).toContainText('有效幅宽：未提供')
  await expect(quantityCell).toContainText('未提供')
  await expect(row).not.toContainText('0厘米')
  await expect(row).not.toContainText('0 件')
  await expect(row).not.toContainText('需求用量：0 米')
})

test('补料详情只读展示布料业务节点且没有完成入口', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9')
  await expect(page.getByRole('heading', { name: '按放行目标快照新增补料' })).toBeVisible({ timeout: 60_000 })
  await page.locator('[data-release-original-cut-order]').selectOption({ label: 'CUT14671-B' })
  await page.locator('[data-supplement-reason]').selectOption('尺码齐套不足')
  await page.locator('[data-supplement-reason-detail]').fill('裁片单布料业务详情验收。')
  await page.getByRole('button', { name: '提交补料' }).click()
  await page.getByRole('button', { name: '确认创建补料单' }).click()
  await expect(page.getByRole('heading', { name: '补料单详情' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('裁片单布料业务详情验收。')).toBeVisible()
  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/craft/cutting/cut-orders')
  })
  const row = await findCutOrderRow(page, 'CUT14671-B')
  await row.locator('[data-supplement-id]').filter({ hasText: '未完成' }).last().click()
  const detail = page.locator('[data-cutting-piece-supplement-detail]')
  await expect(detail).toContainText('布料业务详情')
  await expect(detail).toContainText('库存')
  await expect(detail).toContainText('采购')
  await expect(detail).toContainText('染色')
  await expect(detail).toContainText('印花')
  await expect(detail).toContainText('中转仓配料')
  await expect(detail.getByText('完成该补料单', { exact: true })).toHaveCount(0)
})

test('操作栏补料选择层取消、完成及末单完成均有可靠焦点返回', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const row = cutOrderRow(page, 'CUT14671-B')
  let trigger = row.getByRole('button', { name: '完成补料', exact: true })

  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.locator('[data-cutting-piece-supplement-picker]').getByRole('button', { name: '取消' }).click()
  await expect(trigger).toBeFocused()

  await trigger.click()
  let picker = page.locator('[data-cutting-piece-supplement-picker]')
  await picker.getByRole('radio', { name: /第 2 次/ }).check()
  await picker.getByRole('button', { name: '确认完成' }).click()
  trigger = row.getByRole('button', { name: '完成补料', exact: true })
  await expect(trigger).toBeFocused()

  await trigger.click()
  await confirmSupplementFromOperation(page, 3)
  await expect(trigger).toHaveCount(0)
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 已完成', exact: true })).toBeFocused()
  await expect(page.locator('body')).not.toBeFocused()
})

test('未完成筛选下末单完成导致整行消失时焦点返回完成状态筛选', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  const completionFilter = page.locator('[data-cutting-piece-field="supplementCompletion"]')
  await completionFilter.selectOption('HAS_INCOMPLETE')
  const row = cutOrderRow(page, 'CUT14671-B')

  for (const sequence of [2, 3]) {
    await row.getByRole('button', { name: '完成补料', exact: true }).click()
    await confirmSupplementFromOperation(page, sequence)
  }

  await expect(row).toHaveCount(0)
  await expect(completionFilter).toBeFocused()
  await expect(page.locator('body')).not.toBeFocused()
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('裁片单总数')
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('0')
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('共 0 条')
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('1 / 1')
})

test('同值 change 不吞补料点击且单一事件通道只打开一次', async ({ page }) => {
  await page.goto(`${route}?cutOrderNo=CUT14671-B`)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-cutting-piece-field="keyword"]').evaluate((input) => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const overlay = page.locator('[data-cutting-piece-region="overlay"]')
  const mutationCount = await page.evaluate(() => new Promise<number>((resolve) => {
    const region = document.querySelector('[data-cutting-piece-region="overlay"]')!
    let mutations = 0
    const observer = new MutationObserver((records) => { mutations += records.length })
    observer.observe(region, { childList: true })
    document.querySelector<HTMLButtonElement>('[aria-label="补 · 第 2 次 · 未完成"]')!.click()
    requestAnimationFrame(() => {
      observer.disconnect()
      resolve(mutations)
    })
  }))
  await expect(overlay.locator('[data-cutting-piece-supplement-detail]')).toHaveCount(1)
  expect(mutationCount).toBe(1)
  const source = readFileSync('src/pages/process-factory/cutting/cut-orders.ts', 'utf8')
  expect(source).not.toContain('bindCutOrderSupplementInteractions')
})

test('操作栏一次只完成一张未完成补料且全部完成后动作消失', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openList(page)
  const row = await findCutOrderRow(page, 'CUT14671-B')
  await page.locator('[data-cutting-piece-field="supplementCompletion"]').selectOption('HAS_INCOMPLETE')
  await page.evaluate(() => {
    const win = window as typeof window & { __supplementActionStableRegions?: Record<string, Element | null> }
    win.__supplementActionStableRegions = Object.fromEntries(['main', 'filters', 'pagination'].map((name) => [
      name,
      name === 'main' ? document.querySelector('main') : document.querySelector(`[data-cutting-piece-region="${name}"]`),
    ]))
  })
  const pagination = page.locator('[data-cutting-piece-region="pagination"]')
  await pagination.evaluate((node) => {
    const win = window as typeof window & { __supplementFilteredPagination?: Element; __supplementPaginationMutations?: number }
    win.__supplementFilteredPagination = node
    win.__supplementPaginationMutations = 0
    new MutationObserver((records) => { win.__supplementPaginationMutations! += records.length })
      .observe(node, { childList: true, subtree: true, characterData: true })
  })
  const scroll = page.locator('[data-standard-list-scroll]')
  await scroll.evaluate((node) => { node.scrollLeft = 180 })
  await row.getByRole('button', { name: '完成补料', exact: true }).click()
  const dialog = page.locator('[data-cutting-piece-supplement-picker]')
  await expect(dialog.getByRole('heading', { name: '完成补料' })).toBeVisible()
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await expect(dialog).not.toContainText('SUP-CUT14671-B-001')
  const secondOption = dialog.getByRole('radio', { name: /第 2 次.*SUP-CUT14671-B-002/ }).locator('xpath=ancestor::label')
  await expect(secondOption).toContainText('SUP-CUT14671-B-002')
  await expect(secondOption).toContainText('第 2 次')
  await expect(secondOption).toContainText('2026-07-22 11:00')
  await expect(secondOption).toContainText('尺码齐套不足')
  await expect(secondOption).toContainText('Black/M/10件；Black/M/11件')
  await expect(secondOption).toContainText('412 件')
  const submit = dialog.getByRole('button', { name: '确认完成' })
  await expect(submit).toBeDisabled()
  const second = dialog.getByRole('radio', { name: /第 2 次.*SUP-CUT14671-B-002/ })
  await second.click()
  await second.click({ force: true })
  await expect(second).toBeChecked()
  await expect(submit).toBeEnabled()
  const verticalScrollBefore = await page.evaluate(async () => {
    const spacer = document.createElement('div')
    spacer.dataset.testSupplementScrollSpacer = 'true'
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.height = '1200px'
    spacer.style.pointerEvents = 'none'
    document.body.append(spacer)
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.min(160, maxScroll))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return { maxScroll, scrollY: window.scrollY }
  })
  expect(verticalScrollBefore.maxScroll).toBeGreaterThan(0)
  expect(verticalScrollBefore.scrollY).toBeGreaterThan(0)
  const completionEvidence = await page.evaluate(() => new Promise<{
    elapsed: number
    tableMutations: number
    statsMutations: number
  }>((resolve, reject) => {
    const button = document.querySelector<HTMLButtonElement>('[data-cutting-piece-supplement-picker] [data-cutting-piece-action="complete-selected-supplement"]')
    const table = document.querySelector('[data-cutting-piece-region="table"]')
    const stats = document.querySelector('[data-cutting-piece-region="stats"]')
    if (!button || !table || !stats) return reject(new Error('缺少操作栏补料完成验收节点'))
    const startedAt = performance.now()
    let tableMutations = 0
    let statsMutations = 0
    const finishIfUpdated = () => {
      const tableText = table.textContent || ''
      if (tableMutations === 0 || statsMutations === 0) return
      if (!tableText.includes('补 · 第 2 次 · 已完成') || !tableText.includes('补 · 第 3 次 · 未完成')) return
      tableObserver.disconnect()
      statsObserver.disconnect()
      resolve({ elapsed: performance.now() - startedAt, tableMutations, statsMutations })
    }
    const tableObserver = new MutationObserver((records) => {
      tableMutations += records.length
      finishIfUpdated()
    })
    const statsObserver = new MutationObserver((records) => {
      statsMutations += records.length
      finishIfUpdated()
    })
    tableObserver.observe(table, { childList: true, subtree: true, characterData: true })
    statsObserver.observe(stats, { childList: true, subtree: true, characterData: true })
    button.click()
    window.setTimeout(() => {
      tableObserver.disconnect()
      statsObserver.disconnect()
      reject(new Error('操作栏补料完成后标签、行或统计未在 200ms 内同步更新'))
    }, 200)
  }))
  console.log(`裁片单操作栏完成补料局部响应：${completionEvidence.elapsed.toFixed(1)}ms`)
  expect(completionEvidence.elapsed).toBeLessThan(200)
  expect(completionEvidence.tableMutations).toBeGreaterThan(0)
  expect(completionEvidence.statsMutations).toBeGreaterThan(0)
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成', exact: true })).toBeVisible()
  expect(await page.evaluate(() => {
    const win = window as typeof window & { __supplementActionStableRegions?: Record<string, Element | null> }
    return Object.fromEntries(Object.entries(win.__supplementActionStableRegions || {}).map(([name, node]) => [
      name,
      node === (name === 'main' ? document.querySelector('main') : document.querySelector(`[data-cutting-piece-region="${name}"]`)),
    ]))
  })).toEqual({ main: true, filters: true, pagination: true })
  const verticalScrollAfter = await page.evaluate(() => window.scrollY)
  console.log(`裁片单操作栏完成补料纵向滚动保持：max=${verticalScrollBefore.maxScroll}px，before=${verticalScrollBefore.scrollY}px，after=${verticalScrollAfter}px`)
  expect(Math.abs(verticalScrollAfter - verticalScrollBefore.scrollY)).toBeLessThanOrEqual(1)
  expect(await scroll.evaluate((node) => node.scrollLeft)).toBe(180)

  await row.getByRole('button', { name: '完成补料', exact: true }).click()
  await expect(page.locator('[data-cutting-piece-supplement-confirm]')).toContainText('SUP-CUT14671-B-003')
  await confirmSupplementFromOperation(page, 3)
  await expect(row).toHaveCount(0)
  await expect(page.locator('[data-cutting-piece-region="table"]')).toContainText('当前条件下暂无裁片单')
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('裁片单总数')
  await expect(page.locator('[data-cutting-piece-region="stats"]')).toContainText('0')
  await expect(pagination).toContainText('共 0 条')
  await expect(pagination).toContainText('1 / 1')
  expect(await page.evaluate(() => document.querySelector('[data-cutting-piece-region="pagination"]') === (
    window as typeof window & { __supplementFilteredPagination?: Element }
  ).__supplementFilteredPagination)).toBe(true)
  expect(await page.evaluate(() => (
    window as typeof window & { __supplementPaginationMutations?: number }
  ).__supplementPaginationMutations)).toBeGreaterThan(0)
  await page.evaluate(() => document.querySelector('[data-test-supplement-scroll-spacer]')?.remove())
})

test('补料完成导致跨页 clamp 时表格分页同步且滚动稳定', async ({ page }) => {
  await openList(page)
  const seeded = await page.evaluate(async () => {
    const [{ buildCutOrderViewModel }, { cuttingOrderProgressRecords }, registry, fixtureRepository] = await Promise.all([
      import('/src/pages/process-factory/cutting/cut-orders-model.ts'),
      import('/src/data/fcs/cutting/order-progress.ts'),
      import('/src/data/fcs/cutting/supplement-order-registry.ts'),
      import('/src/data/fcs/cutting/cut-order-supplement-fixture.ts'),
    ])
    registry.resetSupplementOrderRegistryForTesting()
    fixtureRepository.stableCutOrderSupplementFixtures.slice(1).forEach(({ sequenceNo: _sequenceNo, initialStatus: _initialStatus, ...fixture }) => {
      registry.registerSupplementOrder({ ...fixture, materialDemands: [] })
    })
    const rows = buildCutOrderViewModel(cuttingOrderProgressRecords).rows
    const candidates = [...new Map(rows
      .filter((row) => row.cutOrderNo.localeCompare('CUT14671-B', 'zh-CN') < 0)
      .map((row) => [row.cutOrderId, row])).values()].slice(0, 9)
    candidates.forEach((row, index) => registry.registerSupplementOrder({
      id: `pagination-supplement-${index}`,
      recordNo: `SUP-PAGE-${String(index + 1).padStart(2, '0')}`,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderNo: row.productionOrderNo,
      reason: '分页联动验收',
      reasonDetail: '用于验证完成末页补料后分页回退。',
      totalQty: 1,
      lineSummary: '验收补料 1 件',
      lines: [{ color: '验收色', size: 'M', supplementQty: 1 }],
      materialDemands: [{ materialSku: 'MAT-PAGE-001', materialName: '分页验收面料', requiredQty: 1, unit: '米' }],
      createdAt: '2026-07-22 13:00',
      createdBy: '测试主管',
    }))
    return candidates.length
  })
  expect(seeded).toBe(9)
  await page.locator('[data-cutting-piece-field="supplementCompletion"]').selectOption('HAS_INCOMPLETE')
  const cutOrderHeader = page.locator('th[data-column-key="cutOrder"]')
  await cutOrderHeader.getByRole('button').click()
  await expect(cutOrderHeader).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('2 / 2')
  const row = cutOrderRow(page, 'CUT14671-B')
  await expect(row).toHaveCount(1)
  const scroll = page.locator('[data-standard-list-scroll]')
  await scroll.evaluate((node) => { node.scrollLeft = 180 })
  for (let remaining = 2; remaining >= 1; remaining -= 1) {
    await row.getByRole('button', { name: '完成补料', exact: true }).click()
    const picker = page.locator('[data-cutting-piece-supplement-picker]')
    if (await picker.count()) await picker.getByRole('radio').first().check()
    const button = await picker.count()
      ? picker.getByRole('button', { name: '确认完成' })
      : page.locator('[data-cutting-piece-supplement-confirm]').getByRole('button', { name: '确认完成' })
    const responseMs = await button.evaluate(async (button) => {
      const startedAt = performance.now()
      ;(button as HTMLButtonElement).click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      return performance.now() - startedAt
    })
    expect(responseMs).toBeLessThan(200)
    if (remaining === 2) await expect(row).toHaveCount(1)
  }
  await expect(row).toHaveCount(0)
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('1 / 1')
  await expect(page.locator('[data-cutting-piece-region="pagination"]')).toContainText('共 10 条')
  await expect(page.locator('[data-standard-list-table] tbody tr')).toHaveCount(10)
  expect(await scroll.evaluate((node) => node.scrollLeft)).toBe(180)
})

test('补料存在性和完成状态筛选遵守无补料边界并局部刷新', async ({ page }) => {
  await openList(page)
  await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __supplementFilterMain?: Element }).__supplementFilterMain = node
  })
  const hasSupplement = page.locator('[data-cutting-piece-field="hasSupplement"]')
  const completion = page.locator('[data-cutting-piece-field="supplementCompletion"]')
  await expect(hasSupplement.locator('option')).toHaveText(['全部', '有补料', '无补料'])
  await expect(completion.locator('option')).toHaveText(['全部', '有未完成', '全部已完成'])

  await page.locator('[data-cutting-piece-field="keyword"]').fill('CUT14671-B')
  await completion.selectOption('HAS_INCOMPLETE')
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(1)
  const incompleteRows = page.locator('[data-standard-list-table] tbody tr')
  expect(await incompleteRows.count()).toBeGreaterThan(0)
  for (const row of await incompleteRows.all()) await expect(row).toContainText('未完成')
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible()

  await hasSupplement.selectOption('NO')
  await expect(completion).toHaveValue('ALL')
  await expect(completion).toBeDisabled()
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(0)
  for (const row of await page.locator('[data-standard-list-table] tbody tr').all()) {
    await expect(row.getByRole('button', { name: /^补 ·/ })).toHaveCount(0)
  }

  await hasSupplement.selectOption('YES')
  await expect(completion).toBeEnabled()
  await expect(cutOrderRow(page, 'CUT14671-B')).toHaveCount(1)
  expect(await page.evaluate(() => document.querySelector('main') === (
    window as typeof window & { __supplementFilterMain?: Element }
  ).__supplementFilterMain)).toBe(true)
})
